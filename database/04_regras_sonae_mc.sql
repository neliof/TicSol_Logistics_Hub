-- ============================================================================
-- TicSol Logistics Hub — 04_regras_sonae_mc.sql
-- Popula o Motor de Regras Logísticas (Secção 9) com o caso real Sonae MC,
-- extraído do Caderno de Encargos Logístico analisado.
-- Depende de: 01_schema.sql, 02_security.sql, 03_functions_rpc.sql
-- ============================================================================
SET search_path TO logistics, public;

-- ----------------------------------------------------------------------------
-- 0. Empresa e Cliente de referência (idempotente)
-- ----------------------------------------------------------------------------
INSERT INTO logistics.empresa (id, nome, nif)
VALUES ('11111111-1111-1111-1111-111111111111', 'Ticsol Informática, Lda.', '500123456')
ON CONFLICT (id) DO NOTHING;

INSERT INTO logistics.cliente (id, empresa_id, codigo_interno, nome, tipo)
VALUES ('a0000000-0000-0000-0000-000000005001', '11111111-1111-1111-1111-111111111111', 'SONAE-MC', 'Sonae MC', 'distribuicao')
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 1. Templates de etiqueta (Secção 10) — versões mínimas, a detalhar no
--    Designer visual; aqui só a estrutura de dados de suporte às regras.
-- ----------------------------------------------------------------------------
INSERT INTO logistics.template_etiqueta (id, empresa_id, cliente_id, codigo, tipo, dimensoes_mm, elementos)
VALUES
  ('b0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-000000005001', 'sonae-palete-pbs-v1', 'palete',
   '{"largura":148,"altura":210}',
   '[{"tipo":"texto","campo":"nome_fornecedor"},{"tipo":"barcode_gs1_128","identificadores":["00","02","37","10","15","3102"]},{"tipo":"texto","campo":"numero_ordem_compra"}]'),
  ('b0000000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-000000005001', 'sonae-palete-pbl-multiproduto-v1', 'palete',
   '{"largura":148,"altura":210}',
   '[{"tipo":"barcode_gs1_128","identificadores":["00","02","37","10","15","3102"]},{"tipo":"texto","campo":"numero_ordem_compra"}]'),
  ('b0000000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111',
   'a0000000-0000-0000-0000-000000005001', 'sonae-caixa-crossdock-v1', 'caixa',
   '{"largura":100,"altura":80}',
   '[{"tipo":"texto","campo":"codigo_loja_destino"},{"tipo":"texto","campo":"nome_loja_destino"},{"tipo":"texto","campo":"numeracao_caixa"}]')
ON CONFLICT (empresa_id, codigo, versao) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. Regras — cada uma corresponde a uma cláusula real do caderno de
--    encargos analisado (secções 4.1, 4.2, 4.3, 2.6.3 e 2.7.14)
-- ----------------------------------------------------------------------------

-- Regra base PBS (especificidade 1 — aplica-se por omissão a todo o fluxo PBS)
INSERT INTO logistics.regra_logistica
  (empresa_id, cliente_id, fluxo, categoria_produto, especificidade, condicoes, efeitos, template_etiqueta_id)
VALUES (
  '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000005001',
  'pbs', NULL, 1, '{}',
  '{
     "etiqueta_palete": {
       "identificadores_aplicacao": ["00","02","37","10","15","3102"],
       "posicao": "topo_direita_lado_direito",
       "altura_colocacao_mm": {"min":400,"max":800},
       "numero_etiquetas": 2,
       "requer_filme": true,
       "requer_cintagem": false
     },
     "paletizacao": {
       "altura_maxima_mm": 1800,
       "peso_maximo_kg": 1000,
       "mono_produto_obrigatorio": true,
       "mono_lote_obrigatorio": true
     }
   }',
  'b0000000-0000-0000-0000-000000000001'
);

-- Exceção: PBS + categoria Congelados (especificidade 2 — vence a regra base)
INSERT INTO logistics.regra_logistica
  (empresa_id, cliente_id, fluxo, categoria_produto, especificidade, condicoes, efeitos, template_etiqueta_id)
VALUES (
  '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000005001',
  'pbs', 'congelados', 2, '{"categoria_produto":"congelados"}',
  '{
     "etiqueta_palete": {
       "identificadores_aplicacao": ["00","02","37","10","15","3102"],
       "posicao": "topo_lado_esquerdo",
       "numero_etiquetas": 2,
       "requer_filme": true
     }
   }',
  'b0000000-0000-0000-0000-000000000001'
);

-- Regra base PBL multi-produto (especificidade 1)
INSERT INTO logistics.regra_logistica
  (empresa_id, cliente_id, fluxo, categoria_produto, especificidade, condicoes, efeitos, template_etiqueta_id)
VALUES (
  '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000005001',
  'pbl', NULL, 1, '{"padrao":"multi_produto"}',
  '{
     "etiqueta_palete": {
       "modo": "por_conjunto_artigo_lote_validade",
       "identificadores_aplicacao": ["00","02","37","10","15","3102"],
       "alternativa": "etiqueta_numerada_com_packing_list",
       "requer_separador_por_ordem_compra": true
     },
     "paletizacao": {
       "altura_maxima_mm": 1500,
       "peso_maximo_kg": 750,
       "excecao_altura_se_colunas_visiveis_mm": 1800
     }
   }',
  'b0000000-0000-0000-0000-000000000002'
);

-- Cross-Dock (especificidade 1) — etiqueta de caixa por loja + packing list
INSERT INTO logistics.regra_logistica
  (empresa_id, cliente_id, fluxo, categoria_produto, especificidade, condicoes, efeitos, template_etiqueta_id)
VALUES (
  '11111111-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000005001',
  'cross_dock', NULL, 1, '{}',
  '{
     "etiqueta_caixa": {
       "campos": ["codigo_loja_destino","nome_loja_destino","numeracao_caixa_n_de_n"],
       "requer_packing_list_loja": true,
       "requer_packing_list_palete": true
     },
     "desadv": {
       "linha_por": "sscc",
       "envio": "no_ato_da_carga"
     }
   }',
  'b0000000-0000-0000-0000-000000000003'
);
