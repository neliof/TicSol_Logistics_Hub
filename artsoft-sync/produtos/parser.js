/**
 * Parser de respostas XML de fichas de artigo (StkFch) do ARTSOFT.
 *
 * A resposta é uma lista simples de <rec>, sem subconsultas:
 *   <root next='...'>
 *     <rec>
 *       <Codigo/> <Descricao/> <Ean/> <PesoLiq/> ... (um artigo)
 *     </rec>
 *     <rec> ... (outro artigo)
 *   </root>
 *
 * As tags são as convencionadas pelo defcol (ver seed de mapeamento_campo,
 * contexto 'produto'). O parser não converte tipos — pesos ficam string e as
 * flags ficam "0"/"1"/"S"/"N"; a conversão é deliberada, no mapper.
 *
 * Saída: [{ codigo, descricao, ean, peso_liquido, peso_bruto,
 *           unidades_por_caixa, unidade, controla_lote, controla_validade,
 *           dados_extra }]
 */

import { comoLista, texto, textoDe } from "../artsoft/xml.js";

export class ErroParserProduto extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroParserProduto";
  }
}

/**
 * Parse de um registo de artigo.
 *
 * @param {Record<string, unknown>} no
 * @returns {object|null}  produto, ou null se sem código (registo inútil)
 */
function parseProduto(no) {
  if (!no || typeof no !== "object") return null;

  const codigo = textoDe(no, "Codigo", "Cod.Codigo");
  if (!codigo) return null; // sku_interno é a chave natural; sem ele não serve

  return {
    codigo: String(codigo).trim(),
    descricao: textoDe(no, "Descricao", "Nome", "Nome.0"),
    ean: textoDe(no, "Ean", "CodOpc", "Cod.Opcional"),
    peso_liquido: textoDe(no, "PesoLiq", "Logis.PLiqUni"),
    peso_bruto: textoDe(no, "PesoBruto", "Logis.PBrUnit"),
    unidades_por_caixa: textoDe(no, "QtdEmb", "Logis.QtdEmb"),
    unidade: textoDe(no, "Unidade", "Logis.Uni"),
    controla_lote: textoDe(no, "CtrlLote", "Flag.CtrlLt"),
    controla_validade: textoDe(no, "CtrlValid", "Flag.DtValid"),
    dias_validade: textoDe(no, "DiasValid", "Div.DiasValid"),
    dados_extra: {},
  };
}

/**
 * Parser principal — transforma XML parseado em lista de produtos.
 *
 * @param {Record<string, unknown>} raiz  objeto parseado da raiz <root>
 * @returns {Array<object>}
 * @throws {ErroParserProduto}
 */
export function parseProdutosResponse(raiz) {
  if (!raiz || typeof raiz !== "object") {
    throw new ErroParserProduto("Raiz parseada nula ou não é objeto");
  }

  const regs = comoLista(raiz.rec || raiz.Document || raiz.row);
  if (regs.length === 0) return [];

  const produtos = [];
  for (const reg of regs) {
    const produto = parseProduto(reg);
    if (produto) produtos.push(produto);
  }
  return produtos;
}
