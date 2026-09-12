# Monitoring & Observability — TicSol Logistics Hub

Production monitoring stack with Prometheus (metrics), Grafana (visualization), and alerting.

## Architecture

```
Applications (Backend, Frontend, Database)
    ↓ (metrics)
Prometheus (scrape, store)
    ↓ (query)
Grafana (visualize, alert)
    ↓ (webhook)
AlertManager (send alerts)
```

## Quick Start

### 1. Deploy Monitoring Stack

```bash
# Create monitoring namespace and secrets
kubectl apply -f k8s/monitoring-namespace.yaml
kubectl create secret generic grafana-admin \
  --from-literal=password=$(openssl rand -base64 32) \
  -n monitoring

# Deploy Prometheus, Grafana, and RBAC
kubectl apply -f k8s/monitoring-rbac.yaml
kubectl apply -f k8s/prometheus-deployment.yaml
kubectl apply -f k8s/prometheus-alerts.yaml
kubectl apply -f k8s/grafana-deployment.yaml
```

### 2. Access Grafana

```bash
# Port forward (local access)
kubectl port-forward svc/grafana 3000:3000 -n monitoring

# Access: http://localhost:3000
# Username: admin
# Password: [from grafana-admin secret]
```

Or via Ingress (production):
```
https://monitoring.ticsol.com
```

### 3. Add Prometheus Data Source

In Grafana:
1. Settings → Data Sources
2. Add Prometheus
3. URL: `http://prometheus:9090`
4. Save & Test

## Components

### Prometheus

**Metrics collection and time-series storage**

- Scrapes metrics from all pods every 15 seconds
- Stores data for 30 days
- Queries via HTTP API
- Located at: `http://prometheus:9090`

**Config:** `k8s/prometheus-deployment.yaml`

**Scrape Targets:**
- Kubernetes API server
- Node metrics
- Pod endpoints (via Prometheus annotations)
- Backend service (port 3000)
- PostgreSQL (port 5432)

**Query Examples:**

```promql
# Backend uptime
up{job="ticsol-backend"}

# HTTP request rate (5-min)
rate(http_requests_total{job="ticsol-backend"}[5m])

# Error rate
rate(http_requests_total{job="ticsol-backend",status=~"5.."}[5m])

# Database connections
pg_stat_activity_count

# Memory usage (bytes)
container_memory_usage_bytes{pod=~"backend-.*"}

# CPU usage (cores)
rate(container_cpu_usage_seconds_total{pod=~"backend-.*"}[5m])
```

### Grafana

**Metrics visualization and dashboarding**

- Pre-configured Prometheus data source
- Custom dashboards and alerts
- User/team management
- Located at: `http://grafana:3000`

**Default Credentials:**
- Username: `admin`
- Password: [from grafana-admin secret]

**First Steps:**
1. Add Prometheus data source
2. Import pre-built dashboards (or create custom)
3. Set up alert notifications
4. Create dashboards for business metrics

### AlertManager (Optional)

For alert routing and notifications:

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install alertmanager prometheus-community/kube-prometheus-stack \
  -n monitoring --set alertmanager.enabled=true
```

## Pre-built Dashboards

Create these Grafana dashboards:

### Dashboard 1: Cluster Health
```
- Node status (ready/not-ready)
- Pod distribution by namespace
- Resource usage (CPU, memory)
- Network I/O
```

### Dashboard 2: Backend Performance
```
- HTTP requests per second
- Request duration (p50, p95, p99)
- Error rate (4xx, 5xx)
- Active connections
```

### Dashboard 3: Database Health
```
- Connection count
- Query latency
- Transactions/sec
- Disk usage
- Replication lag
```

### Dashboard 4: Application Business Metrics
```
- Receções per hour
- Paletizações completed
- Stock reconciliations
- Expedições shipped
```

## Alerting

Alerts defined in `k8s/prometheus-alerts.yaml`:

### Critical Alerts
- Backend pod is down
- PostgreSQL is down
- Disk space critical

### Warning Alerts
- High error rate (>5%)
- High latency (p95 >1s)
- Memory usage >90%
- Pod crash looping

**Alert Labels:**
```yaml
severity: critical | warning
service: backend | database | kubernetes | monitoring
```

### Configure Alert Notifications

In Grafana:
1. Alerting → Notification channels
2. Add channel (Email, Slack, PagerDuty, webhook)
3. Configure routing and grouping

**Example Slack Integration:**

```yaml
- name: Slack
  type: slack
  settings:
    url: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
    mentionGroups: "@oncall"
```

## Metrics Reference

### Backend Application Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | method, path, status | Total HTTP requests |
| `http_request_duration_seconds` | Histogram | method, path | Request latency |
| `db_query_duration_seconds` | Histogram | query | Database query time |
| `artsoft_sync_duration_seconds` | Histogram | operation | ARTSOFT sync time |
| `artsoft_sync_errors_total` | Counter | operation, error | Sync errors |

### Database Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `pg_stat_activity_count` | Gauge | Active connections |
| `pg_database_size_bytes` | Gauge | Database size |
| `pg_replication_lag_seconds` | Gauge | Replication delay |
| `pg_locks_total` | Gauge | Active locks |

### Kubernetes Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `up` | Gauge | Scrape success (0/1) |
| `container_cpu_usage_seconds_total` | Counter | CPU usage |
| `container_memory_usage_bytes` | Gauge | Memory usage |
| `kube_pod_status_phase` | Gauge | Pod state |
| `kube_node_status_condition` | Gauge | Node health |

## Instrumentation

### Add Metrics to Backend

```javascript
// Prometheus client
const prometheus = require('prom-client');

// Define metrics
const httpRequestsTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'path', 'status'],
});

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Request duration',
  labelNames: ['method', 'path'],
  buckets: [0.1, 0.5, 1, 2, 5],
});

// Instrument middleware
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestsTotal.inc({
      method: req.method,
      path: req.path,
      status: res.statusCode,
    });
    httpRequestDuration.observe({
      method: req.method,
      path: req.path,
    }, duration);
  });
  
  next();
});

// Expose metrics endpoint
const promRegister = prometheus.register;
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promRegister.contentType);
  res.end(await promRegister.metrics());
});
```

### Pod Annotation for Scraping

```yaml
annotations:
  prometheus.io/scrape: "true"
  prometheus.io/port: "3000"
  prometheus.io/path: "/metrics"
```

## Troubleshooting

### Prometheus not scraping

```bash
# Check targets
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
# Visit: http://localhost:9090/targets

# Check pod logs
kubectl logs deployment/prometheus -n monitoring
```

### Grafana not showing data

```bash
# Test Prometheus connection
curl http://prometheus:9090/api/v1/query?query=up

# Check data source in Grafana UI
Settings → Data Sources → Prometheus → Test
```

### High memory usage

Prometheus stores all metrics in memory (plus disk). To reduce:
- Reduce scrape interval (currently 15s)
- Lower retention period (currently 30d)
- Disable unused scrape targets
- Increase pod memory limit

## Performance Tuning

### Retention Policy

```yaml
args:
- '--storage.tsdb.retention.time=30d'  # Keep 30 days
- '--storage.tsdb.retention.size=50GB' # Or max 50GB
```

### Scrape Interval

```yaml
global:
  scrape_interval: 15s  # Default: 1m
  evaluation_interval: 15s  # Alert check interval
```

Lower interval = more data = more storage/memory.

### Query Performance

```promql
# Slow query (many time-series)
{job="ticsol-backend"}

# Fast query (specific labels)
{job="ticsol-backend", path="/api/recepcao"}

# Use recording rules for complex queries
```

## Backup & Recovery

### Backup Prometheus Data

```bash
# Snapshot (requires API)
curl -X POST http://prometheus:9090/api/v1/admin/tsdb/snapshot

# Copy volumes
kubectl exec prometheus-pod -n monitoring -- \
  tar czf - /prometheus | tar xzf - -C /backups/
```

### Restore

```bash
# Stop Prometheus
kubectl scale deployment prometheus --replicas=0 -n monitoring

# Restore data
# (copy backup files to PVC)

# Start Prometheus
kubectl scale deployment prometheus --replicas=1 -n monitoring
```

## Integration with CI/CD

### GitHub Actions Alert

```yaml
- name: Notify Grafana
  if: failure()
  run: |
    curl -X POST https://monitoring.ticsol.com/api/annotations \
      -H "Authorization: Bearer ${{ secrets.GRAFANA_TOKEN }}" \
      -d '{"text":"Deployment failed"}'
```

### ArgoCD Sync Status

Add to Prometheus scrape configs:

```yaml
- job_name: 'argocd'
  static_configs:
  - targets: ['argocd-server:8083']
```

## Links

- Prometheus Docs: https://prometheus.io/docs/
- Grafana Docs: https://grafana.com/docs/
- PromQL Guide: https://prometheus.io/docs/prometheus/latest/querying/basics/
- Prometheus Best Practices: https://prometheus.io/docs/practices/
- Grafana Dashboard Library: https://grafana.com/grafana/dashboards/
