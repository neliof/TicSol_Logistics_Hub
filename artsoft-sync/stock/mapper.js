/**
 * Mapper de stock agregado (StkAgr) para logistics.artsoft_stock_snapshot.
 *
 * O StkAgr vem por produto/armazém/validade; a tabela de staging guarda um
 * saldo por produto. Por isso o saldo (QtdEntr - QtdSaid) é agregado por
 * código de artigo antes de gravar.
 *
 * A tabela é um staging de reconciliação (não substitui o stock físico do WMS)
 * e mantém histórico: cada execução insere um novo snapshot, carimbado com um
 * único data_sync. A vista vw_reconciliacao_stock usa sempre o mais recente.
 */

export class ErroMapperStock extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroMapperStock";
  }
}

/**
 * Converte um número ARTSOFT (vírgula/ponto) em Number; ausência/lixo -> 0.
 * Aqui o 0 é o neutro certo: uma linha sem quantidade não deve mexer no saldo.
 *
 * @param {unknown} valor
 * @returns {number}
 */
export function numero(valor) {
  const s = String(valor ?? "").trim().replace(",", ".");
  if (s === "") return 0;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Agrega o saldo (entrada - saída) por código de artigo.
 *
 * @param {Array<object>} linhas   linhas parseadas de StkAgr
 * @returns {Map<string, number>}  codigo -> saldo
 */
export function agregarSaldos(linhas) {
  const saldos = new Map();
  for (const l of linhas || []) {
    const codigo = String(l?.codigo ?? "").trim();
    if (!codigo) continue;
    const saldo = numero(l.qtd_entrada) - numero(l.qtd_saida);
    saldos.set(codigo, (saldos.get(codigo) ?? 0) + saldo);
  }
  return saldos;
}

/**
 * Grava um snapshot de stock. Resolve cada código para produto_id (a coluna é
 * FK) e insere uma linha por produto com o saldo agregado. Produtos que não
 * existem em logistics.produto são ignorados e contados como não resolvidos —
 * sincronizar as fichas (StkFch) primeiro reduz esse número a zero.
 *
 * Todas as linhas partilham o mesmo data_sync, para que a vista de
 * reconciliação as leia como um único snapshot coerente.
 *
 * @param {object} client       cliente PostgreSQL
 * @param {string} empresaId    UUID
 * @param {Map<string, number>} saldos
 * @param {object} [opcoes]
 * @param {string} [opcoes.origem]  'rest'|'odbc'|'file'
 * @returns {Promise<{gravados: number, nao_resolvidos: number}>}
 */
export async function gravarSnapshot(client, empresaId, saldos, { origem = "rest" } = {}) {
  if (!(saldos instanceof Map) || saldos.size === 0) {
    return { gravados: 0, nao_resolvidos: 0 };
  }

  const dataSync = new Date();
  let gravados = 0;
  let naoResolvidos = 0;

  for (const [codigo, saldo] of saldos) {
    const prod = await client.query(
      `SELECT id FROM logistics.produto WHERE empresa_id = $1 AND sku_interno = $2 LIMIT 1`,
      [empresaId, codigo]
    );
    if (prod.rows.length === 0) {
      naoResolvidos++;
      continue;
    }

    await client.query(
      `
      INSERT INTO logistics.artsoft_stock_snapshot (
        empresa_id, produto_id, quantidade_artsoft, origem, data_sync
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (empresa_id, produto_id, data_sync) DO UPDATE SET
        quantidade_artsoft = EXCLUDED.quantidade_artsoft,
        origem = EXCLUDED.origem
      `,
      [empresaId, prod.rows[0].id, saldo, origem, dataSync]
    );
    gravados++;
  }

  return { gravados, nao_resolvidos: naoResolvidos };
}
