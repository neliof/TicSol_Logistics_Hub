-- ============================================================================
-- Autenticação: coluna de password em logistics.utilizador
-- ============================================================================
-- O servidor consultava logistics.usuario (inexistente) e uma coluna
-- senha_hash que a tabela logistics.utilizador não tinha. Esta migração
-- alinha o schema com o código de autenticação.
-- ============================================================================

ALTER TABLE logistics.utilizador
  ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(255);

COMMENT ON COLUMN logistics.utilizador.senha_hash IS
  'Hash bcrypt da password. NULL = conta sem acesso por password.';

-- O email identifica a conta no login, logo tem de ser único.
CREATE UNIQUE INDEX IF NOT EXISTS utilizador_email_key
  ON logistics.utilizador (LOWER(email));
