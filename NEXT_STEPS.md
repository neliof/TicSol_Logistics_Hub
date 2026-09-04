# Próximos Passos - ARTSOFT Integration (Phase 8)

**Data**: 2026-09-04  
**Status**: Field paths confirmados, pronto para sync

---

## Checklist de Execução

### 1. Atualizar Mapeamento de Campos

```bash
# Executar SQL que ativa paths confirmados
psql -d ticsol_logistics_hub -f database/11_update_artsoft_field_paths.sql
```

**O que faz:**
- Ativa todos os campos logísticos com paths corretos (Inf.Matricula, Log.Peso*, etc.)
- Marca confirmado_em = NOW() e confirmado_por = 'ADMIN'
- Incrementa versão de cada campo

**Validar:**
```sql
SELECT campo, form_path, ativo FROM logistics.mapeamento_campo
WHERE empresa_id = 1 AND ativo = true
ORDER BY campo;
```

---

### 2. Limpar Dados Anteriores (Teste)

```bash
# Remover documentos de teste anteriores
psql -d ticsol_logistics_hub << 'EOF'
DELETE FROM logistics.linha_documento
WHERE documento_id IN (
  SELECT id FROM logistics.documento
  WHERE origem_sistema = 'ARTSOFT' AND empresa_id = 1
);

DELETE FROM logistics.documento
WHERE origem_sistema = 'ARTSOFT' AND empresa_id = 1;

SELECT COUNT(*) as documentos_restantes FROM logistics.documento WHERE empresa_id = 1;
EOF
```

---

### 3. Executar Sync com Novos Campos

```bash
# Opção A: Via CLI (mais rápido para teste)
node artsoft-sync/cli.js --empresa-id 1

# Opção B: Via API (requer servidor rodando)
# curl -X POST http://localhost:3000/api/artsoft/guias/sync \
#   -H "Authorization: Bearer <JWT_TOKEN>"
```

**Monitor:**
```bash
# Terminal 1: Ver logs
tail -f /tmp/artsoft-sync.log

# Terminal 2: Ver progresso no DB
watch -n 2 "psql -d ticsol_logistics_hub -c 'SELECT COUNT(*) FROM logistics.documento WHERE origem_sistema = \"ARTSOFT\"'"
```

---

### 4. Validar Dados Importados

```sql
-- Verificar cabeçalho com campos novos
SELECT
  serie, numero, data_documento,
  matricula, peso_bruto, volume_total,
  local_carga, local_descarga,
  data_carga, hora_carga
FROM logistics.documento
WHERE origem_sistema = 'ARTSOFT' AND empresa_id = 1
LIMIT 5 \gx

-- Verificar linhas
SELECT
  d.serie, d.numero,
  l.artigo_codigo, l.descricao, l.quantidade,
  l.peso_bruto_linha, l.volume_linha, l.num_embalagens
FROM logistics.documento d
JOIN logistics.linha_documento l ON l.documento_id = d.id
WHERE d.origem_sistema = 'ARTSOFT' AND d.empresa_id = 1
LIMIT 10;

-- Contar documentos e linhas
SELECT
  COUNT(DISTINCT d.id) as num_documentos,
  COUNT(l.id) as num_linhas
FROM logistics.documento d
LEFT JOIN logistics.linha_documento l ON l.documento_id = d.id
WHERE d.origem_sistema = 'ARTSOFT' AND d.empresa_id = 1;
```

---

### 5. Checklist de Validação

- [ ] SQL UPDATE executado sem erros
- [ ] Campos confirmado_em preenchidos
- [ ] Pelo menos 10 documentos importados
- [ ] Campos matricula, peso_bruto, volume_total preenchidos
- [ ] Local de carga e descarga visíveis
- [ ] Data/hora de carga confirmadas
- [ ] Linhas com artigo_codigo e quantidade
- [ ] Sem erros no sincronizacao_execucao (estado = 'completo')

---

## Estrutura de Dados Esperada

### Documento Exemplo
```json
{
  "serie": "V980",
  "numero": 12345,
  "data_documento": "2026-08-15",
  "tipo_saft": "GT",
  "terceiro_numero": 5001,
  "terceiro_nome": "Cliente XPTO",
  "matricula": "AA-99-BB",
  "peso_bruto": 150.5,
  "peso_liquido": 145.0,
  "volume_total": 2.5,
  "num_volumes": 3,
  "local_carga": "Armazém Central",
  "local_descarga": "Loja Lisboa",
  "data_carga": "2026-08-15",
  "hora_carga": "09:30",
  "data_descarga": "2026-08-16",
  "hora_descarga": "14:00"
}
```

### Linha Exemplo
```json
{
  "artigo_codigo": "ART-001",
  "descricao": "Produto XPTO",
  "quantidade": 50.0,
  "peso_bruto_linha": 25.0,
  "volume_linha": 1.2,
  "num_embalagens": 2
}
```

---

## Se Algo Falhar

### Erro: "form_path inválido"
- Verificar ARTSOFT_FIELD_PATHS_CONFIRMED.md
- Confirmar paths estão correctos em mapeamento_campo
- Testar query manualmente: `node scripts/e2e-artsoft-v3.js`

### Erro: "Documentos com campos vazios"
- Path pode estar errado (tabela/grupo diferente)
- Executar `node scripts/discover-paths.js` para variar paths
- Verificar se série V980 existe em ARTSOFT

### Erro: "Conexão timeout"
- Verificar conectividade: `ping 192.168.1.120`
- Verificar credenciais: testar com `node scripts/e2e-artsoft-v3.js`
- Verificar firewall/rede

---

## Timeline

| Passo | Duração | Status |
|-------|---------|--------|
| 1. SQL UPDATE | 5min | ⏳ Pronto |
| 2. Limpar dados | 2min | ⏳ Pronto |
| 3. Executar sync | 2-5min | ⏳ Pronto |
| 4. Validar | 5min | ⏳ Pronto |
| 5. Documentar | 5min | ⏳ Pronto |
| **Total** | **~20min** | |

---

## Referências

- `ARTSOFT_FIELD_PATHS_CONFIRMED.md` - Schema paths por tabela
- `scripts/e2e-artsoft-v3.js` - Teste de conectividade
- `E2E_TESTING.md` - Checklist completa
- `database/11_update_artsoft_field_paths.sql` - SQL de atualização

---

**Pronto?** Executar passo 1-5 acima.
