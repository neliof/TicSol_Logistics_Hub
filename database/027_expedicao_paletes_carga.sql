-- ============================================================
-- Migração 027: Completar schema para Palete de Expedição e Embarque
-- ============================================================
-- Decisão de arquitetura (após revisão do schema existente): em vez de
-- criar tabelas novas genéricas para "Palete Expedição" e "Comprovante
-- Embarque" (o que duplicaria dados e perderia relações), usa-se o que
-- já existe:
--   - logistics.palete       -> Palete Expedição (já tem sscc, ti/hi,
--                                peso_kg, altura_mm, cliente_id, carga_id)
--   - logistics.caixa        -> Produtos dentro da palete (produto_id,
--                                lote_id, quantidade, peso_real_kg)
--   - logistics.carga        -> Comprovante Embarque (já tem viatura_id,
--                                transportadora_id, motorista_id, estado)
--
-- Faltam só os campos que o domínio frontend (types/expedicao.ts) usa e
-- que ainda não tinham coluna própria.
-- ============================================================

BEGIN;

-- Zona de temperatura da palete (mais restritiva das linhas que contém).
-- Frontend: PaletaExpedicao.temperatura_zona.
ALTER TABLE logistics.palete
  ADD COLUMN IF NOT EXISTS temperatura_zona varchar(20)
  CHECK (temperatura_zona IN ('AMBIENTE', 'FRESCO', 'CONGELADO'));

-- Contacto do motorista. Frontend: ComprovanteEmbarque.contacto_motorista.
ALTER TABLE logistics.motorista
  ADD COLUMN IF NOT EXISTS contacto varchar(30);

-- Dados reais de embarque (medidos na saída, podem diferir do estimado)
-- e fecho do ciclo de entrega. Frontend: ComprovanteEmbarque.peso_real_kg,
-- volume_real_m3, observacoes, data_entrega_real.
ALTER TABLE logistics.carga
  ADD COLUMN IF NOT EXISTS peso_real_kg numeric(10,2),
  ADD COLUMN IF NOT EXISTS volume_real_m3 numeric(10,3),
  ADD COLUMN IF NOT EXISTS observacoes text,
  ADD COLUMN IF NOT EXISTS data_entrega_real timestamptz,
  ADD COLUMN IF NOT EXISTS operador_embarque varchar(120);

-- app_user precisa de acesso às tabelas que os novos endpoints usam.
-- Estas tabelas já existiam antes da 026_grants_app_user.sql, por isso
-- não são cobertas pelo ALTER DEFAULT PRIVILEGES lá configurado (que só
-- se aplica a objetos criados depois de correr) — GRANT explícito aqui.
GRANT SELECT, INSERT, UPDATE ON
  logistics.palete,
  logistics.caixa,
  logistics.carga,
  logistics.viatura,
  logistics.motorista,
  logistics.transportadora,
  logistics.sscc_sequencia
TO app_user;
GRANT EXECUTE ON FUNCTION logistics.gerar_sscc(uuid) TO app_user;

COMMIT;
