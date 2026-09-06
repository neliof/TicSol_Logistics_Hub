/**
 * Mapper de fichas de artigo (StkFch) para logistics.produto.
 *
 * Chave natural: (empresa_id, sku_interno). O sku_interno é o Cod.Codigo do
 * ARTSOFT. UPSERT idempotente — reprocessar a mesma ficha não duplica nem
 * apaga dados manuais que não venham do ERP (ti/hi, temperatura, etc.).
 */

export class ErroMapperProduto extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroMapperProduto";
  }
}

/**
 * Converte uma flag ARTSOFT ("1"/"0"/"S"/"N"/"true") em boolean.
 * Devolve `fallback` quando o valor é ausente/indecifrável, para não sobrepor
 * o default da coluna com um palpite.
 *
 * @param {unknown} valor
 * @param {boolean} fallback
 * @returns {boolean}
 */
export function flagParaBool(valor, fallback = false) {
  const s = String(valor ?? "").trim().toUpperCase();
  if (s === "") return fallback;
  if (["1", "S", "SIM", "TRUE", "T", "Y"].includes(s)) return true;
  if (["0", "N", "NAO", "NÃO", "FALSE", "F"].includes(s)) return false;
  return fallback;
}

/**
 * Converte um número ARTSOFT (vírgula ou ponto decimal) em Number, ou null.
 * Um "0" legítimo é preservado; só ausência/lixo vira null.
 *
 * @param {unknown} valor
 * @returns {number|null}
 */
export function numeroOuNull(valor) {
  const s = String(valor ?? "").trim().replace(",", ".");
  if (s === "") return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Converte um inteiro ARTSOFT em Number inteiro, ou null.
 *
 * @param {unknown} valor
 * @returns {number|null}
 */
export function inteiroOuNull(valor) {
  const n = numeroOuNull(valor);
  if (n === null) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null; // unidades_por_caixa 0 não tem significado útil
}

/**
 * Normaliza um Cod.Opcional do ARTSOFT num EAN, ou null.
 * A coluna ean13 é varchar(13); só é EAN o que for só dígitos até 13 posições
 * (cobre EAN-8/12/13). Códigos alternativos internos mais longos ficam de fora.
 *
 * @param {unknown} valor
 * @returns {string|null}
 */
export function normalizarEan(valor) {
  const s = String(valor ?? "").trim();
  return /^\d{1,13}$/.test(s) ? s : null;
}

/**
 * UPSERT de um produto. Só toca nas colunas derivadas do ERP; as colunas de
 * configuração logística manual (ti, hi, peso_caixa_max_kg, temperatura...)
 * ficam com o valor que já tinham (ou o default no insert).
 *
 * @param {object} client       cliente PostgreSQL
 * @param {string} empresaId    UUID
 * @param {object} produto      registo parseado
 * @returns {Promise<{sku: string, criado: boolean}>}
 */
export async function upsertProduto(client, empresaId, produto) {
  const sku = String(produto?.codigo ?? "").trim();
  if (!sku) {
    throw new ErroMapperProduto("Produto sem código (sku_interno é obrigatório)");
  }

  const descricao = String(produto.descricao ?? "").trim() || sku;

  // Cod.Opcional do ARTSOFT nem sempre é um EAN: pode ser um código alternativo
  // interno mais longo. A coluna ean13 é varchar(13), por isso só lá entra o que
  // parece mesmo um código de barras (só dígitos, até 14 posições — cobre
  // EAN-8/12/13). O resto fica em dados_extra.codigo_opcional.
  const codOpcional = String(produto.ean ?? "").trim();
  const ean = normalizarEan(codOpcional);

  const pesoLiq = numeroOuNull(produto.peso_liquido);
  const unidadesCaixa = inteiroOuNull(produto.unidades_por_caixa);
  const controlaLote = flagParaBool(produto.controla_lote, true);
  const controlaValidade = flagParaBool(produto.controla_validade, true);

  const extra = {
    ...(produto.dados_extra || {}),
  };
  if (codOpcional && !ean) extra.codigo_opcional = codOpcional;
  if (produto.unidade) extra.unidade = String(produto.unidade).trim();
  if (produto.peso_bruto != null && String(produto.peso_bruto).trim() !== "") {
    extra.peso_bruto = numeroOuNull(produto.peso_bruto);
  }
  if (produto.dias_validade) extra.dias_validade = inteiroOuNull(produto.dias_validade);

  const res = await client.query(
    `
    INSERT INTO logistics.produto (
      empresa_id, sku_interno, ean13, descricao,
      peso_liquido_kg, unidades_por_caixa,
      controla_lote, controla_validade, dimensoes_caixa_mm, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (empresa_id, sku_interno) DO UPDATE SET
      ean13 = EXCLUDED.ean13,
      descricao = EXCLUDED.descricao,
      peso_liquido_kg = EXCLUDED.peso_liquido_kg,
      unidades_por_caixa = EXCLUDED.unidades_por_caixa,
      controla_lote = EXCLUDED.controla_lote,
      controla_validade = EXCLUDED.controla_validade,
      dimensoes_caixa_mm = COALESCE(logistics.produto.dimensoes_caixa_mm, '{}'::jsonb) || EXCLUDED.dimensoes_caixa_mm,
      updated_at = NOW()
    RETURNING (xmax = 0) AS criado_novo
    `,
    [
      empresaId,
      sku,
      ean,
      descricao,
      pesoLiq,
      unidadesCaixa,
      controlaLote,
      controlaValidade,
      JSON.stringify(extra),
    ]
  );

  return { sku, criado: res.rows[0].criado_novo };
}

/**
 * Processa um lote de produtos. Cada UPSERT é independente — um artigo com
 * problema não trava os restantes; os erros são recolhidos e devolvidos.
 *
 * @param {object} client
 * @param {string} empresaId
 * @param {Array<object>} produtos
 * @returns {Promise<{processados: number, criados: number, atualizados: number, erros: Array}>}
 */
export async function processarProdutos(client, empresaId, produtos) {
  if (!Array.isArray(produtos) || produtos.length === 0) {
    return { processados: 0, criados: 0, atualizados: 0, erros: [] };
  }

  let criados = 0;
  let atualizados = 0;
  const erros = [];

  for (const produto of produtos) {
    try {
      const { criado } = await upsertProduto(client, empresaId, produto);
      if (criado) criados++;
      else atualizados++;
    } catch (erro) {
      erros.push({ codigo: produto?.codigo ?? "(sem código)", erro: erro.message });
    }
  }

  return { processados: criados + atualizados, criados, atualizados, erros };
}
