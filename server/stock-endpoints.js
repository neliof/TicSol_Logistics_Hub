/**
 * Endpoints para Stock P3 — Reconciliação, FEFO, Localização
 * 6 endpoints total
 */

export function setupStockEndpoints(app, pool, verifyJWT, setEmpresaContext, UUID_RE) {
  // 1. POST /rest/v1/stock/reconciliar — Validar stock vs receção
  app.post('/rest/v1/stock/reconciliar', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { recepcao_id, items, operador } = req.body;

      if (!UUID_RE.test(recepcao_id) || !Array.isArray(items)) {
        return res.status(400).json({ error: 'recepcao_id e items array obrigatórios' });
      }

      const totalEsperado = items.reduce((sum, i) => sum + Number(i.quantidade_esperada || 0), 0);
      const totalFisico = items.reduce((sum, i) => sum + Number(i.quantidade_fisica || 0), 0);
      const diferencaTotal = totalFisico - totalEsperado;

      const result = await req.dbClient.query(
        `INSERT INTO logistics.stock_reconciliacao
         (recepcao_id, total_esperado, total_fisico, diferenca_total, items_reconciliados, operador)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [recepcao_id, totalEsperado, totalFisico, diferencaTotal, JSON.stringify(items), operador || 'SISTEMA']
      );

      res.json({ success: true, reconciliacao: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/stock/reconciliar error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 2. GET /rest/v1/stock/lotes/fefo — Listar lotes por FEFO
  app.get('/rest/v1/stock/lotes/fefo', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const limite = Math.min(parseInt(req.query.limit, 10) || 100, 500);
      const offset = parseInt(req.query.offset, 10) || 0;

      const result = await req.dbClient.query(
        `SELECT
          lote,
          artigo_codigo,
          SUM(quantidade) as quantidade,
          data_validade,
          EXTRACT(DAY FROM (data_validade - NOW())) as dias_restantes,
          CASE
            WHEN data_validade < NOW() THEN 'CRITICO'
            WHEN data_validade < NOW() + INTERVAL '3 days' THEN 'CRITICO'
            WHEN data_validade < NOW() + INTERVAL '7 days' THEN 'ALERTA'
            ELSE 'OK'
          END as status
         FROM logistics.recepcao_lote
         GROUP BY lote, artigo_codigo, data_validade
         ORDER BY data_validade ASC
         LIMIT $1 OFFSET $2`,
        [limite, offset]
      );

      res.json({ success: true, lotes: result.rows, limit: limite, offset });
    } catch (err) {
      console.error('GET /rest/v1/stock/lotes/fefo error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 3. PATCH /rest/v1/stock/lote/:id/status — Atualizar status lote
  app.patch('/rest/v1/stock/lote/:id/status', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;
      const { novo_status } = req.body;
      const ESTADOS_VALIDOS = ['OK', 'QUARENTENA', 'BLOQUEADO', 'CONSUMIDO'];

      if (!UUID_RE.test(id) || !novo_status) {
        return res.status(400).json({ error: 'id e novo_status obrigatórios' });
      }
      if (!ESTADOS_VALIDOS.includes(novo_status)) {
        return res.status(400).json({ error: `novo_status inválido. Valores aceites: ${ESTADOS_VALIDOS.join(', ')}` });
      }

      const result = await req.dbClient.query(
        `UPDATE logistics.recepcao_lote SET status = $1 WHERE id = $2 RETURNING *`,
        [novo_status, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lote não encontrado' });
      }

      res.json({ success: true, lote: result.rows[0] });
    } catch (err) {
      console.error('PATCH /rest/v1/stock/lote/:id/status error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 4. GET /rest/v1/stock/localizacoes — Listar por localização
  app.get('/rest/v1/stock/localizacoes', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const limite = Math.min(parseInt(req.query.limit, 10) || 100, 500);
      const offset = parseInt(req.query.offset, 10) || 0;

      const result = await req.dbClient.query(
        `SELECT
          localizacao_confirmada as localizacao,
          artigo_codigo,
          COUNT(sscc) as numero_paletes,
          SUM(quantidade_caixas) as total_caixas
         FROM logistics.recepcao_palete
         WHERE localizacao_confirmada IS NOT NULL
         GROUP BY localizacao_confirmada, artigo_codigo
         ORDER BY localizacao_confirmada ASC
         LIMIT $1 OFFSET $2`,
        [limite, offset]
      );

      res.json({ success: true, localizacoes: result.rows, limit: limite, offset });
    } catch (err) {
      console.error('GET /rest/v1/stock/localizacoes error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 5. GET /rest/v1/stock/divergencias — Listar discrepâncias
  app.get('/rest/v1/stock/divergencias', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const limite = Math.min(parseInt(req.query.limit, 10) || 50, 200);
      const offset = parseInt(req.query.offset, 10) || 0;

      const result = await req.dbClient.query(
        `SELECT
          rd.id,
          rd.recepcao_id,
          rd.linha_id,
          rd.tipo,
          rd.quantidade,
          rd.motivo,
          rd.impacto_entrada_artsoft,
          rd.operador,
          rd.criado_em
         FROM logistics.recepcao_divergencia rd
         WHERE rd.impacto_entrada_artsoft != 'ACEITAR'
         ORDER BY rd.criado_em DESC
         LIMIT $1 OFFSET $2`,
        [limite, offset]
      );

      res.json({ success: true, divergencias: result.rows, limit: limite, offset });
    } catch (err) {
      console.error('GET /rest/v1/stock/divergencias error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 6. POST /rest/v1/stock/alerta — Criar alerta
  app.post('/rest/v1/stock/alerta', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { tipo, descricao, severidade, artigo_codigo, quantidade, operador } = req.body;
      const empresaId = req.user?.empresa_id;

      if (!tipo || !descricao) {
        return res.status(400).json({ error: 'tipo e descricao obrigatórios' });
      }

      const result = await req.dbClient.query(
        `INSERT INTO logistics.stock_alerta
         (empresa_id, tipo, descricao, severidade, artigo_codigo, quantidade, operador)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [empresaId, tipo, descricao, severidade || 'MEDIA', artigo_codigo || null, quantidade || null, operador || 'SISTEMA']
      );

      res.json({ success: true, alerta: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/stock/alerta error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });
}
