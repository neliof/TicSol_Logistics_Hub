# Setup Migrations — TicSol Logistics Hub

## Ordem de Execução

Executar migrations nesta ordem (algumas já existem, 020_recepcao_schema.sql é nova):

```bash
# Existing migrations (order matters due to foreign keys)
psql -U app_user -d ticsol_logistics_hub -f 01_schema.sql
psql -U app_user -d ticsol_logistics_hub -f 02_security.sql
psql -U app_user -d ticsol_logistics_hub -f 03_functions_rpc.sql
psql -U app_user -d ticsol_logistics_hub -f 04_regras_sonae_mc.sql
psql -U app_user -d ticsol_logistics_hub -f 05_simulacao_dados_ficticios.sql
psql -U app_user -d ticsol_logistics_hub -f 06_artsoft_sync_staging.sql
psql -U app_user -d ticsol_logistics_hub -f 07_guias_transporte.sql
psql -U app_user -d ticsol_logistics_hub -f 08_app_user_rls.sql
psql -U app_user -d ticsol_logistics_hub -f 09_usuarios.sql
psql -U app_user -d ticsol_logistics_hub -f 11_update_artsoft_field_paths.sql
psql -U app_user -d ticsol_logistics_hub -f 12_utilizador_auth.sql
psql -U app_user -d ticsol_logistics_hub -f 13_mapeamento_produtos_terceiros_stock.sql
psql -U app_user -d ticsol_logistics_hub -f 14_mapeamento_guias_transporte.sql

# NEW: P1-P4 Schema (Receção, Paletização, Stock, Expedição)
psql -U app_user -d ticsol_logistics_hub -f 020_recepcao_schema.sql
```

## Tabelas Criadas por 020_recepcao_schema.sql

### Receção (P1)
- `logistics.recepcao` — receções master
- `logistics.recepcao_documento` — documentos fornecedor
- `logistics.recepcao_divergencia` — divergências registadas
- `logistics.recepcao_lote` — lotes por linha
- `logistics.recepcao_artsoft_integracao` — entrada ERP
- `logistics.recepcao_auditoria` — audit trail

### Paletização (P2)
- `logistics.recepcao_palete` — paletes criadas
- `logistics.palete_movimento` — histórico movimentos

## Verificação Pós-Migration

```sql
-- Verificar tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'logistics' 
AND table_name LIKE 'recepcao%' OR table_name LIKE 'palete%';

-- Verificar RLS policies
SELECT policyname, tablename 
FROM pg_policies 
WHERE tablename LIKE 'recepcao%' OR tablename LIKE 'palete%';

-- Verificar índices
SELECT indexname, tablename 
FROM pg_indexes 
WHERE tablename LIKE 'recepcao%' OR tablename LIKE 'palete%';
```

## Rollback (Se necessário)

```sql
-- Drop todas as tabelas P1-P4 (com cascade)
DROP TABLE IF EXISTS logistics.recepcao_auditoria CASCADE;
DROP TABLE IF EXISTS logistics.recepcao_artsoft_integracao CASCADE;
DROP TABLE IF EXISTS logistics.palete_movimento CASCADE;
DROP TABLE IF EXISTS logistics.recepcao_palete CASCADE;
DROP TABLE IF EXISTS logistics.recepcao_lote CASCADE;
DROP TABLE IF EXISTS logistics.recepcao_divergencia CASCADE;
DROP TABLE IF EXISTS logistics.recepcao_documento CASCADE;
DROP TABLE IF EXISTS logistics.recepcao CASCADE;
```

## Status

- ✅ 01-14: Existing (já aplicadas)
- ✅ 020: New P1-P4 Schema (pronta para aplicar)
- ⏳ Setup: Aguarda execução manual ou via CI/CD
