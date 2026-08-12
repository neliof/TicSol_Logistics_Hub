# Quick Start — 5 Minutos

## Opção A: Setup Automático (Windows PowerShell)

```powershell
# Terminal na pasta do projeto
.\setup-frontend.ps1
```

Depois:
```bash
npm run dev
```

---

## Opção B: Setup Manual

### 1. PostgreSQL + Dados

```bash
createdb ticsol_logistics_hub
psql -d ticsol_logistics_hub -f database/01_schema.sql
psql -d ticsol_logistics_hub -f database/02_security.sql
psql -d ticsol_logistics_hub -f database/03_functions_rpc.sql
psql -d ticsol_logistics_hub -f database/04_regras_sonae_mc.sql
psql -d ticsol_logistics_hub -f database/05_simulacao_dados_ficticios.sql
psql -d ticsol_logistics_Hub -f database/06_artsoft_sync_staging.sql
```

### 2. PostgREST

```bash
postgrest postgrest.conf
```

Deve escutar em `http://localhost:3000`

### 3. Frontend

```bash
npm create vite@latest ticsol-frontend -- --template react
cd ticsol-frontend
npm install

# Copia componentes manualmente (ver SETUP.md secção 2.2)

npm run dev
```

---

## Testar

Abre browser em:
- **Frontend**: http://localhost:5173
- **API**: http://localhost:3000/rest/v1/ (com auth)

Primeiro vai para **Receção** para inserir stock de teste.

---

## Problemas?

Ver secção **Troubleshooting** em [SETUP.md](SETUP.md)
