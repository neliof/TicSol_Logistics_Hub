# Load Testing & Performance Benchmarking

Production readiness verification through realistic load simulation.

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **Response Time (p95)** | < 500ms | Typical API call |
| **Response Time (p99)** | < 2s | Peak load conditions |
| **Throughput** | 100 req/s | Concurrent requests |
| **Error Rate** | < 0.1% | Failures under load |
| **Database Latency** | < 100ms | Query execution (p95) |
| **CPU Usage** | < 80% | Peak under load |
| **Memory Usage** | < 85% | Pod memory usage |

## Load Testing Tools

### Option 1: k6 (Recommended)

**Installation:**
```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Docker
docker run -i grafana/k6 run - < script.js
```

**Simple Test Script:**
```javascript
// load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = 'http://localhost:3000';

// Ramping load: 0 → 50 users over 5 min, stay 5 min, ramp down
export let options = {
  stages: [
    { duration: '5m', target: 50 },
    { duration: '5m', target: 50 },
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  // 1. Get JWT token
  const authRes = http.post(`${BASE_URL}/auth/login`, {
    email: 'test@example.com',
    password: 'password123',
  });

  const token = authRes.json('token');

  // 2. Create reception
  const createRes = http.post(
    `${BASE_URL}/api/recepcao/create`,
    JSON.stringify({
      numero_guia: `GUIA-${Date.now()}`,
      fornecedor_nome: 'Supplier A',
    }),
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  check(createRes, {
    'create reception 200': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  // 3. List receptions
  const listRes = http.get(`${BASE_URL}/api/recepcao?limit=20`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  check(listRes, {
    'list receptions 200': (r) => r.status === 200,
  });

  sleep(1);
}
```

**Run Test:**
```bash
k6 run load-test.js
```

**Output:**
```
     data_received..................: 2.3 MB   58 kB/s
     data_sent.......................: 924 kB   23 kB/s
     http_req_duration...............: avg=345ms  p(95)=412ms p(99)=950ms
     http_req_failed.................: 0.05%
     http_reqs........................: 3600    90/s
     iteration_duration..............: avg=2.35s  min=2.01s max=3.55s
     iterations.......................: 1800    45/s
     vus..............................: 50      min=50 max=50
     vus_max...........................: 50      min=50 max=50
```

### Option 2: Apache JMeter

```bash
# Install
brew install jmeter

# Create test plan via GUI
jmeter -t load-test.jmx

# Run headless
jmeter -n -t load-test.jmx -l results.jtl -j jmeter.log
```

### Option 3: Locust (Python)

```python
# locustfile.py
from locust import HttpUser, task, between
import json

class TicSolUser(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        # Login
        resp = self.client.post('/auth/login', json={
            'email': 'test@example.com',
            'password': 'password123',
        })
        self.token = resp.json()['token']

    @task(3)
    def list_receptions(self):
        self.client.get('/api/recepcao?limit=20', 
            headers={'Authorization': f'Bearer {self.token}'})

    @task(1)
    def create_reception(self):
        self.client.post('/api/recepcao/create',
            json={'numero_guia': f'GUIA-{int(time.time())}', 'fornecedor_nome': 'Test'},
            headers={'Authorization': f'Bearer {self.token}'})

    @task(2)
    def list_palettes(self):
        self.client.get('/api/paletizacao/disponivel',
            headers={'Authorization': f'Bearer {self.token}'})
```

**Run:**
```bash
locust -f locustfile.py --host=http://localhost:3000 --users 100 --spawn-rate 10
```

---

## Test Scenarios

### Scenario 1: Steady Load (Baseline)

**Profile:**
- 10 concurrent users
- 5-minute duration
- Mix: 70% reads, 30% writes

**Command:**
```bash
k6 run -e SCENARIO=baseline load-test.js
```

**Success Criteria:**
- Response time p95 < 500ms
- Error rate < 0.1%
- CPU < 60%

### Scenario 2: Ramp Test (Capacity Finding)

**Profile:**
- 0 → 200 users over 10 minutes
- Identify breaking point

**k6 Config:**
```javascript
export let options = {
  stages: [
    { duration: '10m', target: 200 },
  ],
};
```

**Success Criteria:**
- System stable until 100+ users
- Graceful degradation after

### Scenario 3: Spike Test (Unexpected Traffic)

**Profile:**
- Baseline (10 users) → Spike (200 users) → Back to baseline
- 2 min each phase

**k6 Config:**
```javascript
export let options = {
  stages: [
    { duration: '2m', target: 10 },
    { duration: '2m', target: 200 },
    { duration: '2m', target: 10 },
  ],
};
```

**Success Criteria:**
- System recovers within 30 seconds
- No permanent degradation

### Scenario 4: Sustained High Load

**Profile:**
- 150 concurrent users
- 30-minute duration
- Monitor for memory leaks, connection leaks

**k6 Config:**
```javascript
export let options = {
  stages: [
    { duration: '5m', target: 150 },
    { duration: '20m', target: 150 },
    { duration: '5m', target: 0 },
  ],
};
```

**Success Criteria:**
- No memory growth (< 1% per minute)
- No connection leaks
- Consistent response times

### Scenario 5: Database-Heavy Load

**Profile:**
- Heavy read load on list endpoints
- 100 concurrent users
- Complex queries (filters, aggregations)

**Script:**
```javascript
// Complex query with filters
http.get(`${BASE_URL}/api/recepcao?estado=FINALIZADA&limit=100&offset=0`, {
  headers: { 'Authorization': `Bearer ${token}` },
});
```

---

## Running Load Tests

### Local Testing

```bash
# 1. Start application
docker-compose up -d

# 2. Wait for readiness
sleep 10

# 3. Run test
k6 run load-test.js --vus 10 --duration 5m

# 4. Monitor during test
kubectl top pods -n ticsol-logistics --watch

# 5. Stop
Ctrl+C
```

### Staging Environment

```bash
# Update BASE_URL in script
sed -i 's/localhost:3000/staging-api.ticsol.com/g' load-test.js

# Run test
k6 run load-test.js --vus 50 --duration 10m

# Review metrics
kubectl logs -f deployment/backend -n ticsol-logistics | grep ERROR
```

### Production Testing (Off-Peak)

```bash
# Only after staging success
# Run at 2 AM on weekday

k6 run load-test.js \
  --vus 100 \
  --duration 10m \
  --tag environment=production

# Monitor Grafana during test
# Check alerts
```

---

## Analyzing Results

### k6 Metrics

```
✓ http_req_duration (requests)  avg=345ms   p(95)=412ms p(99)=950ms
✓ http_req_failed (requests)    0.05%
✓ http_reqs (requests)          3600       90/s
✓ iteration_duration (scenario) avg=2.35s   min=2.01s max=3.55s
✓ vus (virtual users)           50         min=50   max=50
```

**Interpretation:**
- `avg=345ms`: Average latency
- `p(95)=412ms`: 95th percentile (95% of requests faster than this)
- `p(99)=950ms`: 99th percentile
- `http_req_failed=0.05%`: Error rate within target
- `vus=50`: Sustained 50 concurrent users

### Grafana Dashboard Analysis

Monitor during load test:
```
Backend CPU: Should be 40-70%
Backend Memory: Should be stable, not growing
Database CPU: Should be 50-80%
Database Connections: Should be stable
Request Latency: Should track expected values
Error Rate: Should remain < 0.1%
```

### Comparing Runs

```bash
# Export results
k6 run load-test.js --out csv=results.csv

# Compare with baseline
diff baseline.csv results.csv | grep ">" # Increases = regression
```

---

## Optimizations

### If Performance Below Target

**Identify bottleneck:**
```bash
# Profile application
kubectl top pods -n ticsol-logistics
# If CPU high: code optimization needed
# If memory high: potential leak

# Check database
kubectl exec postgres-0 -n ticsol-logistics -- \
  psql -U app_user -d ticsol_logistics_hub \
  -c "SELECT query, calls, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"
```

**Common Optimizations:**

1. **Database Query Optimization**
```sql
-- Add index on frequently filtered columns
CREATE INDEX idx_recepcao_estado ON recepcao(estado);
CREATE INDEX idx_recepcao_empresa_id ON recepcao(empresa_id);

-- Check query plans
EXPLAIN ANALYZE SELECT * FROM recepcao WHERE estado = 'FINALIZADA';
```

2. **Caching (Redis)**
```javascript
// Cache frequently accessed data
const redis = require('redis');
const client = redis.createClient();

app.get('/api/recepcao/:id', async (req, res) => {
  const cached = await client.get(`recepcao:${req.params.id}`);
  if (cached) return res.json(JSON.parse(cached));
  
  // Fetch from database
  const result = await db.query(...);
  await client.setex(`recepcao:${req.params.id}`, 3600, JSON.stringify(result));
  res.json(result);
});
```

3. **Connection Pooling**
```javascript
// Increase pool size
const pool = new Pool({
  max: 50,  // Increase from default 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});
```

4. **Database Replication**
```bash
# Read replicas for read-heavy workloads
kubectl apply -f postgres-replica.yaml

# Route reads to replica in application
```

5. **Kubernetes Pod Scaling**
```bash
# Increase replicas
kubectl scale deployment backend --replicas=10 -n ticsol-logistics

# Or use HPA (Horizontal Pod Autoscaler)
kubectl autoscale deployment backend --min=3 --max=20 --cpu-percent=70
```

---

## Continuous Performance Testing

### GitHub Actions CI

```yaml
name: Load Testing

on:
  schedule:
    - cron: '0 2 * * 1,4'  # Monday & Thursday at 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install k6
        run: sudo apt-get install -y k6
      
      - name: Start staging environment
        run: |
          docker-compose -f docker-compose.staging.yml up -d
          sleep 10
      
      - name: Run load test
        run: k6 run docs/load-test.js --vus 50 --duration 10m
      
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: k6-results
          path: results/
      
      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          webhook-url: ${{ secrets.SLACK_WEBHOOK_OPS }}
          payload: |
            {
              "text": "❌ Load test failed",
              "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": "Load test did not meet performance targets. Review results: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"}}]
            }
```

---

## Performance Baselines

### Expected Metrics (Post-Optimization)

```
Metric              | Baseline | Target    | Current
--------------------|----------|-----------|----------
Response Time (p95) | 500ms    | <500ms    | 412ms ✅
Response Time (p99) | 2000ms   | <2000ms   | 950ms ✅
Throughput          | 100 req/s| ≥100 req/s| 90 req/s ❌
Error Rate          | 0.1%     | <0.1%     | 0.05% ✅
CPU (Peak)          | 80%      | <80%      | 65% ✅
Memory (Peak)       | 1Gi      | <1Gi      | 850Mi ✅
```

### Regression Detection

```bash
# Compare current vs baseline
if [ "$(k6 run --quiet load-test.js | grep p95 | awk '{print $NF}')" -gt 500 ]; then
  echo "❌ REGRESSION: p95 latency exceeded 500ms"
  exit 1
fi
```

---

## References

- k6 Docs: https://k6.io/docs/
- JMeter Docs: https://jmeter.apache.org/usermanual/
- Locust Docs: https://docs.locust.io/
- PostgreSQL Query Optimization: https://www.postgresql.org/docs/current/sql-explain.html
- Kubernetes HPA: https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/
