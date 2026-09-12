# TicSol Logistics Hub — Enterprise Warehouse Management System

Complete 4-phase warehouse logistics platform built with React 19, Node.js, PostgreSQL, and Docker.
Production-ready with full CI/CD, E2E tests, database migrations, and deployment documentation.

## Project Status — Complete Phase Delivery

| Phase | Feature | Status | Location |
|-------|---------|--------|----------|
| **P1 — Receção** | Warehouse receiving, line-by-line conference, divergence tracking, ARTSOFT integration | ✅ Complete | `frontend/src/components/rececao/` |
| **P2 — Paletização** | Automatic pallet creation, content management, movement history, SSCC barcodes | ✅ Complete | `frontend/src/components/paletizacao/` |
| **P3 — Stock** | Inventory reconciliation, FEFO management, location tracking, alerts | ✅ Complete | `frontend/src/components/stock/` |
| **P4 — Expedição** | Pre-shipment conference, shipment tracking, document generation | ✅ Complete | `frontend/src/components/expedicao/` |
| **Backend API** | 37 REST endpoints (17 P1 + 8 P2 + 6 P3 + 6 P4) with JWT + RLS | ✅ Complete | `server/*-endpoints.js` |
| **Database** | 8 tables, audit trail, RLS policies, multi-tenancy | ✅ Complete | `database/020_recepcao_schema.sql` |
| **Docker** | Multi-stage builds, dev/staging/prod configs, health checks | ✅ Complete | `docker-compose.yml` + `Dockerfile.server` + `frontend/Dockerfile` |
| **Testing** | E2E Playwright suite, CI pipeline, artifact uploads | ✅ Complete | `.github/workflows/ci.yml` + `e2e/tests/` |
| **Deployment** | Local dev, staging, production with Nginx, backups, monitoring | ✅ Complete | `DEPLOYMENT_GUIDE.md` |

## Quick Start (5 minutes)

### Prerequisites
- Docker & Docker Compose
- Node.js 20+
- Git

### Local Development
```bash
# 1. Clone environment
cp .env.example .env

# 2. Start all services (PostgreSQL, Backend, Frontend)
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d

# 3. Apply database migrations (one-time)
docker-compose exec backend npm run db:migrate

# 4. Access
# Frontend: http://localhost:5173
# Backend:  http://localhost:3000
# Database: localhost:5432
```

### Stop Everything
```bash
docker-compose down       # stop services
docker-compose down -v    # stop + remove volumes
```

## Architecture & Technology Stack

### Frontend
- **React 19** + TypeScript (strict mode)
- **TailwindCSS 4.1** with CSS variables
- **Vite** build tool
- **Lucide React** for icons
- **Playwright** for E2E testing

### Backend
- **Node.js 20** LTS
- **Express.js** with JWT authentication
- **PostgreSQL 16** with Row-Level Security (RLS)
- **Docker Compose** for orchestration

### Database
- 8 production tables (receção, paletização, stock, expedição)
- Multi-tenancy via RLS policies
- Full audit trail (movement & operation logs)
- Performance indices on critical paths
- Foreign key constraints

### CI/CD & Deployment
- **GitHub Actions** (lint, tests, build, deploy)
- **Docker multi-stage builds** (backend + frontend)
- **Playwright E2E tests** (smoke tests on all browsers)
- **Nginx reverse proxy** (SSL/TLS, load balancing)
- **Staging & production** configs with health checks

## Project Structure

```
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── rececao/       # P1: warehouse receiving
│   │   │   ├── paletizacao/   # P2: pallet management
│   │   │   ├── stock/         # P3: stock reconciliation
│   │   │   └── expedicao/     # P4: shipping
│   │   ├── services/api.ts    # 37-endpoint API client
│   │   ├── hooks/             # Custom React hooks
│   │   └── types/             # TypeScript definitions
│   └── Dockerfile             # Multi-stage frontend build
├── server/
│   ├── recepcao-endpoints.js       # P1: 17 endpoints
│   ├── paletizacao-endpoints.js    # P2: 8 endpoints
│   ├── stock-endpoints.js          # P3: 6 endpoints
│   ├── expedicao-endpoints.js      # P4: 6 endpoints
│   └── server.js              # Express app entry point
├── database/
│   ├── 020_recepcao_schema.sql     # Core schema + RLS
│   └── *.sql                  # Additional migrations
├── e2e/
│   └── tests/recepcao.spec.ts      # P1 workflow tests
├── .github/workflows/
│   └── ci.yml                 # GitHub Actions pipeline
├── docker-compose.yml         # Base Compose config
├── docker-compose.override.yml # Development override
├── Dockerfile.server          # Backend multi-stage build
├── playwright.config.ts       # E2E configuration
├── DEPLOYMENT_GUIDE.md        # Full deployment docs
└── README.md                  # This file
```

## Development Workflow

### Install & Run
```bash
# Install dependencies
npm install

# Start dev server (watches for changes)
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build
```

### E2E Testing
```bash
# Run all tests
npx playwright test

# Run tests matching pattern
npx playwright test recepcao

# Run in headed mode (see browser)
npx playwright test --headed

# Debug mode
npx playwright test --debug
```

### Docker Commands
```bash
# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Execute shell in container
docker-compose exec backend sh
docker-compose exec frontend sh

# Rebuild images
docker-compose build --no-cache

# Run migrations
docker-compose exec backend npm run db:migrate
```

## Deployment

### Local Development
```bash
docker-compose up -d
# All services start with live reload
```

### Staging Deployment
```bash
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d
```

### Production Deployment
See [**DEPLOYMENT_GUIDE.md**](DEPLOYMENT_GUIDE.md) for complete instructions:
- SSL/TLS configuration with Nginx
- PostgreSQL backup strategy
- Health checks & monitoring
- Rollback procedures
- Maintenance & scaling guidelines

## API Reference

### 37 Total Endpoints

| Phase | Endpoints | Base Path |
|-------|-----------|-----------|
| **P1 — Receção** | 17 | `/api/recepcao/*` |
| **P2 — Paletização** | 8 | `/api/paletizacao/*` |
| **P3 — Stock** | 6 | `/api/stock/*` |
| **P4 — Expedição** | 6 | `/api/expedicao/*` |

**Authentication:** JWT Bearer token in `Authorization` header

**Response Format:** JSON with typed error handling

### Example: Create Reception
```bash
POST /api/recepcao/create
Content-Type: application/json
Authorization: Bearer {token}

{
  "numero_guia": "GUIA-001",
  "fornecedor_id": 123,
  "linhas": [
    { "produto_id": 456, "quantidade_esperada": 50, "unidade": "unidades" }
  ]
}
```

## Environment Configuration

See `.env.example` for all variables:
- **Database:** `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- **Server:** `NODE_ENV`, `PORT`, `JWT_SECRET`
- **Frontend:** `REACT_APP_API_URL`, `REACT_APP_ENV`
- **ARTSOFT:** `ARTSOFT_HOST`, `ARTSOFT_PORT`, `ARTSOFT_USER`, `ARTSOFT_PASSWORD`
- **Security:** `CORS_ORIGIN`, `RATE_LIMIT_WINDOW`, `RATE_LIMIT_MAX`

## Health & Monitoring

### Health Checks
```bash
# Backend status
curl http://localhost:3000/health

# Database connectivity
docker-compose exec postgres pg_isready -U app_user
```

### Logs
```bash
# Real-time logs
docker-compose logs -f --tail=50 backend
docker-compose logs -f --tail=50 frontend
```

## CI/CD Pipeline

GitHub Actions automatically:
- Runs lint & type checks
- Executes E2E tests (Playwright)
- Builds Docker images
- Pushes to GitHub Container Registry
- Deploys to staging (develop branch)
- Deploys to production (master branch, manual gate)

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml) for details.

## Database Migrations

```bash
# Apply all pending migrations
docker-compose exec backend npm run db:migrate

# Test migrations (dry run)
npm run db:migrate -- --dry-run

# Rollback last migration
npm run db:rollback
```

Migrations stored in `database/` and applied in order.

## Support & Contributing

### Reporting Issues
- Create GitHub issue with reproduction steps
- Include logs: `docker-compose logs backend`
- Include environment: Docker version, Node version, OS

### Contributing
1. Branch from `develop`
2. Follow conventional commits: `feat:` / `fix:` / `refactor:`
3. Ensure tests pass: `npm run lint && npm run type-check && npx playwright test`
4. Push to branch and create pull request to `develop`
5. After review & merge to `develop`, merge to `master` for production

## License

Proprietary — TicSol, 2026
