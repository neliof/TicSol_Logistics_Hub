/**
 * Endpoints para Palete de Expedição e Carga/Embarque (P4).
 *
 * Usa o schema principal já existente (logistics.palete, logistics.caixa,
 * logistics.carga) em vez de tabelas genéricas próprias — decisão tomada
 * ao ligar o frontend (ExpedicaoModule/useExpedicaoData) aos tipos ricos
 * PaletaExpedicao/ComprovanteEmbarque (ver database/027_expedicao_paletes_carga.sql).
 */

const ESTADOS_PALETE = ['em_preparacao', 'filmada', 'cintada', 'em_armazem', 'em_carga', 'expedida', 'recebida', 'rejeitada']
const ESTADOS_CARGA = ['em_preparacao', 'carregada', 'em_transito', 'entregue', 'com_rejeicao']

export function setupExpedicaoPaletesEndpoints(app, pool, verifyJWT, setEmpresaContext, UUID_RE) {
  // POST /rest/v1/palete-expedicao — Criar palete de expedição com produtos
  app.post('/rest/v1/palete-expedicao', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const {
        cliente_id,
        encomenda_id,
        fluxo,
        padrao,
        tipo,
        temperatura_zona,
        peso_kg,
        altura_mm,
        comprimento_mm,
        largura_mm,
        ti,
        hi,
        operador_id,
        produtos, // [{ produto_id, lote_id?, quantidade, peso_real_kg? }]
      } = req.body
      const empresaId = req.user?.empresa_id

      if (!fluxo || !Array.isArray(produtos) || produtos.length === 0) {
        return res.status(400).json({ error: 'fluxo e produtos (array não vazio) obrigatórios' })
      }
      if (temperatura_zona && !['AMBIENTE', 'FRESCO', 'CONGELADO'].includes(temperatura_zona)) {
        return res.status(400).json({ error: 'temperatura_zona inválida' })
      }

      const ssccResult = await req.dbClient.query('SELECT logistics.gerar_sscc($1) AS sscc', [empresaId])
      const sscc = ssccResult.rows[0].sscc

      const paleteResult = await req.dbClient.query(
        `INSERT INTO logistics.palete
         (empresa_id, sscc, tipo, padrao, fluxo, temperatura_zona, ti, hi, peso_kg,
          altura_mm, comprimento_mm, largura_mm, cliente_id, encomenda_id, operador_id, estado)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'em_preparacao')
         RETURNING *`,
        [
          empresaId, sscc, tipo || 'europalete', padrao || 'mono_produto', fluxo, temperatura_zona || null,
          ti || null, hi || null, peso_kg || null, altura_mm || null, comprimento_mm || null, largura_mm || null,
          cliente_id || null, encomenda_id || null, operador_id || null,
        ]
      )
      const palete = paleteResult.rows[0]

      // Bulk insert das caixas (produtos) da palete via unnest — 1 round-trip
      const produtoIds = produtos.map((p) => p.produto_id)
      const loteIds = produtos.map((p) => p.lote_id || null)
      const quantidades = produtos.map((p) => p.quantidade)
      const pesos = produtos.map((p) => p.peso_real_kg || null)

      const caixasResult = await req.dbClient.query(
        `INSERT INTO logistics.caixa (empresa_id, produto_id, lote_id, quantidade, peso_real_kg, palete_id)
         SELECT $1, produto_id, lote_id, quantidade, peso_real_kg, $2
         FROM unnest($3::uuid[], $4::uuid[], $5::numeric[], $6::numeric[])
           AS t(produto_id, lote_id, quantidade, peso_real_kg)
         RETURNING *`,
        [empresaId, palete.id, produtoIds, loteIds, quantidades, pesos]
      )

      res.json({ success: true, palete: { ...palete, produtos: caixasResult.rows } })
    } catch (err) {
      console.error('POST /rest/v1/palete-expedicao error:', err.message)
      res.status(400).json({ error: err.message })
    } finally {
      if (req.dbClient) req.dbClient.release()
    }
  })

  // PATCH /rest/v1/palete-expedicao/:id/estado — Atualizar estado da palete
  app.patch('/rest/v1/palete-expedicao/:id/estado', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params
      const { novo_estado } = req.body

      if (!UUID_RE.test(id) || !novo_estado) {
        return res.status(400).json({ error: 'id e novo_estado obrigatórios' })
      }
      if (!ESTADOS_PALETE.includes(novo_estado)) {
        return res.status(400).json({ error: `novo_estado inválido. Valores aceites: ${ESTADOS_PALETE.join(', ')}` })
      }

      const result = await req.dbClient.query(
        `UPDATE logistics.palete SET estado = $1 WHERE id = $2 RETURNING *`,
        [novo_estado, id]
      )
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Palete não encontrada' })
      }

      res.json({ success: true, palete: result.rows[0] })
    } catch (err) {
      console.error('PATCH /rest/v1/palete-expedicao/:id/estado error:', err.message)
      res.status(400).json({ error: err.message })
    } finally {
      if (req.dbClient) req.dbClient.release()
    }
  })

  // GET /rest/v1/palete-expedicao/disponivel — Paletes prontas, sem carga associada
  app.get('/rest/v1/palete-expedicao/disponivel', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const limite = Math.min(parseInt(req.query.limit, 10) || 100, 500)
      const offset = parseInt(req.query.offset, 10) || 0

      const result = await req.dbClient.query(
        `SELECT * FROM logistics.palete
         WHERE carga_id IS NULL AND estado IN ('em_armazem', 'cintada', 'filmada')
         ORDER BY data_criacao DESC
         LIMIT $1 OFFSET $2`,
        [limite, offset]
      )

      res.json({ success: true, paletes: result.rows, limit: limite, offset })
    } catch (err) {
      console.error('GET /rest/v1/palete-expedicao/disponivel error:', err.message)
      res.status(400).json({ error: err.message })
    } finally {
      if (req.dbClient) req.dbClient.release()
    }
  })

  // POST /rest/v1/carga — Criar embarque (Comprovante de Embarque)
  app.post('/rest/v1/carga', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const {
        armazem_id,
        viatura_id,
        transportadora_id,
        motorista_id,
        // Texto livre — usado quando ainda não há UI de seleção de
        // entidades existentes; faz upsert por nome/matrícula em vez de
        // exigir que o cliente já tenha o UUID.
        transportadora_nome,
        matricula_veiculo,
        motorista_nome,
        motorista_contacto,
        paletes_sscc, // array de SSCC a associar a esta carga
        operador_embarque,
      } = req.body
      const empresaId = req.user?.empresa_id

      if (!armazem_id || !Array.isArray(paletes_sscc) || paletes_sscc.length === 0) {
        return res.status(400).json({ error: 'armazem_id e paletes_sscc (array não vazio) obrigatórios' })
      }

      let transportadoraId = transportadora_id || null
      if (!transportadoraId && transportadora_nome) {
        const t = await req.dbClient.query(
          `INSERT INTO logistics.transportadora (empresa_id, nome)
           VALUES ($1, $2)
           ON CONFLICT (empresa_id, nome) DO UPDATE SET nome = EXCLUDED.nome
           RETURNING id`,
          [empresaId, transportadora_nome]
        )
        transportadoraId = t.rows[0].id
      }

      let viaturaId = viatura_id || null
      if (!viaturaId && matricula_veiculo && transportadoraId) {
        const v = await req.dbClient.query(
          `INSERT INTO logistics.viatura (transportadora_id, matricula)
           VALUES ($1, $2)
           ON CONFLICT (transportadora_id, matricula) DO UPDATE SET matricula = EXCLUDED.matricula
           RETURNING id`,
          [transportadoraId, matricula_veiculo]
        )
        viaturaId = v.rows[0]?.id || null
      }

      let motoristaId = motorista_id || null
      if (!motoristaId && motorista_nome) {
        const m = await req.dbClient.query(
          `INSERT INTO logistics.motorista (transportadora_id, nome, contacto)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [transportadoraId, motorista_nome, motorista_contacto || null]
        )
        motoristaId = m.rows[0].id
      }

      const cargaResult = await req.dbClient.query(
        `INSERT INTO logistics.carga
         (empresa_id, armazem_id, viatura_id, transportadora_id, motorista_id, operador_embarque, data_hora_carga, estado)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'carregada')
         RETURNING *`,
        [empresaId, armazem_id, viaturaId, transportadoraId, motoristaId, operador_embarque || null]
      )
      const carga = cargaResult.rows[0]

      const paletesResult = await req.dbClient.query(
        `UPDATE logistics.palete
         SET carga_id = $1, estado = 'em_carga', data_expedicao = NOW()
         WHERE sscc = ANY($2)
         RETURNING sscc, peso_kg`,
        [carga.id, paletes_sscc]
      )

      if (paletesResult.rows.length === 0) {
        // Nenhuma palete encontrada — reverter a carga para não ficar órfã
        await req.dbClient.query('DELETE FROM logistics.carga WHERE id = $1', [carga.id])
        return res.status(404).json({ error: 'Nenhuma das paletes indicadas foi encontrada' })
      }

      res.json({ success: true, carga: { ...carga, paletes: paletesResult.rows } })
    } catch (err) {
      console.error('POST /rest/v1/carga error:', err.message)
      res.status(400).json({ error: err.message })
    } finally {
      if (req.dbClient) req.dbClient.release()
    }
  })

  // PATCH /rest/v1/carga/:id/status — Atualizar status do embarque
  app.patch('/rest/v1/carga/:id/status', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params
      const { novo_estado, peso_real_kg, volume_real_m3, observacoes } = req.body

      if (!UUID_RE.test(id) || !novo_estado) {
        return res.status(400).json({ error: 'id e novo_estado obrigatórios' })
      }
      if (!ESTADOS_CARGA.includes(novo_estado)) {
        return res.status(400).json({ error: `novo_estado inválido. Valores aceites: ${ESTADOS_CARGA.join(', ')}` })
      }

      const dataEntregaReal = novo_estado === 'entregue' ? new Date() : null

      const result = await req.dbClient.query(
        `UPDATE logistics.carga
         SET estado = $1,
             peso_real_kg = COALESCE($2, peso_real_kg),
             volume_real_m3 = COALESCE($3, volume_real_m3),
             observacoes = COALESCE($4, observacoes),
             data_entrega_real = COALESCE($5, data_entrega_real)
         WHERE id = $6
         RETURNING *`,
        [novo_estado, peso_real_kg || null, volume_real_m3 || null, observacoes || null, dataEntregaReal, id]
      )

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Carga não encontrada' })
      }

      // Se entregue, propaga o estado às paletes associadas
      if (novo_estado === 'entregue') {
        await req.dbClient.query(
          `UPDATE logistics.palete SET estado = 'recebida', data_recepcao_cliente = NOW() WHERE carga_id = $1`,
          [id]
        )
      } else if (novo_estado === 'em_transito') {
        await req.dbClient.query(`UPDATE logistics.palete SET estado = 'expedida' WHERE carga_id = $1`, [id])
      }

      res.json({ success: true, carga: result.rows[0] })
    } catch (err) {
      console.error('PATCH /rest/v1/carga/:id/status error:', err.message)
      res.status(400).json({ error: err.message })
    } finally {
      if (req.dbClient) req.dbClient.release()
    }
  })

  // GET /rest/v1/carga/:id — Detalhe do embarque com paletes associadas
  app.get('/rest/v1/carga/:id', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const { id } = req.params
      if (!UUID_RE.test(id)) {
        return res.status(400).json({ error: 'Invalid carga id' })
      }

      const [cargaResult, paletesResult] = await Promise.all([
        req.dbClient.query(
          `SELECT c.*, v.matricula, t.nome AS transportadora_nome, m.nome AS motorista_nome, m.contacto AS motorista_contacto
           FROM logistics.carga c
           LEFT JOIN logistics.viatura v ON v.id = c.viatura_id
           LEFT JOIN logistics.transportadora t ON t.id = c.transportadora_id
           LEFT JOIN logistics.motorista m ON m.id = c.motorista_id
           WHERE c.id = $1`,
          [id]
        ),
        req.dbClient.query(`SELECT * FROM logistics.palete WHERE carga_id = $1`, [id]),
      ])

      if (cargaResult.rows.length === 0) {
        return res.status(404).json({ error: 'Carga não encontrada' })
      }

      res.json({ success: true, carga: { ...cargaResult.rows[0], paletes: paletesResult.rows } })
    } catch (err) {
      console.error('GET /rest/v1/carga/:id error:', err.message)
      res.status(400).json({ error: err.message })
    } finally {
      if (req.dbClient) req.dbClient.release()
    }
  })

  // GET /rest/v1/carga — Listar embarques
  app.get('/rest/v1/carga', verifyJWT, setEmpresaContext, async (req, res) => {
    try {
      const limite = Math.min(parseInt(req.query.limit, 10) || 50, 200)
      const offset = parseInt(req.query.offset, 10) || 0
      const { estado } = req.query

      const params = []
      let query = `SELECT * FROM logistics.carga`
      if (estado) {
        params.push(estado)
        query += ` WHERE estado = $${params.length}`
      }
      params.push(limite)
      query += ` ORDER BY data_hora_carga DESC NULLS LAST LIMIT $${params.length}`
      params.push(offset)
      query += ` OFFSET $${params.length}`

      const result = await req.dbClient.query(query, params)
      res.json({ success: true, cargas: result.rows, limit: limite, offset })
    } catch (err) {
      console.error('GET /rest/v1/carga error:', err.message)
      res.status(400).json({ error: err.message })
    } finally {
      if (req.dbClient) req.dbClient.release()
    }
  })
}
