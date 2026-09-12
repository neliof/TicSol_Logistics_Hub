-- ============================================================
-- Migração 026: GRANT em falta para app_user (bug de deployment real)
-- ============================================================
-- Encontrado ao testar as migrações 020-025 contra Postgres real: a
-- aplicação (server/*.js) liga-se como app_user (não-superuser, ver
-- database/08_app_user_rls.sql), mas nenhuma migração desde então deu
-- GRANT explícito a app_user nas tabelas novas. Resultado real testado:
--
--   ERRO: permission denied for table recepcao
--
-- Causa raiz: existem dois roles com o mesmo propósito —
-- 'authenticated' (02_security.sql) tem ALTER DEFAULT PRIVILEGES, que
-- cobre tabelas futuras automaticamente; 'app_user' (08_app_user_rls.sql)
-- só tem um GRANT estático nas tabelas que existiam nesse momento — sem
-- default privileges, tabelas criadas depois (020, 022, 024, 025, e
-- quaisquer futuras) ficam inacessíveis a app_user até correr este tipo
-- de GRANT manual.
--
-- Corrige as tabelas já criadas E configura default privileges para que
-- isto não se repita em migrações futuras.
-- ============================================================

BEGIN;

-- Tabelas do módulo P1 (receção/paletização, 020_recepcao_schema.sql)
GRANT SELECT, INSERT, UPDATE ON
  logistics.recepcao,
  logistics.recepcao_documento,
  logistics.recepcao_divergencia,
  logistics.recepcao_lote,
  logistics.recepcao_palete,
  logistics.palete_movimento,
  logistics.recepcao_artsoft_integracao,
  logistics.recepcao_auditoria
TO app_user;

-- Tabelas de expedição (022_expedicao_schema.sql)
GRANT SELECT, INSERT, UPDATE ON
  logistics.documento_numeracao,
  logistics.expedicao_conferencia,
  logistics.expedicao_rastreamento
TO app_user;
GRANT USAGE ON SCHEMA logistics TO app_user; -- idempotente, já existia

-- Tabelas de stock (024_stock_schema.sql)
GRANT SELECT, INSERT, UPDATE ON
  logistics.stock_reconciliacao,
  logistics.stock_alerta
TO app_user;

-- Auditoria genérica (025_auditoria_evento.sql)
GRANT SELECT, INSERT ON logistics.auditoria_evento TO app_user;

-- Funções usadas pelos endpoints via app_user
GRANT EXECUTE ON FUNCTION logistics.jwt_empresa_id_segura() TO app_user;
GRANT EXECUTE ON FUNCTION logistics.proximo_numero_documento(uuid, varchar, logistics.tipo_documento) TO app_user;

-- Default privileges: cobre tabelas/funções criadas por 'postgres' a
-- partir de agora, para não repetir este bug em migrações futuras.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA logistics
  GRANT SELECT, INSERT, UPDATE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA logistics
  GRANT EXECUTE ON FUNCTIONS TO app_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA logistics
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

COMMIT;
