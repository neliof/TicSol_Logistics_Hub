# TicSol Logistics Hub — Sincronização ARTSOFT

Serviço Node.js que corre **localmente, na rede da Ticsol**, e sincroniza
Produtos, Clientes, Fornecedores e Stock do ARTSOFT para o Logistics Hub.
Nunca precisa de acesso externo — fala com o ARTSOFT (`192.168.1.120` ou
equivalente) como qualquer outro processo da tua rede.

## Arquitetura: conectores plugáveis

Não sabíamos ao certo o que é o endpoint em `192.168.1.120:4219` (API REST?
gateway ODBC? partilha de ficheiros?), por isso o serviço foi desenhado
para suportar os três, trocáveis só por configuração:

```
connectors/
  interface.js   — contrato comum (JSDoc) que os 3 conectores implementam
  rest.js        — API REST/HTTP (JSON)
  odbc.js        — ligação direta à base Pervasive/Btrieve via ODBC
  file.js        — exportações CSV/TXT (Latin-1, como já usas noutras integrações)

lib/
  sync.js            — orquestrador: mapeia dados ARTSOFT → schema do Logistics Hub
  postgrestClient.js — cliente HTTP para a API do Logistics Hub (upsert, etc.)

index.js — ponto de entrada; escolhe o conector via CONNECTOR_TYPE no .env
```

Para trocar de conector: muda `CONNECTOR_TYPE=rest|odbc|file` no `.env`. O
resto do serviço (mapeamento, upsert, reconciliação de stock) não muda.

## Estado de cada conector

| Conector | Estado | Como foi validado |
|---|---|---|
| **file** | ✅ Testado a sério | Ficheiros CSV sintéticos em Latin-1 (Windows-1252) com acentos reais, vírgula decimal, sincronizados e confirmados na base de dados |
| **rest** | ✅ Testado a sério | Contra um servidor mock local que simula respostas ARTSOFT (incluindo nomes de campo diferentes, para testar os fallbacks) |
| **odbc** | ⚠️ Não testável aqui | Precisa de um DSN ODBC real ligado à base Pervasive/Btrieve do ARTSOFT — código escrito de forma idiomática com o pacote `odbc`, mas os nomes de tabela/coluna (`ARTIGO`, `CLIENTE`, `FORNECEDOR`, `STOCKS`) são um palpite plausível, não confirmado. Ajusta os `SELECT` em `connectors/odbc.js` assim que confirmares os nomes reais. |

**Quando souberes o que é mesmo o endpoint 4219**, o ajuste é sempre no
ficheiro do conector certo (`rest.js` para nomes de campo, `odbc.js` para
nomes de tabela/coluna) — nunca no resto do serviço.

## Instalação

```bash
npm install
cp .env.example .env
# edita o .env: escolhe CONNECTOR_TYPE e preenche a secção correspondente
```

Se fores usar o conector **odbc**, precisas também de instalar o gestor de
drivers ODBC do sistema operativo:
- **Windows**: já vem incluído (ODBC Data Source Administrator).
- **Linux**: `sudo apt install unixodbc unixodbc-dev`, mais o driver
  específico do Pervasive/Btrieve (normalmente fornecido pela Actian).

Isto só é preciso para o conector `odbc` — `rest` e `file` não têm
dependências de sistema.

## `LOGISTICS_HUB_SYNC_TOKEN`

Este serviço corre como processo de backend, não como utilizador
interativo. Precisa de um JWT próprio (claims: `role=authenticated`,
`empresa_id`) — gera um token de longa duração dedicado a este serviço,
separado dos tokens de sessão dos utilizadores humanos. Não reutilizes o
token de um operador.

## Correr

```bash
npm run sync
```

Recomendado: agendar via `cron` (Linux) ou Agendador de Tarefas (Windows)
para correr periodicamente (ex.: a cada 15-30 min), não em contínuo.

## O que o sync faz e não faz

- **Produtos, Clientes, Fornecedores** — upsert direto pela chave natural
  (`sku_interno` em produto, `codigo_interno` em cliente/fornecedor).
  Regista por cima do que já existe no Logistics Hub para esse código.
- **`fornecedor_id` em Produto** — resolvido automaticamente: o sync
  procura o fornecedor pelo código ARTSOFT e liga o UUID real. Produtos
  cujo código de fornecedor não seja encontrado ficam sem fornecedor
  associado (fica registado no log, não falha silenciosamente).
- **Stock** — **não substitui** o stock físico do WMS. O `MOVIMENTO` do
  Logistics Hub é o livro-razão dos movimentos físicos reais de armazém
  (receção, picking, expedição); o stock do ARTSOFT é contabilístico.
  Sobrepor um ao outro às cegas seria perigoso. Por isso o stock do
  ARTSOFT aterra numa tabela de staging
  (`logistics.artsoft_stock_snapshot`) e há uma vista de reconciliação
  (`logistics.vw_reconciliacao_stock`) que mostra as diferenças para
  revisão humana — não decide sozinha qual valor está certo.
- **Linhas de stock de produtos que ainda não existem** no Logistics Hub
  são ignoradas (registado no log, contado como "ignoradas"), nunca
  criam produtos "fantasma" só a partir de uma linha de stock.

## Migração de base de dados necessária

Este serviço depende de `06_artsoft_sync_staging.sql` (tabela
`artsoft_stock_snapshot` + vista `vw_reconciliacao_stock`), que por sua
vez depende de `01_schema.sql`. Aplica-a antes de correr o sync pela
primeira vez.
