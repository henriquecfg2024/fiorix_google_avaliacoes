-- ============================================================================
-- Migration: 20261113000000_lockdown_public_schema_and_rls.sql
-- FIORIX Fase 2 — Pacote 2.1 (CRIT-08 + HIGH-12)
--
-- Objetivo:
--   1. Revogar todos os GRANTs globais e ALTER DEFAULT PRIVILEGES concedidos
--      anteriormente a PUBLIC, anon e authenticated no schema public
--      (reversão segura de 20260930140000_ensure_public_grants.sql), mantendo
--      acesso integral para postgres (Prisma) e service_role (supabaseAdmin).
--   2. Habilitar ROW LEVEL SECURITY (sem FORCE) em 100% das tabelas do schema
--      public — cobrindo explicitamente "User", "Tenant", "GoogleConnection",
--      "Review", "Connector", tabelas snake_case mapeadas via @@map
--      (fiorix_holerites, fiorix_colaboradores, fiorix_comunicados,
--      fiorix_conversas, fiorix_mensagens, fiorix_qualidade_*, etc.) e
--      quaisquer tabelas criadas por DDL dinâmico em runtime.
--   3. Normalizar todas as policies RLS em public para:
--      - Eliminar policies permissivas duplicadas (ex.: "allow all" legado,
--        tenant_isolation_* antigas ou FOR ALL colidindo com FOR SELECT).
--      - Envolver chamadas current_setting(...), auth.uid(), get_auth_tenant_id()
--        e is_master_user() em subqueries escalares (SELECT ...) (InitPlan),
--        zerando alertas Auth RLS Initialization Plan no Performance Advisor.
--      - Exigir (SELECT NULLIF(current_setting('app.current_tenant_id', true), ''))
--        para impedir que GUC vazia '' case com tenant_id DEFAULT ''.
--   4. Remover a policy aberta rls_saas_audit_insert na trilha de governança.
--   5. Fixar search_path imutável em fn_prevent_fiorix_saas_governance_audit_mutation,
--      fn_check_nav_user_rule_tenant e doc_manifestacao_imutavel.
--
-- Segurança Operacional:
--   - Transacional, idempotente e não destrutiva (zero DROP TABLE/DELETE/TRUNCATE).
--   - NÃO ativa FORCE ROW LEVEL SECURITY, preservando o funcionamento normal do
--     Prisma conectado com o papel proprietário (postgres) via Supavisor/PgBouncer.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. GUARDA DE SEGURANÇA ANTES DE QUALQUER ALTERAÇÃO
--    Garante que nenhuma tabela crítica tenha FORCE ROW LEVEL SECURITY ativo
--    de forma inesperada (o que bloquearia o papel dono usado pelo Prisma).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_forced_table TEXT;
BEGIN
  SELECT c.relname
    INTO v_forced_table
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relforcerowsecurity = true
  LIMIT 1;

  IF v_forced_table IS NOT NULL THEN
    RAISE EXCEPTION
      'Aborte preventivo: public."%" possui FORCE ROW LEVEL SECURITY ativo; revise antes de aplicar.',
      v_forced_table;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 1. REVOGAÇÃO COMPLETA DE PRIVILÉGIOS EXTERNOS (PostgREST: PUBLIC, anon, authenticated)
--    Preserva intactos postgres (dono) e service_role (backend supabaseAdmin).
-- ----------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Garante que service_role mantenha privilégios administrativos explícitos
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

-- ----------------------------------------------------------------------------
-- 2. HABILITAÇÃO DE RLS EM TABELAS CRÍTICAS E EM 100% DO SCHEMA PUBLIC
--    Explicitamente nas tabelas sensíveis + varredura dinâmica sobre pg_tables.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '_prisma_migrations'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. NORMALIZAÇÃO DAS POLICIES ESPECÍFICAS E REMOÇÃO DE POLICIES INSEGURAS /
--    PERMISSIVAS DUPLICADAS (HIGH-12 + Auth RLS InitPlan / Multiple Permissive)
-- ----------------------------------------------------------------------------
DO $lockdown$
DECLARE
  v_tbl TEXT;
  v_pol TEXT;
  v_has_saas_helpers BOOLEAN;
BEGIN
  v_has_saas_helpers := (
    to_regprocedure('public.get_auth_tenant_id()') IS NOT NULL
    AND to_regprocedure('public.is_master_user()') IS NOT NULL
  );

  -- 3a) Tabelas globais / credenciais ("User" e "Tenant"): negação total externa
  FOREACH v_tbl IN ARRAY ARRAY['User', 'Tenant'] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = v_tbl
    ) THEN
      FOR v_pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = v_tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', v_pol, v_tbl);
      END LOOP;

      v_pol := 'rls_' || lower(v_tbl) || '_deny_external';
      EXECUTE format(
        $pol$CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);$pol$,
        v_pol,
        v_tbl
      );
    END IF;
  END LOOP;

  -- 3b) Tabelas de permissões de navegação: acesso exclusivo via Prisma / service_role
  FOREACH v_tbl IN ARRAY ARRAY[
    'fiorix_nav_group_rules',
    'fiorix_nav_user_rules',
    'fiorix_nav_audit'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = v_tbl
    ) THEN
      FOR v_pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = v_tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', v_pol, v_tbl);
      END LOOP;

      v_pol := left('rls_' || v_tbl || '_deny_external', 63);
      EXECUTE format(
        $pol$CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);$pol$,
        v_pol,
        v_tbl
      );
    END IF;
  END LOOP;

  -- 3c) Tabelas de governança SaaS (InitPlan + separação SELECT/INSERT/UPDATE/DELETE)
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'fiorix_saas_plans'
  ) THEN
    FOR v_pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'fiorix_saas_plans'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.fiorix_saas_plans;', v_pol);
    END LOOP;

    IF v_has_saas_helpers THEN
      EXECUTE $pol$
        CREATE POLICY rls_saas_plans_select ON public.fiorix_saas_plans
          FOR SELECT TO authenticated
          USING (
            is_official = true
            OR tenant_id = (SELECT public.get_auth_tenant_id())
            OR (SELECT public.is_master_user())
          );
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_plans_insert_master ON public.fiorix_saas_plans
          FOR INSERT TO authenticated
          WITH CHECK ((SELECT public.is_master_user()));
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_plans_update_master ON public.fiorix_saas_plans
          FOR UPDATE TO authenticated
          USING ((SELECT public.is_master_user()))
          WITH CHECK ((SELECT public.is_master_user()));
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_plans_delete_master ON public.fiorix_saas_plans
          FOR DELETE TO authenticated
          USING ((SELECT public.is_master_user()));
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_plans_service_role ON public.fiorix_saas_plans
          FOR ALL TO service_role
          USING (true) WITH CHECK (true);
      $pol$;
    ELSE
      EXECUTE $pol$
        CREATE POLICY rls_deny_ext_fiorix_saas_plans ON public.fiorix_saas_plans
          FOR ALL TO anon, authenticated
          USING (false) WITH CHECK (false);
      $pol$;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'fiorix_saas_plan_versions'
  ) THEN
    FOR v_pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'fiorix_saas_plan_versions'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.fiorix_saas_plan_versions;', v_pol);
    END LOOP;

    IF v_has_saas_helpers THEN
      EXECUTE $pol$
        CREATE POLICY rls_saas_plan_versions_select ON public.fiorix_saas_plan_versions
          FOR SELECT TO authenticated
          USING (
            (SELECT public.is_master_user())
            OR EXISTS (
              SELECT 1 FROM public.fiorix_saas_plans p
              WHERE p.id = plan_id AND (
                p.is_official = true
                OR p.tenant_id = (SELECT public.get_auth_tenant_id())
              )
            )
          );
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_plan_versions_insert_master ON public.fiorix_saas_plan_versions
          FOR INSERT TO authenticated
          WITH CHECK ((SELECT public.is_master_user()));
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_plan_versions_update_master ON public.fiorix_saas_plan_versions
          FOR UPDATE TO authenticated
          USING ((SELECT public.is_master_user()))
          WITH CHECK ((SELECT public.is_master_user()));
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_plan_versions_delete_master ON public.fiorix_saas_plan_versions
          FOR DELETE TO authenticated
          USING ((SELECT public.is_master_user()));
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_plan_versions_service_role ON public.fiorix_saas_plan_versions
          FOR ALL TO service_role
          USING (true) WITH CHECK (true);
      $pol$;
    ELSE
      EXECUTE $pol$
        CREATE POLICY rls_deny_ext_fiorix_saas_plan_versions ON public.fiorix_saas_plan_versions
          FOR ALL TO anon, authenticated
          USING (false) WITH CHECK (false);
      $pol$;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'fiorix_saas_role_policies'
  ) THEN
    FOR v_pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'fiorix_saas_role_policies'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.fiorix_saas_role_policies;', v_pol);
    END LOOP;

    IF v_has_saas_helpers THEN
      EXECUTE $pol$
        CREATE POLICY rls_saas_role_policies_select ON public.fiorix_saas_role_policies
          FOR SELECT TO authenticated
          USING (
            tenant_id IS NULL
            OR tenant_id = (SELECT public.get_auth_tenant_id())
            OR (SELECT public.is_master_user())
          );
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_role_policies_insert_master ON public.fiorix_saas_role_policies
          FOR INSERT TO authenticated
          WITH CHECK ((SELECT public.is_master_user()));
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_role_policies_update_master ON public.fiorix_saas_role_policies
          FOR UPDATE TO authenticated
          USING ((SELECT public.is_master_user()))
          WITH CHECK ((SELECT public.is_master_user()));
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_role_policies_delete_master ON public.fiorix_saas_role_policies
          FOR DELETE TO authenticated
          USING ((SELECT public.is_master_user()));
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_role_policies_service_role ON public.fiorix_saas_role_policies
          FOR ALL TO service_role
          USING (true) WITH CHECK (true);
      $pol$;
    ELSE
      EXECUTE $pol$
        CREATE POLICY rls_deny_ext_fiorix_saas_role_policies ON public.fiorix_saas_role_policies
          FOR ALL TO anon, authenticated
          USING (false) WITH CHECK (false);
      $pol$;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'fiorix_saas_governance_audit'
  ) THEN
    DROP POLICY IF EXISTS rls_saas_audit_insert ON public.fiorix_saas_governance_audit;
    DROP POLICY IF EXISTS rls_saas_audit_insert_master_only ON public.fiorix_saas_governance_audit;

    FOR v_pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'fiorix_saas_governance_audit'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.fiorix_saas_governance_audit;', v_pol);
    END LOOP;

    IF v_has_saas_helpers THEN
      EXECUTE $pol$
        CREATE POLICY rls_saas_audit_select ON public.fiorix_saas_governance_audit
          FOR SELECT TO authenticated
          USING (
            (SELECT public.is_master_user())
            OR tenant_id = (SELECT public.get_auth_tenant_id())
          );
      $pol$;
      EXECUTE $pol$
        CREATE POLICY rls_saas_audit_service_role ON public.fiorix_saas_governance_audit
          FOR ALL TO service_role
          USING (true) WITH CHECK (true);
      $pol$;
    ELSE
      EXECUTE $pol$
        CREATE POLICY rls_deny_ext_fiorix_saas_governance_audit ON public.fiorix_saas_governance_audit
          FOR ALL TO anon, authenticated
          USING (false) WITH CHECK (false);
      $pol$;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'fiorix_saas_security_audit_logs'
  ) THEN
    DROP POLICY IF EXISTS rls_saas_audit_insert ON public.fiorix_saas_security_audit_logs;

    FOR v_pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'fiorix_saas_security_audit_logs'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.fiorix_saas_security_audit_logs;', v_pol);
    END LOOP;

    EXECUTE $pol$
      CREATE POLICY rls_deny_ext_fiorix_saas_security_audit_logs ON public.fiorix_saas_security_audit_logs
        FOR ALL TO anon, authenticated
        USING (false) WITH CHECK (false);
    $pol$;
  END IF;

  -- 3d) Tabelas granulares de implantação de serviços ((SELECT auth.uid())::text)
  FOREACH v_tbl IN ARRAY ARRAY[
    'fiorix_tenant_services',
    'fiorix_service_deployments',
    'fiorix_service_suspensions',
    'fiorix_granular_audit'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = v_tbl
    ) THEN
      FOR v_pol IN
        SELECT policyname FROM pg_policies
        WHERE schemaname = 'public' AND tablename = v_tbl
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', v_pol, v_tbl);
      END LOOP;

      v_pol := left('rls_sel_' || v_tbl, 63);
      EXECUTE format(
        $pol$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (tenant_id = (SELECT "tenantId" FROM public."User" WHERE id = (SELECT auth.uid())::text));$pol$,
        v_pol,
        v_tbl
      );
    END IF;
  END LOOP;
END;
$lockdown$;

-- ----------------------------------------------------------------------------
-- 4. VARREDURA UNIVERSAL NAS DEMAIS TABELAS DE `public`
--    Remove policies legadas duplicadas ("allow all", tenant_isolation_*, etc.),
--    aplica InitPlan `(SELECT NULLIF(current_setting('app.current_tenant_id', true), ''))`
--    para tabelas multi-tenant (tenant_id / "tenantId") ou deny-all para tabelas sem tenant.
-- ----------------------------------------------------------------------------
DO $lockdown$
DECLARE
  r RECORD;
  v_pol TEXT;
  v_has_snake_tenant BOOLEAN;
  v_has_camel_tenant BOOLEAN;
BEGIN
  FOR r IN
    SELECT t.tablename
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.tablename <> '_prisma_migrations'
      AND t.tablename NOT IN (
        'User',
        'Tenant',
        'fiorix_nav_group_rules',
        'fiorix_nav_user_rules',
        'fiorix_nav_audit',
        'fiorix_saas_plans',
        'fiorix_saas_plan_versions',
        'fiorix_saas_role_policies',
        'fiorix_saas_governance_audit',
        'fiorix_saas_security_audit_logs',
        'fiorix_tenant_services',
        'fiorix_service_deployments',
        'fiorix_service_suspensions',
        'fiorix_granular_audit'
      )
    ORDER BY t.tablename
  LOOP
    -- Remove todas as policies legadas/duplicadas da tabela antes de recriar a canônica
    FOR v_pol IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = r.tablename
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', v_pol, r.tablename);
    END LOOP;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tablename AND column_name = 'tenant_id'
    ) INTO v_has_snake_tenant;

    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tablename AND column_name = 'tenantId'
    ) INTO v_has_camel_tenant;

    IF v_has_snake_tenant THEN
      v_pol := left('rls_tenant_iso_' || lower(r.tablename), 63);
      EXECUTE format(
        $pol$CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (tenant_id <> '' AND tenant_id = (SELECT NULLIF(current_setting('app.current_tenant_id', true), ''))) WITH CHECK (tenant_id <> '' AND tenant_id = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')));$pol$,
        v_pol,
        r.tablename
      );
    ELSIF v_has_camel_tenant THEN
      v_pol := left('rls_tenant_iso_' || lower(r.tablename), 63);
      EXECUTE format(
        $pol$CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ("tenantId" <> '' AND "tenantId" = (SELECT NULLIF(current_setting('app.current_tenant_id', true), ''))) WITH CHECK ("tenantId" <> '' AND "tenantId" = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')));$pol$,
        v_pol,
        r.tablename
      );
    ELSE
      v_pol := left('rls_deny_ext_' || lower(r.tablename), 63);
      EXECUTE format(
        $pol$CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);$pol$,
        v_pol,
        r.tablename
      );
    END IF;
  END LOOP;
END;
$lockdown$;

-- ----------------------------------------------------------------------------
-- 5. FIXAÇÃO DE search_path EM FUNÇÕES DE TRIGGER E AUDITORIA
-- ----------------------------------------------------------------------------
DO $lockdown$
BEGIN
  IF to_regprocedure('public.fn_prevent_fiorix_saas_governance_audit_mutation()') IS NOT NULL THEN
    ALTER FUNCTION public.fn_prevent_fiorix_saas_governance_audit_mutation()
      SET search_path = pg_catalog, public;
  END IF;

  IF to_regprocedure('public.fn_check_nav_user_rule_tenant()') IS NOT NULL THEN
    ALTER FUNCTION public.fn_check_nav_user_rule_tenant()
      SET search_path = pg_catalog, public;
  END IF;

  IF to_regprocedure('public.doc_manifestacao_imutavel()') IS NOT NULL THEN
    ALTER FUNCTION public.doc_manifestacao_imutavel()
      SET search_path = pg_catalog, public;
  END IF;
END;
$lockdown$;

COMMIT;

