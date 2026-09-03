/**
 * Parsing seguro de XML vindo do ARTSOFT.
 *
 * Equivalente funcional ao `defusedxml` que o TICSOL_HUB_Central usa em
 * `app/core/artsoft_connection.py`. O parser de base (fast-xml-parser) não vai
 * buscar recursos externos, mas processa entidades declaradas num DOCTYPE
 * interno — o que abre a porta a XML bombs (billion laughs). Por isso o
 * DOCTYPE é rejeitado à entrada, antes de qualquer parsing.
 *
 * Duas regras que não são negociáveis aqui:
 *
 *   1. NADA é convertido para número. Um código de artigo "0012" tem de
 *      continuar "0012", e não 12. Quantidades e valores são convertidos
 *      deliberadamente mais à frente, por quem sabe o que está a converter.
 *
 *   2. NADA é convertido para booleano. O ARTSOFT devolve "S"/"N", e o
 *      parser não deve adivinhar o significado.
 */

import { XMLParser } from "fast-xml-parser";

/** Limite defensivo — uma resposta legítima do ARTSOFT nunca se aproxima disto. */
export const TAMANHO_MAXIMO_XML = 64 * 1024 * 1024; // 64 MB

export class ErroXmlArtsoft extends Error {
  constructor(mensagem, causa) {
    super(mensagem);
    this.name = "ErroXmlArtsoft";
    if (causa) this.cause = causa;
  }
}

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@",
  textNodeName: "#text",
  parseTagValue: false,      // tudo string — ver regra 1
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,     // apenas as 5 predefinidas; DOCTYPE já foi barrado
  ignoreDeclaration: true,
  ignorePiTags: true,
});

/**
 * Rejeita construções perigosas antes de parsear.
 * @param {string} xml
 */
function validarEntrada(xml) {
  if (typeof xml !== "string") {
    throw new ErroXmlArtsoft(`XML tem de ser string, recebido ${typeof xml}`);
  }
  if (xml.length > TAMANHO_MAXIMO_XML) {
    throw new ErroXmlArtsoft(
      `XML excede o tamanho máximo (${xml.length} > ${TAMANHO_MAXIMO_XML} bytes)`
    );
  }
  // Sem regex sobre o documento todo: só o prólogo pode conter DOCTYPE.
  const prologo = xml.slice(0, 4096);
  if (/<!DOCTYPE/i.test(prologo) || /<!ENTITY/i.test(prologo)) {
    throw new ErroXmlArtsoft(
      "XML contém DOCTYPE ou ENTITY — rejeitado por segurança (XXE / XML bomb)"
    );
  }
}

/**
 * Converte XML do ARTSOFT num objeto.
 *
 * @param {string} xml
 * @returns {Record<string, unknown>}
 * @throws {ErroXmlArtsoft} entrada inválida, insegura ou mal formada
 */
export function parseXml(xml) {
  validarEntrada(xml);
  try {
    return PARSER.parse(xml);
  } catch (erro) {
    throw new ErroXmlArtsoft(`XML mal formado: ${erro.message}`, erro);
  }
}

/**
 * Normaliza um nó que pode vir como objeto único ou como lista.
 *
 * O ARTSOFT devolve `<rec>` uma vez quando há um registo e várias vezes quando
 * há vários — o parser reflete isso, dando objeto num caso e array no outro.
 * Tratar os dois casos em cada sítio que consome a resposta é a receita para o
 * bug clássico "funciona com 2 guias, rebenta com 1".
 *
 * @param {unknown} valor
 * @returns {unknown[]}
 */
export function comoLista(valor) {
  if (valor == null) return [];
  return Array.isArray(valor) ? valor : [valor];
}

/**
 * Lê o texto de um nó, seja ele string simples ou objeto com `#text`.
 * Devolve `null` para vazio — distinguir "campo ausente" de "campo vazio" não
 * traz nada aqui e complica todos os chamadores.
 *
 * @param {unknown} no
 * @returns {string|null}
 */
export function texto(no) {
  if (no == null) return null;
  if (typeof no === "string") {
    const t = no.trim();
    return t === "" ? null : t;
  }
  if (typeof no === "object" && "#text" in no) {
    const t = String(no["#text"] ?? "").trim();
    return t === "" ? null : t;
  }
  if (typeof no === "number" || typeof no === "boolean") return String(no);
  return null;
}

/**
 * Primeiro valor não vazio entre vários nomes de tag alternativos.
 *
 * Portado de `_txt()` em `obras_c002_parser.py`. Existe porque o ARTSOFT
 * devolve o mesmo campo com nomes diferentes consoante a query — `DocNrDoc`
 * ou `Doc.NrDoc`, conforme o `defcol` usado.
 *
 * @param {Record<string, unknown>} no
 * @param {...string} tags
 * @returns {string|null}
 */
export function textoDe(no, ...tags) {
  if (no == null || typeof no !== "object") return null;
  for (const tag of tags) {
    const valor = texto(no[tag]);
    if (valor !== null) return valor;
  }
  return null;
}

/**
 * Escapa um valor para inclusão segura em XML.
 *
 * Portado de `_escape_xml` (`importado/service.py`). Sem isto, um valor de
 * filtro com `&` ou `<` produz XML inválido — e um valor malicioso produz
 * XML *válido mas diferente do pretendido*, que é pior.
 *
 * @param {unknown} valor
 * @returns {string}
 */
export function escaparXml(valor) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
