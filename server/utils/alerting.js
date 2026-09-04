/**
 * Alerting para Sync failures.
 *
 * Suporta: Slack, Email (via template).
 * Configurar via env vars: ALERT_SLACK_WEBHOOK, ALERT_EMAIL_TO.
 */

import { logger } from './logger.js'

/**
 * Envia alerta de sync failure.
 *
 * @param {object} config
 * @param {number} config.empresaId
 * @param {string} config.empresa_nome
 * @param {string} config.estado (erro, erro_comunicacao, etc)
 * @param {string} config.erro_mensagem
 * @returns {Promise<void>}
 */
export async function alertarSyncFailure({
  empresaId,
  empresa_nome,
  estado,
  erro_mensagem,
}) {
  const timestamp = new Date().toISOString()

  const alerta = {
    tipo: 'sync_failure',
    empresaId,
    empresa_nome,
    estado,
    erro: erro_mensagem,
    timestamp,
  }

  // Log do alerta
  logger.warn(alerta, `ALERTA: Sync failure para empresa ${empresaId}`)

  // Slack webhook (se configurado)
  if (process.env.ALERT_SLACK_WEBHOOK) {
    await enviarSlackAlert(alerta).catch((err) => {
      logger.error({ erro: err.message }, 'Erro ao enviar Slack alert')
    })
  }

  // Email (se configurado)
  if (process.env.ALERT_EMAIL_TO) {
    await enviarEmailAlert(alerta).catch((err) => {
      logger.error({ erro: err.message }, 'Erro ao enviar email alert')
    })
  }
}

/**
 * Envia alerta via Slack.
 *
 * @private
 */
async function enviarSlackAlert(alerta) {
  const webhook = process.env.ALERT_SLACK_WEBHOOK
  if (!webhook) return

  const cor = alerta.estado === 'erro' ? 'danger' : 'warning'
  const payload = {
    attachments: [
      {
        color: cor,
        title: `ARTSOFT Sync Failure - ${alerta.empresa_nome}`,
        fields: [
          {
            title: 'Empresa ID',
            value: alerta.empresaId.toString(),
            short: true,
          },
          {
            title: 'Estado',
            value: alerta.estado,
            short: true,
          },
          {
            title: 'Erro',
            value: alerta.erro,
            short: false,
          },
          {
            title: 'Timestamp',
            value: alerta.timestamp,
            short: true,
          },
        ],
      },
    ],
  }

  const res = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    throw new Error(`Slack returned ${res.status}`)
  }
}

/**
 * Envia alerta via Email.
 *
 * @private
 * Nota: Implementação stub — integrar com SendGrid/AWS SES/etc.
 */
async function enviarEmailAlert(alerta) {
  const to = process.env.ALERT_EMAIL_TO
  if (!to) return

  const subject = `ARTSOFT Sync Failure: ${alerta.empresa_nome}`
  const body = `
Empresa: ${alerta.empresa_nome} (ID: ${alerta.empresaId})
Estado: ${alerta.estado}
Erro: ${alerta.erro}
Timestamp: ${alerta.timestamp}

Please investigate and check logistics.sincronizacao_execucao for details.
  `

  // TODO: Integrar com SendGrid/AWS SES/nodemailer
  logger.info({ to, subject }, 'Email alert (stub — not implemented)')

  // Stub: apenas log
  return Promise.resolve()
}

/**
 * Verificar health da sincronização (para monitoring).
 *
 * @param {object} client  PostgreSQL client
 * @param {number} empresaId
 * @returns {Promise<{healthy: boolean, lastSync: Date, estado: string}>}
 */
export async function checkSyncHealth(client, empresaId) {
  const res = await client.query(
    `
    SELECT criado_em, estado
    FROM logistics.sincronizacao_execucao
    WHERE empresa_id = $1
    ORDER BY criado_em DESC
    LIMIT 1
    `,
    [empresaId]
  )

  if (res.rows.length === 0) {
    return {
      healthy: false,
      lastSync: null,
      estado: 'nunca_sincronizado',
      diadesdeUltimaSincronizacao: null,
    }
  }

  const row = res.rows[0]
  const agora = new Date()
  const diasDesdeSync = Math.floor(
    (agora - row.criado_em) / (1000 * 60 * 60 * 24)
  )

  return {
    healthy: row.estado === 'completo' && diasDesdeSync < 1,
    lastSync: row.criado_em,
    estado: row.estado,
    diasDesdeUltimaSincronizacao: diasDesdeSync,
  }
}
