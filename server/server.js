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

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' })
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
    if (!req.user || !req.user.empresa_id) {
      return res.status(403).json({ error: 'No empresa_id in token' })
    }

    const empresaId = String(req.user.empresa_id)
    if (!UUID_RE.test(empresaId)) {
      return res.status(403).json({ error: 'Invalid empresa_id' })
    }

    const client = await pool.connect()
    try {
      // As políticas RLS leem a empresa de logistics.jwt_empresa_id(), que por
      // sua vez lê o GUC request.jwt.claims (convenção do PostgREST).
      await client.query('SELECT set_config($1, $2, false)', [
        'request.jwt.claims',
        JSON.stringify({ empresa_id: empresaId }),
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
    if (!req.user || !req.user.empresa_id) {
      return res.status(403).json({ error: 'No empresa_id in token' })
    }

    const empresaId = String(req.user.empresa_id)
    if (!UUID_RE.test(empresaId)) {
      return res.status(403).json({ error: 'Invalid empresa_id' })
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

      logger('Iniciado…')
      const resultado = await sincronizarGuias(client, empresaId, { logger })

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
