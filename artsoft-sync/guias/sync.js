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
import { executarPedidoArtsoft } from "../artsoft/connection.js";

export { executarPedidoArtsoft };

export class ErroSincronizacaoGuias extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroSincronizacaoGuias";
  }
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
    // A password nunca se guarda em logistics.configuracao — vem do ambiente.
    senha: process.env.ARTSOFT_SENHA || config["artsoft.senha"] || "",
    timeout: inteiroConfig(config, "artsoft.timeout", 30000, { min: 5000, max: 120000 }),
    series: seriesRes.series,
    tpsaft_validos: tpsaftValidos,
    pageSize: inteiroConfig(config, "guias.page_size", 50, { min: 10, max: 1000 }),
    maxPaginas: inteiroConfig(config, "guias.max_pages", 300, { min: 1, max: 10000 }),
    diasRetroativos: inteiroConfig(config, "guias.dias_retroativos", 30, {
      min: 1,
      max: 3650,
    }),
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
 * Formata uma Date em AAAAMMDD, como o ARTSOFT espera nos filtros de data.
 *
 * @param {Date} data
 * @returns {string} ex: '20260801'
 */
function formatarDataArtsoft(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${ano}${mes}${dia}`;
}

/**
 * Constrói o filtro de cabeçalho para guias.
 *
 * Formato validado contra ARTSOFT V26 (chave `DocData` de DocFch):
 *   DocFch|DocData|TpDoc=<serieMin>:<serieMax>|Data=<AAAAMMDD>:<AAAAMMDD>
 *   ^TerFch|Cliente|NrCli={%DocFch.Ter.Terceiro}|Filial={%DocFch.Ter.Filial}
 *
 * O `TpDoc` é um intervalo, não uma lista: as séries configuradas são
 * ordenadas e usadas como limites. A correlação `^TerFch` dá acesso aos
 * campos `%TerFch.*` (nome, NIF, morada do terceiro).
 *
 * @param {object} config
 * @param {Array<string>} config.series     ex: ['V990']
 * @param {string} config.dataInicio        AAAAMMDD
 * @param {string} config.dataFim           AAAAMMDD
 * @returns {string}
 */
function construirFiltroCabecalho({ series, dataInicio, dataFim }) {
  const ordenadas = [...series].sort();
  const serieMin = ordenadas[0];
  const serieMax = ordenadas[ordenadas.length - 1];

  return (
    `DocFch|DocData|TpDoc=${serieMin}:${serieMax}|Data=${dataInicio}:${dataFim}` +
    ` ^TerFch|Cliente|NrCli={%DocFch.Ter.Terceiro}|Filial={%DocFch.Ter.Filial}`
  );
}

/**
 * Constrói o XML de pedido para guias (padrão C002: cabeçalho + linhas
 * numa única chamada).
 *
 * @param {object} config
 * @param {Array<string>} config.series        ex: ['V990']
 * @param {number} config.pageSize
 * @param {string} config.dataInicio           AAAAMMDD
 * @param {string} config.dataFim              AAAAMMDD
 * @param {Array} config.mapeamentosCabecalho  mapeamentos para cabeçalho
 * @param {Array} config.mapeamentosLinhas     mapeamentos para linhas
 * @returns {string} XML pronto para envio
 */
function construirPedidoGuias({
  series,
  pageSize,
  dataInicio,
  dataFim,
  mapeamentosCabecalho,
  mapeamentosLinhas,
}) {
  const filtroCabecalho = construirFiltroCabecalho({
    series,
    dataInicio,
    dataFim,
  });

  const defcolCabecalho = construirDefcolLinhas(mapeamentosCabecalho, {
    indentacao: "        ",
  });

  // Subconsulta de linhas correlacionada com o cabeçalho, mais correlação
  // com StkFch para os campos de ficha de artigo (%StkFch.*).
  const subconsultaLinhas = construirSubconsulta({
    tag: "Lans",
    nome: "lan",
    filtro:
      "DocLan|Document|TpDoc={%DocFch.Doc.Serie}|NrDoc={%DocFch.Doc.NrDoc}" +
      " ^StkFch|Codigo={%DocLan.Cod.Codigo}",
    mapeamentos: mapeamentosLinhas,
    indentacao: "        ",
  });

  const corpo = `${defcolCabecalho}\n${subconsultaLinhas}`;

  return construirPedidoXml({
    filtro: filtroCabecalho,
    pageSize,
    nome: "rec",
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
export async function sincronizarGuias(client, empresaId, { logger = () => {}, dataInicio: dataInicioParam = null, dataFim: dataFimParam = null, series: seriesParam = null } = {}) {
  const correlationId = crypto.randomUUID();
  // Estados aceites pela constraint de logistics.sincronizacao_execucao:
  // ok | erro_comunicacao | erro_autenticacao | erro_xml | erro_funcional | incompleto
  let estadoFinal = "ok";
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

    // Usar séries do parâmetro se fornecidas, senão usar as da config
    const seriesAtivas = seriesParam && seriesParam.length > 0 ? seriesParam : cfg.series;

    // Janela de datas: usa as datas do pedido se fornecidas, senão
    // hoje menos `guias.dias_retroativos` até hoje.
    let dataInicio, dataFim;
    if (dataInicioParam && dataFimParam) {
      dataInicio = formatarDataArtsoft(dataInicioParam);
      dataFim = formatarDataArtsoft(dataFimParam);
    } else {
      const hoje = new Date();
      const inicio = new Date(hoje);
      inicio.setDate(inicio.getDate() - cfg.diasRetroativos);
      dataInicio = formatarDataArtsoft(inicio);
      dataFim = formatarDataArtsoft(hoje);
    }

    logger(
      `[${correlationId}] Construindo pedido… ` +
        `séries=${seriesAtivas.join(";")} datas=${dataInicio}:${dataFim}`
    );
    xmlPedido = construirPedidoGuias({
      series: seriesAtivas,
      pageSize: cfg.pageSize,
      dataInicio,
      dataFim,
      mapeamentosCabecalho: mapCabecalho,
      mapeamentosLinhas: mapLinhas,
    });

    // Corpo do defcol (sem as tags <defcol>), para reconstruir cada página.
    const corpoDefcol =
      xmlPedido.match(/<defcol>\n([\s\S]*)\n {4}<\/defcol>/)?.[1] || "";

    const filtroBase = construirFiltroCabecalho({
      series: seriesAtivas,
      dataInicio,
      dataFim,
    });

    logger(`[${correlationId}] Ciclo de paginação iniciado…`);
    const resultPaginacao = await cicloComToken({
      pedidoInicial: {
        filtro: filtroBase,
        pageSize: cfg.pageSize,
        nome: "rec",
        corpoDefcol,
      },
      parseador: (xml) => {
        xmlResposta = xml;
        // parseXml devolve o documento com o elemento raiz incluído
        // ({root: {...}}); o resto do ciclo trabalha sobre o conteúdo.
        const doc = parseXml(xml);
        return doc.root ?? doc;
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
          corpoDefcol: pedidoConfig.corpoDefcol,
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

    if (resultPaginacao.estado && resultPaginacao.estado !== "completo") {
      estadoFinal = "incompleto";
      logger(
        `[${correlationId}] Paginação terminou com estado: ${resultPaginacao.estado}`
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
      docs_criados: resultMapper.criados,
      docs_atualizados: resultMapper.atualizados,
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
