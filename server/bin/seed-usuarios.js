#!/usr/bin/env node

/**
 * Script para seed/reset de utilizadores.
 *
 * Uso:
 *   node server/bin/seed-usuarios.js --email admin@test.local --password teste123 \
 *     --empresa-id 11111111-1111-1111-1111-111111111111
 */

import dotenv from 'dotenv'
import pkg from 'pg'
import { hashPassword } from '../utils/password.js'

dotenv.config()

const { Client } = pkg

const args = process.argv.slice(2)
const getArg = (name) => {
  const idx = args.indexOf(name)
  return idx >= 0 ? args[idx + 1] : null
}

const email = getArg('--email')
const password = getArg('--password')
const empresaId = getArg('--empresa-id') || ''

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

if (!email || !password || !UUID_RE.test(empresaId)) {
  console.error(
    'Uso: node server/bin/seed-usuarios.js --email <email> --password <password> --empresa-id <uuid>'
  )
  process.exit(1)
}

async function main() {
  const client = new Client({
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ticsol_logistics_hub',
  })

  try {
    await client.connect()
    console.log(`[SEED] Conectado. Criando utilizador ${email} para empresa ${empresaId}…`)

    const hash = hashPassword(password)

    // O utilizador precisa de um perfil; garantir que a empresa tem um.
    const perfilRes = await client.query(
      `WITH existente AS (
         SELECT id FROM logistics.perfil
         WHERE empresa_id = $1 AND nome = 'Operador'
       ), novo AS (
         INSERT INTO logistics.perfil (empresa_id, nome, descricao)
         SELECT $1, 'Operador', 'Perfil base de operação logística'
         WHERE NOT EXISTS (SELECT 1 FROM existente)
         RETURNING id
       )
       SELECT id FROM existente UNION ALL SELECT id FROM novo`,
      [empresaId]
    )
    const perfilId = perfilRes.rows[0].id

    const res = await client.query(
      `INSERT INTO logistics.utilizador (empresa_id, perfil_id, nome, email, senha_hash, ativo)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (LOWER(email)) DO UPDATE
       SET senha_hash = $5, ativo = true
       RETURNING id, email, ativo`,
      [empresaId, perfilId, email.split('@')[0], email.toLowerCase().trim(), hash]
    )

    const usuario = res.rows[0]
    console.log(`[SEED] Utilizador criado/atualizado:`)
    console.log(`  ID:    ${usuario.id}`)
    console.log(`  Email: ${usuario.email}`)
    console.log(`  Ativo: ${usuario.ativo}`)
    console.log(`\nTestar login:`)
    console.log(`  curl -X POST http://localhost:3000/auth/login \\`)
    console.log(`    -H "Content-Type: application/json" \\`)
    console.log(`    -d '{"email":"${email}","password":"${password}"}'`)

    process.exit(0)
  } catch (err) {
    console.error('[ERROR]', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
