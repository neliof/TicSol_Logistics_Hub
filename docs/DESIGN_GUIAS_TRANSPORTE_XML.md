# Guias de Transporte via XML ARTSOFT — aplicação do padrão Obras C002

**Data:** 2026-09-02
**Fase:** 1 — Análise e desenho (sem alterações de código)
**Origem:** ideia do utilizador — *"na análise de obra são feitos pedidos XML para trazer os
documentos e os lançamentos dos documentos; a ideia será no TicSol_Logistics_Hub as guias de
transporte serem trazidas para a plataforma utilizando o mesmo conceito"*

**Veredicto:** a ideia é sólida e é a abordagem certa. O padrão existe, está testado, e o
esquema de destino no Logistics Hub já está desenhado para o receber. O que falta é
determinação de dados reais — não arquitetura.

---

## 1. O que o mecanismo C002 faz (verificado no código)

`obras_c002_sync_service.py` faz **um único pedido XML** que traz, de uma vez:

- o **cabeçalho** do documento (`DocFch`)
- os **lançamentos/linhas** (`DocLan`), aninhados dentro de cada documento
- a **ficha de artigo** de cada linha (`StkFch`), via join
- o **custo por armazém** de cada artigo (`StkVal`), aninhado dentro da linha
- os dados do **terceiro** (`TerFch`), via join no cabeçalho

Tudo isto numa só ida ao WebServer, por página.

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

**Só muda o `TpDoc` e o `defcol`.** O esqueleto — envelope, join ao terceiro, aninhamento
de linhas, paginação por token, deduplicação — é idêntico.

```
DocFch|DocData|TpDoc={SERIE_GUIA}|Data={di}:{df}
  ^TerFch|Cliente|NrCli={%DocFch.Ter.Terceiro}|Filial={%DocFch.Ter.Filial}
```

### Campos confirmados (existem, verificados em produção no Hub Central)

| Finalidade logística | Caminho ARTSOFT | Confiança |
|---|---|---|
| Série do documento | `%DocFch.Doc.Serie` | ✅ Confirmado |
| Número do documento | `%DocFch.Doc.NrDoc` | ✅ Confirmado |
| ID único do documento | `%DocFch.Doc.ID` | ✅ Confirmado |
| Data do documento | `%DocFch.Data.Docum` | ✅ Confirmado |
| Tipo SAF-T (GR/GT/GA/GC/GD) | `%DocFch.Inf.TpSAFT` | ✅ Confirmado |
| Observações | `%DocFch.Doc.Obs` | ✅ Confirmado |
| Pedido de origem | `%DocFch.Doc.Pedido` | ✅ Confirmado |
| Nº terceiro / filial | `%DocFch.Ter.Terceiro` / `%DocFch.Ter.Filial` | ✅ Confirmado |
| Nome do terceiro | `%TerFch.Ter.Nome` | ✅ Confirmado |
| NIF do terceiro | `%TerFch.Ter.NIF` | ✅ Confirmado |
| Morada do terceiro | `%TerFch.Ter.Morada` | ✅ Confirmado |
| Localidade / Cód. postal | `%TerFch.Ter.Localid` / `%TerFch.Ter.CPPais` | ✅ Confirmado |
| Código do artigo (linha) | `%DocLan.Cod.Codigo` | ✅ Confirmado |
| Descrição do artigo | `%StkFch.Nome.0` | ✅ Confirmado |
| Quantidade movimentada | `%DocLan.Qtd.Movim` | ✅ Confirmado |
| Unidade logística | `%StkFch.Logis.Uni` | ✅ Confirmado |
| Nº de lançamento / linha | `%DocLan.Doc.NrLan` / `%DocLan.Doc.NrLin` | ✅ Confirmado |
| Observação de linha | `%DocLan.Div.Obs` | ✅ Confirmado |
| Registo interno do artigo | `%StkFch.Div.NrReg` | ✅ Confirmado |
| Campos definidos pelo utilizador | `%DocFch.CDU.01` … `CDU.11` (+ `CDUNm.01`…`11` para o rótulo) | ✅ Confirmado |

### Campos NÃO DETERMINADOS (necessários para guia de transporte)

Isto é o que uma guia de transporte precisa e que **não existe no `defcol` do C002** — o C002
é um documento financeiro, não de expedição. Nenhum destes deve ser inventado.

| Necessário | Estado | Onde investigar |
|---|---|---|
| Matrícula da viatura | ❌ NÃO DETERMINADO | Hipótese: num `CDU_xx` do cabeçalho. **Precedente:** o preset `mao_de_obra` (`importado/service.py:232`) usa `CDULan.03` como "Matricula" ao **nível de linha**. Ler `CDUNm.01`…`11` de uma guia real revela os rótulos configurados. |
| Local/morada de carga | ❌ NÃO DETERMINADO | Ver `CDUNm_xx`; ou grupo `%DocFch.Loc.*` / `%DocFch.Mor.*` (existência por confirmar) |
| Local/morada de descarga | ❌ NÃO DETERMINADO | Idem |
| Data/hora de carga | ❌ NÃO DETERMINADO | `%DocFch.Data.*` tem `Docum`, `Limit`, `Vencim`, `MesDocum`, `AnoDocum` — nenhum é hora de carga |
| Nº de volumes / paletes | ❌ NÃO DETERMINADO | Possivelmente CDU ou campo de linha |
| Peso bruto / líquido | ❌ NÃO DETERMINADO | Provável em `StkFch` (grupo `Logis`?) mas o caminho exato não está em uso no Hub Central |
| EAN13 / GTIN da caixa | ❌ NÃO DETERMINADO | `StkFch` tem `Cod.Codigo` e `Div.ClassSAFT`; caminho do EAN não está em uso |
| Código ATCUD / QR | ❌ NÃO DETERMINADO | Obrigatório em guias PT desde 2022 — confirmar se o WebServer o expõe |
| Transportadora | ❌ NÃO DETERMINADO | Pode ser o próprio terceiro, um CDU, ou não existir |

> ⚠️ Nota importante: **uma guia de transporte em Portugal tem obrigações legais** (ATCUD,
> local e data/hora de carga e descarga, matrícula, comunicação à AT). Se o objetivo incluir
> reproduzir ou reimprimir a guia, e não apenas usá-la como instrução logística, estes campos
> deixam de ser opcionais. Vale a pena esclarecer o âmbito antes de construir.

### Como descobrir a série (`TpDoc`) — sem adivinhar

Existem **dois mecanismos já implementados** no Hub Central. Nenhum requer suposições:

1. **Enumerar do próprio ARTSOFT**
   `fetch_cfgdocum_document_types()` → `POST DocFch/CfgDocum` com corpo `<root/>`
   devolve todos os tipos de documento configurados. (`_parse_cfgdocum_ids` filtra os que
   começam por `V`; para guias, remover esse filtro.)

2. **Ler da configuração já existente**
   `config.configuracao`, chaves `documentos.documentos_a` … `documentos_e`
   (valores separados por `;`). O grupo **A** está rotulado **"Guias"**
   (`obras/service.py:393`, `export_service.py:697`).

3. **Confirmar pelo SAF-T** — filtrar/validar por `%DocFch.Inf.TpSAFT` ∈ {GR, GT, GA, GC, GD}
   garante que o documento é mesmo movimento de mercadorias, e não uma fatura.

---

## 3. Mapeamento para o esquema do Logistics Hub

**Boa notícia: as tabelas já existem.** O `01_schema.sql` foi desenhado a pensar nisto.

```
ARTSOFT DocFch (guia)  ──→  logistics.documento
  Doc.Serie + Doc.NrDoc         numero            (chave natural)
  Inf.TpSAFT                    tipo              (guia_transporte | guia_remessa)
  Data.Docum                    data_emissao
  Ter.Terceiro → TerFch         cliente_id / fornecedor_id
  XML completo da resposta      conteudo_xml      (auditoria/rastreio)
  Doc.Pedido                    encomenda_id      (por resolver)
                                carga_id          (associação a carga)

ARTSOFT DocLan (linhas) ──→  (tabela de linhas de guia — POR CRIAR)
  Cod.Codigo → StkFch           produto_id        (via produto.sku_interno)
  Qtd.Movim                     quantidade
  StkFch.Logis.Uni              unidade
  Doc.NrLan / Doc.NrLin         nr_lancamento / nr_linha

ARTSOFT CDU (a determinar) ──→  logistics.viatura.matricula
                                logistics.transportadora
                                logistics.carga.data_hora_carga
```

Tipos já definidos no schema:

```sql
CREATE TYPE tipo_documento AS ENUM (
    'ordem_compra', 'guia_remessa', 'guia_transporte', 'fatura',
    'desadv', 'packing_list', 'nota_recepcao', 'ref',
    'documento_produtor_agricola'
);
```

E a chave de idempotência está lá:

```sql
UNIQUE (empresa_id, tipo, numero)
```

Isto resolve o problema de duplicação por retry **sem trabalho adicional**: um `upsert` por
`(empresa_id, tipo, numero)` é naturalmente idempotente. Reimportar a mesma guia dez vezes
produz uma linha.

**Lacuna:** não existe tabela de **linhas de documento**. `logistics.documento` guarda só o
cabeçalho. As linhas da guia (que artigo, que quantidade) não têm onde ficar. É preciso criar
`logistics.linha_documento` — com o mesmo cuidado de chave natural
`UNIQUE (documento_id, nr_linha)`.

---

## 4. Direção do fluxo — e porque isso importa

O utilizador disse guias **"trazidas para a plataforma"**. Leitura: ARTSOFT → Logistics Hub.

Isto é decisivo, e é boa notícia:

| | Ler (ARTSOFT → Hub) | Escrever (Hub → ARTSOFT) |
|---|---|---|
| Protocolo conhecido? | ✅ Sim, testado em produção | ⚠️ Parcial |
| Endpoint | `Queries/Query` | ❌ **NÃO DETERMINADO** |
| Formato | `<root type='list' …><defcol>` | ✅ Conhecido: `<document entityID='C:2838' retID='S' status='S' trans='S'><docheader>…<docitems><rec>…` (`importado/service.py:296-329`) |
| Implementado no Hub Central | Sim | **Não** — `ImportadoService.sync()` gera o XML e guarda-o em histórico na memória, **nunca o envia** |

Ou seja: os únicos três endpoints ARTSOFT em uso em todo o ecossistema são
`Queries/Query`, `DocFch/CfgDocum` e `DocFch/DocPrintEx`. **Nenhum escreve.**

Como a funcionalidade pedida é só de leitura, **não fica bloqueada por isto.** Fica registado
para quando surgir o requisito inverso (§15.1 da especificação WMS: "devolver eventos de stock
e expedição para atualização do ERP") — esse sim está bloqueado.

---

## 5. O que é preciso construir

Pressupõe a camada de protocolo da Etapa 2 do diagnóstico (porte de `ArtsoftConnection` para
Node com ligação TCP partilhada entre `GET /login` e `POST`). **Nada disto funciona sem essa
peça.**

```
artsoft-sync/
├── artsoft/
│   ├── connection.js          (Etapa 2 — pré-requisito)
│   ├── queryBuilder.js        ← envelope <root> + defcol + subconsultas aninhadas
│   └── pagination.js          ← ciclo de token (porte de _extract_next_token,
│                                 incluindo o tratamento de '0' = fim)
├── guias/
│   ├── query.js               ← filtro DocFch|DocData|TpDoc=…|Data=… ^TerFch
│   ├── defcol.js              ← colunas do cabeçalho + <Lans> das linhas
│   ├── parser.js              ← XML → {guia, linhas[]} (modelo: obras_c002_parser.py)
│   └── mapper.js              ← → logistics.documento + linha_documento
└── discovery/
    └── documentTypes.js       ← DocFch/CfgDocum → enumerar séries disponíveis
```

Alterações de esquema:

```sql
-- nova: linhas de documento
CREATE TABLE logistics.linha_documento (…);
-- UNIQUE (documento_id, nr_linha)

-- documento: campos de origem para rastreio
ALTER TABLE logistics.documento ADD COLUMN origem_serie varchar(20);
ALTER TABLE logistics.documento ADD COLUMN origem_doc_id varchar(60);
ALTER TABLE logistics.documento ADD COLUMN sincronizado_em timestamptz;
```

---

## 6. Erros do C002 a não repetir

O padrão vale a pena; a implementação tem defeitos conhecidos. Ao portar:

| Problema no C002 | Correção |
|---|---|
| Abre ligação ARTSOFT nova a **cada página** (`obras_c002_sync_service.py:162`) | Reutilizar a ligação dentro do ciclo, respeitando o ciclo login+POST por pedido |
| **Sem retry** — falha de rede na página 7 de 300 perde tudo | Retry com backoff; a leitura é idempotente, logo é seguro |
| Filtro por data em formato ARTSOFT sem validação de intervalo | Validar `di <= df` e limitar a janela |
| `max_pages=300` é um limite silencioso — atingi-lo parece sucesso | Emitir aviso explícito e marcar a sincronização como incompleta |
| Deduplicação só em memória, por execução | Deduplicação na BD pela chave natural (já garantida pelo `UNIQUE`) |
| Sem registo do que foi trazido | Auditoria por execução (modelo: `auditoria.pedidos_xml_execucoes`) |

---

## 7. Perguntas por responder antes de escrever código

Bloqueantes:

1. **Que série(s) são as guias de transporte** neste ARTSOFT? (`DocFch/CfgDocum` responde, mas
   é preciso acesso ao servidor)
2. **Âmbito:** as guias entram como *instrução logística* (o que expedir/receber) ou é preciso
   reproduzir a guia legal completa (ATCUD, moradas, matrícula, horas)? A resposta determina se
   os campos NÃO DETERMINADOS da §2 são opcionais ou obrigatórios.
3. **Onde vivem matrícula, moradas de carga/descarga e volumes** — CDU do cabeçalho, ou grupos
   próprios do `DocFch`? Resolve-se lendo **uma** guia real com `CDUNm.01`…`11` no `defcol`.

Não bloqueantes (decisões de desenho, tomadas em conjunto depois):

4. Guias de entrada (fornecedor → armazém), de saída (armazém → cliente), ou ambas?
5. Sincronização periódica por janela de datas, ou a pedido por número de guia?
   (o C002 suporta os dois: `fetch_obras_por_data` e `fetch_obra_por_nr`)
6. Uma guia importada cria automaticamente uma `carga`, ou fica pendente de associação manual?

---

## 8. Conclusão

A ideia está certa. O padrão C002 é exatamente a peça a reutilizar — traz cabeçalho, linhas e
fichas de artigo num round-trip, com paginação e correlação entre tabelas já resolvidas. O
esquema de destino no Logistics Hub já tem `tipo_documento.guia_transporte`, `carga`, `viatura`
e `transportadora`, e a chave `UNIQUE (empresa_id, tipo, numero)` dá idempotência de graça.

O que separa isto de funcionar não é desenho: é **uma guia real lida do ARTSOFT**. Uma única
resposta captada resolve as três perguntas bloqueantes de uma vez.

**Recomendação:** primeiro pedido a fazer, assim que houver acesso —
`DocFch/CfgDocum` com `<root/>` para listar as séries, depois uma query a uma guia com
`CDUNm.01`…`11` incluídos, para revelar os rótulos dos campos definidos pelo utilizador.
Guardar a resposta como fixture anonimizada. A partir daí o resto é execução.
