-- ============================================================================
-- TicSol Logistics Hub — 06_artsoft_sync_staging.sql
-- Suporte à sincronização ARTSOFT (Produtos, Clientes, Fornecedores, Stock)
-- Depende de: 01_schema.sql
--
-- Nota de arquitetura: PRODUTO, CLIENTE e FORNECEDOR já existem no schema
-- (Secção 3) e são o destino direto do sync — a chave natural para upsert
-- é codigo_interno. Só falta destino para o STOCK, porque o MOVIMENTO do
-- Logistics Hub é o livro-razão dos movimentos FÍSICOS do armazém (Secção
-- 8), não o stock contabilístico do ARTSOFT — não se deve sobrepor um ao
-- outro às cegas. Por isso o stock do ARTSOFT aterra numa tabela de
-- staging, para comparação/reconciliação, não substituição direta.
-- ============================================================================
SET search_path TO logistics, public;

CREATE TABLE IF NOT EXISTS logistics.artsoft_stock_snapshot (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    produto_id          uuid NOT NULL REFERENCES logistics.produto(id),
    quantidade_artsoft  numeric(12,3) NOT NULL,
    origem              varchar(20) NOT NULL DEFAULT 'sync', -- rest|odbc|file, o conector que trouxe o valor
    data_sync           timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, produto_id, data_sync)
);
CREATE INDEX IF NOT EXISTS idx_artsoft_stock_produto ON logistics.artsoft_stock_snapshot(produto_id, data_sync DESC);

-- Vista de reconciliação: compara o último snapshot ARTSOFT com o stock
-- físico real do WMS (soma de CAIXA disponível por produto). Não decide
-- automaticamente qual está certo — só expõe a diferença para revisão.
CREATE OR REPLACE VIEW logistics.vw_reconciliacao_stock AS
WITH ultimo_snapshot AS (
    SELECT DISTINCT ON (produto_id) produto_id, quantidade_artsoft, data_sync, origem
    FROM logistics.artsoft_stock_snapshot
    ORDER BY produto_id, data_sync DESC
),
stock_wms AS (
    SELECT produto_id, count(*) AS quantidade_wms
    FROM logistics.caixa
    WHERE estado = 'disponivel'
    GROUP BY produto_id
)
SELECT
    p.id AS produto_id,
    p.sku_interno,
    p.descricao,
    coalesce(sw.quantidade_wms, 0) AS quantidade_wms,
    us.quantidade_artsoft,
    us.data_sync AS ultima_sincronizacao,
    us.origem AS conector_usado,
    coalesce(sw.quantidade_wms, 0) - coalesce(us.quantidade_artsoft, 0) AS diferenca
FROM logistics.produto p
LEFT JOIN stock_wms sw ON sw.produto_id = p.id
LEFT JOIN ultimo_snapshot us ON us.produto_id = p.id;

-- Permissões
GRANT SELECT, INSERT ON logistics.artsoft_stock_snapshot TO authenticated;
GRANT SELECT ON logistics.vw_reconciliacao_stock TO authenticated;
ALTER TABLE logistics.artsoft_stock_snapshot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.artsoft_stock_snapshot;
CREATE POLICY isolamento_empresa ON logistics.artsoft_stock_snapshot
    USING (empresa_id = logistics.jwt_empresa_id())
    WITH CHECK (empresa_id = logistics.jwt_empresa_id());
