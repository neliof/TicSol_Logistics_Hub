/**
 * Séries de documento ARTSOFT configuradas por empresa.
 *
 * As séries de guia variam de base de dados para base de dados — `V960;V980`
 * numa instalação, outra coisa noutra. Por isso vivem em
 * `logistics.configuracao` (chave `guias.series`) e nunca em código.
 *
 * O formato de lista separada por `;` é o mesmo que o TICSOL_HUB_Central já
 * usa em `config.configuracao` (`documentos.documentos_a`), parseado por
 * `_parse_documentos_associados_tipos` em `artsoft_client.py`. Manter o mesmo
 * formato significa que quem configura uma instalação não tem de aprender
 * duas convenções.
 */

/** Tipos SAF-T que correspondem a movimento de mercadorias. */
export const TPSAFT_MOVIMENTO_MERCADORIAS = ["GR", "GT", "GA", "GC", "GD"];

/**
 * Parte uma lista separada por `;` em elementos normalizados.
 *
 * Regras portadas de `_parse_documentos_associados_tipos`:
 *   - separar por `;`
 *   - `trim` a cada parte
 *   - maiúsculas
 *   - descartar vazios
 *   - descartar duplicados PRESERVANDO A ORDEM (a ordem de configuração é a
 *     ordem de importação, e é observável por quem lê os logs)
 *
 * @param {string|null|undefined} valor
 * @returns {string[]}
 */
export function parseListaConfig(valor) {
  const bruto = String(valor ?? "").trim();
  if (bruto === "") return [];

  const vistos = new Set();
  const resultado = [];
  for (const parte of bruto.split(";")) {
    const item = parte.trim().toUpperCase();
    if (item === "" || vistos.has(item)) continue;
    vistos.add(item);
    resultado.push(item);
  }
  return resultado;
}

/**
 * Séries de guia a importar.
 *
 * Lista vazia é um erro de configuração, não um caso normal — sem séries não
 * há nada a importar, e falhar em silêncio aqui produz uma sincronização que
 * "corre bem" e não traz nada. Quem chama decide o que fazer com a lista
 * vazia, mas fica com a informação explícita.
 *
 * @param {Record<string,string>} config  mapa chave -> valor de logistics.configuracao
 * @returns {{series: string[], valida: boolean, erro: string|null}}
 */
export function resolverSeriesGuias(config) {
  const series = parseListaConfig(config?.["guias.series"]);
  if (series.length === 0) {
    return {
      series: [],
      valida: false,
      erro:
        "guias.series não está configurada. Descobrir as séries disponíveis " +
        "com DocFch/CfgDocum e preencher em logistics.configuracao (ex.: V960;V980).",
    };
  }
  return { series, valida: true, erro: null };
}

/**
 * Tipos SAF-T aceites, com o conjunto standard como retaguarda.
 *
 * @param {Record<string,string>} config
 * @returns {string[]}
 */
export function resolverTpSaftValidos(config) {
  const configurados = parseListaConfig(config?.["guias.tpsaft_validos"]);
  return configurados.length > 0 ? configurados : [...TPSAFT_MOVIMENTO_MERCADORIAS];
}

/**
 * Confirma que um documento devolvido é mesmo movimento de mercadorias.
 *
 * Rede de segurança contra série mal configurada: se alguém puser `V210`
 * (faturas) em `guias.series`, o pedido corre, o ARTSOFT devolve faturas, e
 * sem esta verificação elas entravam no WMS como guias. Verificar o TpSAFT da
 * resposta apanha isso — e é barato.
 *
 * Um documento sem TpSAFT é aceite: nem todas as instalações preenchem o
 * campo, e recusar por omissão bloquearia importações legítimas. O caso fica
 * marcado para quem inspecionar.
 *
 * @param {string|null} tpsaft
 * @param {string[]} validos
 * @returns {{aceite: boolean, motivo: string|null}}
 */
export function validarTpSaft(tpsaft, validos) {
  const valor = String(tpsaft ?? "").trim().toUpperCase();
  if (valor === "") {
    return { aceite: true, motivo: "sem_tpsaft" };
  }
  if (validos.includes(valor)) {
    return { aceite: true, motivo: null };
  }
  return {
    aceite: false,
    motivo: `tpsaft_invalido:${valor}`,
  };
}

/**
 * Normaliza uma data para os 8 dígitos que o filtro de query usa.
 *
 * ATENÇÃO — ambiguidade real, não resolvida:
 * `_normalize_artsoft_date` no Hub Central limita-se a remover os não-dígitos
 * e a ficar com os primeiros 8. Isso aceita `18/11/2024` (-> "18112024") e
 * `2024-11-18` (-> "20241118") sem distinguir, o que significa que o formato
 * verdadeiramente esperado pelo WebServer nunca ficou registado em lado nenhum.
 *
 * Aqui o formato é EXPLÍCITO e configurável (`guias.formato_data`), para que
 * seja confirmado em testes reais em vez de continuar escondido.
 *
 * Aceita à entrada: `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY`, `Date`.
 *
 * @param {string|Date|null|undefined} valor
 * @param {'ddmmaaaa'|'aaaammdd'} formato
 * @returns {string} 8 dígitos, ou "" se não for possível determinar
 */
export function normalizarDataArtsoft(valor, formato = "ddmmaaaa") {
  if (valor == null || valor === "") return "";

  let ano;
  let mes;
  let dia;

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return "";
    ano = valor.getFullYear();
    mes = valor.getMonth() + 1;
    dia = valor.getDate();
  } else {
    const bruto = String(valor).trim();
    const iso = bruto.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    const pt = bruto.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (iso) {
      [, ano, mes, dia] = iso.map(Number);
    } else if (pt) {
      [, dia, mes, ano] = pt.map(Number);
    } else {
      return "";
    }
  }

  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return "";

  const dd = String(dia).padStart(2, "0");
  const mm = String(mes).padStart(2, "0");
  const aaaa = String(ano).padStart(4, "0");

  return formato === "aaaammdd" ? `${aaaa}${mm}${dd}` : `${dd}${mm}${aaaa}`;
}

/**
 * Lê um inteiro de configuração, com limites e valor por omissão.
 *
 * @param {Record<string,string>} config
 * @param {string} chave
 * @param {number} omissao
 * @param {{min?: number, max?: number}} limites
 * @returns {number}
 */
export function inteiroConfig(config, chave, omissao, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const bruto = String(config?.[chave] ?? "").trim();
  const n = Number.parseInt(bruto, 10);
  if (!Number.isFinite(n)) return omissao;
  return Math.min(Math.max(n, min), max);
}
