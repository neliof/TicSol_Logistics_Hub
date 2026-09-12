-- ============================================================
-- Migração 022: Schema real para Expedição (P4)
-- ============================================================
-- Problema (auditoria docs/AUDITORIA_DADOS_2026-09.md, achado #7):
-- 5 de 6 endpoints de expedicao-endpoints.js eram stubs que fabricavam
-- respostas em memória (Date.now(), Math.random()) sem persistir nada.
-- logistics.documento não tinha coluna de estado, o que impedia
-- estruturalmente qualquer persistência de transição de estado.
--
-- Esta migração:
--   1. adiciona estado a logistics.documento;
--   2. cria numeração sequencial real para substituir Math.random();
--   3. cria expedicao_conferencia e expedicao_rastreamento, ligadas a
--      logistics.documento (não a logistics.recepcao, que é do módulo P1
--      e não deveria ser reaproveitada como base de expedição).
-- ============================================================

BEGIN;

-- 1. Estado do documento (necessário para PATCH /expedicao/:id/status)
ALTER TABLE logistics.documento
  ADD COLUMN IF NOT EXISTS estado varchar(20) NOT NULL DEFAULT 'PENDENTE'
  CHECK (estado IN ('PENDENTE', 'PREPARADA', 'EXPEDIDA', 'EM_TRANSITO', 'ENTREGUE', 'CANCELADA'));

CREATE INDEX IF NOT EXISTS idx_documento_estado ON logistics.documento(estado);

-- 2. Numeração sequencial real (substitui Math.random() em
--    POST /expedicao/:id/documento) — uma sequência por empresa+série+tipo
CREATE TABLE IF NOT EXISTS logistics.documento_numeracao (
  empresa_id      uuid NOT NULL REFERENCES logistics.empresa(id),
  serie           varchar(20) NOT NULL,
  tipo            tipo_documento NOT NULL,
  ultimo_numero   bigint NOT NULL DEFAULT 0,
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (empresa_id, serie, tipo)
);

ALTER TABLE logistics.documento_numeracao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_documento_numeracao ON logistics.documento_numeracao;
CREATE POLICY rls_documento_numeracao ON logistics.documento_numeracao
  USING (empresa_id = logistics.jwt_empresa_id())
  WITH CHECK (empresa_id = logistics.jwt_empresa_id());

-- Atribui e persiste o próximo número da série de forma atómica
-- (INSERT ... ON CONFLICT evita race condition entre pedidos concorrentes).
CREATE OR REPLACE FUNCTION logistics.proximo_numero_documento(
  p_empresa_id uuid, p_serie varchar, p_tipo tipo_documento
) RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  novo_numero bigint;
BEGIN
  INSERT INTO logistics.documento_numeracao (empresa_id, serie, tipo, ultimo_numero, atualizado_em)
  VALUES (p_empresa_id, p_serie, p_tipo, 1, now())
  ON CONFLICT (empresa_id, serie, tipo)
  DO UPDATE SET ultimo_numero = logistics.documento_numeracao.ultimo_numero + 1,
                atualizado_em = now()
  RETURNING ultimo_numero INTO novo_numero;

  RETURN novo_numero;
END;
$$;

-- 3. Conferência de expedição (por palete, antes do envio)
CREATE TABLE IF NOT EXISTS logistics.expedicao_conferencia (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id          uuid NOT NULL REFERENCES logistics.documento(id) ON DELETE CASCADE,
  palete_sscc           varchar(30) NOT NULL,
  quantidade_conferida  numeric NOT NULL,
  observacoes           text,
  operador              varchar(120),
  criado_em             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expedicao_conferencia_documento ON logistics.expedicao_conferencia(documento_id);

ALTER TABLE logistics.expedicao_conferencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_expedicao_conferencia ON logistics.expedicao_conferencia;
CREATE POLICY rls_expedicao_conferencia ON logistics.expedicao_conferencia
  USING (
    documento_id IN (
      SELECT id FROM logistics.documento WHERE empresa_id = logistics.jwt_empresa_id()
    )
  )
  WITH CHECK (
    documento_id IN (
      SELECT id FROM logistics.documento WHERE empresa_id = logistics.jwt_empresa_id()
    )
  );

-- 4. Rastreamento de expedição (timeline de eventos)
CREATE TABLE IF NOT EXISTS logistics.expedicao_rastreamento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id  uuid NOT NULL REFERENCES logistics.documento(id) ON DELETE CASCADE,
  evento        varchar(30) NOT NULL,
  localizacao   varchar(120),
  descricao     text NOT NULL,
  operador      varchar(120),
  criado_em     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expedicao_rastreamento_documento ON logistics.expedicao_rastreamento(documento_id);

ALTER TABLE logistics.expedicao_rastreamento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_expedicao_rastreamento ON logistics.expedicao_rastreamento;
CREATE POLICY rls_expedicao_rastreamento ON logistics.expedicao_rastreamento
  USING (
    documento_id IN (
      SELECT id FROM logistics.documento WHERE empresa_id = logistics.jwt_empresa_id()
    )
  )
  WITH CHECK (
    documento_id IN (
      SELECT id FROM logistics.documento WHERE empresa_id = logistics.jwt_empresa_id()
    )
  );

-- 5. Paletes associadas a um documento de expedição (liga palete a documento
--    de saída; palete já existe no schema principal — só falta a ligação)
ALTER TABLE logistics.palete
  ADD COLUMN IF NOT EXISTS documento_expedicao_id uuid REFERENCES logistics.documento(id);

CREATE INDEX IF NOT EXISTS idx_palete_documento_expedicao ON logistics.palete(documento_expedicao_id);

COMMIT;
