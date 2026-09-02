# Guias de Transporte via XML ARTSOFT — aplicação do padrão Obras C002

**Data:** 2026-09-02
**Revisão:** 2 — incorpora as respostas do utilizador às três perguntas bloqueantes
**Fase:** 1 — Análise e desenho (sem alterações de código)

**Origem:** ideia do utilizador — *"na análise de obra são feitos pedidos XML para trazer os
documentos e os lançamentos dos documentos; a ideia será no TicSol_Logistics_Hub as guias de
transporte serem trazidas para a plataforma utilizando o mesmo conceito"*

**Veredicto:** ideia sólida e abordagem correta. O padrão existe e está testado, o esquema de
destino já o acomoda, e as três perguntas bloqueantes estão respondidas. O âmbito ficou
**mais pequeno** do que se temia — ver §4.

---

## 0. Decisões fechadas (respostas do utilizador, revisão 2)

| # | Pergunta | Resposta | Consequência |
|---|---|---|---|
| 1 | Que séries são as guias? | **Varia de base de dados para base de dados.** Tem de haver zona de configuração — lista separada por `;`, ex. `V960;V980`. Confirmado que as séries de guia têm `%DocFch.Inf.TpSAFT ∈ {GR, GT, GA, GC, GD}` | Séries **nunca** hardcoded. Tabela de configuração + validação por TpSAFT. Ver §3 |
| 2 | Âmbito: instrução logística ou guia legal completa? | **Apenas conteúdo do documento** — cabeçalho + respetivos lançamentos. Para visualização/impressão, usar pedido que devolve o documento em **base64** | Nada de reconstruir ATCUD/QR/obrigações legais em dados estruturados. O PDF do ARTSOFT resolve. **Simplificação grande.** Ver §5 |
| 3 | Onde vivem matrícula, moradas, volumes? | Matrícula e moradas **existem em campos específicos do DocFch** — a confirmar quais. Volumes possivelmente em CDU. Ajustar em fase de testes reais | O `defcol` tem de ser **configurável**, não compilado. Ajuste sem alteração de código. Ver §6 |

A resposta 3 é a que mais influencia a arquitetura: sabendo à partida que os caminhos dos campos
vão mudar durante os testes, seria erro cozê-los em JavaScript.

---

## 1. O que o mecanismo C002 faz (verificado no código)

`obras_c002_sync_service.py` faz **um único pedido XML** que traz, de uma vez:

- o **cabeçalho** do documento (`DocFch`)
- os **lançamentos/linhas** (`DocLan`), aninhados dentro de cada documento
- a **ficha de artigo** de cada linha (`StkFch`), via join
- o **custo por armazém** de cada artigo (`StkVal`), aninhado dentro da linha
- os dados do **terceiro** (`TerFch`), via join no cabeçalho

Tudo numa só ida ao WebServer, por página.

### Query filter (nível cabeçalho)

```
DocFch|DocData|TpDoc=C002|Data={dd/mm/aaaa}:{dd/mm/aaaa}
  ^TerFch|Cliente|NrCli={%DocFch.Ter.Terceiro}|Filial={%DocFch.Ter.Filial}
```

- `^` = join com outra tabela
- `{%Tabela.Grupo.Campo}` = correlação com o registo atual do nível acima
- `|#{token}` acrescentado ao filtro para a página seguinte

### Aninhamento (nível linha)

```xml
<Lans type='list' name='lan'
      query='DocLan|Document|TpDoc={%DocFch.Doc.Serie}|NrDoc={%DocFch.Doc.NrDoc}
             ^ StkFch|Principal|Codigo={%DocLan.Cod.Codigo}'>
  <defcol>
    <Artigo form='%DocLan.Cod.Codigo'/>
    <Qtd    form='%DocLan.Qtd.Movim'/>
    <Unid   form='%StkFch.Logis.Uni'/>
    <Lans_C type='list' name='custo'
            query='StkVal|Armazens|AI_Art={%StkFch.Div.NrReg}|NrArm=1'>
      <defcol><Ultimo_Custo form='%StkVal.Prc.UPCusto'/></defcol>
    </Lans_C>
  </defcol>
</Lans>
```

**Três níveis de aninhamento, um round-trip.** É esta a peça reutilizável.

### Envelope

```xml
<?xml version='1.0' encoding='UTF-8'?>
<root type='list' end='{page_size}' name='Document' query='{query_filter}'>
    <defcol> … </defcol>
</root>
```

### Ciclo completo

```
_build_query_filter_*  → constrói o filtro (por data ou por nº)
_build_defcol          → colunas + subconsultas aninhadas
_build_xml_request     → envelope <root>
ArtsoftConnection      → GET /login + POST Queries/Query (mesma ligação TCP)
parse_obras_c002_*     → XML → dicionários (defusedxml)
_extract_next_token    → token da página seguinte ('0'/'' = fim)
loop até              → sem token, token repetido, sem registos, ou max_pages
dedup por             → doc_id_artsoft (Doc.ID, ou Serie-NrDoc-Data como fallback)
```

---

## 2. Transposição para guias de transporte

**Só muda o `TpDoc` e o `defcol`.** Esqueleto idêntico.

```
DocFch|DocData|TpDoc={SERIE}|Data={di}:{df}
  ^TerFch|Cliente|NrCli={%DocFch.Ter.Terceiro}|Filial={%DocFch.Ter.Filial}
```

Com várias séries configuradas (`V960;V980`), há duas hipóteses de execução, a decidir com
dados reais:

- **A** — um pedido por série, em sequência (previsível, mais round-trips)
- **B** — intervalo `TpDoc=V960:V980` num só pedido (menos round-trips, mas apanha séries
  intermédias não configuradas — só serve se as séries forem contíguas)

**Recomendação: A.** Determinista, e o custo extra é irrelevante para o volume esperado.
Filtrar sempre por `Inf.TpSAFT ∈ {GR,GT,GA,GC,GD}` na resposta, como rede de segurança
contra uma série mal configurada.

### Campos confirmados (em uso em produção no Hub Central)

| Finalidade | Caminho ARTSOFT |
|---|---|
| Série | `%DocFch.Doc.Serie` |
| Número | `%DocFch.Doc.NrDoc` |
| **ID único (`SERIE/NR`)** | `%DocFch.Doc.ID` ← **chave para o PDF, ver §5** |
| Data do documento | `%DocFch.Data.Docum` |
| Tipo SAF-T | `%DocFch.Inf.TpSAFT` |
| Observações | `%DocFch.Doc.Obs` |
| Pedido de origem | `%DocFch.Doc.Pedido` |
| Nº terceiro / filial | `%DocFch.Ter.Terceiro` / `%DocFch.Ter.Filial` |
| Nome / NIF do terceiro | `%TerFch.Ter.Nome` / `%TerFch.Ter.NIF` |
| Morada / localidade / CP | `%TerFch.Ter.Morada` / `Ter.Localid` / `Ter.CPPais` |
| Código do artigo | `%DocLan.Cod.Codigo` |
| Descrição do artigo | `%StkFch.Nome.0` |
| Quantidade movimentada | `%DocLan.Qtd.Movim` |
| Unidade logística | `%StkFch.Logis.Uni` |
| Nº lançamento / linha | `%DocLan.Doc.NrLan` / `%DocLan.Doc.NrLin` |
| Observação de linha | `%DocLan.Div.Obs` |
| Registo interno do artigo | `%StkFch.Div.NrReg` |
| Campos do utilizador | `%DocFch.CDU.01`…`CDU.11` + `CDUNm.01`…`11` (rótulos) |

### Campos por confirmar (resposta 3)

| Campo | Estado | Nota |
|---|---|---|
| Matrícula | Existe campo específico em `DocFch` — caminho a confirmar | Utilizador confirma |
| Morada de carga | Existe campo específico em `DocFch` — caminho a confirmar | Utilizador confirma |
| Morada de descarga | Existe campo específico em `DocFch` — caminho a confirmar | Utilizador confirma |
| Volumes | Possivelmente CDU | Incluir `CDUNm.01`…`11` no primeiro `defcol` de teste revela os rótulos |
| Peso | Não determinado | Provável em `StkFch`, grupo `Logis` |
| Data/hora de carga | Não determinado | — |

Todos estes entram por **configuração**, não por código. Ver §6.

---

## 3. Zona de configuração (resposta 1)

Espelha o padrão já provado no Hub Central: `config.configuracao`, chave
`documentos.documentos_a`, valores separados por `;`, parseados por
`_parse_documentos_associados_tipos` (`artsoft_client.py:106-126`).

### DDL proposto

```sql
CREATE TABLE logistics.configuracao (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id   uuid NOT NULL REFERENCES logistics.empresa(id),
    chave        varchar(120) NOT NULL,
    valor        text,
    descricao    text,
    updated_at   timestamptz NOT NULL DEFAULT now(),
    updated_by   varchar(100),
    UNIQUE (empresa_id, chave)
);
ALTER TABLE logistics.configuracao ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolamento_empresa ON logistics.configuracao
    USING (empresa_id = (current_setting('request.jwt.claims', true)::json->>'empresa_id')::uuid);
```

`empresa_id` na chave única é deliberado: séries variam por base de dados **e** por empresa.

### Chaves iniciais

| Chave | Exemplo | Significado |
|---|---|---|
| `guias.series` | `V960;V980` | Séries a importar, separadas por `;` |
| `guias.tpsaft_validos` | `GR;GT;GA;GC;GD` | Filtro de segurança sobre `Inf.TpSAFT` |
| `guias.page_size` | `50` | Registos por página |
| `guias.max_pages` | `300` | Limite de segurança do ciclo de paginação |
| `artsoft.host` | — | Host do WebServer |
| `artsoft.porta` | `4200` | Porta |
| `artsoft.utilizador` | — | Utilizador |
| `artsoft.timeout` | `60` | Timeout em segundos |

**A password nunca vai para esta tabela em claro.** Segredo em variável de ambiente ou gestor
de segredos — ver o alerta de segurança do `DIAGNOSTICO_INTEGRACAO_ARTSOFT.md`, que continua
por resolver.

### Regras de parsing (portadas de `_parse_documentos_associados_tipos`)

- separar por `;`
- `trim` a cada parte
- `upper()`
- descartar vazios
- descartar duplicados preservando a ordem
- normalizar `V96` → `V960`? **Não.** `_normalize_document_type` faz `prefixo + 3 dígitos`
  (`artsoft_client.py:172-181`); confirmar se se aplica às séries de guia antes de portar.
  Até lá, usar o valor tal como configurado.

---

## 4. Âmbito (resposta 2) — o que muda

Confirmado: **cabeçalho + lançamentos como dados estruturados. Nada mais.**

Fica **fora** de âmbito, e é uma simplificação considerável:

- ❌ ATCUD / código QR
- ❌ Comunicação à AT
- ❌ Reconstrução de layout da guia
- ❌ Campos legais obrigatórios como colunas estruturadas

A visualização e a impressão resolvem-se com o PDF que o próprio ARTSOFT gera (§5). Não é
preciso reproduzir o documento — basta pedi-lo.

Os campos da resposta 3 (matrícula, moradas, volumes) continuam úteis como **dados
operacionais** — para associar a guia a uma `carga`/`viatura` no WMS — mas deixam de ser
requisito de conformidade legal. Se um deles não for encontrado, degrada a funcionalidade;
não invalida a guia.

---

## 5. Visualização e impressão via base64 (resposta 2)

**Já está implementado no Hub Central.** `preview_documento()`
(`artsoft_sync_service.py:1969-2078`) — reaproveitamento direto, não é preciso desenhar nada.

### Fluxo

```
doc_id = "V960/240123"           ← vem de %DocFch.Doc.ID na importação
serie  = doc_id.split("/")[0]    ← "V960"

1. POST DocFch/CfgDocum
   <?xml version='1.0' encoding='UTF-8'?>
   <table type='V960' fields='DocID,FmtDoc,FmtArq,FormProvis,FormPortas0' name='T'/>
   → devolve <rec FmtDoc="Docum\Doc-Custom.lst;Docum\Doc-A4.lst:Genérico" …>
     FmtDoc: formulários separados por ';', descrição opcional após ':'

2. Para cada formulário, em ordem:
   POST DocFch/DocPrintEx
   <DocID='V960/240123' form='Docum\Doc-A4.lst' arquivo='S'/>
   → <base64>…</base64>   = PDF

3. Fallbacks standard se todos os da série falharem:
   Docum\Doc-A4.lst
   Docum\Doc.lst

4. base64 → bytes → PDF
```

### Classificação da resposta (`_classify_print_response`)

| Resultado | Condição | Ação |
|---|---|---|
| `ok` | existe `<base64>` com conteúdo | decodificar, devolver PDF |
| `doc_not_found` | `rc='DBKeyNotFound'` | **abortar** — documento não existe neste WebServer/ano; trocar de formulário não ajuda |
| `form_error` | `rc` começa por `ERRO`/`Erro`, ou não há `<base64>` | tentar formulário seguinte |

A distinção entre `doc_not_found` e `form_error` é subtil e importante — poupa dezenas de
pedidos inúteis. Portar tal e qual.

### Consequência para o esquema

Guardar `%DocFch.Doc.ID` na importação é **obrigatório** — é a chave que alimenta o
`DocPrintEx` mais tarde. Sem ela, não há PDF.

O PDF **não se guarda** na base de dados: pede-se a pedido, com cache curta se necessário.
Fica sempre coerente com o ARTSOFT e não incha o armazenamento.

---

## 6. `defcol` configurável (resposta 3)

Como os caminhos dos campos vão ser confirmados durante os testes reais, compilá-los em
JavaScript significaria uma alteração de código + redeploy por cada ajuste. Errado.

O Hub Central já resolveu isto: `config.pedidos_xml` guarda **templates XML versionados em
base de dados**, com histórico de alterações (`pedidos_xml_historico`) e registo de execuções
(`auditoria.pedidos_xml_execucoes`). O `render_query_xml()` substitui `{{placeholders}}`
(`pedidos_xml/service.py:364-369`).

### Proposta para o Logistics Hub

```sql
CREATE TABLE logistics.mapeamento_campo (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  uuid NOT NULL REFERENCES logistics.empresa(id),
    contexto    varchar(50)  NOT NULL,   -- 'guia_cabecalho' | 'guia_linha'
    campo       varchar(60)  NOT NULL,   -- 'matricula', 'morada_descarga', 'volumes'
    tag_xml     varchar(60)  NOT NULL,   -- nome do elemento no defcol
    form_path   varchar(120) NOT NULL,   -- '%DocFch.???'  ← ajustável em testes
    obrigatorio boolean NOT NULL DEFAULT false,
    ativo       boolean NOT NULL DEFAULT true,
    ordem       integer,
    UNIQUE (empresa_id, contexto, campo)
);
```

O `defcol` passa a ser **gerado** a partir desta tabela. Confirmar que a matrícula está em
`%DocFch.Xxx.Yyy` torna-se um `UPDATE` de uma linha, e o pedido seguinte já a traz.

Campos base (os confirmados da §2) entram como *seed*; os por confirmar entram com
`ativo=false` e `form_path` vazio, ligando-se quando forem conhecidos.

> Compromisso assumido: mais uma indireção do que hardcoded. Justifica-se **porque o
> utilizador declarou explicitamente que estes caminhos vão mudar em testes reais**. Sem esse
> facto, seria complexidade desnecessária. Não estender este padrão a campos estáveis.

---

## 7. Mapeamento para o esquema do Logistics Hub

**As tabelas de destino já existem.**

```
ARTSOFT DocFch (guia)  ──→  logistics.documento
  Doc.Serie + Doc.NrDoc         numero              (chave natural)
  Doc.ID                        origem_doc_id       ← NOVO, chave do PDF
  Inf.TpSAFT                    tipo                (guia_transporte | guia_remessa)
  Data.Docum                    data_emissao
  Ter.Terceiro → TerFch         cliente_id / fornecedor_id
  Doc.Pedido                    encomenda_id        (resolução por confirmar)
                                carga_id            (associação a carga)

ARTSOFT DocLan (linhas) ──→  logistics.linha_documento   ← NOVA TABELA
  Cod.Codigo → StkFch           produto_id          (via produto.sku_interno)
  Qtd.Movim                     quantidade
  StkFch.Logis.Uni              unidade
  Doc.NrLan / Doc.NrLin         nr_lancamento / nr_linha

campos DocFch por confirmar ──→  logistics.viatura.matricula
                                 logistics.carga (moradas, data/hora)
```

Já definido no `01_schema.sql`:

```sql
CREATE TYPE tipo_documento AS ENUM (
    'ordem_compra', 'guia_remessa', 'guia_transporte', 'fatura',
    'desadv', 'packing_list', 'nota_recepcao', 'ref',
    'documento_produtor_agricola'
);
```

E a chave de idempotência:

```sql
UNIQUE (empresa_id, tipo, numero)
```

Um `upsert` por esta chave é naturalmente idempotente — reimportar a mesma guia dez vezes
produz uma linha. Resolve o risco de duplicação por retry sem trabalho adicional.

### Alterações de esquema necessárias

```sql
-- 1. linhas de documento (não existe hoje — lacuna)
CREATE TABLE logistics.linha_documento (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id     uuid NOT NULL REFERENCES logistics.empresa(id),
    documento_id   uuid NOT NULL REFERENCES logistics.documento(id) ON DELETE CASCADE,
    nr_linha       integer NOT NULL,
    nr_lancamento  integer,
    produto_id     uuid REFERENCES logistics.produto(id),
    artigo_codigo  varchar(60) NOT NULL,   -- preservar sempre o código do ARTSOFT
    descricao      text,
    quantidade     numeric(14,3),
    unidade        varchar(20),
    observacoes    text,
    UNIQUE (documento_id, nr_linha)
);

-- 2. rastreio de origem no cabeçalho
ALTER TABLE logistics.documento ADD COLUMN origem_serie     varchar(20);
ALTER TABLE logistics.documento ADD COLUMN origem_doc_id    varchar(60);
ALTER TABLE logistics.documento ADD COLUMN origem_tpsaft    varchar(10);
ALTER TABLE logistics.documento ADD COLUMN sincronizado_em  timestamptz;
```

`artigo_codigo` guarda-se sempre, mesmo quando `produto_id` resolve. Uma guia com um artigo
ainda não sincronizado tem de entrar na mesma — perder a linha seria pior do que ter uma
referência por resolver.

---

## 8. Direção do fluxo

Guias **trazidas** para a plataforma: ARTSOFT → Logistics Hub. Leitura pura.

| | Ler (ARTSOFT → Hub) | Escrever (Hub → ARTSOFT) |
|---|---|---|
| Protocolo conhecido? | ✅ Sim, testado em produção | ⚠️ Parcial |
| Endpoint | `Queries/Query`, `DocFch/CfgDocum`, `DocFch/DocPrintEx` | ❌ **NÃO DETERMINADO** |
| Formato | `<root type='list' …><defcol>` | ✅ Conhecido: `<document entityID='C:2838' retID='S' status='S' trans='S'><docheader>…<docitems><rec>…` (`importado/service.py:296-329`) |
| Implementado | Sim | **Não** — `ImportadoService.sync()` gera o XML e guarda-o em histórico na memória, nunca o envia |

Os únicos três endpoints ARTSOFT em uso em todo o ecossistema são `Queries/Query`,
`DocFch/CfgDocum` e `DocFch/DocPrintEx`. **Nenhum escreve.**

A funcionalidade pedida é só de leitura → não bloqueada. Fica registado para o requisito
inverso (§15.1 da especificação WMS: devolver eventos de stock e expedição ao ERP) — esse sim
está bloqueado.

---

## 9. Estrutura a construir

Pressupõe a camada de protocolo da Etapa 2 do diagnóstico (porte de `ArtsoftConnection` para
Node com ligação TCP partilhada entre `GET /login` e `POST`). **Nada funciona sem essa peça.**

```
artsoft-sync/
├── artsoft/
│   ├── connection.js          (Etapa 2 — pré-requisito, sem substituto)
│   ├── queryBuilder.js        ← envelope <root> + defcol + subconsultas aninhadas
│   └── pagination.js          ← ciclo de token (porte de _extract_next_token,
│                                 incluindo '0' = fim)
├── config/
│   ├── configuracao.js        ← leitura de logistics.configuracao
│   ├── series.js              ← parsing 'V960;V980' (porte das regras da §3)
│   └── mapeamento.js          ← defcol gerado de logistics.mapeamento_campo
├── guias/
│   ├── query.js               ← filtro DocFch|DocData|TpDoc=…|Data=… ^TerFch
│   ├── parser.js              ← XML → {guia, linhas[]} (modelo: obras_c002_parser.py)
│   ├── mapper.js              ← → documento + linha_documento
│   └── preview.js             ← CfgDocum + DocPrintEx → PDF (porte de preview_documento)
└── discovery/
    └── documentTypes.js       ← DocFch/CfgDocum <root/> → enumerar séries disponíveis
                                  (alimenta o ecrã de configuração)
```

O `discovery/documentTypes.js` merece destaque: permite que o ecrã de configuração das séries
apresente uma **lista escolhida do próprio ARTSOFT**, em vez de uma caixa de texto onde se
escreve `V960;V980` à mão e se descobre o erro de escrita três dias depois.

---

## 10. Erros do C002 a não repetir

| Problema no C002 | Correção |
|---|---|
| Abre ligação ARTSOFT nova a **cada página** (`obras_c002_sync_service.py:162`) | Reutilizar dentro do ciclo, respeitando login+POST por pedido |
| **Sem retry** — falha na página 7 de 300 perde tudo | Retry com backoff; leitura é idempotente, é seguro |
| Filtro de datas sem validação de intervalo | Validar `di <= df`, limitar a janela |
| `max_pages=300` é limite silencioso — atingi-lo parece sucesso | Aviso explícito + marcar sincronização como incompleta |
| Deduplicação só em memória, por execução | Deduplicação na BD pela chave natural (o `UNIQUE` já garante) |
| Sem registo do que foi trazido | Auditoria por execução (modelo: `auditoria.pedidos_xml_execucoes`) |
| Séries hardcoded (`TpDoc=C002`) | Configuração — é precisamente a resposta 1 |

---

## 11. Estado das perguntas

| # | Estado |
|---|---|
| 1. Séries | ✅ **Resolvido** — configuração por `;`, validação por TpSAFT |
| 2. Âmbito | ✅ **Resolvido** — cabeçalho + lançamentos; visualização por PDF base64 |
| 3. Matrícula/moradas/volumes | 🟡 **Diferido por desenho** — `defcol` configurável absorve o ajuste sem alteração de código |
| 4. Guias de entrada, saída, ou ambas? | ⬜ Aberto — decisão de desenho |
| 5. Sincronização periódica ou a pedido? | ⬜ Aberto — o C002 suporta ambas (`fetch_obras_por_data`, `fetch_obra_por_nr`) |
| 6. Guia importada cria `carga` automaticamente? | ⬜ Aberto |
| 7. **Acesso ao ARTSOFT (host/porta/credenciais)** | 🔴 **Bloqueante para validação** |

As perguntas 4–6 não bloqueiam o arranque: afetam a orquestração, não o protocolo nem o
mapeamento.

---

## 12. Conclusão

As três respostas fecharam o desenho e **reduziram** o âmbito:

- séries por configuração, com descoberta a partir do próprio ARTSOFT
- sem obrigações legais estruturadas — o PDF do ARTSOFT trata da visualização, e o mecanismo
  já existe pronto a portar
- caminhos de campos incertos absorvidos por configuração em vez de código

Continua a faltar **uma coisa só**: acesso ao ARTSOFT real. Sem ele não se valida nada
contra o sistema de destino.

**Mas há trabalho útil e verificável que não depende desse acesso:**

1. `logistics.configuracao` + `logistics.mapeamento_campo` + `linha_documento` (DDL e migração)
2. `queryBuilder.js` — geração do `defcol` e do envelope, testável por comparação com o XML
   que o C002 produz hoje
3. `parser.js` e `pagination.js` — testáveis contra fixtures sintéticas construídas a partir da
   estrutura de resposta conhecida
4. `series.js` — parsing de `V960;V980`, testável isoladamente

O que **não** se pode fazer sem acesso é validar `connection.js` (o handshake digest só se
prova contra o servidor real) e confirmar os caminhos dos campos da resposta 3.

**Recomendação:** arrancar por 1–4 com testes, e deixar a ligação real como primeiro passo
assim que houver credenciais.
