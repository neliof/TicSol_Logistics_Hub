/**
 * Construção de pedidos XML para o endpoint `Queries/Query` do ARTSOFT.
 *
 * Estrutura do pedido (verificada em produção no TICSOL_HUB_Central,
 * `obras_c002_sync_service.py`):
 *
 *   <?xml version='1.0' encoding='UTF-8'?>
 *   <root type='list' end='50' name='Document' query='FILTRO'>
 *       <defcol>
 *           <Tag form='%Tabela.Grupo.Campo'/>
 *           <Sub type='list' name='lan' query='FILTRO_SUB'>
 *               <defcol> ... </defcol>
 *           </Sub>
 *       </defcol>
 *   </root>
 *
 * Linguagem de filtro:
 *   Tabela|Filtro|Campo=min:max      seleção
 *   ^Tabela|Filtro|Campo={%Ref}      join, correlacionado com o nível acima
 *   |#{token}                        página seguinte
 *
 * Nota sobre os atributos `query`: no Hub Central o filtro é interpolado tal
 * e qual, sem escape. Um valor com aspa simples partiria o atributo. Aqui o
 * filtro é escapado — e os `{%...}` de correlação continuam a funcionar porque
 * não contêm caracteres que precisem de escape.
 */

import { escaparXml } from "./xml.js";

/** Só estes caracteres fazem sentido num caminho `%Tabela.Grupo.Campo`. */
const PADRAO_FORM_PATH = /^[%$A-Za-z0-9_.*/+\-()\s{}%]+$/;

/** Nome de elemento XML válido, sem namespaces (o ARTSOFT não os usa). */
const PADRAO_TAG = /^[A-Za-z_][A-Za-z0-9_.\-]*$/;

export class ErroConstrucaoQuery extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroConstrucaoQuery";
  }
}

/**
 * Valida um mapeamento antes de o deixar entrar no `defcol`.
 *
 * Falhar cedo aqui é deliberado: um `form_path` vazio ou uma tag inválida
 * produzem XML que o ARTSOFT rejeita com uma mensagem que não diz qual o
 * campo culpado. Mais vale a exceção apontar o campo pelo nome.
 *
 * @param {{campo: string, tag_xml: string, form_path: string}} m
 */
function validarMapeamento(m) {
  if (!m || typeof m !== "object") {
    throw new ErroConstrucaoQuery("Mapeamento inválido: esperado objeto");
  }
  const tag = String(m.tag_xml ?? "").trim();
  const form = String(m.form_path ?? "").trim();
  const campo = String(m.campo ?? "(sem nome)");

  if (!PADRAO_TAG.test(tag)) {
    throw new ErroConstrucaoQuery(
      `Campo '${campo}': tag_xml inválida '${m.tag_xml}' (esperado nome de elemento XML)`
    );
  }
  if (form === "") {
    throw new ErroConstrucaoQuery(
      `Campo '${campo}': form_path vazio. Um campo sem caminho ARTSOFT não pode entrar no defcol — ` +
        "confirmar o caminho e ativar, ou manter inativo."
    );
  }
  if (!PADRAO_FORM_PATH.test(form)) {
    throw new ErroConstrucaoQuery(
      `Campo '${campo}': form_path com caracteres inesperados '${form}'`
    );
  }
}

/**
 * Gera as linhas de `<defcol>` a partir de mapeamentos.
 *
 * Só entram os ativos. A ordenação é por `ordem` e, em empate, por `campo` —
 * determinismo importa: sem ele, dois pedidos equivalentes geram XML diferente
 * e a comparação em testes deixa de significar alguma coisa.
 *
 * @param {Array<{campo: string, tag_xml: string, form_path: string, ativo?: boolean, ordem?: number}>} mapeamentos
 * @param {{indentacao?: string}} opcoes
 * @returns {string}
 */
export function construirDefcolLinhas(mapeamentos, { indentacao = "        " } = {}) {
  const ativos = (mapeamentos ?? []).filter((m) => m?.ativo !== false);

  const ordenados = [...ativos].sort((a, b) => {
    const oa = a.ordem ?? Number.MAX_SAFE_INTEGER;
    const ob = b.ordem ?? Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return String(a.campo ?? "").localeCompare(String(b.campo ?? ""));
  });

  const tagsVistas = new Set();
  const linhas = [];
  for (const m of ordenados) {
    validarMapeamento(m);
    const tag = String(m.tag_xml).trim();
    if (tagsVistas.has(tag)) {
      throw new ErroConstrucaoQuery(
        `tag_xml duplicada no defcol: '${tag}'. Duas tags iguais colapsam na resposta e perde-se um dos campos.`
      );
    }
    tagsVistas.add(tag);
    linhas.push(`${indentacao}<${tag} form='${escaparXml(String(m.form_path).trim())}'/>`);
  }
  return linhas.join("\n");
}

/**
 * Bloco de subconsulta aninhada (ex.: `<Lans>` com os lançamentos do documento).
 *
 * @param {object} opcoes
 * @param {string} opcoes.tag        nome do elemento (ex.: 'Lans')
 * @param {string} opcoes.nome       atributo `name` (ex.: 'lan')
 * @param {string} opcoes.filtro     filtro da subconsulta
 * @param {Array} opcoes.mapeamentos
 * @param {string} [opcoes.indentacao]
 * @returns {string}
 */
export function construirSubconsulta({ tag, nome, filtro, mapeamentos, indentacao = "        " }) {
  if (!PADRAO_TAG.test(String(tag ?? ""))) {
    throw new ErroConstrucaoQuery(`Subconsulta: tag inválida '${tag}'`);
  }
  const interior = indentacao + "    ";
  const linhas = construirDefcolLinhas(mapeamentos, { indentacao: interior + "    " });
  return [
    `${indentacao}<${tag} type='list' name='${escaparXml(nome)}' query='${escaparXml(filtro)}'>`,
    `${interior}<defcol>`,
    linhas,
    `${interior}</defcol>`,
    `${indentacao}</${tag}>`,
  ].join("\n");
}

/**
 * Envelope completo do pedido.
 *
 * @param {object} opcoes
 * @param {string} opcoes.filtro        filtro do nível de topo
 * @param {number} opcoes.pageSize      atributo `end`
 * @param {string} [opcoes.nome]        atributo `name` (ex.: 'Document', 'rec')
 * @param {string} opcoes.corpoDefcol   linhas já geradas (campos + subconsultas)
 * @returns {string}
 */
export function construirPedidoXml({ filtro, pageSize, nome = "Document", corpoDefcol }) {
  const tamanho = Number.parseInt(String(pageSize), 10);
  if (!Number.isFinite(tamanho) || tamanho < 1) {
    throw new ErroConstrucaoQuery(`pageSize inválido: ${pageSize}`);
  }
  if (!String(filtro ?? "").trim()) {
    throw new ErroConstrucaoQuery("filtro vazio: o pedido devolveria a tabela inteira");
  }
  return [
    "<?xml version='1.0' encoding='UTF-8'?>",
    `<root type='list' end='${tamanho}' name='${escaparXml(nome)}' query='${escaparXml(filtro)}'>`,
    "    <defcol>",
    corpoDefcol,
    "    </defcol>",
    "</root>",
  ].join("\n");
}

/**
 * Acrescenta o token de paginação a um filtro.
 *
 * Formato observado no Hub Central: ` |#{token} ` — com os espaços, que fazem
 * parte do que o WebServer aceita. Não os limpar.
 *
 * @param {string} filtro
 * @param {string|null|undefined} token
 * @returns {string}
 */
export function comToken(filtro, token) {
  const t = String(token ?? "").trim();
  return t === "" ? filtro : `${filtro} |#${t} `;
}
