-- ============================================================================
-- TicSol Logistics Hub — 14_mapeamento_guias_transporte.sql
-- Mapeamentos de campo para sync de guias de transporte (ARTSOFT V26)
-- Depende de: 01_schema.sql, 07_guias_transporte.sql
--
-- Paths confirmados por tentativa/erro contra ARTSOFT V26 real (empresa
-- Imefar, séries V960/V990) em 2026-09-07. Ver ARTSOFT_FIELD_PATHS_CONFIRMED.md
-- para o levantamento original — os paths de guia_cabecalho.data e
-- guia_linha.descricao/quantidade abaixo divergem desse documento porque o
-- ARTSOFT rejeitou os paths lá listados com ErrVarNotFound; os paths aqui
-- são os que o servidor real aceitou.
-- ============================================================================

INSERT INTO logistics.mapeamento_campo (empresa_id, contexto, campo, tag_xml, form_path, ativo)
SELECT e.id, m.contexto, m.campo, m.tag_xml, m.form_path, m.ativo
FROM logistics.empresa e
CROSS JOIN (
    VALUES
        ('guia_cabecalho', 'serie',  'Serie',  '%DocFch.Doc.Serie',  true),
        ('guia_cabecalho', 'numero', 'NrDoc',  '%DocFch.Doc.NrDoc',  true),
        -- Nenhum path de data de documento testado foi aceite pelo ARTSOFT
        -- (%Data.Docum, %DocFch.Doc.DataDocum, %DocFch.Doc.Data,
        -- %DocFch.Doc.DocData deram todos ErrVarNotFound). Fica inativo até
        -- se descobrir o path correto; documento.data_emissao cai então no
        -- fallback de NOW() em mapper.js.
        ('guia_cabecalho', 'data',   'DataDocum', '%DocFch.Doc.DataDocum', false),
        -- Dados do terceiro (cliente) do cabeçalho. terceiro_nif fica
        -- inativo: %DocFch.Ter.NIF deu ErrVarNotFound, path correto por
        -- descobrir; os restantes Ter.* confirmados contra ARTSOFT real.
        ('guia_cabecalho', 'terceiro_numero',     'TerTerceiro', '%DocFch.Ter.Terceiro',  true),
        ('guia_cabecalho', 'terceiro_nome',       'TerNome',     '%DocFch.Ter.Nome',      true),
        ('guia_cabecalho', 'terceiro_morada',     'TerMorada',   '%DocFch.Ter.Morada',    true),
        ('guia_cabecalho', 'terceiro_localidade', 'TerLocalid',  '%DocFch.Ter.Localid',   true),
        ('guia_cabecalho', 'terceiro_cpostal',    'TerCPost',    '%DocFch.Ter.CPostAlfa', true),
        ('guia_cabecalho', 'terceiro_nif',        'TerNIF',      '%DocFch.Ter.NIF',       false),
        ('guia_linha', 'artigo_codigo', 'Codigo', '%DocLan.Cod.Codigo',  true),
        ('guia_linha', 'descricao',     'Nome',   '%DocLan.Div.Descric', true),
        ('guia_linha', 'quantidade',    'Qtd',    '%DocLan.Qtd.Real',    true),
        -- EAN via correlação StkFch vem sempre vazio nesta instalação;
        -- mapper.js resolve o EAN por logistics.produto.sku_interno em vez
        -- disso. Fica mapeado (inativo não faz sentido: sem custo mantê-lo
        -- ativo, e se um dia a correlação passar a funcionar já está pronto).
        ('guia_linha', 'ean', 'EAN13', '%StkFch.Cod.Opcional', true)
) AS m(contexto, campo, tag_xml, form_path, ativo)
WHERE e.ativa = true
ON CONFLICT (empresa_id, contexto, campo) DO UPDATE SET
    tag_xml = EXCLUDED.tag_xml,
    form_path = EXCLUDED.form_path,
    ativo = EXCLUDED.ativo,
    updated_at = NOW();
