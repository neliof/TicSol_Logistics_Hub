# Setup TicSol Logistics Hub — Guia Passo-a-Passo

## Pré-requisitos

- PostgreSQL 16+
- Node.js 18+
- PostgREST
- Git

## 1. Backend — Base Dados + PostgREST

### 1.1. Criar base de dados

```bash
createdb ticsol_logistics_hub
```

### 1.2. Aplicar migrações (ORDEM IMPORTA)

```bash
cd TicSol_Logistics_Hub

psql -d ticsol_logistics_hub -f database/01_schema.sql
psql -d ticsol_logistics_hub -f database/02_security.sql
psql -d ticsol_logistics_hub -f database/03_functions_rpc.sql
psql -d ticsol_logistics_hub -f database/04_regras_sonae_mc.sql
psql -d ticsol_logistics_hub -f database/05_simulacao_dados_ficticios.sql
psql -d ticsol_logistics_hub -f database/06_artsoft_sync_staging.sql
```

### 1.3. Configurar PostgREST

Copia `postgrest.conf.example` para `postgrest.conf`:

```bash
cp postgrest.conf.example postgrest.conf
```

Edita `postgrest.conf`:
- `db-schemas = "logistics"` (já está correto)
- `jwt-secret` — usa qualquer string (ex: `"your-secret-key-here"`)
- Outras configs: deixa defaults

### 1.4. Arrancar PostgREST

```bash
postgrest postgrest.conf
```

Deve escutar em `http://localhost:3000`

---

## 2. Frontend — React/Vite

### 2.1. Criar projeto Vite

```bash
npm create vite@latest ticsol-frontend -- --template react
cd ticsol-frontend
npm install
```

### 2.2. Copiar componentes + estilos

```bash
# De fora da pasta ticsol-frontend:
cp -r ../TicSol_Logistics_Hub/frontend/receção src/components/
cp -r ../TicSol_Logistics_Hub/frontend/paletizacao src/components/
cp ../TicSol_Logistics_Hub/frontend/shared/tokens.css src/styles/
```

### 2.3. Configurar App.jsx

Edita `src/App.jsx`:

```jsx
import './styles/tokens.css'
import Reception from './components/receção/Reception'
import Paletizacao from './components/paletizacao/Paletizacao'
import { useState } from 'react'

export default function App() {
  const [view, setView] = useState('reception')

  return (
    <div>
      <nav style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
        <button onClick={() => setView('reception')}>Receção</button>
        <button onClick={() => setView('paletizacao')} style={{ marginLeft: '10px' }}>Paletização</button>
      </nav>
      {view === 'reception' && <Reception />}
      {view === 'paletizacao' && <Paletizacao />}
    </div>
  )
}
```

### 2.4. Corrigir imports dos componentes

Cada componente tem `api/postgrestClient.js`. Verifica que `getToken()` lê de `localStorage`:

```javascript
function getToken() {
  return localStorage.getItem('token')
}
```

Se tens sistema de sessão real na app, substitui isto.

### 2.5. Arrancar dev server

```bash
npm run dev
```

Abre `http://localhost:5173`

---

## 3. Fluxo de Teste

1. **Receção** — entrada de stock
2. **Paletização** — organização de paletes
3. **Sync ARTSOFT** (opcional) — ver `artsoft-sync/README.md`

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| `CORS error` | PostgREST precisa de configuração CORS (edita `postgrest.conf`: `server-proxy-uri = "http://localhost:3000"`) |
| `JWT inválido` | Certifica que `jwt-secret` em `postgrest.conf` bate com código do cliente |
| Componentes não carregam | Verifica imports relativos em `Reception.jsx` e `Paletizacao.jsx` |
| DB não tem dados | Verifica que ran `05_simulacao_dados_ficticios.sql` |

---

## Stack Overview

- **DB**: PostgreSQL 16 + 43 tabelas em schema `logistics`
- **API**: PostgREST (auto-generated REST API)
- **Frontend**: React 18 + Vite
- **Auth**: JWT (bearer token em `Authorization` header)
- **Sync**: Node.js service (ARTSOFT → DB)
