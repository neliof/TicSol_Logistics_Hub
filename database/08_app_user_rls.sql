/**
 * P0-3/P0-4: Non-superuser app_user with Row Level Security
 *
 * Creates dedicated app_user (not postgres superuser) with minimal privileges.
 * All logistics tables have RLS policies enforcing empresa_id isolation.
 */

-- Create non-superuser app_user
CREATE USER app_user WITH PASSWORD 'changeme';

-- Schema privileges (limited)
GRANT USAGE ON SCHEMA logistics TO app_user;
GRANT USAGE ON SCHEMA public TO app_user;

-- Table privileges: SELECT, INSERT, UPDATE on logistics tables only
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA logistics TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA logistics TO app_user;

-- Deny DELETE (prevent accidental mass deletions, require explicit admin action)
-- Deny ALTER (only superuser can change schema)

-- Enable RLS on all tables
ALTER TABLE logistics.documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.linha_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.configuracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.mapeamento_campo ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.sincronizacao_execucao ENABLE ROW LEVEL SECURITY;

-- Set app_user as default for row policies (will be overridden by auth context)
-- For now, policies are permissive and check app context (future: JWT claims)

-- Policy: documento — empresa_id must match current_setting('app.empresa_id')
CREATE POLICY app_documento_isolation ON logistics.documento
  FOR ALL
  USING (empresa_id = (current_setting('app.empresa_id')::INT))
  WITH CHECK (empresa_id = (current_setting('app.empresa_id')::INT));

CREATE POLICY app_linha_documento_isolation ON logistics.linha_documento
  FOR ALL
  USING (
    documento_id IN (
      SELECT id FROM logistics.documento
      WHERE empresa_id = (current_setting('app.empresa_id')::INT)
    )
  )
  WITH CHECK (
    documento_id IN (
      SELECT id FROM logistics.documento
      WHERE empresa_id = (current_setting('app.empresa_id')::INT)
    )
  );

CREATE POLICY app_configuracao_isolation ON logistics.configuracao
  FOR ALL
  USING (empresa_id = (current_setting('app.empresa_id')::INT))
  WITH CHECK (empresa_id = (current_setting('app.empresa_id')::INT));

CREATE POLICY app_mapeamento_campo_isolation ON logistics.mapeamento_campo
  FOR ALL
  USING (empresa_id = (current_setting('app.empresa_id')::INT))
  WITH CHECK (empresa_id = (current_setting('app.empresa_id')::INT));

CREATE POLICY app_sincronizacao_execucao_isolation ON logistics.sincronizacao_execucao
  FOR ALL
  USING (empresa_id = (current_setting('app.empresa_id')::INT))
  WITH CHECK (empresa_id = (current_setting('app.empresa_id')::INT));

-- Function to set empresa context (called by app on each request)
CREATE OR REPLACE FUNCTION logistics.set_empresa_context(p_empresa_id INT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.empresa_id', p_empresa_id::TEXT, FALSE);
END;
$$ LANGUAGE PLPGSQL SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION logistics.set_empresa_context(INT) TO app_user;

-- Note: App must call `SELECT logistics.set_empresa_context(user_empresa_id)` after login.
-- Alternatively: use PostgREST JWT claims or connection pooler variable support.
