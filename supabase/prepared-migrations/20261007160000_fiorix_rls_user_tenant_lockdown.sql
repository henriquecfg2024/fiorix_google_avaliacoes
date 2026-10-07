-- ============================================================================
-- ⚠️  MIGRATION DE SEGURANÇA PREPARADA — NÃO APLICAR  ⚠️
-- ============================================================================
-- FIORIX — Correção do Security Advisor (Supabase): RLS em public."User" e public."Tenant"
-- Arquivo : 20261007160000_fiorix_rls_user_tenant_lockdown.sql
-- Status  : PREPARADA LOCALMENTE. NÃO APLICADA EM NENHUM AMBIENTE.
-- Local   : supabase/prepared-migrations/ (fora de supabase/migrations/).
--
-- PROIBIÇÃO ABSOLUTA:
-- Aplicação em PRODUÇÃO ou STAGING somente com registro formal de mudança e
-- autorização humana prévia e expressa do MASTER.
--
-- ALERTAS ENDEREÇADOS (Security Advisor, projeto fiorix-staging, 07/10/2026):
--   ERROR rls_disabled_in_public ........ public."Tenant", public."User"
--   WARN  function_search_path_mutable .. public.fn_prevent_fiorix_saas_governance_audit_mutation()
--
-- ALERTAS NÃO ENDEREÇADOS AQUI:
--   WARN "Public Can Execute SECURITY DEFINER" (get_auth_tenant_id, get_auth_user_role,
--        is_master_user) → corrigido por 20261007091000_fix_identity_functions_by_id.sql
--        (aplicar ANTES desta).
--   WARN "Signed-In Users Can Execute SECURITY DEFINER" (mesmas funções) → esperado:
--        as policies RLS dependem delas. Registrar como risco aceito.
--
-- PREMISSAS (verificadas automaticamente na seção 0; se falharem, a transação aborta):
--   1. O backend usa Prisma com o papel `postgres`, DONO das tabelas. O dono não é
--      afetado por RLS enquanto FORCE ROW LEVEL SECURITY estiver desligado.
--   2. Nenhum código da aplicação acessa "User"/"Tenant" pela API REST do Supabase
--      (supabase-js). Verificado por teste estático no repositório.
--   3. Funções SECURITY DEFINER que leem public."User" (get_auth_user_role,
--      get_auth_tenant_id, is_master_user, fn_check_nav_user_rule_tenant) executam
--      como o dono e continuam lendo a tabela.
--
-- EFEITO ESPERADO:
--   - anon/authenticated (API REST/PostgREST) perdem todo acesso a "User"/"Tenant".
--   - Aplicação (Prisma/postgres) e service_role (BYPASSRLS) não são afetados.
--   - Chaves estrangeiras para "User"/"Tenant" não são afetadas.
--   - Nenhuma coluna, dado, índice ou constraint é alterado.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. VERIFICAÇÃO DE PREMISSAS (aborta a transação se algo divergir)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_table TEXT;
  v_owner TEXT;
  v_force BOOLEAN;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['User', 'Tenant'] LOOP
    SELECT pg_get_userbyid(c.relowner), c.relforcerowsecurity
      INTO v_owner, v_force
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = v_table AND c.relkind = 'r';

    IF v_owner IS NULL THEN
      RAISE EXCEPTION 'Premissa violada: tabela public."%" não encontrada.', v_table;
    END IF;
    IF v_owner <> 'postgres' THEN
      RAISE EXCEPTION 'Premissa violada: dono de public."%" é "%" (esperado "postgres"). Ativar RLS poderia bloquear a aplicação. NÃO APLICAR sem revisão.', v_table, v_owner;
    END IF;
    IF v_force THEN
      RAISE EXCEPTION 'Premissa violada: public."%" está com FORCE ROW LEVEL SECURITY; o dono também seria bloqueado. NÃO APLICAR sem revisão.', v_table;
    END IF;
  END LOOP;

  -- Funções de identidade devem ser SECURITY DEFINER para continuar lendo "User".
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('get_auth_user_role', 'get_auth_tenant_id', 'is_master_user')
      AND p.prosecdef = false
  ) THEN
    RAISE EXCEPTION 'Premissa violada: função de identidade sem SECURITY DEFINER; com RLS em "User" ela deixaria de resolver papel/tenant.';
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. ROW LEVEL SECURITY (sem FORCE: o dono, usado pelo Prisma, não é afetado)
-- ----------------------------------------------------------------------------
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Tenant" ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. REVOGAÇÃO DE PRIVILÉGIOS DOS PAPÉIS EXTERNOS DO POSTGREST
--    (não altera postgres nem service_role)
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE public."User" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public."Tenant" FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. POLICIES EXPLÍCITAS DE NEGAÇÃO (idempotentes via pg_policies)
--    Sem policy o RLS já nega; a policy explícita documenta a intenção e evita o
--    aviso "RLS enabled, no policy".
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'User'
      AND policyname = 'rls_user_deny_external'
  ) THEN
    CREATE POLICY rls_user_deny_external
    ON public."User"
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'Tenant'
      AND policyname = 'rls_tenant_deny_external'
  ) THEN
    CREATE POLICY rls_tenant_deny_external
    ON public."Tenant"
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. SEARCH_PATH FIXO NA FUNÇÃO DE TRIGGER DA AUDITORIA SAAS
--    (corpo inalterado; só fixa o search_path)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.fn_prevent_fiorix_saas_governance_audit_mutation()') IS NOT NULL THEN
    ALTER FUNCTION public.fn_prevent_fiorix_saas_governance_audit_mutation()
      SET search_path = pg_catalog, public;
  END IF;
END;
$$;

COMMIT;

-- ----------------------------------------------------------------------------
-- 5. VERIFICAÇÃO PÓS-APLICAÇÃO (somente leitura; executar manualmente)
-- ----------------------------------------------------------------------------
-- a) RLS ativo e sem FORCE:
--    SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
--    WHERE relnamespace = 'public'::regnamespace AND relname IN ('User', 'Tenant');
--    Esperado: relrowsecurity = true; relforcerowsecurity = false.
-- b) Sem privilégios para papéis externos:
--    SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
--    WHERE table_schema = 'public' AND table_name IN ('User', 'Tenant')
--      AND grantee IN ('PUBLIC', 'anon', 'authenticated');
--    Esperado: nenhuma linha.
-- c) Policies:
--    SELECT tablename, policyname, roles, cmd FROM pg_policies
--    WHERE schemaname = 'public' AND tablename IN ('User', 'Tenant');
-- d) search_path da função:
--    SELECT proconfig FROM pg_proc WHERE proname = 'fn_prevent_fiorix_saas_governance_audit_mutation';
--    Esperado: {search_path=pg_catalog, public}.
-- e) Aplicação: login, /dashboard, /sistema/operacoes e /configuracoes/usuarios funcionando.
-- f) Security Advisor → Rerun linter: os 2 ERRORs e o WARN de search_path somem.
-- ============================================================================
