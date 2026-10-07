-- ============================================================================
-- ⚠️  MIGRATION CORRETIVA PREPARADA — NÃO APLICAR  ⚠️
-- ============================================================================
-- FIORIX — Fase 6.0 | Saneamento de Pré-Requisitos de Segurança
-- Arquivo : 20261007091000_fix_identity_functions_by_id.sql
-- Status  : PREPARADA LOCALMENTE. NÃO APLICADA EM NENHUM AMBIENTE.
-- Local   : supabase/prepared-migrations/ (fora de supabase/migrations/).
--
-- PROIBIÇÃO: aplicação em PRODUÇÃO somente com registro formal de mudança e
-- autorização humana específica do MASTER. Homologação prévia obrigatória em
-- staging com evidências.
--
-- FRAGILIDADES CORRIGIDAS (funções SECURITY DEFINER da migration 20261005160000)
--   1. Fallback de identidade por E-MAIL: o vínculo com public."User" aceitava
--      `u.email = request.jwt.claim.email`. E-mail é mutável e não é o
--      identificador canônico; um vínculo indevido poderia herdar papel/tenant.
--   2. Precedência de claims do JWT: `request.jwt.claim.role` no Supabase é a
--      role do PostgREST (ex.: 'authenticated'), não o papel FIORIX — a
--      resolução por claims é inconsistente e não deriva do cadastro canônico.
--   3. search_path incluía o schema `auth` sem necessidade.
--
-- CORREÇÃO
--   - Identidade derivada EXCLUSIVAMENTE de auth.uid() ↔ public."User".id.
--   - Sem e-mail, sem claims, sem SQL dinâmico (sem EXECUTE / format).
--   - SECURITY DEFINER + STABLE + SET search_path = public, pg_temp.
--   - Sem vínculo → 'ANONYMOUS' / NULL ⇒ policies existentes negam (deny by default).
--   - is_master_user() não muda de assinatura nem de corpo.
--   - EXECUTE revogado de PUBLIC/anon; concedido a authenticated e service_role.
--
-- IMPACTO CONHECIDO (registrar em homologação)
--   Usuários autenticados no Supabase Auth cujo auth.uid() NÃO seja igual a
--   public."User".id passam a ser resolvidos como ANONYMOUS nas tabelas SaaS
--   (fail-safe). O backend (Prisma, role proprietária) não é afetado.
--   Usuários legados autenticados via NextAuth não usam estas funções.
--
-- Idempotente (CREATE OR REPLACE). Rollback:
--   20261007091000_fix_identity_functions_by_id_rollback.sql
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (
      SELECT u.role::text
      FROM public."User" u
      WHERE auth.uid() IS NOT NULL
        AND u.id = (auth.uid())::text
      LIMIT 1
    ),
    'ANONYMOUS'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT u."tenantId"
  FROM public."User" u
  WHERE auth.uid() IS NOT NULL
    AND u.id = (auth.uid())::text
  LIMIT 1;
$$;

-- is_master_user(): corpo inalterado; apenas reafirma search_path sem `auth`.
CREATE OR REPLACE FUNCTION public.is_master_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.get_auth_user_role() = 'MASTER';
$$;

REVOKE ALL ON FUNCTION public.get_auth_user_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_auth_tenant_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_master_user() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_auth_user_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_auth_tenant_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_master_user() TO authenticated, service_role;

COMMIT;

-- VERIFICAÇÃO PÓS-APLICAÇÃO (somente em staging, somente leitura):
--   SELECT proname, prosecdef, proconfig FROM pg_proc
--   WHERE proname IN ('get_auth_user_role','get_auth_tenant_id','is_master_user');
--   Esperado: prosecdef = true; proconfig = {search_path=public, pg_temp}.
--   SELECT pg_get_functiondef('public.get_auth_user_role()'::regprocedure);
--   Esperado: nenhuma ocorrência de "email" ou "jwt".
