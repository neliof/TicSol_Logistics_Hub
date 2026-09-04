# ARTSOFT — Paths e Protocolo Confirmados (V26)

**Validado**: 2026-09-04 contra ARTSOFT V26 em 192.168.1.120:4333
**Resultado**: 301 guias e 2362 linhas importadas, 0 erros

---

## 1. Protocolo de ligação

O ARTSOFT **não usa Digest HTTP (RFC 2617)**. O challenge está associado à
**conexão TCP**, logo o `GET /login` e o `POST` seguinte têm de partilhar o
mesmo socket. Usar `fetch()` ou conexões separadas devolve 401 sempre.

```
1. GET /login          headers: Connection: Keep-Alive, Keep-Alive: 60,
                                Encoding: utf-8, name: <utilizador>, XMLIdent: 3
   → resposta traz o challenge no header `digest`

2. digest = SHA1( SHA1(utilizador) + SHA1(senha) + SHA1(challenge) )
   (concatenação dos digests binários, não das strings hex)

3. POST /Queries/Query  no MESMO socket
                        headers: digest: <digest>, Content-Type: text/xml,
                                 Encoding: utf-8, Connection: Close
```

Implementação: [artsoft-sync/artsoft/connection.js](artsoft-sync/artsoft/connection.js)

---

## 2. Formato dos filtros

O filtro segue as *keys* declaradas pelo schema da tabela
(`ArtDB/_TblDesc`). Para guias por data:

```
DocFch|DocData|TpDoc=<serieMin>:<serieMax>|Data=<AAAAMMDD>:<AAAAMMDD>
```

- `TpDoc` é um **intervalo**, não uma lista. `DocFch|V980;V990` devolve `errcnt='1'`.
- Correlações juntam-se ao filtro com espaço e `^`:
  - `^TerFch|Cliente|NrCli={%DocFch.Ter.Terceiro}|Filial={%DocFch.Ter.Filial}` → campos `%TerFch.*`
  - `^StkFch|Codigo={%DocLan.Cod.Codigo}` → campos `%StkFch.*`
- Paginação: o token vem no atributo `next` da raiz; acrescenta-se ` |#<token> ` ao filtro.
- A subconsulta de linhas declara `name='lan'`, logo os registos vêm em `<lan>`, não `<rec>`.

---

## 3. Séries reais (2026)

Descoberto com `node scripts/artsoft-query.mjs series 20260101 20261231`:

| Série | TpSAFT | Nome | Docs |
|-------|--------|------|------|
| V960 | FT | FACTURA/EC | 154 |
| V961 | NC | NOTA DE CRÉDITO/EC | 3 |
| V962 | ND | NOTA DÉBITO /CON | 6 |
| V980 | FT | FACTURA /OFERTA | 74 |
| **V990** | **GT** | **GUIA DE TRANSPORTE** | **763** |

**Só V990 é guia de transporte.** V980 é factura, ao contrário do que se
supunha inicialmente. V998 não existe.

---

## 4. Paths do cabeçalho (DocFch)

| Campo | Path | Estado nos dados reais |
|-------|------|------------------------|
| serie | `%DocFch.Doc.Serie` | preenchido |
| numero | `%DocFch.Doc.NrDoc` | preenchido |
| doc_id | `%DocFch.Doc.ID` | preenchido (`V990/20261445`) |
| data_documento | `%DocFch.Data.Docum` | preenchido |
| tipo_saft | `%DocFch.Inf.TpSAFT` | preenchido (`GT`) |
| observacoes | `%DocFch.Doc.Obs` | por vezes vazio |
| pedido_origem | `%DocFch.Doc.Pedido` | preenchido |
| terceiro_numero | `%DocFch.Ter.Terceiro` | preenchido |
| terceiro_filial | `%DocFch.Ter.Filial` | preenchido |
| **matricula** | `%DocFch.Inf.Matricula` | **path válido, vazio em 301/301** |
| **morada_carga** | `%DocFch.Doc.LocCarga` | **301/301 preenchido** |
| **morada_descarga** | `%DocFch.Doc.LocDesc` | 301/301, valor literal "Morada do destinatário" |
| **data_carga** | `%DocFch.Doc.DataCarga` | **301/301 preenchido** |
| hora_carga | `%DocFch.Doc.HoraCarga` | preenchido (`10:12:00`) |
| peso_bruto | `%DocFch.Log.PesoBr` | a 0 nos dados atuais |
| peso_liquido | `%DocFch.Log.PesoLiq` | a 0 |
| volume | `%DocFch.Log.Volume` | a 0 |
| **volumes** | `%DocFch.Log.NrVol` | 301/301, valor 0 |

Campos do terceiro, via correlação `^TerFch`:
`%TerFch.Ter.Nome`, `.NIF`, `.Morada`, `.Localid`, `.CPPais` — todos preenchidos.

**Nota importante**: a matrícula fica em `Inf.*`, não em `Logis.*`; o peso e
volumes em `Log.*`; as moradas e datas de carga em `Doc.*`. Não existe grupo
`Logis` em DocFch — era essa a causa dos erros `ErrVarNotFound` iniciais.

---

## 5. Paths das linhas (DocLan)

| Campo | Path |
|-------|------|
| nr_lancamento | `%DocLan.Doc.NrLan` |
| nr_linha | `%DocLan.Doc.NrLin` |
| artigo_codigo | `%DocLan.Cod.Codigo` |
| descricao | `%DocLan.Div.Descric` |
| quantidade | `%DocLan.Qtd.Movim` |
| observacoes | `%DocLan.Div.Obs` |
| peso_bruto | `%DocLan.Div.PBrTT` |
| peso_liquido | `%DocLan.Div.PLqTT` |
| volume | `%DocLan.Div.VolTT` |
| embalagens | `%DocLan.Div.NrEmb` |

Via correlação `^StkFch`: `%StkFch.Div.NrReg`, `%StkFch.Logis.Uni`.
Atenção: `%StkFch.Nome.0` devolve a **família** ("COMERCIO GERAL"), não a
descrição do artigo — a descrição real está em `%DocLan.Div.Descric`.

---

## 6. Mapeamento para a base de dados

`logistics.documento` não tem colunas para os campos logísticos; estes vão em
`conteudo_xml` (JSON). O `tipo` é o enum `tipo_documento` derivado do TpSAFT
(`GT` → `guia_transporte`), e o `numero` guarda o DocID completo do ARTSOFT.
Chave natural: `(empresa_id, tipo, numero)`.

Em `logistics.linha_documento`, o nº de registo de artigo, peso e EAN13 vão em
`dados_extra`.

---

## 7. Diagnóstico

```bash
node scripts/artsoft-query.mjs ping                          # testa login+digest
node scripts/artsoft-query.mjs schema DocFch                 # lista campos da tabela
node scripts/artsoft-query.mjs series 20260101 20261231      # séries e TpSAFT
node scripts/artsoft-query.mjs guias 20260801 20260808 V990  # amostra completa
```

Credenciais vêm do `.env` (`ARTSOFT_HOST`, `ARTSOFT_PORTA`,
`ARTSOFT_UTILIZADOR`, `ARTSOFT_SENHA`) — nunca hardcoded, nunca em
`logistics.configuracao`.

---

## 8. Executar a sincronização

```bash
node artsoft-sync/cli.js --empresa-id <uuid-da-empresa>
```

Configuração em `logistics.configuracao`: `artsoft.host`, `artsoft.porta`,
`artsoft.utilizador`, `guias.series` (`V990`), `guias.tpsaft_validos`,
`guias.dias_retroativos`, `guias.page_size`, `guias.max_pages`.
