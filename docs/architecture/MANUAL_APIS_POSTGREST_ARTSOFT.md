# Manual Técnico — Integrações PostgREST e ARTSOFT XmlQuery

**Âmbito real (correção de partida):** o pedido original referia a pasta `TICSOL_HUB_Central` como tendo `api/postgrestClient.js`, migrações 01–06, RLS por `empresa_id` e RPCs `gerar_sscc`/`calcular_paletizacao`. Essa pasta é o backend FastAPI/PostgreSQL do TICSOL HUB (sem PostgREST nem conector ARTSOFT). O código real descrito no pedido — `postgrestClient.js`, migrações `database/01_schema.sql`…`08_app_user_rls.sql`, RPCs `gerar_sscc`/`calcular_paletizacao`, conector Node.js do ARTSOFT — vive em **`C:\Users\TI\Desktop\TicSol_Logistics_Hub`**. É esse o repositório analisado abaixo. `Artsoft_ArtCmd_Hub` (Desktop) é apenas um vault Obsidian, sem código. Referências ao terceiro projeto (`artsoft-portal-b2b`) aparecem só na secção 7, como comparação, porque usa um protocolo ARTSOFT diferente (Digest+TCP na porta 4200/4333, não os conectores REST/ODBC/file especulativos do `.env` do `artsoft-sync`).

---

# PARTE 1 — API PostgREST (backend WMS)

## 1. Visão geral

- **Para que serve**: acesso direto do frontend React (`frontend/src/components/wms_recepcao/`, `wms_paletizacao/`) às tabelas do schema `logistics` em PostgreSQL, via PostgREST, sem passar por um backend Express intermédio.
- **Módulos consumidores**: `wms_recepcao` (receção de encomendas, lotes, movimentos) e `wms_paletizacao` (cálculo de paletização, SSCC, criação de paletes/caixas/etiquetas).
- **Protocolo**: HTTP REST, JSON. Não confundir com o Express de `server/server.js` (porta 3000), que expõe rotas próprias (`/rest/v1/:table`, `/rpc/:func`) com allowlists diferentes — ver nota crítica na secção 6.
- **Base URL**: `import.meta.env.VITE_API_URL || "http://localhost:3001"` (`frontend/src/components/wms_recepcao/api/postgrestClient.js:14`; idêntico em `wms_paletizacao/api/paletizacaoClient.js:8`). **Por confirmar**: nenhum `.env`/`.env.example` do repositório define `VITE_API_URL` — o fallback `3001` é o único valor real em uso, coerente com `postgrest.conf.example` (`server-port = 3001`), mas não com `postgrest.conf` "ativo" (`server-port = 3000`, que colide com a porta do Express).
- **Formato**: JSON REST puro (não XML).

## 2. Autenticação

- **Origem do JWT**: `getToken()` (`postgrestClient.js:16-20`) lê `localStorage.getItem("ticsol_jwt")`. O comentário do próprio ficheiro (linhas 1-12) assume isto como **provisório**: *"ajusta getToken() para ligar ao teu contexto de autenticação real"*. Claims esperadas no JWT: `role=authenticated`, `empresa_id`, `utilizador_id`, `perfil_id`.
- **Cabeçalhos enviados** (`postgrestClient.js:22-47`):
  - `Content-Type: application/json` — sempre.
  - `Authorization: Bearer <token>` — só se `getToken()` devolver valor não nulo. Sem token, o pedido segue sem `Authorization` e cai na role `db-anon-role` do PostgREST.
  - `Prefer: <valor>` — só quando o chamador o passa explicitamente (ex.: `return=minimal`, `return=representation`, `resolution=merge-duplicates`).
- **Efeito da RLS por `empresa_id`**: a RLS não é aplicada pelo cliente — é inteiramente do lado do Postgres. O PostgREST injeta o JWT decodificado no GUC `request.jwt.claims`; as policies chamam `logistics.jwt_empresa_id()` (`database/02_security.sql:49-56`):
  ```sql
  CREATE OR REPLACE FUNCTION logistics.jwt_empresa_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$
      SELECT (nullif(current_setting('request.jwt.claims', true), '')::json->>'empresa_id')::uuid
  $$;
  ```
  Se o token não tiver `empresa_id`, a policy filtra tudo (`empresa_id = NULL` nunca é verdadeiro) — o pedido não dá erro, devolve lista vazia. Isto significa que um bug no `getToken()` (token errado/expirado) não aparece como 401, aparece como "não há dados".

### ⚠️ Inconsistência de configuração confirmada
`postgrest.conf` (ficheiro "ativo") define `db-anon-role = "anon"`, mas o único role NOLOGIN criado em `database/02_security.sql:14` chama-se **`web_anon`**. Não existe role `anon` no SQL. Só `postgrest.conf.example` (`db-anon-role = "web_anon"`) está alinhado com o schema. **Por confirmar antes de correr o binário PostgREST em produção**: qual dos dois ficheiros de config está realmente a ser usado.

## 3. Construção do pedido

Função interna `request(method, path, {params, body, prefer})` (`postgrestClient.js:22-47`) é o único ponto de saída HTTP; todos os métodos do objeto `api` a chamam.

### Tabela de campos do pedido (função `request`)

| Campo | Tipo | Obrigatório? | Origem no código | Descrição |
|---|---|---|---|---|
| `method` | string | sim | argumento posicional | `GET`, `POST`, `PATCH` |
| `path` | string | sim | argumento posicional | recurso PostgREST (`/encomenda`, `/rpc/gerar_sscc`, etc.) |
| `params` | object | não | opção `request()` | vira query string (`select`, filtros PostgREST, `on_conflict`) |
| `body` | object | não (obrigatório em POST/PATCH) | opção `request()` | serializado com `JSON.stringify` |
| `prefer` | string | não | opção `request()` | valor literal do header `Prefer` |

### Roles e RPCs (`database/02_security.sql`, `database/03_functions_rpc.sql`)

| Role | Tipo | Privilégios | Ficheiro:linha |
|---|---|---|---|
| `web_anon` | NOLOGIN | só `USAGE` no schema, sem SELECT | `02_security.sql:14,23-26` |
| `authenticator` | LOGIN | membro de `web_anon` + `authenticated` | `02_security.sql:17-21` |
| `authenticated` | NOLOGIN | SELECT/INSERT/UPDATE/DELETE em todas as tabelas de `logistics` + EXECUTE em `gerar_sscc`/`calcular_paletizacao` | `02_security.sql:34-43,170-172` |
| `app_user` | LOGIN | SELECT/INSERT/UPDATE (sem DELETE, de propósito) | `08_app_user_rls.sql:9-19` |

RPCs expostas via `/rpc/<nome>`:

| RPC | Assinatura SQL | Endpoint | Body JSON |
|---|---|---|---|
| `gerar_sscc` | `logistics.gerar_sscc(p_empresa_id uuid) RETURNS varchar` | `POST /rpc/gerar_sscc` | `{ p_empresa_id: <uuid> }` |
| `calcular_paletizacao` | `logistics.calcular_paletizacao(p_produto_id uuid, p_quantidade numeric, p_fluxo fluxo_logistico, p_padrao padrao_palete DEFAULT 'mono_produto') RETURNS SETOF logistics.plano_paletizacao_linha` | `POST /rpc/calcular_paletizacao` | `{ p_produto_id, p_quantidade, p_fluxo, p_padrao }` |

`gerar_sscc` usa a tabela `logistics.sscc_sequencia (empresa_id uuid PK, ultimo_num bigint)` com `INSERT ... ON CONFLICT (empresa_id) DO UPDATE ... RETURNING ultimo_num` para gerar série sem colisões; gera prefixo de 7 dígitos derivado do UUID da empresa + série de 9 dígitos + dígito de controlo mod-10 GS1, devolvendo `varchar(18)`.

`calcular_paletizacao` devolve `SETOF logistics.plano_paletizacao_linha` (`numero_palete, caixas_nesta_palete, camadas, altura_estimada_mm, peso_estimado_kg, dentro_limites boolean, alertas text[]`), com limites físicos hard-coded (PBS: 1800mm/1000kg; PBL mono: 1800mm; PBL multi: 1500mm; PBL: 750kg) e `RAISE EXCEPTION` se o produto não existir ou `ti`/`hi` forem `NULL`.

### Endpoints usados pelo frontend

| Método objeto `api` | Endpoint | HTTP | Params / body |
|---|---|---|---|
| `listarEncomendasPendentes()` | `/encomenda` | GET | `select=*,fornecedor:fornecedor_id(nome,codigo_interno)`, `fornecedor_id=not.is.null`, `estado=in.(aberta,confirmada)`, `order=data_agendamento.asc` |
| `listarLinhas(encomendaId)` | `/linha_encomenda` | GET | `select=*,produto:produto_id(...)`, `encomenda_id=eq.<id>` |
| `listarLocalizacoesRececao()` | `/localizacao` | GET | `select=id,codigo,tipo`, `tipo=in.(cais,expedicao)`, `ativa=eq.true` |
| `criarLote(lote)` | `/lote` | POST | `on_conflict=produto_id,numero_lote`, `Prefer: return=representation,resolution=merge-duplicates` |
| `atualizarLinha(id, patch)` | `/linha_encomenda` | PATCH | `id=eq.<id>`, `Prefer: return=minimal` |
| `registarMovimento(mov)` | `/movimento` | POST | `Prefer: return=minimal` (ledger append-only, nunca editar depois) |
| `registarRejeicao(rej)` | `/rejeicao` | POST | `Prefer: return=minimal` |
| `concluirRecepcao(id)` | `/encomenda` | PATCH | `id=eq.<id>`, body `{estado:"recebida"}`, `Prefer: return=minimal` |
| `calcularPaletizacao(...)` | `/rpc/calcular_paletizacao` | POST | ver tabela de RPCs |
| `gerarSSCC(empresaId)` | `/rpc/gerar_sscc` | POST | `{ p_empresa_id: empresaId }` |
| `resolverRegra(clienteId, fluxo, categoria)` | `/regra_logistica` | GET | `or=(categoria_produto.is.null,categoria_produto.eq.<cat>)` ou `categoria_produto=is.null` |
| `criarPalete(palete)` | `/palete` | POST | `Prefer: return=representation` (sem `on_conflict`) |
| `criarCaixas(caixas)` | `/caixa` | POST | `Prefer: return=minimal` |
| `criarEtiqueta(etiqueta)` | `/etiqueta` | POST | `Prefer: return=minimal` |
| `marcarEmPreparacao(id)` | `/encomenda` | PATCH | `id=eq.<id>`, body `{estado:"em_preparacao"}` |

## 4. Exemplo real de pedido

Fluxo completo de receção de uma linha (`frontend/src/components/wms_recepcao/Reception.jsx:107-156`, código real):

```jsx
await api.registarRejeicao({
  empresa_id: encomendaAtiva.empresa_id,
  encomenda_id: encomendaAtiva.id,
  fornecedor_id: encomendaAtiva.fornecedor_id,
  motivo,
  descricao: `Linha ${linha.produto.sku_interno} rejeitada na receção da OC ${encomendaAtiva.numero_ordem_compra}`,
});

const lote = await api.criarLote({
  produto_id: linha.produto_id,
  numero_lote: valores.numero_lote,
  data_validade: linha.produto.controla_validade ? valores.data_validade || null : null,
  fornecedor_id: encomendaAtiva.fornecedor_id,
});
loteId = Array.isArray(lote) ? lote[0]?.id : lote?.id;

await api.atualizarLinha(linha.id, {
  quantidade_entregue: Number(valores.quantidade_entregue),
});

await api.registarMovimento({
  empresa_id: encomendaAtiva.empresa_id,
  tipo: "recepcao",
  produto_id: linha.produto_id,
  lote_id: loteId,
  quantidade: Number(valores.quantidade_entregue),
  localizacao_destino_id: localizacaoRececao,
});
```

`localizacaoRececao` vem de um `<select value={loc.id}>` (`Reception.jsx:242-254`) — o valor enviado é o **UUID** (`loc.id`), não o código textual (`loc.codigo`, só usado como label). Confirma que este caso-limite específico já está tratado corretamente.

Pedido HTTP correspondente a `criarLote` (reconstruído a partir do código de `request()`):

```http
POST /lote?on_conflict=produto_id,numero_lote HTTP/1.1
Host: localhost:3001
Content-Type: application/json
Authorization: Bearer <jwt>
Prefer: return=representation,resolution=merge-duplicates

{
  "produto_id": "5f2a...",
  "numero_lote": "L2026-0912",
  "data_validade": "2027-03-01",
  "fornecedor_id": "9c11..."
}
```

RPC `gerar_sscc`:

```http
POST /rpc/gerar_sscc HTTP/1.1
Host: localhost:3001
Content-Type: application/json
Authorization: Bearer <jwt>

{ "p_empresa_id": "11111111-1111-1111-1111-111111111111" }
```

## 5. Resposta / resultado obtido

- Corpo vazio (típico de `Prefer: return=minimal` em 201/204) → `request()` devolve `null` (`postgrestClient.js:44-46`: `if (!raw) return null`).
- Corpo não vazio → `JSON.parse(raw)`. **Não há try/catch** à volta deste parse — um corpo malformado propaga `SyntaxError` sem contexto de path/method/status (ao contrário do ramo de erro HTTP, que inclui isso).
- `criarLote` com `Prefer: return=representation` devolve array de objetos inseridos/atualizados (PostgREST standard); o código trata isso com `Array.isArray(lote) ? lote[0]?.id : lote?.id`.

Exemplo de resposta real esperada de `gerar_sscc` (baseado na assinatura SQL, formato PostgREST para RPC escalar):
```json
"376012345000000018"
```

Exemplo de resposta de `calcular_paletizacao` (SETOF, formato PostgREST devolve array de objetos):
```json
[
  {
    "numero_palete": 1,
    "caixas_nesta_palete": 40,
    "camadas": 5,
    "altura_estimada_mm": 1750,
    "peso_estimado_kg": 620.50,
    "dentro_limites": true,
    "alertas": []
  }
]
```
**Nota**: exemplo de resposta ilustrativo baseado no tipo `plano_paletizacao_linha`; não é um output capturado de execução real — por confirmar contra ambiente a correr.

## 6. Erros e casos limite

| Caso | Estado no código | Ficheiro:linha |
|---|---|---|
| Localização enviada como UUID vs texto | **Não é um bug** — verificado, `value={loc.id}` já envia UUID | `Reception.jsx:242-254` |
| Falta de `on_conflict` em upsert | Só `criarLote` usa `on_conflict`; todos os outros POSTs (`registarMovimento`, `registarRejeicao`, `criarPalete`, `criarCaixas`, `criarEtiqueta`) são inserções simples sem `on_conflict` — coerente por serem operações append-only, mas sem proteção contra duplicados acidentais | `postgrestClient.js:83-116` |
| Timeout/abort no fetch | **Não implementado** — sem `AbortController`/`signal` em nenhum dos clientes frontend; um pedido pendurado fica pendente indefinidamente no browser | `postgrestClient.js`, `paletizacaoClient.js` |
| Resposta malformada (JSON inválido) | `JSON.parse(raw)` sem try/catch — exceção genérica sem contexto | `postgrestClient.js:44-46` |
| Erro HTTP (4xx/5xx) | Tratado uniformemente: `throw new Error(\`PostgREST ${method} ${path} → ${res.status}: ${detail}\`)` — não distingue 401/403/409/422, o `message` inclui o JSON de erro do PostgREST como string crua | `postgrestClient.js:39-42` |
| `db-anon-role` referencia role inexistente | `postgrest.conf` aponta para `anon`, que não existe (só `web_anon`) | `postgrest.conf` vs `02_security.sql:14` |
| Duas tabelas de utilizador incompatíveis | `logistics.usuario` (INT, RLS via `current_setting('app.empresa_id')`) em `09_usuarios.sql` coexiste com `logistics.utilizador` (uuid, RLS via JWT) usada de facto pelo `server.js:346` — a primeira é legado confirmado como erro anterior pelo comentário de `12_utilizador_auth.sql` | `09_usuarios.sql` vs `12_utilizador_auth.sql` |
| Servidor Express alternativo com allowlist diferente | `server/server.js` expõe `/rest/v1/:table` e `/rpc/:func` próprios, com `ALLOWED_TABLES` que **não inclui** `encomenda`, `lote`, `movimento`, `palete`, etc., e `ALLOWED_FUNCTIONS = {sincronizar_guias, validar_documento}` que **não inclui** `gerar_sscc`/`calcular_paletizacao`. Apontar os clientes frontend para este servidor (porta 3000) em vez do PostgREST real (3001) causa 403 imediato | `server.js:168-182,253-285,287` |

## 7. Notas de integração / pendências

- `VITE_API_URL` nunca é definida em nenhum `.env` do repositório — depende do fallback hard-coded `http://localhost:3001`. **Por confirmar**: qual URL usar em staging/produção.
- Nenhum serviço `postgrest` está declarado em `docker-compose.yml` — o binário tem de correr à parte, lendo `postgrest.conf` (que, como referido, tem `db-anon-role` incorreto) ou `postgrest.conf.example` (correto).
- Autenticação real (ligar `getToken()` a um contexto de sessão real, em vez de `localStorage` direto) é uma pendência assumida explicitamente no comentário do próprio ficheiro fonte.

---

# PARTE 2 — Interface XmlQuery ARTSOFT

## 1. Visão geral

- **Para que serve**: sincronização periódica de dados mestre (produtos, terceiros, stock) e documentos (guias de transporte) do ERP ARTSOFT para as tabelas `logistics.*` do WMS.
- **Módulo consumidor**: `artsoft-sync/guias|produtos|terceiros|stock/`, invocado por `server/jobs/syncGuiasJob.js` (cron diário, default `0 2 * * *`) e por endpoints manuais em `server/server.js` (`/api/artsoft/{guias,produtos,terceiros,stock}/sync`).
- **Protocolo real e confirmado**: XmlQuery do ARTSOFT via **socket TCP cru** (não HTTP client de alto nível), com autenticação digest própria ligada à conexão. Implementado em `artsoft-sync/artsoft/connection.js`.
- **Existe uma segunda arquitetura no mesmo repositório, especulativa e não usada em produção**: `artsoft-sync/connectors/{rest,odbc,file}.js` + `index.js` + `lib/sync.js` + `lib/postgrestClient.js`. Os próprios comentários destes ficheiros admitem que os endpoints/tabelas/campos são "um ponto de partida plausível, não uma certeza" (`connectors/rest.js:5-10`) e "só o teu ARTSOFT sabe os nomes reais" (`connectors/odbc.js:11-16`). **Nunca são chamados por `server/` nem por `cli.js`** — são código órfão. Não confundir com a implementação real.
- **Base URL / porta**: implementação real confirmada contra ARTSOFT V26 em `192.168.1.120:4333` (`ARTSOFT_FIELD_PATHS_CONFIRMED.md:3`). A porta `4219` que aparece em `artsoft-sync/.env.example` pertence à arquitetura especulativa (`connectors/rest.js`) e nunca foi confirmada nem usada pelo protocolo real — os dois números nunca foram conciliados nos documentos do projeto.
- **Formato**: XML proprietário ARTSOFT (não é XML-RPC nem SOAP).

## 2. Autenticação

Não é OAuth nem Digest HTTP RFC 2617 — é um digest customizado **ligado à conexão TCP** (`artsoft-sync/artsoft/connection.js:4-13`, comentário crítico):

> "O challenge devolvido pelo GET /login está associado à CONEXÃO TCP. O GET /login e o POST seguinte DEVEM usar a mesma conexão TCP (Keep-Alive). Usar conexões separadas causa 401 inevitavelmente."

É por isto que a implementação usa `net.createConnection` cru em vez de `fetch()` — o `fetch()` do Node não garante reutilização do mesmo socket.

Fluxo (`connection.js:68-216`):
1. `GET /login` no socket, headers:
   ```
   Host: <host>:<porta>
   Connection: Keep-Alive
   Keep-Alive: 60
   Encoding: utf-8
   name: <utilizador>
   XMLIdent: 3
   ```
2. Servidor devolve challenge no header `digest:`.
3. Cálculo do digest (`calcularDigest()`, `connection.js:42-52`), SHA1 por omissão:
   ```
   ALGO( ALGO(user).digest + ALGO(pass).digest + ALGO(challenge).digest )
   ```
   concatenação dos digests **binários**, não das strings hexadecimais.
4. `POST /<endpoint>` **no mesmo socket**, headers:
   ```
   Host: <host>:<porta>
   Content-Type: text/xml; charset=utf-8
   Encoding: utf-8
   digest: <digest calculado>
   Connection: Close
   Content-Length: <n>
   ```
5. 401 → `ErroAutenticacaoArtsoft`; outros códigos ≠ 200/204 → `ErroConexaoArtsoft`.

Credenciais (`host`, `porta`, `utilizador`, opcionalmente `senha`) vêm de `logistics.configuracao` por `empresa_id`, lidas por `guias/sync.js:carregarConfiguracao()` (linhas 56-102) — falha explicitamente se `artsoft.host`/`artsoft.porta`/`artsoft.utilizador` estiverem em falta. A senha **prefere** `process.env.ARTSOFT_SENHA` antes de qualquer valor da BD (`guias/sync.js:90`).

Endpoint por omissão do POST: `Queries/Query` (`connection.js:74`).

## 3. Construção do pedido

### Estrutura do template XML (`artsoft-sync/artsoft/queryBuilder.js:6-16`, verificada em produção)

```xml
<?xml version='1.0' encoding='UTF-8'?>
<root type='list' end='50' name='Document' query='FILTRO'>
    <defcol>
        <Tag form='%Tabela.Grupo.Campo'/>
        <Sub type='list' name='lan' query='FILTRO_SUB'>
            <defcol> ... </defcol>
        </Sub>
    </defcol>
</root>
```

Linguagem de filtro:
- `Tabela|Filtro|Campo=min:max` — seleção/intervalo (obrigatório usar intervalo, não lista — ver secção 6).
- `^Tabela|Filtro|Campo={%Ref}` — join/correlação com o nível acima, sintaxe de join real usada entre `DocFch`/`TerFch`/`StkFch` via `NrCli`/`Filial`/`Codigo` (ver abaixo).
- `|#{token}` — paginação (com espaços ao redor, conforme aceite pelo WebServer).

Validação de cada linha do `defcol` (`queryBuilder.js`, função `construirDefcolLinhas()`):

| Regra | Descrição |
|---|---|
| `tag_xml` | tem de casar `/^[A-Za-z_][A-Za-z0-9_.\-]*$/` |
| `form_path` | não pode ser vazio; validado contra `/^[%$A-Za-z0-9_.*/+\-()\s{}%]+$/` |
| tags duplicadas | rejeitadas — "colapsam na resposta e perde-se um dos campos" |

**Por confirmar**: o padrão de validação inclui `$` (presumivelmente para funções como `$abs`), mas **não foi encontrado nenhum uso literal de `$DateDif`, `$IsGreat` ou `$abs`** em nenhum pedido real do repositório (`artsoft-sync/`, `e2e-artsoft/`) nem na documentação capturada em `ARTSOFT_XML_SERVICES_MEMORY.md`. Essa memória confirma explicitamente que o manual oficial tem apêndices sobre funções internas, mas não transcreve o seu conteúdo, e instrui a não inventar sintaxe — usar descoberta dinâmica via `ArtDB/_WSList`, `ArtDB/_DBTables`, `ArtDB/_tblDesc`, `ArtDB/fnList` antes de assumir uma função.

Também **não foi encontrado** nenhum uso de `<items query=... output='Required'>` nem `<totals>` em nenhum pedido real do projeto — estas estruturas mencionadas no pedido original não têm ocorrência confirmada no código lido.

### Join real confirmado entre tabelas via `NrCli`/`Filial` (`ARTSOFT_FIELD_PATHS_CONFIRMED.md:41-43`, implementado em `guias/sync.js:construirFiltroCabecalho()` linhas 155-164)

```
DocFch|DocData|TpDoc=<serieMin>:<serieMax>|Data=<AAAAMMDD>:<AAAAMMDD>
^TerFch|Cliente|NrCli={%DocFch.Ter.Terceiro}|Filial={%DocFch.Ter.Filial}
```

E para as linhas do documento (`guias/sync.js:construirPedidoGuias()` linhas 179-217):

```
DocLan|Document|TpDoc={%DocFch.Doc.Serie}|NrDoc={%DocFch.Doc.NrDoc}
^StkFch|Codigo={%DocLan.Cod.Codigo}
```

### Regras de campos (tipo/paths) confirmadas em produção (`ARTSOFT_FIELD_PATHS_CONFIRMED.md`)

- **Não existe grupo `Logis` em `DocFch`** — erro histórico já corrigido. Paths corretos:
  - Matrícula → `%DocFch.Inf.Matricula`
  - Peso/Volumes → `%DocFch.Log.*`
  - Moradas/datas de carga → `%DocFch.Doc.*`
- `TpDoc` é **intervalo obrigatório**, não lista — `DocFch|V980;V990` devolve `errcnt='1'`.
- `%StkFch.Nome.0` devolve a **família** do artigo ("COMERCIO GERAL"), não a descrição — a descrição correta vem de `%DocLan.Div.Descric`. Por isso o EAN é resolvido via `logistics.produto`, não confiando na resposta ARTSOFT.
- Séries reais confirmadas (2026): V960(FT), V961(NC), V962(ND), V980(FT — não é guia), **V990(GT — Guia de Transporte)**.

### Descoberta de schema (serviços genéricos ARTSOFT, `ARTSOFT_XML_SERVICES_MEMORY.md`)

`ArtDB/_WSList`, `ArtDB/_DBTables`, `ArtDB/_tblDesc`, `ArtDB/fnList` — serviços de introspeção a usar **antes** de inventar um `form`, campo ou função nova. Tipos de campo devolvidos por `_tblDesc`: `Str, Image, Sound, Date, Hour, Int, UInt, Num, Hexa, Bin, Bool`; prefixo `*` = campo virtual (não disponível em SQL); atributo `array` = campo repetido (ex.: `CDU.01` com `array="31"` gera `CDU.01`..`CDU.31`, refletido em `guias/parser.js:extractCDU()` linhas 202-216).

### Parsing (`artsoft-sync/artsoft/xml.js`)

- `fast-xml-parser` com `parseTagValue: false`, `parseAttributeValue: false` — nada é convertido automaticamente para número/booleano (um código `"0012"` mantém-se string; `"S"/"N"` mantêm-se strings).
- `validarEntrada()` rejeita `<!DOCTYPE`/`<!ENTITY` no prólogo antes de parsear (defesa XXE).
- `TAMANHO_MAXIMO_XML = 64 * 1024 * 1024`.
- `comoLista()` normaliza `<rec>` único vs array (o ARTSOFT devolve o elemento uma vez se há 1 registo, várias vezes se há mais).

## 4. Exemplo real de pedido

Envelope genérico de consulta, formato oficial confirmado (`ARTSOFT_XML_SERVICES_MEMORY.md:524-535`, manual XML Service):

```xml
<TBL type="list"
     name="SKU#1"
     end="xx"
     query="StkFch|Principal|Codigo=1:10199">

  <defcol>
    <Codigo form="%StkFch.Cod.Editado"/>
    <Nome form="%StkFch.Nome.0"/>
  </defcol>

</TBL>
```

Pedido real usado no projeto (`docs/DIAGNOSTICO_INTEGRACAO_ARTSOFT.md:140-146`, extraído do Hub Central com o mesmo padrão de query):

```xml
<?xml version='1.0' encoding='UTF-8'?>
<root type='list' end='500' name='rec' query='TerFch|Cliente|NrCli=1:99999|Filial=0:999'>
    <defcol>
        <Ter_Nome form='%TerFch.Ter.Nome'/>
    </defcol>
</root>
```

## 5. Resposta / resultado obtido

Formato genérico: `<root>...<rec>...campos...</rec>...</root>` (um `<rec>` por registo, ou o elemento repetido conforme o número de resultados).

### Caso especial documentado: erro `ErrVarNotFound`

Exemplo real e literal (`e2e-artsoft/docfch-response.xml`), da fase em que os paths `Logis.*` ainda estavam errados:

```xml
<?xml version="1.0" encoding="UTF-8" ?><root err="8">
XML error «ErrVarNotFound», node «/root/defcol/DataDocum» [%DocFch.Doc.DataDocum]
XML error «ErrVarNotFound», node «/root/defcol/TerNIF» [%DocFch.Ter.NIF]
XML error «ErrVarNotFound», node «/root/defcol/Matricula» [%DocFch.Logis.Matricula]
XML error «ErrVarNotFound», node «/root/defcol/EndCarga» [%DocFch.Logis.EndCarga]
XML error «ErrVarNotFound», node «/root/defcol/EndDescarga» [%DocFch.Logis.EndDescarga]
XML error «ErrVarNotFound», node «/root/defcol/Peso» [%DocFch.Logis.Peso]
XML error «ErrVarNotFound», node «/root/defcol/Volumes» [%DocFch.Logis.Volumes]
XML error «ErrVarNotFound», node «/root/defcol/DataHora» [%DocFch.Logis.DataHora]
</root>
```
Causa raiz confirmada: não existe grupo `Logis` em `DocFch` (paths corretos: `Inf.*`, `Doc.*`, `Log.*`, sem "is"). Este XML já **não** é mais reproduzível com o código atual (paths corrigidos), mas fica documentado como referência de diagnóstico.

## 6. Erros e casos limite

| Caso | Como é tratado | Ficheiro:linha |
|---|---|---|
| `ErrVarNotFound` (path de campo inválido) | Resposta `<root err="8">` com lista de mensagens; corrigido através de `ARTSOFT_FIELD_PATHS_CONFIRMED.md` | `e2e-artsoft/docfch-response.xml` |
| 401 por handshake em conexões separadas | Regra crítica — `GET /login` e `POST` seguinte têm de partilhar o mesmo socket TCP | `connection.js:4-13` |
| Timeout | Testado explicitamente com ARTSOFT offline (500-1000ms), mensagens esperadas `/HTTP\|timeout\|conexão/i` | `guias/test/sync.test.js:25,31-43` |
| XML malformado na paginação | Ciclo regista `estado: "erro_xml"` e para sem abortar tudo; fallback regex sobre XML bruto se o token não for extraível normalmente | `pagination.js:64-70,142-154` |
| Token de paginação repetido | Paragem explícita se `!novoToken \|\| novoToken === token`, evita loop infinito | `pagination.js:176-181` |
| Documento sem série/número | Erro por documento capturado individualmente; ciclo continua para os restantes documentos do lote | `guias/parser.js:71-76,263-274` |
| `TpDoc` como lista em vez de intervalo | `errcnt='1'` devolvido pelo ARTSOFT — `TpDoc` tem de ser intervalo | `ARTSOFT_FIELD_PATHS_CONFIRMED.md:40` |
| Data em formato ambíguo | Nota explícita "ambiguidade real, não resolvida" no Hub Central; aqui tornado configurável (`guias.formato_data`) | `config/series.js:116-124` |
| TpSAFT inválido | Documento rejeitado e logado se `TpSAFT` estiver fora da lista configurada; documento **sem** TpSAFT é aceite por omissão (recusar bloquearia importações legítimas) | `config/series.js:99-111` |
| Falha isolada numa etapa do job diário | Falha em produtos/terceiros/stock não aborta a sincronização de guias seguinte | `server/jobs/syncGuiasJob.js:137` |

## 7. Notas de integração / pendências

- **Por confirmar**: se a porta `4219` (arquitetura especulativa REST/ODBC em `artsoft-sync/connectors/`, nunca usada) corresponde à mesma instalação ARTSOFT da porta `4333` confirmada (arquitetura real). Os documentos do projeto nunca reconciliam os dois números.
- Sintaxe exata de `$DateDif`, `$IsGreat`, `$abs` — **não confirmado** em nenhuma fonte disponível; a memória `ARTSOFT_XML_SERVICES_MEMORY.md` reconhece explicitamente que não capturou o conteúdo desses apêndices do manual oficial.
- Código órfão da arquitetura especulativa (`connectors/{rest,odbc,file}.js`, `index.js`, `lib/sync.js`, `lib/postgrestClient.js`) permanece no repositório apesar de `docs/DIAGNOSTICO_INTEGRACAO_ARTSOFT.md` recomendar a sua remoção — nenhum commit confirma essa limpeza.
- Escrita de volta para o ARTSOFT (`DocFch/DocInsert`, `DocUpdate`) não está implementada em `artsoft-sync/` — diagnóstico marca isto como "informação não encontrada".
- **Comparação com `artsoft-portal-b2b` (projeto irmão, protocolo distinto)**: esse projeto (`C:\Users\TI\Desktop\artsoft-portal-b2b`, backend FastAPI) implementa o **mesmo tipo de digest ligado a TCP**, mas contra um endpoint diferente (`http://<host>:4200` por omissão, `backend/app/integrations/erp/artsoft/connection.py`), usando `POST /Queries/Query`, `POST /DocFch/DocPrices` e `POST /DocFch/DocInsert`. Esse projeto documenta explicitamente que a **resposta** de `DocFch/DocInsert` nunca foi validada contra o servidor real (`sync_service.py:2237-2254`: "tratar como melhor esforço até validar contra uma resposta real"), e protege a submissão de encomendas com um interruptor administrativo desligado por omissão (`service_adapter.py:284-332`). Não confirmado se `4200`/`4219`/`4333` são a mesma instalação ARTSOFT ou instâncias diferentes por cliente.
- `artsoft-portal-b2b` **não usa PostgREST** — acesso a Postgres é direto via SQLAlchemy/Alembic. Confirmado por grep exaustivo sem ocorrências de `postgrest`/`supabase` em todo o repositório.
