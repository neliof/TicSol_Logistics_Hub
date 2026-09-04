/**
 * Structured logging com Pino.
 *
 * JSON structured logs (compatible com ELK, Splunk, CloudWatch).
 * Desenvolvimento: pretty-printed console output.
 * Produção: JSON lines para file/syslog.
 */

import pino from 'pino'

const isDevelopment = process.env.NODE_ENV !== 'production'

const pinoConfig = {
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
}

const pinoTransport = isDevelopment
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: false,
        ignore: 'pid,hostname',
      },
    }
  : undefined

export const logger = pino(pinoConfig, pinoTransport ? pino.transport(pinoTransport) : undefined)

/**
 * Child logger com contexto (ex: request ID, empresa ID).
 */
export function createChildLogger(context) {
  return logger.child(context)
}

/**
 * Log de sync início/fim.
 */
export function logSyncStart(empresaId, syncId) {
  logger.info(
    { empresaId, syncId, type: 'sync_start' },
    'Iniciando sincronização'
  )
}

export function logSyncEnd(empresaId, syncId, resultado) {
  logger.info(
    {
      empresaId,
      syncId,
      type: 'sync_end',
      docs_criados: resultado.docs_criados,
      docs_atualizados: resultado.docs_atualizados,
      linhas_total: resultado.linhas_total,
      erros: resultado.erros.length,
      estado: resultado.ultima_execucao.estado,
      duracao_ms: Date.now() - (resultado._startTime || Date.now()),
    },
    'Sincronização concluída'
  )
}

export function logSyncError(empresaId, syncId, erro) {
  logger.error(
    {
      empresaId,
      syncId,
      type: 'sync_error',
      erro: erro.message,
      stack: erro.stack,
    },
    'Erro na sincronização'
  )
}

/**
 * Log de autenticação.
 */
export function logAuthSuccess(email, usuarioId, empresaId) {
  logger.info(
    { email, usuarioId, empresaId, type: 'auth_success' },
    'Login bem-sucedido'
  )
}

export function logAuthFailure(email, reason) {
  logger.warn(
    { email, reason, type: 'auth_failure' },
    'Falha de autenticação'
  )
}

/**
 * Log de API request/response (middleware).
 */
export function logApiRequest(req) {
  return createChildLogger({
    method: req.method,
    path: req.path,
    usuarioId: req.user?.usuario_id,
    empresaId: req.user?.empresa_id,
    requestId: req.id || crypto.randomUUID(),
  })
}
