/**
 * Parser de respostas XML de stock agregado (StkAgr) do ARTSOFT.
 *
 * Lista simples de <rec>, uma linha por produto/armazém/data de validade.
 * O saldo de cada linha é QtdEntr - QtdSaid; a agregação por produto é feita
 * no mapper. Sem conversão de tipos aqui.
 *
 * Saída: [{ codigo, armazem, data_validade, qtd_entrada, qtd_saida,
 *           qtd_cativa, localizacao, suporte, palete }]
 */

import { comoLista, texto, textoDe } from "../artsoft/xml.js";

export class ErroParserStock extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroParserStock";
  }
}

function parseLinhaStock(no) {
  if (!no || typeof no !== "object") return null;

  const codigo = textoDe(no, "Codigo", "StkAgr.Codigo");
  if (!codigo) return null;

  return {
    codigo: String(codigo).trim(),
    armazem: textoDe(no, "NrArm", "StkAgr.NrArm"),
    data_validade: textoDe(no, "DtValid", "StkAgr.DtValid"),
    qtd_entrada: textoDe(no, "QtdEntr", "StkAgr.QtdEntr"),
    qtd_saida: textoDe(no, "QtdSaid", "StkAgr.QtdSaid"),
    qtd_cativa: textoDe(no, "QtdCativa", "StkAgr.QtdCativa"),
    localizacao: textoDe(no, "LocArm", "StkAgr.LocArm"),
    suporte: textoDe(no, "Suporte", "StkAgr.Suporte"),
    palete: textoDe(no, "Palete", "StkAgr.Div.Palete"),
  };
}

/**
 * Parser principal — transforma XML parseado em lista de linhas de stock.
 *
 * @param {Record<string, unknown>} raiz
 * @returns {Array<object>}
 * @throws {ErroParserStock}
 */
export function parseStockResponse(raiz) {
  if (!raiz || typeof raiz !== "object") {
    throw new ErroParserStock("Raiz parseada nula ou não é objeto");
  }

  const regs = comoLista(raiz.rec || raiz.Document || raiz.row);
  if (regs.length === 0) return [];

  const linhas = [];
  for (const reg of regs) {
    const l = parseLinhaStock(reg);
    if (l) linhas.push(l);
  }
  return linhas;
}
