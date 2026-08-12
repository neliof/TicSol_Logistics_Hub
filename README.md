# TicSol Logistics Hub (WMS)

Módulo de gestão de armazém do TicSol_HuB B2B. Este repositório junta tudo
o que foi construído e **validado a sério** (build real, testes reais
contra PostgreSQL/PostgREST reais, não só código escrito à vista) até ao
momento em que este pacote foi gerado.

## Estado do projeto — visão rápida

| Peça | Estado | Onde |
|---|---|---|
| Especificação funcional (20 secções) | ✅ Completa | `docs/TicSol_Logistics_Hub_WMS_Especificacao.md` |
| Schema PostgreSQL (43 tabelas) | ✅ Testado | `database/01_schema.sql` |
| Segurança (JWT + RLS por empresa) | ✅ Testado | `database/02_security.sql` |
| Funções RPC (SSCC + paletização) | ✅ Testado | `database/03_functions_rpc.sql` |
| Motor de Regras (caso Sonae MC) | ✅ Testado | `database/04_regras_sonae_mc.sql` |
| Simulação de dados fictícios | ✅ Testado | `database/05_simulacao_dados_ficticios.sql` |
| Staging + reconciliação ARTSOFT | ✅ Testado | `database/06_artsoft_sync_staging.sql` |
| Ecrã de Receção (React) | ✅ Testado (Playwright) | `frontend/receção/` |
| Ecrã de Paletização (React) | ✅ Testado (Playwright) | `frontend/paletizacao/` |
| Serviço de sync ARTSOFT | ⚠️ Parcial | `artsoft-sync/` — ver nota abaixo |

## Como arrancar do zero (ordem importa)

```bash
# 1. Cria uma base de dados nova (não reaproveites uma existente)
createdb ticsol_logistics_hub

# 2. Aplica as migrações por esta ordem exata
psql -d ticsol_logistics_hub -f database/01_schema.sql
psql -d ticsol_logistics_hub -f database/02_security.sql
psql -d ticsol_logistics_hub -f database/03_functions_rpc.sql
psql -d ticsol_logistics_hub -f database/04_regras_sonae_mc.sql
psql -d ticsol_logistics_hub -f database/05_simulacao_dados_ficticios.sql   # opcional: só dados de teste
psql -d ticsol_logistics_hub -f database/06_artsoft_sync_staging.sql

# 3. PostgREST — ver docs/Guia_pgAdmin_Criar_Base_e_Schema.docx para o
#    postgrest.conf completo (db-schemas="logistics", roles, JWT secret)
postgrest postgrest.conf

# 4. Frontend — copia frontend/receção e frontend/paletizacao para dentro
#    do teu projeto React/Vite existente (ver "Pendências" abaixo)

# 5. Sync ARTSOFT (quando o endpoint estiver confirmado)
cd artsoft-sync
npm install
cp .env.example .env   # edita CONNECTOR_TYPE e a secção correspondente
npm run sync
```

## O que cada pasta é

- **`docs/`** — o pedido original (`00_prompt_original.md`), o caderno de
  encargos da Sonae MC que serviu de base funcional, a especificação
  completa gerada a partir dele, e o guia passo-a-passo de pgAdmin +
  PostgREST.
- **`database/`** — todas as migrações SQL, numeradas por ordem de
  aplicação. Cada uma foi corrida contra um PostgreSQL 16 real antes de
  ser dada como concluída.
- **`frontend/`** — dois ecrãs React autónomos (Receção, Paletização),
  mais `shared/tokens.css` com os tokens de design partilhados (cores,
  tipografia IBM Plex Sans/Mono). Cada ecrã tem o seu próprio cliente API
  (`api/*.js`) já ligado ao PostgREST real.
- **`artsoft-sync/`** — serviço Node.js standalone que corre localmente
  na rede da Ticsol e sincroniza Produtos/Clientes/Fornecedores/Stock do
  ARTSOFT. Tem 3 conectores plugáveis (REST, ODBC, ficheiros) — ver o
  README próprio dentro da pasta para o detalhe de qual está testado.

## Pendências — por resolver na próxima sessão

1. **Endpoint ARTSOFT ainda por confirmar.** Testado `192.168.1.28:4218`
   localmente — mostra uma página de login, o que confirma ser um serviço
   HTTP (aponta para o conector `rest`), mas ainda não confirmámos se é
   mesmo o ARTSOFT (logotipo/nome na página?) nem se as credenciais
   Admin/ARTSOFT lá funcionam. Assim que confirmares, ajusta só
   `artsoft-sync/connectors/rest.js` (nomes de campo) — o resto do
   serviço não muda.

2. **Integração no projeto React/Vite real.** Os ecrãs em `frontend/`
   foram construídos e testados como componentes autónomos (com o seu
   próprio `postgrestClient.js`), porque ainda não vi a estrutura real do
   teu projeto Ticsol_Hub. Faltam: (a) mover os ficheiros para dentro
   desse projeto e ligar ao routing existente; (b) trocar `getToken()`
   (que por agora lê de `localStorage`, com TODO explícito no código)
   pelo mecanismo de sessão real da app.

3. **Limitação conhecida na Paletização.** O ecrã não subtrai a
   quantidade de uma linha de encomenda já paletizada anteriormente — se
   voltares a calcular o plano da mesma linha depois de já teres
   materializado paletes, cria paletes a mais em cima do que já existe.
   Falta um campo tipo `quantidade_ja_paletizada` antes disto ir para
   produção.

4. **Conector ODBC não testado.** Está escrito com o pacote `odbc` real,
   mas sem DSN Pervasive/Btrieve real não há como validar — os nomes de
   tabela (`ARTIGO`, `CLIENTE`, etc.) são um palpite, não confirmação.

## Notas técnicas úteis a lembrar

- O schema vive em `logistics.*`, não em `public` — se ligares o
  PostgREST a uma base já existente, tens de expor o schema
  explicitamente (`db-schemas = "logistics"`).
- `MOVIMENTO` e `AUDITORIA` estão particionados por mês — em produção
  precisas de um job (ex.: `pg_partman`) a criar a partição do mês
  seguinte automaticamente.
- O stock do ARTSOFT **nunca** substitui o stock físico do WMS
  diretamente — fica em `artsoft_stock_snapshot` + vista
  `vw_reconciliacao_stock`, para revisão humana das diferenças.
