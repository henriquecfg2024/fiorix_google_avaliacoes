-- ============================================================================
-- ⚠️  SCRIPT DE ROLLBACK NÃO-DESTRUTIVO — NÃO APLICAR  ⚠️
-- ============================================================================
-- FIORIX — Rollback de 20261007160000_fiorix_rls_user_tenant_lockdown.sql
-- Arquivo : 20261007160000_fiorix_rls_user_tenant_lockdown_rollback.sql
-- Status  : PREPARADO LOCALMENTE. NÃO APLICADO EM NENHUM AMBIENTE.
-- Local   : supabase/prepared-migrations/ (fora de supabase/migrations/).
--
-- PROIBIÇÃO ABSOLUTA:
-- Aplicação em PRODUÇÃO ou STAGING somente com registro formal de mudança e
-- autorização humana prévia e expressa do MASTER.
--
-- QUANDO USAR:
--   Somente se, após a migration, a aplicação deixar de ler/gravar "User" ou
--   "Tenant" (premissa de dono/FORCE incorreta no ambiente).
--
-- O QUE FAZ:
--   1. Remove as policies criadas (idempotente via pg_policies).
--   2. Desativa RLS em public."User" e public."Tenant" (estado anterior).
--   3. Restaura o search_path padrão da função de trigger da auditoria SaaS.
--
-- O QUE INTENCIONALMENTE NÃO FAZ:
--   - NÃO devolve privilégios a PUBLIC/anon/authenticated. Devolvê-los reabriria a
--     exposição crítica pela API REST do Supabase. A aplicação não depende deles
--     (usa Prisma com o papel dono). Reconceder exige decisão separada e explícita.
--   - NÃO usa DROP TABLE, CASCADE, DELETE ou TRUNCATE. Nenhum dado é tocado.
--
-- ATENÇÃO: após este rollback, o Security Advisor volta a acusar
-- "RLS Disabled in Public" para "User" e "Tenant".
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. REMOÇÃO IDEMPOTENTE DAS POLICIES
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'User'
      AND policyname = 'rls_user_deny_external'
  ) THEN
    DROP POLICY rls_user_deny_external ON public."User";
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Tenant'
      AND policyname = 'rls_tenant_deny_external'
  ) THEN
    DROP POLICY rls_tenant_deny_external ON public."Tenant";
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. RLS DESATIVADO (estado anterior). Privilégios externos permanecem revogados.
-- ----------------------------------------------------------------------------
ALTER TABLE public."User" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tenant" DISABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. SEARCH_PATH DA FUNÇÃO DE TRIGGER DE VOLTA AO PADRÃO
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.fn_prevent_fiorix_saas_governance_audit_mutation()') IS NOT NULL THEN
    ALTER FUNCTION public.fn_prevent_fiorix_saas_governance_audit_mutation()
      RESET search_path;
  END IF;
END;
$$;

COMMIT;
