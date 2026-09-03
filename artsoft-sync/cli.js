#!/usr/bin/env node

/**
 * CLI para sincronizar guias de transporte manualmente.
 *
 * Uso:
 *   node artsoft-sync/cli.js --empresa-id 1 [--dry-run]
 *
 * Requisitos:
 *   - DATABASE_URL ou DB_* env vars
 *   - config de ARTSOFT em logistics.configuracao
 */

import pkg from 'pg'
import { sincronizarGuias } from './guias/sync.js'

const { Client } = pkg

const args = process.argv.slice(2)
const empresaId = parseInt(
  args[args.indexOf('--empresa-id') + 1] || process.env.EMPRESA_ID || '1',
  10
)
const dryRun = args.includes('--dry-run')

if (isNaN(empresaId)) {
  console.error('ERROR: empresa-id deve ser um número')
  process.exit(1)
}

const logger = (msg) => console.log(`[SYNC:${empresaId}] ${msg}`)

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
    logger('Conectado ao banco.')

    if (dryRun) {
      logger('Modo DRY-RUN: não vão ser feitas alterações.')
    }

    const resultado = await sincronizarGuias(client, empresaId, { logger })

    console.log('\n=== RESULTADO ===')
    console.log(`Documentos criados:  ${resultado.docs_criados}`)
    console.log(`Documentos atualizados: ${resultado.docs_atualizados}`)
    console.log(`Linhas total:        ${resultado.linhas_total}`)
    console.log(`Erros:               ${resultado.erros.length}`)

    if (resultado.erros.length > 0) {
      console.log('\nErros:')
      resultado.erros.forEach((e) => {
        console.log(`  - ${e.doc_id}: ${e.erro}`)
      })
    }

    console.log(`\nÚltima execução:`)
    console.log(`  Estado:      ${resultado.ultima_execucao.estado}`)
    console.log(`  Correlation: ${resultado.ultima_execucao.correlation_id}`)
    console.log(`  Páginas:     ${resultado.ultima_execucao.paginas}`)

    process.exit(0)
  } catch (err) {
    console.error('\nERROR:', err.message)
    console.error(err.stack)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
