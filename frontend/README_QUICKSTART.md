# TicSol Logistics Hub — Quick Start

## O que é?

WMS (Warehouse Management System) + Expedição para Sonae MC / Imefar.

**Módulos:**
- 📥 Receção (guias de entrada)
- 📦 Paletização (SSCC GS1)
- 📊 Stock & Mapa de Armazém
- 🚚 Expedição (Sonae → Imefar + guias transporte)
- 🔄 Sync ARTSOFT (ERP de Imefar)
- ⚙️ Motor de Regras (config cliente)
- 📋 Auditoria & Logs

## Pré-requisitos

- Node.js 18+ (verificar: `node --version`)
- PostgreSQL 16+ (verificar: `psql --version`)
- npm 10+ (verificar: `npm --version`)

## Lançar em 3 passos

### 1. Terminal 1 — API Server (Express)

```bash
cd "c:\Users\TI\Desktop\TicSol_Logistics_Hub\server"
npm install  # primeira vez
npm start
```

Esperado: `TicSol API Server running on http://localhost:3000`

### 2. Terminal 2 — Frontend (Vite)

```bash
cd "c:\Users\TI\Desktop\TicsolLogisticaStudio"
npm install  # primeira vez
npm run dev
```

Esperado: `VITE ... ready in XXXX ms` → `Local: http://localhost:5173`

### 3. Browser

Abrir: **http://localhost:5173**

## O que vai ver?

- **Navbar** com 7 abas: Receção | Paletização | Stock | Expedição | ARTSOFT | Regras | Auditoria
- **KPI Dashboard** com stats em tempo real
- **Expedição** mostra pedidos da Sonae e paletas auto-geradas
- **Auditoria** registra cada ação (mock data: 15+ logs)

## Dados

Tudo usa **mock data** se API offline:
- 3 guias de receção
- 2 paletes SSCC
- 2 pedidos compra (PC-2026-0051, PC-2026-0052)
- 2 paletas expedição (temperatura-compatível)
- 1 guia transporte pronta embarque

## Troubleshooting

**"Port XXXX already in use"** → Fechar outro terminal ou esperar 30s

**"Cannot find module"** → `npm install` no diretório correto

**API offline** → Normal. Usa mock. Procura na console: "Endpoint offline, usando mock"

**Vite page blank** → F5 (refresh) ou limpar cookies

## Próximas Features

1. Integração ARTSOFT real
2. Rastreio transportador
3. Etiquetas SSCC para imprimir
4. Devoluções + notas crédito

---

**Desenvolvido:** TicSol Logistics Studio (React 19 + Vite 6 + Node.js Express + PostgreSQL 16)

**Commit:** `530acc3` (Expedição + useExpedicaoData hook)

**Repo:** https://github.com/neliof/TicsolLogisticaStudio
