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

-- Policy: documento — handled by 07_guias_transporte.sql (isolamento_empresa uses jwt_empresa_id)
-- Removido INT policy para evitar conflito: empresa_id é UUID, não INT

-- Policy: linha_documento — handled by 07_guias_transporte.sql (isolamento_empresa uses jwt_empresa_id)
-- Removido INT policy para evitar conflito

-- Policies for configuracao, mapeamento_campo, sincronizacao_execucao
-- handled by 07_guias_transporte.sql (isolamento_empresa uses jwt_empresa_id)
-- Removidas INT policies para evitar conflito com UUID comparações

-- Obsoleto: app agora usa JWT (07_guias_transporte.sql) em vez de set_empresa_context
-- JWT approach: middleware seta request.jwt.claims com empresa_id UUID
-- DROP FUNCTION IF EXISTS logistics.set_empresa_context(INT);
