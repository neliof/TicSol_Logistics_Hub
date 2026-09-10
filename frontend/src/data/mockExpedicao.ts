import { GuiaTransporte, PaletaExpedicao, ChecklistExpedicao, ComprovanteEmbarque } from '../types/expedicao';

// ============ GUIAS DE TRANSPORTE (entrada do ARTSOFT) ============
// Imefar recebe encomendas de vários clientes via ARTSOFT e gera guias
export const INITIAL_GUIAS_TRANSPORTE: GuiaTransporte[] = [
  {
    id: 'gt-001',
    numero_guia: 'GT-2026-0051',
    cliente_nome: 'Sonae MC Distribuição',
    cliente_nif: '500000001',
    morada_entrega: 'Rua da Logística, nº 100',
    cidade_entrega: 'Maia',
    codigo_postal_entrega: '4470-177',
    data_entrega_prevista: '2026-08-14',
    artsoft_order_id: 'ORD-ARTSOFT-2026-0051',
    linhas: [
      {
        id: 'lg-001',
        guia_id: 'gt-001',
        artigo_codigo: 'NIV-200',
        artigo_descricao: 'Nívea Creme Corporal 200ml',
        ean_barcode: '5900017077849',
        quantidade_solicitada: 240,
        lote: 'LOT-2026-001',
        data_validade: '2027-06-30',
        temperatura_armazenamento: 'AMBIENTE',
        requer_palote_separada: false,
        peso_unitario_kg: 0.25,
        volume_unitario_m3: 0.001,
        status: 'PREPARANDO'
      },
      {
        id: 'lg-002',
        guia_id: 'gt-001',
        artigo_codigo: 'TES-100',
        artigo_descricao: 'Tesa Fita Adesiva 50mm x 50m',
        ean_barcode: '4042448000000',
        quantidade_solicitada: 120,
        lote: 'LOT-2026-002',
        data_validade: '2027-12-31',
        temperatura_armazenamento: 'AMBIENTE',
        requer_palote_separada: false,
        peso_unitario_kg: 0.15,
        volume_unitario_m3: 0.0005,
        status: 'PREPARANDO'
      },
      {
        id: 'lg-003',
        guia_id: 'gt-001',
        artigo_codigo: 'TENA-ADULT',
        artigo_descricao: 'Tena Pants Plus L (80-100cm)',
        ean_barcode: '7310016096662',
        quantidade_solicitada: 60,
        lote: 'LOT-2026-003',
        data_validade: '2027-03-15',
        temperatura_armazenamento: 'AMBIENTE',
        requer_palote_separada: false,
        peso_unitario_kg: 0.5,
        volume_unitario_m3: 0.002,
        status: 'PREPARANDO'
      }
    ],
    peso_total_estimado_kg: 175,
    volume_total_estimado_m3: 0.25,
    status: 'PREPARANDO',
    data_criacao: '2026-08-12T10:30:00',
    prioridade: 'NORMAL'
  },
  {
    id: 'gt-002',
    numero_guia: 'GT-2026-0052',
    cliente_nome: 'Lactogal (Unilever Portugal)',
    cliente_nif: '506000001',
    morada_entrega: 'Avenida Lusíada, nº 50',
    cidade_entrega: 'Barreiro',
    codigo_postal_entrega: '2734-001',
    data_entrega_prevista: '2026-08-15',
    artsoft_order_id: 'ORD-ARTSOFT-2026-0052',
    linhas: [
      {
        id: 'lg-004',
        guia_id: 'gt-002',
        artigo_codigo: 'NESPRESSO-POD',
        artigo_descricao: 'Nespresso Lungo Classico (10x10 pods)',
        ean_barcode: '7630039141370',
        quantidade_solicitada: 500,
        lote: 'LOT-2026-004',
        data_validade: '2027-09-30',
        temperatura_armazenamento: 'FRESCO',
        requer_palote_separada: false,
        peso_unitario_kg: 0.05,
        volume_unitario_m3: 0.00008,
        status: 'PENDENTE'
      }
    ],
    peso_total_estimado_kg: 25,
    volume_total_estimado_m3: 0.04,
    status: 'RECEBIDA',
    data_criacao: '2026-08-12T14:45:00',
    prioridade: 'URGENTE'
  }
];

// ============ PALETAS EXPEDIÇÃO (preparadas em armazém) ============
// Agrupa linhas da guia conforme temperatura e caderno de encargos
export const INITIAL_PALETAS_EXPEDICAO: PaletaExpedicao[] = [
  {
    id: 'pal-001',
    sscc: '36000100001000000001',
    guia_id: 'gt-001',
    linhas_guia: ['lg-001', 'lg-002', 'lg-003'],
    produtos: [
      { artigo_codigo: 'NIV-200', artigo_descricao: 'Nívea Creme 200ml', quantidade: 240, lote: 'LOT-2026-001' },
      { artigo_codigo: 'TES-100', artigo_descricao: 'Tesa Fita 50mm', quantidade: 120, lote: 'LOT-2026-002' },
      { artigo_codigo: 'TENA-ADULT', artigo_descricao: 'Tena Pants Plus L', quantidade: 60, lote: 'LOT-2026-003' }
    ],
    temperatura_zona: 'AMBIENTE',
    peso_total_kg: 175,
    volume_total_m3: 0.25,
    altura_palete_cm: 145,
    dimensoes_palete_cm: '120x80x145',
    status: 'ETIQUETADA',
    etiqueta_sscc_url: 'data:image/svg+xml;base64,PHN2Zz4...',
    data_criacao: '2026-08-12T11:00:00',
    operador_criacao: 'Op. Paletização #42'
  },
  {
    id: 'pal-002',
    sscc: '36000100001000000002',
    guia_id: 'gt-002',
    linhas_guia: ['lg-004'],
    produtos: [
      { artigo_codigo: 'NESPRESSO-POD', artigo_descricao: 'Nespresso Lungo Classico', quantidade: 500, lote: 'LOT-2026-004' }
    ],
    temperatura_zona: 'FRESCO',
    peso_total_kg: 25,
    volume_total_m3: 0.04,
    altura_palete_cm: 120,
    dimensoes_palete_cm: '120x80x120',
    status: 'PREPARANDO',
    data_criacao: '2026-08-12T14:50:00',
    operador_criacao: 'Op. Paletização #43'
  }
];

// ============ CHECKLIST PRÉ-EXPEDIÇÃO ============
// Validação antes de sair do armazém (conforme caderno de encargos)
export const INITIAL_CHECKLISTS_EXPEDICAO: ChecklistExpedicao[] = [
  {
    id: 'chk-001',
    palete_id: 'pal-001',
    guia_id: 'gt-001',
    cliente_nome: 'Sonae MC Distribuição',
    itens: [
      { desc: 'Etiqueta SSCC visível e intacta', completo: true },
      { desc: 'Documentação (Guia GT-2026-0051) presente', completo: true },
      { desc: 'Quantidade verificada (175kg)', completo: true },
      { desc: 'Produtos conformes com Guia de Transporte', completo: true },
      { desc: 'Palete envolvida em película STRETCH', completo: true },
      { desc: 'Altura < 2.5m (145cm ✓)', completo: true },
      { desc: 'Nenhuma mercadoria danificada', completo: true },
      { desc: 'Temperatura ambiente 20-25°C', completo: true }
    ],
    peso_verificado_kg: 175,
    data_verificacao: '2026-08-12T12:30:00',
    operador: 'Op. Verificação #55',
    status: 'VERIFICADO',
    observacoes: 'Palete OK para embarque. DHL Standard.'
  }
];

// ============ COMPROVANTES DE EMBARQUE ============
// Registado quando palete sai do armazém Imefar
export const INITIAL_COMPROVANTES_EMBARQUE: ComprovanteEmbarque[] = [
  {
    id: 'emb-001',
    guia_id: 'gt-001',
    paletes_sscc: ['36000100001000000001'],
    peso_real_kg: 175,
    volume_real_m3: 0.25,
    transportador_nome: 'DHL Logistics Portugal',
    matricula_veiculo: 'XX-11-AA',
    motorista_nome: 'João Silva',
    contacto_motorista: '+351 91 234 5678',
    temperatura_veiculo_c: 22,
    hora_saida: '15:45',
    data_saida: '2026-08-12',
    operador_embarque: 'Op. Expedição #60',
    observacoes: 'Saída normal. ETA Sonae: 2026-08-14 09:00.',
    status: 'EM_TRANSITO'
  }
];
