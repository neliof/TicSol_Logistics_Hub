/**
 * Rate limiting para proteção contra brute-force e DoS.
 *
 * Limites:
 * - /auth/login: 5 tentativas / 15 minutos por IP
 * - /api/artsoft/guias/sync: 2 / 5 minutos por usuario
 * - /rest/v1/*: 100 / 15 minutos por usuario
 */

import rateLimit from 'express-rate-limit'
import RedisStore from 'rate-limit-redis'
import redis from 'redis'

// Store em memória (production: usar Redis)
const store = new Map()

function getMemoryStore() {
  return {
    increment(key) {
      const now = Date.now()
      const data = store.get(key) || { count: 0, resetTime: now + 15 * 60 * 1000 }

      if (now > data.resetTime) {
        data.count = 0
        data.resetTime = now + 15 * 60 * 1000
      }

      data.count++
      store.set(key, data)

      return {
        totalHits: data.count,
        resetTime: new Date(data.resetTime),
      }
    },

    resetKey(key) {
      store.delete(key)
    },
  }
}

/**
 * Rate limiter para /auth/login (brute force protection).
 *
 * 5 tentativas / 15 minutos por IP
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  store: getMemoryStore(),
  skip: (req) => process.env.RATE_LIMIT_ENABLED === 'false',
})

/**
 * Rate limiter para /api/artsoft/guias/sync (prevent abuse).
 *
 * 2 requests / 5 minutos por usuario
 */
export const syncLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 2,
  message: 'Muitas requisições de sync. Limite: 2 por 5 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?.usuario_id || req.ip}`,
  store: getMemoryStore(),
  skip: (req) => process.env.RATE_LIMIT_ENABLED === 'false',
})

/**
 * Rate limiter para /rest/v1/* (API general).
 *
 * 100 requests / 15 minutos por usuario
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Muitas requisições. Limite de taxa excedido.',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?.usuario_id || req.ip}`,
  store: getMemoryStore(),
  skip: (req) => process.env.RATE_LIMIT_ENABLED === 'false',
})

/**
 * Criar limiter com Redis (para production + multi-instance).
 *
 * Uso:
 *   const redisClient = redis.createClient({...})
 *   const limiter = createRedisLimiter(redisClient, {...})
 *   app.post('/auth/login', limiter, ...)
 */
export function createRedisLimiter(redisClient, options) {
  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:',
    }),
    ...options,
  })
}
