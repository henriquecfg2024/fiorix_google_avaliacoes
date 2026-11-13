-- ============================================================================
-- FIORIX — Bootstrap sintético de banco PostgreSQL efêmero (CI / Docker local)
-- Simula roles Supabase (`anon`, `authenticated`, `service_role`), `auth.uid()`,
-- tabelas críticas multi-tenant e triggers antes de executar
-- `supabase/migrations/20261113000000_lockdown_public_schema_and_rls.sql`.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END;
$$;

CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT "tenantId" FROM public."User" WHERE id = (SELECT auth.uid())::text LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_master_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE((SELECT role = 'MASTER' FROM public."User" WHERE id = (SELECT auth.uid())::text LIMIT 1), false);
$$;

CREATE TABLE IF NOT EXISTS public._prisma_migrations (
  id text PRIMARY KEY,
  migration_name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public."Tenant" (
  id text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public."User" (
  id text PRIMARY KEY,
  "tenantId" text NOT NULL,
  role text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fiorix_nav_group_rules (
  id text PRIMARY KEY,
  tenant_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fiorix_nav_user_rules (
  id text PRIMARY KEY,
  tenant_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fiorix_nav_audit (
  id text PRIMARY KEY,
  tenant_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fiorix_saas_plans (
  id text PRIMARY KEY,
  tenant_id text,
  is_official boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS public.fiorix_saas_plan_versions (
  id text PRIMARY KEY,
  plan_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fiorix_saas_role_policies (
  id text PRIMARY KEY,
  tenant_id text
);

CREATE TABLE IF NOT EXISTS public.fiorix_saas_governance_audit (
  id text PRIMARY KEY,
  tenant_id text
);

CREATE TABLE IF NOT EXISTS public.fiorix_saas_security_audit_logs (
  id text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.fiorix_tenant_services (
  id text PRIMARY KEY,
  tenant_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fiorix_holerites (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  usuario_id text NOT NULL,
  arquivo_nome text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.fiorix_connector_nodes (
  id text PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS public."AuditLog" (
  id text PRIMARY KEY,
  "tenantId" text NOT NULL,
  action text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.global_system_setting (
  key text PRIMARY KEY,
  val text NOT NULL
);

-- Simula regressão pré-migração: tabela com RLS desligado, policy aberta e grant indevido para anon/authenticated
ALTER TABLE public.fiorix_holerites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS allow_all_legacy ON public.fiorix_holerites;
CREATE POLICY allow_all_legacy ON public.fiorix_holerites FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON public.fiorix_holerites TO anon, authenticated;

-- Funções de trigger sem search_path fixo (a migração de lockdown deve corrigi-las)
CREATE OR REPLACE FUNCTION public.fn_prevent_fiorix_saas_governance_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_check_nav_user_rule_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.doc_manifestacao_imutavel()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Dados sintéticos isolados por tenant
INSERT INTO public."Tenant" (id, name) VALUES
  ('tenant-a', 'Cartório Sintético A'),
  ('tenant-b', 'Cartório Sintético B')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public."User" (id, "tenantId", role) VALUES
  ('11111111-1111-4111-8111-111111111111', 'tenant-a', 'ADMIN'),
  ('22222222-2222-4222-8222-222222222222', 'tenant-b', 'ADMIN')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.fiorix_holerites (id, tenant_id, usuario_id, arquivo_nome) VALUES
  ('hol-a1', 'tenant-a', '11111111-1111-4111-8111-111111111111', 'hol-a.pdf'),
  ('hol-b1', 'tenant-b', '22222222-2222-4222-8222-222222222222', 'hol-b.pdf')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public."AuditLog" (id, "tenantId", action) VALUES
  ('aud-a1', 'tenant-a', 'LOGIN'),
  ('aud-b1', 'tenant-b', 'LOGIN')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.global_system_setting (key, val) VALUES
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;
