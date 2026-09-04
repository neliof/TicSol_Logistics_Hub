# Authentication Guide

## Phase 4: User Credential Validation

**Status:** ✅ Implementado com bcrypt

### Setup

#### 1. Aplicar Migration

```bash
psql -d ticsol_logistics_hub -f database/09_usuarios.sql
```

Cria:
- Tabela `logistics.usuario` (email, senha_hash, ativo)
- RLS policies (isolamento empresa_id)
- Indices
- Trigger de auditoria

#### 2. Criar Utilizadores

**Opção A: CLI (recomendado)**

```bash
# Criar utilizador de teste
node server/bin/seed-usuarios.js \
  --email admin@test.local \
  --password teste123 \
  --empresa-id 1
```

**Opção B: SQL Manual**

```bash
# Gerar hash bcrypt
node -e "
  import { generateTestHash } from './server/utils/password.js';
  console.log(generateTestHash('teste123'))
" > /tmp/hash.txt

# Inserir
psql -d ticsol_logistics_hub << EOF
INSERT INTO logistics.usuario (empresa_id, nome, email, senha_hash, ativo)
VALUES (1, 'Admin', 'admin@test.local', '$(cat /tmp/hash.txt)', true)
ON CONFLICT (email) DO NOTHING;
EOF
```

#### 3. Verificar Setup

```bash
psql -d ticsol_logistics_hub -c "
  SELECT id, email, ativo FROM logistics.usuario WHERE ativo = true;
"
```

---

## Login Endpoint

### POST /auth/login

**Request:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.local",
    "password": "teste123"
  }'
```

**Response (Success):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "usuario": {
    "id": 1,
    "nome": "Admin",
    "email": "admin@test.local"
  }
}
```

**Response (Error):**
```json
{
  "error": "Invalid credentials"
}
```

### Token Claims

```javascript
{
  "usuario_id": 1,
  "empresa_id": 1,
  "email": "admin@test.local",
  "nome": "Admin",
  "iat": 1725357234,
  "exp": 1725443634  // 24 horas
}
```

---

## Using Tokens

### All Protected Endpoints

Incluir header:

```bash
Authorization: Bearer <token>
```

Exemplo:

```bash
TOKEN="eyJhbGc..."

curl -X POST http://localhost:3000/api/artsoft/guias/sync \
  -H "Authorization: Bearer $TOKEN"
```

---

## Password Hashing

### Architecture

- **Algoritmo:** bcrypt (não é reversível)
- **Rounds:** 10 (custo computacional default)
- **Armazenamento:** `logistics.usuario.senha_hash` (nunca plaintext)

### Implementation

Arquivo: `server/utils/password.js`

```javascript
import { hashPassword, verifyPassword } from './utils/password.js'

// Hash
const hash = hashPassword('minha_senha')

// Verify
if (verifyPassword('minha_senha', hash)) {
  // Correto
}
```

### API Changes (Phase 4 vs. Before)

| Antes | Depois |
|-------|--------|
| POST /auth/login?username=demo&password=demo&empresa_id=1 | POST /auth/login (JSON body: email, password) |
| Nenhuma validação | Validação com bcrypt contra usuarios table |
| Demo auth hardcoded | Real user auth com BD lookup |
| Nenhuma inativação | Campo `ativo` (soft-delete) |

---

## Security

### Best Practices

✅ **Implementado:**
- Senhas hasheadas com bcrypt (irreversível)
- Hash computacionalmente caro (10 rounds)
- Sem armazenamento de plaintext
- Timeout 30s em queries de auth
- JWT com expiry 24h
- RLS enforce empresa_id

❌ **Não Implementado (Future):**
- Password reset flow (email confirmation)
- 2FA / MFA
- Brute-force protection (rate limiting)
- Password history (prevenção reutilização)
- Session invalidation (logout)

---

## Troubleshooting

### "Invalid credentials"

Verificar:
1. Email correto? (case-insensitive, trimmed)
2. Utilizador existe? `SELECT * FROM logistics.usuario WHERE email = '...'`
3. Utilizador ativo? `ativo = true`
4. Senha correta? (Não há recuperação — precisa de reset)

### Hash inválido ou corrompido

```bash
# Regenerar
node server/bin/seed-usuarios.js --email admin@test.local --password nova_senha
```

### Token expirado

```
error: "Invalid token"
```

Fazer login novamente para obter novo token.

---

## Migration from Phase 3 (Demo Auth)

Se vinham usando `username=demo, password=demo`:

```bash
# 1. Aplicar migration
psql -d ticsol_logistics_hub -f database/09_usuarios.sql

# 2. Criar utilizador (substitui demo)
node server/bin/seed-usuarios.js --email demo@test.local --password demo

# 3. Atualizar clientes HTTP
# Antes: POST /auth/login?username=demo&password=demo&empresa_id=1
# Depois: POST /auth/login (JSON: email, password)

# 4. Testar
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"demo"}'
```

---

## Performance Notes

- Query usuarios por email: **indexed** (idx_usuario_email)
- Bcrypt verify: ~100ms (por design — impede brute-force)
- JWT verify: <1ms (local operation, sem DB)

---

## Future Enhancements

### Phase 4.1: Password Reset Flow

```
1. POST /auth/forgot-password (email)
   → Enviar reset token por email
2. POST /auth/reset-password (token, nova_senha)
   → Validar token, update senha_hash
```

### Phase 4.2: Rate Limiting

```
POST /auth/login
  → Max 5 tentativas por IP/minuto
  → Lockout 15 minutos após threshold
```

### Phase 4.3: Session Management

```
POST /auth/logout
  → Invalidar JWT (adicionar a blacklist)

GET /auth/me
  → Retornar dados do utilizador autenticado
```

---

*Atualizado: 2026-09-04*
