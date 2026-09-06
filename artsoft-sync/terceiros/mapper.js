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
 * Processa um lote de terceiros. Cada UPSERT é independente.
 *
 * @param {object} client
 * @param {string} empresaId
 * @param {'cliente'|'fornecedor'} tabela
 * @param {Array<object>} terceiros
 * @returns {Promise<{processados: number, criados: number, atualizados: number, erros: Array}>}
 */
export async function processarTerceiros(client, empresaId, tabela, terceiros) {
  if (!Array.isArray(terceiros) || terceiros.length === 0) {
    return { processados: 0, criados: 0, atualizados: 0, erros: [] };
  }

  let criados = 0;
  let atualizados = 0;
  const erros = [];

  for (const t of terceiros) {
    try {
      const { criado } = await upsertTerceiro(client, empresaId, tabela, t);
      if (criado) criados++;
      else atualizados++;
    } catch (erro) {
      erros.push({ codigo: t?.numero ?? "(sem número)", erro: erro.message });
    }
  }

  return { processados: criados + atualizados, criados, atualizados, erros };
}
