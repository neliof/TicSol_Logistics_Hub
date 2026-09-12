# Kubernetes Manifests — TicSol Logistics Hub

Production-ready Kubernetes deployment configuration for containerized warehouse management system.

## Prerequisites

- Kubernetes 1.24+
- `kubectl` CLI configured with cluster access
- Helm 3+ (optional, for package management)
- cert-manager for automatic SSL/TLS (recommended)
- Nginx Ingress Controller

### Install Dependencies (on cluster)

```bash
# Nginx Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install nginx-ingress ingress-nginx/ingress-nginx --namespace ingress-nginx --create-namespace

# cert-manager (for automatic TLS via Let's Encrypt)
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true
```

## Quick Deploy

### 1. Create Secrets (NEVER commit actual secrets)

```bash
kubectl create secret generic ticsol-secrets \
  --from-literal=db-password=$(openssl rand -base64 32) \
  --from-literal=jwt-secret=$(openssl rand -base64 32) \
  --from-literal=artsoft-user=admin \
  --from-literal=artsoft-password=YOUR_PASSWORD \
  -n ticsol-logistics
```

### 2. Deploy All Resources

```bash
# Using Kustomize (recommended)
kubectl apply -k k8s/

# Or apply files individually
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml
kubectl apply -f k8s/services.yaml
kubectl apply -f k8s/ingress.yaml
```

### 3. Wait for Readiness

```bash
# Monitor pod startup
kubectl get pods -n ticsol-logistics -w

# Check services
kubectl get svc -n ticsol-logistics

# View ingress
kubectl get ingress -n ticsol-logistics
```

### 4. Apply Database Migrations

```bash
# Exec into backend pod
kubectl exec -it deployment/backend -n ticsol-logistics -- /bin/sh

# Run migrations
npm run db:migrate
```

## File Structure

```
k8s/
├── namespace.yaml              # Kubernetes namespace
├── rbac.yaml                   # ServiceAccounts & Roles
├── configmap.yaml              # Non-secret configuration
├── secrets-template.yaml       # Template (DO NOT USE DIRECTLY)
├── postgres-statefulset.yaml   # Database with persistent storage
├── backend-deployment.yaml     # API server (3 replicas)
├── frontend-deployment.yaml    # React app (2 replicas)
├── services.yaml               # ClusterIP services
├── ingress.yaml                # Nginx ingress with TLS
├── kustomization.yaml          # Resource management
└── README.md                   # This file
```

## Configuration

### ConfigMap (non-secret settings)

Edit `k8s/configmap.yaml` for:
- Database host/port/name/user
- API endpoints and CORS
- ARTSOFT integration host/port
- Logging level/format

### Secrets (secure settings)

Create via `kubectl create secret`:
- Database password
- JWT secret
- ARTSOFT credentials

**NEVER commit secrets to Git. Use:**
- Sealed Secrets (recommended for GitOps)
- External Secrets Operator
- ArgoCD with Vault/AWS Secrets Manager
- kubectl create secret manually

## Deployment Patterns

### Rolling Update

Deployments use rolling updates (default):
```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1           # 1 extra pod during update
    maxUnavailable: 0     # Never drop to 0 pods
```

### Health Checks

All pods have:
- **Liveness probe:** Restart if unhealthy
- **Readiness probe:** Remove from service if not ready
- **Startup probe:** Wait for app startup

### Resource Management

**Backend:**
```yaml
requests:
  cpu: 250m      # minimum
  memory: 512Mi
limits:
  cpu: 500m      # maximum
  memory: 1Gi
```

**Frontend:**
```yaml
requests:
  cpu: 100m
  memory: 256Mi
limits:
  cpu: 200m
  memory: 512Mi
```

**Database (PostgreSQL):**
```yaml
requests:
  cpu: 500m
  memory: 1Gi
limits:
  cpu: 1000m
  memory: 2Gi
```

### Pod Anti-Affinity

Backend and frontend pods prefer different nodes (high availability):
```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution: [...]
```

## Scaling

### Horizontal Pod Autoscaling (HPA)

Optional: Auto-scale based on CPU/memory:

```bash
kubectl autoscale deployment backend \
  --min=3 --max=10 \
  --cpu-percent=80 \
  -n ticsol-logistics
```

### Manual Scaling

```bash
# Scale backend to 5 replicas
kubectl scale deployment backend --replicas=5 -n ticsol-logistics

# Scale frontend to 3 replicas
kubectl scale deployment frontend --replicas=3 -n ticsol-logistics
```

## Monitoring & Logging

### View Logs

```bash
# Real-time backend logs
kubectl logs -f deployment/backend -n ticsol-logistics

# Logs from specific pod
kubectl logs pod-name -n ticsol-logistics

# Last 100 lines from all backend pods
kubectl logs -l app=ticsol-backend -n ticsol-logistics --tail=100
```

### Port Forwarding (for debugging)

```bash
# Forward backend (localhost:3000 → pod:3000)
kubectl port-forward svc/backend 3000:3000 -n ticsol-logistics

# Forward database (localhost:5432 → pod:5432)
kubectl port-forward svc/postgres 5432:5432 -n ticsol-logistics
```

### Get Pod Status

```bash
# All pods in namespace
kubectl get pods -n ticsol-logistics

# Detailed pod info
kubectl describe pod POD_NAME -n ticsol-logistics

# Events and resource usage
kubectl top pod -n ticsol-logistics
```

## Networking

### DNS Names (within cluster)

- Backend: `backend.ticsol-logistics.svc.cluster.local:3000`
- Frontend: `frontend.ticsol-logistics.svc.cluster.local:80`
- Database: `postgres.ticsol-logistics.svc.cluster.local:5432`

### External Access (via Ingress)

- API: `https://api.ticsol.com`
- Frontend: `https://app.ticsol.com`

Requires:
- DNS pointing to Ingress IP
- SSL certificate (auto-provisioned by cert-manager)

## Database

### Backup

```bash
# Backup database to file
kubectl exec postgres-0 -n ticsol-logistics -- \
  pg_dump -U app_user ticsol_logistics_hub > backup.sql
```

### Restore

```bash
# Restore from backup
kubectl exec -i postgres-0 -n ticsol-logistics -- \
  psql -U app_user ticsol_logistics_hub < backup.sql
```

### Persistent Storage

PostgreSQL data stored in PersistentVolumeClaim:
- Storage class: `standard`
- Size: 50Gi (adjust in `postgres-statefulset.yaml`)
- Access mode: ReadWriteOnce

## Troubleshooting

### Pod won't start

```bash
# Check pod status
kubectl describe pod POD_NAME -n ticsol-logistics

# Check logs for errors
kubectl logs POD_NAME -n ticsol-logistics

# Common issues:
# - Image pull error: Wrong image URL or no DockerHub access
# - CrashLoopBackOff: Application crashed, check logs
# - Pending: Not enough resources, scale down or add nodes
```

### Database connection errors

```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:16-alpine \
  --restart=Never -- psql -h postgres -U app_user -d ticsol_logistics_hub

# Check database service
kubectl get svc postgres -n ticsol-logistics
```

### Ingress not working

```bash
# Check ingress
kubectl describe ingress ticsol-ingress -n ticsol-logistics

# Check cert status
kubectl get certificate -n ticsol-logistics

# Check Nginx ingress logs
kubectl logs -l app.kubernetes.io/name=ingress-nginx -n ingress-nginx
```

### Out of storage

```bash
# Check PVC usage
kubectl get pvc -n ticsol-logistics

# Resize PVC (note: only works with certain storage classes)
kubectl patch pvc postgres-pvc -n ticsol-logistics \
  -p '{"spec":{"resources":{"requests":{"storage":"100Gi"}}}}'
```

## Production Checklist

- [ ] Secrets created (not hardcoded)
- [ ] Images pushed to registry (GHCR)
- [ ] DNS configured (api.ticsol.com, app.ticsol.com)
- [ ] SSL certificate working (cert-manager)
- [ ] Database backup strategy in place
- [ ] Resource requests/limits set appropriately
- [ ] Pod anti-affinity configured (multi-node)
- [ ] Monitoring/alerting configured
- [ ] Liveness/readiness probes working
- [ ] Application logs streaming to central log system
- [ ] Network policies configured (optional)
- [ ] RBAC roles minimal (least privilege)

## Upgrade Path

### Update container image

```bash
# Set new image tag
kubectl set image deployment/backend \
  backend=ghcr.io/your-org/ticsol/backend:v1.1.0 \
  -n ticsol-logistics

# Watch rollout
kubectl rollout status deployment/backend -n ticsol-logistics

# Rollback if issues
kubectl rollout undo deployment/backend -n ticsol-logistics
```

## GitOps (ArgoCD)

Save manifests to Git and sync via ArgoCD:

```bash
# Install ArgoCD
helm repo add argo https://argoproj.github.io/argo-helm
helm install argocd argo/argo-cd --namespace argocd --create-namespace

# Create ArgoCD Application
kubectl apply -f - <<EOF
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ticsol-logistics
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/your-org/ticsol-logistics-hub
    targetRevision: master
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: ticsol-logistics
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
EOF
```

## Support

- Kubernetes docs: https://kubernetes.io/docs/
- Kustomize: https://kustomize.io/
- cert-manager: https://cert-manager.io/
- Nginx Ingress: https://kubernetes.github.io/ingress-nginx/
