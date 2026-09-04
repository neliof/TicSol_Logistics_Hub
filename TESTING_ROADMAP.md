# Testing Roadmap — Complete

**Objetivo:** Validar toda stack antes E2E contra ARTSOFT real.

---

## Phase 1: Unit Tests (✅ Done)

Local tests sem BD nem ARTSOFT.

### Executar

```bash
cd artsoft-sync && npm test
cd ../server && npm test
```

### Coverage

- ✅ artsoft/xml.js: XXE safety, parsing
- ✅ artsoft/queryBuilder.js: envelope build, validation
- ✅ config/series.js: list parsing, date normalization
- ✅ guias/parser.js: XML → struct, fallthrough, CDU
- ✅ server/utils/password.js: bcrypt hash/verify
- ✅ server/test/sync-endpoint.test.js: JWT, token claims
- 🔲 artsoft/pagination.js: cicloComToken loop (add if needed)

---

## Phase 2: Integration Tests (BD Mock)

Testa fluxo completo com BD mock.

### Setup

```bash
# Usar docker postgres para tests
docker run -d --name ticsol-test \
  -e POSTGRES_DB=ticsol_test \
  -e POSTGRES_PASSWORD=test \
  -p 5433:5432 \
  postgres:15

# Apply migrations
psql -h localhost -p 5433 -U postgres -d ticsol_test \
  -f database/07_guias_transporte.sql \
  -f database/08_app_user_rls.sql \
  -f database/09_usuarios.sql
```

### Tests to Write

```javascript
// artsoft-sync/guias/test/mapper.test.js
describe('mapper.js', () => {
  it('UPSERT documento com RLS', async () => {
    // Set empresa context
    // Insert doc
    // Verify empresa_id in natural key
    // Verify segunda call = UPDATE
  })
  it('DELETE + INSERT linhas atomicamente', async () => {
    // Insert linhas v1
    // Re-run mapper v2 (modified lines)
    // Verify old lines deleted, new inserted
  })
  it('Reject linhas sem documento', async () => {
    // Try insert linha com documento_id inválido
    // Should FOREIGN KEY error
  })
})

// server/test/integration.test.js
describe('End-to-End Flow', () => {
  it('Login → Sync → Query dados', async () => {
    const token = await login('admin@test.local', 'teste123')
    const result = await triggerSync(token, empresaId)
    const docs = await listDocumentos(token)
    assert(docs.length > 0)
  })
})
```

### Executar

```bash
npm test -- --integration
```

---

## Phase 3: Mock ARTSOFT Tests (Sem Real ARTSOFT)

Simula ARTSOFT responses com XML estático.

### Setup

```javascript
// server/test/mock-artsoft.test.js
import { sincronizarGuias } from '../artsoft-sync/guias/sync.js'

// Mock fetch
global.fetch = async (url, opts) => {
  // Retornar XML mock com 2 guias, 5 linhas
  return {
    ok: true,
    text: async () => `<?xml version='1.0'?>
      <root>
        <rec>
          <DocSerie>V960</DocSerie>
          <DocNrDoc>001</DocNrDoc>
          ...
        </rec>
      </root>`,
  }
}

describe('Mock ARTSOFT', () => {
  it('Parse e store 2 documentos', async () => {
    const resultado = await sincronizarGuias(client, 1, logger)
    assert.strictEqual(resultado.docs_criados, 2)
    assert.strictEqual(resultado.linhas_total, 5)
  })
})
```

### Executar

```bash
npm test -- --mock
```

---

## Phase 4: API Tests (Endpoint Coverage)

Testa todos endpoints com mock BD.

### Endpoints to Test

| Endpoint | Method | Auth | Test |
|----------|--------|------|------|
| /health | GET | ❌ | Status 200 |
| /health/sync/{id} | GET | ❌ | {healthy, lastSync, ...} |
| /auth/login | POST | ❌ | Valid/invalid credentials |
| /rest/v1/documento | GET | ✅ | List, pagination, RLS |
| /rest/v1/documento | POST | ✅ | Insert, validation |
| /rest/v1/linha_documento | GET | ✅ | List, filter, RLS |
| /api/artsoft/guias/sync | POST | ✅ | Trigger sync, state tracking |
| /rpc/sincronizar_guias | POST | ✅ | DB function call |

### Test Script

```bash
# server/test/api-tests.sh
#!/bin/bash

# 1. Health
curl -s http://localhost:3000/health | jq

# 2. Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.local","password":"teste123"}' | jq -r '.token')

# 3. List docs (RLS test)
curl -s http://localhost:3000/rest/v1/documento \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. Trigger sync
curl -s -X POST http://localhost:3000/api/artsoft/guias/sync \
  -H "Authorization: Bearer $TOKEN" | jq

# 5. Check health
curl -s http://localhost:3000/health/sync/1 | jq
```

### Executar

```bash
npm start &  # Start server
bash server/test/api-tests.sh
```

---

## Phase 5: Load Tests (Stress)

Simula múltiplas empresas sincronizando em paralelo.

### Test Plan

```javascript
// server/test/load-test.js
import autocannon from 'autocannon'

const results = await autocannon({
  url: 'http://localhost:3000/api/artsoft/guias/sync',
  connections: 10,
  pipelining: 1,
  duration: 30,
  requests: [
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
      },
    },
  ],
})

console.log(`
Throughput: ${results.throughput.average} req/s
Latency P99: ${results.latency.p99} ms
Errors: ${results.errors}
`)
```

### Executar

```bash
npm test -- --load
```

---

## Phase 6: Security Tests

Validar protecções.

### Tests

```bash
# 1. XXE Rejection
curl -X POST http://localhost:3000/api/artsoft/guias/sync \
  -d '<?xml version="1.0"?><!DOCTYPE foo [...]]><root/>'
# Esperado: rejeição (erro parsing)

# 2. SQL Injection
curl -X GET 'http://localhost:3000/rest/v1/documento; DROP TABLE'
# Esperado: 400 Bad Request

# 3. JWT Forgery
curl -X POST http://localhost:3000/api/artsoft/guias/sync \
  -H "Authorization: Bearer eyJhbGc..." # Invalid signature
# Esperado: 401 Unauthorized

# 4. RLS Bypass
# Login como empresa 1, tentar ler dados empresa 2
# Esperado: 0 resultados

# 5. Brute Force
for i in {1..10}; do
  curl -X POST http://localhost:3000/auth/login \
    -d '{"email":"admin@test.local","password":"wrong"}'
done
# Esperado: eventual 429 Too Many Requests (se rate limiting implementado)
```

---

## Phase 7: E2E vs. Real ARTSOFT (Bloqueador)

### Prerequisite

- Staging ARTSOFT disponível
- Credenciais configuradas em logistics.configuracao
- Acesso à rede ARTSOFT

### Test Plan

```sql
-- 1. Verifica config
SELECT * FROM logistics.configuracao
WHERE empresa_id = 1 AND chave LIKE 'artsoft.%';

-- 2. Clear data (reset)
DELETE FROM logistics.documento WHERE origem_sistema = 'ARTSOFT';

-- 3. Run sync
SELECT * FROM logistics.sincronizar_guias(1);

-- 4. Verify resultado
SELECT COUNT(*) FROM logistics.documento
WHERE origem_sistema = 'ARTSOFT' AND empresa_id = 1;

-- 5. Inspeciona primeira guia
SELECT * FROM logistics.documento
WHERE origem_sistema = 'ARTSOFT' LIMIT 1 \gx

-- 6. Verifica linhas
SELECT * FROM logistics.linha_documento
WHERE documento_id = (SELECT id FROM logistics.documento
  WHERE origem_sistema = 'ARTSOFT' LIMIT 1);

-- 7. Check audit trail
SELECT * FROM logistics.sincronizacao_execucao
WHERE empresa_id = 1 ORDER BY criado_em DESC LIMIT 1;
```

### Checklist

- [ ] Guias importadas com sucesso
- [ ] Todas campos cabecalho preenchidos (sem NULL)
- [ ] Todas linhas têm artigo_codigo
- [ ] produto_id resolvido ou NULL (not error)
- [ ] Estado = 'completo'
- [ ] Nenhuma duplicação (segunda run = UPDATE)
- [ ] RLS enforcement (outro usuario vê 0 resultados)
- [ ] Alerts funcionam (se sync falhasse)

---

## Phase 8: Performance Validation

Medir tempos reais.

### Métricas

```sql
-- Tempo de sync
SELECT
  correlation_id,
  estado,
  EXTRACT(EPOCH FROM (
    SELECT criado_em FROM logistics.sincronizacao_execucao se2
    WHERE se2.correlation_id = se1.correlation_id
    ORDER BY criado_em DESC LIMIT 1
  ) - criado_em) as duracao_segundos
FROM logistics.sincronizacao_execucao se1
WHERE empresa_id = 1
ORDER BY criado_em DESC LIMIT 10;

-- Documentos por segundo
SELECT
  COUNT(*) as documentos,
  SUM(num_paginas) as paginas,
  ROUND(COUNT(*) / 
    EXTRACT(EPOCH FROM (MAX(criado_em) - MIN(criado_em))), 2)
    as docs_por_segundo
FROM logistics.sincronizacao_execucao
WHERE estado = 'completo' AND empresa_id = 1;
```

### Targets

| Métrica | Alvo | Crítico |
|---------|------|---------|
| Sync duration | <60s | >300s |
| Docs/sec | >10 | <1 |
| API latency P99 | <500ms | >2s |
| CPU on sync | <50% | >80% |
| Memory on sync | <500MB | >1GB |

---

## Problemas Esperados & Soluções

### Network Issues

```
Erro: "Connection timeout to artsoft.staging"
Solução: Verificar firewall, DNS, credenciais ARTSOFT
```

### Field Path Mismatches

```
Erro: "Documento sem série/número"
Solução: Confirmar paths em logistics.mapeamento_campo
Ação: UPDATE form_path, set ativo=true
```

### RLS Not Enforced

```
Erro: "User 2 vê dados user 1"
Solução: Verificar set_empresa_context chamado
Ação: Debugar middleware setEmpresaContext
```

### Duplicate Documents

```
Erro: "Doc V960-001 inserido 3x"
Solução: Verificar chave natural (empresa_id, serie, numero)
Ação: DELETE duplicados, confirmar UPSERT lógica
```

### Clock Skew

```
Erro: "Sync incompleto, próxima página never fetched"
Solução: Verificar horário servidor vs. ARTSOFT
Ação: Sincronizar relógios (chrony/ntpd)
```

---

## Test Execution Order

1. **Unit Tests** (sempre)
   ```bash
   npm test
   ```

2. **Integration Tests** (local BD)
   ```bash
   docker run -d -e POSTGRES_PASSWORD=test -p 5433:5432 postgres:15
   npm test -- --integration
   ```

3. **Mock ARTSOFT** (sem real servidor)
   ```bash
   npm test -- --mock
   ```

4. **API Tests** (endpoint coverage)
   ```bash
   npm start &
   bash server/test/api-tests.sh
   ```

5. **E2E Real ARTSOFT** (quando staging disponível)
   ```bash
   psql -d ticsol_logistics_hub << 'EOF'
   UPDATE logistics.configuracao SET valor = '...' 
   WHERE chave = 'artsoft.host';
   EOF
   node artsoft-sync/cli.js --empresa-id 1
   psql -d ticsol_logistics_hub -c "SELECT ..."
   ```

---

## Monitoring During Tests

```bash
# Terminal 1: Logs
npm start 2>&1 | tee /tmp/test.log | jq '.'

# Terminal 2: Database watch
watch -n 1 "psql -d ticsol_logistics_hub -c 'SELECT count(*) FROM logistics.documento'"

# Terminal 3: API calls
curl -s http://localhost:3000/health/sync/1 | watch -n 2

# Terminal 4: Alerts
tail -f /tmp/test.log | grep -i alert
```

---

## CI/CD Integration

### GitHub Actions

```yaml
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
      - run: npm test -- --integration
      - run: npm test -- --load
```

---

## What's Needed to Improve

1. **Rate Limiting** — Protect /auth/login from brute force
2. **Email Alerting** — Implement real SMTP (not stub)
3. **Prometheus Metrics** — Add prom-client for dashboards
4. **Test Coverage** — Increase to >80% lines
5. **API Documentation** — Add Swagger/OpenAPI
6. **Docker Compose** — Multi-container setup
7. **Performance Tuning** — Query optimization, caching
8. **Incremental Sync** — Implement filter by DataDocum
9. **Request Tracing** — OpenTelemetry for debugging
10. **Database Backups** — Automated snapshots

---

*Atualizado: 2026-09-04*
