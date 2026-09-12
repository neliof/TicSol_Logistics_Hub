const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TicSol Logistics Hub API',
      version: '1.0.0',
      description: 'Enterprise warehouse management system with 4-phase logistics workflow',
      contact: { name: 'TicSol DevOps', email: 'devops@ticsol.com' },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Development' },
      { url: 'https://api.ticsol.com', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            statusCode: { type: 'number' },
          },
        },
        Recepcao: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            numero_guia: { type: 'string' },
            fornecedor_id: { type: 'integer' },
            data_recepcao: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['CRIADA', 'CONFERIDA', 'VALIDADA', 'FINALIZADA'] },
            observacoes: { type: 'string' },
            total_linhas: { type: 'integer' },
            total_conferido: { type: 'number' },
            tenant_id: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        RececaoLinha: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            recepcao_id: { type: 'integer' },
            numero_linha: { type: 'integer' },
            produto_id: { type: 'integer' },
            quantidade_esperada: { type: 'number' },
            quantidade_recebida: { type: 'number' },
            unidade: { type: 'string' },
            preco_unitario: { type: 'number' },
            status: { type: 'string', enum: ['PENDENTE', 'CONFERIDA', 'PARCIAL', 'DIVERGENCIA'] },
          },
        },
        Palete: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            sscc: { type: 'string', description: 'SSCC barcode (18 digits)' },
            recepcao_id: { type: 'integer' },
            estado: { type: 'string', enum: ['CRIADA', 'PREENCHIDA', 'PALETIZADA', 'EXPEDIDA'] },
            localizacao_zona: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
            localizacao_tipo: { type: 'string', enum: ['RACK', 'PISO', 'CELA'] },
            localizacao_endereco: { type: 'string' },
            quantidade_itens: { type: 'integer' },
            peso_total: { type: 'number' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Stock: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            produto_id: { type: 'integer' },
            quantidade: { type: 'number' },
            quantidade_reservada: { type: 'number' },
            quantidade_disponivel: { type: 'number' },
            localizacao_id: { type: 'integer' },
            data_validade: { type: 'string', format: 'date' },
            estado: { type: 'string', enum: ['OK', 'ALERTA', 'CRITICO', 'DIVERGENCIA'] },
          },
        },
        Expedicao: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            numero_referencia: { type: 'string' },
            cliente_id: { type: 'integer' },
            data_expedida: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['PREPARADA', 'EXPEDIDA', 'EM_TRANSITO', 'ENTREGUE'] },
            paletes_count: { type: 'integer' },
            peso_total: { type: 'number' },
            rastreamento: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [
    './recepcao-endpoints.js',
    './paletizacao-endpoints.js',
    './stock-endpoints.js',
    './expedicao-endpoints.js',
  ],
};

module.exports = swaggerJsdoc(options);
