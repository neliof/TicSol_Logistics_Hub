# Phase 6: Monitoring & Alerting

**Status:** ✅ Implementado

## Architecture

### Structured Logging (Pino)

- JSON structured logs (ELK/Splunk compatible)
- Context: method, path, usuario_id, empresa_id, request_id
- Níveis: info, warn, error
- Desenvolvimento: pretty-printed console
- Produção: JSON lines para file/syslog

### Alerting

Triggers:
- Sync estado != 'completo'
- Sync erro crítico (exception)
- Falha de autenticação (múltiplas tentativas)

Canais:
- Slack webhook (se ALERT_SLACK_WEBHOOK configurado)
- Email (stub — integrar com SendGrid/AWS SES)

### Health Check Endpoint

```
GET /health/sync/{empresa_id}
  → {healthy, lastSync, estado, diasDesdeUltimaSincronizacao}
```

---

## Setup

### 1. Install Dependencies

```bash
npm install pino pino-pretty
```

### 2. Configure Environment

```bash
# Logging
LOG_LEVEL=info                  # debug, info, warn, error

# Alerting (Slack)
ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/...

# Alerting (Email)
ALERT_EMAIL_TO=ops@company.com
# Nota: Stub — implementar com SendGrid/AWS SES/nodemailer
```

### 3. Optional: Configure Log Output

Para produção, redirecionar logs:

```bash
# Arquivo
npm start 2>&1 | tee -a /var/log/ticsol-api-server.log

# Systemd journal
npm start 2>&1 | systemd-cat -t ticsol-api
```

---

## Usage

### View Logs (Desenvolvimento)

```bash
npm start
# Output: pretty-printed, colorized

[INFO] GET /health → 200
[INFO] POST /auth/login (admin@test.local) → success
[INFO] Sync:1 iniciando…
[WARN] ALERTA: Sync failure para empresa 1
```

### View Logs (Produção)

```bash
# JSON lines
tail -f /var/log/ticsol-api-server.log | jq '.'

# Filtrar por empresa
tail -f /var/log/ticsol-api-server.log | jq 'select(.empresaId==1)'

# Filtrar por tipo
tail -f /var/log/ticsol-api-server.log | jq 'select(.type=="sync_failure")'
```

---

## Monitoring Endpoints

### Health Check

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "ok"
}
```

### Sync Health (by Empresa)

```bash
curl http://localhost:3000/health/sync/1
```

**Response (Healthy):**
```json
{
  "healthy": true,
  "lastSync": "2026-09-04T02:15:30.000Z",
  "estado": "completo",
  "diasDesdeUltimaSincronizacao": 0
}
```

**Response (Unhealthy):**
```json
{
  "healthy": false,
  "lastSync": "2026-09-01T02:15:30.000Z",
  "estado": "completo",
  "diasDesdeUltimaSincronizacao": 3
}
```

---

## Alerting

### Slack Integration

Configure webhook:

```bash
export ALERT_SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
npm start
```

On sync failure:

```
TicSol Bot
━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 ARTSOFT Sync Failure - Empresa A

Empresa ID:    1
Estado:        erro_comunicacao
Erro:          Connection timeout to artsoft.staging
Timestamp:     2026-09-04T02:30:00.000Z
```

### Email Integration (Stub)

Atualmente: apenas log (não implementado).

Implementar:

```javascript
// server/utils/alerting.js
// Replace stub with:
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

await transporter.sendMail({
  from: 'noreply@company.com',
  to: process.env.ALERT_EMAIL_TO,
  subject: `ARTSOFT Sync Failure: ${alerta.empresa_nome}`,
  text: formatAlertaEmail(alerta),
})
```

---

## Database Queries

### Last 10 Syncs by Empresa

```sql
SELECT
  empresa_id, estado, num_paginas, criado_em
FROM logistics.sincronizacao_execucao
WHERE empresa_id = 1
ORDER BY criado_em DESC
LIMIT 10;
```

### Sync Success Rate (7 days)

```sql
SELECT
  empresa_id,
  COUNT(*) as total,
  COUNT(CASE WHEN estado = 'completo' THEN 1 END) as completos,
  ROUND(
    100.0 * COUNT(CASE WHEN estado = 'completo' THEN 1 END) / COUNT(*),
    2
  ) as taxa_sucesso_pct
FROM logistics.sincronizacao_execucao
WHERE criado_em > NOW() - INTERVAL '7 days'
GROUP BY empresa_id
ORDER BY empresa_id;
```

### Empresas com Sync > 24h atrás

```sql
SELECT
  e.id, e.nome,
  MAX(se.criado_em) as ultima_sincronizacao,
  FLOOR(EXTRACT(EPOCH FROM (NOW() - MAX(se.criado_em))) / 3600) as horas_atras
FROM logistics.empresa e
LEFT JOIN logistics.sincronizacao_execucao se ON e.id = se.empresa_id
WHERE e.ativa = true
GROUP BY e.id, e.nome
HAVING MAX(se.criado_em) IS NULL OR MAX(se.criado_em) < NOW() - INTERVAL '24 hours'
ORDER BY horas_atras DESC;
```

---

## Metrics (Optional)

Para Prometheus:

```javascript
// server/utils/metrics.js
import promClient from 'prom-client'

export const syncDuration = new promClient.Histogram({
  name: 'sync_duration_seconds',
  help: 'Sync execution time',
  labelNames: ['empresa_id'],
  buckets: [10, 30, 60, 120, 300],
})

export const syncDocuments = new promClient.Gauge({
  name: 'sync_documents_total',
  help: 'Total documents imported',
  labelNames: ['empresa_id'],
})

export const syncErrors = new promClient.Counter({
  name: 'sync_errors_total',
  help: 'Sync error count',
  labelNames: ['empresa_id', 'tipo'],
})

// server.js
app.get('/metrics', (req, res) => {
  res.set('Content-Type', promClient.register.contentType)
  res.end(promClient.register.metrics())
})
```

Scrape com Prometheus:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'ticsol-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
    scrape_interval: 60s
```

---

## Dashboard (Optional)

Grafana dashboard queries:

```sql
-- Sync success rate trend
SELECT
  DATE_TRUNC('hour', criado_em) as time,
  empresa_id,
  COUNT(*) as total,
  COUNT(CASE WHEN estado = 'completo' THEN 1 END) as completos
FROM logistics.sincronizacao_execucao
WHERE criado_em > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', criado_em), empresa_id
ORDER BY time DESC;

-- Docs imported per hour
SELECT
  DATE_TRUNC('hour', criado_em) as time,
  SUM(num_paginas) as paginas_total,
  COUNT(DISTINCT empresa_id) as empresas
FROM logistics.sincronizacao_execucao
WHERE estado = 'completo' AND criado_em > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', criado_em)
ORDER BY time DESC;
```

---

## Testing

### Manual Test

```bash
# Trigger sync manualmente
node artsoft-sync/cli.js --empresa-id 1

# Verificar health
curl http://localhost:3000/health/sync/1

# Verificar logs
tail -f /tmp/api-server.log | jq 'select(.type=="sync_end")'
```

### Simulate Failure

```bash
# Desligar ARTSOFT, triggar sync
# Deve: log warning, enviar Slack alert

# Verificar logs
tail -f /tmp/api-server.log | jq 'select(.type=="sync_failure")'

# Verificar database
SELECT * FROM logistics.sincronizacao_execucao
WHERE empresa_id = 1 ORDER BY criado_em DESC LIMIT 1;
```

---

## Deployment Checklist

- [ ] `pino` e `pino-pretty` instalados
- [ ] `LOG_LEVEL` definido (default: info)
- [ ] Logs redirecionados para arquivo/syslog
- [ ] Slack webhook configurado (ALERT_SLACK_WEBHOOK)
- [ ] Email configurado ou stub documentado
- [ ] `/health` endpoint respondendo
- [ ] `/health/sync/{id}` endpoint testado
- [ ] Monitored com Prometheus/Grafana (opcional)
- [ ] Database queries para monitoring testadas
- [ ] Alertas funcionando (teste manual)

---

## Future Enhancements

### Phase 6.1: Email Alerting

Implementar com SendGrid/AWS SES/nodemailer.

### Phase 6.2: Prometheus Metrics

Adicionar `prom-client` e endpoint `/metrics`.

### Phase 6.3: Grafana Dashboard

Criar dashboard com:
- Sync success rate trend
- Docs imported per hora
- Empresas com sync overdue
- Erro types breakdown

### Phase 6.4: Rate Limiting

Proteger endpoints contra brute-force:
- POST /auth/login: max 5 falhas/minuto por IP
- POST /api/artsoft/guias/sync: max 1 por empresa/minuto

### Phase 6.5: Request Tracing

Integrar OpenTelemetry para distributed tracing (multi-service).

---

*Atualizado: 2026-09-04*
