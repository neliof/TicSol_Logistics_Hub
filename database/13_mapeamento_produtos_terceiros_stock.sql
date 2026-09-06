-- ============================================================================
-- TicSol Logistics Hub — 13_mapeamento_produtos_terceiros_stock.sql
-- Seed de logistics.mapeamento_campo para os contextos de sincronização
-- ARTSOFT: produto (StkFch), terceiro_cliente / terceiro_fornecedor (TerFch)
-- e stock (StkAgr).
--
-- Depende de: 01_schema.sql (mapeamento_campo, empresa).
--
-- As pipelines em artsoft-sync/{produtos,terceiros,stock} têm um conjunto de
-- mapeamentos embutido como fallback. Este seed torna esses campos editáveis
-- na base de dados (ativar/desativar, reordenar, ajustar form_path) sem tocar
-- em código. As tag_xml TÊM de coincidir com as que os parsers leem.
--
-- ON CONFLICT DO NOTHING: se um campo já foi ajustado à mão, não é sobreposto.
-- Aplica a todas as empresas ativas.
-- ============================================================================
SET search_path TO logistics, public;

-- O CHECK original só admitia os contextos de guias. Alargá-lo para os novos
-- contextos de sincronização, mantendo a validação (impede erros de escrita).
ALTER TABLE logistics.mapeamento_campo
  DROP CONSTRAINT IF EXISTS mapeamento_campo_contexto_check;
ALTER TABLE logistics.mapeamento_campo
  ADD CONSTRAINT mapeamento_campo_contexto_check CHECK (
    contexto IN (
      'guia_cabecalho', 'guia_linha',
      'produto', 'terceiro_cliente', 'terceiro_fornecedor', 'stock'
    )
  );

INSERT INTO logistics.mapeamento_campo (empresa_id, contexto, campo, tag_xml, form_path, obrigatorio, ordem)
SELECT e.id, m.contexto, m.campo, m.tag_xml, m.form_path, m.obrigatorio, m.ordem
FROM logistics.empresa e
CROSS JOIN (
  VALUES
    -- produto (StkFch)
    ('produto', 'codigo',              'Codigo',     '%StkFch.Cod.Codigo',   true,  10),
    ('produto', 'descricao',           'Descricao',  '%StkFch.Nome.0',       false, 20),
    ('produto', 'ean',                 'CodOpc',     '%StkFch.Cod.Opcional', false, 30),
    ('produto', 'peso_liquido',        'PesoLiq',    '%StkFch.Logis.PLiqUni', false, 40),
    ('produto', 'peso_bruto',          'PesoBruto',  '%StkFch.Logis.PBrUnit', false, 50),
    ('produto', 'unidades_por_caixa',  'QtdEmb',     '%StkFch.Logis.QtdEmb', false, 60),
    ('produto', 'unidade',             'Unidade',    '%StkFch.Logis.Uni',    false, 70),
    ('produto', 'controla_lote',       'CtrlLote',   '%StkFch.Flag.CtrlLt',  false, 80),
    ('produto', 'controla_validade',   'CtrlValid',  '%StkFch.Flag.DtValid', false, 90),
    ('produto', 'dias_validade',       'DiasValid',  '%StkFch.Div.DiasValid', false, 100),

    -- terceiro_cliente (TerFch, chave Cliente|NrCli)
    ('terceiro_cliente', 'numero',     'Numero',     '%TerFch.Cli.Numero',   true,  10),
    ('terceiro_cliente', 'nome',       'Nome',       '%TerFch.Ter.Nome',     false, 20),
    ('terceiro_cliente', 'nif',        'Nif',        '%TerFch.Ter.NIF',      false, 30),
    ('terceiro_cliente', 'morada',     'Morada',     '%TerFch.Ter.Morada',   false, 40),
    ('terceiro_cliente', 'localidade', 'Localid',    '%TerFch.Ter.Localid',  false, 50),
    ('terceiro_cliente', 'cod_postal', 'CPPais',     '%TerFch.Ter.CPPais',   false, 60),

    -- terceiro_fornecedor (TerFch, chave Forneced|NrFor)
    ('terceiro_fornecedor', 'numero',     'Numero',  '%TerFch.For.Numero',   true,  10),
    ('terceiro_fornecedor', 'nome',       'Nome',    '%TerFch.Ter.Nome',     false, 20),
    ('terceiro_fornecedor', 'nif',        'Nif',     '%TerFch.Ter.NIF',      false, 30),
    ('terceiro_fornecedor', 'morada',     'Morada',  '%TerFch.Ter.Morada',   false, 40),
    ('terceiro_fornecedor', 'localidade', 'Localid', '%TerFch.Ter.Localid',  false, 50),
    ('terceiro_fornecedor', 'cod_postal', 'CPPais',  '%TerFch.Ter.CPPais',   false, 60),

    -- stock (StkAgr)
    ('stock', 'codigo',        'Codigo',    '%StkAgr.Codigo',     true,  10),
    ('stock', 'armazem',       'NrArm',     '%StkAgr.NrArm',      false, 20),
    ('stock', 'data_validade', 'DtValid',   '%StkAgr.DtValid',    false, 30),
    ('stock', 'qtd_entrada',   'QtdEntr',   '%StkAgr.QtdEntr',    false, 40),
    ('stock', 'qtd_saida',     'QtdSaid',   '%StkAgr.QtdSaid',    false, 50),
    ('stock', 'qtd_cativa',    'QtdCativa', '%StkAgr.QtdCativa',  false, 60),
    ('stock', 'localizacao',   'LocArm',    '%StkAgr.LocArm',     false, 70),
    ('stock', 'suporte',       'Suporte',   '%StkAgr.Suporte',    false, 80),
    ('stock', 'palete',        'Palete',    '%StkAgr.Div.Palete', false, 90)
) AS m(contexto, campo, tag_xml, form_path, obrigatorio, ordem)
WHERE e.ativa = true
ON CONFLICT (empresa_id, contexto, campo) DO NOTHING;
