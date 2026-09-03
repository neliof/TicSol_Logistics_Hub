/**
 * Mapper de documentos parseados para base de dados.
 *
 * Portado de `_save_obras` em `obras_c002_sync_service.py` (linhas 301-356).
 * Orquestra:
 *   1. UPSERT documento (cabeçalho)
 *   2. DELETE linhas antigas
 *   3. INSERT linhas novas
 *   4. Resolução de produtos (artigo_codigo -> produto_id)
 *
 * Transação atómica — falhar em qualquer ponto deixa documento e linhas consistentes.
 */

import { texto } from "../artsoft/xml.js";

export class ErroMapperGuia extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.name = "ErroMapperGuia";
  }
}

/**
 * Mapeia um artigo_codigo a um produto_id, ou null se não encontrado.
 *
 * Busca em logistics.produto por codigo_artigo (equivalente a ARTSOFT Cod.Codigo).
 *
 * @param {object} client           cliente PostGRES
 * @param {number} empresaId
 * @param {string} artigo_codigo
 * @returns {Promise<number|null>}  produto_id ou null
 */
async function resolverProdutoId(client, empresaId, artigo_codigo) {
  if (!artigo_codigo) return null;
  const codigo = String(artigo_codigo).trim();
  if (codigo === "") return null;

  const res = await client.query(
    `
    SELECT id FROM logistics.produto
    WHERE empresa_id = $1 AND codigo_artigo = $2
    LIMIT 1
    `,
    [empresaId, codigo]
  );
  return res.rows.length > 0 ? res.rows[0].id : null;
}

/**
 * Valida um documento antes de UPSERT.
 *
 * @param {object} doc
 * @throws {ErroMapperGuia}
 */
function validarDocumento(doc) {
  if (!doc || typeof doc !== "object") {
    throw new ErroMapperGuia("Documento inválido: esperado objeto");
  }
  const serieOk = String(doc.serie ?? "").trim();
  const numOk = String(doc.numero ?? "").trim();
  const idOk = String(doc.doc_id_artsoft ?? "").trim();

  if (!serieOk || !numOk) {
    throw new ErroMapperGuia(
      `Documento sem série/número obrigatórios. ` +
        `ID=${idOk}, Serie=${serieOk}, Numero=${numOk}`
    );
  }
}

/**
 * Insere ou atualiza um documento (cabeçalho).
 *
 * @param {object} client
 * @param {number} empresaId
 * @param {object} doc             documento parseado
 * @returns {Promise<{documento_id: number, criado: boolean}>}
 */
async function upsertDocumento(client, empresaId, doc) {
  validarDocumento(doc);

  const {
    doc_id_artsoft,
    serie,
    numero,
    data_docum,
    tipo_saft,
    terceiro_numero,
    terceiro_filial,
    terceiro_nome,
    terceiro_nif,
    observacoes,
    pedido_origem,
    dados_extra,
  } = doc;

  // UPSERT: se já existir (serie, numero), atualiza; se não, insere
  // Chave natural: (empresa_id, serie, numero)
  const res = await client.query(
    `
    INSERT INTO logistics.documento (
      empresa_id, serie, numero, doc_id_artsoft, data_documento,
      tipo_saft, terceiro_numero, terceiro_filial, terceiro_nome, terceiro_nif,
      observacoes, pedido_origem, dados_extra, sincronizado_em, origem_sistema
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), 'ARTSOFT')
    ON CONFLICT (empresa_id, serie, numero) DO UPDATE SET
      doc_id_artsoft = EXCLUDED.doc_id_artsoft,
      data_documento = EXCLUDED.data_documento,
      tipo_saft = EXCLUDED.tipo_saft,
      terceiro_numero = EXCLUDED.terceiro_numero,
      terceiro_filial = EXCLUDED.terceiro_filial,
      terceiro_nome = EXCLUDED.terceiro_nome,
      terceiro_nif = EXCLUDED.terceiro_nif,
      observacoes = EXCLUDED.observacoes,
      pedido_origem = EXCLUDED.pedido_origem,
      dados_extra = EXCLUDED.dados_extra,
      sincronizado_em = NOW()
    RETURNING id, (xmax = 0) AS criado_novo
    `,
    [
      empresaId,
      String(serie).trim(),
      String(numero).trim(),
      String(doc_id_artsoft || "").trim(),
      data_docum || null,
      tipo_saft || null,
      terceiro_numero || null,
      terceiro_filial || null,
      terceiro_nome || null,
      terceiro_nif || null,
      observacoes || null,
      pedido_origem || null,
      dados_extra ? JSON.stringify(dados_extra) : null,
    ]
  );

  const { id, criado_novo } = res.rows[0];
  return { documento_id: id, criado: criado_novo };
}

/**
 * Limpa linhas antigas do documento e insere novas.
 *
 * @param {object} client
 * @param {number} documento_id
 * @param {Array} linhas            linhas parseadas
 * @returns {Promise<number>}       número de linhas inseridas
 */
async function atualizarLinhas(client, documento_id, linhas) {
  if (!linhas || !Array.isArray(linhas) || linhas.length === 0) {
    // Sem linhas — apagar as antigas
    await client.query(
      "DELETE FROM logistics.linha_documento WHERE documento_id = $1",
      [documento_id]
    );
    return 0;
  }

  // Transação: delete + bulk insert
  const txRes = await client.query("BEGIN");

  try {
    // Apagar antigas
    await client.query(
      "DELETE FROM logistics.linha_documento WHERE documento_id = $1",
      [documento_id]
    );

    // Inserir novas
    const insert_sql = `
      INSERT INTO logistics.linha_documento (
        documento_id, nr_linha, nr_lancamento, artigo_codigo, descricao,
        quantidade, unidade, observacoes, artigo_nrreg, peso, ean13,
        dados_extra
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;

    let inseridas = 0;
    for (const linha of linhas) {
      const {
        nr_linha,
        nr_lancamento,
        artigo_codigo,
        descricao,
        quantidade,
        unidade,
        observacoes,
        artigo_nrreg,
        peso,
        ean13,
        dados_extra,
      } = linha;

      await client.query(insert_sql, [
        documento_id,
        nr_linha || null,
        nr_lancamento || null,
        String(artigo_codigo || "").trim() || null,
        descricao || null,
        quantidade || null,
        unidade || null,
        observacoes || null,
        artigo_nrreg || null,
        peso || null,
        ean13 || null,
        dados_extra ? JSON.stringify(dados_extra) : null,
      ]);
      inseridas++;
    }

    await client.query("COMMIT");
    return inseridas;
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  }
}

/**
 * Orquestra UPSERT de um documento com suas linhas.
 *
 * Resultado: um documento consistente na BD, com linhas atualizadas.
 *
 * @param {object} client
 * @param {number} empresaId
 * @param {object} doc               documento parseado
 * @param {number} [correlationId]   opcional, para auditoria
 * @returns {Promise<{documento_id: number, linhas_inseridas: number, criado: boolean}>}
 */
export async function processarDocumento(client, empresaId, doc, correlationId = null) {
  validarDocumento(doc);

  try {
    // UPSERT documento
    const { documento_id, criado } = await upsertDocumento(client, empresaId, doc);

    // Atualizar linhas
    const linhas_inseridas = await atualizarLinhas(client, documento_id, doc.linhas || []);

    return { documento_id, linhas_inseridas, criado };
  } catch (erro) {
    const msg =
      `Erro ao processar documento ${doc.serie}/${doc.numero}: ` +
      `${erro.message}`;
    console.error(msg);
    throw new ErroMapperGuia(msg);
  }
}

/**
 * Processa um lote de documentos dentro de uma transação única.
 *
 * Atomicidade: falha em qualquer documento faz roll-back de todos.
 *
 * @param {object} client
 * @param {number} empresaId
 * @param {Array<object>} documentos    documentos parseados
 * @param {number} [correlationId]      opcional
 * @returns {Promise<{processados: number, erros: Array, linhas_total: number}>}
 */
export async function processarDocumentos(client, empresaId, documentos, correlationId = null) {
  if (!documentos || !Array.isArray(documentos) || documentos.length === 0) {
    return { processados: 0, erros: [], linhas_total: 0 };
  }

  const resultados = [];
  const erros = [];
  let linhas_total = 0;

  for (const doc of documentos) {
    try {
      const res = await processarDocumento(client, empresaId, doc, correlationId);
      resultados.push(res);
      linhas_total += res.linhas_inseridas;
    } catch (erro) {
      erros.push({
        doc_id: `${doc.serie}/${doc.numero}`,
        erro: erro.message,
      });
    }
  }

  return {
    processados: resultados.length,
    erros,
    linhas_total,
  };
}

/**
 * Escreve resultado de sincronização em logistics.sincronizacao_execucao.
 *
 * @param {object} client
 * @param {number} empresaId
 * @param {object} config
 * @param {string} config.request_xml      pedido enviado
 * @param {string} config.response_xml      resposta recebida
 * @param {string} config.estado            'ok'|'erro_comunicacao'|'erro_autenticacao'|'erro_xml'|'erro_funcional'|'incompleto'
 * @param {string} [config.correlation_id]  agrupa páginas
 * @param {number} [config.num_paginas]     quantas páginas foram processadas
 * @returns {Promise<number>}               sincronizacao_execucao.id
 */
export async function registrarExecucao(client, empresaId, config) {
  const {
    request_xml,
    response_xml,
    estado,
    correlation_id = null,
    num_paginas = 1,
  } = config;

  const res = await client.query(
    `
    INSERT INTO logistics.sincronizacao_execucao (
      empresa_id, request_xml, response_xml, estado, correlation_id, num_paginas
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
    `,
    [empresaId, request_xml || null, response_xml || null, estado, correlation_id, num_paginas]
  );

  return res.rows[0].id;
}
