-- ============================================================
-- Migração 023: Promover campos financeiros/lote de dados_extra
-- para colunas próprias em logistics.linha_documento
-- ============================================================
-- Problema (auditoria docs/AUDITORIA_DADOS_2026-09.md, achado #11):
-- valor_unitario, iva, desconto, total_liquido, lote e data_validade
-- eram capturados do ARTSOFT mas só guardados dentro do JSONB
-- dados_extra — impossível de filtrar, somar ou indexar em SQL,
-- inviabilizando relatórios financeiros e FEFO diretos sobre a guia.
--
-- Também corrige logistics.linha_documento.produto_id, que nunca era
-- preenchido (a função resolverProdutoId existia mas nunca era chamada).
-- ============================================================

BEGIN;

ALTER TABLE logistics.linha_documento
  ADD COLUMN IF NOT EXISTS valor_unitario      numeric(14,4),
  ADD COLUMN IF NOT EXISTS iva_percentual      numeric(6,3),
  ADD COLUMN IF NOT EXISTS desconto_percentual numeric(6,3),
  ADD COLUMN IF NOT EXISTS total_liquido       numeric(14,4),
  ADD COLUMN IF NOT EXISTS lote                varchar(60),
  ADD COLUMN IF NOT EXISTS data_validade       date;

CREATE INDEX IF NOT EXISTS idx_linha_documento_lote ON logistics.linha_documento(lote) WHERE lote IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_linha_documento_validade ON logistics.linha_documento(data_validade) WHERE data_validade IS NOT NULL;

COMMENT ON COLUMN logistics.linha_documento.valor_unitario IS
  'Preço unitário bruto da linha (ARTSOFT Val.UnBru). Promovido de dados_extra em 023.';
COMMENT ON COLUMN logistics.linha_documento.iva_percentual IS
  'Taxa de IVA da linha (ARTSOFT IVA.Taxa). Promovido de dados_extra em 023.';
COMMENT ON COLUMN logistics.linha_documento.desconto_percentual IS
  'Desconto de linha (ARTSOFT Desc.Lin0). Promovido de dados_extra em 023.';
COMMENT ON COLUMN logistics.linha_documento.total_liquido IS
  'Total líquido da linha (ARTSOFT Val.TtLiqEx). Promovido de dados_extra em 023.';
COMMENT ON COLUMN logistics.linha_documento.lote IS
  'Número de lote do artigo nesta linha. Promovido de dados_extra em 023; ver também logistics.lote quando produto_id resolvido.';
COMMENT ON COLUMN logistics.linha_documento.data_validade IS
  'Data de validade do lote nesta linha. Promovido de dados_extra em 023.';

COMMIT;
