/**
 * Testes para password hashing e verification.
 *
 * npm test -- server/test/password.test.js
 */

import assert from 'assert'
import { hashPassword, verifyPassword, generateTestHash } from '../utils/password.js'

describe('password.js', () => {
  describe('hashPassword()', () => {
    it('gera hash bcrypt válido', () => {
      const hash = hashPassword('teste123')
      assert.ok(hash)
      assert.ok(hash.startsWith('$2b$'))
      assert.strictEqual(hash.length, 60)
    })

    it('rejeita senha vazia', () => {
      assert.throws(
        () => hashPassword(''),
        /Senha inválida/
      )
    })

    it('rejeita senha muito curta', () => {
      assert.throws(
        () => hashPassword('123'),
        /Senha muito curta/
      )
    })

    it('rejeita senha muito comprida', () => {
      assert.throws(
        () => hashPassword('x'.repeat(101)),
        /Senha muito comprida/
      )
    })

    it('gera hashes diferentes para mesma senha', () => {
      const hash1 = hashPassword('teste123')
      const hash2 = hashPassword('teste123')
      assert.notStrictEqual(hash1, hash2)  // bcrypt usa salt aleatório
    })
  })

  describe('verifyPassword()', () => {
    it('verifica senha correta', () => {
      const senha = 'teste123'
      const hash = hashPassword(senha)
      assert.ok(verifyPassword(senha, hash))
    })

    it('rejeita senha incorreta', () => {
      const hash = hashPassword('teste123')
      assert.ok(!verifyPassword('teste456', hash))
    })

    it('rejeita hash nulo', () => {
      assert.ok(!verifyPassword('teste123', null))
    })

    it('rejeita senha nula', () => {
      const hash = hashPassword('teste123')
      assert.ok(!verifyPassword(null, hash))
    })

    it('tolera hash inválido', () => {
      assert.ok(!verifyPassword('teste123', 'hash_invalido'))
    })
  })

  describe('generateTestHash()', () => {
    it('gera hash para seed de teste', () => {
      const hash = generateTestHash('demo123')
      assert.ok(hash)
      assert.ok(verifyPassword('demo123', hash))
    })
  })
})
