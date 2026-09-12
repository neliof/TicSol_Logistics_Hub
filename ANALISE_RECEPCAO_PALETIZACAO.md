# ANÁLISE — Sistema de Receção e Paletização

**Data:** 12/09/2026  
**Status:** Análise inicial completa  
**Próximo passo:** Arquitetura e implementação

---

## 1. STACK ATUAL

### Frontend
- **Framework:** React 19 + TypeScript (strict mode)
- **Styling:** Tailwind CSS 4.1
- **Build:** Vite
- **UI Components:** Lucide React, custom

### Backend
- **Database:** PostgreSQL (ticsol_wms)
- **API:** PostgREST
- **Authentication:** Token-based (dev mode: auto-login)

### Integração Artsoft
- **Protocolo:** XML (XMLReports, XMLQuery legacy)
- **Autenticação:** HTTP Digest
- **Status:** Endpoints descobertos (301 endpoints)

---

## 2. O QUE JÁ EXISTE

### Tipos Definidos (types/wms.ts)
✅ **ReceivingOrder** — Encomenda de Fornecedor
- numero_guia, numero_encomenda_artsoft
- fornecedor (id, nome, nif)
- estado: PENDENTE, EM_RECECAO, CONCLUIDO, DIVERGENTE
- linhas: array de ReceivingLine
- **FALTA:** Histórico de receções parciais, integração Artsoft, referência entrada ERP

✅ **ReceivingLine** — Linha da encomenda
- qtd_esperada_caixas, qtd_recebida_caixas, qtd_ja_paletizada_caixas
- lote, data_validade
- estado_linha: PENDENTE, PARCIAL, CONCLUIDO, REJEITADO
- localizacao_sugerida
- danificados_caixas
- **FALTA:** Divergências detalhadas, documentação de danos (fotos)

✅ **PalletSSCC** — Palete GS1
- sscc, guia_id, artigo_codigo
- caixas_na_palete, altura_total_cm, peso_bruto_kg
- estado_palete: EM_STAGING, ARMAZENADA, EM_EXPEDICAO, EXPEDIDA
- **FALTA:** Tracking de palete, histórico de movimentos

✅ **StockPosition** — Localização no armazém
- localizacao_codigo (A-01-02-3)
- zona, sscc, artigo, lote, validade
- **FALTA:** Rastreabilidade de entrada, palete mãe

✅ **RuleConfig** — Regras por cliente
- altura_maxima_cm, peso_maximo_kg
- vida_util_minima_porcentagem
- tipo_palete, obriga_sscc_gs1128
- **FALTA:** Tolerância de excesso/falta, regras de divergência

---

## 3. COMPONENTES EXISTENTES

### RececaoModule (420 linhas)
**O que faz:**
- Lista encomendas
- Seleciona encomenda
- Mostra linhas
- Input de quantidades recebidas
- Sincronização com Artsoft

**Problemas identificados:**
1. Sem conferência detalhada linha a linha
2. Sem registo de divergências
3. Sem controlo de lotes/validade
4. Sem documentação do documento do fornecedor
5. Sem paletização integrada
6. Sem states de progresso claro
7. Sem validação antes de finalizar
8. Sem histórico de receções parciais

### PaletizacaoModule (471 linhas)
**O que faz:**
- Seleciona encomenda
- Seleciona linha
- Calcula parâmetros de palete
- Cria palete (SSCC GS1)
- Mostra visualização da palete

**Problemas identificados:**
1. Desacoplado do RececaoModule
2. Sem integração automática após receção concluída
3. Sem gestão de paletes múltiplas por encomenda
4. Sem histórico de divisão/consolidação
5. Sem sincronização com stock

---

## 4. LACUNAS FUNCIONAIS CRÍTICAS

### 1. Documento do Fornecedor
**Status:** Parcialmente implementado
- Campo `doc_origem` existe mas nunca é usado
- **Falta:** Modal para registar tipo/número/data do documento
- **Falta:** Anexar PDF/fotografia
- **Falta:** Comparação com encomenda

### 2. Conferência Linha a Linha
**Status:** Básico demais
- Apenas "quantidade recebida"
- **Falta:** Divergências (falta/excesso/danificados)
- **Falta:** Motivos de divergência
- **Falta:** Autorização de exceções
- **Falta:** Estados de conferência progressivos

### 3. Lotes e Validade
**Status:** Campos existem mas sem fluxo
- **Falta:** Modal para registar múltiplos lotes por artigo
- **Falta:** Validação de vida útil mínima
- **Falta:** Alertas de validade expirada
- **Falta:** FEFO (First Expired First Out) control

### 4. Paletização
**Status:** Componente separado, sem integração
- **Falta:** Fluxo: Receção → Paletização automática
- **Falta:** Múltiplas paletes por encomenda
- **Falta:** Paletes já recebidas (apenas criação de novas)
- **Falta:** Histórico de movimentos da palete

### 5. Localização no Armazém
**Status:** Campo apenas (localizacao_sugerida)
- **Falta:** Seletor visual de localização
- **Falta:** Localização automática por regra
- **Falta:** Confirmação de alocação
- **Falta:** Histórico de transferências

### 6. Entrada em Armazém (Artsoft)
**Status:** Completamente ausente
- **Falta:** RPC para criar entrada
- **Falta:** Referência de entrada no WMS
- **Falta:** Estados de integração
- **Falta:** Retry de falhas
- **Falta:** Prevenção de duplicações

### 7. Receções Parciais
**Status:** Campos teóricos, fluxo ausente
- **Falta:** Histórico de receções da mesma encomenda
- **Falta:** Tracking de quantidade recebida ao longo do tempo
- **Falta:** UI para "retomar" receção anterior

### 8. Divergências
**Status:** Campo `estado: DIVERGENTE` mas sem fluxo
- **Falta:** Modal de divergências
- **Falta:** Categorização (falta/excesso/danificado/não encomendado)
- **Falta:** Motivos e observações
- **Falta:** Aprovação de exceções
- **Falta:** Impacto na entrada Artsoft

### 9. Validação Antes de Finalizar
**Status:** Ausente
- **Falta:** Checklist de validação
- **Falta:** Verificação de regras obrigatórias
- **Falta:** Avisos de incompletude
- **Falta:** Bloqueio de finalização com erros

### 10. Auditoria Completa
**Status:** AuditLog existe mas não é usado para receção
- **Falta:** Cada alteração registada
- **Falta:** Histórico de conferências
- **Falta:** Histórico de divergências
- **Falta:** Rastreabilidade de quem alterou o quê

---

## 5. PROBLEMAS DE UX

### Desktop
❌ Navbar com 8 tabs — confuso para operador
❌ RececaoModule e PaletizacaoModule separados
❌ Sem feedback de progresso
❌ Sem estados visuais de divergência

### Mobile
❌ 3 colunas → inadequado em mobile
❌ Modal de sync pequeno demais
❌ Inputs pequenos para armazém

### Operador
❌ Fluxo não otimizado (ir buscar dados múltiplas vezes)
❌ Sem atalhos de scanner
❌ Sem confirmações claras
❌ Sem feedback de sucesso/erro

---

## 6. O QUE PRECISA SER IMPLEMENTADO

### Prioridade 1 — CRÍTICO (Sessão atual)
1. **Módulo de Receção Integrado**
   - Conferência linha a linha
   - Controlo de divergências
   - Registo de documentos
   - Fluxo visual claro

2. **Paletização Integrada**
   - Após receção concluída
   - Múltiplas paletes por encomenda
   - Gestão de conteúdo

3. **Entrada em Armazém (Artsoft)**
   - Criar entrada após paletização
   - Referência bidirecional
   - Retry de falhas

4. **Receções Parciais**
   - Histórico de receções
   - Retomar receção anterior
   - Tracking de quantidades

### Prioridade 2 — IMPORTANTE (Próxima)
1. Lotes e validade (validação + alertas)
2. Localização no armazém (seletor + automático)
3. Divergências (autorização + impacto)
4. Validação antes de finalizar

### Prioridade 3 — ENHANCEMENT
1. Scanner integrado (barcode de artigo, palete, lote)
2. Fotografia de danos
3. Anexar documento fornecedor
4. Dashboard de receções

---

## 7. ARQUITETURA PROPOSTA

### Novos tipos (types/rececao.ts)
```typescript
RecepcaoDocument      — Documento fornecedor
DivergenceRecord      — Registro de divergência
RecepcaoState         — Estado progression
ArtsoftIntegration    — Resultado integração
PaleteMovement        — Histórico de palete
```

### Novos componentes (components/rececao/)
```
RececaoOrdensFinder      — Buscar encomenda
RececaoConferencia       — Linha a linha
RececaoDivergencias      — Registo divergências
RececaoDocumento         — Registo documento
RececaoLotes             — Registo lotes
RececaoPaletizacao       — Paletização automática
RececaoValidacao         — Checklist validação
RececaoArtsoftIntegration — Criar entrada
```

### Novos hooks (hooks/)
```
useRecepcao              — Estado receção
useRecepcaoDivergencias  — Controlo divergências
useArtsoftIntegration    — Criar entrada
```

### Fluxo data
```
ReceivingOrder
  ├─ RecepcaoDocument
  ├─ ReceivingLine[]
  │  └─ DivergenceRecord[]
  ├─ PalletSSCC[]
  │  └─ PaleteMovement[]
  └─ ArtsoftIntegration
```

---

## 8. ESTIMATIVA

| Fase | Tarefa | Horas | Prioridade |
|------|--------|-------|-----------|
| 1 | Tipos + hooks | 4 | P1 |
| 2 | Módulo Receção | 8 | P1 |
| 3 | Paletização integrada | 6 | P1 |
| 4 | Artsoft integration | 8 | P1 |
| 5 | Receções parciais | 4 | P1 |
| 6 | Divergências | 6 | P2 |
| 7 | Lotes/validade | 4 | P2 |
| 8 | Localização | 4 | P2 |
| 9 | Validação | 3 | P2 |
| **Total P1** | | **30** | |
| **Total P2** | | **17** | |

---

## 9. PRÓXIMOS PASSOS

1. ✅ ANALISAR (CONCLUÍDO)
2. 👉 MAPEAR — Componentes, APIs, models existentes
3. IDENTIFICAR — Lacunas específicas por módulo
4. PROPOR — Arquitetura detalhada
5. IMPLEMENTAR — Desenvolver P1 (Receção + Paletização + Artsoft)
6. VALIDAR — Cenários de teste
7. DOCUMENTAR — Fluxo e regras

---

## 10. CONCLUSÃO

**Sistema existe mas é apenas esqueleto.**

Os tipos estão bem definidos, os componentes têm funcionalidade básica, mas:

- Sem fluxo integrado
- Sem controlo de divergências
- Sem integração Artsoft real
- Sem receções parciais
- Sem rastreabilidade completa

**Resultado esperado:** Módulo profissional de receção com rastreabilidade completa desde Encomenda Artsoft até Entrada em Armazém.

**Tempo estimado:** 50-60 horas (P1+P2)
