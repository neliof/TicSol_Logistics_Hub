-- ============================================================
-- Migração 028: Parar de contaminar dimensoes_caixa_mm com metadata
-- ============================================================
-- Bug encontrado ao rever artsoft-sync/produtos/mapper.js durante a
-- ligação do frontend de expedição: o UPSERT gravava o objeto "extra"
-- (codigo_opcional, unidade, peso_bruto, dias_validade — metadados sem
-- destino de coluna própria) diretamente na coluna dimensoes_caixa_mm,
-- que o schema documenta como {comprimento, largura, altura} e que
-- logistics.calcular_paletizacao lê para determinar a altura da caixa
-- (03_functions_rpc.sql:117). Como o parser de produtos nunca extraiu
-- dimensões físicas do ARTSOFT, essa coluna nunca teve a chave
-- 'altura', e calcular_paletizacao caía sempre no fallback de 300mm —
-- silenciosamente, sem erro, para todos os produtos sincronizados.
--
-- Corrige adicionando uma coluna própria para os metadados, libertando
-- dimensoes_caixa_mm para o seu propósito real (preenchido manualmente
-- ou por uma fonte futura que capture dimensões físicas de facto).
-- ============================================================

BEGIN;

ALTER TABLE logistics.produto
  ADD COLUMN IF NOT EXISTS dados_extra jsonb;

COMMENT ON COLUMN logistics.produto.dados_extra IS
  'Metadados do sync ArtSoft sem coluna própria (codigo_opcional, unidade, peso_bruto, dias_validade). Não confundir com dimensoes_caixa_mm, que é {comprimento,largura,altura} e alimenta logistics.calcular_paletizacao.';

-- Migra dados já gravados incorretamente em dimensoes_caixa_mm: se o
-- JSON não tiver nenhuma das 3 chaves de dimensão, é metadata mal
-- colocada — move para dados_extra e limpa a coluna de dimensões.
UPDATE logistics.produto
SET dados_extra = dimensoes_caixa_mm,
    dimensoes_caixa_mm = NULL
WHERE dimensoes_caixa_mm IS NOT NULL
  AND NOT (dimensoes_caixa_mm ? 'altura' OR dimensoes_caixa_mm ? 'comprimento' OR dimensoes_caixa_mm ? 'largura');

COMMIT;
