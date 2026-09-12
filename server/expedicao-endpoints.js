/**
 * Endpoints para Expedição P4 — Conferência, Rastreamento, Faturação
 * 6 endpoints total, sobre logistics.documento (+ expedicao_conferencia,
 * expedicao_rastreamento, documento_numeracao — ver 022_expedicao_schema.sql)
 */

const ESTADOS_VALIDOS = ['PENDENTE', 'PREPARADA', 'EXPEDIDA', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADA'];

export function setupExpedicaoEndpoints(app, pool, verifyJWT, setEmpresaContext, UUID_RE) {
  // 1. GET /rest/v1/expedicao — Listar expedições
  app.get('/rest/v1/expedicao', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { estado, limit, offset } = req.query;
      const limite = Math.min(parseInt(limit, 10) || 50, 200);
      const desvio = parseInt(offset, 10) || 0;

      const params = [];
      let query = `
        SELECT d.id, d.tipo, d.numero, d.estado, d.data_emissao, d.cliente_id,
               c.nome AS cliente_nome
        FROM logistics.documento d
        LEFT JOIN logistics.cliente c ON c.id = d.cliente_id
        WHERE d.estado != 'PENDENTE'
      `;

      if (estado) {
        if (!ESTADOS_VALIDOS.includes(estado)) {
          return res.status(400).json({ error: `estado inválido. Valores aceites: ${ESTADOS_VALIDOS.join(', ')}` });
        }
        params.push(estado);
        query += ` AND d.estado = $${params.length}`;
      }

      query += ' ORDER BY d.data_emissao DESC';
      params.push(limite);
      query += ` LIMIT $${params.length}`;
      params.push(desvio);
      query += ` OFFSET $${params.length}`;

      const result = await req.dbClient.query(query, params);

      res.json({ success: true, expedicoes: result.rows, limit: limite, offset: desvio });
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

      if (!UUID_RE.test(id) || !palete_sscc || quantidade_conferida === undefined) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes' });
      }

      const docResult = await req.dbClient.query(`SELECT id FROM logistics.documento WHERE id = $1`, [id]);
      if (docResult.rows.length === 0) {
        return res.status(404).json({ error: 'Documento de expedição não encontrado' });
      }

      const result = await req.dbClient.query(
        `INSERT INTO logistics.expedicao_conferencia
         (documento_id, palete_sscc, quantidade_conferida, observacoes, operador)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, palete_sscc, quantidade_conferida, observacoes || null, operador || null]
      );

      res.json({ success: true, conferencia: result.rows[0] });
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

      const docResult = await req.dbClient.query(`SELECT id FROM logistics.documento WHERE id = $1`, [id]);
      if (docResult.rows.length === 0) {
        return res.status(404).json({ error: 'Documento de expedição não encontrado' });
      }

      const result = await req.dbClient.query(
        `INSERT INTO logistics.expedicao_rastreamento
         (documento_id, evento, localizacao, descricao, operador)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [id, evento, localizacao || null, descricao, operador || null]
      );

      res.json({ success: true, rastreamento: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/expedicao/:id/rastreamento error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 4. POST /rest/v1/expedicao/:id/documento — Emitir documento (guia/fatura)
  app.post('/rest/v1/expedicao/:id/documento', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params;
      const { tipo, serie } = req.body;
      const empresaId = req.user?.empresa_id;

      if (!UUID_RE.test(id) || !tipo || !serie) {
        return res.status(400).json({ error: 'Parâmetros obrigatórios ausentes' });
      }

      const docResult = await req.dbClient.query(`SELECT id FROM logistics.documento WHERE id = $1`, [id]);
      if (docResult.rows.length === 0) {
        return res.status(404).json({ error: 'Documento de expedição não encontrado' });
      }

      // Numeração sequencial real por empresa+série+tipo — nunca Math.random()
      // para numeração fiscal (022_expedicao_schema.sql)
      const numeroResult = await req.dbClient.query(
        `SELECT logistics.proximo_numero_documento($1, $2, $3::tipo_documento) AS numero`,
        [empresaId, serie, tipo]
      );
      const numeroSequencial = numeroResult.rows[0].numero;
      const numeroFormatado = `${serie}/${numeroSequencial}`;

      const result = await req.dbClient.query(
        `UPDATE logistics.documento
         SET numero = $1, estado = 'PREPARADA'
         WHERE id = $2
         RETURNING *`,
        [numeroFormatado, id]
      );

      res.json({
        success: true,
        documento: {
          ...result.rows[0],
          url_download: `/documentos/${id}/${tipo}/${numeroFormatado}.pdf`,
        },
      });
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
      const { novo_status, motivo, operador, localizacao } = req.body;

      if (!UUID_RE.test(id) || !novo_status) {
        return res.status(400).json({ error: 'id e novo_status obrigatórios' });
      }
      if (!ESTADOS_VALIDOS.includes(novo_status)) {
        return res.status(400).json({ error: `novo_status inválido. Valores aceites: ${ESTADOS_VALIDOS.join(', ')}` });
      }

      const anteriorResult = await req.dbClient.query(`SELECT estado FROM logistics.documento WHERE id = $1`, [id]);
      if (anteriorResult.rows.length === 0) {
        return res.status(404).json({ error: 'Documento de expedição não encontrado' });
      }
      const estadoAnterior = anteriorResult.rows[0].estado;

      const result = await req.dbClient.query(
        `UPDATE logistics.documento SET estado = $1 WHERE id = $2 RETURNING *`,
        [novo_status, id]
      );

      // Regista a transição no rastreamento para manter histórico consistente
      await req.dbClient.query(
        `INSERT INTO logistics.expedicao_rastreamento (documento_id, evento, localizacao, descricao, operador)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, novo_status, localizacao || null, motivo || `Estado alterado de ${estadoAnterior} para ${novo_status}`, operador || null]
      );

      res.json({
        success: true,
        expedicao: {
          id,
          estado_anterior: estadoAnterior,
          estado_novo: novo_status,
          motivo: motivo || null,
          data_atualizacao: result.rows[0].data_emissao,
        },
      });
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

      const [docResult, paletesResult, rastreamentoResult, conferenciaResult] = await Promise.all([
        req.dbClient.query(
          `SELECT d.*, c.nome AS cliente_nome, f.nome AS fornecedor_nome
           FROM logistics.documento d
           LEFT JOIN logistics.cliente c ON c.id = d.cliente_id
           LEFT JOIN logistics.fornecedor f ON f.id = d.fornecedor_id
           WHERE d.id = $1`,
          [id]
        ),
        req.dbClient.query(`SELECT sscc FROM logistics.palete WHERE documento_expedicao_id = $1`, [id]),
        req.dbClient.query(
          `SELECT * FROM logistics.expedicao_rastreamento WHERE documento_id = $1 ORDER BY criado_em DESC`,
          [id]
        ),
        req.dbClient.query(
          `SELECT * FROM logistics.expedicao_conferencia WHERE documento_id = $1 ORDER BY criado_em DESC`,
          [id]
        ),
      ]);

      if (docResult.rows.length === 0) {
        return res.status(404).json({ error: 'Documento de expedição não encontrado' });
      }

      res.json({
        success: true,
        expedicao: {
          ...docResult.rows[0],
          paletes: paletesResult.rows,
          rastreamento: rastreamentoResult.rows,
          conferencias: conferenciaResult.rows,
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
