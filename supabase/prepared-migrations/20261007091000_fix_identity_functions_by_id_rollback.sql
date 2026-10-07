-- ============================================================================
-- ⚠️  ROLLBACK PREPARADO — NÃO APLICAR  ⚠️
-- ============================================================================
-- FIORIX — Fase 6.0 | Rollback de 20261007091000_fix_identity_functions_by_id.sql
-- Status: PREPARADO LOCALMENTE. NÃO APLICADO EM NENHUM AMBIENTE.
-- Restaura as definições históricas de 20261005160000 (inclui o fallback por
-- e-mail — usar somente para reverter homologação em staging).
-- Produção: proibido sem registro formal de mudança e autorização do MASTER.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'role'),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_role'),
    (
      SELECT u.role::text
      FROM public."User" u
      WHERE u.id = auth.uid()::text
         OR (auth.uid() IS NOT NULL AND u.email = nullif(current_setting('request.jwt.claim.email', true), ''))
      LIMIT 1
    ),
    'ANONYMOUS'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_master_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.get_auth_user_role() = 'MASTER';
$$;

CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.tenant_id', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'tenant_id'),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id'),
    (
      SELECT u."tenantId"
      FROM public."User" u
      WHERE u.id = auth.uid()::text
         OR (auth.uid() IS NOT NULL AND u.email = nullif(current_setting('request.jwt.claim.email', true), ''))
      LIMIT 1
    )
  );
$$;

-- Restaura EXECUTE padrão (PUBLIC) como no estado histórico.
GRANT EXECUTE ON FUNCTION public.get_auth_user_role() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_tenant_id() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_master_user() TO PUBLIC;

COMMIT;
