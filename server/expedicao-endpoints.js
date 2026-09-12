/**
 * Endpoints para Expedição P4 — Conferência, Rastreamento, Faturação
 * 6 endpoints total
 */

export function setupExpedicaoEndpoints(app, pool, verifyJWT, setEmpresaContext, UUID_RE) {
  // 1. GET /rest/v1/expedicao — Listar expedições
  app.get('/rest/v1/expedicao', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { status, limite } = req.query;
      let query = 'SELECT * FROM logistics.recepcao WHERE estado >= $1';
      const params = ['CONCLUIDA'];

      if (status) {
        query += ' AND estado = $2';
        params.push(status);
      }

      query += ' ORDER BY atualizado_em DESC LIMIT $' + (params.length + 1);
      params.push(parseInt(limite) || 50);

      const result = await req.dbClient.query(query, params);

      res.json({ success: true, expedicoes: result.rows });
    } catch (err) {
      console.error('GET /rest/v1/expedicao error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 2. POST /rest/v1/expedicao/:id/conferencia — Registar conferência
  app.post('/rest/v1/expedicao/:id/conferencia', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;
      const { palete_sscc, quantidade_conferida, observacoes, operador } = req.body;

      if (!UUID_RE.test(id) || !palete_sscc || !quantidade_conferida) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes' });
      }

      // TODO: Atualizar palete_movimento com evento CONFERIDA
      const result = {
        palete_sscc,
        quantidade_conferida,
        observacoes: observacoes || null,
        operador: operador || 'SISTEMA',
        data_conferencia: new Date().toISOString(),
      };

      res.json({ success: true, conferencia: result });
    } catch (err) {
      console.error('POST /rest/v1/expedicao/:id/conferencia error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 3. POST /rest/v1/expedicao/:id/rastreamento — Registar evento rastreamento
  app.post('/rest/v1/expedicao/:id/rastreamento', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;
      const { evento, localizacao, descricao, operador } = req.body;

      if (!UUID_RE.test(id) || !evento || !descricao) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes' });
      }

      // TODO: Implementar registro em tabela expedicao_rastreamento
      const rastreamento = {
        id: `TRK-${Date.now()}`,
        expedicao_id: id,
        evento,
        localizacao: localizacao || null,
        descricao,
        operador: operador || 'SISTEMA',
        data_hora: new Date().toISOString(),
      };

      res.json({ success: true, rastreamento });
    } catch (err) {
      console.error('POST /rest/v1/expedicao/:id/rastreamento error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 4. POST /rest/v1/expedicao/:id/documento — Emitir documento
  app.post('/rest/v1/expedicao/:id/documento', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;
      const { tipo, serie, valor_total, moeda } = req.body;

      if (!UUID_RE.test(id) || !tipo || !serie) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes' });
      }

      // TODO: Gerar número sequencial e criar documento
      const numero = `${Math.floor(Math.random() * 1000000)}`;
      const documento = {
        id: `DOC-${Date.now()}`,
        expedicao_id: id,
        tipo,
        numero,
        serie,
        data_emissao: new Date().toISOString(),
        estado: 'EMITIDA',
        valor_total: valor_total || null,
        moeda: moeda || 'EUR',
        url_download: `/documentos/${id}/${tipo}/${numero}.pdf`,
      };

      res.json({ success: true, documento });
    } catch (err) {
      console.error('POST /rest/v1/expedicao/:id/documento error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 5. PATCH /rest/v1/expedicao/:id/status — Atualizar status
  app.patch('/rest/v1/expedicao/:id/status', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;
      const { novo_status, motivo } = req.body;

      if (!UUID_RE.test(id) || !novo_status) {
        return res.status(400).json({ error: 'id e novo_status obrigatórios' });
      }

      // TODO: Atualizar estado recepcao
      const result = {
        id,
        estado_anterior: 'CONCLUIDA',
        estado_novo: novo_status,
        motivo: motivo || null,
        data_atualizacao: new Date().toISOString(),
      };

      res.json({ success: true, expedicao: result });
    } catch (err) {
      console.error('PATCH /rest/v1/expedicao/:id/status error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 6. GET /rest/v1/expedicao/:id — Detalhe expedição
  app.get('/rest/v1/expedicao/:id', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;

      if (!UUID_RE.test(id)) {
        return res.status(400).json({ error: 'Invalid expedicao id' });
      }

      // TODO: Query completa com paletes, rastreamento, documentos
      res.json({
        success: true,
        expedicao: {
          id,
          numero_guia: 'GR/12345',
          fornecedor: 'Fornecedor X',
          estado: 'EXPEDIDA',
          paletes: [],
          rastreamento: [],
          documentos: [],
        },
      });
    } catch (err) {
      console.error('GET /rest/v1/expedicao/:id error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });
}
