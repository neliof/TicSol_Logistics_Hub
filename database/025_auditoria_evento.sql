-- ============================================================
-- Migração 025: Auditoria genérica de aplicação
-- ============================================================
-- Problema (auditoria docs/AUDITORIA_DADOS_2026-09.md, achado #12):
-- AuditoriaModule (frontend) era alimentado por INITIAL_AUDIT_LOGS
-- (mock com dados fictícios) e todos os eventos subsequentes eram
-- gerados 100% no cliente (operador/IP fixos por handler), nunca
-- persistidos — um refresh de página apagava todo o histórico.
--
-- logistics.recepcao_auditoria (020_recepcao_schema.sql) já cobre
-- eventos ligados a uma receção específica; esta tabela cobre eventos
-- gerais da aplicação que não têm recepcao_id (transferência de stock,
-- confirmação de paletização, criação de palete de expedição, etc.)
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS logistics.auditoria_evento (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL REFERENCES logistics.empresa(id),
  operador        varchar(120) NOT NULL,
  acao            varchar(80) NOT NULL,
  tabela_afetada  varchar(120),
  detalhes        jsonb,
  ip_terminal     varchar(60),
  criado_em       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_evento_empresa_data
  ON logistics.auditoria_evento(empresa_id, criado_em DESC);

ALTER TABLE logistics.auditoria_evento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_auditoria_evento ON logistics.auditoria_evento;
CREATE POLICY rls_auditoria_evento ON logistics.auditoria_evento
  USING (empresa_id = logistics.jwt_empresa_id())
  WITH CHECK (empresa_id = logistics.jwt_empresa_id());

COMMENT ON TABLE logistics.auditoria_evento IS
  'Auditoria geral da aplicação (ações que não pertencem a uma receção específica). Nunca deve ser gerada só no cliente — ver AuditoriaModule/useAuditoria.';

COMMIT;
