/**
 * Conector REST — para o caso do endpoint em 192.168.1.120:4219 (ou
 * equivalente) ser uma API HTTP que já devolve JSON.
 *
 * Os caminhos e nomes de campos abaixo são um PONTO DE PARTIDA plausível,
 * não uma certeza — ninguém aqui viu ainda a resposta real desse endpoint.
 * Assim que confirmares o formato real (podes correr `curl` localmente e
 * colar-me a resposta), ajusto isto em 5 minutos. Até lá, o resto do
 * serviço (mapeamento, upsert, reconciliação de stock) já está pronto e
 * não muda — só este ficheiro é que se adapta ao formato real.
 */
export function criarConectorRest({ baseUrl, apiKey }) {
  async function pedir(caminho) {
    const res = await fetch(`${baseUrl}${caminho}`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!res.ok) {
      throw new Error(`ARTSOFT REST ${caminho} → HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  return {
    async buscarProdutos() {
      const dados = await pedir("/produtos");
      // Ajusta os nomes de campo à resposta real do ARTSOFT quando a
      // confirmares — isto assume algo como { codigo, ean, descricao, ... }
      return dados.map((p) => ({
        codigo_interno: String(p.codigo ?? p.codigo_interno),
        ean13: p.ean ?? p.ean13 ?? null,
        gtin_caixa: p.gtin_caixa ?? null,
        descricao: p.descricao ?? p.nome,
        categoria: p.categoria ?? p.familia ?? null,
        peso_liquido_kg: p.peso != null ? Number(p.peso) : null,
        unidades_por_caixa: p.unid_caixa != null ? Number(p.unid_caixa) : null,
        ti: p.ti != null ? Number(p.ti) : null,
        hi: p.hi != null ? Number(p.hi) : null,
        fornecedor_codigo: p.fornecedor ?? p.cod_fornecedor ?? null,
      }));
    },

    async buscarClientes() {
      const dados = await pedir("/clientes");
      return dados.map((c) => ({
        codigo_interno: String(c.codigo ?? c.codigo_interno),
        nome: c.nome,
        nif: c.nif ?? null,
        morada: c.morada ?? null,
      }));
    },

    async buscarFornecedores() {
      const dados = await pedir("/fornecedores");
      return dados.map((f) => ({
        codigo_interno: String(f.codigo ?? f.codigo_interno),
        nome: f.nome,
        nif: f.nif ?? null,
        morada: f.morada ?? null,
      }));
    },

    async buscarStock() {
      const dados = await pedir("/stock");
      return dados.map((s) => ({
        produto_codigo: String(s.codigo_produto ?? s.produto ?? s.codigo),
        quantidade: Number(s.quantidade ?? s.stock ?? 0),
      }));
    },
  };
}
