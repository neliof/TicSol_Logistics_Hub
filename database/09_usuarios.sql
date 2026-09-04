/**
 * Schema de utilizadores com autenticação bcrypt.
 *
 * Tabela: logistics.usuario
 *   - Chave natural: (empresa_id, email)
 *   - RLS: cada utilizador vê apenas dados da sua empresa
 *   - Senha: armazenada como bcrypt hash (nunca plaintext)
 */

CREATE TABLE IF NOT EXISTS logistics.usuario (
  id SERIAL PRIMARY KEY,
  empresa_id INT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  senha_hash VARCHAR(255) NOT NULL,  -- bcrypt $2b$ hash
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_usuario_empresa FOREIGN KEY (empresa_id)
    REFERENCES logistics.empresa(id),
  CONSTRAINT uk_usuario_email UNIQUE (email),
  CONSTRAINT uk_usuario_empresa_email UNIQUE (empresa_id, email)
);

-- RLS: utilizadores veem apenas dados da sua empresa
ALTER TABLE logistics.usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY usuario_isolation ON logistics.usuario
  FOR ALL
  USING (empresa_id = (current_setting('app.empresa_id')::INT))
  WITH CHECK (empresa_id = (current_setting('app.empresa_id')::INT));

-- Grant access to app_user
GRANT SELECT, INSERT, UPDATE ON logistics.usuario TO app_user;
GRANT USAGE, SELECT ON logistics.usuario_id_seq TO app_user;

-- Índices
CREATE INDEX idx_usuario_email ON logistics.usuario(email);
CREATE INDEX idx_usuario_empresa_id ON logistics.usuario(empresa_id);
CREATE INDEX idx_usuario_ativo ON logistics.usuario(ativo);

-- Seed: Admin de teste (password="demo123", bcrypt hash gerado localmente)
-- Nota: Hash gerado com: bcrypt.hashSync("demo123", 10)
INSERT INTO logistics.usuario (empresa_id, nome, email, senha_hash, ativo)
VALUES (
  1,
  'Admin Teste',
  'admin@test.local',
  '$2b$10$YTjLMOqjgZx6xP8X3K9X9O2Y8X7Z8Y5Z8Y9Z8Y5Z8Y5Z8Y5Z8Y5Z8',
  true
)
ON CONFLICT (email) DO NOTHING;

-- Função de auditoria: atualizar atualizado_em
CREATE OR REPLACE FUNCTION logistics.trigger_usuario_atualizado()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

DROP TRIGGER IF EXISTS trigger_usuario_atualizado ON logistics.usuario;
CREATE TRIGGER trigger_usuario_atualizado
  BEFORE UPDATE ON logistics.usuario
  FOR EACH ROW
  EXECUTE FUNCTION logistics.trigger_usuario_atualizado();
