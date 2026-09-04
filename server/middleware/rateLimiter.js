/**
 * Rate limiting para proteção contra brute-force e DoS.
 *
 * Limites:
 * - /auth/login: 5 tentativas / 15 minutos por IP
 * - /api/artsoft/guias/sync: 2 / 5 minutos por usuario
 * - /rest/v1/*: 100 / 15 minutos por usuario
 */

import rateLimit from 'express-rate-limit'

// Sem `store` explícito, o express-rate-limit usa o seu MemoryStore interno —
// suficiente para uma instância única. Para várias instâncias, ver
// createRedisLimiter() no fim deste ficheiro.

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
  skip: (req) => process.env.RATE_LIMIT_ENABLED === 'false',
})

/**
 * Criar limiter com Redis (para production + multi-instance).
 *
 * `rate-limit-redis` é uma dependência opcional: só é carregada quando esta
 * função é chamada, para que o servidor arranque em desenvolvimento (store em
 * memória) sem ter o pacote instalado.
 *
 * Uso:
 *   const redisClient = redis.createClient({...})
 *   const limiter = await createRedisLimiter(redisClient, {...})
 *   app.post('/auth/login', limiter, ...)
 */
export async function createRedisLimiter(redisClient, options) {
  const { default: RedisStore } = await import('rate-limit-redis')
  return rateLimit({
    store: new RedisStore({
      client: redisClient,
      prefix: 'rl:',
    }),
    ...options,
  })
}
