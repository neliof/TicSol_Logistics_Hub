# Next Phases — ARTSOFT Integration

**Current Status:** Phase 2 Complete (Infrastructure + Security + Backend Endpoint)

---

## Phase 3: E2E Testing & Field Path Confirmation

**Objective:** Validate transport guide import against real ARTSOFT instance.

### Tasks

1. **Setup Staging ARTSOFT Connection**
   ```bash
   psql -d ticsol_logistics_hub -c "
     INSERT INTO logistics.configuracao (empresa_id, chave, valor) VALUES
       (1, 'artsoft.host', 'staging-artsoft.company.com'),
       (1, 'artsoft.porta', '8000'),
       (1, 'artsoft.utilizador', 'sync_user'),
       (1, 'artsoft.senha', 'senha_do_staging'),
       (1, 'guias.series', 'V960;V980'),
       (1, 'guias.page_size', '50'),
       (1, 'guias.max_pages', '300')
     ON CONFLICT DO NOTHING;
   "
   ```

2. **Confirm Field Paths**
   - Run DocFch/CfgDocum query to discover form paths in staging ARTSOFT
   - Document discovered paths (matrícula, moradas, volumes, peso, data/hora)
   - Update `logistics.mapeamento_campo` with confirmed form_path values
   - Set `ativo=true` for fields with confirmed paths

3. **Test CLI Sync**
   ```bash
   node artsoft-sync/cli.js --empresa-id 1
   ```
   - Inspect `logistics.documento` for correct guide headers
   - Inspect `logistics.linha_documento` for correct line items
   - Check `logistics.sincronizacao_execucao` for audit trail
   - Verify produto_id resolution (null if no match)

4. **Test API Endpoint**
   ```bash
   # Get JWT
   curl -X POST http://localhost:3000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"demo","password":"demo","empresa_id":1}'

   # Trigger sync
   curl -X POST http://localhost:3000/api/artsoft/guias/sync \
     -H "Authorization: Bearer <token>"
   ```
   - Verify endpoint returns success with correct doc counts
   - Check logs for errors or warnings

5. **Validate RLS Enforcement**
   ```sql
   SELECT count(*) FROM logistics.documento WHERE empresa_id != 1;
   -- Should be 0 (only your empresa's docs visible)
   ```

### Success Criteria
- ✅ At least 10 guides imported successfully
- ✅ All active field mappings populated (no NULL cabeçalho fields)
- ✅ Zero SQL errors in logs
- ✅ sincronizacao_execucao.estado = 'completo'
- ✅ RLS enforces multi-tenant isolation

### Blockers
- Staging ARTSOFT not available → Mock with static XML response
- Network connectivity issues → Test with tcpdump/wireshark

**Estimated Effort:** 2-4 hours (depends on ARTSOFT access, field discovery)

---

## Phase 4: User Credential Validation

**Objective:** Replace demo auth with real user validation.

### Tasks

1. **Create `usuarios` Table** (if not exists)
   ```sql
   CREATE TABLE logistics.usuario (
     id INT PRIMARY KEY,
     empresa_id INT NOT NULL,
     nome VARCHAR(255) NOT NULL,
     email VARCHAR(255) UNIQUE,
     senha_hash VARCHAR(255) NOT NULL,  -- bcrypt
     ativo BOOLEAN DEFAULT true,
     FOREIGN KEY (empresa_id) REFERENCES logistics.empresa(id)
   );
   ```

2. **Implement Password Hashing**
   - Add `bcryptjs` to `server/package.json`
   - Create `server/utils/password.js`:
     ```javascript
     import bcrypt from 'bcryptjs'
     export async function hashPassword(senha) { ... }
     export async function verifyPassword(senha, hash) { ... }
     ```

3. **Update `/auth/login` Endpoint**
   ```javascript
   // server/server.js:189-200
   app.post('/auth/login', async (req, res) => {
     const { username, password } = req.body
     const user = await client.query(
       'SELECT id, empresa_id, senha_hash FROM logistics.usuario WHERE email = $1',
       [username]
     )
     if (!user.rows.length || !(await verifyPassword(password, user.rows[0].senha_hash))) {
       return res.status(401).json({ error: 'Invalid credentials' })
     }
     const token = jwt.sign(
       { usuario_id: user.rows[0].id, empresa_id: user.rows[0].empresa_id },
       jwtSecret,
       { expiresIn: '24h' }
     )
     res.json({ token })
   })
   ```

4. **Seed Test Users**
   ```sql
   INSERT INTO logistics.usuario (id, empresa_id, nome, email, senha_hash, ativo)
   VALUES (1, 1, 'Admin', 'admin@company.com', '<bcrypt hash>', true);
   ```

5. **Test Auth Flow**
   ```bash
   curl -X POST http://localhost:3000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"admin@company.com","password":"senha"}'
   ```

### Success Criteria
- ✅ Login with real user succeeds
- ✅ Login with wrong password fails
- ✅ Token includes correct empresa_id
- ✅ Inactive users cannot login

**Estimated Effort:** 1-2 hours

---

## Phase 5: Scheduled Synchronization

**Objective:** Automate guide imports on schedule (daily/hourly).

### Option A: Node.js `node-cron`

```javascript
// server/jobs/syncGuiasJob.js
import cron from 'node-cron'
import { sincronizarGuias } from '../artsoft-sync/guias/sync.js'

export function startSyncJobs(pool) {
  // Run at 2 AM daily
  cron.schedule('0 2 * * *', async () => {
    const client = await pool.connect()
    try {
      const empresas = await client.query('SELECT id FROM logistics.empresa WHERE ativa = true')
      for (const row of empresas.rows) {
        await sincronizarGuias(client, row.id, {
          logger: (msg) => console.log(`[CRON:${row.id}] ${msg}`),
        })
      }
    } finally {
      client.release()
    }
  })
}
```

### Option B: systemd timer (Linux) or Task Scheduler (Windows)

```bash
# /etc/systemd/system/ticsol-artsoft-sync.timer
[Unit]
Description=TicSol ARTSOFT Guide Sync
[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
[Install]
WantedBy=timers.target

# /etc/systemd/system/ticsol-artsoft-sync.service
[Unit]
Description=Run ARTSOFT guide sync
[Service]
Type=oneshot
ExecStart=/usr/bin/node /app/artsoft-sync/cli.js --empresa-id 1
```

### Option C: External Scheduler (e.g., GitHub Actions, AWS Lambda, cron.io)

```yaml
# .github/workflows/sync-guias.yml
name: Sync ARTSOFT Guides
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: node artsoft-sync/cli.js --empresa-id 1
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
```

### Success Criteria
- ✅ Cron job runs on schedule
- ✅ Execution logged in `logistics.sincronizacao_execucao`
- ✅ Alerts on failures (erro state)

**Estimated Effort:** 1 hour (implementation) + 1 week (testing/validation)

---

## Phase 6: Monitoring & Observability

**Objective:** Dashboard and alerting for sync health.

### Tasks

1. **Dashboard Widget**
   - Last sync timestamp
   - # guides imported (today, week, month)
   - Error rate (% of failed syncs)
   - Trend: docs/sync over time

2. **Alerting**
   - Email alert on sync.estado = 'erro'
   - Slack notification with error details
   - Page oncall if sync > 1 hour overdue

3. **Structured Logging**
   - Replace console.log with structured logger (winston, pino)
   - Log to file + centralized system (ELK, Splunk)

4. **Metrics Collection**
   - Prometheus endpoint for docs/sync, latency, errors
   - Grafana dashboard

### Success Criteria
- ✅ Ops team can monitor sync health
- ✅ Alerts actionable (not noisy)
- ✅ Historical trends visible

**Estimated Effort:** 2-3 days

---

## Phase 7: Incremental Sync (Optional)

**Objective:** Import only new/modified guides instead of full dataset each run.

### Strategy

```sql
-- Add to logistics.configuracao
INSERT INTO logistics.configuracao (empresa_id, chave, valor) VALUES
  (1, 'guias.ultima_sincronizacao', '2026-09-03T14:30:00Z');

-- Query: only guides modified since last sync
-- WHERE DataDocum >= guias.ultima_sincronizacao
-- After sync completes: UPDATE guias.ultima_sincronizacao = NOW()
```

### Benefits
- ⚡ Faster syncs (seconds vs. minutes)
- 🎯 Less bandwidth (only new/changed)
- 📉 Lower DB load

### Risks
- ⚠️ Clock skew on ARTSOFT server
- ⚠️ Deleted guides not detected
- ⚠️ Requires DataDocum field in all guides

**Estimated Effort:** 2 hours

---

## Git Log (Sessions 1-2)

```
6480bfc feat: Backend endpoint and CLI for ARTSOFT guide synchronization
6343c88 docs: ARTSOFT integration and security hardening final status
9bf1885 fix: P0-7/P0-8 Add request timeouts and finalize pagination support
7b107e5 fix: P0-2/P0-3/P0-4/P0-5 Security hardening - credentials, auth, RLS
f8fbcf2 docs: Transport guide import implementation status and next steps
058683e feat: Parser, mapper, and orchestrator for transport guide imports from ARTSOFT
21eb880 feat: schema, XML parsing, and query building for transport guide imports
```

---

## Decision Matrix

| Phase | Effort | Impact | Priority | Dependency |
|-------|--------|--------|----------|-----------|
| 3 (E2E) | 2-4h | High (validates) | P0 | None |
| 4 (Users) | 1-2h | High (security) | P0 | Phase 3 |
| 5 (Cron) | 1-2h | Medium (ops) | P1 | Phase 3 |
| 6 (Monitor) | 2-3d | Medium (ops) | P1 | Phase 5 |
| 7 (Incremental) | 2h | Low (perf) | P2 | Phase 3 |

---

## Recommended Sequence

1. **Phase 3** (E2E) — Validate core functionality
2. **Phase 4** (Users) — Replace demo auth
3. **Phase 5** (Cron) — Automate imports
4. **Phase 6** (Monitor) — Add observability
5. **Phase 7** (Incremental) — Optimize if needed

**Total Estimated Effort:** 1-2 weeks (depending on ARTSOFT access, testing rigor)

---

## Known Issues & Gotchas

### CDU Fields
- Currently extracted but not promoted to columns
- Logic: store in `linha_documento.dados_extra` JSONB
- Later: migrate high-value CDUs to dedicated columns

### Product Resolution
- Current: `produto_id = null` if artigo_codigo not found
- Risk: Guide imported but lines can't be fulfilled
- Solution: Implement "create product on demand" or block import if unresolved

### ARTSOFT Credentials
- Currently in `logistics.configuracao` (DB level)
- Risk: Visible in logs, backups, queries
- Solution: Move to vault (HashiCorp, AWS Secrets) in Phase 4+

### Timezone Handling
- All timestamps stored as UTC
- ARTSOFT may use local time in field values
- Verify DataDocum interpretation during Phase 3

---

## Support & Debugging

### How to Check Sync Status
```sql
SELECT * FROM logistics.sincronizacao_execucao
WHERE empresa_id = 1
ORDER BY criado_em DESC
LIMIT 5;
```

### How to Inspect Raw ARTSOFT Response
```sql
SELECT response_xml FROM logistics.sincronizacao_execucao
WHERE correlation_id = '<correlation_id>'
LIMIT 1;
```

### How to Reset for Re-Testing
```sql
-- Delete all imported guides for empresa_id=1
DELETE FROM logistics.documento WHERE empresa_id = 1 AND origem_sistema = 'ARTSOFT';

-- Reset last sync timestamp
UPDATE logistics.configuracao
SET valor = '2000-01-01T00:00:00Z'
WHERE empresa_id = 1 AND chave = 'guias.ultima_sincronizacao';
```

---

*Last updated: 2026-09-03*
