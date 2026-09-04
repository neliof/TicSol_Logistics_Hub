import express from 'express'
import pkg from 'pg'
import cors from 'cors'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import { verifyPassword } from './utils/password.js'

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

const setEmpresaContext = async (req, res, next) => {
  try {
    if (!req.user || !req.user.empresa_id) {
      return res.status(403).json({ error: 'No empresa_id in token' })
    }

    const empresaId = parseInt(req.user.empresa_id, 10)
    if (isNaN(empresaId)) {
      return res.status(403).json({ error: 'Invalid empresa_id' })
    }

    const client = await pool.connect()
    try {
      await client.query(
        'SELECT logistics.set_empresa_context($1)',
        [empresaId]
      )
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

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' })
    }

    const client = await pool.connect()
    try {
      const userRes = await client.query(
        `SELECT id, empresa_id, nome, ativo, senha_hash
         FROM logistics.usuario
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

app.post('/api/artsoft/guias/sync', verifyJWT, async (req, res) => {
  try {
    if (!req.user || !req.user.empresa_id) {
      return res.status(403).json({ error: 'No empresa_id in token' })
    }

    const empresaId = parseInt(req.user.empresa_id, 10)
    if (isNaN(empresaId)) {
      return res.status(403).json({ error: 'Invalid empresa_id' })
    }

    // Dynamic import to avoid circular dependency
    const { sincronizarGuias } = await import('../artsoft-sync/guias/sync.js')

    // Get a dedicated connection for the sync (respects RLS via setEmpresaContext)
    const client = await pool.connect()
    try {
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

app.listen(port, () => {
  console.log(`TicSol API Server running on http://localhost:${port}`)
})
