/**
 * Endpoints para Sistema de Receção e Paletização (P1)
 * 17 endpoints total para receção, paletização, Artsoft e localização
 */

export function setupRecepcaoEndpoints(app, pool, verifyJWT, setEmpresaContext, UUID_RE) {
  // 1. POST /rest/v1/recepcao — Criar nova receção
  app.post('/rest/v1/recepcao', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { numero_guia, numero_encomenda_artsoft, fornecedor_id, fornecedor_nome, operador_inicio } = req.body;
      const empresaId = req.user?.empresa_id;

      if (!numero_guia || !fornecedor_nome) {
        return res.status(400).json({ error: 'numero_guia e fornecedor_nome obrigatórios' });
      }

      const result = await req.dbClient.query(
        `INSERT INTO logistics.recepcao
         (empresa_id, numero_guia, numero_encomenda_artsoft, fornecedor_id, fornecedor_nome, estado, operador_inicio)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [empresaId, numero_guia, numero_encomenda_artsoft, fornecedor_id || null, fornecedor_nome, 'RASCUNHO', operador_inicio]
      );

      res.json({ success: true, recepcao: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/recepcao error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 2. PATCH /rest/v1/recepcao/:id — Atualizar estado receção
  app.patch('/rest/v1/recepcao/:id', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;
      const { estado, operador } = req.body;

      if (!UUID_RE.test(id)) {
        return res.status(400).json({ error: 'Invalid recepcao id' });
      }

      if (!estado) {
        return res.status(400).json({ error: 'estado obrigatório' });
      }

      const result = await req.dbClient.query(
        `UPDATE logistics.recepcao
         SET estado = $1, atualizado_em = NOW()
         WHERE id = $2
         RETURNING *`,
        [estado, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Receção não encontrada' });
      }

      res.json({ success: true, recepcao: result.rows[0] });
    } catch (err) {
      console.error('PATCH /rest/v1/recepcao/:id error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 3. POST /rest/v1/recepcao/:id/documento — Registar documento
  app.post('/rest/v1/recepcao/:id/documento', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;
      const { tipo, numero, data, url_anexo, observacoes, operador } = req.body;

      if (!UUID_RE.test(id) || !tipo || !numero || !data) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes' });
      }

      const result = await req.dbClient.query(
        `INSERT INTO logistics.recepcao_documento
         (recepcao_id, tipo, numero, data, url_anexo, observacoes, operador)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, tipo, numero, data, url_anexo || null, observacoes || null, operador || null]
      );

      res.json({ success: true, documento: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/recepcao/:id/documento error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 4. POST /rest/v1/recepcao/:id/divergencia — Registar divergência
  app.post('/rest/v1/recepcao/:id/divergencia', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;
      const { linha_id, tipo, quantidade, motivo, impacto_entrada_artsoft, operador } = req.body;

      if (!UUID_RE.test(id) || !linha_id || !tipo || !motivo) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes' });
      }

      const result = await req.dbClient.query(
        `INSERT INTO logistics.recepcao_divergencia
         (recepcao_id, linha_id, tipo, quantidade, motivo, impacto_entrada_artsoft, operador)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id, linha_id, tipo, quantidade || 0, motivo, impacto_entrada_artsoft || 'REVISAR', operador || null]
      );

      res.json({ success: true, divergencia: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/recepcao/:id/divergencia error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 5. POST /rest/v1/recepcao/:id/lote — Registar lotes
  app.post('/rest/v1/recepcao/:id/lote', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;
      const { linha_id, lote, quantidade, data_validade, vida_util_dias } = req.body;

      if (!UUID_RE.test(id) || !linha_id || !lote || !quantidade || !data_validade) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes' });
      }

      const result = await req.dbClient.query(
        `INSERT INTO logistics.recepcao_lote
         (recepcao_id, linha_id, lote, quantidade, data_validade, vida_util_dias)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [id, linha_id, lote, quantidade, data_validade, vida_util_dias || null]
      );

      res.json({ success: true, lote: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/recepcao/:id/lote error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 6. GET /rest/v1/recepcao/:id/validacao — Validar receção
  app.get('/rest/v1/recepcao/:id/validacao', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;

      if (!UUID_RE.test(id)) {
        return res.status(400).json({ error: 'Invalid recepcao id' });
      }

      const recepcaoResult = await req.dbClient.query(
        `SELECT id FROM logistics.recepcao WHERE id = $1`,
        [id]
      );
      if (recepcaoResult.rows.length === 0) {
        return res.status(404).json({ error: 'Receção não encontrada' });
      }

      const [documentoResult, divergenciasResult, lotesResult, paletesResult] = await Promise.all([
        req.dbClient.query(`SELECT count(*)::int AS n FROM logistics.recepcao_documento WHERE recepcao_id = $1`, [id]),
        req.dbClient.query(
          `SELECT count(*)::int AS n FROM logistics.recepcao_divergencia WHERE recepcao_id = $1 AND impacto_entrada_artsoft = 'REVISAR'`,
          [id]
        ),
        req.dbClient.query(`SELECT count(*)::int AS n FROM logistics.recepcao_lote WHERE recepcao_id = $1`, [id]),
        req.dbClient.query(
          `SELECT count(*)::int AS total, count(*) FILTER (WHERE localizacao_confirmada IS NOT NULL)::int AS com_localizacao
           FROM logistics.recepcao_palete WHERE recepcao_id = $1`,
          [id]
        ),
      ]);

      const documentoRegistado = documentoResult.rows[0].n > 0;
      const divergenciasNaoResolvidas = divergenciasResult.rows[0].n;
      const lotesRegistados = lotesResult.rows[0].n > 0;
      const paletesTotal = paletesResult.rows[0].total;
      const paletesComLocalizacao = paletesResult.rows[0].com_localizacao;
      const localizacoesDefinidas = paletesTotal === 0 || paletesComLocalizacao === paletesTotal;

      const erros = [];
      if (!documentoRegistado) erros.push('Documento do fornecedor não registado');
      if (paletesTotal > 0 && !localizacoesDefinidas) {
        erros.push(`${paletesTotal - paletesComLocalizacao} palete(s) sem localização definida`);
      }

      const alertas = [];
      if (divergenciasNaoResolvidas > 0) {
        alertas.push(`${divergenciasNaoResolvidas} divergência(s) aguardam resolução`);
      }
      if (!lotesRegistados) {
        alertas.push('Nenhum lote registado para esta receção');
      }

      const validacao = {
        documento_registado: documentoRegistado,
        linhas_conferidas: true,
        divergencias_nao_resolvidas: divergenciasNaoResolvidas,
        lotes_obrigatorios_registados: lotesRegistados,
        localizacoes_definidas: localizacoesDefinidas,
        paletes_criadas: paletesTotal,
        alertas,
        erros,
        valido: erros.length === 0,
      };

      res.json({ success: true, validacao });
    } catch (err) {
      console.error('GET /rest/v1/recepcao/:id/validacao error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 7. GET /rest/v1/recepcao/:id/auditoria — Histórico auditoria
  app.get('/rest/v1/recepcao/:id/auditoria', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;

      if (!UUID_RE.test(id)) {
        return res.status(400).json({ error: 'Invalid recepcao id' });
      }

      const result = await req.dbClient.query(
        `SELECT * FROM logistics.recepcao_auditoria
         WHERE recepcao_id = $1
         ORDER BY criado_em DESC`,
        [id]
      );

      res.json({ success: true, auditoria: result.rows });
    } catch (err) {
      console.error('GET /rest/v1/recepcao/:id/auditoria error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 8. POST /rest/v1/recepcao/:id/finalizar — Finalizar receção
  app.post('/rest/v1/recepcao/:id/finalizar', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;
      const { operador } = req.body;

      if (!UUID_RE.test(id)) {
        return res.status(400).json({ error: 'Invalid recepcao id' });
      }

      const documentoResult = await req.dbClient.query(
        `SELECT count(*)::int AS n FROM logistics.recepcao_documento WHERE recepcao_id = $1`,
        [id]
      );
      if (documentoResult.rows[0].n === 0) {
        return res.status(409).json({ error: 'Não é possível finalizar: documento do fornecedor não registado' });
      }

      const paletesResult = await req.dbClient.query(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE localizacao_confirmada IS NOT NULL)::int AS com_localizacao
         FROM logistics.recepcao_palete WHERE recepcao_id = $1`,
        [id]
      );
      const { total, com_localizacao } = paletesResult.rows[0];
      if (total > 0 && com_localizacao < total) {
        return res.status(409).json({ error: `Não é possível finalizar: ${total - com_localizacao} palete(s) sem localização definida` });
      }

      const result = await req.dbClient.query(
        `UPDATE logistics.recepcao
         SET estado = 'CONCLUIDA', data_conclusao = NOW(), atualizado_em = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Receção não encontrada' });
      }

      res.json({ success: true, recepcao: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/recepcao/:id/finalizar error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 9. POST /rest/v1/palete — Criar palete
  app.post('/rest/v1/palete', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { sscc, recepcao_id, artigo_codigo, quantidade_unidades, quantidade_caixas, operador } = req.body;

      if (!sscc || !UUID_RE.test(recepcao_id)) {
        return res.status(400).json({ error: 'sscc e recepcao_id obrigatórios' });
      }

      const result = await req.dbClient.query(
        `INSERT INTO logistics.recepcao_palete
         (sscc, recepcao_id, artigo_codigo, quantidade_unidades, quantidade_caixas, operador_criacao)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [sscc, recepcao_id, artigo_codigo || null, quantidade_unidades || null, quantidade_caixas || null, operador || null]
      );

      res.json({ success: true, palete: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/palete error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 10. PATCH /rest/v1/palete/:sscc/localizacao — Definir localização palete
  app.patch('/rest/v1/palete/:sscc/localizacao', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { sscc } = req.params;
      const { localizacao, operador } = req.body;

      if (!localizacao) {
        return res.status(400).json({ error: 'localizacao obrigatória' });
      }

      const result = await req.dbClient.query(
        `UPDATE logistics.recepcao_palete
         SET localizacao_confirmada = $1, operador_localizacao = $2, atualizado_em = NOW()
         WHERE sscc = $3
         RETURNING *`,
        [localizacao, operador || null, sscc]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Palete não encontrada' });
      }

      res.json({ success: true, palete: result.rows[0] });
    } catch (err) {
      console.error('PATCH /rest/v1/palete/:sscc/localizacao error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 11. POST /rest/v1/palete/:sscc/movimento — Registar movimento palete
  app.post('/rest/v1/palete/:sscc/movimento', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { sscc } = req.params;
      const { evento, localizacao_anterior, localizacao_nova, operador, observacoes } = req.body;

      if (!evento) {
        return res.status(400).json({ error: 'evento obrigatório' });
      }

      const result = await req.dbClient.query(
        `INSERT INTO logistics.palete_movimento
         (palete_sscc, evento, localizacao_anterior, localizacao_nova, operador, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [sscc, evento, localizacao_anterior || null, localizacao_nova || null, operador || null, observacoes || null]
      );

      res.json({ success: true, movimento: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/palete/:sscc/movimento error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 12. POST /rest/v1/artsoft/entrada — Criar entrada Artsoft
  app.post('/rest/v1/artsoft/entrada', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { recepcao_id, payload } = req.body;

      if (!UUID_RE.test(recepcao_id)) {
        return res.status(400).json({ error: 'recepcao_id obrigatório' });
      }

      const result = await req.dbClient.query(
        `INSERT INTO logistics.recepcao_artsoft_integracao
         (recepcao_id, estado, payload_enviado, tentativas)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [recepcao_id, 'EM_PROCESSAMENTO', JSON.stringify(payload || {}), 1]
      );

      res.json({ success: true, integracao: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/artsoft/entrada error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 13. GET /rest/v1/artsoft/entrada/:id/status — Status integração
  app.get('/rest/v1/artsoft/entrada/:id/status', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;

      if (!UUID_RE.test(id)) {
        return res.status(400).json({ error: 'Invalid id' });
      }

      const result = await req.dbClient.query(
        `SELECT * FROM logistics.recepcao_artsoft_integracao WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Integração não encontrada' });
      }

      res.json({ success: true, integracao: result.rows[0] });
    } catch (err) {
      console.error('GET /rest/v1/artsoft/entrada/:id/status error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 14. POST /rest/v1/artsoft/entrada/:id/retry — Retenta entrada
  app.post('/rest/v1/artsoft/entrada/:id/retry', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;

      if (!UUID_RE.test(id)) {
        return res.status(400).json({ error: 'Invalid id' });
      }

      const result = await req.dbClient.query(
        `UPDATE logistics.recepcao_artsoft_integracao
         SET estado = 'EM_PROCESSAMENTO', tentativas = tentativas + 1, atualizado_em = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Integração não encontrada' });
      }

      res.json({ success: true, integracao: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/artsoft/entrada/:id/retry error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 15. GET /rest/v1/localizacao/sugerida — Localização sugerida
  app.get('/rest/v1/localizacao/sugerida', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const tipo = req.query.tipo || 'picking';
      const limite = Math.min(parseInt(req.query.limit, 10) || 5, 50);

      const result = await req.dbClient.query(
        `SELECT l.id, l.codigo, l.tipo, l.capacidade_paletes
         FROM logistics.localizacao l
         WHERE l.ativa = true
           AND l.tipo = $1
           AND l.codigo NOT IN (
             SELECT localizacao_confirmada FROM logistics.recepcao_palete
             WHERE localizacao_confirmada IS NOT NULL
           )
         ORDER BY l.codigo
         LIMIT $2`,
        [tipo, limite]
      );

      res.json({ success: true, sugestoes: result.rows });
    } catch (err) {
      console.error('GET /rest/v1/localizacao/sugerida error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 16. GET /rest/v1/localizacao/disponivel — Localizações disponíveis
  app.get('/rest/v1/localizacao/disponivel', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const limite = Math.min(parseInt(req.query.limit, 10) || 100, 500);
      const offset = parseInt(req.query.offset, 10) || 0;

      const result = await req.dbClient.query(
        `SELECT l.codigo
         FROM logistics.localizacao l
         WHERE l.ativa = true
           AND l.codigo NOT IN (
             SELECT localizacao_confirmada FROM logistics.recepcao_palete
             WHERE localizacao_confirmada IS NOT NULL
           )
         ORDER BY l.codigo
         LIMIT $1 OFFSET $2`,
        [limite, offset]
      );

      res.json({ success: true, disponveis: result.rows.map((r) => r.codigo) });
    } catch (err) {
      console.error('GET /rest/v1/localizacao/disponivel error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 17. POST /rest/v1/localizacao/alocar — Alocar localização
  app.post('/rest/v1/localizacao/alocar', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { palete_sscc, localizacao, operador } = req.body;

      if (!palete_sscc || !localizacao) {
        return res.status(400).json({ error: 'palete_sscc e localizacao obrigatórios' });
      }

      // Atualizar localização confirmada
      const result = await req.dbClient.query(
        `UPDATE logistics.recepcao_palete
         SET localizacao_confirmada = $1, operador_localizacao = $2, atualizado_em = NOW()
         WHERE sscc = $3
         RETURNING *`,
        [localizacao, operador || null, palete_sscc]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Palete não encontrada' });
      }

      res.json({ success: true, palete: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/localizacao/alocar error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });
}
