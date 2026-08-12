-- ============================================================================
-- Simulação de dados fictícios — ciclo completo Receção → Paletização →
-- Etiquetagem → Expedição → Rastreabilidade
-- ============================================================================
SET search_path TO logistics, public;

-- ----------------------------------------------------------------------------
-- 1. Armazém e hierarquia física
-- ----------------------------------------------------------------------------
INSERT INTO logistics.armazem (id, empresa_id, codigo, nome)
VALUES ('c0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'ARM-CBR', 'Armazém Coimbra')
ON CONFLICT DO NOTHING;

INSERT INTO logistics.zona (id, armazem_id, codigo, nome, tipo) VALUES
  ('c0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001', 'Z-SECO', 'Zona Seco', 'seco'),
  ('c0000000-0000-0000-0000-000000000011', 'c0000000-0000-0000-0000-000000000001', 'Z-CONG', 'Zona Congelados', 'congelado')
ON CONFLICT DO NOTHING;

INSERT INTO logistics.rua (id, zona_id, codigo) VALUES
  ('c0000000-0000-0000-0000-000000000020', 'c0000000-0000-0000-0000-000000000010', 'R01'),
  ('c0000000-0000-0000-0000-000000000021', 'c0000000-0000-0000-0000-000000000011', 'R02')
ON CONFLICT DO NOTHING;

INSERT INTO logistics.estante (id, rua_id, codigo) VALUES
  ('c0000000-0000-0000-0000-000000000030', 'c0000000-0000-0000-0000-000000000020', 'E01'),
  ('c0000000-0000-0000-0000-000000000031', 'c0000000-0000-0000-0000-000000000021', 'E01')
ON CONFLICT DO NOTHING;

INSERT INTO logistics.localizacao (id, estante_id, codigo, tipo, capacidade_paletes) VALUES
  ('c0000000-0000-0000-0000-000000000040', 'c0000000-0000-0000-0000-000000000030', 'SECO-01-01', 'reserva', 40),
  ('c0000000-0000-0000-0000-000000000041', 'c0000000-0000-0000-0000-000000000031', 'CONG-01-01', 'reserva', 20),
  ('c0000000-0000-0000-0000-000000000042', 'c0000000-0000-0000-0000-000000000030', 'EXP-CAIS-01', 'expedicao', 33)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Fornecedores e Produtos (3 produtos com perfis diferentes)
-- ----------------------------------------------------------------------------
INSERT INTO logistics.fornecedor (id, empresa_id, codigo_interno, nome, nif) VALUES
  ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'FORN-LATICINIOS', 'Laticínios do Vale, Lda.', '501234567'),
  ('d0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'FORN-CONGELADOS', 'Congelados Atlântico, S.A.', '502345678')
ON CONFLICT DO NOTHING;

INSERT INTO logistics.produto
  (id, empresa_id, fornecedor_id, sku_interno, ean13, gtin_caixa, descricao, categoria,
   peso_liquido_kg, unidades_por_caixa, ti, hi, dimensoes_caixa_mm, requer_temperatura_controlada, temperatura_tipo)
VALUES
  ('e0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000001',
   'LEITE-UHT-1L', '5601234000019', '15601234000016', 'Leite UHT Magro 1L (pack 12)', 'lacticinios',
   12.0, 12, 10, 6, '{"comprimento":400,"largura":300,"altura":250}', false, NULL),
  ('e0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000001',
   'IOGURTE-NAT-4x125', '5601234000026', '15601234000023', 'Iogurte Natural 4x125g', 'lacticinios',
   8.5, 20, 12, 5, '{"comprimento":350,"largura":280,"altura":220}', false, NULL),
  ('e0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 'd0000000-0000-0000-0000-000000000002',
   'ERVILHA-CONG-1KG', '5601234000033', '15601234000030', 'Ervilha Congelada 1kg (pack 10)', 'congelados',
   10.0, 10, 8, 5, '{"comprimento":400,"largura":300,"altura":260}', true, 'negativa')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Lotes
-- ----------------------------------------------------------------------------
INSERT INTO logistics.lote (id, produto_id, numero_lote, data_producao, data_validade, fornecedor_id) VALUES
  ('f0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 'LT260801', '2026-08-01', '2026-11-01', 'd0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000002', 'LT260803', '2026-08-03', '2026-09-15', 'd0000000-0000-0000-0000-000000000001'),
  ('f0000000-0000-0000-0000-000000000003', 'e0000000-0000-0000-0000-000000000003', 'LT260728', '2026-07-28', '2027-07-28', 'd0000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. Encomenda da Sonae MC (fluxo PBS) — 3 linhas, uma por produto
-- ----------------------------------------------------------------------------
INSERT INTO logistics.encomenda (id, empresa_id, cliente_id, numero_ordem_compra, fluxo, data_agendamento, cais_atribuido, estado)
VALUES ('11100000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'a0000000-0000-0000-0000-000000005001', 'OC-SONAE-2026-08-1001', 'pbs',
        '2026-08-10 09:00:00+00', 'CAIS-3', 'confirmada')
ON CONFLICT DO NOTHING;

INSERT INTO logistics.linha_encomenda (encomenda_id, produto_id, quantidade_encomendada) VALUES
  ('11100000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 250),  -- leite: 250 caixas
  ('11100000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000002', 180),  -- iogurte: 180 caixas
  ('11100000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000003', 120)   -- ervilha congelada: 120 caixas
ON CONFLICT DO NOTHING;
-- ============================================================================
-- Materializa o plano de paletização: PALETE + CAIXA + ETIQUETA (via motor
-- de regras, com resolução por especificidade)
-- ============================================================================
SET search_path TO logistics, public;

DO $$
DECLARE
    v_empresa_id    uuid := '11111111-1111-1111-1111-111111111111';
    v_cliente_id    uuid := 'a0000000-0000-0000-0000-000000005001';
    v_encomenda_id  uuid := '11100000-0000-0000-0000-000000000001';
    v_loc_seco      uuid := 'c0000000-0000-0000-0000-000000000040';
    v_loc_cong      uuid := 'c0000000-0000-0000-0000-000000000041';

    -- (produto_id, lote_id, quantidade, categoria, localizacao)
    v_produtos      uuid[] := ARRAY[
        'e0000000-0000-0000-0000-000000000001',
        'e0000000-0000-0000-0000-000000000002',
        'e0000000-0000-0000-0000-000000000003'
    ]::uuid[];
    v_lotes         uuid[] := ARRAY[
        'f0000000-0000-0000-0000-000000000001',
        'f0000000-0000-0000-0000-000000000002',
        'f0000000-0000-0000-0000-000000000003'
    ]::uuid[];
    v_quantidades   int[]  := ARRAY[250, 180, 120];
    v_categorias    text[] := ARRAY['lacticinios', 'lacticinios', 'congelados'];

    v_plano         logistics.plano_paletizacao_linha;
    v_palete_id     uuid;
    v_sscc          varchar;
    v_regra         logistics.regra_logistica%ROWTYPE;
    v_loc           uuid;
    j               int;
BEGIN
    FOR j IN 1..3 LOOP
        v_loc := CASE WHEN v_categorias[j] = 'congelados' THEN v_loc_cong ELSE v_loc_seco END;

        -- resolve a regra mais específica (cliente + fluxo pbs + categoria)
        SELECT * INTO v_regra
        FROM logistics.regra_logistica
        WHERE cliente_id = v_cliente_id
          AND fluxo = 'pbs'
          AND (categoria_produto IS NULL OR categoria_produto = v_categorias[j])
        ORDER BY especificidade DESC
        LIMIT 1;

        FOR v_plano IN
            SELECT * FROM logistics.calcular_paletizacao(v_produtos[j], v_quantidades[j], 'pbs', 'mono_produto')
        LOOP
            v_sscc := logistics.gerar_sscc(v_empresa_id);
            v_palete_id := gen_random_uuid();

            INSERT INTO logistics.palete
                (id, empresa_id, sscc, tipo, padrao, fluxo, ti, hi, altura_mm, peso_kg,
                 estado, cliente_id, encomenda_id, localizacao_id, operador_id)
            SELECT v_palete_id, v_empresa_id, v_sscc, 'europalete', 'mono_produto', 'pbs',
                   p.ti, p.hi, v_plano.altura_estimada_mm, v_plano.peso_estimado_kg,
                   'em_armazem', v_cliente_id, v_encomenda_id, v_loc, NULL
            FROM logistics.produto p WHERE p.id = v_produtos[j];

            -- caixas individuais desta palete, ligadas ao lote real
            INSERT INTO logistics.caixa (empresa_id, produto_id, lote_id, palete_id, localizacao_id, quantidade, estado)
            SELECT v_empresa_id, v_produtos[j], v_lotes[j], v_palete_id, v_loc, 1, 'disponivel'
            FROM generate_series(1, v_plano.caixas_nesta_palete);

            -- etiqueta gerada pelo motor de regras já resolvido acima
            INSERT INTO logistics.etiqueta
                (empresa_id, tipo, palete_id, template_id, regra_aplicada_id, identificadores_aplicacao)
            VALUES (
                v_empresa_id, 'palete', v_palete_id, v_regra.template_etiqueta_id, v_regra.id,
                jsonb_build_array(
                    jsonb_build_object('ia','00','valor', v_sscc),
                    jsonb_build_object('ia','37','valor', v_plano.caixas_nesta_palete::text),
                    jsonb_build_object('ia','10','valor', (SELECT numero_lote FROM logistics.lote WHERE id = v_lotes[j]))
                )
            );
        END LOOP;
    END LOOP;
END $$;

-- Resumo do que foi criado
SELECT p.sku_interno, p.categoria, count(*) AS num_paletes, sum(pl.peso_kg) AS peso_total_kg
FROM logistics.palete pl
JOIN logistics.produto p ON p.id = (SELECT c.produto_id FROM logistics.caixa c WHERE c.palete_id = pl.id LIMIT 1)
GROUP BY p.sku_interno, p.categoria
ORDER BY p.sku_interno;
SET search_path TO logistics, public;

-- Transportadora, viatura, motorista fictícios
INSERT INTO logistics.transportadora (id, empresa_id, nome, nif) VALUES
  ('a1000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Transportes Rápidos, Lda.', '503456789')
ON CONFLICT DO NOTHING;

INSERT INTO logistics.viatura (id, transportadora_id, matricula, tipo) VALUES
  ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', '00-AA-00', 'caixa_termica')
ON CONFLICT DO NOTHING;

INSERT INTO logistics.motorista (id, transportadora_id, nome) VALUES
  ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'José Ferreira')
ON CONFLICT DO NOTHING;

-- Carga
INSERT INTO logistics.carga (id, empresa_id, viatura_id, transportadora_id, motorista_id, armazem_id, data_hora_carga, estado)
VALUES ('a4000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        'a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
        'a3000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
        '2026-08-10 09:15:00+00', 'carregada')
ON CONFLICT DO NOTHING;

-- Associa TODAS as 11 paletes da encomenda a esta carga e marca expedida
UPDATE logistics.palete
SET carga_id = 'a4000000-0000-0000-0000-000000000001',
    estado = 'expedida',
    data_expedicao = '2026-08-10 09:20:00+00'
WHERE encomenda_id = '11100000-0000-0000-0000-000000000001';

-- Documento DESADV (uma linha por SSCC, como a Secção 4.3.10 descreve)
INSERT INTO logistics.documento (empresa_id, tipo, numero, cliente_id, carga_id, encomenda_id, data_emissao)
VALUES ('11111111-1111-1111-1111-111111111111', 'desadv', 'DESADV-2026-08-10-0001',
        'a0000000-0000-0000-0000-000000005001', 'a4000000-0000-0000-0000-000000000001',
        '11100000-0000-0000-0000-000000000001', now());

SELECT count(*) AS paletes_expedidas FROM logistics.palete WHERE carga_id = 'a4000000-0000-0000-0000-000000000001';
