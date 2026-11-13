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
--      (fiorix_holerites, fiorix_colaboradores, fiorix_comunicados, etc.) e
--      quaisquer tabelas criadas por DDL dinâmico em runtime.
--   3. Corrigir policies RLS que usavam current_setting('app.current_tenant_id', true)
--      direto (onde GUC vazia '' casava com tenant_id DEFAULT ''), exigindo
--      NULLIF(current_setting('app.current_tenant_id', true), '') e nunca
--      permitindo correspondência vazia.
--   4. Remover a policy aberta rls_saas_audit_insert na trilha de governança.
--   5. Fixar search_path imutável em fn_prevent_fiorix_saas_governance_audit_mutation.
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
-- 3. REMOÇÃO DE POLICIES INSEGURAS / PERMISSIVAS LEGADAS (HIGH-12)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'fiorix_saas_governance_audit'
  ) THEN
    DROP POLICY IF EXISTS rls_saas_audit_insert ON public.fiorix_saas_governance_audit;
    DROP POLICY IF EXISTS rls_saas_audit_insert_master_only ON public.fiorix_saas_governance_audit;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'fiorix_saas_security_audit_logs'
  ) THEN
    DROP POLICY IF EXISTS rls_saas_audit_insert ON public.fiorix_saas_security_audit_logs;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. CORREÇÃO DAS POLICIES BASEADAS EM app.current_tenant_id (NULLIF -> NUNCA '')
--    Inclui tanto tabelas snake_case (@@map reais do banco) quanto tabelas BI/Connector.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_tbl TEXT;
  v_col TEXT;
  v_pol TEXT;
BEGIN
  -- 4a) Tabelas com coluna snake_case `tenant_id`
  FOREACH v_tbl IN ARRAY ARRAY[
    'fiorix_bi_imports',
    'fiorix_bi_data',
    'fiorix_metas_imports',
    'fiorix_metas_dados',
    'fiorix_produtividade_imports',
    'fiorix_produtividade_dados',
    'fiorix_tarefas_imports',
    'fiorix_tarefas_dados',
    'fiorix_impressoes_imports',
    'fiorix_impressoes_dados',
    'fiorix_retornos_imports',
    'fiorix_retornos_dados',
    'fiorix_intervencoes',
    'fiorix_relatorios',
    'fiorix_comunicados',
    'fiorix_comunicados_anexos',
    'fiorix_comunicados_ciencia',
    'fiorix_holerites',
    'fiorix_colaboradores',
    'fiorix_ferias_previstas',
    'fiorix_ferias_previstas_historico',
    'fiorix_ferias_avisos',
    'fiorix_ferias_solicitacoes',
    'fiorix_acesso_logs',
    'fiorix_its',
    'fiorix_its_participants',
    'fiorix_its_ciencias',
    'fiorix_its_audit_logs',
    'fiorix_integration_configs',
    'fiorix_integration_audit_logs',
    'fiorix_operations_alert_channels',
    'fiorix_operations_alert_logs',
    'fiorix_connector_telemetry',
    'fiorix_connector_enrollment_tokens',
    'fiorix_connector_ha_nodes',
    'fiorix_documental_sessoes',
    'srvsql_perf_incidents'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_tbl
        AND column_name = 'tenant_id'
    ) THEN
      -- Remove eventuais policies antigas vulneráveis a '' = ''
      FOR v_pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = v_tbl
          AND policyname LIKE 'tenant_isolation_%'
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', v_pol, v_tbl);
      END LOOP;

      v_pol := left('rls_tenant_iso_' || v_tbl, 63);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', v_pol, v_tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated ' ||
        'USING (tenant_id <> '''' AND tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')) ' ||
        'WITH CHECK (tenant_id <> '''' AND tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), ''''));',
        v_pol,
        v_tbl
      );
    END IF;
  END LOOP;

  -- 4b) Tabelas com coluna camelCase `"tenantId"`
  FOREACH v_tbl IN ARRAY ARRAY[
    'Review',
    'GoogleConnection',
    'Connector',
    'ConnectorSyncBatch',
    'ConnectorSyncStaging',
    'DocumentSearchRequest',
    'DocumentSignatureConference',
    'EsperaTicket',
    'Conversa',
    'ConversaMembro',
    'ConversaParticipante',
    'Mensagem',
    'MessagingPolicy',
    'MessagingAuditLog',
    'PushSubscription'
  ] LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_tbl
        AND column_name = 'tenantId'
    ) THEN
      FOR v_pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = v_tbl
          AND policyname LIKE 'tenant_isolation_%'
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', v_pol, v_tbl);
      END LOOP;

      v_pol := left('rls_tenant_iso_' || lower(v_tbl), 63);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', v_pol, v_tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated ' ||
        'USING ("tenantId" <> '''' AND "tenantId" = NULLIF(current_setting(''app.current_tenant_id'', true), '''')) ' ||
        'WITH CHECK ("tenantId" <> '''' AND "tenantId" = NULLIF(current_setting(''app.current_tenant_id'', true), ''''));',
        v_pol,
        v_tbl
      );
    END IF;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. POLICIES EXPLÍCITAS DE NEGAÇÃO EXTERNA PARA TABELAS GLOBAIS / CREDENCIAIS
--    ("User", "Tenant" e qualquer tabela residual sem policy em pg_policies)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
  v_pol TEXT;
BEGIN
  -- Negação total explícita em "User" e "Tenant" para anon e authenticated
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'User') THEN
    DROP POLICY IF EXISTS rls_user_deny_external ON public."User";
    CREATE POLICY rls_user_deny_external
      ON public."User"
      FOR ALL
      TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;

  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'Tenant') THEN
    DROP POLICY IF EXISTS rls_tenant_deny_external ON public."Tenant";
    CREATE POLICY rls_tenant_deny_external
      ON public."Tenant"
      FOR ALL
      TO anon, authenticated
      USING (false)
      WITH CHECK (false);
  END IF;

  -- Cobertura universal: toda tabela public com RLS ativo recebe ao menos uma
  -- policy explícita deny-all para papéis externos (elimina rls_enabled_no_policy)
  FOR r IN
    SELECT t.tablename
    FROM pg_tables t
    WHERE t.schemaname = 'public'
      AND t.tablename <> '_prisma_migrations'
      AND NOT EXISTS (
        SELECT 1
        FROM pg_policies p
        WHERE p.schemaname = 'public'
          AND p.tablename = t.tablename
      )
  LOOP
    v_pol := left('rls_deny_ext_' || lower(r.tablename), 63);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);',
      v_pol,
      r.tablename
    );
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. FIXAÇÃO DE search_path EM FUNÇÃO DE TRIGGER DE AUDITORIA
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

