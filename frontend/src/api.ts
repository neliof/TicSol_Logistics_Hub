/**
 * Cliente da API do TicSol Logistics Hub.
 *
 * O token de sessão fica em sessionStorage: dura enquanto o separador estiver
 * aberto e não sobrevive ao fecho do browser.
 */

const CHAVE_TOKEN = 'ticsol.token';
const CHAVE_UTILIZADOR = 'ticsol.utilizador';

export interface Utilizador {
  id: string;
  nome: string;
  email: string;
}

export interface Sessao {
  token: string;
  utilizador: Utilizador;
}

export interface ExecucaoSync {
  id: string;
  empresa_id: string;
  tipo: string;
  correlation_id: string | null;
  estado: 'ok' | 'erro_comunicacao' | 'erro_autenticacao' | 'erro_xml' | 'erro_funcional' | 'incompleto';
  pagina: number | null;
  registos: number | null;
  registos_novos: number | null;
  duracao_ms: number | null;
  erro_resumo: string | null;
  executado_em: string;
}

export interface SyncHealth {
  healthy: boolean;
  lastSync: string | null;
  estado: string;
  diasDesdeUltimaSincronizacao: number | null;
}

export interface LinhaReconciliacao {
  produto_id: string;
  sku_interno: string;
  descricao: string;
  quantidade_wms: string | number;
  quantidade_artsoft: string | number | null;
  ultima_sincronizacao: string | null;
  conector_usado: string | null;
  diferenca: string | number | null;
  ean13: string | null;
}

export interface ResultadoSync {
  docs_criados: number;
  docs_atualizados: number;
  linhas_total: number;
  erros: unknown[];
  ultima_execucao: { estado: string; correlation_id: string; paginas: number };
}

export interface ResultadoSyncProdutos {
  criados: number;
  atualizados: number;
  processados: number;
  erros: unknown[];
}

export interface ResultadoSyncTerceiros {
  clientes: { processados: number; criados: number; atualizados: number; erros: unknown[] };
  fornecedores: { processados: number; criados: number; atualizados: number; erros: unknown[] };
}

export interface ResultadoSyncCompleto {
  produtos: ResultadoSyncProdutos | null;
  terceiros: ResultadoSyncTerceiros | null;
  guias: ResultadoSync | null;
  erros: string[];
}

export function guardarSessao(token: string, utilizador: Utilizador): void {
  sessionStorage.setItem(CHAVE_TOKEN, token);
  sessionStorage.setItem(CHAVE_UTILIZADOR, JSON.stringify(utilizador));
}

export function lerSessao(): Sessao | null {
  const token = sessionStorage.getItem(CHAVE_TOKEN);
  if (!token) return null;
  try {
    return { token, utilizador: JSON.parse(sessionStorage.getItem(CHAVE_UTILIZADOR) || '{}') };
  } catch {
    return { token, utilizador: {} as Utilizador };
  }
}

export function terminarSessao(): void {
  sessionStorage.removeItem(CHAVE_TOKEN);
  sessionStorage.removeItem(CHAVE_UTILIZADOR);
}

/**
 * Lê o empresa_id do payload do JWT. Serve apenas para compor pedidos de
 * leitura; quem valida o token e aplica RLS é sempre o servidor.
 */
export function empresaIdDaSessao(): string | null {
  const sessao = lerSessao();
  if (!sessao) return null;
  try {
    const payload = sessao.token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json).empresa_id ?? null;
  } catch {
    return null;
  }
}

export class SessaoExpirada extends Error {}

async function pedir<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const sessao = lerSessao();
  const res = await fetch(caminho, {
    ...opcoes,
    headers: {
      'Content-Type': 'application/json',
      ...(sessao ? { Authorization: `Bearer ${sessao.token}` } : {}),
      ...(opcoes.headers || {}),
    },
  });

  if (res.status === 401) {
    terminarSessao();
    throw new SessaoExpirada('Sessão expirada. Volte a entrar.');
  }

  const texto = await res.text();
  let corpo: any = null;
  try {
    corpo = texto ? JSON.parse(texto) : null;
  } catch {
    corpo = texto;
  }

  if (!res.ok) {
    throw new Error((corpo && (corpo.error || corpo.message)) || `Erro ${res.status}`);
  }

  return corpo as T;
}

export const api = {
  async entrar(email: string, password: string): Promise<Utilizador> {
    const r = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const corpo = await r.json().catch(() => ({}));
    if (!r.ok) {
      throw new Error(
        r.status === 429
          ? 'Demasiadas tentativas. Aguarde alguns minutos.'
          : corpo.error || 'Credenciais inválidas.'
      );
    }
    guardarSessao(corpo.token, corpo.usuario);
    return corpo.usuario;
  },

  listarDocumentos(limite = 100) {
    return pedir<any[]>(`/rest/v1/documento?limit=${limite}`);
  },

  listarLinhasDoDocumento(documentoId: string) {
    return pedir<any[]>(`/rest/v1/documento/${documentoId}/linhas`);
  },

  listarExecucoes(limite = 20) {
    return pedir<ExecucaoSync[]>(`/rest/v1/sincronizacao_execucao?limit=${limite}`);
  },

  sincronizarGuias(dataInicio?: string, dataFim?: string, series?: string[]) {
    const body: any = {};
    if (dataInicio) body.data_inicio = dataInicio;
    if (dataFim) body.data_fim = dataFim;
    if (series && series.length > 0) body.series = series;
    return pedir<ResultadoSync>('/api/artsoft/guias/sync', {
      method: 'POST',
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
    });
  },

  healthSync(empresaId: string) {
    return pedir<SyncHealth>(`/health/sync/${empresaId}`);
  },

  reconciliacaoStock(limite = 500) {
    return pedir<LinhaReconciliacao[]>(`/rest/v1/vw_reconciliacao_stock?limit=${limite}`);
  },

  paletes(limite = 500) {
    return pedir<any[]>(`/rest/v1/palete?limit=${limite}`);
  },

  regras(limite = 100) {
    return pedir<any[]>(`/rest/v1/regra_logistica?limit=${limite}`);
  },

  sincronizarStock() {
    return pedir<{ gravados: number; nao_resolvidos: number; produtos: number }>(
      '/api/artsoft/stock/sync',
      { method: 'POST' }
    );
  },

  sincronizarProdutos() {
    return pedir<ResultadoSyncProdutos>('/api/artsoft/produtos/sync', { method: 'POST' });
  },

  sincronizarTerceiros() {
    return pedir<ResultadoSyncTerceiros>('/api/artsoft/terceiros/sync', { method: 'POST' });
  },

  discover_artsoft_series() {
    return pedir<{ series: Array<{code: string; type: 'Entrada'|'Saida'|'Venda'|'Encomenda_Cliente'|'Encomenda_Fornecedor'; typeName: string}>; total: number; message?: string }>('/api/artsoft/series/discover');
  },

  getSeriesConfig(modulo: string) {
    return pedir<{ modulo: string; receção: string[]; expedição: string[]; updated_at: string | null }>(`/api/artsoft/series/config/${encodeURIComponent(modulo)}`);
  },

  saveSeriesConfig(modulo: string, receção: string[], expedição: string[]) {
    return pedir<{ success: boolean; modulo: string }>('/api/artsoft/series/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modulo, receção, expedição })
    });
  },

  deleteTestData() {
    return pedir<{ success: boolean; deleted: {documentos: number} }>('/api/artsoft/test-data', {
      method: 'DELETE'
    });
  },

  contarDadosTeste() {
    return pedir<{ contagens: Record<string, number> }>('/api/artsoft/test-data/contagem');
  },

  apagarDadosTeste(tabelas: string[]) {
    return pedir<{ success: boolean; deleted: Record<string, number>; erros: Record<string, string> }>(
      `/api/artsoft/test-data?tabelas=${encodeURIComponent(tabelas.join(','))}`,
      { method: 'DELETE' }
    );
  },

  save_artsoft_series(payload: { series: string[] }) {
    return pedir<{ success: boolean; chave: string; valor: string; message: string }>(
      '/api/artsoft/series/save',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  descobrirSeries() {
    return this.discover_artsoft_series();
  },

  obterSeriesConfig(modulo: string) {
    return this.getSeriesConfig(modulo);
  },

  salvarSeriesConfig(modulo: string, receção: string[], expedição: string[]) {
    return this.saveSeriesConfig(modulo, receção, expedição);
  },

  obterArtsoftConfig() {
    return pedir<{ host: string; porta: string; utilizador: string; senha: string }>('/api/artsoft/config');
  },

  salvarArtsoftConfig(config: { host: string; porta: string; utilizador: string; senha: string }) {
    return pedir<{ success: boolean }>('/api/artsoft/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  // --- Receção (P1) ---

  criarRecepcao(payload: {
    numero_guia: string;
    numero_encomenda_artsoft?: string;
    fornecedor_id?: string;
    fornecedor_nome: string;
    operador_inicio: string;
  }) {
    return pedir<{ success: boolean; recepcao: any }>('/rest/v1/recepcao', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  atualizarEstadoRecepcao(id: string, estado: string, operador: string) {
    return pedir<{ success: boolean; recepcao: any }>(`/rest/v1/recepcao/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ estado, operador }),
    });
  },

  registarDocumentoRecepcao(
    id: string,
    payload: { tipo: string; numero: string; data: string; operador: string; url_anexo?: string; observacoes?: string }
  ) {
    return pedir<{ success: boolean; documento: any }>(`/rest/v1/recepcao/${id}/documento`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  registarDivergenciaRecepcao(
    id: string,
    payload: {
      linha_id: string;
      tipo: 'FALTA' | 'EXCESSO' | 'DANIFICADO' | 'NAO_ENCOMENDADO' | 'QUALIDADE';
      quantidade: number;
      motivo: string;
      operador: string;
      impacto_entrada_artsoft?: 'ACEITAR' | 'REJEITAR' | 'REVISAR';
    }
  ) {
    return pedir<{ success: boolean; divergencia: any }>(`/rest/v1/recepcao/${id}/divergencia`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  registarLoteRecepcao(
    id: string,
    payload: { linha_id: string; lote: string; quantidade: number; data_validade: string; vida_util_dias?: number }
  ) {
    return pedir<{ success: boolean; lote: any }>(`/rest/v1/recepcao/${id}/lote`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  validarRecepcao(id: string) {
    return pedir<{ success: boolean; validacao: any }>(`/rest/v1/recepcao/${id}/validacao`);
  },

  auditoriaRecepcao(id: string) {
    return pedir<{ success: boolean; auditoria: any[] }>(`/rest/v1/recepcao/${id}/auditoria`);
  },

  finalizarRecepcao(id: string, operador: string) {
    return pedir<{ success: boolean; recepcao: any }>(`/rest/v1/recepcao/${id}/finalizar`, {
      method: 'POST',
      body: JSON.stringify({ operador }),
    });
  },

  criarEntradaArtsoft(recepcao_id: string, payload: Record<string, unknown>) {
    return pedir<{ success: boolean; integracao: any }>('/rest/v1/artsoft/entrada', {
      method: 'POST',
      body: JSON.stringify({ recepcao_id, payload }),
    });
  },

  statusEntradaArtsoft(id: string) {
    return pedir<{ success: boolean; integracao: any }>(`/rest/v1/artsoft/entrada/${id}/status`);
  },

  retryEntradaArtsoft(id: string) {
    return pedir<{ success: boolean; integracao: any }>(`/rest/v1/artsoft/entrada/${id}/retry`, {
      method: 'POST',
    });
  },
};
