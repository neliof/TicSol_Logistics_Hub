import express from 'express'
import pkg from 'pg'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const { Pool } = pkg
const app = express()
const port = 3000

const pool = new Pool({
  user: 'postgres',
  password: 'Aiccol206c',
  host: 'localhost',
  port: 5432,
  database: 'ticsol_logistics_hub',
})

app.use(cors())
app.use(express.json())

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Proxy REST requests to logistics schema
app.get('/rest/v1/:table', async (req, res) => {
  try {
    const { table } = req.params
    const { limit = 100, offset = 0 } = req.query

    const result = await pool.query(
      `SELECT * FROM logistics."${table}" LIMIT $1 OFFSET $2`,
      [limit, offset]
    )

    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// POST new record
app.post('/rest/v1/:table', async (req, res) => {
  try {
    const { table } = req.params
    const data = req.body

    const columns = Object.keys(data)
    const values = Object.values(data)
    const placeholders = values.map((_, i) => `$${i + 1}`).join(',')

    const query = `
      INSERT INTO logistics."${table}" (${columns.join(',')})
      VALUES (${placeholders})
      RETURNING *
    `

    const result = await pool.query(query, values)
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// RPC functions
app.post('/rpc/*', async (req, res) => {
  try {
    const func = req.path.replace('/rpc/', '')
    const result = await pool.query(`SELECT logistics.${func}($1)`, [
      JSON.stringify(req.body),
    ])
    res.json(result.rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

app.listen(port, () => {
  console.log(`TicSol API Server running on http://localhost:${port}`)
})
