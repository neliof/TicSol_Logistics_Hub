-- ============================================================================
-- TicSol Logistics Hub — 07_guias_transporte.sql
-- Importação de Guias de Transporte a partir do ARTSOFT (WebServer XML)
-- Depende de: 01_schema.sql, 02_security.sql
--
-- Contexto: aplica ao Logistics Hub o mesmo mecanismo já em produção no
-- TICSOL_HUB_Central para Obras C002 — um pedido XML a Queries/Query que
-- devolve cabeçalho (DocFch) + lançamentos (DocLan) + ficha de artigo
-- (StkFch) numa só resposta. Ver docs/DESIGN_GUIAS_TRANSPORTE_XML.md.
--
-- Três decisões de desenho estão materializadas neste ficheiro:
--
--   1. As SÉRIES de guia variam de base de dados para base de dados
--      (V960;V980 numa instalação, outra coisa noutra). Nunca podem estar
--      em código — vivem em logistics.configuracao.
--
--   2. Os CAMINHOS DOS CAMPOS do ARTSOFT (%DocFch.Xxx.Yyy) para matrícula,
--      moradas e volumes ainda não estão confirmados e vão ser ajustados
--      durante os testes com dados reais. Por isso o <defcol> do pedido é
--      GERADO a partir de logistics.mapeamento_campo — confirmar um caminho
--      é um UPDATE, não uma alteração de código.
--
--   3. DOCUMENTO só guardava cabeçalho. As linhas da guia não tinham onde
--      ficar — daí logistics.linha_documento.
-- ============================================================================
SET search_path TO logistics, public;

-- ----------------------------------------------------------------------------
-- 1. CONFIGURAÇÃO POR EMPRESA
--
-- Espelha o padrão config.configuracao do TICSOL_HUB_Central (chave/valor,
-- listas separadas por ';'). empresa_id faz parte da chave única porque as
-- séries variam por base de dados E por empresa dentro da mesma instalação.
--
-- SEGREDOS NÃO ENTRAM AQUI. A password do WebServer ARTSOFT fica em variável
-- de ambiente / gestor de segredos, nunca em coluna legível por quem tenha
-- SELECT na tabela.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logistics.configuracao (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  uuid NOT NULL REFERENCES logistics.empresa(id),
    chave       varchar(120) NOT NULL,
    valor       text,
    descricao   text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    updated_by  varchar(100),
    UNIQUE (empresa_id, chave)
);

CREATE INDEX IF NOT EXISTS idx_configuracao_chave ON logistics.configuracao(empresa_id, chave);

DROP TRIGGER IF EXISTS trg_configuracao_updated_at ON logistics.configuracao;
CREATE TRIGGER trg_configuracao_updated_at
    BEFORE UPDATE ON logistics.configuracao
    FOR EACH ROW EXECUTE FUNCTION logistics.set_updated_at();

COMMENT ON TABLE logistics.configuracao IS
    'Configuração chave/valor por empresa. Listas separadas por ";" (ex.: guias.series = "V960;V980"). Nunca guardar segredos.';

-- ----------------------------------------------------------------------------
-- 2. MAPEAMENTO DE CAMPOS ARTSOFT -> defcol
--
-- Cada linha gera um elemento do <defcol> do pedido XML:
--     <{tag_xml} form='{form_path}'/>
--
-- Os campos já confirmados em produção no Hub Central entram ativos.
-- Os que dependem de confirmação (matrícula, moradas, volumes) entram
-- INATIVOS e com form_path vazio — ligam-se quando o caminho real for
-- conhecido, sem tocar em código nem fazer redeploy.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logistics.mapeamento_campo (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id   uuid NOT NULL REFERENCES logistics.empresa(id),
    contexto     varchar(50)  NOT NULL
                  CHECK (contexto IN ('guia_cabecalho', 'guia_linha')),
    campo        varchar(60)  NOT NULL,   -- nome lógico interno: 'matricula', 'quantidade'
    tag_xml      varchar(60)  NOT NULL,   -- nome do elemento no defcol
    form_path    varchar(160) NOT NULL DEFAULT '',  -- '%DocFch.Doc.NrDoc'
    obrigatorio  boolean NOT NULL DEFAULT false,
    ativo        boolean NOT NULL DEFAULT true,
    ordem        integer,
    notas        text,
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, contexto, campo),
    -- um campo ativo tem de ter caminho; um campo sem caminho fica inativo
    CONSTRAINT ck_mapeamento_ativo_tem_path
        CHECK (ativo = false OR btrim(form_path) <> '')
);

CREATE INDEX IF NOT EXISTS idx_mapeamento_contexto
    ON logistics.mapeamento_campo(empresa_id, contexto, ordem);

DROP TRIGGER IF EXISTS trg_mapeamento_campo_updated_at ON logistics.mapeamento_campo;
CREATE TRIGGER trg_mapeamento_campo_updated_at
    BEFORE UPDATE ON logistics.mapeamento_campo
    FOR EACH ROW EXECUTE FUNCTION logistics.set_updated_at();

COMMENT ON TABLE logistics.mapeamento_campo IS
    'Mapeia campos ARTSOFT (%Tabela.Grupo.Campo) para o <defcol> do pedido XML. Permite ajustar caminhos em testes reais sem alterar código.';
COMMENT ON CONSTRAINT ck_mapeamento_ativo_tem_path ON logistics.mapeamento_campo IS
    'Impede que um campo entre no defcol com form_path vazio, o que produziria XML inválido.';

-- ----------------------------------------------------------------------------
-- 3. RASTREIO DE ORIGEM NO DOCUMENTO
--
-- origem_doc_id guarda o %DocFch.Doc.ID no formato "SERIE/NR" (ex. V960/240123).
-- É a chave que alimenta DocFch/DocPrintEx mais tarde para obter o PDF da guia
-- em base64 — sem ela não há visualização nem impressão.
-- ----------------------------------------------------------------------------
ALTER TABLE logistics.documento ADD COLUMN IF NOT EXISTS origem_serie     varchar(20);
ALTER TABLE logistics.documento ADD COLUMN IF NOT EXISTS origem_doc_id    varchar(60);
ALTER TABLE logistics.documento ADD COLUMN IF NOT EXISTS origem_tpsaft    varchar(10);
ALTER TABLE logistics.documento ADD COLUMN IF NOT EXISTS origem_sistema   varchar(20);
ALTER TABLE logistics.documento ADD COLUMN IF NOT EXISTS sincronizado_em  timestamptz;

CREATE INDEX IF NOT EXISTS idx_documento_origem_doc_id
    ON logistics.documento(empresa_id, origem_doc_id);

COMMENT ON COLUMN logistics.documento.origem_doc_id IS
    'Identificador ARTSOFT no formato SERIE/NR (%DocFch.Doc.ID). Chave para DocFch/DocPrintEx obter o PDF.';

-- ----------------------------------------------------------------------------
-- 4. LINHAS DE DOCUMENTO
--
-- Lacuna do 01_schema.sql: DOCUMENTO guardava só o cabeçalho, portanto os
-- artigos e quantidades de uma guia não tinham destino.
--
-- artigo_codigo guarda-se SEMPRE, mesmo quando produto_id resolve. Uma guia
-- que refira um artigo ainda não sincronizado tem de entrar na mesma — perder
-- a linha seria pior do que ter uma referência por resolver. Depois, quando o
-- produto aparecer, a vista de reconciliação (§6) mostra o que falta ligar.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logistics.linha_documento (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    documento_id   uuid NOT NULL REFERENCES logistics.documento(id) ON DELETE CASCADE,
    nr_linha       integer NOT NULL,
    nr_lancamento  integer,
    produto_id     uuid REFERENCES logistics.produto(id),
    artigo_codigo  varchar(60) NOT NULL,
    descricao      text,
    quantidade     numeric(14,3),
    unidade        varchar(20),
    observacoes    text,
    dados_extra    jsonb,   -- CDU e campos ainda não promovidos a coluna própria
    created_at     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (documento_id, nr_linha)
);

CREATE INDEX IF NOT EXISTS idx_linha_documento_documento ON logistics.linha_documento(documento_id);
CREATE INDEX IF NOT EXISTS idx_linha_documento_produto   ON logistics.linha_documento(produto_id);
CREATE INDEX IF NOT EXISTS idx_linha_documento_artigo    ON logistics.linha_documento(artigo_codigo);

COMMENT ON TABLE logistics.linha_documento IS
    'Lançamentos (DocLan) de um documento. UNIQUE (documento_id, nr_linha) dá idempotência ao upsert.';
COMMENT ON COLUMN logistics.linha_documento.artigo_codigo IS
    'Código ARTSOFT do artigo. Preservado sempre, mesmo com produto_id resolvido — a linha entra ainda que o produto não exista no WMS.';
COMMENT ON COLUMN logistics.linha_documento.dados_extra IS
    'CDU e campos cujo destino final ainda não está decidido. Evita perder dados durante a fase de testes reais.';

-- ----------------------------------------------------------------------------
-- 5. AUDITORIA DE SINCRONIZAÇÕES
--
-- Modelo: auditoria.pedidos_xml_execucoes do TICSOL_HUB_Central. Sem isto não
-- se consegue responder a "porque é que esta guia não entrou?" — que é a
-- pergunta que se faz sempre, e sempre tarde demais para reproduzir o pedido.
--
-- request_xml e response_xml ficam completos de propósito: são a única forma
-- de comparar o que se pediu com o que o ARTSOFT devolveu.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS logistics.sincronizacao_execucao (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id        uuid NOT NULL REFERENCES logistics.empresa(id),
    tipo              varchar(40) NOT NULL,          -- 'guias'
    correlation_id    uuid NOT NULL,                 -- agrupa as páginas de uma execução
    serie             varchar(20),
    pagina            integer,
    endpoint          varchar(120) NOT NULL,
    request_xml       text,
    response_xml      text,
    estado            varchar(30) NOT NULL
                       CHECK (estado IN ('ok','erro_comunicacao','erro_autenticacao',
                                         'erro_xml','erro_funcional','incompleto')),
    http_status       integer,
    registos          integer,
    registos_novos    integer,
    duracao_ms        integer,
    erro_resumo       text,
    executado_em      timestamptz NOT NULL DEFAULT now(),
    executado_por     varchar(100)
);

CREATE INDEX IF NOT EXISTS idx_sinc_execucao_correlation
    ON logistics.sincronizacao_execucao(correlation_id);
CREATE INDEX IF NOT EXISTS idx_sinc_execucao_data
    ON logistics.sincronizacao_execucao(empresa_id, tipo, executado_em DESC);

COMMENT ON COLUMN logistics.sincronizacao_execucao.estado IS
    'Taxonomia explícita: distinguir erro de comunicação de erro funcional determina se faz sentido repetir.';
COMMENT ON COLUMN logistics.sincronizacao_execucao.correlation_id IS
    'Mesmo valor em todas as páginas de uma execução — permite seguir o pedido do início ao fim.';

-- ----------------------------------------------------------------------------
-- 6. VISTA DE LINHAS POR RESOLVER
--
-- Linhas de guia cujo artigo ainda não existe como produto no WMS. Não decide
-- nada automaticamente — expõe o que falta ligar, à imagem da
-- vw_reconciliacao_stock do 06.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW logistics.vw_linhas_documento_por_resolver AS
SELECT
    ld.id                AS linha_id,
    d.id                 AS documento_id,
    d.empresa_id,
    d.tipo               AS tipo_documento,
    d.numero             AS numero_documento,
    d.origem_doc_id,
    d.data_emissao,
    ld.nr_linha,
    ld.artigo_codigo,
    ld.descricao,
    ld.quantidade,
    ld.unidade
FROM logistics.linha_documento ld
JOIN logistics.documento d ON d.id = ld.documento_id
WHERE ld.produto_id IS NULL;

COMMENT ON VIEW logistics.vw_linhas_documento_por_resolver IS
    'Linhas importadas cujo artigo_codigo não corresponde a nenhum produto do WMS. Para revisão manual.';

-- ----------------------------------------------------------------------------
-- 7. PERMISSÕES E RLS
--
-- linha_documento não tem empresa_id próprio: segue a convenção das tabelas
-- filhas do 02_security.sql (lote, linha_encomenda, picking_linha) e isola-se
-- por JOIN ao pai. Denormalizar empresa_id para o filho criaria a hipótese de
-- ficar dessincronizado do documento a que pertence.
-- ----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON logistics.configuracao            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON logistics.mapeamento_campo        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON logistics.linha_documento         TO authenticated;
GRANT SELECT, INSERT                 ON logistics.sincronizacao_execucao  TO authenticated;
GRANT SELECT ON logistics.vw_linhas_documento_por_resolver TO authenticated;

ALTER TABLE logistics.configuracao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.configuracao;
CREATE POLICY isolamento_empresa ON logistics.configuracao
    USING (empresa_id = logistics.jwt_empresa_id())
    WITH CHECK (empresa_id = logistics.jwt_empresa_id());

ALTER TABLE logistics.mapeamento_campo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.mapeamento_campo;
CREATE POLICY isolamento_empresa ON logistics.mapeamento_campo
    USING (empresa_id = logistics.jwt_empresa_id())
    WITH CHECK (empresa_id = logistics.jwt_empresa_id());

ALTER TABLE logistics.sincronizacao_execucao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.sincronizacao_execucao;
CREATE POLICY isolamento_empresa ON logistics.sincronizacao_execucao
    USING (empresa_id = logistics.jwt_empresa_id())
    WITH CHECK (empresa_id = logistics.jwt_empresa_id());

ALTER TABLE logistics.linha_documento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.linha_documento;
CREATE POLICY isolamento_empresa ON logistics.linha_documento
    USING (documento_id IN (
        SELECT id FROM logistics.documento WHERE empresa_id = logistics.jwt_empresa_id()
    ))
    WITH CHECK (documento_id IN (
        SELECT id FROM logistics.documento WHERE empresa_id = logistics.jwt_empresa_id()
    ));

-- ----------------------------------------------------------------------------
-- 8. SEED — configuração e mapeamento inicial
--
-- Corre para todas as empresas existentes. Idempotente: ON CONFLICT DO NOTHING
-- para não sobrepor valores já ajustados por quem configurou a instalação.
-- ----------------------------------------------------------------------------
INSERT INTO logistics.configuracao (empresa_id, chave, valor, descricao)
SELECT e.id, v.chave, v.valor, v.descricao
FROM logistics.empresa e
CROSS JOIN (VALUES
    ('guias.series',          '',                  'Séries ARTSOFT de guias a importar, separadas por ";" (ex.: V960;V980). Descobrir com DocFch/CfgDocum.'),
    ('guias.tpsaft_validos',  'GR;GT;GA;GC;GD',    'Tipos SAF-T aceites como movimento de mercadorias. Filtro de segurança contra série mal configurada.'),
    ('guias.page_size',       '50',                'Registos por página no pedido XML (atributo end do <root>).'),
    ('guias.max_pages',       '300',               'Limite de páginas por execução. Atingi-lo marca a sincronização como incompleta, não como sucesso.'),
    ('guias.dias_retroativos','30',                'Janela por omissão da sincronização periódica, em dias.'),
    ('guias.formato_data',    'ddmmaaaa',          'Ordem dos 8 dígitos da data no filtro de query: ddmmaaaa ou aaaammdd. POR CONFIRMAR com o WebServer real — o Hub Central aceita ambos sem distinguir, o que esconde o formato verdadeiro.'),
    ('artsoft.host',          '',                  'Host/IP do WebServer ARTSOFT.'),
    ('artsoft.porta',         '4200',              'Porta do WebServer ARTSOFT.'),
    ('artsoft.utilizador',    '',                  'Utilizador do WebServer ARTSOFT. A PASSWORD NÃO SE GUARDA AQUI.'),
    ('artsoft.timeout',       '60',                'Timeout de pedido, em segundos.'),
    ('artsoft.hash',          'SHA1',              'Algoritmo do digest: SHA1 ou MD5.')
) AS v(chave, valor, descricao)
ON CONFLICT (empresa_id, chave) DO NOTHING;

-- Cabeçalho da guia (DocFch + join TerFch)
-- Todos estes caminhos estão CONFIRMADOS em produção no TICSOL_HUB_Central.
INSERT INTO logistics.mapeamento_campo
    (empresa_id, contexto, campo, tag_xml, form_path, obrigatorio, ativo, ordem, notas)
SELECT e.id, 'guia_cabecalho', v.campo, v.tag_xml, v.form_path, v.obrigatorio, v.ativo, v.ordem, v.notas
FROM logistics.empresa e
CROSS JOIN (VALUES
    ('serie',            'DocSerie',        '%DocFch.Doc.Serie',    true,  true,  10, NULL),
    ('numero',           'DocNrDoc',        '%DocFch.Doc.NrDoc',    true,  true,  20, NULL),
    ('doc_id',           'DocID',           '%DocFch.Doc.ID',       true,  true,  30, 'Formato SERIE/NR. Chave para DocFch/DocPrintEx.'),
    ('data_documento',   'DataDocum',       '%DocFch.Data.Docum',   true,  true,  40, NULL),
    ('tipo_saft',        'InfTpSAFT',       '%DocFch.Inf.TpSAFT',   true,  true,  50, 'Validar contra guias.tpsaft_validos.'),
    ('observacoes',      'DocObs',          '%DocFch.Doc.Obs',      false, true,  60, NULL),
    ('pedido_origem',    'DocPedido',       '%DocFch.Doc.Pedido',   false, true,  70, NULL),
    ('terceiro_numero',  'TerTerceiro',     '%DocFch.Ter.Terceiro', true,  true,  80, NULL),
    ('terceiro_filial',  'TerFilial',       '%DocFch.Ter.Filial',   false, true,  90, NULL),
    ('terceiro_nome',    'TerNome',         '%TerFch.Ter.Nome',     false, true, 100, 'Vem do join ^TerFch.'),
    ('terceiro_nif',     'TerNIF',          '%TerFch.Ter.NIF',      false, true, 110, NULL),
    ('terceiro_morada',  'TerMorada',       '%TerFch.Ter.Morada',   false, true, 120, NULL),
    ('terceiro_local',   'TerLocalid',      '%TerFch.Ter.Localid',  false, true, 130, NULL),
    ('terceiro_cp',      'TerCPostal',      '%TerFch.Ter.CPPais',   false, true, 140, NULL),
    -- POR CONFIRMAR: existem campos próprios no DocFch, caminho a determinar
    -- em testes reais. Entram inativos para não gerar defcol inválido.
    ('matricula',        'Matricula',       '',                     false, false, 200, 'POR CONFIRMAR: campo próprio do DocFch. Ver também CDU do cabeçalho.'),
    ('morada_carga',     'MoradaCarga',     '',                     false, false, 210, 'POR CONFIRMAR: campo próprio do DocFch.'),
    ('morada_descarga',  'MoradaDescarga',  '',                     false, false, 220, 'POR CONFIRMAR: campo próprio do DocFch.'),
    ('data_hora_carga',  'DataHoraCarga',   '',                     false, false, 230, 'POR CONFIRMAR.'),
    ('volumes',          'Volumes',         '',                     false, false, 240, 'POR CONFIRMAR: provavelmente num CDU.'),
    ('transportadora',   'Transportadora',  '',                     false, false, 250, 'POR CONFIRMAR.')
) AS v(campo, tag_xml, form_path, obrigatorio, ativo, ordem, notas)
ON CONFLICT (empresa_id, contexto, campo) DO NOTHING;

-- Linhas da guia (DocLan + join StkFch)
INSERT INTO logistics.mapeamento_campo
    (empresa_id, contexto, campo, tag_xml, form_path, obrigatorio, ativo, ordem, notas)
SELECT e.id, 'guia_linha', v.campo, v.tag_xml, v.form_path, v.obrigatorio, v.ativo, v.ordem, v.notas
FROM logistics.empresa e
CROSS JOIN (VALUES
    ('nr_lancamento',  'DocNrLan',   '%DocLan.Doc.NrLan',   false, true, 10, NULL),
    ('nr_linha',       'DocNrLin',   '%DocLan.Doc.NrLin',   true,  true, 20, NULL),
    ('artigo_codigo',  'Artigo',     '%DocLan.Cod.Codigo',  true,  true, 30, NULL),
    ('descricao',      'Nome',       '%StkFch.Nome.0',      false, true, 40, 'Vem do join ^StkFch.'),
    ('quantidade',     'Qtd',        '%DocLan.Qtd.Movim',   true,  true, 50, NULL),
    ('unidade',        'Unid',       '%StkFch.Logis.Uni',   false, true, 60, NULL),
    ('observacoes',    'Obser',      '%DocLan.Div.Obs',     false, true, 70, NULL),
    ('artigo_nrreg',   'DivNrReg',   '%StkFch.Div.NrReg',   false, true, 80, 'Registo interno do artigo no ARTSOFT.'),
    -- POR CONFIRMAR
    ('peso',           'Peso',       '',                    false, false, 200, 'POR CONFIRMAR: provável em StkFch, grupo Logis.'),
    ('ean13',          'EAN13',      '',                    false, false, 210, 'POR CONFIRMAR: caminho do EAN em StkFch.')
) AS v(campo, tag_xml, form_path, obrigatorio, ativo, ordem, notas)
ON CONFLICT (empresa_id, contexto, campo) DO NOTHING;
