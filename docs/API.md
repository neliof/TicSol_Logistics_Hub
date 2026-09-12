# TicSol Logistics Hub — API Reference

Complete REST API documentation for all 37 endpoints across 4 warehouse phases.

**Base URL:** `http://localhost:3000` (dev) | `https://api.ticsol.com` (prod)

**Authentication:** JWT Bearer token in `Authorization` header

---

## P1 — Receção (17 Endpoints)

Warehouse receiving workflow with line-by-line conference, divergence tracking, and ARTSOFT integration.

### 1. Create Reception
```
POST /api/recepcao/create
```
Creates new warehouse reception order.

**Request:**
```json
{
  "numero_guia": "GUIA-001",
  "numero_encomenda_artsoft": "ENC-123",
  "fornecedor_id": 100,
  "fornecedor_nome": "Fornecedor A",
  "operador_inicio": "user@example.com"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "recepcao": {
    "id": 1,
    "numero_guia": "GUIA-001",
    "estado": "RASCUNHO",
    "total_linhas": 0,
    "data_recepcao": "2026-09-12T10:30:00Z"
  }
}
```

### 2. Update Reception Status
```
PATCH /api/recepcao/{id}
```
Change reception state (RASCUNHO → CONFERIDA → VALIDADA → FINALIZADA).

**Request:**
```json
{
  "estado": "CONFERIDA",
  "operador": "user@example.com"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "recepcao": { "id": 1, "estado": "CONFERIDA" }
}
```

### 3. Add Reception Line
```
POST /api/recepcao/{id}/linha
```
Add product line to reception.

**Request:**
```json
{
  "numero_linha": 1,
  "produto_id": 500,
  "quantidade_esperada": 50,
  "unidade": "unidades",
  "preco_unitario": 25.50
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "linha": {
    "id": 10,
    "recepcao_id": 1,
    "numero_linha": 1,
    "produto_id": 500,
    "quantidade_esperada": 50,
    "quantidade_recebida": 0,
    "estado": "PENDENTE"
  }
}
```

### 4. Record Line Conference
```
POST /api/recepcao/linha/{id}/conferir
```
Record received quantity and calculate differences.

**Request:**
```json
{
  "quantidade_recebida": 48,
  "observacoes": "2 unidades danificadas"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "conferencia": {
    "linha_id": 10,
    "quantidade_esperada": 50,
    "quantidade_recebida": 48,
    "diferenca": -2,
    "percentual_diferenca": -4.0,
    "estado": "DIVERGENCIA"
  }
}
```

### 5. Register Divergence
```
POST /api/recepcao/{id}/divergencia
```
Register discrepancy (missing, excess, damaged, quality issue).

**Request:**
```json
{
  "tipo": "DANIFICADO",
  "quantidade": 2,
  "motivo": "Embalagem danificada",
  "impacto": "REVISAR",
  "produto_id": 500
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "divergencia": {
    "id": 5,
    "recepcao_id": 1,
    "tipo": "DANIFICADO",
    "quantidade": 2,
    "data_registro": "2026-09-12T10:35:00Z"
  }
}
```

### 6. Upload Reception Document
```
POST /api/recepcao/{id}/documento
```
Upload supplier document (transport guide, invoice, photo).

**Request:** (multipart/form-data)
```
Content-Disposition: form-data; name="tipo"
GUIA_TRANSPORTE

Content-Disposition: form-data; name="numero"
GT-12345

Content-Disposition: form-data; name="data"
2026-09-12

Content-Disposition: form-data; name="arquivo"; filename="documento.pdf"
[binary file content]
```

**Response:** `201 Created`
```json
{
  "success": true,
  "documento": {
    "id": 3,
    "recepcao_id": 1,
    "tipo": "GUIA_TRANSPORTE",
    "numero": "GT-12345",
    "url": "/uploads/documentos/doc-3.pdf"
  }
}
```

### 7. Add Reception Lot
```
POST /api/recepcao/linha/{id}/lote
```
Record lot/batch information (expiry, shelf-life).

**Request:**
```json
{
  "numero_lote": "LOTE-20260912",
  "data_validade": "2027-09-12",
  "vida_util_dias": 365,
  "quantidade": 48
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "lote": {
    "id": 8,
    "numero_lote": "LOTE-20260912",
    "data_validade": "2027-09-12",
    "estado": "OK"
  }
}
```

### 8. Assign Warehouse Location
```
POST /api/recepcao/lote/{id}/localizacao
```
Assign storage location (zone, type, address).

**Request:**
```json
{
  "zona": "A",
  "tipo": "RACK",
  "endereco": "A-03-15-02"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "localizacao": {
    "id": 12,
    "lote_id": 8,
    "zona": "A",
    "tipo": "RACK",
    "endereco": "A-03-15-02"
  }
}
```

### 9. Validate Reception
```
POST /api/recepcao/{id}/validar
```
Run pre-finalization validation checklist.

**Response:** `200 OK`
```json
{
  "success": true,
  "validacao": {
    "recepcao_id": 1,
    "todas_linhas_conferidas": true,
    "divergencias_registradas": true,
    "documentos_completos": true,
    "localizacoes_atribuidas": true,
    "artsoft_pronto": true,
    "valido": true
  }
}
```

### 10. Finalize Reception
```
POST /api/recepcao/{id}/finalizar
```
Complete reception and trigger automatic pallet creation.

**Request:**
```json
{
  "observacoes_finais": "Receção completa"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "recepcao": {
    "id": 1,
    "estado": "FINALIZADA",
    "paletes_criadas": 3,
    "data_finalizacao": "2026-09-12T11:00:00Z"
  }
}
```

### 11. Create ARTSOFT Entry
```
POST /api/recepcao/{id}/artsoft/criar-entrada
```
Sync reception to ARTSOFT ERP.

**Request:**
```json
{
  "operador": "user@example.com",
  "retry_count": 0
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "integracao": {
    "id": 2,
    "recepcao_id": 1,
    "status": "SUCESSO",
    "referencia_artsoft": "MV-100123",
    "data_sincronizacao": "2026-09-12T11:05:00Z"
  }
}
```

### 12. Get Reception Details
```
GET /api/recepcao/{id}
```
Retrieve full reception with lines, divergences, documents.

**Response:** `200 OK`
```json
{
  "recepcao": {
    "id": 1,
    "numero_guia": "GUIA-001",
    "estado": "FINALIZADA",
    "linhas": [
      { "id": 10, "numero_linha": 1, "produto_id": 500, "quantidade_recebida": 48 }
    ],
    "divergencias": [
      { "id": 5, "tipo": "DANIFICADO", "quantidade": 2 }
    ],
    "documentos": [
      { "id": 3, "tipo": "GUIA_TRANSPORTE", "numero": "GT-12345" }
    ],
    "paletes": [
      { "id": 1, "sscc": "123456789012345678" }
    ]
  }
}
```

### 13. List Receptions
```
GET /api/recepcao?estado=FINALIZADA&limit=20&offset=0
```
List receptions with filtering and pagination.

**Query Parameters:**
- `estado`: RASCUNHO | CONFERIDA | VALIDADA | FINALIZADA
- `fornecedor_id`: Filter by supplier
- `limit`: Page size (default: 20)
- `offset`: Pagination offset (default: 0)

**Response:** `200 OK`
```json
{
  "receptions": [
    { "id": 1, "numero_guia": "GUIA-001", "estado": "FINALIZADA" }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

### 14. Get Partial Receptions (In Progress)
```
GET /api/recepcao/parcial/lista
```
List incomplete receptions for resumption.

**Response:** `200 OK`
```json
{
  "parciais": [
    {
      "id": 2,
      "numero_guia": "GUIA-002",
      "estado": "CONFERIDA",
      "linhas_conferidas": 3,
      "linhas_pendentes": 2,
      "data_ultima_atualizacao": "2026-09-12T10:50:00Z"
    }
  ]
}
```

### 15. Get Audit Trail
```
GET /api/recepcao/{id}/auditoria
```
Complete operation history for reception.

**Response:** `200 OK`
```json
{
  "auditoria": [
    {
      "id": 1,
      "recepcao_id": 1,
      "operacao": "CRIAR",
      "operador": "user@example.com",
      "dados_anteriores": null,
      "dados_novos": { "estado": "RASCUNHO" },
      "timestamp": "2026-09-12T10:30:00Z"
    }
  ]
}
```

### 16. Get Conference Lines
```
GET /api/recepcao/{id}/conferencia
```
Detailed line-by-line conference data.

**Response:** `200 OK`
```json
{
  "conferencia": [
    {
      "linha_id": 10,
      "numero_linha": 1,
      "produto_id": 500,
      "quantidade_esperada": 50,
      "quantidade_recebida": 48,
      "diferenca": -2,
      "percentual": -4.0,
      "estado": "DIVERGENCIA"
    }
  ]
}
```

### 17. Get Reception Statistics
```
GET /api/recepcao/stats?periodo=mes
```
Aggregated reception metrics.

**Response:** `200 OK`
```json
{
  "stats": {
    "total_receptions": 142,
    "receptions_finalized": 138,
    "avg_conference_time": "45m",
    "divergences_count": 12,
    "divergences_percentage": 8.5
  }
}
```

---

## P2 — Paletização (8 Endpoints)

Automatic pallet management with content tracking and movement history.

### 1. Get Pallet Flow Post-Reception
```
GET /api/paletizacao/fluxo/{recepcao_id}
```
Integrated flow for automatic pallet creation after reception.

**Response:** `200 OK`
```json
{
  "fluxo": {
    "recepcao_id": 1,
    "paletes_sugeridas": 3,
    "items": [
      {
        "lote_id": 8,
        "quantidade": 48,
        "peso_unitario": 5.2,
        "palet_recomendado": 1
      }
    ]
  }
}
```

### 2. Manage Pallet
```
POST /api/paletizacao/gestao
```
Add, remove, edit, or split pallet items.

**Request:**
```json
{
  "operacao": "ADICIONAR",
  "palet_id": 1,
  "lote_id": 8,
  "quantidade": 24
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "palet": {
    "id": 1,
    "sscc": "123456789012345678",
    "conteudo": [
      { "lote_id": 8, "quantidade": 48 }
    ]
  }
}
```

### 3. Create Multiple Pallets
```
POST /api/paletizacao/multiplas
```
Batch create pallets with quantity distribution.

**Request:**
```json
{
  "recepcao_id": 1,
  "quantidade_paletes": 3,
  "distribuicao": [
    { "lote_id": 8, "quantidade_por_palet": 16 }
  ]
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "paletes": [
    { "id": 1, "sscc": "111111111111111111" },
    { "id": 2, "sscc": "222222222222222222" },
    { "id": 3, "sscc": "333333333333333333" }
  ]
}
```

### 4. Split Pallet
```
POST /api/paletizacao/{id}/dividir
```
Divide one pallet into multiple.

**Request:**
```json
{
  "quantidade_nova_palet": 16,
  "lote_id": 8
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "palet_original": { "id": 1, "quantidade": 32 },
  "palet_nova": { "id": 4, "sscc": "444444444444444444", "quantidade": 16 }
}
```

### 5. Consolidate Pallets
```
POST /api/paletizacao/consolidar
```
Merge multiple pallets into one.

**Request:**
```json
{
  "palet_ids": [1, 2],
  "lote_id": 8
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "palet_consolidada": {
    "id": 5,
    "sscc": "555555555555555555",
    "quantidade_total": 64
  }
}
```

### 6. Get Pallet History
```
GET /api/paletizacao/{id}/historico
```
Movement and status timeline for pallet.

**Response:** `200 OK`
```json
{
  "historico": [
    {
      "id": 1,
      "tipo_movimento": "CRIACAO",
      "estado_anterior": null,
      "estado_novo": "CRIADA",
      "timestamp": "2026-09-12T11:00:00Z",
      "operador": "system"
    },
    {
      "id": 2,
      "tipo_movimento": "PALETIZACAO",
      "estado_anterior": "CRIADA",
      "estado_novo": "PALETIZADA",
      "timestamp": "2026-09-12T11:15:00Z",
      "operador": "user@example.com"
    }
  ]
}
```

### 7. Get Pallet Content
```
GET /api/paletizacao/{id}/conteudo
```
Detailed items and quantities in pallet.

**Response:** `200 OK`
```json
{
  "palet": {
    "id": 1,
    "sscc": "123456789012345678",
    "conteudo": [
      {
        "lote_id": 8,
        "numero_lote": "LOTE-20260912",
        "produto_id": 500,
        "quantidade": 48,
        "peso_total": 249.6,
        "data_validade": "2027-09-12"
      }
    ],
    "peso_total": 249.6,
    "quantidade_total_itens": 48
  }
}
```

### 8. Get Available Pallets
```
GET /api/paletizacao/disponivel?estado=PALETIZADA
```
List pallets ready for expedição or stock.

**Response:** `200 OK`
```json
{
  "paletes": [
    {
      "id": 1,
      "sscc": "123456789012345678",
      "estado": "PALETIZADA",
      "quantidade_items": 48,
      "localizacao": "A-03-15-02"
    }
  ],
  "total": 15
}
```

---

## P3 — Stock (6 Endpoints)

Real-time inventory management with reconciliation and alerts.

### 1. Stock Reconciliation
```
POST /api/stock/reconciliacao
```
Compare physical vs. system inventory.

**Request:**
```json
{
  "produto_id": 500,
  "quantidade_fisica": 45,
  "observacoes": "Contagem física do armazém"
}
```

**Response:** `200 OK`
```json
{
  "reconciliacao": {
    "produto_id": 500,
    "quantidade_sistema": 48,
    "quantidade_fisica": 45,
    "diferenca": -3,
    "percentual_diferenca": -6.25,
    "estado": "DIVERGENCIA",
    "requer_revisao": true
  }
}
```

### 2. Get FEFO Status
```
GET /api/stock/fefo?produto_id=500&limite_dias=90
```
First Expiry First Out prioritization with alerts.

**Response:** `200 OK`
```json
{
  "fefo": [
    {
      "lote_id": 8,
      "numero_lote": "LOTE-20260912",
      "data_validade": "2027-09-12",
      "dias_para_vencer": 365,
      "quantidade": 48,
      "estado": "OK"
    },
    {
      "lote_id": 9,
      "numero_lote": "LOTE-20260801",
      "data_validade": "2026-11-01",
      "dias_para_vencer": 50,
      "quantidade": 32,
      "estado": "ALERTA"
    }
  ]
}
```

### 3. Get Lot Status
```
GET /api/stock/lote/{id}
```
Detailed lot information and tracking.

**Response:** `200 OK`
```json
{
  "lote": {
    "id": 8,
    "numero_lote": "LOTE-20260912",
    "produto_id": 500,
    "quantidade_total": 48,
    "quantidade_disponivel": 48,
    "quantidade_reservada": 0,
    "data_validade": "2027-09-12",
    "vida_util_dias": 365,
    "localizacoes": ["A-03-15-02"],
    "estado": "OK"
  }
}
```

### 4. Get Locations
```
GET /api/stock/localizacoes?zona=A&tipo=RACK
```
Multi-location stock tracking by zone/type.

**Response:** `200 OK`
```json
{
  "localizacoes": [
    {
      "id": 12,
      "zona": "A",
      "tipo": "RACK",
      "endereco": "A-03-15-02",
      "lote_id": 8,
      "quantidade": 48,
      "ocupacao_percentual": 75,
      "estado": "OK"
    }
  ],
  "total": 8
}
```

### 5. Get Divergences
```
GET /api/stock/divergencias?estado=PENDENTE
```
List stock discrepancies awaiting resolution.

**Response:** `200 OK`
```json
{
  "divergencias": [
    {
      "id": 5,
      "tipo": "DIFERENCA_INVENTARIO",
      "produto_id": 500,
      "quantidade": -3,
      "data_registro": "2026-09-12T11:20:00Z",
      "estado": "PENDENTE",
      "investigador": null
    }
  ],
  "total": 3
}
```

### 6. Get Critical Alerts
```
GET /api/stock/alertas?nivel=CRITICO
```
Real-time stock alerts for action.

**Response:** `200 OK`
```json
{
  "alertas": [
    {
      "id": 1,
      "tipo": "VALIDADE_PROXIMA",
      "lote_id": 9,
      "numero_lote": "LOTE-20260801",
      "dias_para_vencer": 50,
      "acao_recomendada": "EXPEDIR_PRIORIDADE",
      "critica": true
    },
    {
      "id": 2,
      "tipo": "BAIXO_STOCK",
      "produto_id": 501,
      "quantidade": 5,
      "quantidade_minima": 10,
      "acao_recomendada": "REABASTECER",
      "critica": false
    }
  ]
}
```

---

## P4 — Expedição (6 Endpoints)

Shipment management with tracking and document generation.

### 1. Pre-Shipment Conference
```
POST /api/expedicao/conferencia
```
Review pallets before shipment.

**Request:**
```json
{
  "palet_ids": [1, 2],
  "cliente_id": 200,
  "observacoes": "Pronto para expedição"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "conferencia": {
    "id": 3,
    "numero_referencia": "EXP-001",
    "paletes_conferidas": 2,
    "peso_total": 499.2,
    "estado": "APROVADA"
  }
}
```

### 2. Track Shipment
```
GET /api/expedicao/{id}/rastreamento
```
Real-time shipment status and event timeline.

**Response:** `200 OK`
```json
{
  "rastreamento": [
    {
      "id": 1,
      "status": "PREPARADA",
      "timestamp": "2026-09-12T11:00:00Z",
      "operador": "user@example.com"
    },
    {
      "id": 2,
      "status": "EXPEDIDA",
      "timestamp": "2026-09-12T12:30:00Z",
      "localizacao_saida": "Armazém A"
    },
    {
      "id": 3,
      "status": "EM_TRANSITO",
      "timestamp": "2026-09-12T13:00:00Z",
      "transportadora": "TransportX"
    },
    {
      "id": 4,
      "status": "ENTREGUE",
      "timestamp": "2026-09-12T17:30:00Z",
      "local_entrega": "Cliente Lisbon"
    }
  ]
}
```

### 3. Generate Shipping Document
```
POST /api/expedicao/{id}/documento
```
Emit guides, invoices, or labels.

**Request:**
```json
{
  "tipo": "GUIA_TRANSPORTE",
  "serie": "V990",
  "formato": "PDF"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "documento": {
    "id": 10,
    "expedicao_id": 1,
    "tipo": "GUIA_TRANSPORTE",
    "numero": "V990-20261001",
    "url": "/documentos/guia-20261001.pdf",
    "data_emissao": "2026-09-12T12:30:00Z"
  }
}
```

### 4. Get Shipment Details
```
GET /api/expedicao/{id}
```
Complete shipment information with pallets and documents.

**Response:** `200 OK`
```json
{
  "expedicao": {
    "id": 1,
    "numero_referencia": "EXP-001",
    "cliente_id": 200,
    "cliente_nome": "Cliente Lisboa",
    "estado": "ENTREGUE",
    "paletes": [
      { "id": 1, "sscc": "123456789012345678", "quantidade_items": 48 }
    ],
    "documentos": [
      { "id": 10, "tipo": "GUIA_TRANSPORTE", "numero": "V990-20261001" }
    ],
    "rastreamento_count": 4,
    "data_expedida": "2026-09-12T12:30:00Z",
    "data_entregue": "2026-09-12T17:30:00Z"
  }
}
```

### 5. List Shipments
```
GET /api/expedicao?estado=ENTREGUE&cliente_id=200&limit=20
```
Filter shipments by status, client, date range.

**Query Parameters:**
- `estado`: PREPARADA | EXPEDIDA | EM_TRANSITO | ENTREGUE
- `cliente_id`: Filter by client
- `data_inicio`, `data_fim`: Date range
- `limit`, `offset`: Pagination

**Response:** `200 OK`
```json
{
  "expedicoes": [
    {
      "id": 1,
      "numero_referencia": "EXP-001",
      "cliente_nome": "Cliente Lisboa",
      "estado": "ENTREGUE",
      "data_expedida": "2026-09-12T12:30:00Z"
    }
  ],
  "total": 23,
  "limit": 20,
  "offset": 0
}
```

### 6. Get Shipment Status
```
GET /api/expedicao/{id}/status
```
Current shipment state with last event.

**Response:** `200 OK`
```json
{
  "status": {
    "expedicao_id": 1,
    "estado_atual": "ENTREGUE",
    "ultimo_evento": "ENTREGUE",
    "timestamp_ultimo_evento": "2026-09-12T17:30:00Z",
    "progresso_percentual": 100,
    "tempo_total_horas": 6
  }
}
```

---

## Global Endpoints

### Health Check
```
GET /health
```
Service status and database connectivity.

**Response:** `200 OK`
```json
{
  "status": "healthy",
  "timestamp": "2026-09-12T11:30:00Z",
  "database": "connected",
  "uptime_seconds": 3600
}
```

### API Documentation
```
GET /api-docs
```
Interactive Swagger/OpenAPI UI for all endpoints.

---

## Error Responses

All errors follow standard format:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "statusCode": 400,
  "path": "/api/recepcao/create"
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Successful GET/PATCH |
| 201 | Created | POST successful |
| 400 | Bad Request | Missing required field |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | User lacks permission |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | State machine violation |
| 500 | Internal Error | Server error |

---

## Authentication

All endpoints except `/health` require JWT Bearer token:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:3000/api/recepcao
```

Development: Automatic token generation if no header provided.

Production: JWT must contain:
- `usuario_id`: User identifier
- `empresa_id`: Tenant identifier (UUID)
- `email`: User email
- `nome`: User name

---

## Rate Limiting

- **Login:** 5 requests/15 min per IP
- **Sync:** 10 requests/min per user
- **API:** 100 requests/15 min per user

Exceeded limits return `429 Too Many Requests`.

---

## Pagination

List endpoints support pagination:

```bash
GET /api/recepcao?limit=20&offset=40
```

Returns:
```json
{
  "data": [...],
  "total": 120,
  "limit": 20,
  "offset": 40,
  "has_more": true
}
```

---

## Filtering

Most list endpoints support query filters:

```bash
GET /api/recepcao?estado=FINALIZADA&fornecedor_id=100&limit=10
```

Supported filters vary by endpoint — check specific documentation.

---

## Changelog

**v1.0.0** — Initial release (Sep 12, 2026)
- All 37 endpoints implemented
- Full JWT authentication + RLS
- Multi-tenant support
- E2E test coverage
- Production-ready deployment
