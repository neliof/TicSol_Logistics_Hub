/**
 * Orquestrador de sincronização de fichas de terceiro (TerFch) do ARTSOFT.
 *
 * Um sync de dois modos: 'cliente' e 'fornecedor'. Muda o filtro ARTSOFT e a
 * tabela de destino; o resto (paginação, parsing, auditoria) é partilhado.
 * Espelha o padrão de guias/sync.js e produtos/sync.js.
 */

import crypto from "crypto";
import { construirDefcolLinhas, construirPedidoXml, comToken } from "../artsoft/queryBuilder.js";
import { parseXml } from "../artsoft/xml.js";
import { cicloComToken } from "../artsoft/pagination.js";
import { inteiroConfig } from "../config/series.js";
import { parseTerceirosResponse } from "./parser.js";
import { processarTerceiros } from "./mapper.js";
import { registrarExecucao } from "../guias/mapper.js";
import { executarPedidoArtsoft } from "../artsoft/connection.js";

export class ErroSincronizacaoTerceiros extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroSincronizacaoTerceiros";
  }
}

/**
 * Definição de cada modo: tabela de destino, filtro ARTSOFT (com o intervalo de
 * número interpolado) e as tags convencionadas que o parser lê.
 */
const MODOS = {
  cliente: {
    tabela: "cliente",
    tipoExec: "clientes",
    filtro: (min, max) => `TerFch|Cliente|NrCli=${min}:${max}`,
    tagNumero: { tag_xml: "Numero", form_path: "%TerFch.Cli.Numero" },
  },
  fornecedor: {
    tabela: "fornecedor",
    tipoExec: "fornecedores",
    filtro: (min, max) => `TerFch|Forneced|NrFor=${min}:${max}`,
    tagNumero: { tag_xml: "Numero", form_path: "%TerFch.For.Numero" },
  },
};

function mapeamentosPadrao(modo) {
  return [
    { ...modo.tagNumero, campo: "numero", ordem: 1 },
    { campo: "nome", tag_xml: "Nome", form_path: "%TerFch.Ter.Nome", ordem: 2 },
    { campo: "nif", tag_xml: "Nif", form_path: "%TerFch.Ter.NIF", ordem: 3 },
    { campo: "morada", tag_xml: "Morada", form_path: "%TerFch.Ter.Morada", ordem: 4 },
    { campo: "localidade", tag_xml: "Localid", form_path: "%TerFch.Ter.Localid", ordem: 5 },
    { campo: "cod_postal", tag_xml: "CPPais", form_path: "%TerFch.Ter.CPPais", ordem: 6 },
  ];
}

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
    throw new ErroSincronizacaoTerceiros(
      "Config incompleta: artsoft.host/porta/utilizador em logistics.configuracao"
    );
  }

  return {
    host,
    porta: Number.parseInt(String(porta), 10),
    utilizador,
    senha: process.env.ARTSOFT_SENHA || config["artsoft.senha"] || "",
    timeout: inteiroConfig(config, "artsoft.timeout", 30000, { min: 5000, max: 120000 }),
    pageSize: inteiroConfig(config, "terceiros.page_size", 200, { min: 10, max: 1000 }),
    maxPaginas: inteiroConfig(config, "terceiros.max_pages", 500, { min: 1, max: 10000 }),
    numMin: config["terceiros.num_min"] || "1",
    numMax: config["terceiros.num_max"] || "999999",
  };
}

async function carregarMapeamentos(client, empresaId, modo, contexto) {
  const res = await client.query(
    `
    SELECT campo, tag_xml, form_path, ativo, ordem
    FROM logistics.mapeamento_campo
    WHERE empresa_id = $1 AND contexto = $2 AND ativo = true
    ORDER BY ordem ASC, campo ASC
    `,
    [empresaId, contexto]
  );
  return res.rows.length > 0 ? res.rows : mapeamentosPadrao(modo);
}

/**
 * Sincroniza terceiros de um tipo.
 *
 * @param {object} client
 * @param {string} empresaId  UUID
 * @param {'cliente'|'fornecedor'} tipo
 * @param {object} [opcoes]
 * @param {(msg: string) => void} [opcoes.logger]
 * @returns {Promise<{criados, atualizados, processados, erros, ultima_execucao}>}
 */
export async function sincronizarTerceiros(client, empresaId, tipo, { logger = () => {} } = {}) {
  const modo = MODOS[tipo];
  if (!modo) throw new ErroSincronizacaoTerceiros(`Tipo inválido: ${tipo}`);

  const correlationId = crypto.randomUUID();
  let estadoFinal = "ok";
  let xmlPedido = "";
  let resultado = { criados: 0, atualizados: 0, processados: 0, erros: [] };
  let paginas = 0;

  try {
    logger(`[${correlationId}] Carregando config…`);
    const cfg = await carregarConfiguracao(client, empresaId);
    const mapeamentos = await carregarMapeamentos(client, empresaId, modo, `terceiro_${tipo}`);

    const corpoDefcol = construirDefcolLinhas(mapeamentos, { indentacao: "        " });
    const filtro = modo.filtro(cfg.numMin, cfg.numMax);
    xmlPedido = construirPedidoXml({ filtro, pageSize: cfg.pageSize, nome: "rec", corpoDefcol });

    logger(`[${correlationId}] Paginação ${tipo} (pageSize=${cfg.pageSize})…`);
    const ciclo = await cicloComToken({
      pedidoInicial: { filtro, pageSize: cfg.pageSize, nome: "rec", corpoDefcol },
      parseador: (xml) => {
        const doc = parseXml(xml);
        return doc.root ?? doc;
      },
      extrairRegistos: parseTerceirosResponse,
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

    logger(`[${correlationId}] ${ciclo.registos.length} ${tipo}(s) recebidos; a gravar…`);
    resultado = await processarTerceiros(client, empresaId, modo.tabela, ciclo.registos);

    if (resultado.erros.length > 0 && estadoFinal === "ok") estadoFinal = "erro_funcional";

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
      response_xml: "",
      estado: estadoFinal,
      correlation_id: correlationId,
      num_paginas: paginas,
      tipo: modo.tipoExec,
    }).catch(() => {});

    throw new ErroSincronizacaoTerceiros(erro.message);
  }

  const execId = await registrarExecucao(client, empresaId, {
    request_xml: xmlPedido,
    response_xml: "",
    estado: estadoFinal,
    correlation_id: correlationId,
    num_paginas: paginas,
    tipo: modo.tipoExec,
  });

  return {
    ...resultado,
    ultima_execucao: { id: execId, estado: estadoFinal, correlation_id: correlationId, paginas },
  };
}
