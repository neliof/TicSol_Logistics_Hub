# Diagnóstico Técnico — TicSol_Logistics_Hub vs TICSOL_HUB_Central

**Data:** 2026-09-02
**Fase:** 1 — Análise (sem alterações de código)
**Âmbito:** arquitetura, integração ARTSOFT, protocolo XML, segurança, testes

---

## A. Resumo executivo

### Estado atual

O `TicSol_Logistics_Hub` é um **protótipo em fase inicial** (4 commits, ~45 ficheiros de código),
não um sistema em produção. Stack: PostgreSQL + PostgREST + React (JSX) + um servidor Express
auxiliar + um serviço Node de sincronização (`artsoft-sync`). **Não existe C#/.NET em nenhum dos
dois projetos** — o prompt original assumia .NET; a realidade é Python/FastAPI (Hub Central) e
Node/React (Logistics Hub).

### Descoberta principal

**O `TicSol_Logistics_Hub` não fala XML com o ARTSOFT. De todo.**

Não existe uma única linha de construção ou parsing de XML no projeto. As três referências a "xml"
no repositório são: um `package-lock.json`, uma coluna `conteudo_xml text` no schema (para EDI
DESADV, ainda não usada) e menções na especificação funcional.

Em vez do protocolo real do ARTSOFT, o `artsoft-sync` implementa **três conectores especulativos**
— e os próprios comentários no código admitem-no:

> `connectors/rest.js`: *"Os caminhos e nomes de campos abaixo são um PONTO DE PARTIDA plausível,
> não uma certeza — ninguém aqui viu ainda a resposta real desse endpoint."*

> `connectors/odbc.js`: *"Os nomes de tabela/coluna abaixo (ARTIGO, CLIENTE, FORNECEDOR, STOCKS)
> são o padrão típico de ERPs deste género — mas só o teu ARTSOFT sabe os nomes reais."*

Entretanto, o `TICSOL_HUB_Central` **já tem o protocolo real, testado e a funcionar**:
Digest Auth SHA1 sobre uma única ligação TCP, endpoint `Queries/Query` na porta 4200, query
language `TerFch|Cliente|NrCli=1:99999`, paginação por token, parsing XXE-safe.

Ou seja: o Logistics Hub inventou uma integração que o ecossistema já resolveu.
**Isto é o P0 número um.**

### Segundo problema crítico

O `server/server.js` (proxy Express) tem:
- credenciais de base de dados em código,
- **zero autenticação**,
- ligação como superutilizador `postgres`, o que **anula por completo o RLS multi-empresa**
  desenhado com cuidado no `02_security.sql`,
- interpolação direta de nomes de tabela, coluna e função em SQL.

O modelo de segurança da base de dados está bem feito. O proxy contorna-o inteiro.

---

## B. Arquitetura atual encontrada

### TICSOL_HUB_Central (referência)

```
FastAPI (Python 3.12, async)
├── app/core/artsoft_connection.py     ← protocolo ARTSOFT (Digest + XML)
├── app/core/artsoft_health.py         ← health check com cache TTL 60s
├── app/modules/
│   ├── pedidos_xml/                   ← templates XML versionados em BD
│   │   ├── endpoints.py  service.py  repository.py  schemas.py
│   └── migracao/
│       ├── artsoft_client.py          ← resolve runtime/credenciais da config BD
│       ├── artsoft_sync_service.py    ← fetch_* com paginação por token
│       └── obras_c002_parser.py       ← parser dedicado por tipo de resposta
├── app/db/models/integracao/xml.py    ← PedidoXml + Historico + Execucao
└── tests/modules/                     ← suite pytest por módulo
```

Camadas: `endpoints → service → repository → models`. Injeção de dependências via FastAPI.
Permissões declarativas (`require_permission("pedidos_xml.read")`).

### TicSol_Logistics_Hub (atual)

```
database/               01_schema · 02_security (RLS) · 03_functions_rpc
                        04_regras_sonae_mc · 05_dados_ficticios · 06_artsoft_staging
server/                 server.js (Express, sem auth, superuser)
                        services/zebraService.js (ZPL)
artsoft-sync/           index.js → connectors/{rest,odbc,file}.js → lib/sync.js
frontend/               receção/Reception.jsx · paletizacao/Paletizacao.jsx
                        (JSX solto, sem build config, sem package.json próprio)
postgrest.conf          PostgREST na porta 3000
```

**Não há camada de serviço, nem repositórios, nem modelos, nem testes.** O frontend fala
diretamente com PostgREST; a lógica de negócio vive dentro dos componentes JSX e em funções
PL/pgSQL. Para um WMS isto colapsa depressa.

---

## C. Comparação XML: Hub Central vs Logistics Hub

| Característica | TICSOL_HUB_Central | TicSol_Logistics_Hub | Estado |
|---|---|---|---|
| Existe integração XML | Sim, operacional | **Não existe** | 🔴 EM FALTA |
| Endpoint | `Queries/Query`, `DocFch/CfgDocum`, `DocFch/DocPrintEx` | — (REST `/produtos`, `/clientes` inventados) | 🔴 DIVERGENTE |
| Porta | 4200 (config BD); health check 4198 | 4219 (`.env.example`, origem desconhecida) | 🔴 DIVERGENTE |
| Autenticação | Digest `SHA1(SHA1(user)+SHA1(pass)+SHA1(challenge))` | `Authorization: Bearer <apiKey>` (inventado) | 🔴 DIVERGENTE |
| Ciclo de ligação | `GET /login` + `POST` na **mesma** ligação TCP (challenge preso à ligação) | n/a | 🔴 EM FALTA |
| Encoding | `utf-8`; header `Encoding: utf-8`; `Content-Type: text/xml; charset=utf-8` | n/a (CSV latin1/win1252 no conector file) | ⚠️ NÃO COMPARÁVEL |
| Estrutura do pedido | `<root type='list' end='{N}' name='rec' query='...'><defcol>…</defcol></root>` | n/a | 🔴 EM FALTA |
| Query language | `Tabela\|Filtro\|Campo=min:max` (ex. `TerFch\|Cliente\|NrCli=1:99999\|Filial=0:999`) | SQL ANSI inventado (`SELECT … FROM ARTIGO`) | 🔴 DIVERGENTE |
| Mapeamento de campos | `form='%TerFch.Ter.Nome'` | `r.NOME` (coluna inventada) | 🔴 DIVERGENTE |
| Tabelas reais confirmadas | `TerFch`, `DocFch`, `StkFch`, `VndFch`, `CtaDoc`, `CtaLan`, `GrhEmp` | `ARTIGO`, `CLIENTE`, `FORNECEDOR`, `STOCKS` (inventadas) | 🔴 DIVERGENTE |
| Paginação | Token: `\|#{token}` no filtro + `end='{size}'`; `_extract_next_token()` com fallbacks; `'0'`/`''` = fim | Inexistente (assume dataset completo) | 🔴 EM FALTA |
| Parsing de resposta | `defusedxml` (XXE-safe) + parser dedicado por entidade | `res.json()` | 🔴 DIVERGENTE |
| Deteção de erro funcional | `<Error><Code/><Message/></Error>` → `ArtsoftRequestError` | `!res.ok` genérico | 🔴 DIVERGENTE |
| Taxonomia de erros | `ArtsoftConnectionError` / `ArtsoftAuthenticationError` / `ArtsoftRequestError` + 401 dedicado | `new Error(string)` | 🔴 DIVERGENTE |
| Timeout | Config BD, default 10s; 120s para artigos/documentos | **Nenhum** (`fetch` sem timeout = pendura indefinidamente) | 🔴 EM FALTA |
| Retry | **Não existe** em nenhum dos dois | Não existe | ⚪ IGUAL |
| Idempotência | n/a (leitura apenas) | Upsert PostgREST por `(empresa_id, chave_natural)` — correto | 🟢 OK |
| Encriptação XOR | Suportada (`encrypt: true` → `bin/xml` + header `Checksum`), desligada por omissão | n/a | ⚠️ NÃO USADO |
| Gzip | Suportado, desligado por omissão | n/a | ⚠️ NÃO USADO |
| Logging | `logger` estruturado com `extra={}`, duração, contagens, tokens | `console.log` com emojis | 🔴 DIVERGENTE |
| Auditoria de execuções | Tabela `auditoria.pedidos_xml_execucoes` (request+response+duração+status) | Nenhuma | 🔴 EM FALTA |
| Versionamento de templates | `config.pedidos_xml` + `pedidos_xml_historico` (CREATE/UPDATE/DELETE) | Queries hardcoded em JS | 🔴 DIVERGENTE |
| Credenciais | `config.configuracao` na BD, com separação teste/produção via `sistema.modo` | `.env` + hardcoded | 🔴 DIVERGENTE |
| Escrita para o ERP | **Não existe** (só leitura + impressão de PDF) | Não existe | ⚠️ INFORMAÇÃO NÃO ENCONTRADA |

### Protocolo ARTSOFT real (extraído do Hub Central)

```
1. GET /login
   Headers: Connection: Keep-Alive, Keep-Alive: 60, Encoding: utf-8,
            name: <username>, XMLIdent: 3
   → resposta traz header "digest" = challenge

2. digest = SHA1( SHA1(user).digest + SHA1(pass).digest + SHA1(challenge).digest ).hexdigest()

3. POST /Queries/Query   (MESMA ligação TCP — obrigatório)
   Headers: Content-Type: text/xml; charset=utf-8, Encoding: utf-8,
            digest: <digest>, Connection: Close, Content-Length: <n>
   Body: <?xml version='1.0' encoding='UTF-8'?>
         <root type='list' end='500' name='rec' query='TerFch|Cliente|NrCli=1:99999|Filial=0:999'>
             <defcol>
                 <Ter_Nome form='%TerFch.Ter.Nome'/>
                 ...
             </defcol>
         </root>

4. Resposta: <root><rec><Ter_Nome>…</Ter_Nome></rec>…</root>
   Paginação: token no atributo next/token da raiz ou do 1.º <rec>;
              '0' ou vazio = não há mais registos.
```

**Regra crítica documentada no Hub Central:** o challenge está associado à ligação TCP.
Separar `GET /login` do `POST` em ligações diferentes dá 401 sempre.

### Validação cruzada com o Obsidian

O mapa mental `ARTSOFT_BaseConhecimento_MapaMental.md` confirma a infraestrutura
(XMLServer, ArtCMD, Serviços Web) e o `INDICE_MESTRE_CONHECIMENTO_INTEGRADO.md` confirma o
formato de QuerySpec `TerFch|Cliente|NrCli=1:999999999` e as tabelas `TerFch`, `DocFch`,
`DocLin`, `GrhEmp`, `TerFchEx`. Três fontes independentes concordam. Os nomes de tabela usados
pelo `artsoft-sync` não aparecem em nenhuma delas.

**Nota:** o Obsidian documenta sobretudo o **ArtCMD** (produto distinto, com API REST `?entity=`).
Não confundir os dois protocolos.

---

## D. Lista de problemas

### 🔴 P0 — Crítico

| # | Problema | Ficheiro | Impacto |
|---|---|---|---|
| P0-1 | Integração ARTSOFT inventada — endpoints, tabelas, colunas e autenticação não correspondem ao sistema real | `artsoft-sync/connectors/*.js` | Sincronização nunca funcionará contra o ARTSOFT real. Dados mestre corrompidos ou vazios. |
| P0-2 | Credenciais de BD em código-fonte versionado | `server/server.js:15`, `postgrest.conf:3` | ⚠️ **SECRET DETETADO** — ver secção E |
| P0-3 | `server.js` sem qualquer autenticação; qualquer pessoa com acesso à porta lê/escreve todas as tabelas | `server/server.js:29-82` | Exposição total de dados de todas as empresas |
| P0-4 | `server.js` liga como superutilizador `postgres` → RLS multi-empresa **completamente anulado** | `server/server.js:12-18` | Isolamento entre empresas inexistente; `02_security.sql` é decorativo por este caminho |
| P0-5 | Injeção SQL por interpolação de identificadores (tabela, colunas, função RPC) | `server/server.js:35,57,74` | Execução arbitrária de SQL |
| P0-6 | `jwt-secret` de exemplo em ficheiro versionado | `postgrest.conf:13` | Forja de tokens trivial |
| P0-7 | Sem timeout em nenhuma chamada `fetch` (sync e frontend) | `artsoft-sync/*`, `frontend/*/api/*` | Sync fica pendurado indefinidamente; sem watchdog |
| P0-8 | Paginação ausente — assume que ARTSOFT devolve o dataset todo numa resposta | `artsoft-sync/connectors/*.js` | Silenciosamente perde registos além do limite do servidor |

### 🟠 P1 — Importante

| # | Problema | Ficheiro |
|---|---|---|
| P1-1 | Zero testes no projeto inteiro (nenhum unitário, integração ou contrato) | — |
| P1-2 | Sem camada de serviço/repositório; regras de negócio dentro de JSX e PL/pgSQL | `frontend/*` |
| P1-3 | Conflito de portas: PostgREST=3000, `server.js`=3000, frontends apontam para 3001 | `postgrest.conf:9`, `server/server.js:10`, `frontend/*/api/*.js:14` |
| P1-4 | `getToken()` marcado `TODO` — autenticação do frontend não está ligada a nada | `frontend/receção/api/postgrestClient.js:16-20` |
| P1-5 | Logging não estruturado (`console.log` + emojis), sem correlation ID, sem duração | `artsoft-sync/lib/sync.js` |
| P1-6 | Sem auditoria de sincronizações (não se sabe o que foi enviado/recebido/quando) | `artsoft-sync/*` |
| P1-7 | Erros de sync são engolidos e agregados numa string; sem taxonomia (temporário vs permanente) | `artsoft-sync/lib/sync.js:24-27` |
| P1-8 | Sem retry nem backoff em nenhuma operação de rede | `artsoft-sync/*` |
| P1-9 | Frontend JSX sem `package.json`, sem build, sem lint — não é compilável no estado atual | `frontend/` |
| P1-10 | GS1-128 construído por concatenação de strings sem validação de AI nem dígito de controlo | `server/services/zebraService.js:70` |
| P1-11 | ZPL sem escape de `^` e `~` nos dados de produto — descrição com esses caracteres corrompe a etiqueta | `server/services/zebraService.js:58,64` |
| P1-12 | `mmToDots` sem validação de DPI: DPI desconhecido dá `NaN` silencioso no ZPL | `server/services/zebraService.js:6-9` |

### 🟡 P2 — Melhorias

| # | Melhoria |
|---|---|
| P2-1 | Adotar o modelo `pedidos_xml` do Hub Central: templates XML versionados em BD em vez de queries hardcoded |
| P2-2 | Adotar `pedidos_xml_execucoes` para auditoria de request/response |
| P2-3 | Credenciais ARTSOFT vindas de configuração central com separação teste/produção (`sistema.modo`) |
| P2-4 | Health check ARTSOFT com cache TTL, à imagem de `artsoft_health.py` |
| P2-5 | Nome de pasta `frontend/receção/` com acento e cedilha — problemas de portabilidade e URL |
| P2-6 | Filtros aplicados em memória em vez de na BD (padrão herdado do Hub Central `endpoints.py:59-62` — não copiar) |
| P2-7 | Consolidar `.worktrees/zebra-label-printing` (duplicação completa do projeto no disco) |

---

## E. ⚠️ Secrets detetados

```
⚠️ SECRET DETETADO EM:
  server/server.js:15          — password de base de dados PostgreSQL em código
  postgrest.conf:3             — password embutida na db-uri
  postgrest.conf:13            — jwt-secret de exemplo ("your-secret-key-change-this-in-production")
  database/02_security.sql:17  — password do role `authenticator` em SQL versionado
```

**Ação recomendada:**
1. Rodar a password do PostgreSQL e do role `authenticator` — devem ser consideradas comprometidas,
   estão em histórico Git.
2. Mover para variáveis de ambiente / gestor de segredos.
3. Manter apenas `postgrest.conf.example` no repositório; `postgrest.conf` para `.gitignore`.
4. Gerar `jwt-secret` aleatório com ≥32 bytes, fora do repositório.
5. Considerar limpeza do histórico Git (`git filter-repo`) — os segredos estão nos 4 commits.

Nenhum valor de segredo é reproduzido neste documento.

---

## F. Arquitetura recomendada

Princípio: **reutilizar o protocolo, não o código.** O Hub Central é Python; o Logistics Hub é Node.
Copiar ficheiros não é opção — o que se porta é o *contrato de protocolo*, verificado contra o
comportamento real do WebServer.

```
artsoft-sync/
├── artsoft/
│   ├── connection.js        ← porte fiel de ArtsoftConnection:
│   │                           GET /login + POST na mesma ligação (http.Agent keepAlive
│   │                           com maxSockets:1, ou socket cru — fetch() NÃO garante isto)
│   │                           digest SHA1, timeout, taxonomia de erros
│   ├── queryBuilder.js      ← <root type='list' end=… query=…><defcol/></root>
│   ├── parser.js            ← parsing XXE-safe; deteção de <Error>; extração de token
│   └── errors.js            ← ConnectionError · AuthError · RequestError · FunctionalError
├── mappers/
│   ├── artigos.js           ← StkFch  → produto
│   ├── terceiros.js         ← TerFch  → cliente / fornecedor
│   └── stock.js             ← (query de stock POR CONFIRMAR)
├── lib/
│   ├── sync.js              ← orquestração (mantém-se, já está bem desenhada)
│   ├── pagination.js        ← ciclo de token com limite de páginas
│   └── logger.js            ← JSON estruturado + correlationId
└── audit/                   ← registo de request/response por execução
```

**Nota crítica de implementação:** o `fetch()` do Node **não** garante reutilização da mesma
ligação TCP entre dois pedidos. O protocolo ARTSOFT exige-o. Terá de ser `http.request` com um
`http.Agent({ keepAlive: true, maxSockets: 1 })` dedicado, ou um socket gerido à mão. Isto é
exatamente a razão pela qual `artsoft_connection.py` usa `http.client.HTTPConnection` em vez de
`httpx`, apesar do resto do Hub Central ser todo async.

### O que **não** copiar do Hub Central

| Padrão | Porquê não |
|---|---|
| Filtragem em memória depois da paginação (`pedidos_xml/endpoints.py:59-62`) | Bug latente: filtra só a página atual, `total` fica inconsistente |
| `_resolve_runtime()` abrir sessão síncrona de BD dentro de handler async | Bloqueia o event loop |
| Abrir uma ligação ARTSOFT nova por cada página do ciclo de paginação | Custo de handshake por página; aceitável no Hub Central, mau para sync de volume |
| `ArtsoftConnection.connect()/disconnect()` no-ops | API enganadora — sugere pooling que não existe |

---

## G. Plano de intervenção

### Etapa 0 — Contenção (antes de mais nada)

1. Rodar todas as credenciais expostas.
2. `postgrest.conf` → `.gitignore`.
3. Decidir: `server.js` desaparece (PostgREST assume tudo) ou ganha auth JWT + role
   não-privilegiado. **Recomendação: desaparece.** É um proxy redundante que existe
   em paralelo com o PostgREST, na mesma porta, e é a única razão pela qual o RLS não se aplica.

### Etapa 1 — Descoberta do protocolo (bloqueante, requer acesso)

Nada de sério se constrói sem isto:

- [ ] Confirmar host e porta reais do WebServer ARTSOFT para o contexto logístico
      (4200 do Hub Central? o 4219 do `.env.example` vem de onde?)
- [ ] Confirmar credenciais e se `encrypt`/`gzip` estão ligados neste servidor
- [ ] Capturar resposta real de `StkFch` (artigos) — validar `defcol` de logística:
      `Div.UnidLog`, `Logis.Uni`, peso, TI/HI, EAN
- [ ] **Determinar como se consulta stock por localização** — o Hub Central não o faz.
      `INFORMAÇÃO NÃO ENCONTRADA`, é preciso investigar no ARTSOFT.
- [ ] **Determinar se existe endpoint de escrita** (movimentos de stock, expedição).
      O Hub Central só lê e imprime. `INFORMAÇÃO NÃO ENCONTRADA`.
      Sem isto, o requisito "devolver eventos de stock ao ERP" (especificação §15.1) não tem solução.
- [ ] Guardar as respostas como *fixtures* anonimizadas → base dos testes de contrato

### Etapa 2 — Camada de protocolo

Portar `ArtsoftConnection` para Node com testes contra as fixtures da Etapa 1.
Critério de aceitação: dado o mesmo input, o XML produzido pelo Logistics Hub é
**byte-a-byte comparável** ao do Hub Central (ignorando indentação).

### Etapa 3 — Substituir os conectores especulativos

`rest.js` e `odbc.js` são apagados ou marcados como não suportados.
`file.js` mantém-se — é um fallback legítimo para exports CSV e o único dos três que
não inventa protocolo, só formato de ficheiro (e esse é verificável em minutos).

### Etapa 4 — Observabilidade e auditoria

Logging estruturado com correlationId, tabela de auditoria de sincronizações,
timeouts explícitos, taxonomia de erros, retry apenas em operações comprovadamente idempotentes.

### Etapa 5 — Testes

Prioridade: contrato XML → parsing → regras de negócio → erros → integração → regressão.

---

## H. Riscos que permanecem

| Risco | Severidade |
|---|---|
| Se as credenciais ARTSOFT não estiverem disponíveis, a Etapa 1 bloqueia e nada avança | Alta |
| Se o WebServer ARTSOFT logístico for uma instância diferente (porta 4219), o protocolo pode divergir do documentado | Média |
| Escrita de volta para o ERP não tem precedente conhecido no ecossistema — pode não ser suportada pelo WebServer | Alta |
| Segredos já estão no histórico Git; rotação é obrigatória, limpeza do histórico é recomendada | Alta |
| Frontend não compila no estado atual — âmbito de trabalho por avaliar | Média |

---

## I. Próximos passos imediatos

1. **Responder à Etapa 1** — sem acesso ao ARTSOFT real, o resto é especulação (o erro que já
   está no repositório).
2. **Rodar credenciais** — independente de tudo o resto, faz-se hoje.
3. **Decidir o destino do `server.js`** — remover ou proteger.

Só depois destes três se justifica escrever código de integração.
