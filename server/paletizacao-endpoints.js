/**
 * Endpoints para Paletização P2 — Múltiplas, Gestão, Consolidação
 * 8 endpoints total
 */

export function setupPaletizacaoEndpoints(app, pool, verifyJWT, setEmpresaContext, UUID_RE) {
  // 1. POST /rest/v1/palete/multiplas — Criar múltiplas paletes
  app.post('/rest/v1/palete/multiplas', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { recepcao_id, configuracoes } = req.body;

      if (!UUID_RE.test(recepcao_id) || !Array.isArray(configuracoes)) {
        return res.status(400).json({ error: 'recepcao_id e configuracoes array obrigatórios' });
      }

      const paletes = [];

      for (const config of configuracoes) {
        const { linha_id, artigo_codigo, quantidade_por_palete, quantidade_unidades_por_palete } = config;

        // Gerar SSCCs sequenciais
        const baseSSCC = `${Date.now()}`;
        let numero = 0;

        // Calcular número de paletes
        const qtdRecebida = config.quantidade_total_recebida || quantidade_por_palete;
        const numeroPaletes = Math.ceil(qtdRecebida / quantidade_por_palete);

        for (let i = 0; i < numeroPaletes; i++) {
          const sscc = `${baseSSCC}-${linha_id.slice(0, 4)}-${String(numero).padStart(3, '0')}`;
          numero++;

          const qtdCaixasEsta = Math.min(quantidade_por_palete, qtdRecebida - i * quantidade_por_palete);

          const result = await req.dbClient.query(
            `INSERT INTO logistics.recepcao_palete
             (sscc, recepcao_id, artigo_codigo, quantidade_caixas, quantidade_unidades, operador_criacao)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [sscc, recepcao_id, artigo_codigo, qtdCaixasEsta, quantidade_unidades_por_palete || 0, 'SISTEMA']
          );

          paletes.push(result.rows[0]);
        }
      }

      res.json({ success: true, paletes });
    } catch (err) {
      console.error('POST /rest/v1/palete/multiplas error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 2. PATCH /rest/v1/palete/:sscc/item — Adicionar item
  app.patch('/rest/v1/palete/:sscc/item', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { sscc } = req.params;
      const { artigo_codigo, quantidade_caixas, quantidade_unidades } = req.body;

      if (!artigo_codigo || !quantidade_caixas) {
        return res.status(400).json({ error: 'artigo_codigo e quantidade_caixas obrigatórios' });
      }

      // TODO: Implementar lógica de adicionar item (pode ser JSON array ou nova linha)
      res.json({ success: true, message: 'Item adicionado (não implementado ainda)' });
    } catch (err) {
      console.error('PATCH /rest/v1/palete/:sscc/item error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 3. DELETE /rest/v1/palete/:sscc/item/:linhaId — Remover item
  app.delete('/rest/v1/palete/:sscc/item/:linhaId', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { sscc, linhaId } = req.params;

      // TODO: Implementar lógica de remover item
      res.json({ success: true, message: 'Item removido (não implementado ainda)' });
    } catch (err) {
      console.error('DELETE /rest/v1/palete/:sscc/item error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 4. POST /rest/v1/palete/:sscc/dividir — Dividir palete
  app.post('/rest/v1/palete/:sscc/dividir', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { sscc } = req.params;
      const { novoSSCC, itemsMudar, operador } = req.body;

      if (!novoSSCC) {
        return res.status(400).json({ error: 'novoSSCC obrigatório' });
      }

      // Recuperar palete original
      const palete = await req.dbClient.query(
        'SELECT * FROM logistics.recepcao_palete WHERE sscc = $1',
        [sscc]
      );

      if (palete.rows.length === 0) {
        return res.status(404).json({ error: 'Palete não encontrada' });
      }

      // Criar nova palete com items
      const result = await req.dbClient.query(
        `INSERT INTO logistics.recepcao_palete
         (sscc, recepcao_id, artigo_codigo, quantidade_caixas, operador_criacao)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [novoSSCC, palete.rows[0].recepcao_id, palete.rows[0].artigo_codigo, 0, operador || 'SISTEMA']
      );

      // Registar movimento
      await req.dbClient.query(
        `INSERT INTO logistics.palete_movimento
         (palete_sscc, evento, operador, observacoes)
         VALUES ($1, $2, $3, $4)`,
        [sscc, 'DIVIDIDA', operador || 'SISTEMA', `Origem de nova palete ${novoSSCC}`]
      );

      res.json({ success: true, paletesNova: result.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/palete/:sscc/dividir error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 5. POST /rest/v1/palete/consolidar — Consolidar múltiplas
  app.post('/rest/v1/palete/consolidar', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { ssccOrigem, novoSSCC, operador } = req.body;

      if (!Array.isArray(ssccOrigem) || ssccOrigem.length < 2 || !novoSSCC) {
        return res.status(400).json({ error: 'ssccOrigem array (min 2) e novoSSCC obrigatórios' });
      }

      // Recuperar primeira palete para contexto
      const primeiraResult = await req.dbClient.query(
        'SELECT * FROM logistics.recepcao_palete WHERE sscc = $1',
        [ssccOrigem[0]]
      );

      if (primeiraResult.rows.length === 0) {
        return res.status(404).json({ error: 'Palete de origem não encontrada' });
      }

      // Somar quantidades
      let totalCaixas = 0;
      let totalUnidades = 0;

      for (const sscc of ssccOrigem) {
        const result = await req.dbClient.query(
          'SELECT quantidade_caixas, quantidade_unidades FROM logistics.recepcao_palete WHERE sscc = $1',
          [sscc]
        );
        if (result.rows.length > 0) {
          totalCaixas += result.rows[0].quantidade_caixas;
          totalUnidades += result.rows[0].quantidade_unidades;
        }
      }

      // Criar nova palete consolidada
      const consolidada = await req.dbClient.query(
        `INSERT INTO logistics.recepcao_palete
         (sscc, recepcao_id, artigo_codigo, quantidade_caixas, quantidade_unidades, operador_criacao)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          novoSSCC,
          primeiraResult.rows[0].recepcao_id,
          primeiraResult.rows[0].artigo_codigo,
          totalCaixas,
          totalUnidades,
          operador || 'SISTEMA',
        ]
      );

      // Registar movimentos
      for (const sscc of ssccOrigem) {
        await req.dbClient.query(
          `INSERT INTO logistics.palete_movimento
           (palete_sscc, evento, operador, observacoes)
           VALUES ($1, $2, $3, $4)`,
          [sscc, 'CONSOLIDADA', operador || 'SISTEMA', `Consolidada em ${novoSSCC}`]
        );
      }

      res.json({ success: true, palete: consolidada.rows[0] });
    } catch (err) {
      console.error('POST /rest/v1/palete/consolidar error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 6. GET /rest/v1/palete/:sscc/status — Status palete
  app.get('/rest/v1/palete/:sscc/status', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { sscc } = req.params;

      const resultado = await req.dbClient.query(
        `SELECT p.*, COUNT(m.id) as numero_movimentos
         FROM logistics.recepcao_palete p
         LEFT JOIN logistics.palete_movimento m ON m.palete_sscc = p.sscc
         WHERE p.sscc = $1
         GROUP BY p.sscc`,
        [sscc]
      );

      if (resultado.rows.length === 0) {
        return res.status(404).json({ error: 'Palete não encontrada' });
      }

      // Recuperar movimentos
      const movimentos = await req.dbClient.query(
        `SELECT * FROM logistics.palete_movimento WHERE palete_sscc = $1 ORDER BY evento_em DESC`,
        [sscc]
      );

      res.json({
        success: true,
        palete: resultado.rows[0],
        movimentos: movimentos.rows,
      });
    } catch (err) {
      console.error('GET /rest/v1/palete/:sscc/status error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 7. PATCH /rest/v1/palete/:sscc/conteudo — Editar conteúdo
  app.patch('/rest/v1/palete/:sscc/conteudo', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { sscc } = req.params;
      const { quantidade_caixas, quantidade_unidades, operador } = req.body;

      if (quantidade_caixas === undefined || quantidade_unidades === undefined) {
        return res.status(400).json({ error: 'quantidade_caixas e quantidade_unidades obrigatórias' });
      }

      const result = await req.dbClient.query(
        `UPDATE logistics.recepcao_palete
         SET quantidade_caixas = $1, quantidade_unidades = $2, atualizado_em = NOW()
         WHERE sscc = $3
         RETURNING *`,
        [quantidade_caixas, quantidade_unidades, sscc]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Palete não encontrada' });
      }

      // Registar movimento
      await req.dbClient.query(
        `INSERT INTO logistics.palete_movimento
         (palete_sscc, evento, quantidade_anterior, quantidade_nova, operador, observacoes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          sscc,
          'MOVIDA',
          result.rows[0].quantidade_caixas,
          quantidade_caixas,
          operador || 'SISTEMA',
          'Conteúdo editado',
        ]
      );

      res.json({ success: true, palete: result.rows[0] });
    } catch (err) {
      console.error('PATCH /rest/v1/palete/:sscc/conteudo error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });

  // 8. GET /rest/v1/palete/disponivel — Paletes disponíveis
  app.get('/rest/v1/palete/disponivel', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const result = await req.dbClient.query(
        `SELECT sscc, artigo_codigo, quantidade_caixas, localizacao_confirmada
         FROM logistics.recepcao_palete
         WHERE localizacao_confirmada IS NOT NULL
         ORDER BY atualizado_em DESC
         LIMIT 100`
      );

      res.json({ success: true, paletes: result.rows });
    } catch (err) {
      console.error('GET /rest/v1/palete/disponivel error:', err.message);
      res.status(400).json({ error: err.message });
    } finally {
      if (req.dbClient) req.dbClient.release();
    }
  });
}
