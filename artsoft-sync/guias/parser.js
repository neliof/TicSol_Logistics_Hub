/**
 * Parser de respostas XML de guias de transporte do ARTSOFT.
 *
 * Portado de `obras_c002_parser.py` → `parse_obras_c002_response()`.
 * Mapeia XML parseado (após JSON.parse equivalente) para a estrutura esperada
 * pelo mapper: documento (cabeçalho) + linhas com artigos.
 *
 * Estrutura esperada na resposta:
 *   <root>
 *     <rec>
 *       <DocSerie /> <DocNrDoc /> ... (cabeçalho)
 *       <Lans type='list' name='lan'>
 *         <rec>
 *           <Artigo /> <Qtd /> ... (linha 1)
 *         </rec>
 *         <rec> ... (linha 2)
 *       </Lans>
 *     </rec>
 *     <rec> ... (documento 2)
 *   </root>
 *
 * Saída: [
 *   { doc_id_artsoft: "...", serie: "...", linhas: [...] },
 *   { ... }
 * ]
 */

import { comoLista, texto, textoDe } from "../artsoft/xml.js";

export class ErroParserGuia extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroParserGuia";
  }
}

/**
 * Normaliza um código CDU (pode vir com `~` separador, fica o último segmento).
 * Portado de `_normalize_cdu()` em `obras_c002_parser.py`.
 *
 * @param {string|null} valor
 * @returns {string|null}
 */
function normalizarCDU(valor) {
  if (!valor) return null;
  const str = String(valor).trim();
  if (str === "") return null;
  if (!str.includes("~")) return str;
  const partes = str.split("~").map((p) => p.trim()).filter((p) => p);
  return partes.length > 0 ? partes[partes.length - 1] : str;
}

/**
 * Parse de um documento (cabeçalho + linhas).
 *
 * @param {Record<string, unknown>} no
 * @returns {{doc_id_artsoft: string, serie: string, numero: string, data_docum: string|null, tipo_saft: string|null, linhas: Array}}
 */
function parseDocumento(no) {
  if (!no || typeof no !== "object") {
    throw new ErroParserGuia("Documento nulo ou não é objeto");
  }

  const docId = texto(no.DocID || no["Doc.ID"]);
  const serie = textoDe(no, "DocSerie", "Doc.Serie", "Serie");
  const numero = textoDe(no, "DocNrDoc", "Doc.NrDoc", "NrDoc");
  const dataDocum = textoDe(no, "DataDocum", "Doc.DataDocum", "DocFchDataDocum");
  const tpSaft = textoDe(no, "InfTpSAFT", "Inf.TpSAFT", "TpSAFT");

  // DocID é obrigatório — é a chave para DocFch/DocPrintEx
  if (!serie || !numero) {
    throw new ErroParserGuia(
      `Documento sem série/número. ` +
        `DocID=${docId}, Serie=${serie}, Numero=${numero}`
    );
  }

  // Construir ID como fallback se não vier pronto
  const idFinal =
    docId || `${(serie || "").trim()}-${(numero || "").trim()}-${dataDocum || ""}`.trim();

  // Cabeçalho base
  const doc = {
    doc_id_artsoft: idFinal,
    serie: String(serie).trim(),
    numero: String(numero).trim(),
    data_docum: dataDocum,
    tipo_saft: tpSaft,
    terceiro_numero: textoDe(no, "TerTerceiro", "Cliente", "Ter.Terceiro"),
    terceiro_filial: textoDe(no, "TerFilial", "Filial", "Ter.Filial"),
    terceiro_nome: textoDe(no, "TerNome", "Nome", "Ter.Nome"),
    terceiro_nif: textoDe(no, "TerNIF", "nif", "Ter.NIF"),
    observacoes: textoDe(no, "DocObs", "Doc.Obs"),
    pedido_origem: textoDe(no, "DocPedido", "Doc.Pedido"),
    // CDU, campos logísticos e outros extras não têm coluna própria.
    dados_extra: {
      ...extractCDU(no),
      ...extractLogistica(no),
    },
  };

  // Linhas — a subconsulta declara name='lan', logo os registos vêm em <lan>.
  const lansNode = no.Lans;
  const linhas = [];
  if (lansNode) {
    const recsLan = comoLista(lansNode.lan || lansNode.rec || lansNode.row);
    let nrLinha = 0;
    for (const lan of recsLan) {
      if (!lan || typeof lan !== "object") continue;
      nrLinha++;
      linhas.push(parseLinha(lan, nrLinha));
    }
  }

  doc.linhas = linhas;
  return doc;
}

/**
 * Parse de uma linha (DocLan + ficha de artigo via join StkFch).
 *
 * @param {Record<string, unknown>} lan
 * @param {number} nrLinha
 * @returns {object}
 */
function parseLinha(lan, nrLinha) {
  const linha = {
    nr_linha: nrLinha,
    nr_lancamento: texto(lan.DocNrLan || lan["DocLan.Doc.NrLan"]),
    artigo_codigo: textoDe(lan, "Artigo", "Cod.Codigo", "DocLan.Cod.Codigo"),
    descricao: textoDe(lan, "Nome", "StkFch.Nome.0", "DocLan.Desc"),
    quantidade: texto(lan.Qtd || lan["DocLan.Qtd.Movim"] || lan["Qtd.Movim"]),
    unidade: textoDe(lan, "Unid", "StkFch.Logis.Uni", "DocLan.Unid"),
    observacoes: textoDe(lan, "Obser", "DocLan.Div.Obs", "Observacoes"),
    artigo_nrreg: textoDe(lan, "DivNrReg", "StkFch.Div.NrReg"),
    // Por confirmar
    peso: textoDe(lan, "Peso", "StkFch.Logis.Peso"),
  };

  // Campos do utilizador (CDU) e estruturas aninhadas em dados_extra
  linha.dados_extra = {
    ...extractCDU(lan),
    custo_unitario: extractCusto(lan),
    // EAN/Código Opcional
    ean13: textoDe(lan, "EAN13", "Cod.Opcional", "StkFch.Cod.EAN"),
    // Campos de valor (se disponíveis)
    valor_unitario: texto(textoDe(lan, "ValUn", "Val.UnBru", "DocLan.Val.UnBru")),
    iva: texto(textoDe(lan, "IVATaxa", "IVA.Taxa", "DocLan.IVA.Taxa")),
    desconto: texto(textoDe(lan, "Desc", "Desc.Lin0", "DocLan.Desc.Lin0")),
    total_liquido: texto(textoDe(lan, "TotalLiq", "Val.TtLiqEx", "DocLan.Val.TtLiqEx")),
    // Agregação (se disponível)
    lote: textoDe(lan, "Lote", "StkFch.Lote", "DocLan.Lote"),
    data_validade: textoDe(lan, "DataValidade", "StkFch.Data.Val", "DocLan.Data.Val"),
  };

  return linha;
}

/**
 * Extrai os campos logísticos do cabeçalho (matrícula, moradas de carga e
 * descarga, data/hora de carga, peso, volumes).
 *
 * As tags correspondem às produzidas por `construirDefcolLinhas` a partir dos
 * `form_path` em `logistics.mapeamento_campo`. Só entram no resultado os
 * campos com valor — assim um documento sem matrícula não guarda a chave.
 *
 * @param {Record<string, unknown>} no
 * @returns {object}
 */
function extractLogistica(no) {
  const campos = {
    matricula: textoDe(no, "Matricula", "Inf.Matricula"),
    morada_carga: textoDe(no, "MoradaCarga", "LocCarga", "Doc.LocCarga"),
    morada_descarga: textoDe(no, "MoradaDescarga", "LocDesc", "Doc.LocDesc"),
    data_hora_carga: textoDe(no, "DataHoraCarga", "DataCarga", "Doc.DataCarga"),
    hora_carga: textoDe(no, "HoraCarga", "Doc.HoraCarga"),
    peso: textoDe(no, "Peso", "PesoBr", "Log.PesoBr"),
    peso_liquido: textoDe(no, "PesoLiq", "Log.PesoLiq"),
    volume: textoDe(no, "Volume", "Log.Volume"),
    volumes: textoDe(no, "Volumes", "NrVol", "Log.NrVol"),
  };

  const resultado = {};
  for (const [chave, valor] of Object.entries(campos)) {
    const v = String(valor ?? "").trim();
    if (v !== "") resultado[chave] = v;
  }
  return resultado;
}

/**
 * Extrai campos CDU do nó (pré-configurados como tags).
 * Num ambiente real, isto ficaria `logistics.mapeamento_campo` e seria extraído
 * da configuração. Para fase de testes, hardcoded basta.
 *
 * @param {Record<string, unknown>} no
 * @returns {object}
 */
function extractCDU(no) {
  if (!no) return {};
  const cdu = {};
  for (let i = 1; i <= 11; i++) {
    const idx = String(i).padStart(2, "0");
    const nm = text(no[`CDUNm_${idx}`] || no[`CDUNm${idx}`] || no[`CDU_nm_${idx}`]);
    const val = texto(
      no[`CDU_${idx}`] || no[`CDU${idx}`] || no[`CDU_${idx}`] || no[`cdu_${idx}`]
    );
    if (nm || val) {
      cdu[`cdu_${idx}`] = { nome: nm, valor: normalizarCDU(val) };
    }
  }
  return Object.keys(cdu).length > 0 ? cdu : {};
}

/**
 * Extrai custo unitário de linha (aninhado num sub-nó `Lans_C`).
 *
 * @param {Record<string, unknown>} lan
 * @returns {string|null}
 */
function extractCusto(lan) {
  if (!lan || typeof lan !== "object") return null;
  const lansC = lan.Lans_C;
  if (!lansC) return null;
  const custo = lansC.custo || lansC.rec || lansC["StkVal.Prc.UPCusto"];
  if (!custo) return null;
  // Custo pode vir como objeto ou array
  const c = Array.isArray(custo) ? custo[0] : custo;
  return textoDe(c, "Ultimo_Custo", "PrcUPCusto", "UltimoCusto") || null;
}

/**
 * Helper para texto que foi escrito de forma segura no mapa.
 */
function text(valor) {
  return texto(valor);
}

/**
 * Parser principal — transforma XML parseado em estrutura de documentos.
 *
 * @param {Record<string, unknown>} raiz  objeto parseado da raiz <root>
 * @returns {Array<{doc_id_artsoft, serie, numero, data_docum, tipo_saft, linhas: Array}>}
 * @throws {ErroParserGuia}
 */
export function parseGuiasResponse(raiz) {
  if (!raiz || typeof raiz !== "object") {
    throw new ErroParserGuia("Raiz parseada nula ou não é objeto");
  }

  const documentos = [];
  const regs = comoLista(raiz.rec || raiz.Document || raiz.row);

  if (regs.length === 0) {
    // Não é necessariamente erro — ARTSOFT pode devolver <root/> se nenhum
    // registo corresponder aos filtros.
    return [];
  }

  for (const reg of regs) {
    try {
      const doc = parseDocumento(reg);
      documentos.push(doc);
    } catch (erro) {
      // Logging para auditoria; não aborta o ciclo.
      console.error(
        `Erro a parsear documento (${erro.message}), ` +
          `continuando…`
      );
    }
  }

  return documentos;
}
