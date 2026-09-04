# ARTSOFT Field Paths - Confirmados (V26)

**Data**: 2026-09-04  
**ARTSOFT**: V26  
**Endpoint**: ArtDB/_TblDesc (DocFch schema)  
**Series**: V980, V990, V998  
**Tipo Documento**: Guias de Transporte (GT, GD)

---

## Campos Confirmados

| Campo Lógico | ARTSOFT Path | Tipo | Tamanho | Descrição |
|--------------|--------------|------|---------|-----------|
| **Matricula** | `%Inf.Matricula` | Str | 49 | Matrícula do veículo |
| **Peso Bruto** | `%Log.PesoBr` | Num | 8 Dec.3 | Peso Bruto |
| **Peso Líquido** | `%Log.PesoLiq` | Num | 8 Dec.3 | Peso Líquido |
| **Volume Total** | `%Log.Volume` | Num | 8 Dec.3 | Volume total |
| **Nº Volumes** | `%Log.NrVol` | UInt | 4 | Número de Volumes |
| **Data Carga** | `%Doc.DataCarga` | Date | 4 | Data de carga mercadoria |
| **Hora Carga** | `%Doc.HoraCarga` | Hour | 2 | Hora de carga mercadoria |
| **Data Descarga** | `%Doc.DataPrevistDescarga` | Date | 4 | Data prevista de descarga |
| **Hora Descarga** | `%Doc.HoraPrevistDescarga` | Hour | 2 | Hora prevista de descarga |
| **Local Carga** | `%Doc.LocCarga` | Str | 999 | Local de carga |
| **Local Descarga** | `%Doc.LocDesc` | Str | 511 | Local de descarga |
| **Data Documento** | `%Data.Docum` | Date | 4 | Data do documento |

---

## Campos Base Confirmados

| Campo | ARTSOFT Path | Status |
|-------|--------------|--------|
| Serie | `%DocFch.Doc.Serie` | ✅ OK |
| NrDoc | `%DocFch.Doc.NrDoc` | ✅ OK |
| Tipo SAFT | `%DocFch.Inf.TpSAFT` | ✅ OK |
| Terceiro | `%DocFch.Ter.Terceiro` | ✅ OK |
| Nome Terceiro | `%DocFch.Ter.Nome` | ✅ OK |
| Morada Terceiro | `%DocFch.Ter.Morada` | ✅ OK |
| Localidade | `%DocFch.Ter.Localid` | ✅ OK |
| Código Postal | `%DocFch.Ter.CPostAlfa` | ✅ OK |

---

## Campos DocLan (Linhas) Confirmados

| Campo Lógico | ARTSOFT Path | Tipo | Descrição |
|--------------|--------------|------|-----------|
| **Artigo Código** | `%DocLan.Cod.Codigo` | Str | Código de artigo |
| **Descrição** | `%DocLan.Div.Descric` | Str | Descrição lançamento |
| **Quantidade** | `%DocLan.Qtd.Real` | Num | Quantidade real |
| **Quantidade Unidade** | `%DocLan.Qtd.Unit` | Num | Quantidade/Fórmula |
| **Volume Total** | `%DocLan.Div.VolTT` | Num | Volume Total |
| **Peso Bruto** | `%DocLan.Div.PBrTT` | Num | Peso Bruto Total |
| **Peso Líquido** | `%DocLan.Div.PLqTT` | Num | Peso Líquido Total |
| **Nº Embalagens** | `%DocLan.Div.NrEmb` | Int | Número de embalagens |

---

## SQL Update - logistics.mapeamento_campo

```sql
-- Atualizar paths confirmados em ARTSOFT V26
UPDATE logistics.mapeamento_campo
SET 
  form_path = CASE campo
    WHEN 'matricula' THEN '%Inf.Matricula'
    WHEN 'peso_bruto' THEN '%Log.PesoBr'
    WHEN 'peso_liquido' THEN '%Log.PesoLiq'
    WHEN 'volume_total' THEN '%Log.Volume'
    WHEN 'num_volumes' THEN '%Log.NrVol'
    WHEN 'data_carga' THEN '%Doc.DataCarga'
    WHEN 'hora_carga' THEN '%Doc.HoraCarga'
    WHEN 'data_descarga' THEN '%Doc.DataPrevistDescarga'
    WHEN 'hora_descarga' THEN '%Doc.HoraPrevistDescarga'
    WHEN 'local_carga' THEN '%Doc.LocCarga'
    WHEN 'local_descarga' THEN '%Doc.LocDesc'
    WHEN 'data_documento' THEN '%Data.Docum'
  END,
  ativo = true,
  confirmado_em = NOW(),
  confirmado_por = 'ADMIN'
WHERE empresa_id = 1
  AND campo IN (
    'matricula', 'peso_bruto', 'peso_liquido', 'volume_total',
    'num_volumes', 'data_carga', 'hora_carga', 'data_descarga',
    'hora_descarga', 'local_carga', 'local_descarga', 'data_documento'
  );
```

---

## Próximos Passos

1. ✅ Paths confirmados via schema ARTSOFT V26
2. ⏳ Atualizar mapeamento_campo com paths corretos
3. ⏳ Testar query com campos logísticos
4. ⏳ Sincronizar guias com novos campos
5. ⏳ Validar dados importados

---

## Referência Schema

Fonte: `ArtDB/_TblDesc?table=DocFch`  
Resposta: XML com 661 campos documentados  
Grupos principais:
- `Doc.*` - Campos de documento
- `Ter.*` - Campos de terceiro
- `Data.*` - Campos de data
- `Inf.*` - Campos informativos (matricula aqui!)
- `Log.*` - Campos logísticos (peso, volume)
- `IVA.*`, `Tot.*`, `Flag.*`, etc.

**Insight Crítico**: Matricula está em `Inf.*` (informativos), não em `Logis.*` (logística).
