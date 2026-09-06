/**
 * Orquestrador de sincronização de fichas de artigo (StkFch) do ARTSOFT
 * para logistics.produto.
 *
 * Fluxo:
 *   1. Ler config de conexão de logistics.configuracao
 *   2. Construir defcol dos campos ativos (mapeamento_campo, contexto 'produto')
 *   3. Ciclo de paginação por token contra o endpoint Queries/Query
 *   4. Parsear cada página em produtos
 *   5. UPSERT em logistics.produto por (empresa_id, sku_interno)
 *   6. Auditar em logistics.sincronizacao_execucao (tipo 'produtos')
 *
 * Espelha o padrão de guias/sync.js. A password nunca vem da BD — só do .env.
 */

import crypto from "crypto";
import { construirDefcolLinhas, construirPedidoXml, comToken } from "../artsoft/queryBuilder.js";
import { parseXml } from "../artsoft/xml.js";
import { cicloComToken } from "../artsoft/pagination.js";
import { inteiroConfig } from "../config/series.js";
import { parseProdutosResponse } from "./parser.js";
import { processarProdutos } from "./mapper.js";
import { registrarExecucao } from "../guias/mapper.js";
import { executarPedidoArtsoft } from "../artsoft/connection.js";

export class ErroSincronizacaoProdutos extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroSincronizacaoProdutos";
  }
}

/**
 * Fallback de mapeamentos, usado quando não há linhas em mapeamento_campo
 * (contexto 'produto'). As tags têm de coincidir com as que o parser lê.
 */
const MAPEAMENTOS_PADRAO = [
  { campo: "codigo", tag_xml: "Codigo", form_path: "%StkFch.Cod.Codigo", ordem: 1 },
  { campo: "descricao", tag_xml: "Descricao", form_path: "%StkFch.Nome.0", ordem: 2 },
  { campo: "ean", tag_xml: "CodOpc", form_path: "%StkFch.Cod.Opcional", ordem: 3 },
  { campo: "peso_liquido", tag_xml: "PesoLiq", form_path: "%StkFch.Logis.PLiqUni", ordem: 4 },
  { campo: "peso_bruto", tag_xml: "PesoBruto", form_path: "%StkFch.Logis.PBrUnit", ordem: 5 },
  { campo: "unidades_por_caixa", tag_xml: "QtdEmb", form_path: "%StkFch.Logis.QtdEmb", ordem: 6 },
  { campo: "unidade", tag_xml: "Unidade", form_path: "%StkFch.Logis.Uni", ordem: 7 },
  { campo: "controla_lote", tag_xml: "CtrlLote", form_path: "%StkFch.Flag.CtrlLt", ordem: 8 },
  { campo: "controla_validade", tag_xml: "CtrlValid", form_path: "%StkFch.Flag.DtValid", ordem: 9 },
  { campo: "dias_validade", tag_xml: "DiasValid", form_path: "%StkFch.Div.DiasValid", ordem: 10 },
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
    throw new ErroSincronizacaoProdutos(
      "Config incompleta: artsoft.host/porta/utilizador em logistics.configuracao"
    );
  }

  return {
    host,
    porta: Number.parseInt(String(porta), 10),
    utilizador,
    senha: process.env.ARTSOFT_SENHA || config["artsoft.senha"] || "",
    timeout: inteiroConfig(config, "artsoft.timeout", 30000, { min: 5000, max: 120000 }),
    pageSize: inteiroConfig(config, "produtos.page_size", 200, { min: 10, max: 1000 }),
    maxPaginas: inteiroConfig(config, "produtos.max_pages", 500, { min: 1, max: 10000 }),
    codigoMin: config["produtos.codigo_min"] || "101",
    codigoMax: config["produtos.codigo_max"] || "ZZZ",
  };
}

async function carregarMapeamentos(client, empresaId) {
  const res = await client.query(
    `
    SELECT campo, tag_xml, form_path, ativo, ordem
    FROM logistics.mapeamento_campo
    WHERE empresa_id = $1 AND contexto = 'produto' AND ativo = true
    ORDER BY ordem ASC, campo ASC
    `,
    [empresaId]
  );
  return res.rows.length > 0 ? res.rows : MAPEAMENTOS_PADRAO;
}

/**
 * Sincroniza fichas de artigo.
 *
 * @param {object} client
 * @param {string} empresaId  UUID
 * @param {object} [opcoes]
 * @param {(msg: string) => void} [opcoes.logger]
 * @returns {Promise<{criados, atualizados, processados, erros, ultima_execucao}>}
 */
export async function sincronizarProdutos(client, empresaId, { logger = () => {} } = {}) {
  const correlationId = crypto.randomUUID();
  let estadoFinal = "ok";
  let xmlPedido = "";
  let xmlResposta = "";
  let resultado = { criados: 0, atualizados: 0, processados: 0, erros: [] };
  let paginas = 0;

  try {
    logger(`[${correlationId}] Carregando config…`);
    const cfg = await carregarConfiguracao(client, empresaId);
    const mapeamentos = await carregarMapeamentos(client, empresaId);

    const corpoDefcol = construirDefcolLinhas(mapeamentos, { indentacao: "        " });
    const filtro = `StkFch|Principal|Codigo=${cfg.codigoMin}:${cfg.codigoMax}`;

    xmlPedido = construirPedidoXml({ filtro, pageSize: cfg.pageSize, nome: "rec", corpoDefcol });

    logger(`[${correlationId}] Iniciando paginação (pageSize=${cfg.pageSize})…`);
    const ciclo = await cicloComToken({
      pedidoInicial: { filtro, pageSize: cfg.pageSize, nome: "rec", corpoDefcol },
      // parseXml devolve o documento com o elemento raiz <root> incluído.
      parseador: (xml) => {
        const doc = parseXml(xml);
        return doc.root ?? doc;
      },
      extrairRegistos: parseProdutosResponse,
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
    if (ciclo.estado === "erro" || ciclo.estado === "erro_xml") {
      estadoFinal = ciclo.estado === "erro_xml" ? "erro_xml" : "erro_comunicacao";
    } else if (ciclo.estado === "incompleto") {
      estadoFinal = "incompleto";
    }

    logger(`[${correlationId}] ${ciclo.registos.length} artigos recebidos; a gravar…`);
    resultado = await processarProdutos(client, empresaId, ciclo.registos);

    if (resultado.erros.length > 0 && estadoFinal === "ok") {
      estadoFinal = "erro_funcional";
    }

    logger(
      `[${correlationId}] Concluído: ${resultado.criados} novos, ` +
        `${resultado.atualizados} atualizados, ${resultado.erros.length} erros.`
    );
  } catch (erro) {
    logger(`[${correlationId}] ERRO: ${erro.message}`);
    if (erro.name === "ErroAutenticacaoArtsoft") estadoFinal = "erro_autenticacao";
    else if (erro.name === "ErroConexaoArtsoft") estadoFinal = "erro_comunicacao";
    else if (erro.name === "ErroXmlArtsoft") estadoFinal = "erro_xml";
    else estadoFinal = "erro_funcional";

    await registrarExecucao(client, empresaId, {
      request_xml: xmlPedido,
      response_xml: xmlResposta,
      estado: estadoFinal,
      correlation_id: correlationId,
      num_paginas: paginas,
      tipo: "produtos",
    }).catch(() => {});

    throw new ErroSincronizacaoProdutos(erro.message);
  }

  const execId = await registrarExecucao(client, empresaId, {
    request_xml: xmlPedido,
    response_xml: xmlResposta,
    estado: estadoFinal,
    correlation_id: correlationId,
    num_paginas: paginas,
    tipo: "produtos",
  });

  return {
    ...resultado,
    ultima_execucao: { id: execId, estado: estadoFinal, correlation_id: correlationId, paginas },
  };
}
