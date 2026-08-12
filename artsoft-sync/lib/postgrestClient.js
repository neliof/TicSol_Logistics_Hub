/**
 * Cliente PostgREST para o serviço de sync. Diferente do cliente do
 * frontend: este corre como serviço de backend, não como utilizador
 * interativo — usa um JWT de serviço próprio (claims: role=authenticated,
 * empresa_id, sem perfil_id porque não passa por tem_permissao()).
 */
export function criarClientePostgrest({ baseUrl, token }) {
  async function pedir(caminho, { method = "GET", body, params, prefer } = {}) {
    const url = new URL(baseUrl + caminho);
    if (params) Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));

    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
    if (prefer) headers.Prefer = prefer;

    const res = await fetch(url, { method, headers, body: body != null ? JSON.stringify(body) : undefined });
    if (!res.ok) {
      throw new Error(`PostgREST ${method} ${caminho} → ${res.status}: ${await res.text()}`);
    }
    const raw = await res.text();
    return raw ? JSON.parse(raw) : null;
  }

  return {
    /** Upsert em lote pela chave natural de cada tabela (produto usa
     *  sku_interno; cliente/fornecedor usam codigo_interno — nomes
     *  diferentes no schema para o mesmo conceito). */
    upsert: (tabela, linhas, colunaConflito) =>
      pedir(`/${tabela}`, {
        method: "POST",
        params: { on_conflict: `empresa_id,${colunaConflito}` },
        body: linhas,
        prefer: "resolution=merge-duplicates,return=representation",
      }),

    listarProdutosPorSku: (empresaId) =>
      pedir("/produto", {
        params: { select: "id,sku_interno", empresa_id: `eq.${empresaId}` },
      }),

    listarFornecedoresPorCodigo: (empresaId) =>
      pedir("/fornecedor", {
        params: { select: "id,codigo_interno", empresa_id: `eq.${empresaId}` },
      }),

    inserirStockSnapshot: (linhas) =>
      pedir("/artsoft_stock_snapshot", { method: "POST", body: linhas, prefer: "return=minimal" }),
  };
}
