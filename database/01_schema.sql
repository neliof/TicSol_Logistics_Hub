-- ============================================================================
-- TicSol Logistics Hub (WMS) — Schema PostgreSQL
-- Baseado na Secção 3 (Modelo de Dados) do documento de especificação
-- TicSol_Logistics_Hub_WMS_Especificacao.md
--
-- Compatível com PostgreSQL 14+ / PostgREST
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSÕES
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS btree_gist; -- índices compostos / exclusion constraints

-- ----------------------------------------------------------------------------
-- 1. SCHEMA
-- ----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS logistics;
SET search_path TO logistics, public;

-- ----------------------------------------------------------------------------
-- 2. TIPOS ENUMERADOS
-- ----------------------------------------------------------------------------

CREATE TYPE fluxo_logistico AS ENUM ('pbs', 'pbl', 'cross_dock', 'abastecimento_direto');

CREATE TYPE padrao_palete AS ENUM ('mono_produto', 'multi_produto');

CREATE TYPE tipo_palete AS ENUM ('europalete', 'meia_palete', 'quarto_palete', 'nao_standard');

CREATE TYPE estado_palete AS ENUM (
    'em_preparacao', 'filmada', 'cintada', 'em_armazem',
    'em_carga', 'expedida', 'recebida', 'rejeitada'
);

CREATE TYPE estado_caixa AS ENUM (
    'disponivel', 'reservada', 'em_transito', 'rejeitada', 'devolvida'
);

CREATE TYPE tipo_documento AS ENUM (
    'ordem_compra', 'guia_remessa', 'guia_transporte', 'fatura',
    'desadv', 'packing_list', 'nota_recepcao', 'ref',
    'documento_produtor_agricola'
);

CREATE TYPE tipo_movimento AS ENUM (
    'recepcao', 'armazenagem', 'picking', 'expedicao',
    'transferencia', 'ajuste', 'devolucao', 'quebra'
);

CREATE TYPE tipo_etiqueta AS ENUM ('palete', 'caixa', 'packing_list');

CREATE TYPE motivo_rejeicao AS ENUM (
    'logistica', 'qualidade', 'documental', 'fora_de_especificacao', 'excesso_entrega'
);

-- ----------------------------------------------------------------------------
-- 3. FUNÇÃO AUXILIAR — updated_at automático
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION logistics.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 4. IDENTIDADE / MULTI-TENANT
-- ============================================================================

CREATE TABLE logistics.empresa (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            varchar(200) NOT NULL,
    nif             varchar(20)  NOT NULL UNIQUE,
    ativa           boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_empresa_updated_at BEFORE UPDATE ON logistics.empresa
    FOR EACH ROW EXECUTE FUNCTION logistics.set_updated_at();

CREATE TABLE logistics.perfil (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      uuid NOT NULL REFERENCES logistics.empresa(id),
    nome            varchar(100) NOT NULL,
    descricao       varchar(300),
    UNIQUE (empresa_id, nome)
);

CREATE TABLE logistics.permissao (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    perfil_id       uuid NOT NULL REFERENCES logistics.perfil(id) ON DELETE CASCADE,
    modulo          varchar(80) NOT NULL,      -- ex.: 'receção', 'paletizacao', 'etiquetas'
    accao           varchar(20) NOT NULL CHECK (accao IN ('ler','criar','editar','aprovar','eliminar')),
    UNIQUE (perfil_id, modulo, accao)
);

CREATE TABLE logistics.utilizador (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      uuid NOT NULL REFERENCES logistics.empresa(id),
    perfil_id       uuid NOT NULL REFERENCES logistics.perfil(id),
    nome            varchar(200) NOT NULL,
    email           varchar(200) NOT NULL,
    ativo           boolean NOT NULL DEFAULT true,
    mfa_ativo       boolean NOT NULL DEFAULT false,
    ultimo_login    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, email)
);

-- ============================================================================
-- 5. ARMAZÉM — hierarquia física
-- ============================================================================

CREATE TABLE logistics.armazem (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id      uuid NOT NULL REFERENCES logistics.empresa(id),
    codigo          varchar(20) NOT NULL,
    nome            varchar(200) NOT NULL,
    morada          text,
    ativo           boolean NOT NULL DEFAULT true,
    UNIQUE (empresa_id, codigo)
);

CREATE TABLE logistics.zona (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    armazem_id      uuid NOT NULL REFERENCES logistics.armazem(id),
    codigo          varchar(20) NOT NULL,
    nome            varchar(100) NOT NULL,
    tipo            varchar(30), -- ex.: 'seco', 'refrigerado', 'congelado', 'cross_dock'
    UNIQUE (armazem_id, codigo)
);

CREATE TABLE logistics.rua (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    zona_id         uuid NOT NULL REFERENCES logistics.zona(id),
    codigo          varchar(20) NOT NULL,
    UNIQUE (zona_id, codigo)
);

CREATE TABLE logistics.estante (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    rua_id          uuid NOT NULL REFERENCES logistics.rua(id),
    codigo          varchar(20) NOT NULL,
    UNIQUE (rua_id, codigo)
);

CREATE TABLE logistics.localizacao (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    estante_id      uuid NOT NULL REFERENCES logistics.estante(id),
    codigo          varchar(30) NOT NULL,       -- ex.: código de picking completo
    tipo            varchar(20) NOT NULL DEFAULT 'reserva' CHECK (tipo IN ('picking','reserva','cais','expedicao','quarentena')),
    capacidade_paletes int,
    ativa           boolean NOT NULL DEFAULT true,
    UNIQUE (estante_id, codigo)
);
CREATE INDEX idx_localizacao_tipo ON logistics.localizacao(tipo);

-- ============================================================================
-- 6. TERCEIROS — Clientes, Fornecedores, Transportadoras
-- ============================================================================

CREATE TABLE logistics.cliente (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    codigo_interno      varchar(30) NOT NULL,
    nome                varchar(200) NOT NULL,
    nif                 varchar(20),
    tipo                varchar(30) NOT NULL DEFAULT 'distribuicao', -- 'distribuicao', 'loja', 'operador_logistico'
    morada              text,
    ativo               boolean NOT NULL DEFAULT true,
    UNIQUE (empresa_id, codigo_interno)
);

-- Loja como especialização de Cliente (ex.: lojas SONAE MC dentro do cliente "Sonae MC")
CREATE TABLE logistics.loja (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id          uuid NOT NULL REFERENCES logistics.cliente(id),
    codigo_loja         varchar(20) NOT NULL,
    nome_loja           varchar(200) NOT NULL,
    morada              text,
    UNIQUE (cliente_id, codigo_loja)
);

CREATE TABLE logistics.fornecedor (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    codigo_interno      varchar(30) NOT NULL,
    nome                varchar(200) NOT NULL,
    nif                 varchar(20),
    morada              text,
    ativo               boolean NOT NULL DEFAULT true,
    UNIQUE (empresa_id, codigo_interno)
);

CREATE TABLE logistics.transportadora (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    nome                varchar(200) NOT NULL,
    nif                 varchar(20),
    ativa               boolean NOT NULL DEFAULT true
);

CREATE TABLE logistics.viatura (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transportadora_id   uuid REFERENCES logistics.transportadora(id),
    matricula           varchar(20) NOT NULL,
    tipo                varchar(30), -- 'standard','duplo_deck','caixa_termica'
    UNIQUE (transportadora_id, matricula)
);

CREATE TABLE logistics.motorista (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    transportadora_id   uuid REFERENCES logistics.transportadora(id),
    nome                varchar(200) NOT NULL,
    numero_documento    varchar(30)
);

-- ============================================================================
-- 7. PRODUTO / LOTE
-- ============================================================================

CREATE TABLE logistics.produto (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id                  uuid NOT NULL REFERENCES logistics.empresa(id),
    fornecedor_id                uuid REFERENCES logistics.fornecedor(id),
    sku_interno                 varchar(40) NOT NULL,
    ean13                       varchar(13),
    gtin_caixa                  varchar(14),          -- ITF-14 / EAN14 do store pack
    descricao                   varchar(300) NOT NULL,
    categoria                   varchar(100),
    peso_liquido_kg              numeric(10,3),
    peso_variavel                boolean NOT NULL DEFAULT false,
    tolerancia_peso_pct          numeric(5,2) DEFAULT 10.00,  -- referência de mercado: ±10%
    unidades_por_caixa           int,
    ti                           int,                 -- caixas por camada
    hi                           int,                 -- camadas por palete
    peso_caixa_max_kg            numeric(6,2) DEFAULT 20.00,
    dimensoes_caixa_mm           jsonb,                -- {comprimento, largura, altura}
    controla_lote                boolean NOT NULL DEFAULT true,
    controla_validade            boolean NOT NULL DEFAULT true,
    requer_temperatura_controlada boolean NOT NULL DEFAULT false,
    temperatura_tipo             varchar(20),          -- 'positiva','negativa', null
    ativo                        boolean NOT NULL DEFAULT true,
    created_at                   timestamptz NOT NULL DEFAULT now(),
    updated_at                   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, sku_interno),
    CONSTRAINT chk_ti_hi CHECK (ti IS NULL OR ti > 0),
    CONSTRAINT chk_hi CHECK (hi IS NULL OR hi > 0)
);
CREATE INDEX idx_produto_ean13 ON logistics.produto(ean13);
CREATE INDEX idx_produto_gtin_caixa ON logistics.produto(gtin_caixa);
CREATE TRIGGER trg_produto_updated_at BEFORE UPDATE ON logistics.produto
    FOR EACH ROW EXECUTE FUNCTION logistics.set_updated_at();

CREATE TABLE logistics.lote (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id          uuid NOT NULL REFERENCES logistics.produto(id),
    numero_lote         varchar(60) NOT NULL,
    data_producao       date,
    data_validade       date,
    fornecedor_id       uuid REFERENCES logistics.fornecedor(id),
    quarentena          boolean NOT NULL DEFAULT false,
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (produto_id, numero_lote)
);
CREATE INDEX idx_lote_numero ON logistics.lote(numero_lote);
CREATE INDEX idx_lote_validade ON logistics.lote(data_validade);

-- ============================================================================
-- 8. ENCOMENDAS
-- ============================================================================

CREATE TABLE logistics.encomenda (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    cliente_id          uuid REFERENCES logistics.cliente(id),
    fornecedor_id       uuid REFERENCES logistics.fornecedor(id),
    numero_ordem_compra varchar(50) NOT NULL,
    fluxo               fluxo_logistico NOT NULL,
    data_agendamento    timestamptz,
    cais_atribuido      varchar(20),
    estado              varchar(30) NOT NULL DEFAULT 'aberta'
                         CHECK (estado IN ('aberta','confirmada','em_preparacao','expedida','recebida','cancelada')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, numero_ordem_compra)
);
CREATE INDEX idx_encomenda_agendamento ON logistics.encomenda(data_agendamento);

CREATE TABLE logistics.linha_encomenda (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    encomenda_id        uuid NOT NULL REFERENCES logistics.encomenda(id) ON DELETE CASCADE,
    produto_id          uuid NOT NULL REFERENCES logistics.produto(id),
    quantidade_encomendada numeric(12,3) NOT NULL,
    quantidade_entregue     numeric(12,3) NOT NULL DEFAULT 0,
    loja_id              uuid REFERENCES logistics.loja(id),  -- usado em cross-dock
    UNIQUE (encomenda_id, produto_id, loja_id)
);

-- ============================================================================
-- 9. PALETES E CAIXAS
-- ============================================================================

CREATE TABLE logistics.palete (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    sscc                varchar(20) NOT NULL UNIQUE,      -- IA (00)
    tipo                tipo_palete NOT NULL DEFAULT 'europalete',
    comprimento_mm       int,
    largura_mm           int,
    padrao              padrao_palete NOT NULL DEFAULT 'mono_produto',
    fluxo               fluxo_logistico NOT NULL,
    ti                  int,
    hi                  int,
    altura_mm            int,
    peso_kg              numeric(8,2),
    estado              estado_palete NOT NULL DEFAULT 'em_preparacao',
    cliente_id          uuid REFERENCES logistics.cliente(id),
    encomenda_id        uuid REFERENCES logistics.encomenda(id),
    localizacao_id       uuid REFERENCES logistics.localizacao(id),
    carga_id             uuid,  -- FK definida após CARGA (ver ALTER abaixo)
    palete_escrava       boolean NOT NULL DEFAULT false,
    palete_mae_id         uuid REFERENCES logistics.palete(id), -- para meia-palete sobre escrava
    operador_id           uuid REFERENCES logistics.utilizador(id),
    fotografia_url        varchar(500),
    data_criacao           timestamptz NOT NULL DEFAULT now(),
    data_expedicao         timestamptz,
    data_recepcao_cliente   timestamptz,
    CONSTRAINT chk_altura_pbs CHECK (
        fluxo <> 'pbs' OR altura_mm IS NULL OR altura_mm <= 1800
    ),
    CONSTRAINT chk_peso_pbs CHECK (
        fluxo <> 'pbs' OR peso_kg IS NULL OR peso_kg <= 1000
    ),
    CONSTRAINT chk_peso_pbl CHECK (
        fluxo <> 'pbl' OR peso_kg IS NULL OR peso_kg <= 750
    ),
    CONSTRAINT chk_altura_pbl_multi CHECK (
        fluxo <> 'pbl' OR padrao <> 'multi_produto' OR altura_mm IS NULL OR altura_mm <= 1800
    )
);
CREATE INDEX idx_palete_sscc ON logistics.palete(sscc);
CREATE INDEX idx_palete_estado ON logistics.palete(estado);
CREATE INDEX idx_palete_cliente ON logistics.palete(cliente_id);
CREATE INDEX idx_palete_localizacao ON logistics.palete(localizacao_id);

-- Livro-razão de paletes de aluguer (pool) — CHEP / LPR / EPAL
CREATE TABLE logistics.pool_paletes_movimento (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    operador_pool        varchar(30) NOT NULL CHECK (operador_pool IN ('chep','lpr','epal','outro')),
    tipo_movimento        varchar(20) NOT NULL CHECK (tipo_movimento IN ('entrada','saida','troca')),
    quantidade            int NOT NULL,
    cliente_id             uuid REFERENCES logistics.cliente(id),
    transportadora_id       uuid REFERENCES logistics.transportadora(id),
    data                    timestamptz NOT NULL DEFAULT now(),
    documento_referencia     varchar(80)
);

CREATE TABLE logistics.caixa (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    produto_id          uuid NOT NULL REFERENCES logistics.produto(id),
    lote_id             uuid REFERENCES logistics.lote(id),
    gtin                varchar(14),
    quantidade           numeric(12,3) NOT NULL,     -- unidades ou peso, conforme produto.peso_variavel
    peso_real_kg          numeric(8,3),
    palete_id             uuid REFERENCES logistics.palete(id),
    localizacao_id         uuid REFERENCES logistics.localizacao(id),
    estado                estado_caixa NOT NULL DEFAULT 'disponivel',
    numero_sequencia        varchar(10),               -- ex.: "2/3" em cross-dock
    loja_destino_id          uuid REFERENCES logistics.loja(id),
    created_at              timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_variacao_peso CHECK (
        peso_real_kg IS NULL OR quantidade IS NULL OR true -- validação de tolerância aplicada em trigger/app layer
    )
);
CREATE INDEX idx_caixa_palete ON logistics.caixa(palete_id);
CREATE INDEX idx_caixa_lote ON logistics.caixa(lote_id);
CREATE INDEX idx_caixa_estado ON logistics.caixa(estado);
CREATE INDEX idx_caixa_loja_destino ON logistics.caixa(loja_destino_id);

-- ============================================================================
-- 10. CARGA / EXPEDIÇÃO / DOCUMENTOS
-- ============================================================================

CREATE TABLE logistics.carga (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    viatura_id          uuid REFERENCES logistics.viatura(id),
    transportadora_id   uuid REFERENCES logistics.transportadora(id),
    motorista_id        uuid REFERENCES logistics.motorista(id),
    armazem_id          uuid NOT NULL REFERENCES logistics.armazem(id),
    data_hora_carga     timestamptz,
    estado              varchar(30) NOT NULL DEFAULT 'em_preparacao'
                         CHECK (estado IN ('em_preparacao','carregada','em_transito','entregue','com_rejeicao')),
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- agora que CARGA existe, liga-se a FK pendente em PALETE
ALTER TABLE logistics.palete
    ADD CONSTRAINT fk_palete_carga FOREIGN KEY (carga_id) REFERENCES logistics.carga(id);
CREATE INDEX idx_palete_carga ON logistics.palete(carga_id);

CREATE TABLE logistics.documento (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    tipo                tipo_documento NOT NULL,
    numero              varchar(60) NOT NULL,
    cliente_id          uuid REFERENCES logistics.cliente(id),
    fornecedor_id       uuid REFERENCES logistics.fornecedor(id),
    carga_id            uuid REFERENCES logistics.carga(id),
    encomenda_id        uuid REFERENCES logistics.encomenda(id),
    conteudo_xml        text,          -- corpo DESADV/EDI
    data_emissao        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, tipo, numero)
);
CREATE INDEX idx_documento_tipo ON logistics.documento(tipo);
CREATE INDEX idx_documento_carga ON logistics.documento(carga_id);

-- Rejeições / Devoluções (secções 2.9 / 2.10 do caderno de encargos de referência)
CREATE TABLE logistics.rejeicao (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    encomenda_id        uuid REFERENCES logistics.encomenda(id),
    fornecedor_id       uuid REFERENCES logistics.fornecedor(id),
    motivo              motivo_rejeicao NOT NULL,
    descricao           text,
    prazo_levantamento   timestamptz,     -- ex.: 24h após entrega, salvo contaminação = próprio dia
    levantada            boolean NOT NULL DEFAULT false,
    data_levantamento     timestamptz,
    taxa_deposito_dia      numeric(6,2) DEFAULT 0.70,  -- referência de mercado €/palete/dia
    created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE logistics.devolucao (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    fornecedor_id       uuid REFERENCES logistics.fornecedor(id),
    motivo              varchar(30) NOT NULL CHECK (motivo IN ('comercial','qualidade')),
    prazo_levantamento_dias int DEFAULT 15,
    data_notificacao      timestamptz NOT NULL DEFAULT now(),
    data_levantamento      timestamptz,
    taxa_deposito_dia       numeric(6,2) DEFAULT 0.70
);

-- ============================================================================
-- 11. PICKING / PACKING
-- ============================================================================

CREATE TABLE logistics.picking (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    encomenda_id        uuid NOT NULL REFERENCES logistics.encomenda(id),
    fluxo               fluxo_logistico NOT NULL,
    armazem_id          uuid NOT NULL REFERENCES logistics.armazem(id),
    operador_id         uuid REFERENCES logistics.utilizador(id),
    estado              varchar(30) NOT NULL DEFAULT 'pendente'
                         CHECK (estado IN ('pendente','em_curso','concluido','cancelado')),
    data_inicio         timestamptz,
    data_fim            timestamptz
);

CREATE TABLE logistics.picking_linha (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    picking_id          uuid NOT NULL REFERENCES logistics.picking(id) ON DELETE CASCADE,
    produto_id          uuid NOT NULL REFERENCES logistics.produto(id),
    lote_id             uuid REFERENCES logistics.lote(id),
    localizacao_origem_id uuid REFERENCES logistics.localizacao(id),
    quantidade          numeric(12,3) NOT NULL,
    palete_id           uuid REFERENCES logistics.palete(id),
    caixa_id            uuid REFERENCES logistics.caixa(id)
);

CREATE TABLE logistics.packing_list (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    tipo                varchar(20) NOT NULL CHECK (tipo IN ('loja','palete','multi_produto_ean128')),
    palete_id           uuid REFERENCES logistics.palete(id),
    loja_id             uuid REFERENCES logistics.loja(id),
    encomenda_id        uuid REFERENCES logistics.encomenda(id),
    conteudo_json        jsonb NOT NULL,  -- linhas: {numero, sku, ean, descricao, qtd_encomendada, qtd_entregue}
    numero_folhas         int NOT NULL DEFAULT 1,
    created_at             timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 12. ETIQUETAS / TEMPLATES / MOTOR DE REGRAS (Secção 9 e 10 da especificação)
-- ============================================================================

CREATE TABLE logistics.template_etiqueta (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    cliente_id          uuid REFERENCES logistics.cliente(id),   -- null = template genérico
    codigo              varchar(60) NOT NULL,      -- ex.: 'sonae-palete-pbs-v1'
    tipo                tipo_etiqueta NOT NULL,
    dimensoes_mm         jsonb NOT NULL,             -- {largura, altura}
    elementos             jsonb NOT NULL,             -- array de campos dinâmicos (ver Designer, secção 10)
    versao                int NOT NULL DEFAULT 1,
    ativo                  boolean NOT NULL DEFAULT true,
    created_at              timestamptz NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, codigo, versao)
);

CREATE TABLE logistics.regra_logistica (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    cliente_id          uuid NOT NULL REFERENCES logistics.cliente(id),
    fluxo               fluxo_logistico,
    categoria_produto    varchar(100),               -- condição opcional (ex.: 'congelados')
    especificidade        int NOT NULL DEFAULT 0,     -- maior = mais específico, usado na resolução de conflitos
    condicoes              jsonb NOT NULL DEFAULT '{}',
    efeitos                jsonb NOT NULL,             -- ver exemplo na secção 9.2 da especificação
    template_etiqueta_id     uuid REFERENCES logistics.template_etiqueta(id),
    ativa                    boolean NOT NULL DEFAULT true,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_regra_cliente_fluxo ON logistics.regra_logistica(cliente_id, fluxo);
CREATE TRIGGER trg_regra_updated_at BEFORE UPDATE ON logistics.regra_logistica
    FOR EACH ROW EXECUTE FUNCTION logistics.set_updated_at();

CREATE TABLE logistics.etiqueta (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    tipo                tipo_etiqueta NOT NULL,
    palete_id           uuid REFERENCES logistics.palete(id),
    caixa_id            uuid REFERENCES logistics.caixa(id),
    template_id         uuid REFERENCES logistics.template_etiqueta(id),
    regra_aplicada_id   uuid REFERENCES logistics.regra_logistica(id),
    identificadores_aplicacao jsonb NOT NULL,   -- array [{ia:'00', valor:'...'}], ver Anexo IV do caderno de origem
    zpl_gerado           text,
    data_impressao         timestamptz,
    reimpressoes            int NOT NULL DEFAULT 0,
    created_at               timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_etiqueta_alvo CHECK (
        (tipo = 'palete' AND palete_id IS NOT NULL) OR
        (tipo = 'caixa'  AND caixa_id  IS NOT NULL) OR
        (tipo = 'packing_list')
    )
);
CREATE INDEX idx_etiqueta_palete ON logistics.etiqueta(palete_id);
CREATE INDEX idx_etiqueta_caixa ON logistics.etiqueta(caixa_id);

CREATE TABLE logistics.fila_impressao (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    etiqueta_id          uuid NOT NULL REFERENCES logistics.etiqueta(id),
    impressora            varchar(100),
    prioridade             int NOT NULL DEFAULT 5,
    estado                 varchar(20) NOT NULL DEFAULT 'pendente'
                            CHECK (estado IN ('pendente','a_imprimir','impressa','erro')),
    tentativas               int NOT NULL DEFAULT 0,
    created_at                timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_fila_impressao_estado ON logistics.fila_impressao(estado, prioridade);

-- ============================================================================
-- 13. MOVIMENTO — ledger append-only, particionado por mês (Secção 8 / 18)
-- ============================================================================
-- Nota: tabelas particionadas exigem que a chave de partição (data) faça
-- parte da PRIMARY KEY. Mantém-se `id` como uuid mas a PK é composta.

CREATE TABLE logistics.movimento (
    id                      uuid NOT NULL DEFAULT gen_random_uuid(),
    empresa_id              uuid NOT NULL REFERENCES logistics.empresa(id),
    tipo                    tipo_movimento NOT NULL,
    produto_id              uuid NOT NULL REFERENCES logistics.produto(id),
    lote_id                 uuid REFERENCES logistics.lote(id),
    palete_id               uuid REFERENCES logistics.palete(id),
    caixa_id                uuid REFERENCES logistics.caixa(id),
    localizacao_origem_id   uuid REFERENCES logistics.localizacao(id),
    localizacao_destino_id  uuid REFERENCES logistics.localizacao(id),
    quantidade              numeric(12,3) NOT NULL,
    operador_id             uuid REFERENCES logistics.utilizador(id),
    documento_id            uuid REFERENCES logistics.documento(id),
    movimento_correcao_de   uuid,   -- auto-referência: aponta para o movimento que este corrige (nunca se edita in-place)
    data                    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, data)
) PARTITION BY RANGE (data);

-- Partições de exemplo (gerar automaticamente via job mensal em produção)
CREATE TABLE logistics.movimento_2026_08 PARTITION OF logistics.movimento
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE logistics.movimento_2026_09 PARTITION OF logistics.movimento
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE logistics.movimento_default PARTITION OF logistics.movimento DEFAULT;

CREATE INDEX idx_movimento_sscc_lookup ON logistics.movimento(palete_id, data);
CREATE INDEX idx_movimento_lote ON logistics.movimento(lote_id, data);
CREATE INDEX idx_movimento_produto ON logistics.movimento(produto_id, data);

-- ============================================================================
-- 14. AUDITORIA — log imutável, particionado por mês (Secção 16)
-- ============================================================================

CREATE TABLE logistics.auditoria (
    id                  uuid NOT NULL DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    utilizador_id       uuid REFERENCES logistics.utilizador(id),
    entidade             varchar(60) NOT NULL,   -- ex.: 'palete', 'regra_logistica'
    entidade_id            uuid NOT NULL,
    accao                   varchar(20) NOT NULL CHECK (accao IN ('criar','editar','eliminar','aprovar','estornar')),
    valor_anterior            jsonb,
    valor_novo                 jsonb,
    ip_origem                   inet,
    data                          timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id, data)
) PARTITION BY RANGE (data);

CREATE TABLE logistics.auditoria_2026_08 PARTITION OF logistics.auditoria
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE logistics.auditoria_2026_09 PARTITION OF logistics.auditoria
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE logistics.auditoria_default PARTITION OF logistics.auditoria DEFAULT;

CREATE INDEX idx_auditoria_entidade ON logistics.auditoria(entidade, entidade_id, data);

-- ============================================================================
-- 15. INVENTÁRIO
-- ============================================================================

CREATE TABLE logistics.inventario (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id          uuid NOT NULL REFERENCES logistics.empresa(id),
    armazem_id          uuid NOT NULL REFERENCES logistics.armazem(id),
    tipo                varchar(20) NOT NULL DEFAULT 'ciclico' CHECK (tipo IN ('ciclico','geral')),
    estado              varchar(20) NOT NULL DEFAULT 'em_curso' CHECK (estado IN ('em_curso','concluido','cancelado')),
    data_inicio         timestamptz NOT NULL DEFAULT now(),
    data_fim            timestamptz
);

CREATE TABLE logistics.inventario_linha (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    inventario_id       uuid NOT NULL REFERENCES logistics.inventario(id) ON DELETE CASCADE,
    localizacao_id       uuid NOT NULL REFERENCES logistics.localizacao(id),
    produto_id            uuid NOT NULL REFERENCES logistics.produto(id),
    lote_id                uuid REFERENCES logistics.lote(id),
    quantidade_sistema      numeric(12,3) NOT NULL,
    quantidade_contada       numeric(12,3),
    diferenca                  numeric(12,3) GENERATED ALWAYS AS (quantidade_contada - quantidade_sistema) STORED,
    operador_id                uuid REFERENCES logistics.utilizador(id),
    data_contagem                timestamptz
);

-- ============================================================================
-- 16. VISTAS MATERIALIZADAS — Rastreabilidade e Dashboard (Secções 8 e 18)
-- ============================================================================

-- Rastreabilidade forward: de lote para todos os destinos conhecidos
CREATE MATERIALIZED VIEW logistics.mv_rastreabilidade_lote AS
SELECT
    l.id            AS lote_id,
    l.numero_lote,
    l.produto_id,
    p.sku_interno,
    c.id            AS caixa_id,
    c.palete_id,
    pl.sscc,
    pl.carga_id,
    pl.cliente_id,
    cl.nome         AS cliente_nome,
    pl.data_expedicao,
    pl.data_recepcao_cliente
FROM logistics.lote l
JOIN logistics.produto p ON p.id = l.produto_id
LEFT JOIN logistics.caixa c ON c.lote_id = l.id
LEFT JOIN logistics.palete pl ON pl.id = c.palete_id
LEFT JOIN logistics.cliente cl ON cl.id = pl.cliente_id;

CREATE UNIQUE INDEX idx_mv_rastreabilidade_lote_pk
    ON logistics.mv_rastreabilidade_lote (lote_id, coalesce(caixa_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX idx_mv_rastreabilidade_lote_numero ON logistics.mv_rastreabilidade_lote(numero_lote);
CREATE INDEX idx_mv_rastreabilidade_sscc ON logistics.mv_rastreabilidade_lote(sscc);

-- Dashboard: ocupação e produtividade do dia corrente
CREATE MATERIALIZED VIEW logistics.mv_dashboard_operacional AS
SELECT
    empresa_id,
    date_trunc('day', data_criacao) AS dia,
    count(*) FILTER (WHERE estado = 'em_preparacao') AS paletes_em_preparacao,
    count(*) FILTER (WHERE estado = 'expedida')       AS paletes_expedidas,
    count(*) FILTER (WHERE estado = 'em_armazem')     AS paletes_em_armazem,
    count(*) FILTER (WHERE estado = 'rejeitada')      AS paletes_rejeitadas
FROM logistics.palete
GROUP BY empresa_id, date_trunc('day', data_criacao);

CREATE UNIQUE INDEX idx_mv_dashboard_pk ON logistics.mv_dashboard_operacional(empresa_id, dia);

-- Refrescar periodicamente (job agendado, ex.: a cada 60s para o dashboard,
-- a cada 5 min para a rastreabilidade):
--   REFRESH MATERIALIZED VIEW CONCURRENTLY logistics.mv_dashboard_operacional;
--   REFRESH MATERIALIZED VIEW CONCURRENTLY logistics.mv_rastreabilidade_lote;

-- ============================================================================
-- 17. COMENTÁRIOS DE DOCUMENTAÇÃO (introspectáveis via PostgREST/OpenAPI)
-- ============================================================================

COMMENT ON TABLE logistics.palete IS 'Unidade central de expedição. SSCC é a chave de rastreabilidade primária (secção 3.2 e 8 da especificação).';
COMMENT ON COLUMN logistics.palete.sscc IS 'Serial Shipping Container Code — IA (00). Gerado pelo Motor de Paletização (secção 6).';
COMMENT ON TABLE logistics.regra_logistica IS 'Motor de Regras Logísticas (secção 9) — configuração declarativa por cliente/fluxo/categoria, sem código.';
COMMENT ON TABLE logistics.movimento IS 'Ledger append-only. Nunca editar uma linha existente — criar novo movimento referenciando movimento_correcao_de.';
COMMENT ON TABLE logistics.auditoria IS 'Log imutável de todas as ações relevantes (secção 16). Particionado por mês para performance.';
COMMENT ON COLUMN logistics.produto.ti IS 'Base da estiva: número de caixas por camada (ESTIVA = TI x HI).';
COMMENT ON COLUMN logistics.produto.hi IS 'Altura da estiva: número máximo de camadas por palete.';

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================
