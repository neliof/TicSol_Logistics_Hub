# Transport Guide Import Status

## Completed

### Phase 1: Infrastructure & Schema (Commit 21eb880)
- ✅ Database migration: `database/07_guias_transporte.sql`
  - `logistics.configuracao`: per-enterprise config (series, TPSAFT filter, ARTSOFT credentials)
  - `logistics.mapeamento_campo`: runtime field mappings (avoid hardcoding ARTSOFT paths)
  - `logistics.documento`: guide header (with RLS by enterprise)
  - `logistics.linha_documento`: guide lines (artigo_codigo always preserved)
  - `logistics.sincronizacao_execucao`: audit trail (XML request/response, estado, correlation_id)
  - CHECK constraint: inactive fields cannot have empty form_path

- ✅ Core modules: `artsoft-sync/artsoft/*.js`
  - `xml.js`: XXE-safe parsing (rejects DOCTYPE/ENTITY, 64MB limit), all strings
  - `queryBuilder.js`: envelope + defcol generation (deterministic sort, dedup tags)
  - `config/series.js`: list parsing (`;`-separated, trim, uppercase, dedup with order preservation)
  - `pagination.js`: token extraction (4-level fallback: @next/@token, primo rec, text elements, regex)
  - `pagination.js`: cicloComToken loop (dedup by ID, limite maxPaginas, loop-termination conditions)
  - `artsoft/test/xml.test.js`: XXE safety, parsing edge cases

### Phase 2: Parser + Mapper + Orchestrator (Commit 058683e)
- ✅ `guias/parser.js`
  - XML response → `[{doc_id_artsoft, serie, numero, data_docum, tipo_saft, linhas: [...]}]`
  - Fallthrough field names: `DocSerie|Serie|Doc.Serie` (handles ARTSOFT variation)
  - CDU extraction: `CDUNm_01, CDU_01` → `dados_extra.cdu_01`
  - CDU normalization: removes `~` separator, keeps last segment
  - Line grouping from nested `<Lans><rec>` array
  - Graceful error per document (skip + log, don't abort cycle)

- ✅ `guias/mapper.js`
  - UPSERT documento: `(empresa_id, serie, numero)` natural key
  - DELETE + INSERT linhas (atomic transaction)
  - Product resolution: `artigo_codigo` → `produto_id` (or null if not found)
  - Audit: `sincronizacao_execucao` with request/response XML, estado, correlation_id
  - Atomic batch processing with error capture

- ✅ `guias/sync.js` — Orchestrator
  - Load config from `logistics.configuracao` (host, porta, utilizador, senha, timeout)
  - Load active field mappings from `logistics.mapeamento_campo`
  - Build XML envelope with defcol (cabeçalho + subconsulta Lans)
  - Digest SHA1 auth (ARTSOFT WebServer standard)
  - Token pagination loop (handles @next, @token, text elements, regex fallback)
  - Per-page XML → parse → validate TpSAFT → map to DB
  - Audit trail with correlation_id for multi-page runs
  - Logger hook for observability

- ✅ Tests
  - `guias/test/parser.test.js`: XML→struct, fallthrough, CDU, multi-doc, no linhas
  - `guias/test/sync.test.js`: config validation, HTTP error handling

## Known Unknowns (To Confirm in Real ARTSOFT)

1. **Field Paths** — These are guesses; must be confirmed by DocFch/CfgDocum:
   - Matrícula (vehicle registration): `DocFch.Logis.Matricula`?
   - Endereço de carga (pickup address): `DocFch.Logis.EndCarga`?
   - Endereço de descarga (delivery address): `DocFch.Logis.EndDescarga`?
   - Data/hora de carga: `DocFch.Logis.DataHora`?
   - Volumes/paletes: `DocFch.Logis.Volumes`?
   - Peso total: `DocFch.Logis.Peso`?
   → Solution: seed `logistics.mapeamento_campo` with `ativo=false` for these, then UPDATE paths after confirmation.

2. **Document ID** — Used for DocPrintEx (PDF export):
   - Is DocID always present and unique?
   - Alternative: build from Serie/NrDoc/Date if DocID is null?
   → Currently falls back to `${serie}-${numero}-${data}` if DocID missing.

3. **Line item correlations** — DocLan sub-query:
   - Correct filter syntax for joining to DocFch?
   - Are there nested structures (e.g., Lans_C for costs) to handle?
   → Currently handles `Lans_C.custo` for unit cost extraction.

4. **TPSAFT validity** — Seed values are `GR;GT;GA;GC;GD` (goods movement types):
   - Are these the right types for all installations?
   - Should we reject `GR` (returns) or include them?
   → Currently configurable in `logistics.configuracao[guias.tpsaft_validos]`.

## To Do Before Production

### High Priority (P0 Blocking)

1. **P0-1: Field Path Confirmation**
   ```sql
   -- Test query against real ARTSOFT:
   SELECT DocFch.Doc.NrDoc, Logis.Matricula, Logis.EndCarga, Logis.DataHora
     FROM DocFch WHERE ...
   -- Capture correct paths and UPDATE logistics.mapeamento_campo
   ```

2. **P0-2: Security — Credentials in Config**
   - `artsoft.senha` is stored in `logistics.configuracao`
   - Should move to environment or vault (HashiCorp, AWS Secrets, etc.)
   - For now: ensure database encryption at rest, restrict SELECT on `logistics.configuracao`

3. **P0-3: E2E Test with Real ARTSOFT**
   - Set up staging ARTSOFT connection
   - Run `sincronizarGuias()` → verify documents imported
   - Inspect `logistics.documento` and `logistics.linha_documento` for correctness
   - Verify `logistics.sincronizacao_execucao` audit trail

4. **P0-4: Backend HTTP Endpoint**
   - Create `/api/artsoft/guias/sync` POST endpoint (requires auth + enterprise context)
   - Trigger `sincronizarGuias()` on demand
   - Return: `{docs_criados, docs_atualizados, erros: [], ultima_execucao}`
   - May want scheduled job (cron) as alternative

### Medium Priority

5. **Error Handling & Retry**
   - What if ARTSOFT is down? Retry with backoff?
   - What if a single document fails? Skip or abort batch?
   - Current: skip document + log, continue batch (conservative)

6. **Incremental Sync**
   - Track last sync date → only import guides after that date
   - Avoids re-importing all 10 years of data every time
   - Simple: store `guias.ultima_sincronizacao` in `logistics.configuracao`

7. **Product Resolution**
   - Current: if `artigo_codigo` doesn't match a product, line is stored with `produto_id=null`
   - Option A: create products on demand (risky, auto-SKU generation)
   - Option B: reject line (strict, may block guide imports)
   - Option C: keep current (lenient, linhas.produto_id nullable, resolving later)
   → Recommend Option C for MVP, migrate to A/B post-launch

### Low Priority

8. **Pagination Optimization**
   - Current `max_pages=300` at 50/page = 15K guides per run
   - If dataset larger: increase pageSize or maxPages
   - Monitor via `sincronizacao_execucao` logs

9. **UI for Import Status**
   - Dashboard widget showing last sync time, # guides, errors
   - Manual "Sync Now" button
   - Browse `sincronizacao_execucao` audit log

10. **Documentation**
    - Runbook: how to configure ARTSOFT connection
    - Troubleshooting: common errors and fixes
    - Field mapping guide: how to add/remove fields at runtime

## How to Test Now (Dev)

### 1. Seed Test Data
```sql
-- logistics.configuracao (per enterprise)
INSERT INTO logistics.configuracao (empresa_id, chave, valor) VALUES
  (1, 'artsoft.host', 'artsoft.staging.example.com'),
  (1, 'artsoft.porta', '8000'),
  (1, 'artsoft.utilizador', 'sync_user'),
  (1, 'artsoft.senha', '...'),
  (1, 'guias.series', 'V960;V980'),  -- guide series to import
  (1, 'guias.tpsaft_validos', 'GR;GT;GA;GC;GD'),
  (1, 'guias.page_size', '50'),
  (1, 'guias.max_pages', '300'),
  (1, 'artsoft.timeout', '30000');

-- logistics.mapeamento_campo (guia_cabecalho, active)
INSERT INTO logistics.mapeamento_campo (empresa_id, contexto, campo, tag_xml, form_path, ativo, ordem) VALUES
  (1, 'guia_cabecalho', 'serie', 'DocSerie', '%DocFch.Doc.Serie', true, 1),
  (1, 'guia_cabecalho', 'numero', 'DocNrDoc', '%DocFch.Doc.NrDoc', true, 2),
  (1, 'guia_cabecalho', 'data_documento', 'DataDocum', '%DocFch.Doc.DataDocum', true, 3),
  -- ... add more active fields
  -- Inactive fields (to-be-confirmed paths):
  (1, 'guia_cabecalho', 'matricula', 'Matricula', '', false, 0),
  (1, 'guia_cabecalho', 'morada_carga', 'MoradaCarga', '', false, 0);

-- logistics.mapeamento_campo (guia_linha, active)
INSERT INTO logistics.mapeamento_campo (empresa_id, contexto, campo, tag_xml, form_path, ativo, ordem) VALUES
  (1, 'guia_linha', 'artigo_codigo', 'Artigo', '%DocLan.Cod.Codigo', true, 1),
  (1, 'guia_linha', 'descricao', 'Nome', '%DocLan.Nome', true, 2),
  (1, 'guia_linha', 'quantidade', 'Qtd', '%DocLan.Qtd.Movim', true, 3);
```

### 2. Run Sync (Node REPL or Script)
```javascript
import pkg from 'pg';
const { Client } = pkg;
import { sincronizarGuias } from './artsoft-sync/guias/sync.js';

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'ticsol_logistics_hub',
  user: 'postgres',
  password: '...',
});

await client.connect();
try {
  const resultado = await sincronizarGuias(client, 1, {
    logger: (msg) => console.log(`[SYNC] ${msg}`),
  });
  console.log(resultado);
} finally {
  await client.end();
}
```

### 3. Inspect Results
```sql
SELECT * FROM logistics.documento WHERE origem_sistema = 'ARTSOFT' LIMIT 5;
SELECT * FROM logistics.sincronizacao_execucao ORDER BY criado_em DESC LIMIT 1;
```

## Architecture Decisions

### Why `logistics.mapeamento_campo`?
**Problem:** ARTSOFT field paths vary across installations and evolve with versions. Hardcoding them in code means deploy per change.

**Solution:** Store mappings in a table. Flip `ativo` and update `form_path` = database change only. Query builder reads at sync time.

### Why Configurable Series?
**Problem:** `V960` in one DB, `V950` in another. Runtime import would fail on hard-coded expectations.

**Solution:** `logistics.configuracao[guias.series]` = `;`-separated list per enterprise. Filter in query, validate in parse.

### Why Full Line Refresh (DELETE + INSERT)?
**Problem:** Update-in-place requires matching linhas by natural key (documento_id, nr_linha?). If nr_linha changes or new lines added, inconsistency.

**Solution:** Treat linhas as ephemeral — delete all, insert new. Cheap for small docs (<100 linhas), atomic, predictable.

### Why `doc_id_artsoft`?
**Problem:** DocFch endpoint needs a unique ID to fetch forms and print PDFs. Serie/numero may not be unique across archives.

**Solution:** DocFch.Doc.ID (or built fallback) stored in `documento.origem_doc_id`, used later for DocPrintEx calls.

## Next Steps (In Order)

1. **Confirm field paths** (with real ARTSOFT admin or DocFch query)
2. **Update `logistics.mapeamento_campo` seed** with confirmed paths (ativo=true)
3. **Test against staging ARTSOFT** (E2E)
4. **Create backend sync endpoint** (`/api/artsoft/guias/sync`)
5. **Add scheduled job** (if needed)
6. **Resolve P0 security issues** (before prod)
7. **Monitor & iterate** (production rollout, feedback loop)

---
*Generated 2026-09-03 during Phase 2 implementation.*
