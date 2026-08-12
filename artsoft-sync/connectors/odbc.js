import odbc from "odbc";

/**
 * Conector ODBC — para o caso de 192.168.1.120:4219 ser (ou estar por
 * trás de) um gateway ODBC para a base Pervasive/Btrieve do ARTSOFT.
 *
 * Requer um DSN ODBC já configurado na máquina onde este serviço corre
 * (Painel de Controlo → Fontes de Dados ODBC no Windows, ou odbc.ini no
 * Linux) apontando para o motor Pervasive/Btrieve do ARTSOFT.
 *
 * Os nomes de tabela/coluna abaixo (ARTIGO, CLIENTE, FORNECEDOR, STOCKS)
 * são o padrão típico de ERPs deste género — mas só o teu ARTSOFT sabe os
 * nomes reais. Já vimos DOCFCH referenciado nas tuas integrações
 * anteriores; os equivalentes de mestre de artigos/terceiros costumam
 * seguir convenção parecida. Ajusta os SELECTs assim que confirmares os
 * nomes reais — a ligação, o pool e o mapeamento à volta não mudam.
 */
export function criarConectorOdbc({ dsn, utilizador, password }) {
  const connectionString = `DSN=${dsn};UID=${utilizador};PWD=${password}`;
  let pool;

  async function obterPool() {
    if (!pool) {
      pool = await odbc.pool(connectionString);
    }
    return pool;
  }

  async function consultar(sql) {
    const conn = await obterPool();
    return conn.query(sql);
  }

  return {
    async buscarProdutos() {
      const linhas = await consultar(`
        SELECT CODIGO, EAN13, DESCRICAO, FAMILIA, PESO, UNID_CAIXA, TI, HI, COD_FORNECEDOR
        FROM ARTIGO
        WHERE INATIVO = 0
      `);
      return linhas.map((r) => ({
        codigo_interno: String(r.CODIGO),
        ean13: r.EAN13 || null,
        gtin_caixa: null,
        descricao: r.DESCRICAO,
        categoria: r.FAMILIA || null,
        peso_liquido_kg: r.PESO != null ? Number(r.PESO) : null,
        unidades_por_caixa: r.UNID_CAIXA != null ? Number(r.UNID_CAIXA) : null,
        ti: r.TI != null ? Number(r.TI) : null,
        hi: r.HI != null ? Number(r.HI) : null,
        fornecedor_codigo: r.COD_FORNECEDOR ? String(r.COD_FORNECEDOR) : null,
      }));
    },

    async buscarClientes() {
      const linhas = await consultar(`SELECT CODIGO, NOME, NIF, MORADA FROM CLIENTE WHERE INATIVO = 0`);
      return linhas.map((r) => ({
        codigo_interno: String(r.CODIGO),
        nome: r.NOME,
        nif: r.NIF || null,
        morada: r.MORADA || null,
      }));
    },

    async buscarFornecedores() {
      const linhas = await consultar(`SELECT CODIGO, NOME, NIF, MORADA FROM FORNECEDOR WHERE INATIVO = 0`);
      return linhas.map((r) => ({
        codigo_interno: String(r.CODIGO),
        nome: r.NOME,
        nif: r.NIF || null,
        morada: r.MORADA || null,
      }));
    },

    async buscarStock() {
      const linhas = await consultar(`SELECT COD_ARTIGO, QUANTIDADE FROM STOCKS`);
      return linhas.map((r) => ({
        produto_codigo: String(r.COD_ARTIGO),
        quantidade: Number(r.QUANTIDADE ?? 0),
      }));
    },

    async fechar() {
      if (pool) await pool.close();
    },
  };
}
