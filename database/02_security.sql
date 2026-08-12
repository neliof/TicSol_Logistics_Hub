-- ============================================================================
-- TicSol Logistics Hub — 02_security.sql
-- Roles (anónima + autenticada) + JWT + Row-Level Security por empresa_id
-- Depende de: 01_schema.sql
-- ============================================================================
SET search_path TO logistics, public;

-- ----------------------------------------------------------------------------
-- 0. Roles base do PostgREST (ligação + anónima)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'web_anon') THEN
        CREATE ROLE web_anon NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'muda-esta-password';
    END IF;
END $$;

GRANT web_anon TO authenticator;
GRANT USAGE ON SCHEMA logistics TO web_anon;
-- A role anónima só lê catálogos "públicos" (ex.: nenhuma tabela sensível) --
-- por omissão NÃO lhe damos SELECT em nada; ajusta caso precises de
-- endpoints verdadeiramente públicos (ex.: consulta de rastreabilidade
-- por código público, sem login).

-- ----------------------------------------------------------------------------
-- 1. Role para pedidos autenticados
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
    END IF;
END $$;

GRANT authenticated TO authenticator;
GRANT USAGE ON SCHEMA logistics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA logistics TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA logistics TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA logistics
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Funções auxiliares — leem os claims do JWT que o PostgREST expõe
--    em current_setting('request.jwt.claims', true) como texto JSON
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION logistics.jwt_empresa_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT (nullif(current_setting('request.jwt.claims', true), '')::json->>'empresa_id')::uuid
$$;

CREATE OR REPLACE FUNCTION logistics.jwt_utilizador_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT (nullif(current_setting('request.jwt.claims', true), '')::json->>'utilizador_id')::uuid
$$;

CREATE OR REPLACE FUNCTION logistics.jwt_perfil_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
    SELECT (nullif(current_setting('request.jwt.claims', true), '')::json->>'perfil_id')::uuid
$$;

-- Verifica se o perfil do utilizador autenticado tem permissão para
-- (modulo, accao) — usa a tabela PERMISSAO já existente no schema (secção 3.2)
CREATE OR REPLACE FUNCTION logistics.tem_permissao(p_modulo text, p_accao text) RETURNS boolean
LANGUAGE sql STABLE AS $$
    SELECT EXISTS (
        SELECT 1 FROM logistics.permissao
        WHERE perfil_id = logistics.jwt_perfil_id()
          AND modulo = p_modulo
          AND accao = p_accao
    )
$$;

-- ----------------------------------------------------------------------------
-- 3. Row-Level Security — isolamento automático por empresa_id
--    Aplica-se a TODAS as tabelas que têm a coluna empresa_id diretamente.
--    (empresa e perfil ficam de fora de propósito — ver nota no fim.)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'logistics'
          AND c.column_name = 'empresa_id'
          AND c.table_name NOT IN ('empresa')  -- a própria empresa não se filtra por si mesma
    LOOP
        EXECUTE format('ALTER TABLE logistics.%I ENABLE ROW LEVEL SECURITY', r.table_name);
        EXECUTE format('DROP POLICY IF EXISTS isolamento_empresa ON logistics.%I', r.table_name);
        EXECUTE format(
            'CREATE POLICY isolamento_empresa ON logistics.%I
                USING (empresa_id = logistics.jwt_empresa_id())
                WITH CHECK (empresa_id = logistics.jwt_empresa_id())',
            r.table_name
        );
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 4. Tabelas "filhas" sem empresa_id próprio — isolamento via JOIN ao pai
--    (lote → produto, linha_encomenda → encomenda, picking_linha → picking,
--     inventario_linha → inventario, loja → cliente,
--     zona/rua/estante/localizacao → armazem, viatura/motorista → transportadora)
-- ----------------------------------------------------------------------------

ALTER TABLE logistics.lote ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.lote;
CREATE POLICY isolamento_empresa ON logistics.lote
    USING (produto_id IN (SELECT id FROM logistics.produto WHERE empresa_id = logistics.jwt_empresa_id()));

ALTER TABLE logistics.linha_encomenda ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.linha_encomenda;
CREATE POLICY isolamento_empresa ON logistics.linha_encomenda
    USING (encomenda_id IN (SELECT id FROM logistics.encomenda WHERE empresa_id = logistics.jwt_empresa_id()));

ALTER TABLE logistics.picking_linha ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.picking_linha;
CREATE POLICY isolamento_empresa ON logistics.picking_linha
    USING (picking_id IN (SELECT id FROM logistics.picking WHERE empresa_id = logistics.jwt_empresa_id()));

ALTER TABLE logistics.inventario_linha ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.inventario_linha;
CREATE POLICY isolamento_empresa ON logistics.inventario_linha
    USING (inventario_id IN (SELECT id FROM logistics.inventario WHERE empresa_id = logistics.jwt_empresa_id()));

ALTER TABLE logistics.loja ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.loja;
CREATE POLICY isolamento_empresa ON logistics.loja
    USING (cliente_id IN (SELECT id FROM logistics.cliente WHERE empresa_id = logistics.jwt_empresa_id()));

ALTER TABLE logistics.zona ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.zona;
CREATE POLICY isolamento_empresa ON logistics.zona
    USING (armazem_id IN (SELECT id FROM logistics.armazem WHERE empresa_id = logistics.jwt_empresa_id()));

ALTER TABLE logistics.rua ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.rua;
CREATE POLICY isolamento_empresa ON logistics.rua
    USING (zona_id IN (SELECT z.id FROM logistics.zona z JOIN logistics.armazem a ON a.id = z.armazem_id WHERE a.empresa_id = logistics.jwt_empresa_id()));

ALTER TABLE logistics.estante ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.estante;
CREATE POLICY isolamento_empresa ON logistics.estante
    USING (rua_id IN (
        SELECT r.id FROM logistics.rua r
        JOIN logistics.zona z ON z.id = r.zona_id
        JOIN logistics.armazem a ON a.id = z.armazem_id
        WHERE a.empresa_id = logistics.jwt_empresa_id()
    ));

ALTER TABLE logistics.localizacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS isolamento_empresa ON logistics.localizacao;
CREATE POLICY isolamento_empresa ON logistics.localizacao
    USING (estante_id IN (
        SELECT e.id FROM logistics.estante e
        JOIN logistics.rua r ON r.id = e.rua_id
        JOIN logistics.zona z ON z.id = r.zona_id
        JOIN logistics.armazem a ON a.id = z.armazem_id
        WHERE a.empresa_id = logistics.jwt_empresa_id()
    ));

-- Nota: viatura e motorista ligam a transportadora_id que é NULLABLE
-- (transportadoras de terceiros podem ser partilhadas); por isso ficam
-- sem RLS direto — o isolamento real acontece ao nível de CARGA/PALETE.

-- ----------------------------------------------------------------------------
-- 5. Nota sobre EMPRESA e PERFIL
-- ----------------------------------------------------------------------------
-- EMPRESA fica sem RLS: um utilizador precisa de conseguir ler a linha da
-- SUA PRÓPRIA empresa (para mostrar o nome, config, etc.) mas não faz
-- sentido "filtrar empresa pela empresa". Se precisares de multi-empresa
-- por utilizador (um utilizador com acesso a 2 empresas), a política aqui
-- passa a ser: USING (id = logistics.jwt_empresa_id()).
--
-- PERFIL e PERMISSAO também ficam de fora — são geridos por quem administra
-- perfis (tipicamente sem RLS, protegidos só pelo tem_permissao() em cima
-- de operações de escrita a partir da aplicação).
