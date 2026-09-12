-- ============================================================
-- Migração 024: Persistência real para Stock (P3)
-- ============================================================
-- Problema (auditoria docs/AUDITORIA_DADOS_2026-09.md): 3 de 6
-- endpoints de stock-endpoints.js eram stubs — reconciliação calculada
-- em memória sem gravar, status de lote "não implementado ainda",
-- alertas fabricados com Date.now() sem persistir.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS logistics.stock_reconciliacao (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcao_id         uuid NOT NULL REFERENCES logistics.recepcao(id) ON DELETE CASCADE,
  total_esperado      numeric NOT NULL,
  total_fisico        numeric NOT NULL,
  diferenca_total     numeric NOT NULL,
  items_reconciliados jsonb NOT NULL,
  status              varchar(20) NOT NULL DEFAULT 'CONCLUIDA',
  operador            varchar(120),
  criado_em           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_reconciliacao_recepcao ON logistics.stock_reconciliacao(recepcao_id);

ALTER TABLE logistics.stock_reconciliacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_stock_reconciliacao ON logistics.stock_reconciliacao;
CREATE POLICY rls_stock_reconciliacao ON logistics.stock_reconciliacao
  USING (
    recepcao_id IN (SELECT id FROM logistics.recepcao WHERE empresa_id = logistics.jwt_empresa_id_segura())
  )
  WITH CHECK (
    recepcao_id IN (SELECT id FROM logistics.recepcao WHERE empresa_id = logistics.jwt_empresa_id_segura())
  );

CREATE TABLE IF NOT EXISTS logistics.stock_alerta (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id     uuid NOT NULL REFERENCES logistics.empresa(id),
  tipo           varchar(50) NOT NULL,
  descricao      text NOT NULL,
  severidade     varchar(20) NOT NULL DEFAULT 'MEDIA' CHECK (severidade IN ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA')),
  artigo_codigo  varchar(60),
  quantidade     numeric,
  operador       varchar(120),
  status         varchar(20) NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ANALISE', 'RESOLVIDO', 'IGNORADO')),
  criado_em      timestamptz NOT NULL DEFAULT now(),
  resolvido_em   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_stock_alerta_status ON logistics.stock_alerta(status);

ALTER TABLE logistics.stock_alerta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rls_stock_alerta ON logistics.stock_alerta;
CREATE POLICY rls_stock_alerta ON logistics.stock_alerta
  USING (empresa_id = logistics.jwt_empresa_id())
  WITH CHECK (empresa_id = logistics.jwt_empresa_id());

-- recepcao_lote ganha estado próprio para PATCH /stock/lote/:id/status
-- (antes não tinha coluna nenhuma para persistir uma mudança de status)
ALTER TABLE logistics.recepcao_lote
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'OK'
  CHECK (status IN ('OK', 'QUARENTENA', 'BLOQUEADO', 'CONSUMIDO'));

COMMIT;
