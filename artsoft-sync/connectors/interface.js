/**
 * Contrato comum a qualquer conector ARTSOFT. Cada conector (REST, ODBC,
 * ficheiros) implementa estes 4 métodos e devolve dados já na forma
 * normalizada abaixo — a lógica de sincronização (lib/sync.js) nunca sabe
 * qual conector está a usar.
 *
 * Isto é o que permite trocar de conector só por configuração (.env
 * CONNECTOR_TYPE=rest|odbc|file) sem tocar no resto do serviço.
 *
 * @typedef {Object} ProdutoArtsoft
 * @property {string} codigo_interno
 * @property {string} [ean13]
 * @property {string} [gtin_caixa]
 * @property {string} descricao
 * @property {string} [categoria]
 * @property {number} [peso_liquido_kg]
 * @property {number} [unidades_por_caixa]
 * @property {number} [ti]
 * @property {number} [hi]
 * @property {string} [fornecedor_codigo]
 *
 * @typedef {Object} ClienteFornecedorArtsoft
 * @property {string} codigo_interno
 * @property {string} nome
 * @property {string} [nif]
 * @property {string} [morada]
 *
 * @typedef {Object} StockArtsoft
 * @property {string} produto_codigo
 * @property {number} quantidade
 *
 * @typedef {Object} ArtsoftConnector
 * @property {() => Promise<ProdutoArtsoft[]>} buscarProdutos
 * @property {() => Promise<ClienteFornecedorArtsoft[]>} buscarClientes
 * @property {() => Promise<ClienteFornecedorArtsoft[]>} buscarFornecedores
 * @property {() => Promise<StockArtsoft[]>} buscarStock
 */

export {};
