# IDENTIFICAR + PROPOR — Lacunas e Arquitetura Detalhada

**Data:** 12/09/2026  
**Status:** Especificação completa de implementação

---

## PASSO 3: IDENTIFICAR — Lacunas por Módulo

### RececaoModule (431 linhas) — Crítico

**O que faz:**
- Lista encomendas Artsoft
- Mostra linhas
- Input quantidade recebida
- Sincroniza com Artsoft

**Lacunas críticas:**

#### 1. Sem documento do fornecedor
```
Problema: Campo doc_origem existe mas never usado
Impacto: Não há rastreabilidade do documento recebido
Solução: Modal RecepcaoDocumento (novo componente)
  ├─ Tipo documento (Guia, Fatura, etc)
  ├─ Número/data
  └─ Anexo (PDF/foto)
```

#### 2. Sem conferência linha a linha
```
Problema: Apenas "quantidade recebida"
Impacto: Não regista divergências, danos, etc
Solução: Modal RececaoConferencia (novo componente)
  ├─ Quantidade esperada vs recebida
  ├─ Danificados
  ├─ Falta vs excesso
  └─ Motivo divergência
```

#### 3. Sem lotes obrigatórios
```
Problema: lote em ReceivingLine mas sem fluxo
Impacto: Não controla produtos com lote obrigatório
Solução: Modal RececaoLotes (novo componente)
  ├─ Múltiplos lotes por artigo
  ├─ Validação vida útil mínima
  └─ Alertas de validade
```

#### 4. Sem localização no armazém
```
Problema: localizacao_sugerida existe mas readonly
Impacto: Palete criada sem localização confirmada
Solução: Seletor RececaoLocalizacao (novo componente)
  ├─ Lista de localizações disponíveis
  ├─ Alocação automática por regra
  └─ Confirmação visual
```

#### 5. Sem paletização integrada
```
Problema: Paletização é componente isolado
Impacto: Operador sai de Receção para PaletizacaoModule
Solução: RececaoPaletizacao (novo componente)
  ├─ Após conferência concluída
  ├─ Fluxo automático: Receção → Palete
  └─ Múltiplas paletes por encomenda
```

#### 6. Sem validação antes de finalizar
```
Problema: Usuário clica "finalizar" sem completar
Impacto: Receção incompleta criada no Artsoft
Solução: Modal RececaoValidacao (novo componente)
  ├─ Checklist de validação
  ├─ Bloqueio de finalização com erros
  └─ Avisos de incompletude
```

#### 7. Sem receções parciais
```
Problema: Não há histórico de receções anteriores
Impacto: Não rastreia: "encomenda 100 → recebido 50 + 50 em 2 datas"
Solução: RececaoPartial (novo componente)
  ├─ Histórico de receções da mesma encomenda
  ├─ Retomar receção anterior
  └─ Tracking de quantidade ao longo do tempo
```

#### 8. Sem entrada no Artsoft
```
Problema: Receção é local, nunca cria entrada no ERP
Impacto: Stock físico e ERP desalinhados
Solução: RececaoArtsoftIntegration (novo componente)
  ├─ Criar entrada após paletização
  ├─ Referência bidirecional
  ├─ Retry de falhas
  └─ Prevenção de duplicações
```

---

### PaletizacaoModule (471 linhas) — Crítico

**O que faz:**
- Seleciona linha
- Calcula palete
- Cria SSCC GS1
- Mostra visualização

**Lacunas críticas:**

#### 1. Desacoplado de RececaoModule
```
Problema: Operador faz receção, depois vai para paletização
Impacto: Fluxo quebrado, perda de contexto
Solução: Integrar em RececaoModule após conferência
```

#### 2. Sem múltiplas paletes por encomenda
```
Problema: Uma linha = uma palete
Impacto: Não consegue dividir artigo em várias paletes
Solução: Permitir criar múltiplas paletes na mesma ordem
```

#### 3. Sem histórico de movimentos
```
Problema: Palete criada, mas sem rastreamento
Impacto: Não sabe se foi movida, para onde, quando
Solução: PaleteMovement table com histórico
```

#### 4. Sem gestão de conteúdo
```
Problema: Após criar palete, não consegue alterar
Impacto: Erro na palete = recria tudo
Solução: Adicionar/remover itens, dividir, consolidar
```

---

### StockMapModule (450 linhas) — Importante

**O que faz:**
- Mostra stock por localização
- Controla FEFO
- Reservas

**Lacunas:**

#### 1. Sem validação ao receber
```
Problema: Stock de receção nunca valida entrada
Impacto: Estoque desalinhado com receção
Solução: Integrar com RececaoModule
```

#### 2. Sem palete referência
```
Problema: Palete órfã (sem ligação a receção)
Impacto: Rastreabilidade quebrada
Solução: Adicionar palete_mae_id a StockPosition
```

---

### ArtsoftSyncModule (460 linhas) — Informativo

**O que faz:**
- Sincroniza manualmente
- Mostra histórico sync

**Status:**
✅ Funciona para sync automático
❌ Falta integração com receção

---

## PASSO 4: PROPOR — Arquitetura Detalhada

### 1. Novos Types (types/rececao.ts)

```typescript
// Documento que acompanha a mercadoria
export interface RecepcaoDocument {
  id: string;
  recepcao_id: string;
  tipo: 'GUIA_REMESSA' | 'GUIA_TRANSPORTE' | 'FATURA' | 'OUTRO';
  numero: string;
  data: string;
  fornecedor_documento?: string;
  url_anexo?: string; // PDF/foto
  observacoes?: string;
  criado_em: string;
  operador: string;
}

// Divergência numa linha
export interface DivergenceRecord {
  id: string;
  linha_id: string;
  tipo: 'FALTA' | 'EXCESSO' | 'DANIFICADO' | 'NAO_ENCOMENDADO' | 'QUALIDADE';
  quantidade: number;
  motivo: string;
  observacoes?: string;
  autorizado_por?: string;
  impacto_entrada_artsoft: 'ACEITAR' | 'REJEITAR' | 'REVISAR';
  criado_em: string;
  operador: string;
}

// Estado machine da receção
export interface RecepcaoState {
  recepcao_id: string;
  estado_atual: 'RASCUNHO' | 'EM_CONFERENCIA' | 'CONFERIDA' | 'EM_PALETIZACAO' 
             | 'PALETIZADA' | 'A_VALIDAR' | 'A_INTEGRAR' | 'INTEGRADA' | 'CONCLUIDA'
             | 'COM_DIVERGENCIAS' | 'BLOQUEADA' | 'ERRO_INTEGRACAO' | 'CANCELADA';
  transicao_em: string;
  operador: string;
  motivo?: string;
}

// Integração com Artsoft
export interface ArtsoftIntegration {
  id: string;
  recepcao_id: string;
  entrada_artsoft_id?: string; // ID criado no ERP
  estado: 'PENDENTE' | 'EM_PROCESSAMENTO' | 'INTEGRADA' | 'ERRO' | 'NECESSITA_INTERVENCAO';
  payload_enviado: string; // JSON da entrada criada
  resposta_artsoft?: string; // Resposta do ERP
  erro_tecnico?: string;
  tentativas: number;
  proxima_tentativa_em?: string;
  criado_em: string;
  atualizado_em: string;
}

// Movimento da palete (rastreamento)
export interface PaleteMovement {
  id: string;
  palete_sscc: string;
  evento: 'CRIADA' | 'MOVIDA' | 'ARMAZENADA' | 'RESERVADA' | 'EXPEDIDA' | 'DEVOLVIDA';
  localizacao_anterior?: string;
  localizacao_nova?: string;
  quantidade_anterior?: number;
  quantidade_nova?: number;
  operador: string;
  observacoes?: string;
  evento_em: string;
}

// Registro de auditoria completo
export interface AuditRecord {
  id: string;
  recepcao_id: string;
  operador: string;
  acao: string;
  tabela_afetada: string;
  registro_id: string; // ID do ReceivingLine, PalletSSCC, etc
  valor_anterior?: any;
  valor_novo?: any;
  motivo?: string;
  criado_em: string;
  ip_terminal?: string;
}
```

---

### 2. Novos Componentes (components/rececao/)

```typescript
// 1. RececaoConferencia.tsx (350 linhas)
// Conferência linha a linha com controlo de divergências
// Props: line, onConferir, onDiverger

// 2. RececaoDivergencias.tsx (200 linhas)
// Modal registar divergência com categorias
// Props: linha, onSave, onCancel

// 3. RececaoDocumento.tsx (150 linhas)
// Modal registar documento fornecedor
// Props: recepcao_id, onSave

// 4. RececaoLotes.tsx (200 linhas)
// Registar múltiplos lotes por artigo
// Props: linha, onSave, regras_lote

// 5. RececaoLocalizacao.tsx (150 linhas)
// Seletor de localização no armazém
// Props: zona, onSelect, disponíveis

// 6. RececaoPaletizacao.tsx (250 linhas)
// Fluxo automático receção → palete
// Props: recepcao, onPaleteSaved

// 7. RececaoValidacao.tsx (100 linhas)
// Checklist de validação antes de finalizar
// Props: recepcao, onValidar

// 8. RececaoArtsoftIntegration.tsx (200 linhas)
// Criar entrada + retry de falhas
// Props: recepcao, onIntegrado, onErro

// 9. RececaoPartial.tsx (180 linhas)
// Histórico de receções anteriores da mesma encomenda
// Props: ordem_id, onRetomar
```

---

### 3. Novos Hooks (hooks/)

```typescript
// useRecepcao.ts (300 linhas)
export function useRecepcao(recepcao_id?: string) {
  return {
    recepcao: ReceivingOrder & { documento?, divergencias[], paletasAssociadas[] }
    estado: RecepcaoState
    auditoria: AuditRecord[]
    loading, error
    
    conferirLinha(linha_id, qtd_recebida)
    registarDivergencia(linha_id, tipo, motivo)
    registarDocumento(documento)
    registarLotes(linha_id, lotes[])
    criarPalete(configs)
    validarRecepcao() → { valido, erros[] }
    finalizarRecepcao()
  }
}

// useRecepcaoDivergencias.ts (150 linhas)
export function useRecepcaoDivergencias(recepcao_id) {
  return {
    divergencias: DivergenceRecord[]
    totalDivergencias, divergenciasResolvidadas
    loading, error
    
    adicionarDivergencia(linha_id, tipo, quantidade, motivo)
    resolverDivergencia(divergencia_id, decisao: ACEITAR|REJEITAR)
    removerDivergencia(divergencia_id)
  }
}

// useArtsoftIntegration.ts (200 linhas)
export function useArtsoftIntegration(recepcao_id) {
  return {
    integracao: ArtsoftIntegration
    loading, error
    
    criarEntrada()
    retryIntegracao()
    verificarStatus()
  }
}
```

---

### 4. Fluxo Completo (State Machine)

```
RASCUNHO
  ├─ Registar documento fornecedor
  ├─ Conferir linha a linha
  └─ Registar divergências (se houver)
       ↓
EM_CONFERENCIA (todos os linhas têm qtd)
       ↓
CONFERIDA (todas as validações passam)
       ├─ Criar palete(s)
       └─ Registar lote(s)
       ├─ Definir localização
       ↓
PALETIZADA (todas as paletes criadas)
       ↓
A_VALIDAR (checklist de validação)
       ├─ ✓ Documento registado
       ├─ ✓ Linhas conferidas
       ├─ ⚠ Divergências (se houver, com resolução)
       ├─ ✓ Lotes registados
       ├─ ✓ Localizações definidas
       └─ ✓ Paletes identificadas
       ↓
A_INTEGRAR (pronto para Artsoft)
       ├─ Criar entrada no ERP
       ├─ Aguardar confirmação
       └─ Prevenção de duplicações
       ↓
INTEGRADA (entrada criada no Artsoft)
       ↓
CONCLUIDA (Receção 100% completa)

Estados de exceção:
├─ COM_DIVERGENCIAS (divergências não resolvidas)
├─ BLOQUEADA (erro de validação crítico)
├─ ERRO_INTEGRACAO (falha no Artsoft, aguardando retry)
└─ CANCELADA (operação cancelada)
```

---

### 5. Endpoints Backend Necessários

#### Receção
```
POST   /rest/v1/recepcao
       Body: { ordem_id, empresa_id }

PATCH  /rest/v1/recepcao/{id}
       Body: { estado, motivo }

GET    /rest/v1/recepcao?ordem_id=...
       Retorna todas as receções de uma ordem

POST   /rest/v1/recepcao/{id}/conferencia
       Body: { linha_id, qtd_recebida, operador }

POST   /rest/v1/recepcao/{id}/divergencia
       Body: { linha_id, tipo, quantidade, motivo, operador }

POST   /rest/v1/recepcao/{id}/documento
       Body: { tipo, numero, data, url_anexo, operador }

POST   /rest/v1/recepcao/{id}/lote
       Body: { linha_id, lotes[{lote, qtd, validade}], operador }

PATCH  /rest/v1/recepcao/{id}/validar
       Executa validações, retorna erros (se houver)

POST   /rest/v1/recepcao/{id}/finalizar
       Transiciona para CONCLUIDA
```

#### Paletização
```
POST   /rest/v1/palete
       Body: { recepcao_id, artigo_codigo, lote, qtd, params, operador }

PATCH  /rest/v1/palete/{sscc}
       Body: { localizacao_id, estado, operador }

POST   /rest/v1/palete/{sscc}/item
       Body: { artigo_codigo, lote, qtd, operador }

DELETE /rest/v1/palete/{sscc}/item/{item_id}
       Remover item da palete

GET    /rest/v1/palete/{sscc}/movimentos
       Histórico de movimentos
```

#### Entrada Artsoft
```
POST   /api/artsoft/entrada/criar
       Body: { recepcao_id }
       Retorna: { entrada_id, estado, entrada_artsoft_id }

GET    /api/artsoft/entrada/{id}/status
       Verifica status no ERP

POST   /api/artsoft/entrada/{id}/retry
       Retry de falha anterior

POST   /api/artsoft/entrada/{id}/validar
       Validação pré-integração
```

#### Localização
```
GET    /rest/v1/localizacao?zona=A&disponivel=true
       Lista localizações disponíveis

POST   /rest/v1/palete/{sscc}/localizar
       Body: { localizacao_id, operador }
       Aloca localização

GET    /rest/v1/localizacao/{id}/ocupacao
       Verifica ocupação da localização
```

---

### 6. Database Schema Changes

```sql
-- Tabelas novas
CREATE TABLE recepcao_documento (...)
CREATE TABLE divergencia_record (...)
CREATE TABLE recepcao_state (...)
CREATE TABLE artsoft_integracao (...)
CREATE TABLE palete_movimento (...)
CREATE TABLE auditoria_rececao (...)

-- Alterações a ReceivingOrder
ALTER TABLE receiving_order ADD COLUMN artsoft_entrada_id UUID
ALTER TABLE receiving_order ADD COLUMN estado_recepcao VARCHAR
ALTER TABLE receiving_order ADD COLUMN criado_em TIMESTAMP
ALTER TABLE receiving_order ADD COLUMN atualizado_em TIMESTAMP

-- Alterações a StockPosition
ALTER TABLE stock_position ADD COLUMN palete_mae_id UUID
ALTER TABLE stock_position ADD COLUMN entrada_wms_id UUID
```

---

## Resumo Arquitetura

| Componente | Novo | Tipo | Linhas | Deps |
|-----------|------|------|--------|------|
| RececaoConferencia | ✅ | Modal | 350 | useRecepcao |
| RececaoDivergencias | ✅ | Modal | 200 | useRecepcaoDivergencias |
| RececaoDocumento | ✅ | Modal | 150 | useRecepcao |
| RececaoLotes | ✅ | Modal | 200 | useRecepcao |
| RececaoLocalizacao | ✅ | Seletor | 150 | useRecepcao |
| RececaoPaletizacao | ✅ | Flow | 250 | useRecepcao |
| RececaoValidacao | ✅ | Checklist | 100 | useRecepcao |
| RececaoArtsoftIntegration | ✅ | Flow | 200 | useArtsoftIntegration |
| RececaoPartial | ✅ | Flow | 180 | useRecepcao |

**Total linhas novas:** ~1780 componentes + ~650 hooks + ~393 types = **~2823 linhas**

---

## Próximo: PASSO 5 — IMPLEMENTAR P1

Começar com:
1. Types (rececao.ts) — 393 linhas
2. Hooks (useRecepcao, useRecepcaoDivergencias, useArtsoftIntegration) — 650 linhas
3. Componentes principais (RececaoConferencia, RececaoDivergencias, RececaoArtsoftIntegration) — 750 linhas
4. Integração RececaoModule + PaletizacaoModule — 300 linhas refactor

**Total Fase 1:** ~2100 linhas código + 17 endpoints backend
