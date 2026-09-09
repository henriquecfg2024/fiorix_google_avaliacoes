-- VULN-011: Habilitar RLS e adicionar políticas de isolamento multi-tenant
-- em TODAS as tabelas fiorix_* que estavam sem proteção.
-- A migração anterior (20260815120000) cobriu apenas fiorix_bi_data e fiorix_bi_imports.
-- NOTA: O Prisma usa superusuário (bypassa RLS), mas essa é uma defesa em profundidade
-- contra acessos diretos via ANON_KEY do Supabase/PostgREST.

-- ══════════════════════════════════════════════════════════════
-- METAS (RLS habilitado mas sem políticas restritivas)
-- ══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "tenant_isolation_metas_imports" ON public.fiorix_metas_imports;
CREATE POLICY "tenant_isolation_metas_imports" ON public.fiorix_metas_imports
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS "tenant_isolation_metas_dados" ON public.fiorix_metas_dados;
CREATE POLICY "tenant_isolation_metas_dados" ON public.fiorix_metas_dados
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- ══════════════════════════════════════════════════════════════
-- PRODUTIVIDADE
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiorix_produtividade_dados' AND table_schema = 'public') THEN
    ALTER TABLE public.fiorix_produtividade_dados ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tenant_isolation_produtividade" ON public.fiorix_produtividade_dados;
    CREATE POLICY "tenant_isolation_produtividade" ON public.fiorix_produtividade_dados
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- TAREFAS
-- ══════════════════════════════════════════════════════════════

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fiorix_tarefas_dados' AND table_schema = 'public') THEN
    ALTER TABLE public.fiorix_tarefas_dados ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "tenant_isolation_tarefas" ON public.fiorix_tarefas_dados;
    CREATE POLICY "tenant_isolation_tarefas" ON public.fiorix_tarefas_dados
      FOR ALL
      USING (tenant_id = current_setting('app.current_tenant_id', true))
      WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════
-- INTERVENCOES
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.fiorix_intervencoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_intervencoes" ON public.fiorix_intervencoes;
CREATE POLICY "tenant_isolation_intervencoes" ON public.fiorix_intervencoes
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- ══════════════════════════════════════════════════════════════
-- RELATORIOS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.fiorix_relatorios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_relatorios" ON public.fiorix_relatorios;
CREATE POLICY "tenant_isolation_relatorios" ON public.fiorix_relatorios
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- ══════════════════════════════════════════════════════════════
-- RATE LIMITS (sem tenant_id — é global, mas habilitar RLS bloqueia anon)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public.fiorix_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "deny_anon_rate_limits" ON public.fiorix_rate_limits;
CREATE POLICY "deny_anon_rate_limits" ON public.fiorix_rate_limits
  FOR ALL
  USING (false);
-- Prisma (superusuário) bypassa. PostgREST/anon fica bloqueado.

-- ══════════════════════════════════════════════════════════════
-- COMUNICADOS, CIÊNCIAS e ANEXOS (tabelas Prisma com tenantId)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public."FiorixComunicado" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_comunicado" ON public."FiorixComunicado";
CREATE POLICY "tenant_isolation_comunicado" ON public."FiorixComunicado"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

ALTER TABLE public."FiorixComunicadoCiencia" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_ciencia" ON public."FiorixComunicadoCiencia";
CREATE POLICY "tenant_isolation_ciencia" ON public."FiorixComunicadoCiencia"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

ALTER TABLE public."FiorixComunicadoAnexo" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_anexo" ON public."FiorixComunicadoAnexo";
CREATE POLICY "tenant_isolation_anexo" ON public."FiorixComunicadoAnexo"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

-- ══════════════════════════════════════════════════════════════
-- HOLERITES
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public."FiorixHolerite" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_holerite" ON public."FiorixHolerite";
CREATE POLICY "tenant_isolation_holerite" ON public."FiorixHolerite"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

-- ══════════════════════════════════════════════════════════════
-- FÉRIAS
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public."FiorixFeriasPrevista" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_ferias" ON public."FiorixFeriasPrevista";
CREATE POLICY "tenant_isolation_ferias" ON public."FiorixFeriasPrevista"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

ALTER TABLE public."FiorixFeriasPrevistaHistorico" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_ferias_hist" ON public."FiorixFeriasPrevistaHistorico";
CREATE POLICY "tenant_isolation_ferias_hist" ON public."FiorixFeriasPrevistaHistorico"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

ALTER TABLE public."FiorixFeriasAviso" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_ferias_aviso" ON public."FiorixFeriasAviso";
CREATE POLICY "tenant_isolation_ferias_aviso" ON public."FiorixFeriasAviso"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

-- ══════════════════════════════════════════════════════════════
-- ACESSO LOGS (LGPD)
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public."FiorixAcessoLog" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_acesso_log" ON public."FiorixAcessoLog";
CREATE POLICY "tenant_isolation_acesso_log" ON public."FiorixAcessoLog"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

-- ══════════════════════════════════════════════════════════════
-- CONNECTOR TABLES
-- ══════════════════════════════════════════════════════════════

ALTER TABLE public."Connector" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_connector" ON public."Connector";
CREATE POLICY "tenant_isolation_connector" ON public."Connector"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));

ALTER TABLE public."ConnectorSyncBatch" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_sync_batch" ON public."ConnectorSyncBatch";
CREATE POLICY "tenant_isolation_sync_batch" ON public."ConnectorSyncBatch"
  FOR ALL
  USING ("tenantId" = current_setting('app.current_tenant_id', true))
  WITH CHECK ("tenantId" = current_setting('app.current_tenant_id', true));
