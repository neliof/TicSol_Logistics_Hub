/**
 * Cliente ligeiro para o PostgREST do TicSol Logistics Hub.
 *
 * Assume:
 *  - VITE_API_URL aponta para o PostgREST (ex.: http://localhost:3001)
 *  - O JWT (claims: role=authenticated, empresa_id, utilizador_id, perfil_id)
 *    vem de onde quer que a app já guarde a sessão — ajusta getToken()
 *    para ligar ao teu contexto de autenticação real do Ticsol_Hub.
 *
 * Não inventa autenticação nova: assume que o login já existe algures
 * no Ticsol_Hub e que isto só precisa do token.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getToken() {
  // TODO: ligar ao mecanismo de sessão real do Ticsol_Hub.
  // Por agora lê de localStorage para não bloquear o desenvolvimento deste ecrã.
  return localStorage.getItem("ticsol_jwt");
}

async function request(path, { method = "GET", body, params, prefer } = {}) {
  const url = new URL(API_URL + path);
  if (params) {
    Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  }

  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (prefer) headers.Prefer = prefer;

  const res = await fetch(url, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`PostgREST ${method} ${path} → ${res.status}: ${detail}`);
  }

  const raw = await res.text();
  if (!raw) return null; // 201/204 com corpo vazio (Prefer: return=minimal)
  return JSON.parse(raw);
}

export const api = {
  /** Encomendas de fornecedor pendentes de receção, ordenadas por cais/hora. */
  listarEncomendasPendentes: () =>
    request("/encomenda", {
      params: {
        select: "*,fornecedor:fornecedor_id(nome,codigo_interno)",
        fornecedor_id: "not.is.null",
        estado: "in.(aberta,confirmada)",
        order: "data_agendamento.asc",
      },
    }),

  /** Linhas de uma encomenda, com dados do produto já resolvidos. */
  listarLinhas: (encomendaId) =>
    request("/linha_encomenda", {
      params: {
        select:
          "*,produto:produto_id(sku_interno,descricao,ean13,unidades_por_caixa,ti,hi,controla_lote,controla_validade,peso_caixa_max_kg)",
        encomenda_id: `eq.${encomendaId}`,
      },
    }),

  /** Localizações válidas para largar mercadoria recebida (cais/expedição). */
  listarLocalizacoesRececao: () =>
    request("/localizacao", {
      params: {
        select: "id,codigo,tipo",
        tipo: "in.(cais,expedicao)",
        ativa: "eq.true",
        order: "codigo.asc",
      },
    }),

  /** Cria (ou obtém, via upsert) o lote informado na conferência. */
  criarLote: (lote) =>
    request("/lote", {
      method: "POST",
      params: { on_conflict: "produto_id,numero_lote" },
      body: lote,
      prefer: "return=representation,resolution=merge-duplicates",
    }),

  /** Atualiza a quantidade efetivamente entregue numa linha. */
  atualizarLinha: (linhaId, patch) =>
    request("/linha_encomenda", {
      method: "PATCH",
      params: { id: `eq.${linhaId}` },
      body: patch,
      prefer: "return=minimal",
    }),

  /** Regista o movimento de receção (ledger append-only — nunca editar depois). */
  registarMovimento: (movimento) =>
    request("/movimento", { method: "POST", body: movimento, prefer: "return=minimal" }),

  /** Abre uma rejeição (Secção 2.9 do caderno de encargos de referência). */
  registarRejeicao: (rejeicao) =>
    request("/rejeicao", { method: "POST", body: rejeicao, prefer: "return=minimal" }),

  /** Fecha a encomenda como recebida depois de todas as linhas conferidas. */
  concluirRecepcao: (encomendaId) =>
    request("/encomenda", {
      method: "PATCH",
      params: { id: `eq.${encomendaId}` },
      body: { estado: "recebida" },
      prefer: "return=minimal",
    }),
};
