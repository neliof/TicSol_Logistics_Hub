-- Tabelas para Sistema de Receção e Paletização
-- Data: 12/09/2026

BEGIN;

-- 1. Receção principal
CREATE TABLE IF NOT EXISTS logistics.recepcao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES logistics.empresa(id) ON DELETE CASCADE,
  numero_guia VARCHAR(50) NOT NULL,
  numero_encomenda_artsoft VARCHAR(50),
  fornecedor_id UUID REFERENCES logistics.fornecedor(id),
  fornecedor_nome VARCHAR(255) NOT NULL,
  estado VARCHAR(50) DEFAULT 'RASCUNHO' NOT NULL,
  operador_inicio VARCHAR(100),
  data_inicio TIMESTAMP DEFAULT NOW(),
  data_conclusao TIMESTAMP,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW(),
  UNIQUE(empresa_id, numero_guia)
);

-- 2. Documento fornecedor (Guia, Fatura, etc)
CREATE TABLE IF NOT EXISTS logistics.recepcao_documento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcao_id UUID NOT NULL REFERENCES logistics.recepcao(id) ON DELETE CASCADE,
  tipo VARCHAR(50) NOT NULL, -- GUIA_REMESSA, GUIA_TRANSPORTE, FATURA, OUTRO
  numero VARCHAR(100) NOT NULL,
  data DATE NOT NULL,
  url_anexo TEXT, -- base64 encoded PDF/image
  observacoes TEXT,
  operador VARCHAR(100),
  criado_em TIMESTAMP DEFAULT NOW()
);

-- 3. Divergência numa linha
CREATE TABLE IF NOT EXISTS logistics.recepcao_divergencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcao_id UUID NOT NULL REFERENCES logistics.recepcao(id) ON DELETE CASCADE,
  linha_id UUID NOT NULL,
  tipo VARCHAR(50) NOT NULL, -- FALTA, EXCESSO, DANIFICADO, NAO_ENCOMENDADO, QUALIDADE
  quantidade INTEGER NOT NULL DEFAULT 0,
  motivo TEXT NOT NULL,
  observacoes TEXT,
  autorizado_por VARCHAR(100),
  impacto_entrada_artsoft VARCHAR(50) DEFAULT 'REVISAR', -- ACEITAR, REJEITAR, REVISAR
  operador VARCHAR(100),
  criado_em TIMESTAMP DEFAULT NOW()
);

-- 4. Lote registado numa linha
CREATE TABLE IF NOT EXISTS logistics.recepcao_lote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcao_id UUID NOT NULL REFERENCES logistics.recepcao(id) ON DELETE CASCADE,
  linha_id UUID NOT NULL,
  lote VARCHAR(100) NOT NULL,
  quantidade INTEGER NOT NULL,
  data_validade DATE NOT NULL,
  vida_util_dias INTEGER,
  alerta_validade BOOLEAN DEFAULT FALSE,
  criado_em TIMESTAMP DEFAULT NOW()
);

-- 5. Palete criada na receção
CREATE TABLE IF NOT EXISTS logistics.recepcao_palete (
  sscc VARCHAR(50) PRIMARY KEY,
  recepcao_id UUID NOT NULL REFERENCES logistics.recepcao(id) ON DELETE CASCADE,
  artigo_codigo VARCHAR(50),
  quantidade_unidades INTEGER,
  quantidade_caixas INTEGER,
  localizacao_sugerida VARCHAR(100),
  localizacao_confirmada VARCHAR(100),
  lotes TEXT[], -- array de lotes JSON
  operador_criacao VARCHAR(100),
  operador_localizacao VARCHAR(100),
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- 6. Movimento de palete
CREATE TABLE IF NOT EXISTS logistics.palete_movimento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  palete_sscc VARCHAR(50) NOT NULL REFERENCES logistics.recepcao_palete(sscc) ON DELETE CASCADE,
  evento VARCHAR(50) NOT NULL, -- CRIADA, MOVIDA, ARMAZENADA, RESERVADA, EXPEDIDA, DEVOLVIDA
  localizacao_anterior VARCHAR(100),
  localizacao_nova VARCHAR(100),
  quantidade_anterior INTEGER,
  quantidade_nova INTEGER,
  operador VARCHAR(100),
  observacoes TEXT,
  evento_em TIMESTAMP DEFAULT NOW()
);

-- 7. Integração com Artsoft (entrada criada)
CREATE TABLE IF NOT EXISTS logistics.recepcao_artsoft_integracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcao_id UUID NOT NULL REFERENCES logistics.recepcao(id) ON DELETE CASCADE,
  entrada_artsoft_id VARCHAR(50), -- ID retornado pelo ERP
  estado VARCHAR(50) DEFAULT 'PENDENTE', -- PENDENTE, EM_PROCESSAMENTO, INTEGRADA, ERRO, NECESSITA_INTERVENCAO
  payload_enviado TEXT NOT NULL, -- JSON da entrada
  resposta_artsoft TEXT, -- JSON da resposta
  erro_tecnico TEXT,
  tentativas INTEGER DEFAULT 0,
  proxima_tentativa_em TIMESTAMP,
  criado_em TIMESTAMP DEFAULT NOW(),
  atualizado_em TIMESTAMP DEFAULT NOW()
);

-- 8. Auditoria de receção
CREATE TABLE IF NOT EXISTS logistics.recepcao_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcao_id UUID NOT NULL REFERENCES logistics.recepcao(id) ON DELETE CASCADE,
  operador VARCHAR(100),
  acao VARCHAR(100), -- CRIAR_RECEPCAO, REGISTAR_DOCUMENTO, CONFERIR_LINHA, etc
  tabela_afetada VARCHAR(100),
  registro_id VARCHAR(100),
  valor_anterior JSONB,
  valor_novo JSONB,
  motivo TEXT,
  ip_terminal VARCHAR(50),
  criado_em TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_recepcao_empresa_id ON logistics.recepcao(empresa_id);
CREATE INDEX idx_recepcao_numero_guia ON logistics.recepcao(numero_guia);
CREATE INDEX idx_recepcao_estado ON logistics.recepcao(estado);
CREATE INDEX idx_recepcao_documento_recepcao_id ON logistics.recepcao_documento(recepcao_id);
CREATE INDEX idx_recepcao_divergencia_recepcao_id ON logistics.recepcao_divergencia(recepcao_id);
CREATE INDEX idx_recepcao_lote_recepcao_id ON logistics.recepcao_lote(recepcao_id);
CREATE INDEX idx_recepcao_palete_recepcao_id ON logistics.recepcao_palete(recepcao_id);
CREATE INDEX idx_palete_movimento_palete_sscc ON logistics.palete_movimento(palete_sscc);
CREATE INDEX idx_recepcao_artsoft_recepcao_id ON logistics.recepcao_artsoft_integracao(recepcao_id);
CREATE INDEX idx_recepcao_artsoft_estado ON logistics.recepcao_artsoft_integracao(estado);
CREATE INDEX idx_recepcao_auditoria_recepcao_id ON logistics.recepcao_auditoria(recepcao_id);

-- RLS Policies (Row-Level Security)
ALTER TABLE logistics.recepcao ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.recepcao_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.recepcao_divergencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.recepcao_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.recepcao_palete ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.palete_movimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.recepcao_artsoft_integracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.recepcao_auditoria ENABLE ROW LEVEL SECURITY;

-- Policy: Receção
CREATE POLICY rls_recepcao ON logistics.recepcao
  USING (empresa_id = (current_setting('request.jwt.claims')::json->>'empresa_id')::uuid OR current_setting('request.jwt.claims') = '')
  WITH CHECK (empresa_id = (current_setting('request.jwt.claims')::json->>'empresa_id')::uuid);

-- Policy: Receção Documento (herda de recepcao)
CREATE POLICY rls_recepcao_documento ON logistics.recepcao_documento
  USING (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = (current_setting('request.jwt.claims')::json->>'empresa_id')::uuid
         OR current_setting('request.jwt.claims') = ''
    )
  );

-- Similares para divergencia, lote, palete, movimento, integracao, auditoria
CREATE POLICY rls_recepcao_divergencia ON logistics.recepcao_divergencia
  USING (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = (current_setting('request.jwt.claims')::json->>'empresa_id')::uuid
         OR current_setting('request.jwt.claims') = ''
    )
  );

CREATE POLICY rls_recepcao_lote ON logistics.recepcao_lote
  USING (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = (current_setting('request.jwt.claims')::json->>'empresa_id')::uuid
         OR current_setting('request.jwt.claims') = ''
    )
  );

CREATE POLICY rls_recepcao_palete ON logistics.recepcao_palete
  USING (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = (current_setting('request.jwt.claims')::json->>'empresa_id')::uuid
         OR current_setting('request.jwt.claims') = ''
    )
  );

CREATE POLICY rls_palete_movimento ON logistics.palete_movimento
  USING (
    palete_sscc IN (
      SELECT sscc FROM logistics.recepcao_palete
      WHERE recepcao_id IN (
        SELECT id FROM logistics.recepcao
        WHERE empresa_id = (current_setting('request.jwt.claims')::json->>'empresa_id')::uuid
           OR current_setting('request.jwt.claims') = ''
      )
    )
  );

CREATE POLICY rls_recepcao_artsoft ON logistics.recepcao_artsoft_integracao
  USING (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = (current_setting('request.jwt.claims')::json->>'empresa_id')::uuid
         OR current_setting('request.jwt.claims') = ''
    )
  );

CREATE POLICY rls_recepcao_auditoria ON logistics.recepcao_auditoria
  USING (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = (current_setting('request.jwt.claims')::json->>'empresa_id')::uuid
         OR current_setting('request.jwt.claims') = ''
    )
  );

COMMIT;
