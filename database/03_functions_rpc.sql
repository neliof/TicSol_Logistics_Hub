-- ============================================================================
-- TicSol Logistics Hub — 03_functions_rpc.sql
-- Funções expostas via PostgREST como POST /rpc/<nome>
-- Implementa a lógica descrita na Secção 6 (Motor Inteligente de Paletização)
-- Depende de: 01_schema.sql, 02_security.sql
-- ============================================================================
SET search_path TO logistics, public;

-- ----------------------------------------------------------------------------
-- 1. logistics.gerar_sscc(empresa_id)
--    Gera um SSCC (Serial Shipping Container Code) válido: 18 dígitos,
--    dígito extensão (0-9) + prefixo de empresa (7 dígitos, aqui derivado do
--    NIF/empresa) + número de série sequencial + dígito de controlo (mod-10,
--    pesos 3/1, algoritmo GS1 standard).
-- ----------------------------------------------------------------------------

-- sequência por empresa para gerar o número de série sem colisões
CREATE TABLE IF NOT EXISTS logistics.sscc_sequencia (
    empresa_id  uuid PRIMARY KEY REFERENCES logistics.empresa(id),
    ultimo_num  bigint NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION logistics.gerar_sscc(p_empresa_id uuid)
RETURNS varchar
LANGUAGE plpgsql AS $$
DECLARE
    v_extensao      char(1) := '0';
    v_prefixo       char(7);
    v_serie         bigint;
    v_base17        varchar(17);
    v_soma          int := 0;
    v_peso          int;
    v_digito        int;
    v_check         int;
    i               int;
BEGIN
    -- prefixo de empresa: 7 dígitos derivados de forma estável do UUID
    -- (numa integração real, isto viria do prefixo GS1 atribuído à empresa)
    v_prefixo := lpad((('x' || substr(p_empresa_id::text, 1, 7))::bit(28)::bigint % 10000000)::text, 7, '0');

    INSERT INTO logistics.sscc_sequencia (empresa_id, ultimo_num)
    VALUES (p_empresa_id, 1)
    ON CONFLICT (empresa_id) DO UPDATE SET ultimo_num = logistics.sscc_sequencia.ultimo_num + 1
    RETURNING ultimo_num INTO v_serie;

    v_base17 := v_extensao || v_prefixo || lpad(v_serie::text, 9, '0');

    -- dígito de controlo mod-10 (GS1): da direita para a esquerda,
    -- alterna pesos 3 e 1, começando em 3 na posição mais à direita
    FOR i IN REVERSE 17..1 LOOP
        v_digito := substr(v_base17, 18 - i, 1)::int;
        v_peso := CASE WHEN i % 2 = 1 THEN 3 ELSE 1 END;
        v_soma := v_soma + v_digito * v_peso;
    END LOOP;
    v_check := (10 - (v_soma % 10)) % 10;

    RETURN v_base17 || v_check::text;
END;
$$;

COMMENT ON FUNCTION logistics.gerar_sscc IS 'Gera um SSCC de 18 dígitos com dígito de controlo GS1 válido (mod-10, pesos 3/1). Exposto via POST /rpc/gerar_sscc.';


-- ----------------------------------------------------------------------------
-- 2. logistics.calcular_paletizacao(produto_id, quantidade, fluxo, padrao)
--    Implementa o algoritmo da Secção 6.3 da especificação: dado um produto
--    e uma quantidade, devolve o plano de paletização (nº de paletes,
--    composição de cada uma, altura/peso estimados) já validado contra os
--    limites físicos do fluxo (PBS: 1800mm/1000kg · PBL: 1500mm/750kg).
-- ----------------------------------------------------------------------------

DROP TYPE IF EXISTS logistics.plano_paletizacao_linha CASCADE;
CREATE TYPE logistics.plano_paletizacao_linha AS (
    numero_palete           int,
    caixas_nesta_palete     int,
    camadas                 int,
    altura_estimada_mm      int,
    peso_estimado_kg        numeric(8,2),
    dentro_limites          boolean,
    alertas                 text[]
);

CREATE OR REPLACE FUNCTION logistics.calcular_paletizacao(
    p_produto_id  uuid,
    p_quantidade  numeric,
    p_fluxo       fluxo_logistico,
    p_padrao      padrao_palete DEFAULT 'mono_produto'
)
RETURNS SETOF logistics.plano_paletizacao_linha
LANGUAGE plpgsql AS $$
DECLARE
    v_produto           logistics.produto%ROWTYPE;
    v_altura_base_mm     int := 144;   -- altura standard da europalete (Anexo III)
    v_altura_caixa_mm     int;
    v_peso_caixa_kg        numeric;
    v_caixas_por_palete      int;
    v_num_paletes             int;
    v_limite_altura_mm         int;
    v_limite_peso_kg            numeric;
    v_restante                    numeric;
    v_caixas_nesta                 int;
    v_camadas                       int;
    v_altura_estimada                int;
    v_peso_estimado                   numeric;
    v_alertas                          text[];
    v_linha                             logistics.plano_paletizacao_linha;
    i                                    int;
BEGIN
    SELECT * INTO v_produto FROM logistics.produto WHERE id = p_produto_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto % não encontrado', p_produto_id;
    END IF;
    IF v_produto.ti IS NULL OR v_produto.hi IS NULL THEN
        RAISE EXCEPTION 'Produto % não tem TI/HI definidos — confirma a estiva antes de paletizar', p_produto_id;
    END IF;

    v_altura_caixa_mm := coalesce((v_produto.dimensoes_caixa_mm->>'altura')::int, 300);
    v_peso_caixa_kg := coalesce(v_produto.peso_liquido_kg, 0);
    v_caixas_por_palete := v_produto.ti * v_produto.hi;
    v_num_paletes := ceil(p_quantidade / v_caixas_por_palete);

    -- limites físicos por fluxo (Secção 4.1/4.2 do caderno de encargos de referência)
    v_limite_altura_mm := CASE
        WHEN p_fluxo = 'pbs' THEN 1800
        WHEN p_fluxo = 'pbl' AND p_padrao = 'multi_produto' THEN 1500
        WHEN p_fluxo = 'pbl' AND p_padrao = 'mono_produto' THEN 1800
        ELSE NULL
    END;
    v_limite_peso_kg := CASE
        WHEN p_fluxo = 'pbs' THEN 1000
        WHEN p_fluxo = 'pbl' THEN 750
        ELSE NULL
    END;

    v_restante := p_quantidade;
    FOR i IN 1..v_num_paletes LOOP
        v_caixas_nesta := LEAST(v_caixas_por_palete, v_restante)::int;
        v_camadas := ceil(v_caixas_nesta::numeric / v_produto.ti);
        v_altura_estimada := v_altura_base_mm + v_camadas * v_altura_caixa_mm;
        v_peso_estimado := v_caixas_nesta * v_peso_caixa_kg;

        v_alertas := ARRAY[]::text[];
        IF v_limite_altura_mm IS NOT NULL AND v_altura_estimada > v_limite_altura_mm THEN
            v_alertas := v_alertas || format('Altura estimada %sm excede o limite de %sm para %s', round(v_altura_estimada/1000.0,2), round(v_limite_altura_mm/1000.0,2), p_fluxo);
        END IF;
        IF v_limite_peso_kg IS NOT NULL AND v_peso_estimado > v_limite_peso_kg THEN
            v_alertas := v_alertas || format('Peso estimado %skg excede o limite de %skg para %s', v_peso_estimado, v_limite_peso_kg, p_fluxo);
        END IF;
        IF v_produto.peso_liquido_kg IS NULL THEN
            v_alertas := v_alertas || 'Produto sem peso_liquido_kg definido — peso estimado pode não ser fiável';
        END IF;

        v_linha.numero_palete := i;
        v_linha.caixas_nesta_palete := v_caixas_nesta;
        v_linha.camadas := v_camadas;
        v_linha.altura_estimada_mm := v_altura_estimada;
        v_linha.peso_estimado_kg := v_peso_estimado;
        v_linha.dentro_limites := (cardinality(v_alertas) = 0) OR (cardinality(v_alertas) = 1 AND v_produto.peso_liquido_kg IS NULL);
        v_linha.alertas := v_alertas;
        RETURN NEXT v_linha;

        v_restante := v_restante - v_caixas_nesta;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION logistics.calcular_paletizacao IS 'Motor de Paletização (Secção 6) — devolve o plano de paletes para uma quantidade de produto, já validado contra os limites do fluxo. Exposto via POST /rpc/calcular_paletizacao.';

-- Permissões: role authenticated precisa de EXECUTE nas funções RPC
GRANT EXECUTE ON FUNCTION logistics.gerar_sscc(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION logistics.calcular_paletizacao(uuid, numeric, fluxo_logistico, padrao_palete) TO authenticated;
GRANT SELECT, INSERT, UPDATE ON logistics.sscc_sequencia TO authenticated;
