#!/usr/bin/env node

/**
 * Script para seed/reset de utilizadores.
 *
 * Uso:
 *   node server/bin/seed-usuarios.js --email admin@test.local --password teste123 --empresa-id 1
 */

import pkg from 'pg'
import { hashPassword } from '../utils/password.js'

const { Client } = pkg

const args = process.argv.slice(2)
const getArg = (name) => {
  const idx = args.indexOf(name)
  return idx >= 0 ? args[idx + 1] : null
}

const email = getArg('--email')
const password = getArg('--password')
const empresaId = parseInt(getArg('--empresa-id') || '1', 10)

if (!email || !password) {
  console.error('Uso: node server/bin/seed-usuarios.js --email <email> --password <password> [--empresa-id <id>]')
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

    const res = await client.query(
      `INSERT INTO logistics.usuario (empresa_id, nome, email, senha_hash, ativo)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (email) DO UPDATE
       SET senha_hash = $4, ativo = true
       RETURNING id, email, ativo`,
      [empresaId, email.split('@')[0], email.toLowerCase().trim(), hash]
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
