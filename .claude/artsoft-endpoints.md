# API Endpoints — TicSol Logistics Hub

**⚠️ STATUS**: Este documento foi atualizado na auditoria de 2026-09-12.

## ⚡ IMPORTANTE: Dois Tipos de Documentação

### 1. ENDPOINTS REAIS (Implementados e Ativos) ✅

Projeto usa **21 endpoints próprios** (Node.js + Express).
Veja **Secção: API Endpoints Reais (Ativos)**

### 2. ENDPOINTS ARTSOFT XML (Referência Histórica) 📚

**301 endpoints** documentados de WebServer ArtSoft.
Não são usados no código atual.
Mantidos como referência para compreensão da arquitetura.
Veja **Secção: Endpoints do WebServer ArtSoft (Histórico)**

---

## API Endpoints Reais (Ativos) ✅

### Base URL
```
http://localhost:3000
```

### Authentication
```bash
# Login
POST /auth/login
Content-Type: application/json

{
  "usuario": "usuario@empresa.com",
  "senha": "password"
}

# Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": { "id": "...", "nome": "..." }
}

# Header para requisições autenticadas:
Authorization: Bearer {token}
```

### Endpoints Ativos

#### Health Check
```
GET /health
```

#### PostgreSQL REST (PostgREST)
```
GET     /rest/v1/{table}
POST    /rest/v1/{table}
PUT     /rest/v1/{table}?id=eq.{id}
DELETE  /rest/v1/{table}?id=eq.{id}

# Exemplos:
GET    /rest/v1/guia_recepcao
GET    /rest/v1/palete_sscc?id=eq.abc123
POST   /rest/v1/palete_sscc
```

#### PostgreSQL RPC (Stored Procedures)
```
POST /rpc/{function_name}
Content-Type: application/json

# Exemplos:
POST /rpc/calcular_paletizacao
POST /rpc/gerar_sscc
POST /rpc/regra_logistica
POST /rpc/encomenda
```

#### ARTSOFT Sincronização
```
POST /api/artsoft/guias/sync              # Sincronizar guias receção
POST /api/artsoft/produtos/sync           # Sincronizar produtos
POST /api/artsoft/terceiros/sync          # Sincronizar fornecedores
POST /api/artsoft/stock/sync              # Sincronizar stock

GET  /api/artsoft/config                  # Obter configuração
POST /api/artsoft/config                  # Guardar configuração

GET  /api/artsoft/series/discover         # Descobrir series
GET  /api/artsoft/series/config/:modulo   # Get series config
POST /api/artsoft/series/config           # Save series config
POST /api/artsoft/series/save             # Save series

# Test data endpoints (dev apenas)
GET    /api/artsoft/test-data/contagem
DELETE /api/artsoft/test-data
```

#### Documentação (Swagger)
```
GET /api-docs
```

### Total Endpoints Ativos
**21 rotas** (5 categorias)

---

## Arquitetura: Porquê Não Usar Endpoints ARTSOFT XML?

Projeto escolheu:
- ✅ **PostgreSQL** como camada de persistência
- ✅ **PostgREST** como API genérica (CRUD automático)
- ✅ **Conectores abstratos** para sincronização com ARTSOFT

### Conectores Ativos
```
artsoft-sync/connectors/
├─ rest.js      → REST API (192.168.1.120:4219)
├─ odbc.js      → ODBC direto com ARTSOFT BD
└─ file.js      → Ficheiros CSV/Excel
```

### Consequência
- ❌ Endpoints ARTSOFT XML (301) **não são usados**
- ❌ Protocolo digest-auth **não implementado**
- ❌ XMLQuery/XMLReports **não usados**

### Vantagens desta Arquitetura
- Abstração: trocar conector sem mudar frontend
- Performance: PostgreSQL local é mais rápido
- Portabilidade: funciona sem ARTSOFT se necessário

---

## Endpoints do WebServer ArtSoft (Histórico) 📚

**STATUS**: Referência histórica. Não usados no código atual.

Fonte inicial: `BRAVAPLAN-XML-N.log`, capturado em 2026-09-11.

## Como descobrir os endpoints

O WebServer expõe um endpoint de descoberta:

```text
ArtDB/_WSList
```

O pedido observado no log foi:

```xml
<wslist/>
```

Depois de estabelecer a sessão de transporte ArtSoft, enviar o XML para o
endpoint `ArtDB/_WSList`. A resposta contém os módulos disponíveis e os
respetivos endpoints. O atributo `ttl` indica o tempo de validade da lista.

No conector deste projeto, a chamada equivalente é:

```python
connector.do_login()
lista = connector.do_request("ArtDB/_WSList", "<wslist/>")
```

O transporte normal usa a base configurada por `artsoft.ip` e `artsoft.porta`
ou por `servico_web_teste.ip` e `servico_web_teste.porta`. A sessão requer o
login técnico ArtSoft e os headers/proteções implementados em
`backend/app/modules/auth/artsoft_transport.py`.

## Endpoints observados

O log devolveu 23 módulos e 301 endpoints. A lista completa está no bloco
`Output` de `BRAVAPLAN-XML-N.log`. Os módulos encontrados foram:

| Módulo | Nº | Endpoints mais relevantes para o PROGESDOC |
|---|---:|---|
| `ArtConn` | 7 | `Register`, `RegisterWEB`, `SendGPS`, `SendScheduleOP` |
| `ArtDB` | 15 | `DBList`, `_DBTables`, `_TblDesc`, `_WSList`, `GetImage`, `SetImage` |
| `ArtUsr` | 4 | `Login`, `SetPass`, `TestPsw`, `UserList` |
| `ArtXML` | 10 | `Echo`, `ServerMetrics`, `ServerPathCfg` |
| `AssisTec` | 22 | `TarefaGet`, `TarefaUpdate`, `OrdSrvGet`, `RequisGet` |
| `Contab` | 16 | `GeneralLedger`, `JournalLancam`, `JournalAddDoc` |
| `CRMHdr` | 12 | `GetTable`, `GetDocExternal`, `Insert`, `Update` |
| `CtaLan` | 15 | `CurrAcc`, `DocType`, `OpenDoc`, `RecvDoc` |
| `DocFch` | 34 | `CfgDocum`, `DocsByEnt`, `DocInsert`, `DocUpdate`, `GetImage` |
| `Dossier` | 4 | `CfgDossier`, `Insert`, `Update`, `Delete` |
| `FDU` | 2 | `Delete`, `Update` |
| `Notify` | 3 | `GetNotification`, `SendMsg`, `SendNotification` |
| `Palete` | 6 | `Create`, `GetInfo`, `Insert`, `Update` |
| `Picking` | 4 | `RecvInvCount`, `RecvPickList`, `SendInvItems`, `SendSkuList` |
| `Producao` | 9 | `GetOrdFab`, `GetOFTsks`, `QueryProd` |
| `Projetos` | 39 | `GetTasks`, `GetTaskDet`, `GetTimesheet`, `GetCosts`, `GetExternalDoc` |
| `Queries` | 6 | `Query`, `XMLQuery`, `Analitics`, `Graphic` |
| `sales` | 1 | `SetImage` |
| `StkFch` | 14 | `SkuByCateg`, `CfgLista`, `Update`, `GetImage` |
| `Tempos` | 62 | `Login`, `GetResource`, `GetClockings`, `GetPresences`, `GetTables` |
| `TerFch` | 11 | `Login`, `GetOtherAddress`, `GetPortabilityData`, `Update` |
| `VndFch` | 2 | `Delete`, `Update` |
| `Workflow` | 3 | `GetTables`, `GetWorkflows`, `UpdWorkflow` |

O número de endpoints deve ser sempre confirmado a partir da resposta atual
do `_WSList`, porque pode variar conforme a versão e a configuração.

## Endpoints usados atualmente

| Endpoint | Uso |
|---|---|
| `ArtDB/_WSList` | Descobrir módulos e endpoints disponíveis |
| `login` | Obter o challenge inicial do WebServer |
| `Tempos/Login` | Autenticar o utilizador ArtSoft |
| `Queries/Query` | Consultar clientes, processos, tarefas, FDU e reservas |

Exemplo real de consulta observado no log:

```xml
<?xml version='1.0' encoding='UTF-8'?>
<FDU_TSK type='list' name='Reserva'
  query='FduTsk|FichaAd|AIBase=1218|NrCampo=990'>
  <defcol>
    <AI_FDU form='%FduTsk.AI_FDU'/>
    <Titul form='%FduTsk.Titul'/>
    <TextoA form='%FduTsk.TextoA'/>
    <DataR form='%FduTsk.DataR'/>
    <HoraR form='%FduTsk.HoraR'/>
  </defcol>
</FDU_TSK>
```

Pedido correspondente:

```python
resultado = connector.do_request("Queries/Query", xml_query)
```

## Como documentar um endpoint novo

Para cada endpoint descoberto, registar:

1. caminho completo, por exemplo `Projetos/GetTasks`;
2. método de transporte usado pelo WebServer;
3. XML mínimo de pedido;
4. campos obrigatórios e respetivos formatos;
5. resposta XML, códigos de erro e permissões;
6. se a operação lê ou altera dados;
7. um exemplo testado e a data da captura.

O `_WSList` informa que o endpoint existe, mas não descreve os campos
obrigatórios. Esses campos devem ser obtidos através de exemplos reais do
cliente ArtSoft, documentação do fabricante ou testes controlados do endpoint.

## Cuidados

- Não guardar neste ficheiro passwords, digests, cookies ou tokens.
- Não assumir que um endpoint anunciado está autorizado para todos os grupos.
- Validar primeiro operações de leitura; endpoints como `Update`, `Insert`,
  `Delete`, `Set*` e `Upd*` podem alterar dados.
- Repetir o `_WSList` depois de atualizar o WebServer, porque a lista pode
  variar por versão, configuração ou permissões.


## Catálogo completo por endpoint

As descrições abaixo são uma leitura funcional do nome publicado pelo _WSList. Indicam a finalidade provável e o tipo de informação esperado; os campos obrigatórios, filtros e XML exato devem ser confirmados com testes de leitura ou documentação ArtSoft.

| Endpoint | Tipo | Para que serve / informação obtida |
|---|---|---|
| `ArtConn/Register` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre register; devolve o resultado ou estado da operação. |
| `ArtConn/RegisterMobileDev` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre register mobile dev; devolve o resultado ou estado da operação. |
| `ArtConn/RegisterWEB` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre register web; devolve o resultado ou estado da operação. |
| `ArtConn/SendGPS` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre send gps; devolve o resultado ou estado da operação. |
| `ArtConn/SendScheduleOP` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre send schedule op; devolve o resultado ou estado da operação. |
| `ArtConn/SendVersaoArtSOFT` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre send versao art soft; devolve o resultado ou estado da operação. |
| `ArtConn/SyncIPList` | Leitura | Opera sobre sync iplist; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtDB/Cambios` | Leitura | Opera sobre cambios; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtDB/CfgEnums` | Leitura | Obtém ou consulta cfg enums; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `ArtDB/CfgTables` | Leitura | Obtém ou consulta cfg tables; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `ArtDB/DBList` | Leitura / descoberta | Obtém ou consulta dblist; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `ArtDB/FnExec` | Leitura | Opera sobre fn exec; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtDB/GetImage` | Leitura | Obtém ou consulta get image; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `ArtDB/SetImage` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set image; devolve o resultado ou estado da operação. |
| `ArtDB/SignPDF` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre sign pdf; devolve o resultado ou estado da operação. |
| `ArtDB/SysTime` | Leitura | Obtém ou consulta sys time; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `ArtDB/_DBTables` | Leitura | Opera sobre  dbtables; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtDB/_Except` | Leitura | Opera sobre  except; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtDB/_FnList` | Leitura | Opera sobre  fn list; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtDB/_IntFnc` | Leitura | Opera sobre  int fnc; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtDB/_TblDesc` | Leitura | Opera sobre  tbl desc; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtDB/_WSList` | Leitura / descoberta | Descobre os módulos e endpoints publicados; devolve a lista com o TTL. |
| `ArtUsr/Login` | Leitura | Opera sobre login; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtUsr/SetPass` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set pass; devolve o resultado ou estado da operação. |
| `ArtUsr/TestPsw` | Leitura | Obtém ou consulta test psw; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `ArtUsr/UserList` | Leitura | Opera sobre user list; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtXML/ArtExecStats` | Leitura | Opera sobre art exec stats; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtXML/Echo` | Leitura / descoberta | Opera sobre echo; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtXML/InvaderReset` | Leitura | Opera sobre invader reset; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtXML/InvadersList` | Leitura | Obtém ou consulta invaders list; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `ArtXML/Performance` | Leitura | Obtém ou consulta performance; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `ArtXML/ServerMetrics` | Leitura | Obtém ou consulta server metrics; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `ArtXML/ServerPathCfg` | Leitura | Obtém ou consulta server path cfg; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `ArtXML/SrvMetricReset` | Leitura | Opera sobre srv metric reset; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `ArtXML/SurveillList` | Leitura | Obtém ou consulta surveill list; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `ArtXML/SurveillReset` | Leitura | Obtém ou consulta surveill reset; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `AssisTec/DocumDelete` | Leitura | Opera sobre docum delete; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/EquipDelete` | Leitura | Opera sobre equip delete; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/EquipGet` | Leitura | Opera sobre equip get; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/EquipSubst` | Leitura | Opera sobre equip subst; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/EquipUpdate` | Leitura | Opera sobre equip update; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/Orcam2OrdSrv` | Leitura | Opera sobre orcam2ord srv; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/OrcamDelete` | Leitura | Opera sobre orcam delete; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/OrcamDetGet` | Leitura | Opera sobre orcam det get; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/OrcamGet` | Leitura | Opera sobre orcam get; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/OrcamUpdate` | Leitura | Opera sobre orcam update; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/OrdExternalDoc` | Leitura | Opera sobre ord external doc; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/OrdSrvDelete` | Leitura | Opera sobre ord srv delete; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/OrdSrvDetGet` | Leitura | Opera sobre ord srv det get; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/OrdSrvGet` | Leitura | Opera sobre ord srv get; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/OrdSrvUpdate` | Leitura | Opera sobre ord srv update; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/RequisDelete` | Leitura | Opera sobre requis delete; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/RequisGet` | Leitura | Opera sobre requis get; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/RequisUpdate` | Leitura | Opera sobre requis update; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/TableGet` | Leitura | Obtém ou consulta table get; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `AssisTec/TarefaDelete` | Leitura | Opera sobre tarefa delete; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/TarefaGet` | Leitura | Opera sobre tarefa get; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `AssisTec/TarefaUpdate` | Leitura | Opera sobre tarefa update; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Contab/AccountAddTer` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre account add ter; devolve o resultado ou estado da operação. |
| `Contab/AccountDelete` | Escrita ou ação | Opera sobre account delete; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Contab/AccountUpdate` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre account update; devolve o resultado ou estado da operação. |
| `Contab/CtaConcAtGetDocs` | Leitura | Opera sobre cta conc at get docs; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Contab/CtaConcAtGetImg` | Leitura | Opera sobre cta conc at get img; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Contab/CtaConcAtInsImg` | Leitura | Opera sobre cta conc at ins img; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Contab/CtaConcAtInsQr` | Leitura | Opera sobre cta conc at ins qr; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Contab/GeneralLedger` | Leitura | Obtém ou consulta general ledger; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Contab/GenerLUpdAcum` | Leitura | Opera sobre gener lupd acum; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Contab/JournalAddDoc` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre journal add doc; devolve o resultado ou estado da operação. |
| `Contab/JournalCommit` | Leitura | Opera sobre journal commit; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Contab/JournalLancam` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre journal lancam; devolve o resultado ou estado da operação. |
| `Contab/JournalTpDocs` | Leitura | Obtém ou consulta journal tp docs; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Contab/JournalTpJour` | Leitura | Obtém ou consulta journal tp jour; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Contab/ListaRegulIVA` | Leitura | Obtém ou consulta lista regul iva; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Contab/PrefixCliForn` | Leitura | Obtém ou consulta prefix cli forn; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `CRMHdr/Delete` | Escrita / remoção | Remove ou desfaz delete; devolve confirmação ou erro da operação. |
| `CRMHdr/FollowUp` | Leitura | Opera sobre follow up; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `CRMHdr/GetDocExternal` | Leitura | Obtém ou consulta get doc external; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `CRMHdr/GetImage` | Leitura | Obtém ou consulta get image; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `CRMHdr/GetQualif` | Leitura | Obtém ou consulta get qualif; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `CRMHdr/GetTable` | Leitura | Obtém ou consulta get table; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `CRMHdr/GetTblAtd` | Leitura | Obtém ou consulta get tbl atd; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `CRMHdr/Insert` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre insert; devolve o resultado ou estado da operação. |
| `CRMHdr/SetDocExternal` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set doc external; devolve o resultado ou estado da operação. |
| `CRMHdr/SetImage` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set image; devolve o resultado ou estado da operação. |
| `CRMHdr/Status` | Leitura | Obtém ou consulta status; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `CRMHdr/Update` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre update; devolve o resultado ou estado da operação. |
| `CtaLan/CCDelete` | Escrita ou ação | Opera sobre ccdelete; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `CtaLan/CCInsert` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre ccinsert; devolve o resultado ou estado da operação. |
| `CtaLan/CCSignature` | Leitura | Opera sobre ccsignature; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `CtaLan/CCUpdate` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre ccupdate; devolve o resultado ou estado da operação. |
| `CtaLan/CfgDocumCC` | Leitura | Obtém ou consulta cfg docum cc; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `CtaLan/CurrAcc` | Leitura | Obtém ou consulta curr acc; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `CtaLan/DocPrintCCEx` | Leitura | Opera sobre doc print ccex; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `CtaLan/DocRecv` | Leitura | Opera sobre doc recv; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `CtaLan/DocType` | Leitura | Obtém ou consulta doc type; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `CtaLan/GetImage` | Leitura | Obtém ou consulta get image; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `CtaLan/LanDelete` | Escrita ou ação | Opera sobre lan delete; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `CtaLan/LanUpdate` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre lan update; devolve o resultado ou estado da operação. |
| `CtaLan/OpenDoc` | Leitura | Obtém ou consulta open doc; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `CtaLan/RecvDoc` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre recv doc; devolve o resultado ou estado da operação. |
| `CtaLan/SetImage` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set image; devolve o resultado ou estado da operação. |
| `DocFch/CfgDocFR` | Leitura | Obtém ou consulta cfg doc fr; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `DocFch/CfgDocum` | Leitura | Obtém ou consulta cfg docum; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `DocFch/CreatePalete` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre create palete; devolve o resultado ou estado da operação. |
| `DocFch/DeletePalete` | Escrita / remoção | Remove ou desfaz delete palete; devolve confirmação ou erro da operação. |
| `DocFch/DesmanchaPalete` | Escrita / remoção | Remove ou desfaz desmancha palete; devolve confirmação ou erro da operação. |
| `DocFch/DocChckUp` | Leitura | Opera sobre doc chck up; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocDelete` | Escrita ou ação | Opera sobre doc delete; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocForceR` | Leitura | Opera sobre doc force r; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocImport` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre doc import; devolve o resultado ou estado da operação. |
| `DocFch/DocInsert` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre doc insert; devolve o resultado ou estado da operação. |
| `DocFch/DocPrices` | Leitura | Opera sobre doc prices; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocPrint` | Leitura | Opera sobre doc print; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocPrintDef` | Leitura | Opera sobre doc print def; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocPrintEtiqEx` | Leitura | Opera sobre doc print etiq ex; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocPrintEx` | Leitura | Opera sobre doc print ex; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocRemove` | Leitura | Opera sobre doc remove; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocsByEnt` | Leitura | Opera sobre docs by ent; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocSignature` | Leitura | Opera sobre doc signature; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocStatus` | Leitura | Opera sobre doc status; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocTransfer` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre doc transfer; devolve o resultado ou estado da operação. |
| `DocFch/DocumentCalc` | Leitura | Opera sobre document calc; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/DocUpdate` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre doc update; devolve o resultado ou estado da operação. |
| `DocFch/DuplicarDoc` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre duplicar doc; devolve o resultado ou estado da operação. |
| `DocFch/ExportSales` | Leitura | Opera sobre export sales; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `DocFch/GetATCodTransporte` | Leitura | Obtém ou consulta get atcod transporte; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `DocFch/GetImage` | Leitura | Obtém ou consulta get image; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `DocFch/GetInfoPalete` | Leitura | Obtém ou consulta get info palete; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `DocFch/GetPosFam` | Leitura | Obtém ou consulta get pos fam; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `DocFch/InsertPalete` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre insert palete; devolve o resultado ou estado da operação. |
| `DocFch/MpgAbrtCaixa` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre mpg abrt caixa; devolve o resultado ou estado da operação. |
| `DocFch/MpgEnceCaixa` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre mpg ence caixa; devolve o resultado ou estado da operação. |
| `DocFch/MpgMoviCaixa` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre mpg movi caixa; devolve o resultado ou estado da operação. |
| `DocFch/SetImage` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set image; devolve o resultado ou estado da operação. |
| `DocFch/UpdatePalete` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre update palete; devolve o resultado ou estado da operação. |
| `Dossier/CfgDossier` | Leitura | Obtém ou consulta cfg dossier; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Dossier/Delete` | Escrita / remoção | Remove ou desfaz delete; devolve confirmação ou erro da operação. |
| `Dossier/Insert` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre insert; devolve o resultado ou estado da operação. |
| `Dossier/Update` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre update; devolve o resultado ou estado da operação. |
| `FDU/Delete` | Escrita / remoção | Remove ou desfaz delete; devolve confirmação ou erro da operação. |
| `FDU/Update` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre update; devolve o resultado ou estado da operação. |
| `Notify/GetNotification` | Leitura | Obtém ou consulta get notification; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Notify/SendMsg` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre send msg; devolve o resultado ou estado da operação. |
| `Notify/SendNotification` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre send notification; devolve o resultado ou estado da operação. |
| `Palete/Create` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre create; devolve o resultado ou estado da operação. |
| `Palete/Delete` | Escrita / remoção | Remove ou desfaz delete; devolve confirmação ou erro da operação. |
| `Palete/Desmancha` | Escrita / remoção | Remove ou desfaz desmancha; devolve confirmação ou erro da operação. |
| `Palete/GetInfo` | Leitura | Obtém ou consulta get info; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Palete/Insert` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre insert; devolve o resultado ou estado da operação. |
| `Palete/Update` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre update; devolve o resultado ou estado da operação. |
| `Picking/RecvInvCount` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre recv inv count; devolve o resultado ou estado da operação. |
| `Picking/RecvPickList` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre recv pick list; devolve o resultado ou estado da operação. |
| `Picking/SendInvItems` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre send inv items; devolve o resultado ou estado da operação. |
| `Picking/SendSkuList` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre send sku list; devolve o resultado ou estado da operação. |
| `Producao/ConsultaLotesFase` | Leitura | Obtém ou consulta consulta lotes fase; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Producao/GetOFTsks` | Leitura | Obtém ou consulta get oftsks; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Producao/GetOrdFab` | Leitura | Obtém ou consulta get ord fab; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Producao/OrdFabCfg` | Leitura | Opera sobre ord fab cfg; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Producao/OrdFabMovStk` | Leitura | Opera sobre ord fab mov stk; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Producao/OrdFabPreReserv` | Leitura | Opera sobre ord fab pre reserv; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Producao/OrdFabQtdProd` | Leitura | Opera sobre ord fab qtd prod; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Producao/OrdFabUpdFchTec` | Leitura | Opera sobre ord fab upd fch tec; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Producao/QueryProd` | Leitura | Opera sobre query prod; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Projetos/CalcCstVal` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre calc cst val; devolve o resultado ou estado da operação. |
| `Projetos/CalcTaskInterv` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre calc task interv; devolve o resultado ou estado da operação. |
| `Projetos/DoActionH` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre do action h; devolve o resultado ou estado da operação. |
| `Projetos/DoActionU` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre do action u; devolve o resultado ou estado da operação. |
| `Projetos/FindCosts` | Leitura | Obtém ou consulta find costs; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetCostDet` | Leitura | Obtém ou consulta get cost det; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetCosts` | Leitura | Obtém ou consulta get costs; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetExternalDoc` | Leitura | Obtém ou consulta get external doc; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetExternDoc` | Leitura | Obtém ou consulta get extern doc; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetHolidays` | Leitura | Obtém ou consulta get holidays; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetHolidaysDet` | Leitura | Obtém ou consulta get holidays det; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetIdData` | Leitura | Obtém ou consulta get id data; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetImage` | Leitura | Obtém ou consulta get image; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetPhotoRes` | Leitura | Obtém ou consulta get photo res; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetResApr` | Leitura | Obtém ou consulta get res apr; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetResPrj` | Leitura | Obtém ou consulta get res prj; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetResShf` | Leitura | Obtém ou consulta get res shf; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetSchSwp` | Leitura | Obtém ou consulta get sch swp; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetShfRes` | Leitura | Obtém ou consulta get shf res; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetSubRes` | Leitura | Obtém ou consulta get sub res; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetTables` | Leitura | Obtém ou consulta get tables; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetTaskDet` | Leitura | Obtém ou consulta get task det; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetTaskFile` | Leitura | Obtém ou consulta get task file; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetTasks` | Leitura | Obtém ou consulta get tasks; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetTimesheet` | Leitura | Obtém ou consulta get timesheet; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetTSFromPrj` | Leitura | Obtém ou consulta get tsfrom prj; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetUnAvl` | Leitura | Obtém ou consulta get un avl; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/GetUnAvlDet` | Leitura | Obtém ou consulta get un avl det; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Projetos/Login` | Leitura | Opera sobre login; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Projetos/RecvIdData` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre recv id data; devolve o resultado ou estado da operação. |
| `Projetos/SetExternDoc` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set extern doc; devolve o resultado ou estado da operação. |
| `Projetos/SetImage` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set image; devolve o resultado ou estado da operação. |
| `Projetos/SetPass` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set pass; devolve o resultado ou estado da operação. |
| `Projetos/UpdCostDet` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd cost det; devolve o resultado ou estado da operação. |
| `Projetos/UpdHolidays` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd holidays; devolve o resultado ou estado da operação. |
| `Projetos/UpdSchSwp` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd sch swp; devolve o resultado ou estado da operação. |
| `Projetos/UpdTaskDet` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd task det; devolve o resultado ou estado da operação. |
| `Projetos/UpdTimesheetDet` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd timesheet det; devolve o resultado ou estado da operação. |
| `Projetos/UpdUnAvl` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd un avl; devolve o resultado ou estado da operação. |
| `Queries/Analitics` | Leitura | Obtém ou consulta analitics; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Queries/AnaliticsList` | Leitura | Obtém ou consulta analitics list; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Queries/Graphic` | Leitura | Obtém ou consulta graphic; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Queries/GraphList` | Leitura | Obtém ou consulta graph list; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Queries/Query` | Leitura | Executa uma consulta XML; devolve os registos e campos definidos no pedido. |
| `Queries/XMLQuery` | Leitura | Executa uma consulta XML; devolve os registos e campos definidos no pedido. |
| `sales/SetImage` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set image; devolve o resultado ou estado da operação. |
| `StkFch/AgregLock` | Leitura | Opera sobre agreg lock; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `StkFch/CfgEspec` | Leitura | Obtém ou consulta cfg espec; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `StkFch/CfgGroups` | Leitura | Obtém ou consulta cfg groups; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `StkFch/CfgLista` | Leitura | Obtém ou consulta cfg lista; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `StkFch/CfgMutac` | Leitura | Obtém ou consulta cfg mutac; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `StkFch/DelCmp` | Escrita / remoção | Remove ou desfaz del cmp; devolve confirmação ou erro da operação. |
| `StkFch/Delete` | Escrita / remoção | Remove ou desfaz delete; devolve confirmação ou erro da operação. |
| `StkFch/DelRft` | Escrita / remoção | Remove ou desfaz del rft; devolve confirmação ou erro da operação. |
| `StkFch/DelUnl` | Escrita / remoção | Remove ou desfaz del unl; devolve confirmação ou erro da operação. |
| `StkFch/GetImage` | Leitura | Obtém ou consulta get image; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `StkFch/PrintEtiqEx` | Leitura | Opera sobre print etiq ex; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `StkFch/SetImage` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set image; devolve o resultado ou estado da operação. |
| `StkFch/SkuByCateg` | Leitura | Opera sobre sku by categ; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `StkFch/Update` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre update; devolve o resultado ou estado da operação. |
| `Tempos/CreateUser` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre create user; devolve o resultado ou estado da operação. |
| `Tempos/DelTimeClk` | Escrita / remoção | Remove ou desfaz del time clk; devolve confirmação ou erro da operação. |
| `Tempos/DoActionH` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre do action h; devolve o resultado ou estado da operação. |
| `Tempos/DoActionI` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre do action i; devolve o resultado ou estado da operação. |
| `Tempos/DoActionP` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre do action p; devolve o resultado ou estado da operação. |
| `Tempos/DoActionS` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre do action s; devolve o resultado ou estado da operação. |
| `Tempos/DoActionU` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre do action u; devolve o resultado ou estado da operação. |
| `Tempos/GenPresences` | Leitura | Opera sobre gen presences; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Tempos/GetAccDefDev` | Leitura | Obtém ou consulta get acc def dev; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetAccDefRes` | Leitura | Obtém ou consulta get acc def res; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetAccSchd` | Leitura | Obtém ou consulta get acc schd; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetBHoras` | Leitura | Obtém ou consulta get bhoras; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetClockings` | Leitura | Obtém ou consulta get clockings; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetHolidays` | Leitura | Obtém ou consulta get holidays; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetHolidaysDet` | Leitura | Obtém ou consulta get holidays det; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetIdData` | Leitura | Obtém ou consulta get id data; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetIdDDet` | Leitura | Obtém ou consulta get id ddet; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetImage` | Leitura | Obtém ou consulta get image; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetIrreg` | Leitura | Obtém ou consulta get irreg; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetIrregDet` | Leitura | Obtém ou consulta get irreg det; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetLastClkId` | Leitura | Obtém ou consulta get last clk id; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetListagemPDF` | Leitura | Obtém ou consulta get listagem pdf; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetListMpFeriasPDF` | Leitura | Obtém ou consulta get list mp ferias pdf; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetListPresencaPDF` | Leitura | Obtém ou consulta get list presenca pdf; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetOverTm` | Leitura | Obtém ou consulta get over tm; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetPhotoRes` | Leitura | Obtém ou consulta get photo res; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetPresences` | Leitura | Obtém ou consulta get presences; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetPresencesDet` | Leitura | Obtém ou consulta get presences det; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetRegMetSch` | Leitura | Obtém ou consulta get reg met sch; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetResAdditInfo` | Leitura | Obtém ou consulta get res addit info; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetResByIdData` | Leitura | Obtém ou consulta get res by id data; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetResource` | Leitura | Obtém ou consulta get resource; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetSaldoFaltas` | Leitura | Obtém ou consulta get saldo faltas; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetSchedSwaps` | Leitura | Obtém ou consulta get sched swaps; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetSchedSwapsDet` | Leitura | Obtém ou consulta get sched swaps det; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetSchSwp` | Leitura | Obtém ou consulta get sch swp; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetSecDefDev` | Leitura | Obtém ou consulta get sec def dev; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetSecDefRes` | Leitura | Obtém ou consulta get sec def res; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetShifts` | Leitura | Obtém ou consulta get shifts; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetSubRes` | Leitura | Obtém ou consulta get sub res; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetTables` | Leitura | Obtém ou consulta get tables; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetUnAvl` | Leitura | Obtém ou consulta get un avl; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/GetUnAvlDet` | Leitura | Obtém ou consulta get un avl det; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Tempos/Login` | Leitura | Opera sobre login; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `Tempos/RecvAccClk` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre recv acc clk; devolve o resultado ou estado da operação. |
| `Tempos/RecvDevCfg` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre recv dev cfg; devolve o resultado ou estado da operação. |
| `Tempos/RecvFailAcc` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre recv fail acc; devolve o resultado ou estado da operação. |
| `Tempos/RecvIdData` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre recv id data; devolve o resultado ou estado da operação. |
| `Tempos/RecvIdDDet` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre recv id ddet; devolve o resultado ou estado da operação. |
| `Tempos/RecvLastClkId` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre recv last clk id; devolve o resultado ou estado da operação. |
| `Tempos/RecvSecDefRes` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre recv sec def res; devolve o resultado ou estado da operação. |
| `Tempos/RecvTimeClk` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre recv time clk; devolve o resultado ou estado da operação. |
| `Tempos/SetImage` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set image; devolve o resultado ou estado da operação. |
| `Tempos/SetPass` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set pass; devolve o resultado ou estado da operação. |
| `Tempos/SetShifts` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set shifts; devolve o resultado ou estado da operação. |
| `Tempos/UpdateDev` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre update dev; devolve o resultado ou estado da operação. |
| `Tempos/UpdHolidays` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd holidays; devolve o resultado ou estado da operação. |
| `Tempos/UpdOverTm` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd over tm; devolve o resultado ou estado da operação. |
| `Tempos/UpdSchedSwap` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd sched swap; devolve o resultado ou estado da operação. |
| `Tempos/UpdSchSwp` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd sch swp; devolve o resultado ou estado da operação. |
| `Tempos/UpdtTimeClk` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre updt time clk; devolve o resultado ou estado da operação. |
| `Tempos/UpdUnAvl` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd un avl; devolve o resultado ou estado da operação. |
| `TerFch/CheckUpTer` | Leitura | Obtém ou consulta check up ter; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `TerFch/Delete` | Escrita / remoção | Remove ou desfaz delete; devolve confirmação ou erro da operação. |
| `TerFch/GetConAccMenu` | Leitura | Obtém ou consulta get con acc menu; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `TerFch/GetImage` | Leitura | Obtém ou consulta get image; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `TerFch/GetOtherAddress` | Leitura | Obtém ou consulta get other address; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `TerFch/GetPortabilityData` | Leitura | Obtém ou consulta get portability data; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `TerFch/Login` | Leitura | Opera sobre login; campos e comportamento exatos a validar com um pedido XML de exemplo. |
| `TerFch/SetImage` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set image; devolve o resultado ou estado da operação. |
| `TerFch/SetPass` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre set pass; devolve o resultado ou estado da operação. |
| `TerFch/Update` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre update; devolve o resultado ou estado da operação. |
| `TerFch/UpdSug` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd sug; devolve o resultado ou estado da operação. |
| `VndFch/Delete` | Escrita / remoção | Remove ou desfaz delete; devolve confirmação ou erro da operação. |
| `VndFch/Update` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre update; devolve o resultado ou estado da operação. |
| `Workflow/GetTables` | Leitura | Obtém ou consulta get tables; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Workflow/GetWorkflows` | Leitura | Obtém ou consulta get workflows; devolve os dados definidos pelo XML e pelos filtros enviados. |
| `Workflow/UpdWorkflow` | Escrita ou ação | Cria, altera, envia ou executa uma ação sobre upd workflow; devolve o resultado ou estado da operação. |

### Legenda de risco

Endpoints classificados como leitura tendem a consultar dados. Os restantes podem criar, alterar, remover ou executar ações. Antes de usar Delete, Del, Update, Upd, Insert, Set, Send, Recv, Create, Register, Commit, Sign ou DoAction, confirmar o XML, permissões e impacto numa base de teste.

## Feriados, férias e dias úteis

Há endpoints relacionados com feriados no módulo `Tempos` e no módulo
`Projetos`:

| Endpoint | O que foi confirmado | Informação devolvida |
|---|---|---|
| `Tempos/GetHolidays` | Consulta férias/ausências de um recurso num intervalo | Saldos atribuídos e restantes, dias gozados e pendentes, compensações e detalhes com datas, número de dias, período e estado (`ACT`, `REJ`, `PCC`, etc.) |
| `Tempos/GetHolidaysDet` | Consulta o detalhe de um registo de férias | Datas e horas de início/fim, dias atribuídos/restantes/registados/pendentes, período, estado, justificações e imagens |
| `Projetos/GetHolidays` | Endpoint equivalente no contexto de projetos/recursos | A confirmar com pedido real; o nome indica consulta de férias do recurso |
| `Projetos/GetHolidaysDet` | Detalhe de férias no contexto de projetos | A confirmar com pedido real |
| `Projetos/GetTSFromPrj` | Consulta tempos de projetos e indisponibilidades, com opção `shwFer` | Registos de horas e blocos `unavl` de indisponibilidade por recurso/projeto; pode ajudar a cruzar férias com planeamento |

Exemplo confirmado para `Tempos/GetHolidays`:

```xml
<root dateBeg="2025-01-01" dateEnd="2025-12-31"
      haveIdRecInfo="N" idRec="001.00014"
      logOp="001.00014"
      stateId="PAC;PCC;PRC;ACT;REJ;CAN;IMP;WRK"
      subList="001.00014" />
```

Cada resposta contém um elemento `holiday` e vários `holidayDet`. Os campos
observados em `holidayDet` incluem `dateBeg`, `dateEnd`, `requestedDays`,
`per`, `stateId` e `stateD`. No elemento `holiday` aparecem, entre outros,
`assignDays`, `assignDaysCurrentY`, `remDays`, `pendDays`, `regDays` e
`compensDays`.

Exemplo confirmado para obter o detalhe de uma ausência:

```xml
<root idHoliday="202" idRec="001.00014" logOp="001.00014" />
```

### O que ainda não está confirmado

O log não prova que `GetHolidays` devolva o calendário geral de feriados
nacionais, regionais ou da empresa. Os exemplos encontrados representam
férias/ausências de um colaborador. Também não foi encontrado um endpoint com
nome explícito `GetWorkingDays` ou `GetBusinessDays`.

Para calcular dias úteis com segurança, é necessário confirmar no ArtSoft:

1. o calendário laboral do recurso ou da empresa, incluindo dias da semana e
   horário de trabalho;
2. os feriados gerais e locais;
3. exceções, trocas de horário e indisponibilidades;
4. se `requestedDays` já exclui fins de semana e feriados.

O próximo teste recomendado é pedir ajuda ao WebServer para
`Tempos/GetHolidays`, `Tempos/GetHolidaysDet`, `Tempos/GetAccSchd`,
`Tempos/GetShifts` e `Tempos/GetTables`, usando:

```xml
<wslist service="Tempos/GetHolidays" param="s" />
```

O projeto já tem esse mecanismo em
`backend/app/scripts/inspect_project_services.py`; ele consulta a descrição
do serviço através de `ArtDB/_WSList` sem executar o endpoint funcional.

## Referências encontradas na base Bravaplan

A análise do backup `bravaplan.backup` confirmou que existe uma estrutura
própria para feriados e horários nos schemas `2025` e `2026`:

| Tabela | Evidência no schema | Utilidade provável |
|---|---|---|
| `strtbl` | Comentário: `Tabela de Feriados`; campos `tableid`, `keyseg0..3` e `recbuff` | Tabela genérica onde o ArtSoft guarda valores/configurações de feriados codificados em `recbuff`; é necessário descodificar os segmentos/chaves |
| `tma_feriado_res` | `idtype`, `id`, `year`, `monthday`, `ai_shift`, `flags`; comentário: `Tabela de Definição de Feriados para Recursos` | Associação de feriados a recursos e turnos, incluindo ano, dia/mês, turno e flags |
| `tma_cfg_geral` | Inclui `remtm_holydaysdays`, `tm_holydaysdays`, `tm_holydaysdayscdf`, `holtype` e `idschedemp` | Configuração geral do módulo de Gestão de Tempos e Agendas: tratamento de férias, tipo de feriado e horário predefinido |
| `tma_horario_res` | `idsched`, `shiftdatebegin`, `ord`, `ai_shift`, `descr`; comentário: `Tabela de Horários de Recursos` | Calendário/horário atribuído a cada recurso ao longo do tempo |
| `tma_tur_res` | Horas de início, duração, tolerâncias e descrição; comentário: `Tabela de Turnos de Recursos` | Define os turnos e horas de trabalho dos recursos |
| `tma_tur_disp` | Estrutura semelhante para turnos de dispositivos | Define turnos associados a dispositivos/terminais |
| `tmagdres` | Inclui `idsched`, validade do horário e `holidaysdays`, `holidaysextradays`, `holidaysdaysprevyear` | Dados acumulados do recurso, incluindo horário e saldos de férias |

Isto confirma a hipótese de existir uma configuração de feriados na base. A
tabela mais diretamente relacionada com datas de feriados é
`tma_feriado_res`; `strtbl` parece ser a tabela genérica de valores de feriado
e pode conter a descrição/nome que falta na tabela de associação.

### Como obter os dias úteis

Os dias úteis não parecem estar guardados numa simples lista de datas. O
ArtSoft provavelmente calcula-os combinando:

1. `tma_horario_res` e `tma_tur_res`, para saber o horário/turno do recurso;
2. `tma_feriado_res` e `strtbl`, para excluir feriados aplicáveis;
3. `tma_cfg_geral`, para regras gerais do módulo;
4. férias e indisponibilidades devolvidas por `Tempos/GetHolidays` e
   `Tempos/GetUnAvl`.

Não se deve interpretar `tma_feriado_res.monthday` como uma data completa sem
confirmar o valor de `idtype` e o significado de `id`. Também não se deve
confundir `holidaysdays` em `tmagdres` com a lista de feriados: esses campos
parecem ser saldos de férias do recurso.

Um CSV com exemplos de feriados é útil. A comparação deverá procurar a
correspondência entre data, ano, recurso/turno, `idtype`, `id`, `ai_shift`,
`flags` e o conteúdo de `strtbl.recbuff`, além de confirmar se o feriado é
geral, local, da empresa ou específico de um recurso.

### Comparação com `Feriados.CSV`

O ficheiro `Feriados.CSV` contém uma primeira linha `0` e depois registos no
formato:

```text
ano,mêsdia,descrição
2026,425,Dia da Liberdade
2026,610,Dia de Portugal
2026,1225,Natal
```

Este formato é compatível com duas colunas da tabela `tma_feriado_res`:

| CSV | `tma_feriado_res` | Estado |
|---|---|---|
| ano | `year` | Correspondência direta |
| mêsdia (`101`, `425`, `1225`) | `monthday` | Correspondência direta provável; representa `MDD` ou `MMDD` sem zero inicial |
| descrição | não existe nesta tabela | Deve estar em `strtbl.recbuff` ou noutra tabela de textos/configuração |
| primeira linha `0` | possível `idtype=0` | Hipótese ainda não confirmada |

O CSV tem feriados nacionais recorrentes entre 2024 e 2027, incluindo Ano
Novo, Carnaval, Sexta-Feira Santa, Páscoa, feriados nacionais, Assunção,
Imaculada Conceição e Natal. As datas são uma boa base para testar a leitura
do calendário ArtSoft e descobrir como o nome é associado ao registo interno.

Para validar a correspondência completa falta obter, para as mesmas datas, os
valores ArtSoft de `id`, `idtype`, `ai_shift`, `flags` e `recbuff`. Só depois
disso se deve importar o CSV ou usá-lo para calcular dias úteis.
