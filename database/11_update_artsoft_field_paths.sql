-- ============================================================================
-- UPDATE: ARTSOFT Field Paths - V26 Schema Validation
-- ============================================================================
-- Data: 2026-09-04
-- Atualiza logistics.mapeamento_campo com paths confirmados via schema DocFch/DocLan
-- ARTSOFT V26 - Series V980, V990, V998
-- ============================================================================

BEGIN;

-- Confirmar paths de cabeçalho (DocFch)
UPDATE logistics.mapeamento_campo
SET
  form_path = CASE campo
    WHEN 'serie' THEN '%DocFch.Doc.Serie'
    WHEN 'numero' THEN '%DocFch.Doc.NrDoc'
    WHEN 'data_documento' THEN '%Data.Docum'
    WHEN 'tipo_saft' THEN '%DocFch.Inf.TpSAFT'
    WHEN 'terceiro_numero' THEN '%DocFch.Ter.Terceiro'
    WHEN 'terceiro_nome' THEN '%DocFch.Ter.Nome'
    WHEN 'terceiro_morada' THEN '%DocFch.Ter.Morada'
    WHEN 'terceiro_localidade' THEN '%DocFch.Ter.Localid'
    WHEN 'terceiro_codigo_postal' THEN '%DocFch.Ter.CPostAlfa'

    -- Campos logísticos (Inf.* e Log.*)
    WHEN 'matricula' THEN '%Inf.Matricula'
    WHEN 'peso_bruto' THEN '%Log.PesoBr'
    WHEN 'peso_liquido' THEN '%Log.PesoLiq'
    WHEN 'volume_total' THEN '%Log.Volume'
    WHEN 'num_volumes' THEN '%Log.NrVol'

    -- Campos de data/hora de carga e descarga (Doc.*)
    WHEN 'data_carga' THEN '%Doc.DataCarga'
    WHEN 'hora_carga' THEN '%Doc.HoraCarga'
    WHEN 'data_descarga' THEN '%Doc.DataPrevistDescarga'
    WHEN 'hora_descarga' THEN '%Doc.HoraPrevistDescarga'

    -- Locais de carga/descarga (Doc.*)
    WHEN 'local_carga' THEN '%Doc.LocCarga'
    WHEN 'local_descarga' THEN '%Doc.LocDesc'
  END,
  ativo = true,
  updated_at = NOW()
WHERE empresa_id = (SELECT id FROM logistics.empresa WHERE nome = 'Empresa Teste' LIMIT 1)
  AND campo IN (
    'serie', 'numero', 'data_documento', 'tipo_saft',
    'terceiro_numero', 'terceiro_nome', 'terceiro_morada',
    'terceiro_localidade', 'terceiro_codigo_postal',
    'matricula', 'peso_bruto', 'peso_liquido', 'volume_total', 'num_volumes',
    'data_carga', 'hora_carga', 'data_descarga', 'hora_descarga',
    'local_carga', 'local_descarga'
  )
  AND form_path IS NOT NULL;

-- Confirmar paths de linhas (DocLan)
UPDATE logistics.mapeamento_campo
SET
  form_path = CASE campo
    WHEN 'artigo_codigo' THEN '%DocLan.Cod.Codigo'
    WHEN 'descricao' THEN '%DocLan.Div.Descric'
    WHEN 'quantidade' THEN '%DocLan.Qtd.Real'
    WHEN 'quantidade_unidade' THEN '%DocLan.Qtd.Unit'
    WHEN 'volume_linha' THEN '%DocLan.Div.VolTT'
    WHEN 'peso_bruto_linha' THEN '%DocLan.Div.PBrTT'
    WHEN 'peso_liquido_linha' THEN '%DocLan.Div.PLqTT'
    WHEN 'num_embalagens' THEN '%DocLan.Div.NrEmb'
  END,
  ativo = true,
  updated_at = NOW()
WHERE empresa_id = (SELECT id FROM logistics.empresa WHERE nome = 'Empresa Teste' LIMIT 1)
  AND campo IN (
    'artigo_codigo', 'descricao', 'quantidade', 'quantidade_unidade',
    'volume_linha', 'peso_bruto_linha', 'peso_liquido_linha', 'num_embalagens'
  )
  AND form_path IS NOT NULL;

-- Verificar updates
SELECT
  campo,
  form_path,
  ativo,
  updated_at
FROM logistics.mapeamento_campo
WHERE ativo = true
  AND form_path LIKE '%Inf.%' OR form_path LIKE '%Log.%' OR form_path LIKE '%Doc.%'
ORDER BY campo;

COMMIT;

-- ============================================================================
-- Próximos passos:
-- 1. Limpar dados anteriores de teste:
--    DELETE FROM logistics.documento WHERE origem_sistema = 'ARTSOFT';
--
-- 2. Executar sync:
--    node artsoft-sync/cli.js --empresa-id 1
--
-- 3. Validar dados importados:
--    SELECT serie, numero, matricula, peso_bruto, volume_total, local_carga
--    FROM logistics.documento
--    WHERE origem_sistema = 'ARTSOFT'
--    LIMIT 5;
-- ============================================================================
