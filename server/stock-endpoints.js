/**
 * Endpoints para Stock P3 — Reconciliação, FEFO, Localização
 * 6 endpoints total
 */

export function setupStockEndpoints(app, pool, verifyJWT, setEmpresaContext, UUID_RE) {
  // 1. POST /rest/v1/stock/reconciliar — Validar stock vs receção
  app.post('/rest/v1/stock/reconciliar', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { recepcao_id, items } = req.body;

      if (!UUID_RE.test(recepcao_id) || !Array.isArray(items)) {
        return res.status(400).json({ error: 'recepcao_id e items array obrigatórios' });
      }

      const reconciliacao = {
        recepcao_id,
        items_reconciliados: items,
        total_esperado: items.reduce((sum, i) => sum + i.quantidade_esperada, 0),
        total_fisico: items.reduce((sum, i) => sum + i.quantidade_fisica, 0),
        diferenca_total: 0,
        status: 'CONCLUIDA',
        operador: 'SISTEMA',
        timestamp: new Date().toISOString(),
      };

      reconciliacao.diferenca_total = reconciliacao.total_fisico - reconciliacao.total_esperado;

      // Salvar reconciliação (seria em tabela stock_reconciliacao)
      res.json({ success: true, reconciliacao });
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
      const hoje = new Date();
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
         LIMIT 100`
      );

      res.json({ success: true, lotes: result.rows });
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
      const { novo_status, motivo } = req.body;

      if (!novo_status) {
        return res.status(400).json({ error: 'novo_status obrigatório' });
      }

      // TODO: Implementar atualização status lote
      res.json({
        success: true,
        message: 'Status lote atualizado (não implementado ainda)',
      });
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
      const result = await req.dbClient.query(
        `SELECT
          localizacao_confirmada as localizacao,
          artigo_codigo,
          COUNT(sscc) as numero_paletes,
          SUM(quantidade_caixas) as total_caixas
         FROM logistics.recepcao_palete
         WHERE localizacao_confirmada IS NOT NULL
         GROUP BY localizacao_confirmada, artigo_codigo
         ORDER BY localizacao_confirmada ASC`
      );

      res.json({ success: true, localizacoes: result.rows });
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
         LIMIT 50`
      );

      res.json({ success: true, divergencias: result.rows });
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

      if (!tipo || !descricao) {
        return res.status(400).json({ error: 'tipo e descricao obrigatórios' });
      }

      // TODO: Implementar gravação alerta em tabela stock_alerta
      const alerta = {
        id: `ALT-${Date.now()}`,
        tipo,
        descricao,
        severidade: severidade || 'MEDIA',
        artigo_codigo: artigo_codigo || null,
        quantidade: quantidade || null,
        operador: operador || 'SISTEMA',
        status: 'ABERTO',
        criado_em: new Date().toISOString(),
      };

      res.json({ success: true, alerta });
    } catch (err) {
      console.error('POST /rest/v1/stock/alerta error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });
}
