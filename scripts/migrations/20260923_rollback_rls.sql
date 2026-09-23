-- ==============================================================================
-- FIORIX - SCRIPT DE ROLLBACK DE RLS
-- Arquivo: 20260923_rollback_rls.sql
-- Descrição: Reverte a habilitação de RLS nas 27 tabelas caso necessário.
-- ==============================================================================

ALTER TABLE public.fiorix_acesso_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_comunicados DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_comunicados_anexos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_comunicados_ciencia DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_connector_telemetry DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_departamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_ferias_avisos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_ferias_escala DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_ferias_previstas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_ferias_previstas_historico DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_ferias_publicacao DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_holerites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_aceites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_ciencias DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_column_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_propostas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_solicitacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_its_versoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_matriz_polivalencia DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_notificacoes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_operations_alert_channels DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_operations_alert_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_trilhas_estudo DISABLE ROW LEVEL SECURITY;
