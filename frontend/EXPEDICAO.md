# Módulo Expedição — Imefar (Distribuidor RAM) → Clientes

## Visão Geral

**Imefar** = Armazenista/Distribuidor em RAM (Região Autónoma da Madeira)  
**Clientes** = Sonae MC, Nívea, Tesa, Tena, e restantes  
**Fluxo** = Encomenda ARTSOFT → Paletização em armazém → Embarque com etiquetas → Cliente recebe + Receção

## Arquitetura do Fluxo

```
1. Cliente (ex: Sonae MC) faz encomenda no ERP ARTSOFT de Imefar
   ↓
2. ARTSOFT gera Guia de Transporte (GT-2026-0051)
   • Número único
   • Morada entrega cliente
   • Linhas com produtos (artigo, qtd, temperatura, validação)
   ↓
3. Armazém Imefar recebe Guia (status: RECEBIDA)
   ↓
4. TAB: "Paletização Expedição" — Auto-agrupamento por temperatura
   • Operador seleciona Guia
   • Sistema agrupa linhas AMBIENTE / FRESCO / CONGELADO automaticamente
   • Respeita requisitos de isolamento (requer_palote_separada)
   • Calcula peso/volume
   • Gera SSCC (GS1 18-digit)
   • Etiqueta SSCC gerada (base64 ou SVG)
   ↓
5. Palete materializada (status: PREPARANDO → ETIQUETADA)
   • Imprime etiqueta A5 (105x148mm)
   • Operador coloca na palete
   ↓
6. Checklist Pré-Expedição (validação)
   • Etiqueta SSCC visível ✓
   • Peso/altura conforme limites ✓
   • Documentação acompanhando ✓
   • Temperatura verificada ✓
   ↓
7. Comprovante de Embarque (status: PRONTA_EMBARQUE → EXPEDIDA)
   • Palete sai do armazém Imefar (veículo próprio)
   • Registado: motorista, placa, temperatura veiculo, hora saída
   • Guia → status EXPEDIDA
   ↓
8. Transporte (status: EM_TRANSITO → ENTREGUE)
   • Veículo Imefar em rota para cliente
   • GPS/rastreio (opcional)
   ↓
9. Receção Cliente (módulo Receção Sonae)
   • Escaneia SSCC contra Guia
   • Conta caixas/produtos
   • Aceita ou rejeita
```

## Tipos & Schema

### GuiaTransporte (Entrada)
```typescript
{
  id: string;
  numero_guia: string;           // GT-2026-0051 (gerada ARTSOFT)
  cliente_nome: string;           // "Sonae MC Distribuição"
  cliente_nif: string;
  morada_entrega: string;
  data_entrega_prevista: string;
  artsoft_order_id: string;      // Link com ERP Imefar
  linhas: LinhaGuia[];           // Produtos da encomenda
  status: 'RECEBIDA' | 'PREPARANDO' | 'PALETIZADA' | 'PRONTA_EMBARQUE' | 'EXPEDIDA' | 'ENTREGUE';
}
```

### LinhaGuia
```typescript
{
  artigo_codigo: string;         // "NIV-200"
  artigo_descricao: string;      // "Nívea Creme 200ml"
  quantidade_solicitada: number;
  temperatura_armazenamento: 'AMBIENTE' | 'FRESCO' | 'CONGELADO';
  requer_palote_separada: boolean;  // isolamento forçado
  peso_unitario_kg: number;
  status: 'PENDENTE' | 'PREPARANDO' | 'PALETIZADA' | 'PRONTA';
}
```

### PaletaExpedicao (Interna)
```typescript
{
  sscc: string;                  // GS1 18-digit
  guia_id: string;               // Link com GuiaTransporte
  linhas_guia: string[];         // Produtos agrupados
  temperatura_zona: string;      // Mais restritiva
  peso_total_kg: number;
  volume_total_m3: number;
  status: 'PREPARANDO' | 'ETIQUETADA' | 'PRONTA_EMBARQUE' | 'EMBARCADA';
  etiqueta_sscc_url: string;     // Base64 etiqueta impressa
}
```

### ChecklistExpedicao (Validação)
```typescript
{
  palete_id: string;
  guia_id: string;
  cliente_nome: string;
  itens: {
    desc: string;                // "Etiqueta SSCC visível"
    completo: boolean;
  }[];
  status: 'PENDENTE' | 'VERIFICADO' | 'REPROVADO';
  observacoes: string;
}
```

### ComprovanteEmbarque (Saída)
```typescript
{
  id: string;
  guia_id: string;               // Link com GuiaTransporte
  paletes_sscc: string[];        // Paletas que saíram
  peso_real_kg: number;          // Verificado na balança
  transportador_nome: string;    // "DHL Logistics"
  motorista_nome: string;
  temperatura_veiculo_c: number; // -18, +4, +22
  data_saida: string;
  hora_saida: string;
  status: 'EMBARQUE_CONFIRMADO' | 'EM_TRANSITO' | 'ENTREGUE';
}
```

## Caderno de Encargos (Requisitos)

Cada cliente tem regras no ARTSOFT:

| Requisito | Sonae MC | Nívea | Tesa | Tena | Lactogal |
|-----------|----------|-------|------|------|----------|
| Altura máx palete | 200cm | 200cm | 180cm | 200cm | 200cm |
| Peso máximo | 1500kg | 1200kg | 1000kg | 1500kg | 1500kg |
| Temperatura isol | FRESCO isol | Sim | Não | Não | Sim (congelado) |
| Etiqueta formato | A5 105x148 | A5 | A6 | A5 | A5 |
| Rastreio | DHL | DHL/GLS | CTT | CTT/DHL | DHL |

## Estados & Transições

```
GuiaTransporte:
  RECEBIDA → PREPARANDO → PALETIZADA → PRONTA_EMBARQUE → EXPEDIDA → ENTREGUE

PaletaExpedicao:
  PREPARANDO → ETIQUETADA → PRONTA_EMBARQUE → EMBARCADA

ChecklistExpedicao:
  PENDENTE → VERIFICADO (ou REPROVADO → bloqueada)

ComprovanteEmbarque:
  EMBARQUE_CONFIRMADO → EM_TRANSITO → ENTREGUE
```

## Mock Data

**Guias de entrada:**
- GT-2026-0051: Sonae MC (3 linhas: Nívea, Tesa, Tena)
- GT-2026-0052: Lactogal (1 linha: Nespresso FRESCO)

**Paletas:**
- PAL-001: SSCC 36000100001000000001 (AMBIENTE: Nívea+Tesa+Tena)
- PAL-002: SSCC 36000100001000000002 (FRESCO: Nespresso)

**Checklist:**
- CHK-001: Palete 001 verificada ✓

**Comprovantes:**
- EMB-001: Saída 2026-08-12 15:45 (DHL Standard)

## Integração com Módulos

### Com Receção (Sonae)
- Quando Cliente recebe, escaneia SSCC
- Módulo Receção Sonae procura GuiaTransporte.linhas
- Valida quantidade, temperatura, lote
- Log auditoria ligado

### Com ARTSOFT (Imefar)
- Lê: GuiaTransporte criada no ARTSOFT
- Escreve: Status palete (PALETIZADA)
- Escreve: ComprovanteEmbarque registado
- RPC: `fn_registar_embarque(guia_id, paletas, transportador)`

### Com Stock (Armazém)
- Paletização consome Stock
- Stock.posicao atualizada: EM_STAGING → EM_EXPEDICO
- Peso verificado na balança

### Com Auditoria
- Cada ação registada:
  - RECEBER_GUIA
  - CONFIRMAR_PALETIZACAO
  - REGISTAR_EMBARQUE
  - Log inclui operador, IP terminal, timestamp

## Aba: Paletização Expedição

**Localização:** Navbar > "Paletização Expedição" (badge "Auto")

**Funcionalidade:**
1. Seleciona Guia de Transporte de entrada (de Expedição tab)
2. Auto-agrupa linhas por temperatura:
   - AMBIENTE (óleo, azeite, etc)
   - FRESCO (+2 a +6°C — leite, manteiga, congelados -18°C isolados)
   - CONGELADO (isolado)
3. Respeita `requer_palote_separada: true` (isolamento forçado)
4. Calcula peso total + volume
5. Gera SSCC GS1-18 automático (36000100001000000001)
6. Cria Palete com status "PREPARANDO"
7. Preview etiqueta SSCC (SVG ou base64)
8. Botão "Criar Palete + SSCC"
9. Atualiza status Guia → "PALETIZADA"
10. Log auditoria: CRIAR_PALETE_EXPEDICAO_AUTO

**Exemplo:**
```
Guia GT-2026-0051 (Sonae MC):
  L001: 240x Nívea Creme (AMBIENTE)
  L002: 120x Tesa Fita (AMBIENTE)
  L003: 60x Tena Pants (AMBIENTE)

→ Palete única (mesma temperatura):
    SSCC: 36000100001000000001
    Peso: 175kg
    Status: PREPARANDO (operador coloca etiqueta)
```

```
Guia GT-2026-0052 (Lactogal):
  L004: 500x Nespresso (FRESCO)

→ Palete única:
    SSCC: 36000100001000000002
    Peso: 25kg
    Temperatura: FRESCO (transportar +4°C)
    Status: PREPARANDO
```

## Impressão Etiqueta SSCC

- **Formato:** A5 (105 × 148mm) ou A6 (100 × 150mm)
- **Conteúdo:** 
  - GS1-128 barcode (SSCC 18-digit)
  - Guia número
  - Cliente nome
  - Produtos resumo
  - Temperatura zona
  - Peso + dimensões
  - Data paletização
- **Suporte:** Modal de impressão (navegador / USB printer)

## Transportador Imefar

Por padrão, embarque registado como:
- **Transportador:** "Imefar - Veículo Próprio"
- **Temperatura veiculo:** Configurável (AMBIENTE: 22°C, FRESCO: +4°C, CONGELADO: -18°C)
- **Operador:** Op. Expedição + terminal IP
- **Rastreio:** (Opcional) GPS real-time, webhook status

## Próximas Features

1. **Integração ARTSOFT real**
   - Sync automático de GuiasTransporte
   - Atualizar status em tempo real

2. **Rastreio transportador**
   - Webhook DHL → status EM_TRANSITO, ENTREGUE
   - Sincronizar com cliente via API

3. **Geração etiquetas SSCC**
   - GS1-128 barcode + info palete
   - Print A5 105x148mm (Sonae) ou A6 (Nívea)

4. **Alocação dinâmica transportador**
   - Calcular automático baseado em:
     - Temperatura necessária
     - Rota cliente
     - Custo transportador
   - Otimizar consolidação

5. **Devolução & Tratamento**
   - Cliente rejeita palete
   - Criar Nota de Crédito automática no ARTSOFT
   - Reclassificar mercadoria em armazém

6. **Mobile PDA**
   - Operador escaneia GuiaTransporte
   - Confirma produtos preparados
   - Gera etiqueta SSCC (impressora portatil)
   - Registar embarque via app

## Endpoints API

```
GET  /rest/v1/guia_transporte          → listar guias entrada
POST /rest/v1/guia_transporte          → criar guia (ARTSOFT webhook)
GET  /rest/v1/palete_expedicao         → listar paletas
POST /rest/v1/palete_expedicao         → criar palete
GET  /rest/v1/comprovante_embarque     → listar saídas
POST /rest/v1/comprovante_embarque     → registar embarque

RPC:
  fn_confirmar_paletizacao(guia_id)
  fn_registar_embarque(guia_id, paletas[], transportador)
  fn_gerar_etiqueta_sscc(palete_id) → base64 PDF
```

## Ambiente

- **Armazenista:** Imefar (RAM)
- **Clientes:** Sonae MC (Maia), Lactogal (Barreiro), Nívea, Tesa, Tena
- **Transportadores:** Imefar (veículos próprios) + opcional DHL, GLS, CTT
- **Temperaturas:** AMBIENTE (22°C), FRESCO (2-6°C), CONGELADO (-18°C)
- **Novo Fluxo Paletização:** Aba "Paletização Expedição" auto-agrupa por temperatura + gera SSCC + imprime etiqueta

---

**Desenvolvido:** TicSol Logistics Studio  
**Commit:** `5b77494` (refactor Expedição logic)  
**Data:** 2026-08-13
