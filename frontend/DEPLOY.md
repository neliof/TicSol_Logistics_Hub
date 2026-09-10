# Deploy TicsolLogisticaStudio + WMS

## Requisitos

- Node.js 18+
- npm 9+
- PostgreSQL 16+

## Setup Local

### 1. Backend (TicSol Logistics Hub)

```bash
# Terminal 1
cd ../TicSol_Logistics_Hub/server
npm install
npm start
# Escuta http://localhost:3000
```

### 2. Frontend (TicsolLogisticaStudio)

```bash
# Terminal 2
cd TicsolLogisticaStudio
npm install
npm run dev
# Abre http://localhost:5173
```

### 3. Verificar conexão

```bash
curl http://localhost:3000/health
# Deve retornar: {"status":"ok"}

curl http://localhost:5173
# Vite dev server responde
```

## Estrutura

```
TicsolLogisticaStudio/
├── src/
│   ├── App.tsx (main, usa useWMSData)
│   ├── components/
│   │   ├── RececaoModule.tsx (receção)
│   │   ├── PaletizacaoModule.tsx (paletização)
│   │   ├── wms_recepcao/ (componentes legados JSX)
│   │   └── wms_paletizacao/ (componentes legados JSX)
│   ├── adapters/
│   │   └── wmsApiAdapter.ts (REST client)
│   └── hooks/
│       └── useWMSData.ts (fetch + fallback mock)
├── INTEGRACAO_WMS.md (arquitetura)
└── DEPLOY.md (este ficheiro)
```

## Features

✅ Real-time KPI dashboard  
✅ Receção (módulo)  
✅ Paletização (módulo)  
✅ Stock Map (mapa armazém)  
✅ ARTSOFT Sync  
✅ Rules Engine  
✅ Auditoria  
✅ Barcode Scanner Modal  
✅ API fallback (mock data se offline)

## Troubleshooting

**"Failed to resolve import"**
→ Executa `npm install` de novo

**API offline (usando mock data)**
→ Verificar: `curl http://localhost:3000/health`

**Port already in use**
→ Kill: `lsof -ti:5173 | xargs kill -9` (mac/linux)
→ PowerShell: `Get-Process node | Stop-Process -Force`

## TODO

- [ ] Tests (Vitest + React Testing Library)
- [ ] E2E tests (Cypress/Playwright)
- [ ] Production build + Docker
- [ ] Auth integration (JWT via API)
- [ ] Theme customization (Tailwind config)
- [ ] PWA support (offline mode)
