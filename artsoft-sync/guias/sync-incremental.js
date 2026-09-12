/**
 * Sincronização incremental: importa apenas guias modificadas desde última sync.
 *
 * Filtro adicional: DataDocum >= guias.ultima_sincronizacao
 * Atualiza timestamp após sucesso.
 *
 * Benefícios:
 * - Mais rápido (segundos vs minutos)
 * - Menos bandwidth
 * - Menos carga DB
 *
 * Cuidados:
 * - Requer DataDocum em todos registos
 * - Não detecta deletes
 * - Clock skew pode falhar
 */

import { texto } from '../artsoft/xml.js'
import { normalizarDataArtsoft } from '../config/series.js'

/**
 * Obtém última data de sincronização.
 *
 * @param {object} client
 * @param {number} empresaId
 * @returns {Promise<Date|null>}
 */
export async function obterUltimaSincronizacao(client, empresaId) {
  const res = await client.query(
    `SELECT valor FROM logistics.configuracao
     WHERE empresa_id = $1 AND chave = $2`,
    [empresaId, 'guias.ultima_sincronizacao']
  )

  if (res.rows.length === 0) return null

  const valor = res.rows[0].valor
  if (!valor) return null

  try {
    const data = new Date(valor)
    if (isNaN(data.getTime())) return null
    return data
  } catch {
    return null
  }
}

/**
 * Atualiza marca de última sincronização.
 *
 * @param {object} client
 * @param {number} empresaId
 * @param {Date} data
 * @returns {Promise<void>}
 */
export async function atualizarUltimaSincronizacao(client, empresaId, data) {
  const valor = data.toISOString()

  await client.query(
    `INSERT INTO logistics.configuracao (empresa_id, chave, valor)
     VALUES ($1, $2, $3)
     ON CONFLICT (empresa_id, chave) DO UPDATE
     SET valor = $3`,
    [empresaId, 'guias.ultima_sincronizacao', valor]
  )
}

/**
 * Constrói filtro incremental para query ARTSOFT.
 *
 * Se última_sincronizacao existe, adiciona: DataDocum >= data
 * Senão: importar tudo (full sync).
 *
 * @param {string} filtroBase    ex: "DocFch|V960;V980"
 * @param {Date|null} ultima
 * @param {string} formato       'ddmmaaaa' ou 'aaaammdd'
 * @returns {string}             filtro com data
 */
export function construirFiltroIncremental(filtroBase, ultima, formato = 'ddmmaaaa') {
  if (!ultima) {
    // Full sync: sem filtro adicional
    return filtroBase
  }

  const dataFormatada = normalizarDataArtsoft(ultima, formato)
  if (!dataFormatada) {
    // Data inválida: fallback full sync
    return filtroBase
  }

  // Adicionar condição: DataDocum >= data
  // Nota: Sintaxe pode variar per ARTSOFT version
  // Testar: "DocFch|V960;V980 AND DataDocum>=20260903"
  return `${filtroBase} AND DataDocum>=${dataFormatada}`
}

/**
 * Wrapper de sincronização incremental.
 *
 * Uso: trocar sincronizarGuias por sincronizarGuiasIncremental
 * (mesma assinatura, comportamento incremental automático).
 *
 * @param {object} client
 * @param {number} empresaId
 * @param {object} options
 * @returns {Promise<resultado>}
 */
// Estados de sincronizacao_execucao que representam sucesso (ver CHECK em
// database/07_guias_transporte.sql). 'completo' NUNCA é produzido pelo sync
// real — comparar contra esse valor fazia a marca de incremental nunca
// avançar, mesmo quando tudo corria bem.
const ESTADOS_SUCESSO = ['ok']

/**
 * Sincroniza com retry e backoff exponencial. Cada tentativa falhada espera
 * o dobro da anterior antes de repetir (1s, 2s, 4s por default).
 *
 * @param {() => Promise<object>} tentativa
 * @param {object} opcoes
 * @param {number} [opcoes.maxTentativas=3]
 * @param {number} [opcoes.esperaBaseMs=1000]
 * @param {(msg: string) => void} [opcoes.logger]
 * @returns {Promise<object>}
 */
async function comRetry(tentativa, { maxTentativas = 3, esperaBaseMs = 1000, logger = () => {} } = {}) {
  let ultimoErro
  for (let i = 1; i <= maxTentativas; i++) {
    try {
      return await tentativa()
    } catch (erro) {
      ultimoErro = erro
      if (i < maxTentativas) {
        const espera = esperaBaseMs * 2 ** (i - 1)
        logger(`Tentativa ${i}/${maxTentativas} falhou (${erro.message}). Nova tentativa em ${espera}ms…`)
        await new Promise((resolve) => setTimeout(resolve, espera))
      }
    }
  }
  throw ultimoErro
}

export async function sincronizarGuiasIncremental(client, empresaId, options = {}) {
  const { sincronizarGuias } = await import('./sync.js')
  const logger = options.logger || (() => {})
  const inicioExecucao = new Date()

  logger('Verificando última sincronização…')
  const ultima = await obterUltimaSincronizacao(client, empresaId)

  const syncOptions = { ...options }

  if (ultima) {
    const diasDesde = Math.floor((Date.now() - ultima.getTime()) / (1000 * 60 * 60 * 24))
    logger(`Última sincronização: ${ultima.toISOString()} (${diasDesde} dias atrás)`)
    logger('Modo: incremental (apenas desde a última sincronização com sucesso)')
    // Liga de facto o filtro incremental — antes a data nunca era passada
    // para sincronizarGuias, que fazia sempre o full sync de dias_retroativos
    // mesmo quando havia uma marca de sincronização recente.
    syncOptions.dataInicio = ultima
    syncOptions.dataFim = inicioExecucao
  } else {
    logger('Nenhuma sincronização anterior → Modo: full sync (janela de dias_retroativos)')
  }

  const resultado = await comRetry(() => sincronizarGuias(client, empresaId, syncOptions), {
    maxTentativas: options.maxTentativas ?? 3,
    esperaBaseMs: options.esperaBaseMs ?? 1000,
    logger,
  })

  if (ESTADOS_SUCESSO.includes(resultado.ultima_execucao.estado)) {
    logger('Atualizando marca de última sincronização…')
    await atualizarUltimaSincronizacao(client, empresaId, inicioExecucao)
  } else {
    logger(`Sync com estado '${resultado.ultima_execucao.estado}' → não atualizar marca (retry na próxima execução)`)
  }

  return resultado
}

/**
 * Limpar marca (reset para full sync).
 *
 * Uso: node -e "import('./sync-incremental.js').then(m => m.resetarSincronizacao(...))"
 *
 * @param {object} client
 * @param {number} empresaId
 * @returns {Promise<void>}
 */
export async function resetarSincronizacao(client, empresaId) {
  await client.query(
    `DELETE FROM logistics.configuracao
     WHERE empresa_id = $1 AND chave = $2`,
    [empresaId, 'guias.ultima_sincronizacao']
  )
}
