# Deployment Guide — TicSol Logistics Hub

## Quick Start — Local Development

### Prerequisites
- Docker + Docker Compose
- Node.js 20+
- Git

### Start Everything
```bash
# Clone .env from example
cp .env.example .env

# Start services (PostgreSQL, Backend, Frontend)
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d

# Check status
docker-compose ps

# Watch logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Access
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3000
- **Database:** localhost:5432 (app_user / password from .env)

### Database Setup
```bash
# Connect to database
docker-compose exec postgres psql -U app_user -d ticsol_logistics_hub

# Run migrations (one-time)
docker-compose exec backend npm run db:migrate
```

### Stop Everything
```bash
docker-compose down

# Or with volume cleanup
docker-compose down -v
```

---

## Staging Deployment

### Prerequisites
- Staging server (Linux, Docker/Kubernetes)
- GitHub Container Registry (GHCR) access
- Environment variables configured

### Deploy via Docker Compose
```bash
# On staging server
git clone https://github.com/your-org/ticsol-logistics-hub.git
cd ticsol-logistics-hub

# Configure environment
cp .env.example .env
# Edit .env with staging values:
#   - DB_HOST: staging-postgres
#   - DB_PASSWORD: [secure password]
#   - JWT_SECRET: [secure secret]
#   - ARTSOFT_*: staging ARTSOFT credentials

# Pull latest images
docker-compose pull

# Deploy
docker-compose -f docker-compose.yml -f docker-compose.staging.yml up -d

# Verify
docker-compose ps
curl http://localhost:3000/health
```

### Docker Compose Staging Override
Create `docker-compose.staging.yml`:
```yaml
version: '3.8'

services:
  backend:
    image: ghcr.io/your-org/ticsol/backend:${GIT_SHA}
    restart: always
    environment:
      NODE_ENV: staging
      PORT: 3000

  frontend:
    image: ghcr.io/your-org/ticsol/frontend:${GIT_SHA}
    restart: always
    environment:
      REACT_APP_ENV: staging
```

### Via Kubernetes (Optional)
```bash
# Apply manifests
kubectl apply -f k8s/staging/

# Check status
kubectl get pods -n staging
kubectl logs -f deployment/backend -n staging
```

---

## Production Deployment

### Prerequisites
- Production server (2+ vCPU, 4GB+ RAM)
- PostgreSQL 16+ (managed or self-hosted)
- SSL certificate (Let's Encrypt or commercial)
- Backup strategy in place
- Monitoring (Prometheus, Grafana, etc.)

### Pre-Deployment Checks
```bash
# 1. Database backup
pg_dump -U app_user -d ticsol_logistics_hub > backup_$(date +%s).sql

# 2. Verify migrations
npm run db:migrate --dry-run

# 3. Run tests
npm run test
npx playwright test

# 4. Build verification
npm run build
docker build -f Dockerfile.server .
docker build -f frontend/Dockerfile ./frontend
```

### Deploy Steps

#### 1. Pull Latest Images
```bash
docker-compose pull
export GIT_SHA=$(git rev-parse --short HEAD)
```

#### 2. Run Migrations
```bash
docker-compose run --rm backend npm run db:migrate
```

#### 3. Deploy Services
```bash
# Stop old services gracefully
docker-compose stop

# Start new services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

#### 4. Verify Health
```bash
# Backend health
curl -f http://localhost:3000/health || echo "Backend not healthy!"

# Frontend health
curl -f http://localhost:5173 || echo "Frontend not healthy!"

# Database connection
docker-compose exec backend npm run db:test-connection
```

#### 5. Smoke Tests
```bash
# Run basic checks
npx playwright test --grep @smoke
```

### Rollback Procedure
```bash
# If something breaks:
docker-compose down

# Restore from backup
psql -U app_user -d ticsol_logistics_hub < backup_TIMESTAMP.sql

# Start with previous version
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Production Docker Compose
Create `docker-compose.prod.yml`:
```yaml
version: '3.8'

services:
  postgres:
    restart: always
    volumes:
      - postgres_prod:/var/lib/postgresql/data
    # No port exposure — only internal access

  backend:
    image: ghcr.io/your-org/ticsol/backend:${GIT_SHA}
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3000
    # Only expose via nginx/traefik

  frontend:
    image: ghcr.io/your-org/ticsol/frontend:${GIT_SHA}
    restart: always
    environment:
      REACT_APP_ENV: production

volumes:
  postgres_prod:
    driver: local
```

---

## Nginx Reverse Proxy Setup

```nginx
upstream backend {
    server backend:3000;
}

upstream frontend {
    server frontend:5173;
}

server {
    listen 80;
    server_name api.ticsol.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.ticsol.com;

    ssl_certificate /etc/letsencrypt/live/api.ticsol.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.ticsol.com/privkey.pem;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

server {
    listen 443 ssl http2;
    server_name app.ticsol.com;

    ssl_certificate /etc/letsencrypt/live/app.ticsol.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.ticsol.com/privkey.pem;

    location / {
        proxy_pass http://frontend;
    }
}
```

---

## Environment Variables — Production

```env
# Database (managed PostgreSQL recommended)
DB_HOST=prod-postgres.internal
DB_PORT=5432
DB_NAME=ticsol_prod
DB_USER=app_prod
DB_PASSWORD=[secure_password]

# Server
NODE_ENV=production
PORT=3000
JWT_SECRET=[long_random_string]

# Frontend
REACT_APP_API_URL=https://api.ticsol.com
REACT_APP_ENV=production

# ARTSOFT (Production)
ARTSOFT_HOST=erp.company.local
ARTSOFT_PORT=8080
ARTSOFT_USER=[prod_user]
ARTSOFT_PASSWORD=[prod_password]

# Security
CORS_ORIGIN=https://app.ticsol.com
RATE_LIMIT_WINDOW=15m
RATE_LIMIT_MAX=100
```

---

## Monitoring

### Health Checks
```bash
# Continuous monitoring
watch -n 5 'curl -s http://localhost:3000/health | jq .'

# Database health
docker-compose exec postgres pg_isready -U app_user
```

### Logs
```bash
# Real-time logs
docker-compose logs -f --tail=100 backend

# Persist logs
docker-compose logs backend > backend.log
```

---

## Maintenance

### Regular Backups
```bash
# Daily backup
0 2 * * * docker-compose exec postgres \
  pg_dump -U app_user -d ticsol_logistics_hub | \
  gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
```

### Update Cycle
```bash
# Every Monday at 02:00 UTC
# 1. Pull latest code
git pull

# 2. Run migrations test
npm run db:migrate --dry-run

# 3. Run tests
npm run test

# 4. Deploy if all pass
docker-compose pull && docker-compose up -d
```

---

## Troubleshooting

### Backend won't start
```bash
docker-compose logs backend | tail -50
# Check: DB connection, ports, env vars
```

### Frontend 404
```bash
# Verify build
docker-compose exec frontend ls -la dist/
# Check nginx routing
```

### Database connection errors
```bash
# Test connection
psql -h [host] -U app_user -d ticsol_logistics_hub -c "SELECT 1;"
```

---

## Support

For issues, create GitHub issue or contact: devops@ticsol.com
