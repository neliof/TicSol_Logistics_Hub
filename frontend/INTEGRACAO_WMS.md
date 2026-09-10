# Integração TicsolLogisticaStudio + TicSol Logistics Hub WMS

## Status

✅ Componentes WMS integrados  
✅ Adapter API criado (`src/adapters/wmsApiAdapter.ts`)  
✅ Hook de dados (`src/hooks/useWMSData.ts`)  
⏳ Ajustes finais em App.tsx

## Arquitetura

```
TicsolLogisticaStudio (TypeScript/Vite)
  ├── components/ (UI TypeScript)
  │   ├── RececaoModule.tsx (data-driven)
  │   ├── PaletizacaoModule.tsx (data-driven)
  │   └── wms_recepcao/ (JSX legacy - opcional)
  │   └── wms_paletizacao/ (JSX legacy - opcional)
  ├── adapters/
  │   └── wmsApiAdapter.ts (REST calls → Node.js API)
  └── hooks/
      └── useWMSData.ts (fetch + fallback mock)
        
Node.js API Server (porta 3000)
  └── PostgreSQL
```

## Como usar

### 1. Instalar dependências

```bash
cd TicsolLogisticaStudio
npm install
```

### 2. Garantir que serviços estão a correr

```bash
# Terminal 1: API Node.js
cd TicSol_Logistics_Hub/server
npm start

# Terminal 2: Frontend
npm run dev
```

### 3. Acessar

- Frontend: http://localhost:5173
- API: http://localhost:3000/health

## Alterações necessárias

### App.tsx (top-level)

```typescript
import { useWMSData } from './hooks/useWMSData';

export default function App() {
  const { orders, pallets, stock, loading, error } = useWMSData();
  
  // Use orders, pallets, stock ao invés de INITIAL_*
  // ...
}
```

## Fallback

Se API estiver offline, app usa **mock data** automaticamente.
Se API responde parcialmente, combina dados reais + mock.

## TODO

1. [ ] Converter tipos do wms_recepcao/wms_paletizacao para TypeScript
2. [ ] Integrar client API dos componentes JSX com wmsApiAdapter
3. [ ] Testar fluxo completo Receção → Paletização
4. [ ] Sync Auditoria com PostgreSQL (via RPC)
