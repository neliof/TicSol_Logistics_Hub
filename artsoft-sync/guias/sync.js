/**
 * Orquestrador de sincronização de guias de transporte a partir de ARTSOFT.
 *
 * Fluxo:
 *   1. Ler config de série/TPSAFT/conexão de ARTSOFT de logistics.configuracao
 *   2. Construir defcol de campos ativos em logistics.mapeamento_campo
 *   3. Construir pedido XML (raiz + subconsulta Lans para linhas)
 *   4. Executar pedido ao ARTSOFT (Digest SHA1 auth, Queries/Query endpoint)
 *   5. Ciclo de paginação com token (até fim ou limite)
 *   6. Parsear cada página em documentos
 *   7. Validar TpSAFT e séries
 *   8. Mapear para BD (UPSERT)
 *   9. Auditar em sincronizacao_execucao
 *
 * Retorna: { docs_criados, docs_atualizados, erros: [], ultimaExecucao }
 */

import assert from "assert";
import crypto from "crypto";
import { createHash } from "crypto";
import { parseXml, comoLista, texto } from "../artsoft/xml.js";
import {
  construirDefcolLinhas,
  construirSubconsulta,
  construirPedidoXml,
  comToken,
} from "../artsoft/queryBuilder.js";
import {
  parseListaConfig,
  resolverSeriesGuias,
  resolverTpSaftValidos,
  validarTpSaft,
  inteiroConfig,
} from "../config/series.js";
import { cicloComToken, extrairTokenProximaPagina } from "../artsoft/pagination.js";
import { parseGuiasResponse, ErroParserGuia } from "./parser.js";
import { processarDocumentos, registrarExecucao } from "./mapper.js";

export class ErroSincronizacaoGuias extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroSincronizacaoGuias";
  }
}

/**
 * Autentica um pedido HTTP com Digest SHA1 (ARTSOFT WebServer).
 *
 * Portado de `_artsoft_digest_auth` em `artsoft_sync_service.py`.
 *
 * @param {object} config
 * @param {string} config.utilizador
 * @param {string} config.senha
 * @param {string} config.metodo         'GET'|'POST'
 * @param {string} config.uri            '/Queries/Query'
 * @param {string} config.realm          'ARTSOFT'
 * @param {string} config.nonce          do servidor
 * @param {string} [config.qop]          'auth'
 * @returns {string}                     Authorization header value
 */
function construirDigestAuth({
  utilizador,
  senha,
  metodo,
  uri,
  realm,
  nonce,
  qop = null,
}) {
  const ha1 = createHash("sha1")
    .update(`${utilizador}:${realm}:${senha}`)
    .digest("hex");
  const ha2 = createHash("sha1")
    .update(`${metodo}:${uri}`)
    .digest("hex");

  let resposta;
  if (qop === "auth") {
    const nc = "00000001";
    const cnonce = crypto.randomBytes(8).toString("hex");
    resposta = createHash("sha1")
      .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
      .digest("hex");
    return (
      `Digest username="${utilizador}", realm="${realm}", ` +
      `nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, ` +
      `cnonce="${cnonce}", response="${resposta}", algorithm=SHA-1`
    );
  } else {
    resposta = createHash("sha1")
      .update(`${ha1}:${nonce}:${ha2}`)
      .digest("hex");
    return (
      `Digest username="${utilizador}", realm="${realm}", ` +
      `nonce="${nonce}", uri="${uri}", response="${resposta}", algorithm=SHA-1`
    );
  }
}

/**
 * Executa um pedido HTTP ao ARTSOFT WebServer.
 *
 * Suporta: autenticação Digest SHA1, retry com `WWW-Authenticate` header.
 *
 * @param {object} config
 * @param {string} config.host
 * @param {number} config.porta
 * @param {string} config.utilizador
 * @param {string} config.senha
 * @param {string} config.xml            corpo do pedido
 * @param {number} [config.timeout]      ms, default 30000
 * @returns {Promise<string>}            XML de resposta
 */
export async function executarPedidoArtsoft({
  host,
  porta,
  utilizador,
  senha,
  xml,
  timeout = 30000,
}) {
  const url = new URL(`http://${host}:${porta}/Queries/Query`);

  // Tentar sem auth primeiro (alguns ARTSOFT não requerem)
  let resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/xml;charset=utf-8",
    },
    body: xml,
    signal: AbortSignal.timeout(timeout),
  });

  // Se 401, extrair nonce de WWW-Authenticate e retry com Digest
  if (resp.status === 401) {
    const wwwAuth = resp.headers.get("WWW-Authenticate");
    if (wwwAuth && wwwAuth.includes("Digest")) {
      const nonceMatch = wwwAuth.match(/nonce="([^"]+)"/);
      const realmMatch = wwwAuth.match(/realm="([^"]+)"/);
      const qopMatch = wwwAuth.match(/qop="([^"]+)"/);

      if (nonceMatch && realmMatch) {
        const nonce = nonceMatch[1];
        const realm = realmMatch[1];
        const qop = qopMatch ? qopMatch[1] : null;

        const auth = construirDigestAuth({
          utilizador,
          senha,
          metodo: "POST",
          uri: "/Queries/Query",
          realm,
          nonce,
          qop: qop === "auth" ? "auth" : null,
        });

        resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/xml;charset=utf-8",
            Authorization: auth,
          },
          body: xml,
          signal: AbortSignal.timeout(timeout),
        });
      }
    }
  }

  if (!resp.ok) {
    throw new ErroSincronizacaoGuias(
      `HTTP ${resp.status} a ${url}: ${resp.statusText}`
    );
  }

  return resp.text();
}

/**
 * Carrega a configuração ARTSOFT do banco.
 *
 * @param {object} client
 * @param {number} empresaId
 * @returns {Promise<{host, porta, utilizador, senha, timeout, series: [], tpsaft_validos: []}>}
 */
async function carregarConfiguracao(client, empresaId) {
  const res = await client.query(
    `SELECT chave, valor FROM logistics.configuracao WHERE empresa_id = $1`,
    [empresaId]
  );

  const config = {};
  for (const row of res.rows) {
    config[row.chave] = row.valor;
  }

  // Validar obrigatórios
  const host = config["artsoft.host"];
  const porta = config["artsoft.porta"];
  const utilizador = config["artsoft.utilizador"];

  if (!host || !porta || !utilizador) {
    throw new ErroSincronizacaoGuias(
      `Config incompleta: artsoft.host/porta/utilizador em logistics.configuracao`
    );
  }

  const seriesRes = resolverSeriesGuias(config);
  if (!seriesRes.valida) {
    throw new ErroSincronizacaoGuias(seriesRes.erro);
  }

  const tpsaftValidos = resolverTpSaftValidos(config);

  return {
    host,
    porta: Number.parseInt(String(porta), 10),
    utilizador,
    senha: config["artsoft.senha"] || "",
    timeout: inteiroConfig(config, "artsoft.timeout", 30000, { min: 5000, max: 120000 }),
    series: seriesRes.series,
    tpsaft_validos: tpsaftValidos,
    pageSize: inteiroConfig(config, "guias.page_size", 50, { min: 10, max: 1000 }),
    maxPaginas: inteiroConfig(config, "guias.max_pages", 300, { min: 1, max: 10000 }),
    formatoData: config["guias.formato_data"] || "ddmmaaaa",
  };
}

/**
 * Carrega mapeamentos de campo ativos.
 *
 * @param {object} client
 * @param {number} empresaId
 * @param {string} contexto   'guia_cabecalho'|'guia_linha'
 * @returns {Promise<Array>}   [{campo, tag_xml, form_path, ativo, ordem}, ...]
 */
async function carregarMapeamentos(client, empresaId, contexto) {
  const res = await client.query(
    `
    SELECT campo, tag_xml, form_path, ativo, ordem
    FROM logistics.mapeamento_campo
    WHERE empresa_id = $1 AND contexto = $2 AND ativo = true
    ORDER BY ordem ASC, campo ASC
    `,
    [empresaId, contexto]
  );
  return res.rows;
}

/**
 * Constrói o XML de pedido para guias.
 *
 * Filtro: `DocFch|Serie IN (V960;V980)` ou equivalente, dependendo do ARTSOFT.
 *
 * @param {object} config
 * @param {Array<string>} config.series       ['V960', 'V980', ...]
 * @param {number} config.pageSize
 * @param {Array} config.mapeamentosCabecalho  mapeamentos para cabeçalho
 * @param {Array} config.mapeamentosLinhas    mapeamentos para linhas
 * @returns {string} XML pronto para envio
 */
function construirPedidoGuias({
  series,
  pageSize,
  mapeamentosCabecalho,
  mapeamentosLinhas,
}) {
  // Filtro de série — ARTSOFT aceita IN(val1;val2;...)
  const filtroSerie = `DocFch|${series.join(";")}`;

  // Defcol cabeçalho
  const defcolCabecalho = construirDefcolLinhas(mapeamentosCabecalho, {
    indentacao: "        ",
  });

  // Subconsulta de linhas (Lans)
  const defcolLinhas = construirDefcolLinhas(mapeamentosLinhas, {
    indentacao: "            ",
  });
  const subconsultaLinhas = construirSubconsulta({
    tag: "Lans",
    nome: "lan",
    filtro: `DocLan|^DocFch|${series.join(";")}`, // correlação com cabeçalho
    mapeamentos: mapeamentosLinhas,
    indentacao: "        ",
  });

  // Corpo completo
  const corpo = `${defcolCabecalho}\n${subconsultaLinhas}`;

  // Envelope
  return construirPedidoXml({
    filtro: filtroSerie,
    pageSize,
    nome: "DocFch",
    corpoDefcol: corpo,
  });
}

/**
 * Sincroniza guias da série configurada.
 *
 * @param {object} client       cliente PostGRES
 * @param {number} empresaId
 * @param {object} [opcoes]
 * @param {(msg: string) => void} [opcoes.logger]  log de progresso
 * @returns {Promise<{
 *   docs_criados: number,
 *   docs_atualizados: number,
 *   linhas_total: number,
 *   erros: Array,
 *   ultima_execucao: {id: number, estado: string}
 * }>}
 */
export async function sincronizarGuias(client, empresaId, { logger = () => {} } = {}) {
  const correlationId = crypto.randomUUID();
  let estadoFinal = "completo";
  let xmlPedido = "";
  let xmlResposta = "";

  try {
    logger(`[${correlationId}] Carregando config…`);
    const cfg = await carregarConfiguracao(client, empresaId);

    logger(`[${correlationId}] Carregando mapeamentos…`);
    const mapCabecalho = await carregarMapeamentos(
      client,
      empresaId,
      "guia_cabecalho"
    );
    const mapLinhas = await carregarMapeamentos(client, empresaId, "guia_linha");

    if (mapCabecalho.length === 0) {
      throw new ErroSincronizacaoGuias(
        `Nenhum mapeamento ativo para guia_cabecalho`
      );
    }

    logger(`[${correlationId}] Construindo pedido…`);
    xmlPedido = construirPedidoGuias({
      series: cfg.series,
      pageSize: cfg.pageSize,
      mapeamentosCabecalho: mapCabecalho,
      mapeamentosLinhas: mapLinhas,
    });

    logger(`[${correlationId}] Ciclo de paginação iniciado…`);
    const resultPaginacao = await cicloComToken({
      pedidoInicial: {
        filtro: `DocFch|${cfg.series.join(";")}`,
        pageSize: cfg.pageSize,
        nome: "DocFch",
        corpoDefcol: "", // já está no XML
      },
      parseador: (xml) => {
        xmlResposta = xml;
        return parseXml(xml);
      },
      extrairRegistos: (raiz) => {
        // Extract raw records; parseGuiasResponse fará validação
        const regs = comoLista(raiz.rec || raiz.Document || raiz.row);
        return regs;
      },
      acrescentarToken: (filtro, token) => comToken(filtro, token),
      construir: (pedidoConfig) =>
        construirPedidoXml({
          filtro: pedidoConfig.filtro,
          pageSize: pedidoConfig.pageSize,
          nome: pedidoConfig.nome,
          corpoDefcol: xmlPedido.match(/<defcol>[\s\S]*<\/defcol>/)?.[0] || "",
        }),
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

    if (resultPaginacao.estado !== "completo") {
      estadoFinal = resultPaginacao.estado || "incompleto";
      logger(
        `[${correlationId}] Paginação terminou com estado: ${estadoFinal}`
      );
    }

    // Parse de registos brutos em documentos estruturados
    logger(`[${correlationId}] Parseando ${resultPaginacao.registos.length} registos…`);
    const documentos = parseGuiasResponse({
      rec: resultPaginacao.registos,
    });

    // Validar TpSAFT
    const docsValidos = [];
    for (const doc of documentos) {
      const validacao = validarTpSaft(doc.tipo_saft, cfg.tpsaft_validos);
      if (!validacao.aceite) {
        logger(
          `[${correlationId}] Doc ${doc.serie}/${doc.numero}: ` +
            `${validacao.motivo} (ignorado)`
        );
        continue;
      }
      docsValidos.push(doc);
    }

    logger(`[${correlationId}] Mapeando ${docsValidos.length} documentos…`);
    const resultMapper = await processarDocumentos(
      client,
      empresaId,
      docsValidos,
      correlationId
    );

    // Auditar
    logger(`[${correlationId}] Registando execução…`);
    await registrarExecucao(client, empresaId, {
      request_xml: xmlPedido.substring(0, 5000), // limpar para storage
      response_xml: xmlResposta.substring(0, 5000),
      estado: estadoFinal,
      correlation_id: correlationId,
      num_paginas: resultPaginacao.paginas,
    });

    logger(`[${correlationId}] Sincronização concluída.`);
    return {
      docs_criados: resultMapper.processados,
      docs_atualizados: 0, // TODO: contar criados vs. atualizados
      linhas_total: resultMapper.linhas_total,
      erros: resultMapper.erros,
      ultima_execucao: {
        estado: estadoFinal,
        correlation_id: correlationId,
        paginas: resultPaginacao.paginas,
      },
    };
  } catch (erro) {
    logger(`[${correlationId}] ERRO: ${erro.message}`);
    estadoFinal = "erro_funcional";

    // Auditar erro
    try {
      await registrarExecucao(client, empresaId, {
        request_xml: xmlPedido.substring(0, 5000),
        response_xml: xmlResposta.substring(0, 5000),
        estado: estadoFinal,
        correlation_id: correlationId,
        num_paginas: 0,
      });
    } catch (auditError) {
      logger(`[${correlationId}] Erro a auditar (ignorado): ${auditError.message}`);
    }

    throw erro;
  }
}
