/**
 * Cliente PostgREST para o ecrã de Paletização.
 * Mesmo padrão do api/postgrestClient.js da Receção — mesma app, mesma
 * sessão. Se já tiveres um cliente HTTP central no projeto, troca isto
 * por uma chamada a ele; a forma dos pedidos é o que importa manter.
 */

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function getToken() {
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
  if (!raw) return null;
  return JSON.parse(raw);
}

export const api = {
  /** Encomendas de cliente (saída) prontas a paletizar — fluxo PBS/PBL. */
  listarEncomendasParaPaletizar: () =>
    request("/encomenda", {
      params: {
        select: "*,cliente:cliente_id(id,nome)",
        cliente_id: "not.is.null",
        fluxo: "in.(pbs,pbl)",
        estado: "in.(confirmada,em_preparacao)",
        order: "data_agendamento.asc",
      },
    }),

  /** Linhas da encomenda ainda sem paletização feita (excedente à quantidade já em paletes). */
  listarLinhas: (encomendaId) =>
    request("/linha_encomenda", {
      params: {
        select:
          "*,produto:produto_id(id,sku_interno,descricao,categoria,ti,hi,peso_liquido_kg,dimensoes_caixa_mm)",
        encomenda_id: `eq.${encomendaId}`,
      },
    }),

  /** Motor de Paletização (Secção 6) — devolve o plano por RPC. */
  calcularPaletizacao: (produtoId, quantidade, fluxo, padrao) =>
    request("/rpc/calcular_paletizacao", {
      method: "POST",
      body: { p_produto_id: produtoId, p_quantidade: quantidade, p_fluxo: fluxo, p_padrao: padrao },
    }),

  /** Gera um SSCC único (IA 00) para a empresa. */
  gerarSSCC: (empresaId) =>
    request("/rpc/gerar_sscc", { method: "POST", body: { p_empresa_id: empresaId } }),

  /** Resolve a regra mais específica do Motor de Regras (Secção 9.4). */
  resolverRegra: async (clienteId, fluxo, categoria) => {
    const params = {
      select: "*",
      cliente_id: `eq.${clienteId}`,
      fluxo: `eq.${fluxo}`,
      order: "especificidade.desc",
      limit: "1",
    };
    if (categoria) {
      params.or = `(categoria_produto.is.null,categoria_produto.eq.${categoria})`;
    } else {
      params.categoria_produto = "is.null";
    }
    const rows = await request("/regra_logistica", { params });
    return rows?.[0] || null;
  },

  /** Cria a palete materializada. */
  criarPalete: (palete) =>
    request("/palete", { method: "POST", body: palete, prefer: "return=representation" }),

  /** Cria as caixas de uma palete, associadas ao lote. */
  criarCaixas: (caixas) =>
    request("/caixa", { method: "POST", body: caixas, prefer: "return=minimal" }),

  /** Cria a etiqueta resultante da regra aplicada. */
  criarEtiqueta: (etiqueta) =>
    request("/etiqueta", { method: "POST", body: etiqueta, prefer: "return=minimal" }),

  /** Marca a encomenda como em preparação depois da primeira paletização. */
  marcarEmPreparacao: (encomendaId) =>
    request("/encomenda", {
      method: "PATCH",
      params: { id: `eq.${encomendaId}` },
      body: { estado: "em_preparacao" },
      prefer: "return=minimal",
    }),
};
