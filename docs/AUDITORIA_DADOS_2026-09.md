# Auditoria de Qualidade de Dados e Integração ARTSOFT

**Data:** 2026-09-12
**Escopo:** Frontend (React) + Backend (Node/Express) + artsoft-sync + Base de Dados

---

## Resumo Executivo — Achados Críticos

| # | Achado | Severidade | Impacto |
|---|--------|-----------|---------|
| 1 | RLS com bypass (`claims=''` → sem filtro) no módulo receção/paletização | 🔴 CRÍTICO | Fuga de dados entre empresas/tenants |
| 2 | `empresa_id` aceite via query string em 10 rotas ARTSOFT, sobrepõe JWT | 🔴 CRÍTICO | Utilizador de empresa A pode ler/escrever dados da empresa B |
| 3 | Receção (`useRecepcao.ts`) não persiste nada — só memória do browser | 🔴 CRÍTICO | Refresh de página apaga conferência/divergências/validação inteiras |
| 4 | `useWMSData` mascara erro real com `MOCK_RECEIVING_ORDERS` e força `error=null` | 🔴 CRÍTICO | Operador vê dados fictícios sem saber que API falhou |
| 5 | 5 de 6 endpoints de Expedição são stubs sem persistência | 🟠 ALTO | Documentos fiscais com `Math.random()`, nada sobrevive a restart |
| 6 | `services/api.ts` (37 endpoints) é código morto nunca ligado ao frontend | 🟠 ALTO | Trabalho de backend "P1-P4" documentado no chat anterior não está em uso real |
| 7 | Preço/IVA/desconto/lote/validade só em JSONB `dados_extra`, nunca colunas | 🟠 ALTO | Impossível de consultar/filtrar em SQL; relatórios financeiros inviáveis |
| 8 | `logistics.lote` nunca povoada pelo sync — quebra rastreabilidade | 🟠 ALTO | `mv_rastreabilidade_lote` sempre vazia/desatualizada |
| 9 | Sync ARTSOFT é full diário (30 dias), não incremental; sem retry | 🟡 MÉDIO | Custo desnecessário de rede/BD, falhas só recuperam no dia seguinte |
| 10 | `logistics.terceiro` referenciada em migração mas não existe no schema | 🟡 MÉDIO | Migração `020_recepcao_schema.sql` falharia se corrida do zero |
| 11 | Sem paginação real (frontend só manda `limit`, nunca `offset`) | 🟡 MÉDIO | Registos além do limite (100-500) ficam invisíveis, sem forma de aceder |
| 12 | Auditoria (`AuditoriaModule`) 100% gerada no cliente, nunca persistida | 🟡 MÉDIO | Trilha de auditoria não sobrevive a refresh; inútil para compliance |
| 13 | Rate limiter importado mas nunca aplicado a rota nenhuma | 🟡 MÉDIO | Sem proteção contra abuso/DoS nos 37 endpoints REST |
| 14 | N+1 queries em consolidação de paletes e em todos os syncs ARTSOFT | 🟡 MÉDIO | Performance degrada linearmente com volume de dados |
| 15 | Sem tratamento de timezone/UTC em nenhuma camada | 🟢 BAIXO | Datas de filtro dependem do browser do utilizador |
| 16 | `App.tsx:379` "42ms" de latência ARTSOFT é valor hardcoded | 🟢 BAIXO | Métrica falsa apresentada como real no dashboard |

---

## 1. Auditoria por Módulo/Ecrã

### 🔴 Receção (P1) — `RececaoModule.tsx` + `useRecepcao.ts`

**Funcionalidade esperada:** criar receção, conferir linhas, registar divergências/lotes/documento, validar, finalizar → persistir tudo e disparar entrada ARTSOFT.

**Dados atuais:** tudo gerado e mantido em `useState` do hook, com IDs via `Date.now()`. Zero chamadas de rede.

**Problema:** 🔴 Sem ligação real ao backend. 6 TODOs explícitos (`useRecepcao.ts:39,242,251,254,257,286`) confirmam que `POST /rest/v1/recepcao`, `PATCH /rest/v1/recepcao/{id}`, e as validações de finalização nunca foram implementadas no cliente — apesar dos endpoints existirem no backend (`recepcao-endpoints.js`). Validação de finalização devolve sempre `true`/`0` fixo.

**Correção:** ligar `useRecepcao` às chamadas reais de `services/api.ts` (`RecepcaoAPI.criar/atualizarEstado/validar/finalizar`) que já existem e estão testadas mas nunca foram importadas.

---

### 🟠 Backend Receção — `recepcao-endpoints.js`

| Endpoint | Estado |
|---|---|
| `GET /recepcao/:id/validacao` | 🔴 Fixo: `{valido:false, erros:['Validação não implementada ainda']}` |
| `GET /localizacao/sugerida` | 🔴 Array hardcoded, 2 posições fixas, sem query |
| `GET /localizacao/disponivel` | 🔴 Array hardcoded, `// TODO: Query localizações` |
| `POST /recepcao/:id/finalizar` | 🟡 Marca estado sem validar nada |
| Restantes 13 endpoints | 🟢 Funcionais, mas sem filtro explícito de `empresa_id` no SQL (dependem de RLS) |

---

### 🟠 Expedição — `ExpedicaoModule.tsx` + `expedicao-endpoints.js`

| Endpoint | Estado |
|---|---|
| `GET /expedicao` | 🟡 Filtra `estado >= $1` como string — comparação lexicográfica, não enum. Comportamento acidental. |
| `GET /expedicao/:id` | 🔴 Payload fixo, `numero_guia: 'GR/12345'` hardcoded |
| `POST /expedicao/conferencia` | 🔴 Stub, sem query |
| `POST /expedicao/:id/documento` | 🔴 Stub; número fiscal via `Math.random()` — **nunca usar random para numeração fiscal** |
| `GET /expedicao/:id/rastreamento` | 🔴 Stub, `TRK-${Date.now()}` fabricado |
| `PATCH /expedicao/:id/status` | 🔴 Stub — `logistics.documento` nem tem coluna `estado` para persistir |

**Causa raiz:** `logistics.documento` não tem coluna de estado (confirmado no próprio comentário `server.js:447`). Sem essa coluna, todo o módulo de expedição está estruturalmente impedido de persistir transições de estado.

**Frontend:** `useExpedicaoData.ts` — `paletas` e `comprovantes` ficam sempre `[]` (comentário próprio: "sem tabelas próprias ainda"). Handlers em `App.tsx:214-253` atualizam só state local, nunca chamam backend.

---

### 🟡 Stock — `StockMapModule.tsx` + `stock-endpoints.js`

| Item | Estado |
|---|---|
| Localizações de armazém (`INITIAL_LOCATIONS`) | 🔴 100% mock, nunca de API; `paletes:[]` fixo por localização |
| `POST /stock/reconciliar` | 🔴 Calcula em memória, comentário admite "seria em tabela stock_reconciliacao" |
| `PATCH /stock/lote/:id/status` | 🔴 Stub, sucesso fixo |
| `POST /stock/alerta` | 🔴 Stub, `ALT-${Date.now()}` fabricado |
| `GET /stock/lotes/fefo` | 🟢 Query real, correta — mas `LIMIT 100` sem paginação, sem filtro explícito `empresa_id` |

---

### 🟡 Paletização — `paletizacao-endpoints.js`

| Item | Estado |
|---|---|
| `PATCH /palete/:sscc/item`, `DELETE /palete/:sscc/item/:linhaId` | 🔴 Stub, sucesso fixo sem tocar BD |
| Consolidação (linhas 160-169, 188-195) | 🟡 N+1: loop de 1 query por SSCC (soma + insert movimento) em vez de `SUM(...) WHERE sscc = ANY($1)` |
| `GET /palete/disponivel` | 🟡 `LIMIT 100` fixo, sem offset |

---

### 🟢 Dashboard / Auditoria — `App.tsx`

| Item | Estado |
|---|---|
| `"Sync Latency (ARTSOFT)" = "42ms"` | 🔴 Hardcoded, apresentado ao lado de "REST Ativo" como se fosse medição real |
| `AuditoriaModule` | 🔴 Estado inicial = mock (`mockData.ts`, IPs/empresas fictícias tipo Sonae/Sovena/Lactogal); novos logs gerados 100% no cliente com `operador`/`ip_terminal` strings fixas, nunca persistidos |
| `console.log` de debug | 🟢 Cosmético — `App.tsx:257,260,262,265,268`, `ExpedicaoModule.tsx:62`, `PaletizacaoModule.tsx:177`, `RececaoModule.tsx:138` |

---

### 🟠 `useWMSData.ts` — hook central de dados WMS

```
useWMSData.ts:154-159
catch (err) {
  console.warn('Erro ao carregar dados (usando mocks):', err);
  setOrders(MOCK_RECEIVING_ORDERS);   // dados fictícios
  setError(null);                      // <- apaga o erro real
}
```

**Problema:** falha de API é completamente invisível ao operador — a UI parece funcionar normalmente mostrando encomendas fictícias. Isto é o pior tipo de falha silenciosa: parece "🟢 funcionamento correto" ao olho, mas é 🔴 dados falsos.

**Mesma classe de problema em `useRegras.ts:57,61`:** se a API devolver vazio OU falhar, cai sempre para `DEFAULT_RULES` hardcoded sem indicar visualmente que não são as regras reais do cliente.

---

## 2. Arquitetura — Dois Clientes de API Paralelos

Existem **dois clientes de API completos e incompatíveis**:

| | `frontend/src/api.ts` (usado) | `frontend/src/services/api.ts` (morto) |
|---|---|---|
| Token | `sessionStorage` | `localStorage` |
| Cobertura | ~20 funções (sync, config series, dados de teste) | 37 endpoints REST completos (RecepcaoAPI, PaletizacaoAPI, StockAPI, ExpedicaoAPI, LocalizacaoAPI) |
| Paginação | Só `limit` | Não verificado, mas estruturado por endpoint |
| Uso real | Importado por `App.tsx` e todos os hooks | **Nunca importado por ninguém** |

Isto confirma algo importante: o trabalho de backend (37 endpoints, 4 fases P1-P4) documentado e implementado anteriormente **nunca foi ligado ao frontend real**. O frontend continua a operar sobre um conjunto bem menor de rotas (`/rest/v1/*` genérico do PostgREST-like + `/api/artsoft/*`), e os componentes de Receção/Expedição/Stock/Paletização (P1-P4) mostrados na UI usam hooks locais (`useRecepcao`, `useWMSData`, `useExpedicaoData`) que na maior parte não chamam esses 37 endpoints.

Há também **duas pastas de componentes legacy mortas** (`components/wms_recepcao/`, `components/wms_paletizacao/`, `.jsx`) nunca importadas — resíduo de uma versão anterior.

**Recomendação:** decidir uma única fonte de verdade. Ou (a) ligar `useRecepcao`/`useExpedicaoData`/módulos de Stock aos 37 endpoints já implementados em `services/api.ts` e no backend, ou (b) remover `services/api.ts` e as pastas mortas, e completar os stubs dos 4 ficheiros `*-endpoints.js` existentes com persistência real. Não manter os dois em paralelo.

---

## 3. Segurança — RLS e Isolamento de Tenants

### 3.1 Bypass de RLS (crítico)

`database/020_recepcao_schema.sql:148-218` — todas as 8 políticas RLS do módulo receção/paletização incluem:

```sql
... OR current_setting('request.jwt.claims') = ''
```

Quando o claim JWT está vazio — o que acontece sempre que `setEmpresaContext` corre sem `empresa_id` definido, incluindo o próprio fluxo de dev-token se o token não tiver o claim — **a RLS deixa de filtrar e todas as linhas de todas as empresas ficam visíveis e editáveis**.

Esta cláusula de escape **não existe** nas políticas gerais (`02_security.sql`) nem em `07_guias_transporte.sql`, que exigem sempre `empresa_id = jwt_empresa_id()` sem exceção — a falha está isolada ao módulo de receção/paletização.

**Correção:** remover a cláusula `OR ... = ''` das 8 policies; falhar fechado (nenhuma linha visível) em vez de aberto quando o claim estiver vazio.

### 3.2 `empresa_id` sobreponível via query string

Em 10 rotas (`/api/artsoft/guias/sync`, `/produtos/sync`, `/terceiros/sync`, `/stock/sync`, `/api/artsoft/config` GET/POST, `/series/discover`, `/series/config/:modulo`, `/test-data/*`, `/series/save`), o `empresa_id` usado para o contexto RLS é:

```js
req.query.empresa_id || req.user?.empresa_id || req.body?.empresa_id || '11111111-...'
```

Um utilizador autenticado como empresa A só precisa de acrescentar `?empresa_id=<B>` para operar sobre dados da empresa B. O JWT nunca é confrontado com o valor pedido.

**Correção:** usar sempre `req.user.empresa_id` (do JWT verificado) como única fonte; ignorar/rejeitar qualquer `empresa_id` vindo de query/body nestas rotas.

### 3.3 Dev-token endpoint público

`GET /auth/dev-token` (`server.js:390-403`) emite JWT válido de 24h para a empresa fixa, sem autenticação, sem gate por `NODE_ENV`. Comentário próprio admite "Remover em produção" mas está ativo incondicionalmente.

**Correção:** `if (process.env.NODE_ENV === 'production') return res.status(404).end()` no topo da rota, ou remover do build de produção.

### 3.4 Rate limiting não aplicado

`apiLimiter` é importado (`server.js:10`) mas nunca usado em nenhuma rota — os 37 endpoints REST não têm proteção contra abuso apesar do comentário no próprio ficheiro afirmar "100/15min por usuário".

---

## 4. Mapping Incompleto ArtSoft → Base de Dados

| Dado ArtSoft capturado | Onde fica | Problema |
|---|---|---|
| `valor_unitario`, `iva`, `desconto`, `total_liquido`, `custo_unitario`, `lote`, `data_validade` (por linha) | JSONB `dados_extra` de `linha_documento` | Sem colunas próprias — impossível filtrar/somar em SQL; relatórios financeiros e FEFO por lote de guia inviáveis diretamente |
| Matrícula, moradas carga/descarga, peso, volumes (cabeçalho documento) | JSONB `dados_extra` | `form_path` está **vazio e inativo** (`ativo=false`) em `07_guias_transporte.sql:319-326` — nem sequer pedido ao ArtSoft hoje |
| `peso_bruto`, `dias_validade`, `unidade` (produto) | JSONB `dados_extra` | Schema tem colunas dedicadas (`peso_liquido_kg`, `ti`, `hi`, `unidades_por_caixa`) que o sync **nunca escreve** |
| Lote/validade de linha de guia | `dados_extra` da linha | `logistics.lote` nunca é povoada pelo sync — quebra `logistics.caixa.lote_id` e a MV `mv_rastreabilidade_lote` |

**Consequência prática:** o sistema tem duas tabelas de lote paralelas sem ligação — `logistics.lote` (schema principal, nunca povoada por sync) e `logistics.recepcao_lote` (módulo P1, usada pelo endpoint FEFO). Um relatório de rastreabilidade que use `mv_rastreabilidade_lote` estará sempre vazio ou desatualizado.

**Recomendação:** para cada campo em `dados_extra` que seja usado em queries/relatórios recorrentes (preço, IVA, lote, validade), promover a coluna própria + índice, e ligar o mapper para escrever nela diretamente em vez de só no JSON.

---

## 5. Sincronização ARTSOFT

- **Full sync diário, não incremental.** `sincronizarGuias` sem parâmetros usa janela `hoje - dias_retroativos` (30 dias por default) e reimporta tudo todos os dias às 2h UTC (cron `0 2 * * *`).
- **Versão incremental existe mas está desligada.** `sync-incremental.js` nunca é chamado por `syncGuiasJob.js` (que chama sempre a versão full). Mesmo que fosse ligada, tem um bug: compara `estado === 'completo'`, mas os estados reais produzidos são `'ok'|'incompleto'|'erro_*'` — nunca `'completo'` — logo a marca de "última sincronização" nunca avançaria.
- **Sem retry automático.** Falha de uma etapa (produtos/terceiros/stock/guias) é isolada por `try/catch` e não bloqueia as seguintes, mas não há nova tentativa na mesma execução — só reporta via alerta e espera pelo cron do dia seguinte (24h de atraso no pior caso).
- **`docs_atualizados: 0` sempre fixo** — o número de documentos atualizados (vs. criados) nunca é calculado, apesar do TODO explícito no código.
- **N+1 em todos os 4 mappers** (guias, produtos, terceiros, stock): 1 UPSERT (+ delete/insert de linhas) por registo, em loop — sem batch/bulk insert. Para volumes grandes (milhares de produtos/guias), isto é o maior risco de degradação de performance do sync.

**Recomendação:**
1. Corrigir a comparação de estado em `sync-incremental.js` e ligar essa função ao cron (janela incremental desde a última execução bem-sucedida, não sempre 30 dias).
2. Substituir os loops de UPSERT por `INSERT ... ON CONFLICT` em batch (`unnest($1::text[], $2::numeric[], ...)` ou multi-row VALUES).
3. Adicionar retry com backoff (2-3 tentativas) antes de marcar a etapa como falhada.
4. Calcular `docs_atualizados` real comparando `xmax` ou timestamp de updated_at antes/depois do UPSERT.

---

## 6. Paginação

**Não existe paginação real em lado nenhum.** O frontend (`api.ts`) só envia `limit` (100-500 consoante o endpoint) e nunca `offset`. Isto significa: se uma tabela ARTSOFT tiver mais registos que o limite do endpoint, **os registos além desse limite são simplesmente invisíveis** — não há forma de o operador pedir "página seguinte".

Backend também tem `LIMIT` fixo sem `OFFSET` em vários endpoints (`stock/lotes/fefo`, `palete/disponivel`). A única rota com paginação real (LIMIT+OFFSET) é `GET /rest/v1/:table` genérico, mas o frontend nunca envia `offset` para ela.

**Recomendação:** adicionar `offset`/`cursor` a todas as funções de listagem em `api.ts`, e paginação real (com total de resultados) nos endpoints de listagem que ainda não têm.

---

## 7. Schema Quebrado

`database/020_recepcao_schema.sql:12` referencia `logistics.terceiro(id)` — esta tabela **não existe** em nenhuma migração versionada (só `logistics.cliente` e `logistics.fornecedor` existem, de `01_schema.sql:164-195`). Se esta migração fosse corrida do zero num ambiente novo, falharia com `relation "logistics.terceiro" does not exist`.

**Recomendação:** corrigir a referência para `logistics.fornecedor(id)` (que é semanticamente o que a receção precisa), ou criar de facto uma tabela/view `logistics.terceiro` unificando cliente+fornecedor se esse for o modelo pretendido.

---

## 8. Outros Achados Menores

- **Exposição de erro SQL cru:** todos os `catch` dos endpoints devolvem `err.message` do driver Postgres diretamente ao cliente — pode vazar nomes de tabelas/colunas/constraints em mensagens de erro.
- **Sem timezone/UTC normalizado:** todas as datas usam `new Date().toISOString()` no timezone do browser; filtros de data enviados ao sync ARTSOFT (`data_inicio`/`data_fim`) não têm conversão explícita.
- **Numeração fiscal via `Math.random()`** em `expedicao-endpoints.js:102` — inaceitável para documentos fiscais reais (deve ser sequencial e persistido).
- **Tipos de documento hardcoded** em `server.js:1217-1284` — deveria vir de configuração/BD para refletir séries reais da empresa (relacionado com o trabalho de Series Config já feito, mas não reaproveitado aqui).

---

## 9. Plano de Ação Priorizado

### Prioridade 1 — Segurança (esta semana)
1. Remover cláusula `OR claims=''` das 8 RLS policies em `020_recepcao_schema.sql`.
2. Forçar `req.user.empresa_id` como única fonte nas 10 rotas ARTSOFT que aceitam `empresa_id` via query/body.
3. Desativar `/auth/dev-token` fora de `NODE_ENV=development`.
4. Aplicar `apiLimiter` a todas as rotas `/rest/v1/*` e `/api/artsoft/*`.

### Prioridade 2 — Integridade funcional (2-3 semanas)
5. Ligar `useRecepcao.ts` aos endpoints reais (`POST/PATCH /rest/v1/recepcao`, validação, finalização) — decidir se via `services/api.ts` (37 endpoints) ou completar os stubs de `recepcao-endpoints.js`.
6. Remover fallback silencioso de `useWMSData` e `useRegras` — em erro, mostrar estado de erro explícito ao operador, nunca dados fictícios sem aviso.
7. Adicionar coluna `estado` a `logistics.documento` e completar os 5 stubs de `expedicao-endpoints.js` com persistência real.
8. Substituir `Math.random()` por sequência real para numeração fiscal.
9. Decidir arquitetura única de API: eliminar `services/api.ts` morto ou migrar para ele; remover pastas `.jsx` legacy.

### Prioridade 3 — Qualidade de dados ARTSOFT (1 mês)
10. Promover preço/IVA/desconto/lote/validade de `dados_extra` para colunas próprias + popular `logistics.lote` no sync.
11. Corrigir e ligar `sync-incremental.js` ao cron; adicionar retry com backoff.
12. Substituir loops de UPSERT por batch insert nos 4 mappers.
13. Corrigir referência `logistics.terceiro` → `logistics.fornecedor`.

### Prioridade 4 — Performance e UX (contínuo)
14. Adicionar paginação real (offset/cursor) a todas as listagens frontend+backend.
15. Persistir auditoria real (backend) em vez de gerada no cliente.
16. Remover métricas hardcoded (latência "42ms") ou calcular de facto.
17. Normalizar timezone em filtros de data enviados ao ARTSOFT.
