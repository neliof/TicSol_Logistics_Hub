-- ============================================================
-- Migração 021: Corrigir bypass de RLS no módulo Receção/Paletização
-- ============================================================
-- Problema: as 8 policies criadas em 020_recepcao_schema.sql incluem
-- "OR current_setting('request.jwt.claims') = ''" — quando o claim JWT
-- está vazio (falha de auth, setEmpresaContext sem empresa_id, etc.),
-- a RLS deixa de filtrar e TODAS as linhas de TODAS as empresas ficam
-- visíveis e editáveis. Corrigido para falhar fechado: claim vazio ou
-- inválido nunca autoriza acesso, JSON malformado nunca lança exceção
-- que quebre a query (usa NULLIF/tratamento seguro).
-- ============================================================

BEGIN;

-- Função auxiliar: devolve o empresa_id do JWT atual, ou NULL se o
-- claim estiver vazio/malformado. Nunca lança exceção (evita que uma
-- query falhe por causa de um claim inválido) e nunca autoriza acesso
-- quando o valor é indeterminado.
CREATE OR REPLACE FUNCTION logistics.jwt_empresa_id_segura()
RETURNS uuid
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  claims text;
  result uuid;
BEGIN
  claims := current_setting('request.jwt.claims', true);

  IF claims IS NULL OR claims = '' THEN
    RETURN NULL;
  END IF;

  BEGIN
    result := (claims::json->>'empresa_id')::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  RETURN result;
END;
$$;

-- Recepção
DROP POLICY IF EXISTS rls_recepcao ON logistics.recepcao;
CREATE POLICY rls_recepcao ON logistics.recepcao
  USING (empresa_id = logistics.jwt_empresa_id_segura())
  WITH CHECK (empresa_id = logistics.jwt_empresa_id_segura());

-- Receção Documento
DROP POLICY IF EXISTS rls_recepcao_documento ON logistics.recepcao_documento;
CREATE POLICY rls_recepcao_documento ON logistics.recepcao_documento
  USING (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = logistics.jwt_empresa_id_segura()
    )
  )
  WITH CHECK (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = logistics.jwt_empresa_id_segura()
    )
  );

-- Receção Divergência
DROP POLICY IF EXISTS rls_recepcao_divergencia ON logistics.recepcao_divergencia;
CREATE POLICY rls_recepcao_divergencia ON logistics.recepcao_divergencia
  USING (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = logistics.jwt_empresa_id_segura()
    )
  )
  WITH CHECK (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = logistics.jwt_empresa_id_segura()
    )
  );

-- Receção Lote
DROP POLICY IF EXISTS rls_recepcao_lote ON logistics.recepcao_lote;
CREATE POLICY rls_recepcao_lote ON logistics.recepcao_lote
  USING (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = logistics.jwt_empresa_id_segura()
    )
  )
  WITH CHECK (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = logistics.jwt_empresa_id_segura()
    )
  );

-- Receção Palete
DROP POLICY IF EXISTS rls_recepcao_palete ON logistics.recepcao_palete;
CREATE POLICY rls_recepcao_palete ON logistics.recepcao_palete
  USING (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = logistics.jwt_empresa_id_segura()
    )
  )
  WITH CHECK (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = logistics.jwt_empresa_id_segura()
    )
  );

-- Palete Movimento
DROP POLICY IF EXISTS rls_palete_movimento ON logistics.palete_movimento;
CREATE POLICY rls_palete_movimento ON logistics.palete_movimento
  USING (
    palete_sscc IN (
      SELECT sscc FROM logistics.recepcao_palete
      WHERE recepcao_id IN (
        SELECT id FROM logistics.recepcao
        WHERE empresa_id = logistics.jwt_empresa_id_segura()
      )
    )
  )
  WITH CHECK (
    palete_sscc IN (
      SELECT sscc FROM logistics.recepcao_palete
      WHERE recepcao_id IN (
        SELECT id FROM logistics.recepcao
        WHERE empresa_id = logistics.jwt_empresa_id_segura()
      )
    )
  );

-- Receção ArtSoft Integração
DROP POLICY IF EXISTS rls_recepcao_artsoft ON logistics.recepcao_artsoft_integracao;
CREATE POLICY rls_recepcao_artsoft ON logistics.recepcao_artsoft_integracao
  USING (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = logistics.jwt_empresa_id_segura()
    )
  )
  WITH CHECK (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = logistics.jwt_empresa_id_segura()
    )
  );

-- Receção Auditoria
DROP POLICY IF EXISTS rls_recepcao_auditoria ON logistics.recepcao_auditoria;
CREATE POLICY rls_recepcao_auditoria ON logistics.recepcao_auditoria
  USING (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = logistics.jwt_empresa_id_segura()
    )
  )
  WITH CHECK (
    recepcao_id IN (
      SELECT id FROM logistics.recepcao
      WHERE empresa_id = logistics.jwt_empresa_id_segura()
    )
  );

COMMIT;

-- Verificação pós-migração (correr manualmente):
-- SET request.jwt.claims = '';
-- SELECT count(*) FROM logistics.recepcao; -- deve devolver 0, nunca todas as linhas
