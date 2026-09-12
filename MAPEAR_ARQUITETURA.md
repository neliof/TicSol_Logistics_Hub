# MAPEAR — Componentes, APIs, Models, Endpoints

**Data:** 12/09/2026  
**Status:** Inventário completo

---

## 1. APIS DISPONÍVEIS

### Authentication
- `POST /auth/login` — Entrar (email, password)
- `POST /auth/dev-token` — Dev mode auto-login

### Documents (PostgREST)
- `GET /rest/v1/documento?limit=100` — Listar documentos
- `GET /rest/v1/documento/{id}/linhas` — Linhas documento
- `GET /rest/v1/sincronizacao_execucao?limit=20` — Execuções sync

### ARTSOFT Integration (Backend)
- `POST /api/artsoft/guias/sync` — Sync guias (date range + series)
- `POST /api/artsoft/stock/sync` — Sync stock
- `POST /api/artsoft/produtos/sync` — Sync produtos
- `POST /api/artsoft/terceiros/sync` — Sync fornecedores/clientes
- `GET /api/artsoft/series/discover` — Descobrir series
- `GET /api/artsoft/series/config/{modulo}` — Obter config series
- `POST /api/artsoft/series/config` — Guardar config series
- `GET /api/artsoft/config` — Config Artsoft (host, porta, user)
- `POST /api/artsoft/config` — Guardar config

### Health
- `GET /health/sync/{empresaId}` — Sync status

### Stock Reconciliation
- `GET /rest/v1/vw_reconciliacao_stock?limit=500` — View reconciliação
- `GET /rest/v1/palete?limit=500` — Listar paletes
- `GET /rest/v1/regra_logistica?limit=100` — Listar regras

### Test Data
- `DELETE /api/artsoft/test-data` — Apagar test data
- `GET /api/artsoft/test-data/contagem` — Contar test data
- `DELETE /api/artsoft/test-data?tabelas=...` — Apagar tabelas específicas

---

## 2. COMPONENTES EXISTENTES

### Por módulo

#### Receção (985 linhas total)
| Componente | Linhas | Status | Descrição |
|-----------|--------|--------|-----------|
| RececaoModule | 431 | 🟡 Básico | Listar encomendas, registar qtd |
| OrderSelectorPanel | 83 | 🟡 Básico | Seletor de encomenda |
| PaletizacaoModule | 471 | 🟡 Isolado | Criar paletes (desacoplado) |

#### Utilitários
| Componente | Linhas | Status |
|-----------|--------|--------|
| Toast | 76 | ✅ Pronto |
| ConfirmModal | 73 | ✅ Pronto |
| EmptyState | 44 | ✅ Pronto |
| SyncDocumentsModal | 93 | ✅ Pronto |
| BarcodeScannerModal | 180 | ✅ Pronto |
| GS1LabelPrintModal | 600+ | ✅ Pronto |
| ErrorBoundary | 50 | ✅ Pronto |

#### Admin/Config
| Componente | Linhas | Status |
|-----------|--------|--------|
| ArtsoftConfig | 120 | 🟡 Config Artsoft |
| SeriesConfig | 180 | 🟡 Config series |
| ArtsoftSyncModule | 460 | 🟡 Sync manual |
| RegrasEngineModule | 260 | 🟡 Rules editor |
| StockMapModule | 450 | 🟡 Stock view |
| AuditoriaModule | 200 | 🟡 Audit log |
| GestaoDadosModule | 220 | 🟡 Test data |

---

## 3. TYPES DEFINIDOS (types/wms.ts)

### ReceivingOrder
```typescript
✅ numero_guia, numero_encomenda_artsoft
✅ fornecedor (id, nome, nif)
✅ estado: PENDENTE, EM_RECECAO, CONCLUIDO, DIVERGENTE
✅ linhas: ReceivingLine[]
❌ FALTA: historico_recepcoes[], artsoft_entrada_id, created_at, updated_at
```

### ReceivingLine
```typescript
✅ qtd_esperada_caixas, qtd_recebida_caixas, qtd_ja_paletizada_caixas
✅ lote, data_validade
✅ estado_linha: PENDENTE, PARCIAL, CONCLUIDO, REJEITADO
✅ danificados_caixas, motivo_danos
❌ FALTA: divergencias[], documentos_anexados[], auditoria[]
```

### PalletSSCC
```typescript
✅ sscc (18-digit GS1)
✅ guia_id, artigo_codigo, lote, data_validade
✅ estado_palete: EM_STAGING, ARMAZENADA, EM_EXPEDICAO, EXPEDIDA
❌ FALTA: palete_mae_id, movimentos[], rastreamento
```

### StockPosition
```typescript
✅ localizacao_codigo (A-01-02-3)
✅ zona, sscc, artigo, lote, validade
❌ FALTA: palete_referencia, entrada_wms_id, auditoria
```

### RuleConfig
```typescript
✅ altura_maxima_cm, peso_maximo_kg
✅ vida_util_minima_porcentagem
✅ tipo_palete, obriga_sscc_gs1128
❌ FALTA: tolerancia_excesso%, tolerancia_falta%, regras_divergencia[]
```

### AuditLog
```typescript
✅ timestamp, operador, acao, tabela_afetada
✅ detalhes_json, ip_terminal
❌ FALTA: valor_anterior, valor_novo, referencia_documento
```

---

## 4. HOOKS CUSTOMIZADOS

### useWMSData (260 linhas)
**Retorna:**
```typescript
{
  orders: ReceivingOrder[]
  pallets: PalletSSCC[]
  stock: StockPosition[]
  loading, error
  setOrders(), setPallets(), setStock()
}
```
**Usado por:** RececaoModule, PaletizacaoModule
**Problema:** Carrega TUDO do mock, sem filtros

### useExpedicaoData (220 linhas)
**Retorna:**
```typescript
{
  pedidos: GuiaTransporte[]
  paletas: PaletaExpedicao[]
  guias: ChecklistExpedicao[]
  loading, error
  carregarLinhas()
}
```
**Usado por:** ExpedicaoModule, ExpedicaoPaletizacaoModule

### useToast (50 linhas)
**Retorna:**
```typescript
{
  toasts[]
  addToast(), removeToast()
  success(), error(), info()
}
```
**Usado por:** App.tsx (global)

### useSeriesConfig (70 linhas)
**Retorna:**
```typescript
{
  modulo, receção[], expedição[]
}
```
**Usado por:** RececaoModule, PaletizacaoModule, ExpedicaoModule

### useRegras (180 linhas)
**Retorna:**
```typescript
{
  rules: RuleConfig[]
  loading, error
  setRules()
}
```
**Usado by:** PaletizacaoModule, RegrasEngineModule

### useArtsoftSync (200 linhas)
**Retorna:**
```typescript
{
  syncHealth: SyncHealth
  lastExecution: ExecucaoSync
  loading, error
}
```
**Usado by:** ArtsoftSyncModule

---

## 5. ESTRUTURA DE DADOS (Flow)

### Atual
```
ReceivingOrder
  ├─ ReceivingLine[]
  │  └─ (sem divergências)
  └─ PalletSSCC[] (criadas depois, separado)
     └─ (sem referência à entrada Artsoft)
```

### Necessária
```
ReceivingOrder
  ├─ RecepcaoDocument (novo)
  ├─ ReceivingLine[]
  │  └─ DivergenceRecord[] (novo)
  ├─ PalletSSCC[]
  │  ├─ PaleteMovement[] (novo)
  │  └─ localizacao_id: StockPosition (ligação)
  ├─ ArtsoftEntrada (novo)
  │  └─ integration_status: PENDING, PROCESSING, OK, ERROR
  └─ AuditTrail[] (novo)
```

---

## 6. ENDPOINTS NECESSÁRIOS (Não existem)

### Receção
- `POST /rest/v1/recepcao` — Criar receção
- `PATCH /rest/v1/recepcao/{id}` — Atualizar receção
- `GET /rest/v1/recepcao?ordem_id=...` — Receções de uma ordem
- `POST /rest/v1/recepcao/{id}/conferencia` — Registar conferência
- `POST /rest/v1/recepcao/{id}/divergencia` — Registar divergência
- `POST /rest/v1/recepcao/{id}/lote` — Registar lote
- `POST /rest/v1/recepcao/{id}/documento` — Anexar documento

### Paletização
- `POST /rest/v1/palete` — Criar palete
- `PATCH /rest/v1/palete/{sscc}` — Atualizar palete
- `POST /rest/v1/palete/{sscc}/item` — Adicionar item à palete
- `GET /rest/v1/palete/{sscc}/movimentos` — Histórico palete

### Entrada Artsoft
- `POST /api/artsoft/entrada/criar` — Criar entrada no ERP
- `GET /api/artsoft/entrada/{id}/status` — Status da integração
- `POST /api/artsoft/entrada/{id}/retry` — Retry de falha

### Localização
- `GET /rest/v1/localizacao?zona=A` — Localizações disponíveis
- `POST /rest/v1/palete/{sscc}/localizar` — Alocar localização

---

## 7. GAPS IDENTIFICADOS

### Tipos (Nova )
```typescript
❌ RecepcaoDocument
❌ DivergenceRecord
❌ RecepcaoState (states machine)
❌ ArtsoftIntegration
❌ PaleteMovement
❌ AuditRecord
```

### Componentes (Novos)
```
❌ RececaoConferencia — Linha a linha
❌ RececaoDivergencias — Registar divergências
❌ RececaoDocumento — Documento fornecedor
❌ RececaoLotes — Múltiplos lotes
❌ RececaoPaletizacao — Paletização automática
❌ RececaoValidacao — Checklist validação
❌ RececaoArtsoftIntegration — Criar entrada
❌ RececaoPartial — Histórico receções
```

### Hooks (Novos)
```
❌ useRecepcao() — Estado receção
❌ useRecepcaoDivergencias() — Divergências
❌ useArtsoftIntegration() — Criar entrada + retry
❌ useRecepcaoPartial() — Histórico
```

### APIs (Novos)
```
❌ 8 endpoints de receção
❌ 4 endpoints de paletização
❌ 3 endpoints de entrada Artsoft
❌ 2 endpoints de localização
```

---

## 8. RESUMO POR CATEGORIA

| Categoria | Total | Pronto | Falta |
|-----------|-------|--------|--------|
| Componentes | 23 | 16 | 7 |
| Hooks | 6 | 6 | 3 |
| Types | 9 | 6 | 3 |
| APIs | 24 | 24 | 17 |
| Endpoints | 41 | 24 | 17 |

**Completion:** 54/72 (75% estrutura existe, 25% falta implementar)

---

## 9. DEPENDÊNCIAS

### Para Receção
- Toast (✅ existe)
- ConfirmModal (✅ existe)
- SyncDocumentsModal (✅ existe)
- BarcodeScannerModal (✅ existe)
- useWMSData (✅ existe, precisa filtro)
- useToast (✅ existe)

### Para Paletização
- GS1LabelPrintModal (✅ existe)
- PalletSSCC type (✅ existe)
- useWMSData (✅ existe)

### Novos (dependências cruzadas)
- Receção ← Documento fornecedor
- Receção ← Divergências
- Receção → Paletização
- Paletização → Localização
- Paletização → Artsoft integração

---

## 10. PLANO DE IMPLEMENTAÇÃO

### Fase 1: Novos Types (4 horas)
```typescript
RecepcaoDocument
DivergenceRecord
RecepcaoState
ArtsoftIntegration
PaleteMovement
AuditRecord
```

### Fase 2: Novos Hooks (8 horas)
```typescript
useRecepcao()
useRecepcaoDivergencias()
useArtsoftIntegration()
```

### Fase 3: Novos Endpoints Backend (6 horas)
```
/rest/v1/recepcao*
/rest/v1/palete*
/api/artsoft/entrada*
/rest/v1/localizacao*
```

### Fase 4: Novos Componentes (16 horas)
```
RececaoConferencia
RececaoDivergencias
RececaoDocumento
RececaoPaletizacao
RececaoValidacao
RececaoArtsoftIntegration
```

### Fase 5: Integração (6 horas)
```
RececaoModule refactor
PaletizacaoModule refactor
App.tsx flow
```

---

## 11. CONCLUSÃO

**Status:** 75% da arquitetura existe
**Gaps:** 17 endpoints novos, 7 componentes novos, 3 hooks novos
**Trabalho:** ~40 horas de desenvolvimento
**Risco:** Integração Artsoft (entrada) — precisa API backend nova

**Próximo passo:** PASSO 3 — IDENTIFICAR lacunas específicas por módulo
