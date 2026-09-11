export type AppTab =
  | 'rececao'
  | 'paletizacao'
  | 'paletizacao_expedicao'
  | 'stock_mapa'
  | 'expedicao'
  | 'artsoft_sync'
  | 'series_config'
  | 'artsoft_config'
  | 'gestao_dados'
  | 'regras'
  | 'auditoria';

export interface ReceivingOrder {
  id: string;
  numero_guia: string;
  serie?: string; // Série ARTSOFT (ex: "GR", "V990") — identificação completa: serie/numero
  numero_encomenda_artsoft: string;
  fornecedor_id: string;
  fornecedor_nome: string;
  fornecedor_nif: string;
  data_agendada: string;
  data_chegada?: string;
  estado: 'PENDENTE' | 'EM_RECECAO' | 'CONCLUIDO' | 'DIVERGENTE';
  doc_origem: string;
  cais_atribuido?: string;
  motorista?: string;
  matricula_veiculo?: string;
  temperatura_veiculo_c?: number;
  observacoes?: string;
  linhas: ReceivingLine[];
}

export interface ReceivingLine {
  id: string;
  guia_id: string;
  artigo_codigo: string;
  artigo_descricao: string;
  ean_barcode: string;
  qtd_esperada_caixas: number;
  qtd_recebida_caixas: number;
  unidades_por_caixa: number;
  qtd_ja_paletizada_caixas: number; // Addresses pending item #3
  lote?: string;
  data_validade?: string;
  temperatura_requisito_c?: number;
  estado_linha: 'PENDENTE' | 'PARCIAL' | 'CONCLUIDO' | 'REJEITADO';
  localizacao_sugerida: string;
  danificados_caixas: number;
  motivo_danos?: string;
  peso_bruto_kg: number;
  comprimento_cm: number;
  largura_cm: number;
  altura_cm: number;
}

export interface PalletSSCC {
  sscc: string; // 18-digit GS1 SSCC e.g. 3 5601234 000000123 4
  guia_id: string;
  artigo_codigo: string;
  artigo_descricao: string;
  ean_barcode: string;
  lote: string;
  data_validade: string;
  caixas_na_palete: number;
  unidades_totais: number;
  camadas: number;
  caixas_por_camada: number;
  altura_total_cm: number;
  peso_liquido_kg: number;
  peso_bruto_kg: number;
  regrac_cliente_aplicada: 'SONAE_MC' | 'JERONIMO_MARTINS' | 'SOVENA' | 'PADRAO_LOGISTICS';
  empresa_owner: string;
  localizacao_atual: string;
  estado_palete: 'EM_STAGING' | 'ARMANEZADA' | 'EM_EXPEDICAO' | 'EXPEDIDA';
  data_criacao: string;
  operador: string;
  gs1_128_barcode_string: string;
  packingListProducts?: Array<{ artigo_codigo: string; artigo_descricao: string; quantidade: number; lote: string }>;
}

export interface StockPosition {
  id: string;
  localizacao_codigo: string; // e.g. A-01-02-3 (Zona-Corredor-Prateleira-Posição)
  zona: 'A - Secos' | 'B - Refrigerados (+2°C a +6°C)' | 'C - Congelados (-18°C)' | 'Cais de Receção';
  sscc?: string;
  artigo_codigo: string;
  artigo_descricao: string;
  ean_barcode: string;
  lote: string;
  data_validade: string;
  dias_para_validade: number;
  fefo_status: 'OK' | 'ALERTA_30D' | 'EXPIRADO';
  qtd_caixas: number;
  qtd_unidades: number;
  peso_kg: number;
  empresa_owner: string;
  reservado_pedido: boolean;
  data_entrada: string;
}

export interface WarehouseLocation {
  codigo: string; // A-01-01-1
  zona: string;
  corredor: string;
  prateleira: string;
  nivel: string;
  capacidade_paletes: number;
  ocupacao_atual: number;
  temperatura_zona: string;
  status: 'LIVRE' | 'PARCIAL' | 'CHEIO' | 'BLOQUEADO';
  paletes: StockPosition[];
}

export interface ArtsoftStockDivergence {
  artigo_codigo: string;
  artigo_descricao: string;
  stock_artsoft_erp: number;
  stock_fisico_wms: number;
  stock_staging_artsoft: number;
  diferenca: number;
  percentual_divergencia: number;
  ultima_reconciliacao: string;
  status: 'ALINHADO' | 'DIVERGENCIA_MENOR' | 'CRITICO';
}

export interface RuleConfig {
  cliente_id: string;
  cliente_nome: string;
  altura_maxima_cm: number;
  peso_maximo_kg: number;
  vida_util_minima_porcentagem: number; // Shelf life min at delivery e.g. 75%
  permitir_palete_mista: boolean;
  tipo_palete: 'EURO_120x80' | 'ISO_120x100' | 'CHEP_BLUE';
  obriga_sscc_gs1128: boolean;
  etiqueta_formato: 'A5_105x148mm' | 'A6_100x150mm';
  regras_empilhamento: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  operador: string;
  empresa_tenant: string;
  acao: string;
  tabela_afetada: string;
  postgrest_rpc: string;
  detalhes_json: string;
  ip_terminal: string;
}
