-- ==============================================================================
-- FIORIX - MIGRAÇÃO DE SEGURANÇA ESTRUTURAL
-- Arquivo: 20260923_enable_rls_and_storage_hardening.sql
-- Descrição:
--   1. Habilita Row Level Security (RLS) nas 27 tabelas do schema public.
--   2. Garante acesso total (ALL) para o papel service_role do Supabase.
--   3. Revoga privilégios do papel anon nas tabelas de auditoria e telemetria.
--   4. Revoga políticas públicas de DELETE/UPDATE no storage.objects para it-documentos e fiorix-its.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HABILITAÇÃO DE ROW LEVEL SECURITY (RLS) NAS 27 TABELAS PÚBLICAS
-- ------------------------------------------------------------------------------

ALTER TABLE public.fiorix_acesso_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_comunicados_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_comunicados_ciencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_connector_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_departamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_ferias_avisos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_ferias_escala ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_ferias_previstas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_ferias_previstas_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_ferias_publicacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_holerites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_aceites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_ciencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_column_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_solicitacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_matriz_polivalencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_operations_alert_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_operations_alert_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_trilhas_estudo ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 2. POLÍTICAS DE ACESSO TOTAL PARA service_role (OPERAÇÕES ADMINISTRATIVAS)
-- ------------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'fiorix_acesso_log',
    'fiorix_audit_logs',
    'fiorix_comunicados',
    'fiorix_comunicados_anexos',
    'fiorix_comunicados_ciencia',
    'fiorix_connector_telemetry',
    'fiorix_departamentos',
    'fiorix_ferias_avisos',
    'fiorix_ferias_escala',
    'fiorix_ferias_previstas',
    'fiorix_ferias_previstas_historico',
    'fiorix_ferias_publicacao',
    'fiorix_holerites',
    'fiorix_its',
    'fiorix_its_aceites',
    'fiorix_its_audit_log',
    'fiorix_its_ciencias',
    'fiorix_its_column_config',
    'fiorix_its_participants',
    'fiorix_its_propostas',
    'fiorix_its_solicitacoes',
    'fiorix_its_versoes',
    'fiorix_matriz_polivalencia',
    'fiorix_notificacoes',
    'fiorix_operations_alert_channels',
    'fiorix_operations_alert_logs',
    'fiorix_trilhas_estudo'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', 'service_role_all_' || t, t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);', 'service_role_all_' || t, t);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 3. DEFESA EM PROFUNDIDADE: REVOGAÇÃO DE PRIVILÉGIOS DCL DO PAPEL anon
-- ------------------------------------------------------------------------------

REVOKE ALL ON public.fiorix_audit_logs FROM anon;
REVOKE ALL ON public.fiorix_acesso_log FROM anon;
REVOKE ALL ON public.fiorix_connector_telemetry FROM anon;
REVOKE ALL ON public.fiorix_operations_alert_logs FROM anon;
REVOKE ALL ON public.fiorix_operations_alert_channels FROM anon;
REVOKE ALL ON public.fiorix_its_audit_log FROM anon;
REVOKE ALL ON public.fiorix_ferias_escala FROM anon;
REVOKE ALL ON public.fiorix_holerites FROM anon;

-- ------------------------------------------------------------------------------
-- 4. HARDENING DO SUPABASE STORAGE (REVOGAÇÃO DE POLÍTICAS PÚBLICAS PERIGOSAS)
-- ------------------------------------------------------------------------------

-- Remove políticas de UPDATE e DELETE abertas ao público que permitiam adulteração
DROP POLICY IF EXISTS "allow-all-delete-it-documentos" ON storage.objects;
DROP POLICY IF EXISTS "allow-all-update-it-documentos" ON storage.objects;
DROP POLICY IF EXISTS "allow-all-fiorix-its-update" ON storage.objects;

-- Remove políticas de INSERT direto do cliente não autenticado
DROP POLICY IF EXISTS "allow-all-fiorix-its-insert" ON storage.objects;
DROP POLICY IF EXISTS "allow-all l1s17l_1" ON storage.objects;

-- Garante que o papel service_role possui gerenciamento total em storage.objects
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'service_role_all_storage'
  ) THEN
    CREATE POLICY "service_role_all_storage" ON storage.objects FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
