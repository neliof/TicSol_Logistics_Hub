/**
 * Orquestrador de sincronização de stock agregado (StkAgr) do ARTSOFT para
 * logistics.artsoft_stock_snapshot.
 *
 * Fluxo: paginação StkAgr -> agregar saldo por produto -> gravar snapshot.
 * Espelha o padrão dos restantes syncs. O stock aterra em staging para
 * reconciliação (vw_reconciliacao_stock), nunca sobrepondo o stock físico.
 */

import crypto from "crypto";
import { construirDefcolLinhas, construirPedidoXml, comToken } from "../artsoft/queryBuilder.js";
import { parseXml } from "../artsoft/xml.js";
import { cicloComToken } from "../artsoft/pagination.js";
import { inteiroConfig } from "../config/series.js";
import { parseStockResponse } from "./parser.js";
import { agregarSaldos, gravarSnapshot } from "./mapper.js";
import { registrarExecucao } from "../guias/mapper.js";
import { executarPedidoArtsoft } from "../artsoft/connection.js";

export class ErroSincronizacaoStock extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroSincronizacaoStock";
  }
}

const MAPEAMENTOS_PADRAO = [
  { campo: "codigo", tag_xml: "Codigo", form_path: "%StkAgr.Codigo", ordem: 1 },
  { campo: "armazem", tag_xml: "NrArm", form_path: "%StkAgr.NrArm", ordem: 2 },
  { campo: "data_validade", tag_xml: "DtValid", form_path: "%StkAgr.DtValid", ordem: 3 },
  { campo: "qtd_entrada", tag_xml: "QtdEntr", form_path: "%StkAgr.QtdEntr", ordem: 4 },
  { campo: "qtd_saida", tag_xml: "QtdSaid", form_path: "%StkAgr.QtdSaid", ordem: 5 },
  { campo: "qtd_cativa", tag_xml: "QtdCativa", form_path: "%StkAgr.QtdCativa", ordem: 6 },
  { campo: "localizacao", tag_xml: "LocArm", form_path: "%StkAgr.LocArm", ordem: 7 },
  { campo: "suporte", tag_xml: "Suporte", form_path: "%StkAgr.Suporte", ordem: 8 },
  { campo: "palete", tag_xml: "Palete", form_path: "%StkAgr.Div.Palete", ordem: 9 },
];

async function carregarConfiguracao(client, empresaId) {
  const res = await client.query(
    `SELECT chave, valor FROM logistics.configuracao WHERE empresa_id = $1`,
    [empresaId]
  );
  const config = {};
  for (const row of res.rows) config[row.chave] = row.valor;

  const host = config["artsoft.host"];
  const porta = config["artsoft.porta"];
  const utilizador = config["artsoft.utilizador"];
  if (!host || !porta || !utilizador) {
    throw new ErroSincronizacaoStock(
      "Config incompleta: artsoft.host/porta/utilizador em logistics.configuracao"
    );
  }

  return {
    host,
    porta: Number.parseInt(String(porta), 10),
    utilizador,
    senha: process.env.ARTSOFT_SENHA || config["artsoft.senha"] || "",
    timeout: inteiroConfig(config, "artsoft.timeout", 30000, { min: 5000, max: 120000 }),
    pageSize: inteiroConfig(config, "stock.page_size", 200, { min: 10, max: 1000 }),
    maxPaginas: inteiroConfig(config, "stock.max_pages", 2000, { min: 1, max: 20000 }),
    codigoMin: config["stock.codigo_min"] || "101",
    codigoMax: config["stock.codigo_max"] || "ZZZ",
    dataValMin: config["stock.dataval_min"] || "20200101",
    dataValMax: config["stock.dataval_max"] || "20991231",
  };
}

async function carregarMapeamentos(client, empresaId) {
  const res = await client.query(
    `
    SELECT campo, tag_xml, form_path, ativo, ordem
    FROM logistics.mapeamento_campo
    WHERE empresa_id = $1 AND contexto = 'stock' AND ativo = true
    ORDER BY ordem ASC, campo ASC
    `,
    [empresaId]
  );
  return res.rows.length > 0 ? res.rows : MAPEAMENTOS_PADRAO;
}

/**
 * Sincroniza o stock agregado.
 *
 * @param {object} client
 * @param {string} empresaId  UUID
 * @param {object} [opcoes]
 * @param {(msg: string) => void} [opcoes.logger]
 * @returns {Promise<{gravados, nao_resolvidos, linhas_lidas, produtos, ultima_execucao}>}
 */
export async function sincronizarStock(client, empresaId, { logger = () => {} } = {}) {
  const correlationId = crypto.randomUUID();
  let estadoFinal = "ok";
  let xmlPedido = "";
  let paginas = 0;
  let resultado = { gravados: 0, nao_resolvidos: 0 };
  let linhasLidas = 0;
  let numProdutos = 0;

  try {
    logger(`[${correlationId}] Carregando config…`);
    const cfg = await carregarConfiguracao(client, empresaId);
    const mapeamentos = await carregarMapeamentos(client, empresaId);

    const corpoDefcol = construirDefcolLinhas(mapeamentos, { indentacao: "        " });
    const filtro =
      `StkAgr|ProdDtaV|Codigo=${cfg.codigoMin}:${cfg.codigoMax}` +
      `|NrArm=1:9999|DataVal=${cfg.dataValMin}:${cfg.dataValMax}`;

    xmlPedido = construirPedidoXml({ filtro, pageSize: cfg.pageSize, nome: "rec", corpoDefcol });

    logger(`[${correlationId}] Paginação de stock (pageSize=${cfg.pageSize})…`);
    const ciclo = await cicloComToken({
      pedidoInicial: { filtro, pageSize: cfg.pageSize, nome: "rec", corpoDefcol },
      parseador: (xml) => {
        const doc = parseXml(xml);
        return doc.root ?? doc;
      },
      extrairRegistos: parseStockResponse,
      acrescentarToken: comToken,
      construir: construirPedidoXml,
      executarPedido: (xml) =>
        executarPedidoArtsoft({
          host: cfg.host,
          porta: cfg.porta,
          utilizador: cfg.utilizador,
          senha: cfg.senha,
          xml,
          timeout: cfg.timeout,
        }),
      limites: { maxPaginas: cfg.maxPaginas },
      logger,
    });

    paginas = ciclo.paginas;
    linhasLidas = ciclo.registos.length;
    if (ciclo.estado === "erro" || ciclo.estado === "erro_xml") {
      estadoFinal = ciclo.estado === "erro_xml" ? "erro_xml" : "erro_comunicacao";
    } else if (ciclo.estado === "incompleto") {
      estadoFinal = "incompleto";
    }

    const saldos = agregarSaldos(ciclo.registos);
    numProdutos = saldos.size;
    logger(`[${correlationId}] ${linhasLidas} linhas -> ${numProdutos} produtos; a gravar snapshot…`);
    resultado = await gravarSnapshot(client, empresaId, saldos, { origem: "rest" });

    if (resultado.nao_resolvidos > 0) {
      logger(
        `[${correlationId}] ${resultado.nao_resolvidos} código(s) sem produto ` +
          `correspondente (sincronizar StkFch primeiro).`
      );
    }
    logger(`[${correlationId}] Snapshot gravado: ${resultado.gravados} produtos.`);
  } catch (erro) {
    logger(`[${correlationId}] ERRO: ${erro.message}`);
    if (erro.name === "ErroAutenticacaoArtsoft") estadoFinal = "erro_autenticacao";
    else if (erro.name === "ErroConexaoArtsoft") estadoFinal = "erro_comunicacao";
    else if (erro.name === "ErroXmlArtsoft") estadoFinal = "erro_xml";
    else estadoFinal = "erro_funcional";

    await registrarExecucao(client, empresaId, {
      request_xml: xmlPedido,
      response_xml: "",
      estado: estadoFinal,
      correlation_id: correlationId,
      num_paginas: paginas,
      tipo: "stock",
    }).catch(() => {});

    throw new ErroSincronizacaoStock(erro.message);
  }

  const execId = await registrarExecucao(client, empresaId, {
    request_xml: xmlPedido,
    response_xml: "",
    estado: estadoFinal,
    correlation_id: correlationId,
    num_paginas: paginas,
    tipo: "stock",
  });

  return {
    ...resultado,
    linhas_lidas: linhasLidas,
    produtos: numProdutos,
    ultima_execucao: { id: execId, estado: estadoFinal, correlation_id: correlationId, paginas },
  };
}
