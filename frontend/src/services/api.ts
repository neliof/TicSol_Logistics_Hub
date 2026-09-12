/**
 * API Client — Integração Frontend ↔ Backend
 * Wrapper completo para 37 endpoints P1-P4
 */

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

interface ApiError {
  error: string;
  code?: string;
  status?: number;
}

async function apiCall<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  body?: any
): Promise<T> {
  const token = localStorage.getItem('token') || '';
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);

    if (!response.ok) {
      const errorData: ApiError = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (err) {
    console.error(`API Error [${method} ${endpoint}]`, err);
    throw err;
  }
}

// ======================================================================
// P1 — RECEÇÃO
// ======================================================================

export const RecepcaoAPI = {
  // Criar receção
  async criar(ordem: {
    numero_guia: string;
    numero_encomenda_artsoft: string;
    fornecedor_id?: string;
    fornecedor_nome: string;
    operador_inicio: string;
  }) {
    return apiCall('POST', '/rest/v1/recepcao', ordem);
  },

  // Atualizar estado
  async atualizarEstado(
    id: string,
    dados: { estado: string; operador?: string }
  ) {
    return apiCall('PATCH', `/rest/v1/recepcao/${id}`, dados);
  },

  // Registar documento
  async registarDocumento(recepcaoId: string, doc: any) {
    return apiCall('POST', `/rest/v1/recepcao/${recepcaoId}/documento`, doc);
  },

  // Registar divergência
  async registarDivergencia(recepcaoId: string, div: any) {
    return apiCall('POST', `/rest/v1/recepcao/${recepcaoId}/divergencia`, div);
  },

  // Registar lote
  async registarLote(recepcaoId: string, lote: any) {
    return apiCall('POST', `/rest/v1/recepcao/${recepcaoId}/lote`, lote);
  },

  // Validar receção
  async validar(id: string) {
    return apiCall('GET', `/rest/v1/recepcao/${id}/validacao`);
  },

  // Auditoria
  async auditoria(id: string) {
    return apiCall('GET', `/rest/v1/recepcao/${id}/auditoria`);
  },

  // Finalizar receção
  async finalizar(id: string, dados: { operador?: string }) {
    return apiCall('POST', `/rest/v1/recepcao/${id}/finalizar`, dados);
  },
};

// ======================================================================
// P2 — PALETIZAÇÃO
// ======================================================================

export const PaletizacaoAPI = {
  // Criar múltiplas
  async criarMultiplas(recepcaoId: string, configs: any[]) {
    return apiCall('POST', '/rest/v1/palete/multiplas', {
      recepcao_id: recepcaoId,
      configuracoes: configs,
    });
  },

  // Adicionar item
  async adicionarItem(sscc: string, item: any) {
    return apiCall('PATCH', `/rest/v1/palete/${sscc}/item`, item);
  },

  // Remover item
  async removerItem(sscc: string, linhaId: string) {
    return apiCall('DELETE', `/rest/v1/palete/${sscc}/item/${linhaId}`);
  },

  // Dividir
  async dividir(sscc: string, dados: any) {
    return apiCall('POST', `/rest/v1/palete/${sscc}/dividir`, dados);
  },

  // Consolidar
  async consolidar(dados: any) {
    return apiCall('POST', '/rest/v1/palete/consolidar', dados);
  },

  // Status
  async status(sscc: string) {
    return apiCall('GET', `/rest/v1/palete/${sscc}/status`);
  },

  // Editar conteúdo
  async editarConteudo(sscc: string, dados: any) {
    return apiCall('PATCH', `/rest/v1/palete/${sscc}/conteudo`, dados);
  },

  // Disponíveis
  async disponivel() {
    return apiCall('GET', '/rest/v1/palete/disponivel');
  },
};

// ======================================================================
// P3 — STOCK
// ======================================================================

export const StockAPI = {
  // Reconciliar
  async reconciliar(recepcaoId: string, items: any[]) {
    return apiCall('POST', '/rest/v1/stock/reconciliar', {
      recepcao_id: recepcaoId,
      items,
    });
  },

  // FEFO
  async fefo() {
    return apiCall('GET', '/rest/v1/stock/lotes/fefo');
  },

  // Status lote
  async statusLote(id: string, dados: any) {
    return apiCall('PATCH', `/rest/v1/stock/lote/${id}/status`, dados);
  },

  // Localizações
  async localizacoes() {
    return apiCall('GET', '/rest/v1/stock/localizacoes');
  },

  // Divergências
  async divergencias() {
    return apiCall('GET', '/rest/v1/stock/divergencias');
  },

  // Alerta
  async criarAlerta(alerta: any) {
    return apiCall('POST', '/rest/v1/stock/alerta', alerta);
  },
};

// ======================================================================
// P4 — EXPEDIÇÃO
// ======================================================================

export const ExpedicaoAPI = {
  // Listar
  async listar(filtros?: { status?: string; limite?: number }) {
    const params = new URLSearchParams();
    if (filtros?.status) params.append('status', filtros.status);
    if (filtros?.limite) params.append('limite', String(filtros.limite));
    return apiCall('GET', `/rest/v1/expedicao?${params}`);
  },

  // Registar conferência
  async registarConferencia(id: string, dados: any) {
    return apiCall('POST', `/rest/v1/expedicao/${id}/conferencia`, dados);
  },

  // Registar rastreamento
  async registarRastreamento(id: string, dados: any) {
    return apiCall('POST', `/rest/v1/expedicao/${id}/rastreamento`, dados);
  },

  // Emitir documento
  async emitirDocumento(id: string, dados: any) {
    return apiCall('POST', `/rest/v1/expedicao/${id}/documento`, dados);
  },

  // Atualizar status
  async atualizarStatus(id: string, dados: any) {
    return apiCall('PATCH', `/rest/v1/expedicao/${id}/status`, dados);
  },

  // Detalhe
  async detalhe(id: string) {
    return apiCall('GET', `/rest/v1/expedicao/${id}`);
  },
};

// ======================================================================
// LOCALIZAÇÕES
// ======================================================================

export const LocalizacaoAPI = {
  // Sugerida
  async sugerida() {
    return apiCall('GET', '/rest/v1/localizacao/sugerida');
  },

  // Disponível
  async disponivel() {
    return apiCall('GET', '/rest/v1/localizacao/disponivel');
  },

  // Alocar
  async alocar(dados: any) {
    return apiCall('POST', '/rest/v1/localizacao/alocar', dados);
  },
};

// ======================================================================
// HEALTH CHECK
// ======================================================================

export const HealthAPI = {
  // Health
  async check() {
    return fetch(`${BASE_URL}/health`).then(r => r.json());
  },

  // Health sync
  async checkSync(empresaId: string) {
    return fetch(`${BASE_URL}/health/sync/${empresaId}`).then(r => r.json());
  },
};
