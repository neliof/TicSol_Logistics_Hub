/**
 * Ciclo de paginação com token.
 *
 * Portado de `_extract_next_token` e ciclo de paginação em
 * `artsoft_sync_service.py` (linhas 173-195). Paginação por token é a forma
 * mais robusta — não descreve posição (offset), que quebra se novos registos
 * aparecem entre pedidos. Em vez disso o ARTSOFT devolve um token opaco que
 * aponta para a próxima página conhecida quando a resposta foi gerada.
 *
 * Regra crítica (testada em produção): um token de valor `0` ou vazio quer
 * dizer "não há mais registos". É transparente no Hub Central (`str(token)
 * not in {"0", ""}`), mas aqui é explícito.
 */

import { comoLista, texto } from "./xml.js";

/**
 * Extrai o token para a próxima página a partir de uma resposta XML.
 *
 * O ARTSOFT devolve o token em vários locais possíveis — comportamento
 * defensivo que não se explica, mas funciona. Testar em ordem de
 * probabilidade:
 *
 *   1. Atributo `next` / `token` da raiz <root>
 *   2. Atributo `next` / `token` do primeiro <rec> / <Document> / <row>
 *   3. Elemento texto <token> / <next> / <next_token> / <NextToken>
 *   4. Regex no XML bruto (fallback para payloads mal formados)
 *
 * @param {Record<string, unknown>} raiz    objeto parseado da raiz <root>
 * @param {string} xmlBruto                 XML original, para fallback
 * @returns {string|null}  token ou null = não há mais páginas
 */
export function extrairTokenProximaPagina(raiz, xmlBruto) {
  if (!raiz || typeof raiz !== "object") return null;

  // 1. Atributos da raiz
  for (const chave of ["@next", "@token"]) {
    const token = texto(raiz[chave]);
    if (token && token !== "0") return token;
  }

  // 2. Primeiro <rec> / <Document> / <row>
  let primeiroRec = null;
  for (const chave of ["rec", "Document", "row"]) {
    const regs = raiz[chave];
    if (regs) {
      primeiroRec = Array.isArray(regs) ? regs[0] : regs;
      break;
    }
  }
  if (primeiroRec && typeof primeiroRec === "object") {
    for (const chave of ["@next", "@token"]) {
      const token = texto(primeiroRec[chave]);
      if (token && token !== "0") return token;
    }
  }

  // 3. Elementos de texto
  for (const chave of ["token", "next", "next_token", "NextToken"]) {
    const token = texto(raiz[chave]);
    if (token && token !== "0") return token;
  }

  // 4. Fallback: regex no XML bruto para payloads mal formados
  const regex = /(?:\s|<)(?:next|token)\s*=\s*['"]([^'"]+)['"]/i;
  const match = xmlBruto?.match(regex);
  if (match && match[1]) {
    const token = match[1].trim();
    if (token && token !== "0") return token;
  }

  return null;
}

/**
 * Ciclo de paginação com token — orquestra um pedido por página até não haver
 * mais.
 *
 * @param {object} config
 * @param {object} config.pedidoInicial   {filtro, pageSize, nome, corpoDefcol}
 * @param {(xml: string) => Record<string, unknown>} config.parseador
 * @param {(raiz: Record<string, unknown>) => unknown[]} config.extrairRegistos
 * @param {(filtro: string, token: string) => string} config.acrescentarToken
 * @param {(filtro: string, pageSize: number, nome: string, corpo: string) => string} config.construir
 * @param {(xml: string, token?: string) => Promise<string>} config.executarPedido
 * @param {object} config.limites
 * @param {number} config.limites.maxPaginas
 * @param {(msg: string) => void} [config.logger]
 * @returns {Promise<{registos: Array, paginas: number, ultimoToken: string|null, estado: 'completo'|'incompleto'}>}
 */
export async function cicloComToken({
  pedidoInicial,
  parseador,
  extrairRegistos,
  acrescentarToken,
  construir,
  executarPedido,
  limites,
  logger = () => {},
}) {
  let token = "";
  let pagina = 0;
  const maxPaginas = limites?.maxPaginas || 300;
  const registosTodos = [];
  const idsVisto = new Set();

  while (true) {
    pagina++;
    if (pagina > maxPaginas) {
      logger(`Atingido limite de páginas (${maxPaginas}). Sincronização incompleta.`);
      return {
        registos: registosTodos,
        paginas: pagina - 1,
        ultimoToken: token,
        estado: "incompleto",
      };
    }

    // Construir pedido desta página
    const filtro = token ? acrescentarToken(pedidoInicial.filtro, token) : pedidoInicial.filtro;
    const xml = construir({
      filtro,
      pageSize: pedidoInicial.pageSize,
      nome: pedidoInicial.nome,
      corpoDefcol: pedidoInicial.corpoDefcol,
    });

    // Executar
    let xmlResposta;
    try {
      xmlResposta = await executarPedido(xml, token);
    } catch (erro) {
      logger(`Erro no pedido de página ${pagina}: ${erro.message}`);
      return {
        registos: registosTodos,
        paginas: pagina - 1,
        ultimoToken: token,
        estado: "erro",
      };
    }

    // Parsear e extrair
    let raizResposta;
    try {
      raizResposta = parseador(xmlResposta);
    } catch (erro) {
      logger(`XML mal formado na página ${pagina}: ${erro.message}`);
      return {
        registos: registosTodos,
        paginas: pagina - 1,
        ultimoToken: token,
        estado: "erro_xml",
      };
    }

    const registosPagina = extrairRegistos(raizResposta);
    const novoToken = extrairTokenProximaPagina(raizResposta, xmlResposta);

    // Desduplicação em memória — prevenção de loops infinitos com token repetido
    let novosAdicionados = 0;
    for (const reg of registosPagina) {
      const idReg = extrairId(reg);
      if (idReg && idsVisto.has(idReg)) continue;
      if (idReg) idsVisto.add(idReg);
      registosTodos.push(reg);
      novosAdicionados++;
    }

    logger(
      `Página ${pagina}: ${registosPagina.length} registos, ` +
        `${novosAdicionados} novos, ` +
        `token: ${token ? "presente" : "inexistente"} → ${novoToken ? "presente" : "fim"}`
    );

    // Critérios de paragem
    if (
      !registosPagina ||
      registosPagina.length === 0 ||
      !novoToken ||
      novoToken === token
    ) {
      logger(`Fim da paginação na página ${pagina}`);
      return {
        registos: registosTodos,
        paginas: pagina,
        ultimoToken: novoToken,
        estado: "completo",
      };
    }

    token = novoToken;
  }
}

/**
 * Tira um ID único de um registo para desduplicação.
 *
 * Esta é uma função "hook" que muda conforme o tipo de documento.
 * Para guias, é %DocFch.Doc.ID (SERIE/NR).
 *
 * @param {Record<string, unknown>} registo
 * @returns {string|null}
 */
export function extrairId(registo) {
  if (!registo || typeof registo !== "object") return null;
  // Caminhos testados em resposta do ARTSOFT:
  // - raiz: DocID (nível de topo)
  // - dentro de <rec> aninhado: Doc.ID, DocID
  const id = texto(registo.DocID || registo["Doc.ID"] || registo.ID);
  return id || null;
}
