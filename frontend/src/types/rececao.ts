/**
 * Tipos para Receção e Paletização
 * Extensão de types/wms.ts com tipos específicos de receção
 */

// Documento que acompanha a mercadoria (Guia, Fatura, etc)
export interface RecepcaoDocument {
  id: string;
  recepcao_id: string;
  tipo: 'GUIA_REMESSA' | 'GUIA_TRANSPORTE' | 'FATURA' | 'OUTRO';
  numero: string;
  data: string;
  fornecedor_documento?: string;
  url_anexo?: string; // PDF/foto do documento
  observacoes?: string;
  criado_em: string;
  operador: string;
}

// Divergência numa linha (falta, excesso, danificado, etc)
export interface DivergenceRecord {
  id: string;
  linha_id: string;
  recepcao_id: string;
  tipo: 'FALTA' | 'EXCESSO' | 'DANIFICADO' | 'NAO_ENCOMENDADO' | 'QUALIDADE';
  quantidade: number;
  motivo: string;
  observacoes?: string;
  autorizado_por?: string;
  impacto_entrada_artsoft: 'ACEITAR' | 'REJEITAR' | 'REVISAR';
  criado_em: string;
  operador: string;
}

// State machine da receção
export interface RecepcaoState {
  recepcao_id: string;
  estado_atual:
    | 'RASCUNHO'
    | 'EM_CONFERENCIA'
    | 'CONFERIDA'
    | 'EM_PALETIZACAO'
    | 'PALETIZADA'
    | 'A_VALIDAR'
    | 'A_INTEGRAR'
    | 'INTEGRADA'
    | 'CONCLUIDA'
    | 'COM_DIVERGENCIAS'
    | 'BLOQUEADA'
    | 'ERRO_INTEGRACAO'
    | 'CANCELADA';
  transicao_em: string;
  operador: string;
  motivo?: string;
}

// Integração com Artsoft (criar entrada)
export interface ArtsoftIntegration {
  id: string;
  recepcao_id: string;
  entrada_artsoft_id?: string; // ID criado no ERP
  estado: 'PENDENTE' | 'EM_PROCESSAMENTO' | 'INTEGRADA' | 'ERRO' | 'NECESSITA_INTERVENCAO';
  payload_enviado: string; // JSON da entrada criada
  resposta_artsoft?: string; // Resposta do ERP
  erro_tecnico?: string;
  tentativas: number;
  proxima_tentativa_em?: string;
  criado_em: string;
  atualizado_em: string;
}

// Movimento da palete (rastreamento)
export interface PaleteMovement {
  id: string;
  palete_sscc: string;
  evento: 'CRIADA' | 'MOVIDA' | 'ARMAZENADA' | 'RESERVADA' | 'EXPEDIDA' | 'DEVOLVIDA';
  localizacao_anterior?: string;
  localizacao_nova?: string;
  quantidade_anterior?: number;
  quantidade_nova?: number;
  operador: string;
  observacoes?: string;
  evento_em: string;
}

// Registro de auditoria completo
export interface AuditRecord {
  id: string;
  recepcao_id: string;
  operador: string;
  acao: string;
  tabela_afetada: string;
  registro_id: string; // ID do ReceivingLine, PalletSSCC, etc
  valor_anterior?: any;
  valor_novo?: any;
  motivo?: string;
  criado_em: string;
  ip_terminal?: string;
}

// Receção com dados expandidos
export interface RecepcaoCompleta {
  id: string;
  numero_guia: string;
  numero_encomenda_artsoft: string;
  fornecedor_nome: string;
  documento?: RecepcaoDocument;
  divergencias: DivergenceRecord[];
  estado: RecepcaoState;
  paletasAssociadas: string[]; // SSCCs
  integracao?: ArtsoftIntegration;
  auditoria: AuditRecord[];
  criado_em: string;
  atualizado_em: string;
}

// Validação de receção (checklist)
export interface RecepcaoValidacao {
  documento_registado: boolean;
  linhas_conferidas: boolean;
  linhas_completas: { total: number; conferidas: number };
  divergencias_nao_resolvidas: number;
  lotes_obrigatorios_registados: boolean;
  localizacoes_definidas: boolean;
  paletes_criadas: number;
  alertas: string[];
  erros: string[];
  valido: boolean;
}

// Resultado de conferência de linha
export interface ResultadoConferencia {
  linha_id: string;
  quantidade_esperada: number;
  quantidade_recebida: number;
  diferenca: number;
  divergencia?: DivergenceRecord;
  danificados: number;
  estado_linha: 'PENDENTE' | 'PARCIAL' | 'CONCLUIDO' | 'REJEITADO';
}

// Lote registado numa linha
export interface LoteRegistado {
  linha_id: string;
  lote: string;
  quantidade: number;
  data_validade: string;
  vida_util_dias?: number;
  alerta_validade?: boolean;
}

// Resposta de criação de receção
export interface ResultadoRecepcao {
  recepcao_id: string;
  estado: string;
  numero_guia: string;
  criado_em: string;
  sucesso: boolean;
  erro?: string;
}
