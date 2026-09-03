# API Examples

## Authentication

### Login (Get JWT Token)

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "demo",
    "password": "demo",
    "empresa_id": 1
  }'
```

**Response:**
```json
{
  "token": "eyJhbGc..."
}
```

**Note:** Currently demo auth. Update `server/server.js:189-200` to validate against usuarios table.

---

## Transport Guide Synchronization

### Trigger Manual Sync

```bash
TOKEN="eyJhbGc..."

curl -X POST http://localhost:3000/api/artsoft/guias/sync \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Response (Success):**
```json
{
  "success": true,
  "docs_criados": 42,
  "docs_atualizados": 5,
  "linhas_total": 247,
  "erros": [],
  "ultima_execucao": {
    "estado": "completo",
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
    "paginas": 2
  }
}
```

**Response (Error):**
```json
{
  "error": "guias.series não está configurada. Descobrir as séries disponíveis com DocFch/CfgDocum e preencher em logistics.configuracao.",
  "code": "ErroSincronizacaoGuias"
}
```

---

## Document Access (After Sync)

### List Imported Guides

```bash
TOKEN="eyJhbGc..."

curl -X GET "http://localhost:3000/rest/v1/documento?limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
[
  {
    "id": 1,
    "empresa_id": 1,
    "serie": "V960",
    "numero": "001",
    "doc_id_artsoft": "V960-001-2024-11-15",
    "data_documento": "2024-11-15",
    "tipo_saft": "GR",
    "terceiro_numero": "CLI001",
    "terceiro_nome": "Cliente XYZ",
    "observacoes": null,
    "sincronizado_em": "2026-09-03T14:30:00Z"
  },
  ...
]
```

### Get Guide Lines

```bash
DOCUMENTO_ID=1

curl -X GET "http://localhost:3000/rest/v1/linha_documento?documento_id=eq.$DOCUMENTO_ID" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
[
  {
    "id": 1,
    "documento_id": 1,
    "nr_linha": 1,
    "artigo_codigo": "ART001",
    "descricao": "Produto A",
    "quantidade": "10",
    "unidade": "UN",
    "produto_id": null
  },
  ...
]
```

---

## Sync Status & Audit

### View Sync Executions

```bash
curl -X GET "http://localhost:3000/rest/v1/sincronizacao_execucao?limit=5&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**
```json
[
  {
    "id": 1,
    "empresa_id": 1,
    "correlation_id": "550e8400-e29b-41d4-a716-446655440000",
    "estado": "completo",
    "request_xml": "<?xml version='1.0'?>...",
    "response_xml": "<?xml version='1.0'?>...",
    "num_paginas": 2,
    "criado_em": "2026-09-03T14:30:00Z"
  }
]
```

---

## CLI (Manual Testing)

### Run Sync Locally

```bash
# Set env vars
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=ticsol_logistics_hub
export DB_USER=app_user
export DB_PASSWORD=your_password

# Run sync for empresa_id=1
node artsoft-sync/cli.js --empresa-id 1

# Dry-run (no changes, just logs)
node artsoft-sync/cli.js --empresa-id 1 --dry-run
```

**Output:**
```
[SYNC:1] Conectado ao banco.
[SYNC:1] Carregando config…
[SYNC:1] Carregando mapeamentos…
[SYNC:1] Construindo pedido…
[SYNC:1] Ciclo de paginação iniciado…
[SYNC:1] Página 1: 50 registos, 50 novos, token: inexistente → fim
[SYNC:1] Parseando 50 registos…
[SYNC:1] Mapeando 50 documentos…
[SYNC:1] Registando execução…
[SYNC:1] Sincronização concluída.

=== RESULTADO ===
Documentos criados:  50
Documentos atualizados: 0
Linhas total:        247
Erros:               0

Última execução:
  Estado:      completo
  Correlation: 550e8400-e29b-41d4-a716-446655440000
  Páginas:     1
```

---

## Configuration

### Set ARTSOFT Connection

```bash
# As postgres superuser
psql -d ticsol_logistics_hub -c "
  INSERT INTO logistics.configuracao (empresa_id, chave, valor) VALUES
    (1, 'artsoft.host', 'artsoft.staging.example.com'),
    (1, 'artsoft.porta', '8000'),
    (1, 'artsoft.utilizador', 'sync_user'),
    (1, 'artsoft.senha', 'senha_secreta'),
    (1, 'guias.series', 'V960;V980'),
    (1, 'guias.tpsaft_validos', 'GR;GT;GA;GC;GD'),
    (1, 'guias.page_size', '50'),
    (1, 'guias.max_pages', '300')
  ON CONFLICT DO NOTHING;
"
```

### Activate Field Mappings (After Confirming Paths)

```bash
psql -d ticsol_logistics_hub -c "
  UPDATE logistics.mapeamento_campo
  SET ativo = true, form_path = '%DocFch.Logis.Matricula'
  WHERE empresa_id = 1 AND campo = 'matricula';
"
```

---

## Error Handling

### Missing Configuration

```json
{
  "error": "guias.series não está configurada. Descobrir as séries disponíveis com DocFch/CfgDocum e preencher em logistics.configuracao (ex.: V960;V980).",
  "code": "ErroSincronizacaoGuias"
}
```

**Fix:** Insert config rows (see Configuration section above).

### ARTSOFT Unreachable

```json
{
  "error": "HTTP 0 a http://artsoft.staging/Queries/Query: Network error or timeout",
  "code": "ErroSincronizacaoGuias"
}
```

**Fix:** Verify ARTSOFT host/port in `logistics.configuracao`. Check network connectivity.

### Invalid Token

```json
{
  "error": "Invalid token"
}
```

**Fix:** Re-authenticate via `/auth/login` to get fresh token.

### Access Denied (Enterprise Mismatch)

```json
{
  "error": "No empresa_id in token"
}
```

**Fix:** Ensure JWT token includes `empresa_id` claim. Login with correct empresa_id.

---

## Notes

- All timestamps are UTC (Z suffix)
- Pagination: use `limit` (max 1000) and `offset` for REST endpoints
- RLS enforced: can only access data from your own empresa_id
- Timeouts: 30s on all HTTP requests (configurable per call)
- Sync estado: `completo`, `incompleto`, `erro`, `erro_xml`, `erro_comunicacao`, `erro_autenticacao`, `erro_funcional`
