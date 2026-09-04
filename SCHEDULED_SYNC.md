# Phase 5: Scheduled Synchronization

**Status:** ✅ Implementado com node-cron

## Overview

Sincronização automática de guias de transporte em horário configurável.

### Features

- ✅ Cron schedule configurável (default: 2 AM UTC diariamente)
- ✅ Sincroniza todas as empresas ativas em paralelo (com limite concorrência)
- ✅ Logging detalhado por empresa
- ✅ Graceful shutdown (finaliza sincronizações em progresso)
- ✅ Pode ser desabilitado via env var

---

## Setup

### 1. Environment Variables

Adicionar ao `.env`:

```bash
# Habilitar cron job (default: true)
CRON_ENABLED=true

# Schedule em formato cron (default: 0 2 * * * = 2 AM UTC daily)
CRON_SCHEDULE="0 2 * * *"

# Formato cron: <minute> <hour> <day> <month> <weekday>
# Exemplos:
#   0 2 * * *       = 2 AM UTC, diariamente
#   0 */4 * * *     = A cada 4 horas
#   0 0 * * 0       = Domingo à meia-noite UTC
#   0 2 * * 1-5     = Segunda-sexta 2 AM UTC
```

### 2. Criar Tabela `logistics.empresa` (se não existir)

```sql
CREATE TABLE IF NOT EXISTS logistics.empresa (
  id SERIAL PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  ativa BOOLEAN DEFAULT true,
  criada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed
INSERT INTO logistics.empresa (nome, ativa)
VALUES ('Empresa Teste', true)
ON CONFLICT DO NOTHING;
```

### 3. Testar

```bash
# Com logging detalhado (não aguarda cron, sai imediatamente)
node artsoft-sync/cli.js --empresa-id 1

# Com API server (cron inicia automaticamente)
npm start
```

---

## How It Works

### Startup Sequence

```
1. API server inicia
2. Ler CRON_ENABLED, CRON_SCHEDULE do .env
3. Se CRON_ENABLED=true:
   → createSyncGuiasJob(pool, {schedule})
   → job.start()
   → Scheduler ativo (aguarda próximo horário)
4. Responder a requisições HTTP normalmente
```

### On Schedule (ex: 2 AM UTC)

```
1. Scheduler dispara automaticamente
2. Query: SELECT id, nome FROM logistics.empresa WHERE ativa = true
3. Para cada empresa:
   → sincronizarGuias(client, empresa_id, logger)
   → Log: progresso, documentos, linhas, erros
4. Resumo: N OK, M erros
```

### Example Log Output

```
[SYNC-JOB] Iniciando scheduler (cron: 0 2 * * *)…
[SYNC-JOB] Scheduler ativo.
...
[SYNC-JOB] Iniciando sincronização…
[SYNC-JOB] Sincronizando 2 empresa(s)…
[SYNC-JOB:1] Empresa A: iniciando…
[SYNC-JOB:1] Carregando config…
[SYNC-JOB:1] Ciclo de paginação: Página 1…
[SYNC-JOB:1] Empresa A: ✓ 42 docs, 247 linhas, 0 erros
[SYNC-JOB:2] Empresa B: iniciando…
[SYNC-JOB:2] Empresa B: ✓ 5 docs, 18 linhas, 1 erro
[SYNC-JOB] Concluído em 12.34s: 2 OK, 0 erro(s)
```

---

## Configuration

### Cron Schedule Syntax

```
┌───────────── minute (0-59)
│ ┌───────────── hour (0-23)
│ │ ┌───────────── day of month (1-31)
│ │ │ ┌───────────── month (1-12)
│ │ │ │ ┌───────────── day of week (0-6) (0 = Sunday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

### Common Schedules

| Schedule | Timing |
|----------|--------|
| `0 2 * * *` | 2 AM UTC, every day |
| `0 */6 * * *` | Every 6 hours |
| `0 3 * * 0` | Sunday 3 AM UTC |
| `0 2 * * 1-5` | Mon-Fri 2 AM UTC |
| `*/15 * * * *` | Every 15 minutes |

---

## Monitoring

### Check Execution Logs

```bash
# Container (Docker)
docker logs -f ticsol-api-server | grep SYNC-JOB

# Local (tail)
tail -f /var/log/ticsol-api-server.log | grep SYNC-JOB
```

### Check Database Audit Trail

```sql
SELECT
  correlation_id,
  estado,
  num_paginas,
  criado_em
FROM logistics.sincronizacao_execucao
WHERE empresa_id = 1
ORDER BY criado_em DESC
LIMIT 10;
```

### Alert on Failures

```sql
-- Guias: últimas 3 sincronizações por empresa
SELECT
  empresa_id,
  estado,
  COUNT(*) as execucoes,
  MAX(criado_em) as ultima
FROM logistics.sincronizacao_execucao
WHERE criado_em > NOW() - INTERVAL '3 days'
GROUP BY empresa_id, estado;
```

---

## Troubleshooting

### "Scheduler not starting"

Verificar:
1. `CRON_ENABLED=true` no .env?
2. Log ao iniciar: `[SYNC-JOB] Scheduler ativo`?
3. Erro na console ao startup?

Solução: `CRON_ENABLED=true npm start`

### "Job not running at scheduled time"

Verificar:
1. Timezone do servidor (cron usa UTC)
2. Schedule syntax correto?
3. Sincronizações anteriores ainda em progresso? (concurrent limit 3)

Teste: `node artsoft-sync/cli.js --empresa-id 1` (executa imediatamente)

### "Sync failed silently"

Verificar:
1. `logistics.sincronizacao_execucao` → estado != 'completo'
2. Logs da aplicação
3. Configuração ARTSOFT presente em `logistics.configuracao`?

---

## Performance Notes

- **Concorrência:** Max 3 empresas sincronizando em paralelo
- **Cada sync:** ~30-60s (depende do dataset ARTSOFT)
- **3 empresas:** ~30-60s total (paralelo)
- **Timeout:** 30s por query + 30s por HTTP request
- **Max docs/sync:** 15K (300 páginas × 50 per página)

Se tiver 10 empresas e schedule 2 AM:
- Pode não terminar antes das 3 AM se cada sync dura >20s
- Solução: aumentar `guias.max_pages` é arriscado; melhor: usar offset scheduling

---

## Advanced: Distributed Sync

Se tiver múltiplas instâncias de API server, cron vai executar em TODAS.

Evitar:

```bash
# ❌ Ambos executam sync simultaneamente
API_1: CRON_ENABLED=true
API_2: CRON_ENABLED=true
```

Alternativa (escolher uma):

```bash
# ✅ Opção 1: Disable em todas, usar external scheduler
API_1: CRON_ENABLED=false
API_2: CRON_ENABLED=false
# → Usar GitHub Actions, AWS Lambda, ou systemd timer

# ✅ Opção 2: Enable em 1, disable em outras
API_1: CRON_ENABLED=true   (primary)
API_2: CRON_ENABLED=false  (standby)
# → Primary faz sync; standby ativo para failover manual

# ✅ Opção 3: Distributed lock (advanced)
# → Usar Redis/PostgreSQL advisory lock antes de sync
```

---

## Migration from Phase 4

Phase 4 (User Auth) não muda nada de Phase 5.

Simplesmente:
1. Atualizar .env com `CRON_ENABLED=true`
2. `npm install` (instala node-cron)
3. `npm start` (scheduler inicia automaticamente)

---

## Future Enhancements

### Phase 5.1: Last Sync Tracking

```sql
UPDATE logistics.configuracao
SET valor = NOW()::TEXT
WHERE empresa_id = 1
AND chave = 'guias.ultima_sincronizacao';

-- Query: só import novos/modificados depuis última sync
WHERE DataDocum >= configuracao[guias.ultima_sincronizacao]
```

### Phase 5.2: Alerting

```bash
# Send alert on failure
POST /notify/slack
  {
    "message": "ARTSOFT sync failed for Empresa 1: ...",
    "severity": "error"
  }
```

### Phase 5.3: Distributed Lock

```sql
-- PostgreSQL advisory lock
SELECT pg_advisory_lock(123);
-- ... sync ...
SELECT pg_advisory_unlock(123);
```

### Phase 5.4: Metrics

```
prometheus_pushgateway:9091
  → Job duration, success rate, docs imported per hour
```

---

## Testing

### Manual Test

```bash
# Disable cron, trigger manually
CRON_ENABLED=false npm start

# In another terminal:
node artsoft-sync/cli.js --empresa-id 1
```

### Unit Test

```bash
# (Not yet implemented — add if needed)
npm test -- server/test/syncGuiasJob.test.js
```

### Integration Test

```bash
# 1. Apply migration
psql -d ticsol_logistics_hub -f database/09_usuarios.sql

# 2. Create test users
node server/bin/seed-usuarios.js --email admin@test.local --password teste123

# 3. Start server
npm start &

# 4. Monitor logs
tail -f /tmp/api-server.log | grep SYNC-JOB
```

---

## Deployment

### Production Checklist

- [ ] CRON_ENABLED=true
- [ ] CRON_SCHEDULE appropriate for timezone
- [ ] All empresas in logistics.empresa have ativa=true
- [ ] ARTSOFT config in logistics.configuracao per empresa
- [ ] Logs redirected to file/syslog
- [ ] Monitoring alert on `estado != 'completo'`
- [ ] Database backups before first cron run
- [ ] Test endpoint `/api/artsoft/guias/sync` works manually

---

*Atualizado: 2026-09-04*
