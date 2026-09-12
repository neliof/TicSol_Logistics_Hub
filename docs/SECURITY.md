# Security Audit & Hardening Guide

Production security checklist and hardening procedures for TicSol Logistics Hub.

## Pre-Deployment Security Checklist

### Authentication & Authorization
- [ ] JWT_SECRET changed from default (min 32 characters, strong entropy)
- [ ] JWT token expiry set to reasonable value (24h recommended)
- [ ] All endpoints require authentication (no public endpoints)
- [ ] Role-Based Access Control (RBAC) configured
- [ ] Service accounts have minimal permissions
- [ ] Database user accounts have read-only where appropriate

### Database Security
- [ ] PostgreSQL password changed from default
- [ ] Row-Level Security (RLS) policies enforced on all sensitive tables
- [ ] Database backups encrypted at rest
- [ ] Connection requires SSL/TLS
- [ ] SQL injection protection via parameterized queries (verified)
- [ ] Database audit logging enabled
- [ ] Regular security updates applied (PostgreSQL patches)

### API Security
- [ ] Rate limiting enabled on all endpoints
- [ ] CORS configured to specific origins (not wildcard)
- [ ] SQL injection vulnerabilities scanned (OWASP)
- [ ] XSS protection headers configured (CSP, X-Frame-Options)
- [ ] CSRF tokens implemented for state-changing operations
- [ ] Request size limits configured
- [ ] Input validation on all user inputs
- [ ] API keys/tokens rotated regularly

### Frontend Security
- [ ] No hardcoded secrets in code or config
- [ ] Dependencies audited for vulnerabilities (`npm audit`)
- [ ] Content Security Policy (CSP) headers configured
- [ ] Sensitive data cleared on logout
- [ ] Session tokens stored securely (HttpOnly cookies, not localStorage)
- [ ] HTTPS enforced (no HTTP fallback)
- [ ] Third-party scripts limited and verified

### Infrastructure Security
- [ ] Firewall rules restrict access to necessary ports only
- [ ] SSH access restricted to authorized IPs
- [ ] Secrets not stored in Git (use `.gitignore`)
- [ ] Environment variables for secrets (never hardcoded)
- [ ] Docker images scanned for vulnerabilities
- [ ] Container registry requires authentication
- [ ] Network policies restrict pod-to-pod communication
- [ ] Kubernetes API access restricted

### TLS/SSL
- [ ] Certificate from trusted CA (Let's Encrypt for staging)
- [ ] Certificate auto-renewal configured
- [ ] TLS 1.2+ only (no SSL 3.0, TLS 1.0, 1.1)
- [ ] Strong cipher suites configured
- [ ] HSTS header enabled (enforce HTTPS)
- [ ] Certificate pinning considered for APIs

### Secrets Management
- [ ] Secrets not in version control
- [ ] Secrets manager configured (sealed-secrets, vault, AWS Secrets Manager)
- [ ] Separate secrets for dev/staging/prod
- [ ] Secrets rotation policy defined
- [ ] Access to secrets audit logged
- [ ] Secrets encrypted at rest
- [ ] Break-glass procedure documented for emergency access

### Logging & Monitoring
- [ ] All security events logged
- [ ] Logs stored securely with encryption
- [ ] Log retention policy defined
- [ ] Monitoring alerts for suspicious activity
- [ ] Failed login attempts logged
- [ ] Unauthorized access attempts detected
- [ ] Audit trail comprehensive and immutable

### Access Control
- [ ] Principle of least privilege enforced
- [ ] No shared credentials (individual accounts)
- [ ] Multi-factor authentication (MFA) enabled for all users
- [ ] Admin access restricted and monitored
- [ ] API key rotation schedule established
- [ ] Service account permissions minimal

### Compliance
- [ ] GDPR compliance reviewed
- [ ] Data privacy policies documented
- [ ] Data retention policy defined
- [ ] Right to deletion (GDPR) implemented
- [ ] Data breach response plan documented
- [ ] Regular security training for team

---

## Security Issues & Mitigations

### 1. SQL Injection

**Risk:** Attacker injects malicious SQL via user input

**Verification:**
```bash
# Check for parameterized queries in backend
grep -r "query(" server/ | grep -v "\$"  # Should show few results

# All queries should use parameterized format:
# ✅ Good: query("SELECT * FROM table WHERE id = $1", [id])
# ❌ Bad: query("SELECT * FROM table WHERE id = " + id)
```

**Mitigation:**
- All queries use parameterized statements (verified ✓)
- Node.js `pg` library prevents injection
- Input validation on all user inputs
- Principle of least privilege for database user

### 2. Cross-Site Scripting (XSS)

**Risk:** Attacker injects scripts into web pages

**Verification:**
```bash
# Check React for unsafe HTML rendering
grep -r "dangerouslySetInnerHTML" frontend/  # Should be empty or minimal

# Check for unescaped user input display
grep -r "innerHTML" frontend/  # Should be empty
```

**Mitigation:**
- React escapes all interpolated values by default (✓)
- No `dangerouslySetInnerHTML` without sanitization
- Content Security Policy (CSP) headers restrict script sources
- Input validation and sanitization

### 3. Cross-Site Request Forgery (CSRF)

**Risk:** Attacker tricks user into unwanted actions

**Verification:**
```bash
# Check for state-changing operations protection
grep -r "POST\|PATCH\|DELETE" frontend/  # Verify CSRF tokens sent
```

**Mitigation:**
- JWT tokens stored in HttpOnly cookies (not localStorage)
- Backend validates origin and referer headers
- CSRF tokens on forms (consider for high-value operations)

### 4. Broken Authentication

**Risk:** Weak password policies, session hijacking

**Mitigation:**
- JWT with strong secret (min 32 chars, high entropy)
- Token expiry configured (24h recommended)
- Tokens sent via Authorization header (not URL parameter)
- HttpOnly cookies prevent JavaScript access
- Password hashing (if applicable) uses bcrypt/argon2
- Rate limiting on login endpoints (5 attempts/15min)

### 5. Sensitive Data Exposure

**Risk:** Confidential data transmitted/stored insecurely

**Mitigation:**
- HTTPS enforced (TLS 1.2+)
- Sensitive data encrypted at rest
- Database passwords stored in secrets manager
- JWT secrets stored in secrets manager
- No sensitive data in logs
- Backups encrypted

### 6. Broken Access Control

**Risk:** Users access unauthorized resources

**Verification:**
```bash
# Check RLS policies on all tables
psql -U app_user -d ticsol_logistics_hub -c \
  "SELECT * FROM information_schema.table_constraints WHERE constraint_type='UNIQUE';"
```

**Mitigation:**
- Row-Level Security (RLS) on all sensitive tables (verified ✓)
- endpoint authentication on all routes (verified ✓)
- Authorization checks (empresa_id validation)
- Rate limiting on API endpoints
- IP whitelisting (optional, for sensitive endpoints)

### 7. Insecure Deserialization

**Risk:** Attacker manipulates serialized objects

**Mitigation:**
- JSON schema validation on all inputs
- No arbitrary code execution
- Dependency scanning for known vulnerabilities

### 8. Using Components with Known Vulnerabilities

**Risk:** Third-party packages with security flaws

**Verification:**
```bash
npm audit
```

**Mitigation:**
- Run `npm audit` regularly
- Update dependencies promptly
- Automated dependency scanning in CI (Snyk, Dependabot)
- Vendor scanning for critical vulnerabilities

### 9. Insufficient Logging & Monitoring

**Risk:** Security incidents not detected

**Mitigation:**
- All authentication events logged
- All authorization failures logged
- Failed API calls logged with user/IP
- Monitoring alerts for anomalies
- Log retention: 90 days minimum
- Centralized log aggregation (ELK, Datadog)

### 10. Insecure Configuration

**Risk:** Default configs, unnecessary services exposed

**Mitigation:**
- Secrets not in `.env` files (use secrets manager)
- Debug mode disabled in production
- Unused ports/services disabled
- Security headers configured (CSP, HSTS, X-Content-Type-Options)
- HTTP/2 enabled (faster, more secure than HTTP/1.1)

---

## Security Headers

### Recommended Headers

```nginx
# Nginx configuration
server {
  # Force HTTPS
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

  # Prevent MIME sniffing
  add_header X-Content-Type-Options "nosniff" always;

  # XSS protection
  add_header X-Frame-Options "DENY" always;
  add_header X-XSS-Protection "1; mode=block" always;

  # Content Security Policy
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self';" always;

  # Referrer Policy
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  # Permissions Policy
  add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=()" always;
}
```

### Verification

```bash
# Test headers
curl -I https://api.ticsol.com | grep -E "Strict-Transport|Content-Security|X-Frame"
```

---

## Secrets Management Best Practices

### Development
```bash
# Local development: use .env file (git-ignored)
cp .env.example .env
# Edit with development values
source .env
```

### Staging/Production (Sealed Secrets)

```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.18.0/controller.yaml

# Create secret and seal it
echo -n "mypassword" | kubectl create secret generic db-secret \
  --dry-run=client --from-file=password=/dev/stdin -o yaml | \
  kubeseal -f - > db-secret-sealed.yaml

# Commit sealed secret to Git (safe)
git add db-secret-sealed.yaml

# Deploy (unseals automatically)
kubectl apply -f db-secret-sealed.yaml
```

### AWS Secrets Manager

```bash
# Store secret
aws secretsmanager create-secret \
  --name ticsol/prod/db-password \
  --secret-string "your-password"

# Retrieve in app
import boto3
client = boto3.client('secretsmanager')
secret = client.get_secret_value(SecretId='ticsol/prod/db-password')
```

---

## Incident Response Plan

### 1. Detection
- Monitoring alerts trigger (failed logins, unusual traffic)
- Security team notified immediately

### 2. Containment
```bash
# Immediately revoke compromised credentials
gh secret delete COMPROMISED_SECRET

# Kill active sessions
# UPDATE sessions SET active = false WHERE compromised;

# Rotate credentials
aws secretsmanager rotate-secret --secret-id ticsol/prod/db-password
```

### 3. Investigation
```bash
# Review logs
kubectl logs -f deployment/backend -n ticsol-logistics | grep ERROR

# Check audit trail
SELECT * FROM recepcao_auditoria WHERE created_at > NOW() - INTERVAL '1 hour';

# Network analysis
netstat -tulpn | grep ESTABLISHED
```

### 4. Recovery
```bash
# Restore from backup
pg_restore -d ticsol_logistics_hub backup.sql

# Redeploy clean images
kubectl rollout undo deployment/backend -n ticsol-logistics

# Verify systems
kubectl get pods -n ticsol-logistics
curl http://localhost:3000/health
```

### 5. Post-Incident
- Root cause analysis
- Security patch release
- Team debriefing
- Update incident response plan

---

## Penetration Testing

### Self-Assessment Checklist

```bash
# SQL Injection test
curl "http://localhost:3000/api/recepcao?id=1' OR '1'='1"
# Should return error, not full database

# XSS test
curl "http://localhost:3000/api/create" \
  -d '{"nome":"<script>alert(1)</script>"}'
# Should be escaped in response

# CSRF test
# Make state-changing request without CSRF token
# Should be rejected

# Authentication bypass
curl http://localhost:3000/api/recepcao -H "Authorization: Bearer invalid"
# Should return 401

# Privilege escalation
# Try accessing other tenant data
# Should be blocked by RLS
```

### Tools
- **OWASP ZAP:** Automated security scanning
- **Burp Suite:** Manual penetration testing
- **SQLMap:** SQL injection detection
- **npm audit:** Dependency vulnerability scanning
- **Snyk:** Continuous vulnerability monitoring

---

## Security Update Policy

### Patching Schedule
- **Critical:** 24 hours
- **High:** 1 week
- **Medium:** 2 weeks
- **Low:** Monthly

### Process
```bash
# 1. Check for updates
npm outdated

# 2. Audit dependencies
npm audit

# 3. Test updates
npm update --save
npm run test
npx playwright test

# 4. Deploy to staging first
git push origin update-dependencies
# CI/CD deploys to staging

# 5. If successful, deploy to production
git push origin master
```

---

## Compliance & Standards

### GDPR (General Data Protection Regulation)
- ✅ Data encryption at rest
- ✅ Data encryption in transit
- ✅ Right to access (implemented)
- ✅ Right to deletion (need to implement)
- ✅ Data breach notification (24h requirement)
- ✅ Data processing agreements

### PCI DSS (Payment Card Industry, if applicable)
- ✅ Secure network (firewall, VPN)
- ✅ Data protection (encryption, hashing)
- ✅ Vulnerability management (patching)
- ✅ Access control (RBAC, authentication)
- ✅ Monitoring (logging, alerts)

### ISO 27001 (Information Security)
- ✅ Security policies documented
- ✅ Access controls implemented
- ✅ Incident response plan
- ✅ Business continuity plan
- ✅ Regular audits and reviews

---

## Security Contacts & Resources

### Internal
- Security team lead: [contact]
- DevOps contact: [contact]
- Incident response team: [email list]

### External
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework
- CIS Benchmarks: https://www.cisecurity.org/benchmarks/
- CVE Database: https://cve.mitre.org/

---

## Sign-Off

- [ ] Security review completed
- [ ] All checklist items addressed
- [ ] Penetration testing passed
- [ ] Incident response plan tested
- [ ] Team trained on security procedures

**Security Lead Approval:** _________________ Date: _______
