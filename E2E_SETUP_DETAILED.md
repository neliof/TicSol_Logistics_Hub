# E2E Setup Detalhado — ARTSOFT Staging

**O que precisar para validar campos na plataforma ARTSOFT.**

---

## Parte 1: Pré-requisitos Técnicos

### 1.1 Informações ARTSOFT

Pedir ao admin ARTSOFT:

```
[ ] Host/DNS: ___________________________
[ ] Porta: ___________________________
[ ] Utilizador sync: ___________________________
[ ] Senha sync: ___________________________
[ ] Versão ARTSOFT: ___________________________
[ ] Suporte a Digest SHA1 auth: [ ] Sim [ ] Não

[ ] Guias de transporte series disponíveis: 
    [ ] V960 [ ] V980 [ ] Outro: _________

[ ] Documentos teste para importar:
    [ ] Quantidade: _________
    [ ] Data range: De _________ a _________
    [ ] TPSAFT types: [ ] GR [ ] GT [ ] GA [ ] GC [ ] GD
```

### 1.2 Network Acesso

```bash
# Testar conectividade
ping <host_artsoft>

# Testar porta
nc -zv <host_artsoft> <porta>

# Testar DNS resolução
nslookup <host_artsoft>

# Registar resultados
[ ] DNS resolves: Sim/Não
[ ] Porta acessível: Sim/Não
[ ] Firewall permite: Sim/Não
```

### 1.3 Credenciais Locais

```bash
# Guardar credenciais seguramente (NOT .env committed)
cat > /tmp/artsoft-credentials.sh << 'EOF'
export ARTSOFT_HOST="artsoft.staging.company.com"
export ARTSOFT_PORTA="8000"
export ARTSOFT_UTILIZADOR="sync_user"
export ARTSOFT_SENHA="senha_secreta_aqui"
EOF

# Source quando precisar
source /tmp/artsoft-credentials.sh

# Testar credenciais (via curl)
curl -v --digest \
  -u $ARTSOFT_UTILIZADOR:$ARTSOFT_SENHA \
  -X POST http://$ARTSOFT_HOST:$ARTSOFT_PORTA/Queries/Query \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?>
<root type="list" name="test" query="DocFch|V960|NrDoc=1:1">
  <defcol>
    <DocNrDoc form="%DocFch.Doc.NrDoc"/>
  </defcol>
</root>'

# Registar resultado
[ ] Auth funciona: Sim/Não
[ ] Erro: ___________________________
```

---

## Parte 2: Descoberta de Schema (Field Paths)

### 2.1 Query DocFch/CfgDocum (lista campos disponíveis)

```bash
#!/bin/bash
# script: discover-fields.sh

source /tmp/artsoft-credentials.sh

ARTSOFT_URL="http://$ARTSOFT_HOST:$ARTSOFT_PORTA/Queries/Query"

echo "=== Descobrindo campos disponíveis em DocFch ==="

# Pedido 1: Descubrir todos os campos do cabeçalho
curl -s --digest \
  -u $ARTSOFT_UTILIZADOR:$ARTSOFT_SENHA \
  -X POST $ARTSOFT_URL \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?>
<root type="list" name="DocFch" query="DocFch|V960|NrDoc=1:1">
  <defcol>
    <!-- Campos base (confirmados) -->
    <DocSerie form="%DocFch.Doc.Serie"/>
    <DocNrDoc form="%DocFch.Doc.NrDoc"/>
    <DataDocum form="%DocFch.Doc.DataDocum"/>
    <TpSAFT form="%DocFch.Inf.TpSAFT"/>
    <TerTerceiro form="%DocFch.Ter.Terceiro"/>
    <TerNome form="%DocFch.Ter.Nome"/>
    <TerNIF form="%DocFch.Ter.NIF"/>
    
    <!-- Campos logísticos (testar) -->
    <Matricula form="%DocFch.Logis.Matricula"/>
    <EndCarga form="%DocFch.Logis.EndCarga"/>
    <EndDescarga form="%DocFch.Logis.EndDescarga"/>
    <DataHora form="%DocFch.Logis.DataHora"/>
    <Peso form="%DocFch.Logis.Peso"/>
    <Volumes form="%DocFch.Logis.Volumes"/>
  </defcol>
</root>' > /tmp/docfch-response.xml

echo "Resposta guardada em /tmp/docfch-response.xml"
echo ""
echo "=== Analisar resposta ==="
echo "Se tiver campos vazios (NULL), significa que o form_path está errado."
echo "Se tiver erro 'form not found', o path não existe em CfgDocum."
echo ""

# Mostrar resultado
cat /tmp/docfch-response.xml | head -50
```

### 2.2 Query DocLan (linha item fields)

```bash
#!/bin/bash
# script: discover-lines.sh

source /tmp/artsoft-credentials.sh

ARTSOFT_URL="http://$ARTSOFT_HOST:$ARTSOFT_PORTA/Queries/Query"

echo "=== Descobrindo campos disponíveis em DocLan (linhas) ==="

curl -s --digest \
  -u $ARTSOFT_UTILIZADOR:$ARTSOFT_SENHA \
  -X POST $ARTSOFT_URL \
  -H "Content-Type: application/xml" \
  -d '<?xml version="1.0"?>
<root type="list" name="DocFch" query="DocFch|V960|NrDoc=1:1">
  <defcol>
    <DocNrDoc form="%DocFch.Doc.NrDoc"/>
    <Lans type="list" name="lan" query="^DocLan|^DocFch|NrDoc={%DocFch.Doc.NrDoc}">
      <defcol>
        <Artigo form="%DocLan.Cod.Codigo"/>
        <Nome form="%DocLan.Nome"/>
        <Qtd form="%DocLan.Qtd.Movim"/>
        <Unid form="%DocLan.Unid"/>
        <Peso form="%DocLan.Peso"/>
        <Volume form="%DocLan.Volume"/>
      </defcol>
    </Lans>
  </defcol>
</root>' > /tmp/doclan-response.xml

echo "Resposta guardada em /tmp/doclan-response.xml"
cat /tmp/doclan-response.xml | head -50
```

### 2.3 Analisar Respostas

```bash
#!/bin/bash
# script: analyze-responses.sh

echo "=== Análise de Campos Retornados ==="
echo ""

echo "--- Cabeçalho (DocFch) ---"
grep -E "<[A-Za-z]+>|NULL|Error" /tmp/docfch-response.xml | head -20

echo ""
echo "--- Linhas (DocLan) ---"
grep -E "<Artigo>|<Nome>|<Qtd>|<Peso>|NULL|Error" /tmp/doclan-response.xml | head -20

echo ""
echo "=== Tabela de Resultados ==="
echo "Campo | form_path | Status | Valor Teste"
echo "------|-----------|--------|-------------"
echo "Serie | %DocFch.Doc.Serie | OK | $(grep '<DocSerie>' /tmp/docfch-response.xml | sed 's/<[^>]*>//g')"
echo "Numero | %DocFch.Doc.NrDoc | OK | $(grep '<DocNrDoc>' /tmp/docfch-response.xml | sed 's/<[^>]*>//g')"
echo "Matricula | %DocFch.Logis.Matricula | ? | $(grep '<Matricula>' /tmp/docfch-response.xml | sed 's/<[^>]*>//g')"
echo "EndCarga | %DocFch.Logis.EndCarga | ? | $(grep '<EndCarga>' /tmp/docfch-response.xml | sed 's/<[^>]*>//g')"
echo "EndDescarga | %DocFch.Logis.EndDescarga | ? | $(grep '<EndDescarga>' /tmp/docfch-response.xml | sed 's/<[^>]*>//g')"
echo "Peso | %DocFch.Logis.Peso | ? | $(grep '<Peso>' /tmp/docfch-response.xml | sed 's/<[^>]*>//g')"
```

---

## Parte 3: Validação Passo-a-Passo

### 3.1 Template de Teste (Cada Campo)

```bash
#!/bin/bash
# script: test-single-field.sh
# Uso: ./test-single-field.sh "Matricula" "%DocFch.Logis.Matricula"

FIELD_NAME=$1
FIELD_PATH=$2

source /tmp/artsoft-credentials.sh

echo "=== Testando campo: $FIELD_NAME ==="
echo "Field path: $FIELD_PATH"
echo ""

curl -s --digest \
  -u $ARTSOFT_UTILIZADOR:$ARTSOFT_SENHA \
  -X POST http://$ARTSOFT_HOST:$ARTSOFT_PORTA/Queries/Query \
  -H "Content-Type: application/xml" \
  -d "<?xml version='1.0'?>
<root type='list' name='DocFch' query='DocFch|V960|NrDoc=1:1'>
  <defcol>
    <DocSerie form='%DocFch.Doc.Serie'/>
    <DocNrDoc form='%DocFch.Doc.NrDoc'/>
    <TestField form='$FIELD_PATH'/>
  </defcol>
</root>" > /tmp/test-$FIELD_NAME.xml

echo "Resposta:"
cat /tmp/test-$FIELD_NAME.xml

# Análise
echo ""
echo "Análise:"
if grep -q "NULL\|<TestField/>\|<TestField></TestField>" /tmp/test-$FIELD_NAME.xml; then
  echo "❌ Campo VAZIO (path errado ou dados não preenchidos)"
  echo "   ↳ Tentar path alternativo"
elif grep -q "Error\|error" /tmp/test-$FIELD_NAME.xml; then
  echo "❌ Erro ARTSOFT (path syntax errado)"
  echo "   ↳ Verificar sintaxe path com admin"
else
  echo "✅ Campo ENCONTRADO"
  VALUE=$(grep -oP '(?<=>)[^<]*(?=</TestField>)' /tmp/test-$FIELD_NAME.xml)
  echo "   ↳ Valor: $VALUE"
fi
```

**Executar para cada campo:**

```bash
./test-single-field.sh "Matricula" "%DocFch.Logis.Matricula"
./test-single-field.sh "EndCarga" "%DocFch.Logis.EndCarga"
./test-single-field.sh "EndDescarga" "%DocFch.Logis.EndDescarga"
./test-single-field.sh "Peso" "%DocFch.Logis.Peso"
./test-single-field.sh "Volumes" "%DocFch.Logis.Volumes"
./test-single-field.sh "DataHora" "%DocFch.Logis.DataHora"
```

---

## Parte 4: Integrar Campos Confirmados

### 4.1 Guardar Resultados

```bash
# Criar relatório
cat > /tmp/field-validation-report.txt << 'EOF'
=== FIELD PATH VALIDATION REPORT ===
Data: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
ARTSOFT: $ARTSOFT_HOST:$ARTSOFT_PORTA
Utilizador: $ARTSOFT_UTILIZADOR

CAMPOS CONFIRMADOS:
[ ] Matricula - Path: __________ - Valor teste: __________
[ ] EndCarga - Path: __________ - Valor teste: __________
[ ] EndDescarga - Path: __________ - Valor teste: __________
[ ] Peso - Path: __________ - Valor teste: __________
[ ] Volumes - Path: __________ - Valor teste: __________
[ ] DataHora - Path: __________ - Valor teste: __________

CAMPOS NAO ENCONTRADOS (alternativas testadas):
_________________________________________________________________

PROXIMOS PASSOS:
1. UPDATE logistics.mapeamento_campo com paths confirmados
2. Executar sync de teste
3. Verificar dados em logistics.documento
EOF

cat /tmp/field-validation-report.txt
```

### 4.2 Atualizar BD com Paths Confirmados

```sql
-- Após confirmar cada campo, executar:

-- Exemplo: se Matricula confirmado como %DocFch.Logis.MatriculaVeiculo
UPDATE logistics.mapeamento_campo
SET ativo = true, form_path = '%DocFch.Logis.MatriculaVeiculo'
WHERE empresa_id = 1 AND campo = 'matricula';

-- Verificar update
SELECT campo, form_path, ativo FROM logistics.mapeamento_campo
WHERE empresa_id = 1 AND campo IN ('matricula', 'morada_carga', 'morada_descarga', 'peso')
ORDER BY campo;
```

---

## Parte 5: Sync de Teste + Validação

### 5.1 Executar Sync com Campos Novos

```bash
# Limpar dados antigos
psql -d ticsol_logistics_hub << 'EOF'
DELETE FROM logistics.documento WHERE origem_sistema = 'ARTSOFT' AND empresa_id = 1;
EOF

# Sync com logging detalhado
LOG_LEVEL=debug node artsoft-sync/cli.js --empresa-id 1

# Monitorar progresso
watch -n 2 "psql -d ticsol_logistics_hub -c 'SELECT COUNT(*) FROM logistics.documento WHERE origem_sistema = \"ARTSOFT\"'"
```

### 5.2 Validar Dados Importados

```sql
-- Verificar se campos novos têm dados
SELECT 
  serie, numero,
  (dados_extra->>'matricula') as matricula,
  (dados_extra->>'morada_carga') as morada_carga,
  (dados_extra->>'peso') as peso
FROM logistics.documento
WHERE origem_sistema = 'ARTSOFT' AND empresa_id = 1
LIMIT 5;

-- Se campos ainda vazios: path ainda errado
-- Se têm dados: CONFIRMADO ✓
```

---

## Parte 6: Checklist Final

```
VALIDAÇÃO CAMPOS ARTSOFT:
[ ] Network acesso OK
[ ] Digest auth funciona
[ ] DocFch query retorna dados
[ ] Matricula field confirmado
[ ] EndCarga field confirmado
[ ] EndDescarga field confirmado
[ ] Peso field confirmado
[ ] Volumes field confirmado
[ ] DataHora field confirmado
[ ] Sync com novos campos OK
[ ] Dados importados e verificados
[ ] Relatório guardado

PRONTO PARA PRODUÇÃO:
[ ] Todos paths confirmados
[ ] 100+ documentos de teste sincronizados
[ ] Zero erros na importação
[ ] Performance <60s
[ ] RLS enforcement verificado
[ ] Alerts funcionando
```

---

## Valores Esperados vs Reais

| Campo | Expected Path | ARTSOFT Path | Status |
|-------|----------------|--------------|--------|
| Matricula | %DocFch.Logis.Matricula | ___________ | [ ] OK [ ] Erro |
| EndCarga | %DocFch.Logis.EndCarga | ___________ | [ ] OK [ ] Erro |
| EndDescarga | %DocFch.Logis.EndDescarga | ___________ | [ ] OK [ ] Erro |
| Peso | %DocFch.Logis.Peso | ___________ | [ ] OK [ ] Erro |
| Volumes | %DocFch.Logis.Volumes | ___________ | [ ] OK [ ] Erro |
| DataHora | %DocFch.Logis.DataHora | ___________ | [ ] OK [ ] Erro |

---

*Pronto para validação na plataforma.*
