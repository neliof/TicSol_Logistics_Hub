/**
 * Parser de respostas XML de fichas de terceiro (TerFch) do ARTSOFT.
 *
 * Serve clientes e fornecedores — a estrutura da resposta é a mesma, muda só o
 * filtro (Cliente|NrCli vs Forneced|NrFor) e a tag do número. Lista simples de
 * <rec>, sem subconsultas. Sem conversão de tipos.
 *
 * Saída: [{ numero, nome, nif, morada, localidade, cod_postal, dados_extra }]
 */

import { comoLista, texto, textoDe } from "../artsoft/xml.js";

export class ErroParserTerceiro extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroParserTerceiro";
  }
}

/**
 * Parse de um registo de terceiro.
 *
 * @param {Record<string, unknown>} no
 * @returns {object|null}  terceiro, ou null se sem número (chave natural)
 */
function parseTerceiro(no) {
  if (!no || typeof no !== "object") return null;

  // O número vem em CliNum (clientes) ou ForNum (fornecedores) conforme a query.
  const numero = textoDe(no, "Numero", "CliNum", "ForNum");
  if (!numero || numero === "0") return null;

  return {
    numero: String(numero).trim(),
    nome: textoDe(no, "Nome", "Ter.Nome"),
    nif: textoDe(no, "Nif", "NIF", "Ter.NIF"),
    morada: textoDe(no, "Morada", "Ter.Morada"),
    localidade: textoDe(no, "Localid", "Ter.Localid"),
    cod_postal: textoDe(no, "CPPais", "Ter.CPPais"),
    dados_extra: {},
  };
}

/**
 * Parser principal — transforma XML parseado em lista de terceiros.
 *
 * @param {Record<string, unknown>} raiz  objeto parseado da raiz <root>
 * @returns {Array<object>}
 * @throws {ErroParserTerceiro}
 */
export function parseTerceirosResponse(raiz) {
  if (!raiz || typeof raiz !== "object") {
    throw new ErroParserTerceiro("Raiz parseada nula ou não é objeto");
  }

  const regs = comoLista(raiz.rec || raiz.Document || raiz.row);
  if (regs.length === 0) return [];

  const terceiros = [];
  for (const reg of regs) {
    const t = parseTerceiro(reg);
    if (t) terceiros.push(t);
  }
  return terceiros;
}
