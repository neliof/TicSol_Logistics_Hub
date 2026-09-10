// Expedição: Imefar (distribuidor) → Clientes (Sonae, Nívea, Tesa, Tena, etc)
// Fluxo: Guia ARTSOFT (entrada) → Paletização → Etiquetas → Embarque → Cliente recebe + faz Receção

// Guia de Transporte — entrada do ARTSOFT (encomenda do cliente)
export interface GuiaTransporte {
  id: string;
  numero_guia: string; // GT-2026-0051 (gerada pelo ARTSOFT Imefar)
  serie?: string; // Série ARTSOFT (ex: "GT", "GR", "V960") — usado para filtrar por módulo
  cliente_nome: string; // Sonae MC, Nívea, Tesa, Tena, etc
  cliente_nif: string;
  morada_entrega: string;
  cidade_entrega: string;
  codigo_postal_entrega: string;
  data_entrega_prevista: string;
  artsoft_order_id: string; // Link com ERP Imefar
  linhas: LinhaGuia[];
  peso_total_estimado_kg: number;
  volume_total_estimado_m3: number;
  status: 'RECEBIDA' | 'PREPARANDO' | 'PALETIZADA' | 'PRONTA_EMBARQUE' | 'EXPEDIDA' | 'ENTREGUE';
  data_criacao: string;
  prioridade: 'NORMAL' | 'URGENTE';
}

// Linha da Guia — cada produto na encomenda
export interface LinhaGuia {
  id: string;
  nr_linha?: number;
  guia_id: string;
  artigo_codigo: string;
  artigo_descricao: string; // ex: "Nívea Creme 200ml"
  ean_barcode: string;
  quantidade_solicitada: number;
  lote: string;
  data_validade: string;
  temperatura_armazenamento: 'AMBIENTE' | 'FRESCO' | 'CONGELADO';
  requer_palote_separada: boolean; // ex: congelados isolados
  peso_unitario_kg: number;
  volume_unitario_m3: number;
  status: 'PENDENTE' | 'PREPARANDO' | 'PALETIZADA' | 'PRONTA';
  // Valores (ARTSOFT)
  valor_unitario?: number;
  iva_percentual?: number;
  desconto_percentual?: number;
  total_liquido?: number;
}

// Palete Expedição — agrupa linhas compatíveis + etiqueta SSCC
export interface PaletaExpedicao {
  id: string;
  sscc: string; // GS1 18-digit: 3 + 5 + 10 + checksum
  guia_id: string; // Link com GuiaTransporte
  linhas_guia: string[]; // Array de LinhaGuia.id (produtos nesta palete)
  produtos: {
    artigo_codigo: string;
    artigo_descricao: string;
    quantidade: number;
    lote: string;
  }[];
  temperatura_zona: 'AMBIENTE' | 'FRESCO' | 'CONGELADO'; // Mais restritiva das linhas
  peso_total_kg: number;
  volume_total_m3: number;
  altura_palete_cm: number;
  dimensoes_palete_cm: string; // ex: "120x80x150"
  status: 'PREPARANDO' | 'ETIQUETADA' | 'PRONTA_EMBARQUE' | 'EMBARCADA';
  etiqueta_sscc_url?: string; // Base64 ou URL da etiqueta impressa
  data_criacao: string;
  operador_criacao: string;
}

// Checklist Pré-Expedição — validação antes embarque
export interface ChecklistExpedicao {
  id: string;
  palete_id: string;
  guia_id: string;
  cliente_nome: string;
  itens: {
    desc: string; // ex: "Etiqueta SSCC visível"
    completo: boolean;
  }[];
  peso_verificado_kg: number;
  data_verificacao: string;
  operador: string;
  status: 'PENDENTE' | 'VERIFICADO' | 'REPROVADO';
  observacoes: string;
}

// Comprovante de Embarque — registado após sair do armazém
export interface ComprovanteEmbarque {
  id: string;
  guia_id: string;
  paletes_sscc: string[]; // Array de SSCCs que saíram
  peso_real_kg: number;
  volume_real_m3: number;
  transportador_nome: string;
  matricula_veiculo: string;
  motorista_nome: string;
  contacto_motorista: string;
  temperatura_veiculo_c: number; // ex: -18 (congelado) ou +4 (fresco)
  hora_saida: string;
  data_saida: string;
  operador_embarque: string;
  observacoes: string;
  status: 'EMBARQUE_CONFIRMADO' | 'EM_TRANSITO' | 'ENTREGUE';
  data_entrega_real?: string;
}
