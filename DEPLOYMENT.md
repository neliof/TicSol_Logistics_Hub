# Deployment Guide

## Quick Start (Docker Compose)

### Prerequisites

- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum
- 10GB disk space

### Start Stack

```bash
# 1. Clone/navigate to project
cd TicSol_Logistics_Hub

# 2. Generate JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET" > .env.local

# 3. Start services
docker-compose up -d

# 4. Wait for health
docker-compose logs -f api
# Look for: "TicSol API Server running on http://localhost:3000"

# 5. Check services
curl http://localhost:3000/health
# Response: {"status":"ok"}
```

### Access

| Service | URL | Credentials |
|---------|-----|-------------|
| API | http://localhost:3000 | — |
| API Docs | http://localhost:3000/api-docs | — |
| PgAdmin | http://localhost:5050 | admin@example.com / admin |
| PostgreSQL | localhost:5432 | postgres / ticsol_dev_password |
| Redis | localhost:6379 | — |

### Seed Initial Data

```bash
# Create admin user
docker-compose exec api node server/bin/seed-usuarios.js \
  --email admin@company.com \
  --password initial_password_123 \
  --empresa-id 1

# Create test empresa (if not seeded)
docker-compose exec postgres psql -U postgres -d ticsol_logistics_hub << 'EOF'
INSERT INTO logistics.empresa (nome, ativa)
VALUES ('Empresa Teste', true)
ON CONFLICT DO NOTHING;
EOF

# Configure ARTSOFT (staging)
docker-compose exec postgres psql -U postgres -d ticsol_logistics_hub << 'EOF'
INSERT INTO logistics.configuracao (empresa_id, chave, valor) VALUES
  (1, 'artsoft.host', 'artsoft.staging.company.com'),
  (1, 'artsoft.porta', '8000'),
  (1, 'artsoft.utilizador', 'sync_user'),
  (1, 'artsoft.senha', 'senha_secreta'),
  (1, 'guias.series', 'V960;V980'),
  (1, 'guias.page_size', '50'),
  (1, 'guias.max_pages', '300')
ON CONFLICT DO NOTHING;
EOF
```

### Test API

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@company.com","password":"initial_password_123"}' \
  | jq -r '.token')

echo "Token: $TOKEN"

# 2. Trigger sync
curl -s -X POST http://localhost:3000/api/artsoft/guias/sync \
  -H "Authorization: Bearer $TOKEN" | jq

# 3. Check health
curl -s http://localhost:3000/health/sync/1 | jq

# 4. List documents
curl -s http://localhost:3000/rest/v1/documento \
  -H "Authorization: Bearer $TOKEN" | jq
```

### View Logs

```bash
# All services
docker-compose logs -f

# Just API
docker-compose logs -f api

# Follow Slack alerts
docker-compose logs -f api | grep -i alert
```

### Stop Stack

```bash
# Graceful stop (5s timeout)
docker-compose down

# Stop with volume cleanup
docker-compose down -v
```

---

## Production Deployment

### Environment Variables

Create `.env.production`:

```bash
NODE_ENV=production
PORT=3000
DB_HOST=postgres.prod.company.com
DB_PORT=5432
DB_NAME=ticsol_logistics_hub_prod
DB_USER=ticsol_app
DB_PASSWORD=<secure_password_from_vault>
JWT_SECRET=<secure_secret_from_vault>
LOG_LEVEL=warn
CRON_ENABLED=true
CRON_SCHEDULE="0 2 * * *"
RATE_LIMIT_ENABLED=true
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/...
ALERT_EMAIL_TO=ops@company.com
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ticsol-api
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ticsol-api
  template:
    metadata:
      labels:
        app: ticsol-api
    spec:
      containers:
      - name: api
        image: registry.company.com/ticsol-api:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: ticsol-api-secrets
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
          - weight: 100
            podAffinityTerm:
              labelSelector:
                matchExpressions:
                - key: app
                  operator: In
                  values:
                  - ticsol-api
              topologyKey: kubernetes.io/hostname
```

### Database Migrations

```bash
# Connect to production DB
psql -h postgres.prod.company.com -U ticsol_app -d ticsol_logistics_hub

# Apply migrations in order
\i database/01_*.sql
\i database/02_*.sql
...
\i database/09_usuarios.sql

# Verify
SELECT version() FROM logistics.versao_db LIMIT 1;
```

### Monitoring

#### Health Checks

```bash
# Every 30 seconds
while true; do
  curl -s http://localhost:3000/health/sync/1 | jq '.healthy'
  sleep 30
done
```

#### Sync Status

```sql
-- Last 10 syncs
SELECT empresa_id, estado, num_paginas, criado_em
FROM logistics.sincronizacao_execucao
ORDER BY criado_em DESC LIMIT 10;

-- Success rate (7 days)
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN estado = 'completo' THEN 1 END) as completos,
  ROUND(100.0 * COUNT(CASE WHEN estado = 'completo' THEN 1 END) / COUNT(*), 2) as taxa
FROM logistics.sincronizacao_execucao
WHERE criado_em > NOW() - INTERVAL '7 days';
```

#### Logs (JSON)

```bash
# Parse JSON logs
tail -f /var/log/ticsol-api.log | jq 'select(.type=="sync_failure")'

# Elasticsearch/Kibana
curl -X POST http://elasticsearch:9200/ticsol-logs/_doc \
  -H "Content-Type: application/json" \
  -d @- < /var/log/ticsol-api.log
```

---

## Database Backup

### Automated (Cron)

```bash
# /etc/cron.d/ticsol-backup
# Backup daily at 3 AM UTC
0 3 * * * postgres pg_dump -U postgres ticsol_logistics_hub | \
  gzip > /backups/ticsol-$(date +\%Y\%m\%d).sql.gz
```

### Manual

```bash
# Backup
pg_dump -U postgres -h localhost ticsol_logistics_hub | \
  gzip > ticsol-backup-$(date +%Y%m%d-%H%M%S).sql.gz

# Restore
gunzip < ticsol-backup-20260904-023000.sql.gz | \
  psql -U postgres -h localhost ticsol_logistics_hub
```

---

## Troubleshooting

### API Won't Start

```bash
# Check logs
docker-compose logs api

# Common issues:
# - JWT_SECRET not set
# - Database not ready (wait 10s)
# - Port 3000 already in use

# Reset and retry
docker-compose down
sleep 5
docker-compose up api
```

### Database Connection Refused

```bash
# Check postgres container
docker-compose logs postgres

# Verify network
docker network ls
docker network inspect ticsol-network

# Restart postgres
docker-compose restart postgres
```

### Rate Limiting Too Strict

```bash
# Disable (development only)
RATE_LIMIT_ENABLED=false docker-compose up api

# Or adjust in middleware/rateLimiter.js
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,  // Increase from 5
  ...
})
```

---

## Performance Tuning

### Database

```sql
-- Analyze table stats
ANALYZE logistics.documento;
ANALYZE logistics.linha_documento;

-- Check slow queries
SELECT * FROM pg_stat_statements
WHERE mean_exec_time > 100
ORDER BY mean_exec_time DESC;

-- Create missing indexes
CREATE INDEX idx_documento_data ON logistics.documento(data_documento);
CREATE INDEX idx_sincronizacao_estado ON logistics.sincronizacao_execucao(estado);
```

### Application

```bash
# Enable compression
ENABLE_GZIP=true npm start

# Increase Node workers
NODE_CLUSTER_WORKERS=4 npm start

# Profile CPU
node --prof server.js
node --prof-process isolate-*.log > profile.txt
```

---

## Rollback

```bash
# If new version breaks
docker-compose down
docker-compose up -d api:old-tag

# Database migration rollback
psql -U postgres ticsol_logistics_hub << 'EOF'
DELETE FROM logistics.documento WHERE criado_em > '2026-09-04'::date;
DROP TABLE IF EXISTS logistics.nova_tabela;
EOF

# Check health
curl http://localhost:3000/health
```

---

*Atualizado: 2026-09-04*
