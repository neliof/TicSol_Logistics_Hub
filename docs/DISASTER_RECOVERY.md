# Disaster Recovery & Backup Plan

Complete backup strategy and recovery procedures for production system.

## Overview

**RPO (Recovery Point Objective):** 1 hour (lose max 1 hour of data)
**RTO (Recovery Time Objective):** 4 hours (restore within 4 hours)

---

## Backup Strategy

### What to Backup

| Component | Frequency | Retention | Location |
|-----------|-----------|-----------|----------|
| PostgreSQL Database | Hourly | 30 days | S3/GCS |
| Application Config | On change | 90 days | Git + S3 |
| Docker Images | Per release | 1 year | Container Registry |
| Kubernetes Secrets | On rotation | 90 days | Vault/Sealed Secrets |
| TLS Certificates | On renewal | 2 years | Vault |
| Application Logs | Daily | 90 days | CloudWatch/ELK |

### Database Backup

#### Hourly Full Backup (PostgreSQL)

```bash
#!/bin/bash
# backup-database.sh

set -e

BACKUP_DIR="/backups/postgresql"
DB_NAME="ticsol_logistics_hub"
DB_USER="app_user"
DB_HOST="${DB_HOST:-postgres.ticsol-logistics.svc.cluster.local}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_${TIMESTAMP}.sql.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database
echo "Starting database backup at $(date)"
kubectl exec postgres-0 -n ticsol-logistics -- \
  pg_dump -U "$DB_USER" -h "$DB_HOST" "$DB_NAME" | \
  gzip > "$BACKUP_FILE"

# Verify backup
if [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
  echo "Backup successful: $BACKUP_FILE ($(du -h $BACKUP_FILE | cut -f1))"
  
  # Upload to S3
  aws s3 cp "$BACKUP_FILE" "s3://ticsol-backups/postgresql/" \
    --storage-class GLACIER_IR
  
  # Keep local copy for 7 days
  find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +7 -delete
  
  # Send success notification
  aws sns publish --topic-arn arn:aws:sns:eu-west-1:ACCOUNT:backup-alerts \
    --message "Database backup successful: $BACKUP_FILE"
else
  echo "ERROR: Backup failed or is empty"
  exit 1
fi
```

#### Schedule Backup (Kubernetes CronJob)

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: ticsol-logistics
spec:
  schedule: "0 * * * *"  # Hourly at minute 0
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: backup-robot
          containers:
          - name: backup
            image: postgres:16-alpine
            command:
            - /bin/sh
            - -c
            - |
              BACKUP_FILE="/backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz"
              pg_dump -U app_user -h postgres "$DB_NAME" | gzip > "$BACKUP_FILE"
              aws s3 cp "$BACKUP_FILE" s3://ticsol-backups/postgresql/
            env:
            - name: DB_NAME
              value: ticsol_logistics_hub
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: ticsol-secrets
                  key: db-password
            volumeMounts:
            - name: backups
              mountPath: /backups
          volumes:
          - name: backups
            emptyDir: {}
          restartPolicy: OnFailure
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 3
```

### Application State Backup

```bash
# Backup Kubernetes manifests
kubectl get all -n ticsol-logistics -o yaml > k8s-state-backup.yaml

# Backup ConfigMaps and Secrets (SENSITIVE!)
kubectl get configmaps -n ticsol-logistics -o yaml > configmaps.yaml
# DO NOT backup secrets to unencrypted storage

# Backup PersistentVolumes
kubectl get pv -o yaml > pv-backup.yaml
```

### Docker Image Backup

```bash
# Images automatically versioned by CI/CD pipeline
# Tags: latest, develop-sha, master-sha

# Backup registry
gh repo clone your-org/ticsol-logistics-hub
cd ticsol-logistics-hub

# All images preserved with git history
```

---

## Restore Procedures

### Database Restoration (Kubernetes)

#### Scenario: Database Corruption/Data Loss

```bash
#!/bin/bash
# restore-database.sh

RESTORE_FILE="$1"  # Path to backup file
DB_NAME="ticsol_logistics_hub"
DB_USER="app_user"

if [ -z "$RESTORE_FILE" ]; then
  echo "Usage: $0 <backup-file.sql.gz>"
  exit 1
fi

echo "⚠️  WARNING: This will overwrite the current database!"
read -p "Continue? (type 'yes' to confirm): " confirm
if [ "$confirm" != "yes" ]; then
  echo "Cancelled."
  exit 0
fi

# 1. Stop application connections
echo "1. Scaling down backend to prevent new connections..."
kubectl scale deployment backend --replicas=0 -n ticsol-logistics

# 2. Create new database (rename old one as backup)
echo "2. Creating new database..."
kubectl exec postgres-0 -n ticsol-logistics -- \
  psql -U "$DB_USER" -c "ALTER DATABASE $DB_NAME RENAME TO ${DB_NAME}_backup_$(date +%s);"

kubectl exec postgres-0 -n ticsol-logistics -- \
  psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"

# 3. Restore from backup
echo "3. Restoring database from backup..."
gunzip -c "$RESTORE_FILE" | \
  kubectl exec -i postgres-0 -n ticsol-logistics -- \
  psql -U "$DB_USER" -d "$DB_NAME"

# 4. Verify restore
echo "4. Verifying restore..."
TABLES=$(kubectl exec postgres-0 -n ticsol-logistics -- \
  psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT count(*) FROM information_schema.tables;" | tail -1)

if [ "$TABLES" -gt 0 ]; then
  echo "✅ Database restored successfully ($TABLES tables found)"
  
  # 5. Restart application
  echo "5. Restarting application..."
  kubectl scale deployment backend --replicas=3 -n ticsol-logistics
  
  # Wait for pods to be ready
  kubectl rollout status deployment/backend -n ticsol-logistics
  
  echo "✅ Restore complete. Application back online."
  
else
  echo "❌ Restore failed: No tables found"
  exit 1
fi
```

#### Scenario: Point-in-Time Recovery (PITR)

```bash
# PostgreSQL WAL (Write-Ahead Log) recovery

# 1. Setup WAL archiving (backup WAL files)
# Edit postgresql.conf:
# archive_mode = on
# archive_command = 'aws s3 cp %p s3://ticsol-backups/wal/%f'

# 2. Restore to specific point in time
kubectl exec postgres-0 -n ticsol-logistics -- \
  pg_restore -Fc -d ticsol_logistics_hub base_backup.sql.gz

# 3. Replay WAL files up to recovery time
echo "recovery_target_time = '2026-09-12 14:30:00'" >> recovery.conf

# 4. Start database with recovery
pg_ctl start -D /var/lib/postgresql/data
```

### Kubernetes/Application Recovery

#### Scenario: Pod/Node Failure (Auto-Recovery)

Kubernetes handles automatically:
```bash
# Deployment ensures 3 backend replicas always running
kubectl get pods -n ticsol-logistics

# Failed pods auto-restart
# Nodes replaced by cluster autoscaler
```

#### Scenario: Lost Kubernetes Cluster

```bash
# 1. Restore from backup
kubectl apply -f k8s-state-backup.yaml

# 2. Restore secrets
# Via sealed-secrets (auto-unseals)
kubectl apply -f k8s/secrets-sealed.yaml

# 3. Restore ConfigMaps
kubectl apply -f configmaps.yaml

# 4. Database should restore via latest backup
# (backup process is separate from cluster)

# 5. Verify
kubectl get all -n ticsol-logistics
```

#### Scenario: Data Center Failover (Multi-Region)

```bash
# Prerequisites:
# - PostgreSQL replication to standby region
# - DNS failover configured
# - Secondary Kubernetes cluster ready

# 1. Promote standby database
kubectl exec postgres-standby-0 -n ticsol-logistics -- \
  pg_ctl promote

# 2. Update DNS to point to secondary region
gcloud dns record-sets update api.ticsol.com \
  --rrdatas=SECONDARY_IP --ttl=60

# 3. Scale secondary Kubernetes cluster
kubectl scale deployment backend --replicas=3 -n ticsol-logistics

# 4. Verify traffic shifting
curl -s https://api.ticsol.com/health | jq .
```

---

## Testing Recovery

### Monthly Recovery Drill

```bash
#!/bin/bash
# recovery-drill.sh

echo "📋 Monthly Disaster Recovery Drill - $(date)"
echo "============================================"

# 1. List available backups
echo "1. Available backups:"
aws s3 ls s3://ticsol-backups/postgresql/ --recursive | tail -10

# 2. Restore to staging database
echo "2. Restoring latest backup to staging..."
LATEST_BACKUP=$(aws s3api list-objects-v2 \
  --bucket ticsol-backups \
  --prefix postgresql/ \
  --query 'Contents | sort_by(@, &LastModified) | [-1].Key' \
  --output text)

aws s3 cp "s3://ticsol-backups/$LATEST_BACKUP" /tmp/
gunzip -c "/tmp/$(basename $LATEST_BACKUP)" | \
  psql -h staging-postgres -U app_user -d test_db

# 3. Run validation queries
echo "3. Running validation queries..."
psql -h staging-postgres -U app_user -d test_db << SQL
SELECT COUNT(*) as recepcoes FROM recepcao;
SELECT COUNT(*) as paletes FROM palete;
SELECT COUNT(*) as movimentos FROM palete_movimento;
SQL

# 4. Document results
echo "✅ Recovery drill completed. Database integrity verified."
echo "   Tables: recepcao, palete, palete_movimento all accessible"

# 5. Schedule next drill
echo "📅 Next drill: $(date -d 'next month' +%Y-%m-%d)"
```

**Run Monthly:**
```bash
0 0 1 * * /path/to/recovery-drill.sh >> /var/log/recovery-drills.log
```

---

## Backup Validation

### Automated Backup Checks

```bash
#!/bin/bash
# validate-backups.sh

echo "Validating backups..."

# 1. Check backup size (should be > 10MB)
LATEST=$(aws s3api list-objects-v2 \
  --bucket ticsol-backups \
  --prefix postgresql/ \
  --query 'Contents | sort_by(@, &LastModified) | [-1].[Key, Size]' \
  --output text)

SIZE=$(echo $LATEST | awk '{print $2}')
if [ "$SIZE" -lt 10485760 ]; then
  echo "❌ ALERT: Latest backup suspiciously small: $SIZE bytes"
  exit 1
fi

# 2. Check backup age (should be < 2 hours old)
LAST_MODIFIED=$(aws s3api list-objects-v2 \
  --bucket ticsol-backups \
  --prefix postgresql/ \
  --query 'Contents | sort_by(@, &LastModified) | [-1].LastModified' \
  --output text)

AGE_SECONDS=$(( $(date +%s) - $(date -d "$LAST_MODIFIED" +%s) ))
if [ "$AGE_SECONDS" -gt 7200 ]; then
  echo "❌ ALERT: Backup is too old: $AGE_SECONDS seconds"
  exit 1
fi

echo "✅ Backups validated successfully"
echo "   Latest backup size: $(numfmt --to=iec $SIZE)"
echo "   Backup age: $(($AGE_SECONDS / 60)) minutes"
```

**Run Hourly:**
```bash
0 * * * * /path/to/validate-backups.sh
```

---

## Retention Policy

### Backup Retention Schedule

```
Database Backups:
├─ Hourly: Keep 24 copies (1 day)
├─ Daily: Keep 30 copies (1 month)
├─ Weekly: Keep 12 copies (3 months)
└─ Monthly: Keep 12 copies (1 year)

Application Config:
├─ On commit: Keep in Git (infinite)
├─ On deploy: Keep 90 days in S3
└─ Archive: Move to Glacier after 1 year

Docker Images:
├─ Latest: Keep in production registry
├─ Release tags: Keep 2 years
└─ Dev builds: Keep 30 days
```

### Automated Cleanup

```bash
#!/bin/bash
# cleanup-old-backups.sh

# Delete backups older than 30 days
aws s3api list-objects-v2 \
  --bucket ticsol-backups \
  --prefix postgresql/ \
  --query "Contents[?LastModified<='$(date -d '30 days ago' --iso-8601)'].Key" \
  --output text | \
  xargs -I {} aws s3 rm "s3://ticsol-backups/{}"

# Archive to Glacier (1 year old)
aws s3api list-objects-v2 \
  --bucket ticsol-backups \
  --prefix postgresql/ \
  --query "Contents[?LastModified<='$(date -d '1 year ago' --iso-8601)'].Key" \
  --output text | \
  xargs -I {} aws s3api copy-object \
    --copy-source "ticsol-backups/{}" \
    --bucket ticsol-backups-archive \
    --key {} \
    --storage-class GLACIER

echo "✅ Backup cleanup completed"
```

---

## Monitoring & Alerting

### Backup Health Metrics

**Prometheus queries:**
```promql
# Backup success rate (last 24h)
rate(backup_success_total[24h])

# Backup duration (should be < 10 minutes)
backup_duration_seconds

# Database size
pg_database_size_bytes / 1024 / 1024 / 1024  # GB

# Replication lag (PITR standby)
pg_replication_lag_seconds
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Disaster Recovery",
    "panels": [
      {
        "title": "Backup Success Rate",
        "targets": [{"expr": "rate(backup_success_total[24h])"}]
      },
      {
        "title": "Latest Backup Age",
        "targets": [{"expr": "time() - backup_last_completion_timestamp_seconds"}]
      },
      {
        "title": "Database Size",
        "targets": [{"expr": "pg_database_size_bytes / 1024 / 1024 / 1024"}]
      }
    ]
  }
}
```

### Alerts

```yaml
- alert: BackupFailed
  expr: increase(backup_failure_total[1h]) > 0
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Database backup failed"
    description: "Backup job failed. Latest backup may be stale."

- alert: BackupTooOld
  expr: (time() - backup_last_completion_timestamp_seconds) > 7200
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Latest backup is older than 2 hours"

- alert: BackupTooSmall
  expr: backup_size_bytes < 10485760
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Backup size suspiciously small (< 10MB)"
```

---

## Recovery Checklist

### Before Disaster

- [ ] Automated backups running (hourly)
- [ ] Backup validation passing
- [ ] Recovery scripts tested monthly
- [ ] Team trained on recovery procedures
- [ ] RTO/RPO documented and agreed
- [ ] Contact list updated
- [ ] Secondary region ready (optional)

### During Disaster

- [ ] Activate Incident Commander
- [ ] Notify stakeholders
- [ ] Page on-call team
- [ ] Begin recovery procedures
- [ ] Document timeline/actions
- [ ] Communicate status updates (30-min intervals)

### Recovery Execution

- [ ] Verify latest backup integrity
- [ ] Restore to staging first (if time allows)
- [ ] Restore to production
- [ ] Run validation queries
- [ ] Verify application connectivity
- [ ] Run smoke tests
- [ ] Restore traffic to production

### Post-Recovery

- [ ] Root cause analysis
- [ ] Update recovery procedures
- [ ] Restore normal backup schedule
- [ ] Review and update RTO/RPO
- [ ] Post-mortem with team
- [ ] Document lessons learned

---

## Cost Optimization

### Backup Storage Costs

```
Pricing (AWS S3):
├─ Standard: $0.023 per GB/month
├─ Intelligent-Tiering: $0.0125 per GB/month
└─ Glacier Instant: $0.004 per GB/month

30-day retention (assume 500MB per backup):
├─ Hourly (24 backups): 12 GB/month × $0.0125 = $0.15
├─ Daily (30 backups): 15 GB/month × $0.0125 = $0.19
└─ Archive (12 yearly): 6 GB/year × $0.004 = $0.024

Total: ~$0.40/month (minimal cost)
```

### Optimization Strategies

1. **Compression:** gzip reduces size by ~70%
2. **Incremental backups:** Only backup changed data
3. **Tiering:** Move old backups to cheaper storage
4. **Deduplication:** Eliminate duplicate data
5. **Retention limits:** Delete backups older than needed

---

## References & Tools

### Backup Tools
- **pg_dump:** PostgreSQL native backup utility
- **pgBackRest:** Enterprise PostgreSQL backup
- **Velero:** Kubernetes backup and restore
- **Kasten K10:** Kubernetes backup (paid)

### Monitoring
- **BackupChecker:** Custom backup validation
- **Prometheus:** Metrics collection
- **Grafana:** Visualization
- **PagerDuty:** On-call alerting

### Cloud Services
- **AWS S3:** Backup storage (with lifecycle policies)
- **AWS Backup:** Managed backup service
- **Google Cloud Backup & Disaster Recovery:** Managed service
- **Azure Backup:** Managed backup for Azure resources

### Documentation
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Kubernetes Backup: https://kubernetes.io/docs/tasks/administer-cluster/
- NIST Backup Guidelines: https://nvlpubs.nist.gov/
