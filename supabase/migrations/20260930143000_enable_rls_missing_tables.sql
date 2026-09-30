-- Migration: 20260930143000_enable_rls_missing_tables.sql
-- Resolução do alerta crítico de segurança Supabase: rls_disabled_in_public
-- Habilita Row Level Security (RLS) e isolamento multi-tenant para as 4 tabelas expostas.

DO $$ BEGIN

  -- 1. CONTROLE DE IMPRESSÕES
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='fiorix_impressoes_dados' AND table_schema='public') THEN
    ALTER TABLE public.fiorix_impressoes_dados ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tenant_isolation_impressoes_dados" ON public.fiorix_impressoes_dados;
    CREATE POLICY "tenant_isolation_impressoes_dados" ON public.fiorix_impressoes_dados
      FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;

  -- 2. CONTROLE DE RETORNOS
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='fiorix_retornos_dados' AND table_schema='public') THEN
    ALTER TABLE public.fiorix_retornos_dados ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tenant_isolation_retornos_dados" ON public.fiorix_retornos_dados;
    CREATE POLICY "tenant_isolation_retornos_dados" ON public.fiorix_retornos_dados
      FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;

  -- 3. CONFIGURAÇÕES DE INTEGRAÇÃO
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='fiorix_integration_configs' AND table_schema='public') THEN
    ALTER TABLE public.fiorix_integration_configs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tenant_isolation_integration_configs" ON public.fiorix_integration_configs;
    CREATE POLICY "tenant_isolation_integration_configs" ON public.fiorix_integration_configs
      FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;

  -- 4. LOGS DE AUDITORIA DE INTEGRAÇÃO
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='fiorix_integration_audit_logs' AND table_schema='public') THEN
    ALTER TABLE public.fiorix_integration_audit_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tenant_isolation_integration_audit_logs" ON public.fiorix_integration_audit_logs;
    CREATE POLICY "tenant_isolation_integration_audit_logs" ON public.fiorix_integration_audit_logs
      FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;

END $$;
