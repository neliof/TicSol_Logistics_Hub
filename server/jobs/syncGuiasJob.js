/**
 * Job de sincronização agendado de guias de transporte.
 *
 * Executa em horário configurável (default: 02:00 UTC diariamente).
 * Sincroniza todas as empresas ativas em paralelo.
 */

import cron from 'node-cron'
import { sincronizarGuias } from '../../artsoft-sync/guias/sync.js'
import { alertarSyncFailure } from '../utils/alerting.js'

export class SyncGuiasJob {
  constructor(pool, options = {}) {
    this.pool = pool
    this.schedule = options.schedule || '0 2 * * *'  // 2 AM UTC
    this.enabled = options.enabled !== false
    this.task = null
  }

  /**
   * Inicia o job agendado.
   *
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.enabled) {
      console.log('[SYNC-JOB] Desabilitado via config (CRON_ENABLED=false)')
      return
    }

    console.log(`[SYNC-JOB] Iniciando scheduler (cron: ${this.schedule})…`)

    this.task = cron.schedule(this.schedule, async () => {
      await this._executeSync()
    })

    console.log('[SYNC-JOB] Scheduler ativo.')
  }

  /**
   * Para o job agendado.
   */
  stop() {
    if (this.task) {
      this.task.stop()
      console.log('[SYNC-JOB] Scheduler parado.')
    }
  }

  /**
   * Executa sincronização para todas as empresas.
   *
   * @private
   */
  async _executeSync() {
    const startTime = Date.now()
    console.log('[SYNC-JOB] Iniciando sincronização…')

    const client = await this.pool.connect()
    try {
      // Listar empresas ativas
      const empresasRes = await client.query(
        'SELECT id, nome FROM logistics.empresa WHERE ativa = true ORDER BY id'
      )

      const empresas = empresasRes.rows
      console.log(`[SYNC-JOB] Sincronizando ${empresas.length} empresa(s)…`)

      if (empresas.length === 0) {
        console.log('[SYNC-JOB] Nenhuma empresa ativa.')
        return
      }

      // Sincronizar em paralelo (com limite de concorrência)
      const maxConcurrent = 3
      const resultados = []
      for (let i = 0; i < empresas.length; i += maxConcurrent) {
        const batch = empresas.slice(i, i + maxConcurrent)
        const batchPromises = batch.map((emp) =>
          this._syncEmpresa(client, emp).catch((err) => ({
            empresa_id: emp.id,
            erro: err.message,
          }))
        )
        const batchResults = await Promise.all(batchPromises)
        resultados.push(...batchResults)
      }

      // Resumo
      const sucesso = resultados.filter((r) => !r.erro).length
      const erros = resultados.filter((r) => r.erro).length

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
      console.log(
        `[SYNC-JOB] Concluído em ${elapsed}s: ${sucesso} OK, ${erros} erro(s)`
      )

      if (erros > 0) {
        console.log('[SYNC-JOB] Erros:')
        resultados
          .filter((r) => r.erro)
          .forEach((r) => {
            console.log(`  - Empresa ${r.empresa_id}: ${r.erro}`)
          })
      }
    } catch (err) {
      console.error('[SYNC-JOB] Erro crítico:', err.message)
    } finally {
      client.release()
    }
  }

  /**
   * Sincroniza uma empresa.
   *
   * @private
   */
  async _syncEmpresa(client, empresa) {
    const { id, nome } = empresa
    try {
      console.log(`[SYNC-JOB:${id}] ${nome}: iniciando…`)

      const resultado = await sincronizarGuias(client, id, {
        logger: (msg) => console.log(`[SYNC-JOB:${id}] ${msg}`),
      })

      console.log(
        `[SYNC-JOB:${id}] ${nome}: ✓ ` +
          `${resultado.docs_criados} docs, ` +
          `${resultado.linhas_total} linhas, ` +
          `${resultado.erros.length} erros`
      )

      // Alertar se não completo
      if (resultado.ultima_execucao.estado !== 'completo') {
        await alertarSyncFailure({
          empresaId: id,
          empresa_nome: nome,
          estado: resultado.ultima_execucao.estado,
          erro_mensagem: `Sync incomplete: ${resultado.erros.length} erros`,
        }).catch(() => {})
      }

      return {
        empresa_id: id,
        docs_criados: resultado.docs_criados,
        linhas_total: resultado.linhas_total,
        erros: resultado.erros.length,
        estado: resultado.ultima_execucao.estado,
      }
    } catch (err) {
      console.error(`[SYNC-JOB:${id}] ${nome}: ✗ ${err.message}`)

      // Alertar de erro crítico
      await alertarSyncFailure({
        empresaId: id,
        empresa_nome: nome,
        estado: 'erro_critico',
        erro_mensagem: err.message,
      }).catch(() => {})

      return {
        empresa_id: id,
        erro: err.message,
      }
    }
  }
}

/**
 * Factory para criar e iniciar job.
 *
 * @param {Pool} pool
 * @param {object} options
 * @returns {SyncGuiasJob}
 */
export function createSyncGuiasJob(pool, options) {
  return new SyncGuiasJob(pool, options)
}
