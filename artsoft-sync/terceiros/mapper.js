/**
 * Mapper de fichas de terceiro (TerFch) para logistics.cliente / .fornecedor.
 *
 * Chave natural em ambas: (empresa_id, codigo_interno), onde codigo_interno é o
 * número ARTSOFT do terceiro (Cli.Numero / For.Numero) — o mesmo número que as
 * guias guardam em terceiro_numero, o que permite ligá-las mais tarde.
 * UPSERT idempotente.
 */

export class ErroMapperTerceiro extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroMapperTerceiro";
  }
}

/**
 * Compõe uma morada legível a partir dos campos separados do ARTSOFT.
 * A coluna morada é texto livre, por isso juntam-se morada, localidade e
 * código postal, ignorando os vazios.
 *
 * @param {object} t
 * @returns {string|null}
 */
export function comporMorada(t) {
  const partes = [t.morada, t.localidade, t.cod_postal]
    .map((p) => String(p ?? "").trim())
    .filter((p) => p !== "");
  return partes.length > 0 ? partes.join(", ") : null;
}

/**
 * UPSERT de um terceiro numa das tabelas (cliente ou fornecedor).
 *
 * @param {object} client       cliente PostgreSQL
 * @param {string} empresaId    UUID
 * @param {'cliente'|'fornecedor'} tabela
 * @param {object} terceiro     registo parseado
 * @returns {Promise<{codigo: string, criado: boolean}>}
 */
export async function upsertTerceiro(client, empresaId, tabela, terceiro) {
  if (tabela !== "cliente" && tabela !== "fornecedor") {
    throw new ErroMapperTerceiro(`Tabela inválida: ${tabela}`);
  }

  const codigo = String(terceiro?.numero ?? "").trim();
  if (!codigo) {
    throw new ErroMapperTerceiro("Terceiro sem número (codigo_interno é obrigatório)");
  }

  const nome = String(terceiro.nome ?? "").trim() || `(${tabela} ${codigo})`;
  const nif = String(terceiro.nif ?? "").trim() || null;
  const morada = comporMorada(terceiro);

  const res = await client.query(
    `
    INSERT INTO logistics.${tabela} (
      empresa_id, codigo_interno, nome, nif, morada
    ) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (empresa_id, codigo_interno) DO UPDATE SET
      nome = EXCLUDED.nome,
      nif = EXCLUDED.nif,
      morada = EXCLUDED.morada
    RETURNING (xmax = 0) AS criado_novo
    `,
    [empresaId, codigo, nome, nif, morada]
  );

  return { codigo, criado: res.rows[0].criado_novo };
}

/**
 * Processa um lote de terceiros com UPSERT em batch (1 round-trip via
 * unnest, em vez de 1 UPSERT por terceiro). Validação continua isolada por
 * item em JS antes do batch, preservando o comportamento de "um terceiro
 * malformado não trava os restantes".
 *
 * @param {object} client
 * @param {string} empresaId
 * @param {'cliente'|'fornecedor'} tabela
 * @param {Array<object>} terceiros
 * @returns {Promise<{processados: number, criados: number, atualizados: number, erros: Array}>}
 */
export async function processarTerceiros(client, empresaId, tabela, terceiros) {
  if (tabela !== "cliente" && tabela !== "fornecedor") {
    throw new ErroMapperTerceiro(`Tabela inválida: ${tabela}`);
  }
  if (!Array.isArray(terceiros) || terceiros.length === 0) {
    return { processados: 0, criados: 0, atualizados: 0, erros: [] };
  }

  const erros = [];
  const cols = { codigo: [], nome: [], nif: [], morada: [] };

  for (const t of terceiros) {
    try {
      const codigo = String(t?.numero ?? "").trim();
      if (!codigo) {
        throw new ErroMapperTerceiro("Terceiro sem número (codigo_interno é obrigatório)");
      }
      cols.codigo.push(codigo);
      cols.nome.push(String(t.nome ?? "").trim() || `(${tabela} ${codigo})`);
      cols.nif.push(String(t.nif ?? "").trim() || null);
      cols.morada.push(comporMorada(t));
    } catch (erro) {
      erros.push({ codigo: t?.numero ?? "(sem número)", erro: erro.message });
    }
  }

  if (cols.codigo.length === 0) {
    return { processados: 0, criados: 0, atualizados: 0, erros };
  }

  // tabela vem só de uma whitelist validada acima ('cliente'|'fornecedor'),
  // por isso a interpolação direta no nome da tabela é segura.
  const res = await client.query(
    `
    INSERT INTO logistics.${tabela} (empresa_id, codigo_interno, nome, nif, morada)
    SELECT $1, * FROM unnest($2::varchar[], $3::varchar[], $4::varchar[], $5::text[])
      AS t(codigo_interno, nome, nif, morada)
    ON CONFLICT (empresa_id, codigo_interno) DO UPDATE SET
      nome = EXCLUDED.nome,
      nif = EXCLUDED.nif,
      morada = EXCLUDED.morada
    RETURNING (xmax = 0) AS criado_novo
    `,
    [empresaId, cols.codigo, cols.nome, cols.nif, cols.morada]
  );

  const criados = res.rows.filter((r) => r.criado_novo).length;
  const atualizados = res.rows.length - criados;

  return { processados: res.rows.length, criados, atualizados, erros };
}
