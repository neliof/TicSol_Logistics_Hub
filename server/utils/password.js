/**
 * Utilitários de senha com bcryptjs.
 *
 * Portado de TICSOL_HUB_Central / python passlib.
 * Sempre usar bcrypt.hashSync/compareSync (síncrono simples para web server).
 */

import bcrypt from 'bcryptjs'

const ROUNDS = 10  // Custo computacional (recomendado: 10-12)

/**
 * Hash de uma senha em plaintext.
 *
 * @param {string} senha
 * @returns {string} hash bcrypt
 * @throws {Error} se senha inválida
 */
export function hashPassword(senha) {
  if (!senha || typeof senha !== 'string') {
    throw new Error('Senha inválida: esperado string não-vazia')
  }
  if (senha.length < 6) {
    throw new Error('Senha muito curta: mínimo 6 caracteres')
  }
  if (senha.length > 100) {
    throw new Error('Senha muito comprida: máximo 100 caracteres')
  }
  return bcrypt.hashSync(senha, ROUNDS)
}

/**
 * Verifica uma senha contra hash.
 *
 * @param {string} senha
 * @param {string} hash
 * @returns {boolean}
 */
export function verifyPassword(senha, hash) {
  if (!senha || !hash) return false
  try {
    return bcrypt.compareSync(senha, hash)
  } catch (err) {
    // Hash inválido ou corrompido
    return false
  }
}

/**
 * Gera seed de teste (CLI helper).
 *
 * Uso:
 *   node -e "import('./utils/password.js').then(m => console.log(m.generateTestHash('demo123')))"
 *
 * @param {string} senha
 * @returns {string} hash
 */
export function generateTestHash(senha) {
  return hashPassword(senha)
}
