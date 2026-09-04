# E2E Testing vs Staging ARTSOFT

**Bloqueador de Produção.** Requer staging ARTSOFT + network access.

---

## Prerequisites

- [ ] Staging ARTSOFT disponível
- [ ] Credenciais ARTSOFT (host, utilizador, senha)
- [ ] Guias de transporte existentes em staging (V960, V980)
- [ ] Network access (firewall rules if needed)
- [ ] Local DB pronto (postgres running)
- [ ] API server pronto (npm start)

---

## Phase 1: Connection & Configuration

### 1.1 Verify ARTSOFT Reachability

```bash
# Ping ARTSOFT host
ping artsoft.staging.company.com

# Test port access
nc -zv artsoft.staging.company.com 8000

# Check credentials (manual auth test)
curl -v -u sync_user:senha_secreta http://artsoft.staging.company.com:8000/Queries/Query \
  -X POST \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?><root></root>'
# Expect: 401 (Digest auth required, not Basic)
```

### 1.2 Configure ARTSOFT Connection

```sql
psql -d ticsol_logistics_hub << 'EOF'
UPDATE logistics.configuracao SET valor = 'artsoft.staging.company.com'
WHERE chave = 'artsoft.host';

UPDATE logistics.configuracao SET valor = '8000'
WHERE chave = 'artsoft.porta';

UPDATE logistics.configuracao SET valor = 'sync_user'
WHERE chave = 'artsoft.utilizador';

UPDATE logistics.configuracao SET valor = 'senha_secreta'
WHERE chave = 'artsoft.senha';

-- Verify
SELECT chave, valor FROM logistics.configuracao
WHERE chave LIKE 'artsoft.%' OR chave LIKE 'guias.%'
ORDER BY chave;
EOF
```

### 1.3 Clear Old Test Data

```sql
-- Remove any prior test imports
DELETE FROM logistics.linha_documento
WHERE documento_id IN (
  SELECT id FROM logistics.documento
  WHERE origem_sistema = 'ARTSOFT' AND empresa_id = 1
);

DELETE FROM logistics.documento
WHERE origem_sistema = 'ARTSOFT' AND empresa_id = 1;

-- Verify clean state
SELECT COUNT(*) FROM logistics.documento WHERE empresa_id = 1;
-- Expected: 0 (or only non-ARTSOFT docs)
```

---

## Phase 2: Initial Sync

### 2.1 Trigger Manual Sync

```bash
# Via CLI (fastest for testing)
node artsoft-sync/cli.js --empresa-id 1

# Or via API
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.local","password":"teste123"}' | jq -r '.token')

curl -s -X POST http://localhost:3000/api/artsoft/guias/sync \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

### 2.2 Monitor Sync Progress

**Terminal 1: Logs**
```bash
tail -f /tmp/sync.log | jq 'select(.type=="sync_start" or .type=="sync_end")'
```

**Terminal 2: Database Watch**
```bash
watch -n 2 "psql -d ticsol_logistics_hub -c 'SELECT COUNT(*) FROM logistics.documento WHERE origem_sistema = \"ARTSOFT\"'"
```

**Terminal 3: Audit Trail**
```bash
psql -d ticsol_logistics_hub << 'EOF'
SELECT correlation_id, estado, num_paginas, criado_em
FROM logistics.sincronizacao_execucao
ORDER BY criado_em DESC LIMIT 5;
EOF
```

### 2.3 Inspect Results

```sql
-- Count imported docs
SELECT COUNT(*) as total_docs FROM logistics.documento
WHERE origem_sistema = 'ARTSOFT' AND empresa_id = 1;

-- Sample first doc
SELECT id, serie, numero, tipo_saft, data_documento, sincronizado_em
FROM logistics.documento
WHERE origem_sistema = 'ARTSOFT'
LIMIT 1 \gx

-- Count lines
SELECT COUNT(*) as total_lines FROM logistics.linha_documento
WHERE documento_id IN (
  SELECT id FROM logistics.documento
  WHERE origem_sistema = 'ARTSOFT' AND empresa_id = 1
);

-- Sample lines
SELECT nr_linha, artigo_codigo, descricao, quantidade
FROM logistics.linha_documento
WHERE documento_id = (
  SELECT id FROM logistics.documento
  WHERE origem_sistema = 'ARTSOFT' LIMIT 1
)
ORDER BY nr_linha;

-- Check sync status
SELECT estado, COUNT(*) as count FROM logistics.sincronizacao_execucao
WHERE empresa_id = 1
GROUP BY estado
ORDER BY count DESC;
```

---

## Phase 3: Field Path Validation

### 3.1 Confirm Seed Paths

Current seed in `database/09_usuarios.sql`:

| Campo | form_path | ativo | Status |
|-------|-----------|-------|--------|
| serie | %DocFch.Doc.Serie | ✅ | Confirmed |
| numero | %DocFch.Doc.NrDoc | ✅ | Confirmed |
| data_documento | %DocFch.Doc.DataDocum | ✅ | Confirmed |
| tipo_saft | %DocFch.Inf.TpSAFT | ✅ | Confirmed |
| terceiro_numero | %DocFch.Ter.Terceiro | ✅ | Confirmed |
| artigo_codigo (linha) | %DocLan.Cod.Codigo | ✅ | Confirmed |
| quantidade | %DocLan.Qtd.Movim | ✅ | Confirmed |
| **matricula** | %DocFch.Logis.Matricula | ❓ | **TO CONFIRM** |
| **morada_carga** | %DocFch.Logis.EndCarga | ❓ | **TO CONFIRM** |
| **morada_descarga** | %DocFch.Logis.EndDescarga | ❓ | **TO CONFIRM** |
| **peso** | %DocFch.Logis.Peso | ❓ | **TO CONFIRM** |

### 3.2 Query ARTSOFT to Validate Paths

```bash
# Ask ARTSOFT admin for schema or test:
# 1. DocFch/CfgDocum endpoint (lists available form fields)
# 2. Sample guide query with each field
# 3. Confirm path format (% prefix, dot notation)

# Example: Query one guide with all fields
curl -X POST http://artsoft.staging.company.com:8000/Queries/Query \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?>
<root type="list" name="DocFch" query="DocFch|V960">
  <defcol>
    <DocSerie form="%DocFch.Doc.Serie"/>
    <DocNrDoc form="%DocFch.Doc.NrDoc"/>
    <Matricula form="%DocFch.Logis.Matricula"/>
    <EndCarga form="%DocFch.Logis.EndCarga"/>
    <Peso form="%DocFch.Logis.Peso"/>
  </defcol>
</root>'

# If 404 or empty: path wrong, try alternative
```

### 3.3 Update Paths

Once confirmed:

```sql
UPDATE logistics.mapeamento_campo
SET ativo = true, form_path = '%DocFch.Logis.Matricula'
WHERE empresa_id = 1 AND campo = 'matricula';

UPDATE logistics.mapeamento_campo
SET ativo = true, form_path = '%DocFch.Logis.EndCarga'
WHERE empresa_id = 1 AND campo = 'morada_carga';

UPDATE logistics.mapeamento_campo
SET ativo = true, form_path = '%DocFch.Logis.EndDescarga'
WHERE empresa_id = 1 AND campo = 'morada_descarga';

UPDATE logistics.mapeamento_campo
SET ativo = true, form_path = '%DocFch.Logis.Peso'
WHERE empresa_id = 1 AND campo = 'peso';

-- Verify
SELECT campo, form_path, ativo FROM logistics.mapeamento_campo
WHERE empresa_id = 1 AND ativo = true
ORDER BY ordem, campo;
```

### 3.4 Re-sync with Updated Paths

```bash
# Clear and re-import with new paths
DELETE FROM logistics.documento WHERE origem_sistema = 'ARTSOFT' AND empresa_id = 1;
node artsoft-sync/cli.js --empresa-id 1

# Verify new fields populated
SELECT matricula, morada_carga, morada_descarga, peso
FROM logistics.documento
WHERE origem_sistema = 'ARTSOFT'
LIMIT 5;
```

---

## Phase 4: Validation Checklist

### Data Integrity

- [ ] All guias have serie + numero (no NULLs)
- [ ] All linhas have artigo_codigo (preserved even if produto_id NULL)
- [ ] No duplicate guias (series/numero unique)
- [ ] tipo_saft only contains valid values (GR, GT, GA, GC, GD)
- [ ] Dates parse correctly (data_documento is DATE, not string)

### Field Completeness

- [ ] Cabeçalho fields: serie, numero, data_documento, tipo_saft, terceiro_nome, observacoes
- [ ] Linha fields: artigo_codigo, descricao, quantidade, unidade
- [ ] **New fields** (post-path confirmation): matricula, morada_carga, morada_descarga, peso
- [ ] No unexpected NULLs on required fields

### Performance

- [ ] Sync duration < 60s per empresa (target: <30s)
- [ ] No timeouts or partial imports
- [ ] All pages consumed (check num_paginas in audit trail)
- [ ] Deduplication working (second sync returns 0 new docs if no changes)

### RLS & Security

- [ ] User 1 cannot see empresa 2 docs
- [ ] JWT expiry enforced (24h)
- [ ] Rate limiting blocks rapid login attempts (>5 in 15min)

### Audit Trail

- [ ] sincronizacao_execucao.estado = 'completo'
- [ ] correlation_id present (uuid format)
- [ ] request_xml / response_xml logged (first 5000 chars)
- [ ] Timestamps align (criado_em = sync start time)

---

## Phase 5: Problem Resolution

### Common Issues & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Connection timeout" | ARTSOFT unreachable | Check firewall, DNS, credentials |
| "No documents imported" | Series not configured | Verify guias.series in DB |
| "documento sem série/número" | Field path wrong | Confirm %DocFch.Doc.Serie exists |
| "produto_id always NULL" | No matching articles | Create test products or accept NULL |
| "documento duplicado N times" | Missing UPSERT logic | Verify natural key: (empresa_id, serie, numero) |
| "linhas mismatch" | Parsing error | Check Lans sub-query, compare XML |

### Debug Mode

```bash
# Verbose logging
LOG_LEVEL=debug npm start

# Dry-run (no DB changes)
node artsoft-sync/cli.js --empresa-id 1 --dry-run

# Manual ARTSOFT query
curl -X POST http://artsoft.staging.company.com:8000/Queries/Query \
  -u sync_user:senha_secreta \
  --digest \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?>...' > response.xml

# Parse offline
node -e "const { parseXml } = require('./artsoft/xml.js'); console.log(JSON.stringify(parseXml(require('fs').readFileSync('response.xml', 'utf8')), null, 2))"
```

---

## Phase 6: Sign-Off

Once validated:

- [ ] Field paths confirmed and active
- [ ] At least 10 documents imported successfully
- [ ] All validation checklist items pass
- [ ] Performance meets targets
- [ ] No data loss or corruption
- [ ] RLS enforced correctly

**Sign-off**: Ready for production deployment.

---

## Timeline

| Phase | Effort | Notes |
|-------|--------|-------|
| 1. Connection | 30min | Network + config + ARTSOFT admin assist |
| 2. Initial Sync | 15min | Watch logs + DB validation |
| 3. Field Paths | 1-2h | Confirm with ARTSOFT, update config |
| 4. Validation | 30min | Run checklist |
| 5. Problem Resolution | 1-2h | Debug if issues found |
| 6. Sign-off | 15min | Final approval |
| **Total** | **3-5h** | Depends on ARTSOFT discovery |

---

## Rollback

If production issues:

```sql
-- Delete bad imports
DELETE FROM logistics.documento
WHERE origem_sistema = 'ARTSOFT'
AND criado_em > NOW() - INTERVAL '1 hour';

-- Restore from backup
psql -d ticsol_logistics_hub < backup-20260904.sql.gz
```

---

*Ready when staging ARTSOFT available.*
