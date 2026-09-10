import express from 'express'
import pkg from 'pg'
import cors from 'cors'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'
import { verifyPassword } from './utils/password.js'
import { createSyncGuiasJob } from './jobs/syncGuiasJob.js'
import { loginLimiter, syncLimiter, apiLimiter } from './middleware/rateLimiter.js'

dotenv.config()

const { Pool } = pkg
const app = express()
const port = process.env.PORT || 3000
const jwtSecret = process.env.JWT_SECRET

if (!jwtSecret) {
  throw new Error('JWT_SECRET not set in environment')
}

const pool = new Pool({
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'ticsol_logistics_hub',
  statement_timeout: 30000,
  query_timeout: 30000,
})

if (!process.env.DB_PASSWORD) {
  console.warn('WARNING: DB_PASSWORD not set in environment')
}

app.use(cors())
app.use(express.json())

// Swagger API Documentation
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TicSol Logistics Hub API',
      version: '1.0.0',
      description: 'ARTSOFT transport guide synchronization API',
    },
    servers: [
      { url: `http://localhost:${port}`, description: 'Development' },
      { url: 'https://api.company.com', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./server.js'],
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Dev phase: se sem token, gera automaticamente
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    // Dev: gera token automático
    const token = jwt.sign(
      { usuario_id: 'dev-user', empresa_id: '11111111-1111-1111-1111-111111111111', email: 'dev@localhost', nome: 'Dev' },
      jwtSecret,
      { expiresIn: '24h' }
    )
    req.user = jwt.decode(token)
    return next()
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' })
  }

  try {
    const decoded = jwt.verify(token, jwtSecret)
    req.user = decoded
    next()
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' })
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const setEmpresaContext = async (req, res, next) => {
  try {
    // Se sem autenticação, permite acesso com contexto vazio (RLS usa NULL)
    const empresaId = req.user?.empresa_id ? String(req.user.empresa_id) : null
    if (empresaId && !UUID_RE.test(empresaId)) {
      return res.status(403).json({ error: 'Invalid empresa_id' })
    }

    const client = await pool.connect()
    try {
      // As políticas RLS leem a empresa de logistics.jwt_empresa_id(), que por
      // sua vez lê o GUC request.jwt.claims (convenção do PostgREST).
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claims',
        empresaId ? JSON.stringify({ empresa_id: empresaId }) : '',
      ])

      // A ligação volta ao pool partilhada; limpar o contexto ao libertar
      // evita que um pedido sem este middleware herde a empresa anterior.
      const release = client.release.bind(client)
      client.release = async () => {
        try {
          await client.query('SELECT set_config($1, $2, false)', [
            'request.jwt.claims',
            '',
          ])
        } catch {
          // Ligação já inutilizável: o pool descarta-a de qualquer forma.
        }
        release()
      }

      req.dbClient = client
    } catch (err) {
      client.release()
      throw err
    }
    next()
  } catch (err) {
    console.error('setEmpresaContext error:', err.message)
    res.status(500).json({ error: 'Database context error' })
  }
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

app.get('/health/sync/:empresaId', async (req, res) => {
  try {
    const empresaId = String(req.params.empresaId)
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id' })
    }

    const client = await pool.connect()
    try {
      const { checkSyncHealth } = await import('./utils/alerting.js')
      const health = await checkSyncHealth(client, empresaId)
      res.json(health)
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('GET /health/sync error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

const ALLOWED_TABLES = new Set([
  'documento',
  'linha_documento',
  'configuracao',
  'mapeamento_campo',
  'sincronizacao_execucao',
  'produto',
  'terceiro',
  'cliente',
  'fornecedor',
  'palete',
  'regra_logistica',
  'artsoft_stock_snapshot',
  'vw_reconciliacao_stock',
])

const validateTableName = (table) => {
  if (!table || !/^[a-z_][a-z0-9_]*$/i.test(table)) {
    throw new Error('Invalid table name')
  }
  if (!ALLOWED_TABLES.has(table.toLowerCase())) {
    throw new Error(`Access denied to table: ${table}`)
  }
  return table.toLowerCase()
}

/**
 * Linhas de um documento. Existe à parte da rota genérica porque esta não
 * filtra, e trazer todas as linhas da empresa para escolher as de um documento
 * não escala.
 */
app.get(
  '/rest/v1/documento/:id/linhas',
  verifyJWT,
  setEmpresaContext,
  async (req, res) => {
    try {
      const { id } = req.params
      if (!UUID_RE.test(id)) {
        return res.status(400).json({ error: 'Invalid documento id' })
      }

      // A RLS de linha_documento segue o documento; o join garante que uma
      // linha de outra empresa nunca é devolvida.
      const result = await req.dbClient.query(
        `SELECT l.*
           FROM logistics.linha_documento l
           JOIN logistics.documento d ON d.id = l.documento_id
          WHERE l.documento_id = $1
          ORDER BY l.nr_linha, l.nr_lancamento`,
        [id]
      )

      res.json(result.rows)
    } catch (err) {
      console.error('GET /rest/v1/documento/:id/linhas error:', err.message)
      res.status(400).json({ error: err.message })
    } finally {
      if (req.dbClient) req.dbClient.release()
    }
  }
)

app.get('/rest/v1/:table', verifyJWT, setEmpresaContext, async (req, res) => {
  console.log(`[GET /rest/v1/:table] table=${req.params.table}, user=${req.user ? 'yes' : 'no'}`)
  try {
    const table = validateTableName(req.params.table)
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000)
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0)

    const result = await req.dbClient.query(
      `SELECT * FROM logistics."${table}" LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    res.json(result.rows)
  } catch (err) {
    console.error('GET /rest/v1/:table error:', err.message)
    const status = err.message.includes('Access denied') ? 403 : 400
    res.status(status).json({ error: err.message })
  } finally {
    if (req.dbClient) req.dbClient.release()
  }
})

app.post('/rest/v1/:table', verifyJWT, setEmpresaContext, async (req, res) => {
  try {
    const table = validateTableName(req.params.table)
    const data = req.body

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Request body must be a non-empty object')
    }

    const columns = Object.keys(data)
    const values = Object.values(data)

    if (columns.length === 0) {
      throw new Error('No columns provided')
    }

    const placeholders = values.map((_, i) => `$${i + 1}`).join(',')
    const query = `
      INSERT INTO logistics."${table}" (${columns.map((c) => `"${c}"`).join(',')})
      VALUES (${placeholders})
      RETURNING *
    `

    const result = await req.dbClient.query(query, values)
    res.json(result.rows[0])
  } catch (err) {
    console.error('POST /rest/v1/:table error:', err.message)
    const status = err.message.includes('Access denied') ? 403 : 400
    res.status(status).json({ error: err.message })
  } finally {
    if (req.dbClient) req.dbClient.release()
  }
})

const ALLOWED_FUNCTIONS = new Set(['sincronizar_guias', 'validar_documento'])

app.post('/rpc/:func', verifyJWT, setEmpresaContext, async (req, res) => {
  try {
    const func = req.params.func
    if (!func || !/^[a-z_][a-z0-9_]*$/i.test(func)) {
      throw new Error('Invalid function name')
    }
    if (!ALLOWED_FUNCTIONS.has(func.toLowerCase())) {
      throw new Error(`Access denied to function: ${func}`)
    }

    const result = await req.dbClient.query(
      `SELECT logistics."${func.toLowerCase()}"($1) AS result`,
      [JSON.stringify(req.body)]
    )
    res.json(result.rows[0])
  } catch (err) {
    console.error('POST /rpc/:func error:', err.message)
    const status = err.message.includes('Access denied') ? 403 : 400
    res.status(status).json({ error: err.message })
  } finally {
    if (req.dbClient) req.dbClient.release()
  }
})

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and get JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
app.post('/auth/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' })
    }

    const client = await pool.connect()
    try {
      const userRes = await client.query(
        `SELECT id, empresa_id, nome, ativo, senha_hash
         FROM logistics.utilizador
         WHERE email = $1`,
        [email.toLowerCase().trim()]
      )

      if (userRes.rows.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      const usuario = userRes.rows[0]

      if (!usuario.ativo) {
        return res.status(403).json({ error: 'User account is inactive' })
      }

      if (!verifyPassword(password, usuario.senha_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      const token = jwt.sign(
        {
          usuario_id: usuario.id,
          empresa_id: usuario.empresa_id,
          email,
          nome: usuario.nome,
        },
        jwtSecret,
        { expiresIn: '24h' }
      )

      res.json({ token, usuario: { id: usuario.id, nome: usuario.nome, email } })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('POST /auth/login error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * Dev phase: retorna token automático sem credenciais.
 * Remover em produção — restaurar autenticação obrigatória.
 */
app.get('/auth/dev-token', (req, res) => {
  const empresaId = '11111111-1111-1111-1111-111111111111'
  const token = jwt.sign(
    {
      usuario_id: 'dev-user',
      empresa_id: empresaId,
      email: 'dev@localhost',
      nome: 'Dev User',
    },
    jwtSecret,
    { expiresIn: '24h' }
  )
  res.json({ token, usuario: { id: 'dev-user', nome: 'Dev User', email: 'dev@localhost' } })
})

/**
 * @swagger
 * /api/artsoft/guias/sync:
 *   post:
 *     summary: Trigger manual ARTSOFT sync
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync triggered successfully
 *       429:
 *         description: Rate limit exceeded
 */
app.post('/api/artsoft/guias/sync', verifyJWT, syncLimiter, async (req, res) => {
  try {
    // Dev phase: empresa_id from query, token, or default
    const empresaId = String(req.query.empresa_id || req.user?.empresa_id || req.body?.empresa_id || '11111111-1111-1111-1111-111111111111')
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id format' })
    }

    // Dynamic import to avoid circular dependency
    const { sincronizarGuias } = await import('../artsoft-sync/guias/sync.js')

    // Ligação dedicada à sincronização. Esta rota não passa por
    // setEmpresaContext, logo o contexto de RLS é definido aqui — sem ele as
    // políticas bloqueiam a escrita dos documentos.
    const client = await pool.connect()
    try {
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claims',
        JSON.stringify({ empresa_id: empresaId }),
      ])

      const logger = (msg) => console.log(`[SYNC:${empresaId}] ${msg}`)
      const dataInicio = req.body?.data_inicio ? new Date(req.body.data_inicio) : null
      const dataFim = req.body?.data_fim ? new Date(req.body.data_fim) : null

      logger('Iniciado…')
      const resultado = await sincronizarGuias(client, empresaId, { logger, dataInicio, dataFim })

      // NOTA: logistics.documento não tem coluna de estado/status ainda.
      // Marcar como EXPEDIDA requer migração para adicionar essa coluna.

      logger('Concluído com sucesso.')
      res.json({
        success: true,
        docs_criados: resultado.docs_criados,
        docs_atualizados: resultado.docs_atualizados,
        linhas_total: resultado.linhas_total,
        erros: resultado.erros,
        ultima_execucao: resultado.ultima_execucao,
      })
    } finally {
      // A ligação volta ao pool partilhada: limpar o contexto.
      try {
        await client.query('SELECT set_config($1, $2, false)', [
          'request.jwt.claims',
          '',
        ])
      } catch {
        // Ligação já inutilizável: o pool descarta-a.
      }
      client.release()
    }
  } catch (err) {
    console.error('POST /api/artsoft/guias/sync error:', err.message)
    res.status(500).json({
      error: err.message,
      code: err.name || 'SYNC_ERROR',
    })
  }
})

app.post('/api/artsoft/produtos/sync', verifyJWT, syncLimiter, async (req, res) => {
  try {
    const empresaId = String(req.query.empresa_id || req.user?.empresa_id || req.body?.empresa_id || '11111111-1111-1111-1111-111111111111')
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id format' })
    }

    const { sincronizarProdutos } = await import('../artsoft-sync/produtos/sync.js')

    // Como na rota de guias, o contexto de RLS é definido aqui — sem ele as
    // políticas bloqueiam a escrita em logistics.produto.
    const client = await pool.connect()
    try {
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claims',
        JSON.stringify({ empresa_id: empresaId }),
      ])

      const logger = (msg) => console.log(`[SYNC-PRODUTOS:${empresaId}] ${msg}`)

      logger('Iniciado…')
      const resultado = await sincronizarProdutos(client, empresaId, { logger })

      logger('Concluído com sucesso.')
      res.json({
        success: true,
        criados: resultado.criados,
        atualizados: resultado.atualizados,
        processados: resultado.processados,
        erros: resultado.erros,
        ultima_execucao: resultado.ultima_execucao,
      })
    } finally {
      try {
        await client.query('SELECT set_config($1, $2, false)', [
          'request.jwt.claims',
          '',
        ])
      } catch {
        // Ligação já inutilizável: o pool descarta-a.
      }
      client.release()
    }
  } catch (err) {
    console.error('POST /api/artsoft/produtos/sync error:', err.message)
    res.status(500).json({
      error: err.message,
      code: err.name || 'SYNC_ERROR',
    })
  }
})

app.post('/api/artsoft/terceiros/sync', verifyJWT, syncLimiter, async (req, res) => {
  try {
    const empresaId = String(req.query.empresa_id || req.user?.empresa_id || req.body?.empresa_id || '11111111-1111-1111-1111-111111111111')
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id format' })
    }

    const { sincronizarTerceiros } = await import('../artsoft-sync/terceiros/sync.js')

    const client = await pool.connect()
    try {
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claims',
        JSON.stringify({ empresa_id: empresaId }),
      ])

      const logger = (msg) => console.log(`[SYNC-TERCEIROS:${empresaId}] ${msg}`)

      logger('Iniciado…')
      const clientes = await sincronizarTerceiros(client, empresaId, 'cliente', { logger })
      const fornecedores = await sincronizarTerceiros(client, empresaId, 'fornecedor', { logger })

      logger('Concluído com sucesso.')
      res.json({ success: true, clientes, fornecedores })
    } finally {
      try {
        await client.query('SELECT set_config($1, $2, false)', [
          'request.jwt.claims',
          '',
        ])
      } catch {
        // Ligação já inutilizável: o pool descarta-a.
      }
      client.release()
    }
  } catch (err) {
    console.error('POST /api/artsoft/terceiros/sync error:', err.message)
    res.status(500).json({
      error: err.message,
      code: err.name || 'SYNC_ERROR',
    })
  }
})

app.post('/api/artsoft/stock/sync', verifyJWT, syncLimiter, async (req, res) => {
  try {
    const empresaId = String(req.query.empresa_id || req.user?.empresa_id || req.body?.empresa_id || '11111111-1111-1111-1111-111111111111')
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id format' })
    }

    const { sincronizarStock } = await import('../artsoft-sync/stock/sync.js')

    const client = await pool.connect()
    try {
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claims',
        JSON.stringify({ empresa_id: empresaId }),
      ])

      const logger = (msg) => console.log(`[SYNC-STOCK:${empresaId}] ${msg}`)

      logger('Iniciado…')
      const resultado = await sincronizarStock(client, empresaId, { logger })

      logger('Concluído com sucesso.')
      res.json({ success: true, ...resultado })
    } finally {
      try {
        await client.query('SELECT set_config($1, $2, false)', [
          'request.jwt.claims',
          '',
        ])
      } catch {
        // Ligação já inutilizável: o pool descarta-a.
      }
      client.release()
    }
  } catch (err) {
    console.error('POST /api/artsoft/stock/sync error:', err.message)
    res.status(500).json({
      error: err.message,
      code: err.name || 'SYNC_ERROR',
    })
  }
})

/**
 * GET /api/artsoft/config
 * Lê a configuração de ligação ao ARTSOFT (host/porta/utilizador/senha).
 * Senha devolvida mascarada — nunca exposta em claro ao frontend.
 */
app.get('/api/artsoft/config', verifyJWT, async (req, res) => {
  try {
    const empresaId = String(req.query.empresa_id || req.user?.empresa_id || '11111111-1111-1111-1111-111111111111')
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id format' })
    }

    const client = await pool.connect()
    try {
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claims',
        JSON.stringify({ empresa_id: empresaId }),
      ])

      const result = await client.query(
        'SELECT chave, valor FROM logistics.configuracao WHERE empresa_id = $1 AND chave LIKE $2',
        [empresaId, 'artsoft.%']
      )

      const config = {}
      for (const row of result.rows) {
        config[row.chave] = row.valor
      }

      res.json({
        host: config['artsoft.host'] || '',
        porta: config['artsoft.porta'] || '',
        utilizador: config['artsoft.utilizador'] || '',
        senha: config['artsoft.senha'] ? '••••••••' : '',
      })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('GET /api/artsoft/config error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/artsoft/config
 * Atualiza a configuração de ligação ao ARTSOFT.
 * Só grava a senha se vier um valor novo (não a máscara "••••••••").
 */
app.post('/api/artsoft/config', verifyJWT, async (req, res) => {
  try {
    const empresaId = String(req.query.empresa_id || req.user?.empresa_id || req.body?.empresa_id || '11111111-1111-1111-1111-111111111111')
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id format' })
    }

    const { host, porta, utilizador, senha } = req.body

    if (!host || !porta || !utilizador) {
      return res.status(400).json({ error: 'host, porta e utilizador são obrigatórios' })
    }

    const client = await pool.connect()
    try {
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claims',
        JSON.stringify({ empresa_id: empresaId }),
      ])

      const entradas = [
        ['artsoft.host', String(host)],
        ['artsoft.porta', String(porta)],
        ['artsoft.utilizador', String(utilizador)],
      ]

      if (senha && senha !== '••••••••') {
        entradas.push(['artsoft.senha', String(senha)])
      }

      for (const [chave, valor] of entradas) {
        await client.query(
          `INSERT INTO logistics.configuracao (empresa_id, chave, valor, descricao)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (empresa_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()`,
          [empresaId, chave, valor, `Configuração de ligação ARTSOFT (${chave})`]
        )
      }

      res.json({ success: true })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('POST /api/artsoft/config error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * Descobre séries de documentos disponíveis no ARTSOFT.
 * Query simples: DocFch sem filtros para listar tipos de documentos.
 */
app.get('/api/artsoft/series/discover', verifyJWT, async (req, res) => {
  try {
    const empresaId = String(req.query.empresa_id || req.user?.empresa_id || '11111111-1111-1111-1111-111111111111')
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id format' })
    }

    const client = await pool.connect()
    try {
      // Ler configuração ARTSOFT
      const configRes = await client.query(
        'SELECT chave, valor FROM logistics.configuracao WHERE empresa_id = $1 AND chave LIKE $2',
        [empresaId, 'artsoft.%']
      )

      const config = {}
      for (const row of configRes.rows) {
        config[row.chave] = row.valor
      }

      if (!config['artsoft.host'] || !config['artsoft.porta'] || !config['artsoft.utilizador']) {
        return res.status(400).json({ error: 'Config incompleta: artsoft.host/porta/utilizador' })
      }

      // Descoberta de séries a partir dos documentos já emitidos em DocFch —
      // não há tabela de catálogo de séries acessível nesta instalação
      // (DefDocs e TipoDocCC devolveram ambos TableNotFound).
      //
      // Estratégia: múltiplas queries por tipo (E, S, V, C, F) para contornar
      // limitação conhecida onde ranges amplos só devolvem Entradas.
      const { executarPedidoArtsoft } = await import('../artsoft-sync/artsoft/connection.js')
      const { parseXml, comoLista, texto } = await import('../artsoft-sync/artsoft/xml.js')

      function classifySeriesType(code) {
        const prefix = String(code).charAt(0).toUpperCase();
        const typeMap = {
          'E': { type: 'Entrada', typeName: 'Entradas (E)' },
          'S': { type: 'Saida', typeName: 'Saídas (S)' },
          'V': { type: 'Venda', typeName: 'Vendas (V)' },
          'C': { type: 'Encomenda_Cliente', typeName: 'Encomendas Clientes (C)' },
          'F': { type: 'Encomenda_Fornecedor', typeName: 'Encomendas Fornecedores (F)' }
        };
        return typeMap[prefix] || { type: 'Outro', typeName: 'Outro' };
      }

      const seriesData = new Map()

      try {
        const xml = `<?xml version='1.0' encoding='UTF-8'?>
<table
  fields='DocID,FmtDoc,FmtArq,FormProvis,FormPortas0'
  name='T' />`

        const resposta = await executarPedidoArtsoft({
          host: config['artsoft.host'],
          porta: parseInt(config['artsoft.porta'], 10),
          utilizador: config['artsoft.utilizador'],
          senha: config['artsoft.senha'] || '',
          xml,
          endpoint: 'DocFch/CfgDocum',
          timeout: 20000,
        })

        const parsedRaw = parseXml(resposta)

        const parsed = parsedRaw.table ?? parsedRaw.root ?? parsedRaw
        const regs = comoLista(parsed.rec)
        for (const r of regs) {
          const docId = texto(r?.['@DocID'] ?? r?.DocID)
          const fmtDoc = texto(r?.['@FmtDoc'] ?? r?.FmtDoc)
          const fmtArq = texto(r?.['@FmtArq'] ?? r?.FmtArq)
          const formProvis = texto(r?.['@FormProvis'] ?? r?.FormProvis)
          const formPortas0 = texto(r?.['@FormPortas0'] ?? r?.FormPortas0)

          if (docId) {
            const serieUpper = docId.toUpperCase()
            const { type, typeName } = classifySeriesType(serieUpper)
            seriesData.set(serieUpper, {
              type,
              typeName,
              docNome: '',
              fmtDoc: fmtDoc || '',
              fmtArq: fmtArq || '',
              formProvis: formProvis || '',
              formPortas0: formPortas0 || ''
            })
          }
        }
      } catch (connectErr) {
        console.error('ARTSOFT CfgDocum error:', connectErr.message)
        return res.json({
          series: [],
          total: 0,
          message: `Erro ao conectar ARTSOFT: ${connectErr.message}. Introduza séries manualmente.`,
        })
      }

      // CfgDocum não devolve nome descritivo do documento (FmtDoc é o
      // formulário de impressão, não o nome). Para obter o nome real
      // (ex: "V/FACTURA CONTINENTE"), consultar DocFch com um range cujos
      // limites são códigos que sabemos existir (descobertos acima) — só
      // assim o range filtra corretamente nesta instalação.
      const codigosPorPrefixo = new Map()
      for (const code of seriesData.keys()) {
        const prefix = code.charAt(0)
        if (!codigosPorPrefixo.has(prefix)) codigosPorPrefixo.set(prefix, [])
        codigosPorPrefixo.get(prefix).push(code)
      }

      for (const [, codigos] of codigosPorPrefixo) {
        codigos.sort()
        const inicio = codigos[0]
        const fim = codigos[codigos.length - 1]
        const filtro = `DocFch|DocData|TpDoc=${inicio}:${fim}|Data=20000101:20301231`
        const xmlNomes = `<root type='list' end='500' name='rec' query='${filtro}'>
          <defcol>
            <Serie form='%DocFch.Doc.Serie' />
            <DocNome form='%DocFch.Doc.Nome' />
          </defcol>
        </root>`

        try {
          const respostaNomes = await executarPedidoArtsoft({
            host: config['artsoft.host'],
            porta: parseInt(config['artsoft.porta'], 10),
            utilizador: config['artsoft.utilizador'],
            senha: config['artsoft.senha'] || '',
            xml: xmlNomes,
            timeout: 20000,
          })
          const parsedNomes = parseXml(respostaNomes)
          const rootNomes = parsedNomes.root ?? parsedNomes
          const regsNomes = comoLista(rootNomes.rec)
          for (const r of regsNomes) {
            const serie = texto(r?.Serie)
            const docNome = texto(r?.DocNome)
            if (serie && docNome) {
              const serieUpper = serie.toUpperCase()
              const existente = seriesData.get(serieUpper)
              if (existente) {
                existente.docNome = docNome
              }
            }
          }
        } catch (nomeErr) {
          console.error(`Erro ao obter nomes para prefixo ${inicio[0]}:`, nomeErr.message)
        }
      }

      const seriesArray = Array.from(seriesData.entries()).map(([code, { type, typeName, docNome }]) => ({
        code,
        type,
        typeName,
        docNome
      })).sort((a, b) => a.code.localeCompare(b.code));

      res.json({
        series: seriesArray,
        total: seriesArray.length,
        message: 'Esta instalação ARTSOFT não expõe um catálogo de séries navegável — a lista acima é melhor esforço e pode não incluir todas as séries reais (ex: guias de transporte). Confirma manualmente as séries que precisas.',
      })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('GET /api/artsoft/series/discover error:', err.message)
    res.status(500).json({
      error: err.message,
      code: err.name || 'DISCOVER_ERROR',
    })
  }
})

/**
 * GET /api/artsoft/series/config/:modulo
 * Retrieve series configuration for a given module (receção or expedição).
 */
app.get('/api/artsoft/series/config/:modulo', verifyJWT, async (req, res) => {
  try {
    const empresaId = String(req.query.empresa_id || req.user?.empresa_id || req.body?.empresa_id || '11111111-1111-1111-1111-111111111111')
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id format' })
    }

    let modulo = String(req.params.modulo).toLowerCase()
    modulo = modulo.replace(/ç/g, 'c').replace(/ã/g, 'a')
    if (!['rececao', 'expedicao'].includes(modulo)) {
      return res.status(400).json({ error: 'Invalid modulo: must be receção or expedição' })
    }

    const client = await pool.connect()
    try {
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claims',
        JSON.stringify({ empresa_id: empresaId }),
      ])

      const result = await client.query(
        `SELECT valor, updated_at FROM logistics.configuracao
         WHERE empresa_id = $1 AND chave = $2`,
        [empresaId, `series.config.${modulo}`]
      )

      if (result.rows.length === 0) {
        return res.json({
          modulo,
          receção: [],
          expedição: [],
          updated_at: null
        })
      }

      const config = JSON.parse(result.rows[0].valor || '{}')
      res.json({
        modulo,
        receção: config.rececao || [],
        expedição: config.expedicao || [],
        updated_at: result.rows[0].updated_at
      })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('GET /api/artsoft/series/config error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * POST /api/artsoft/series/config
 * Save series configuration for a module (stores as JSON in logistics.configuracao).
 */
app.post('/api/artsoft/series/config', verifyJWT, async (req, res) => {
  try {
    const empresaId = String(req.query.empresa_id || req.user?.empresa_id || req.body?.empresa_id || '11111111-1111-1111-1111-111111111111')
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id format' })
    }

    const { modulo, receção, expedição } = req.body
    let moduloNorm = String(modulo).toLowerCase()
    moduloNorm = moduloNorm.replace(/ç/g, 'c').replace(/ã/g, 'a')

    if (!modulo || !['rececao', 'expedicao'].includes(moduloNorm)) {
      return res.status(400).json({ error: 'Invalid modulo' })
    }

    if (!Array.isArray(receção) || !Array.isArray(expedição)) {
      return res.status(400).json({ error: 'receção and expedição must be arrays of series codes' })
    }
    const configValue = JSON.stringify({ rececao: receção, expedicao: expedição })

    const client = await pool.connect()
    try {
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claims',
        JSON.stringify({ empresa_id: empresaId }),
      ])

      await client.query(
        `INSERT INTO logistics.configuracao (empresa_id, chave, valor, descricao)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (empresa_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()`,
        [
          empresaId,
          `series.config.${moduloNorm}`,
          configValue,
          `Configuração de séries de documentos para ${modulo}`
        ]
      )

      res.json({ success: true, modulo })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('POST /api/artsoft/series/config error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * Tabelas elimináveis pela UI de gestão de dados, na ordem segura de
 * eliminação (respeita FKs: documento cascata linha_documento; stock e
 * paletes referenciam produto; produto/terceiros por último).
 */
const TABELAS_TEST_DATA = {
  documentos: { tabela: 'logistics.documento', coluna: 'empresa_id' },
  stock: { tabela: 'logistics.artsoft_stock_snapshot', coluna: 'empresa_id' },
  paletes: { tabela: 'logistics.palete', coluna: 'empresa_id' },
  produtos: { tabela: 'logistics.produto', coluna: 'empresa_id' },
  clientes: { tabela: 'logistics.cliente', coluna: 'empresa_id' },
  fornecedores: { tabela: 'logistics.fornecedor', coluna: 'empresa_id' },
}
const ORDEM_TEST_DATA = ['documentos', 'stock', 'paletes', 'produtos', 'clientes', 'fornecedores']

/**
 * GET /api/artsoft/test-data/contagem
 * Devolve quantos registos existem em cada tabela eliminável, para a UI
 * mostrar antes de decidir o que apagar.
 */
app.get('/api/artsoft/test-data/contagem', verifyJWT, async (req, res) => {
  try {
    const empresaId = String(req.query.empresa_id || req.user?.empresa_id || '11111111-1111-1111-1111-111111111111')
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id format' })
    }

    const client = await pool.connect()
    try {
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claims',
        JSON.stringify({ empresa_id: empresaId }),
      ])

      const contagens = {}
      for (const chave of ORDEM_TEST_DATA) {
        const { tabela, coluna } = TABELAS_TEST_DATA[chave]
        const r = await client.query(`SELECT COUNT(*)::int AS n FROM ${tabela} WHERE ${coluna} = $1`, [empresaId])
        contagens[chave] = r.rows[0].n
      }

      res.json({ contagens })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('GET /api/artsoft/test-data/contagem error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * DELETE /api/artsoft/test-data
 * Remove dados de teste/sincronização das tabelas selecionadas em
 * ?tabelas=documentos,produtos,... (default: todas). Elimina pela ordem
 * segura de FK independentemente da ordem pedida.
 * WARNING: Irreversível.
 */
app.delete('/api/artsoft/test-data', verifyJWT, async (req, res) => {
  try {
    const empresaId = String(req.query.empresa_id || req.user?.empresa_id || req.body?.empresa_id || '11111111-1111-1111-1111-111111111111')
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id format' })
    }

    const pedidas = String(req.query.tabelas || Object.keys(TABELAS_TEST_DATA).join(','))
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const invalidas = pedidas.filter((t) => !TABELAS_TEST_DATA[t])
    if (invalidas.length > 0) {
      return res.status(400).json({ error: `Tabelas desconhecidas: ${invalidas.join(', ')}` })
    }

    const client = await pool.connect()
    try {
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claims',
        JSON.stringify({ empresa_id: empresaId }),
      ])

      const deleted = {}
      const erros = {}
      for (const chave of ORDEM_TEST_DATA) {
        if (!pedidas.includes(chave)) continue
        const { tabela, coluna } = TABELAS_TEST_DATA[chave]
        try {
          const r = await client.query(`DELETE FROM ${tabela} WHERE ${coluna} = $1`, [empresaId])
          deleted[chave] = r.rowCount || 0
        } catch (tabelaErr) {
          erros[chave] = tabelaErr.message
        }
      }

      res.json({ success: Object.keys(erros).length === 0, deleted, erros })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('DELETE /api/artsoft/test-data error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * Grava séries configuradas em logistics.configuracao.
 */
app.post('/api/artsoft/series/save', verifyJWT, async (req, res) => {
  try {
    const empresaId = String(req.query.empresa_id || req.user?.empresa_id || req.body?.empresa_id || '11111111-1111-1111-1111-111111111111')
    if (!UUID_RE.test(empresaId)) {
      return res.status(400).json({ error: 'Invalid empresa_id format' })
    }

    const { series } = req.body
    if (!Array.isArray(series) || series.length === 0) {
      return res.status(400).json({ error: 'Series array required and cannot be empty' })
    }

    const seriesStr = series.map(s => String(s).trim().toUpperCase()).join(';')

    const client = await pool.connect()
    try {
      const result = await client.query(
        `INSERT INTO logistics.configuracao (empresa_id, chave, valor, descricao)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (empresa_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
         RETURNING chave, valor`,
        [empresaId, 'guias.series', seriesStr, 'Séries de guias de transporte a sincronizar']
      )

      res.json({
        success: true,
        chave: result.rows[0].chave,
        valor: result.rows[0].valor,
        message: `Séries gravadas: ${seriesStr}`,
      })
    } finally {
      client.release()
    }
  } catch (err) {
    console.error('POST /api/artsoft/series/save error:', err.message)
    res.status(500).json({
      error: err.message,
      code: err.name || 'SAVE_ERROR',
    })
  }
})

const server = app.listen(port, async () => {
  console.log(`TicSol API Server running on http://localhost:${port}`)

  // Iniciar sync job agendado
  const cronEnabled = process.env.CRON_ENABLED !== 'false'
  const cronSchedule = process.env.CRON_SCHEDULE || '0 2 * * *'  // 2 AM UTC daily

  if (cronEnabled) {
    const syncJob = createSyncGuiasJob(pool, {
      enabled: true,
      schedule: cronSchedule,
    })
    await syncJob.start()
  } else {
    console.log('[SYNC-JOB] Desabilitado (set CRON_ENABLED=true para ativar)')
  }
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM: encerrando…')
  server.close(() => {
    console.log('Servidor encerrado.')
    process.exit(0)
  })
})
