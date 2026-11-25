-- ============================================================================
-- ⚠️  ROLLBACK PREPARADO — NÃO APLICAR SEM AUTORIZAÇÃO DO MASTER  ⚠️
-- ============================================================================
-- FIORIX — Agenda Inteligente V1.0 + Boas-Vindas Inteligentes
-- Arquivo : 20261125090000_fiorix_agenda_inteligente_v1_rollback.sql
-- Status  : PREPARADA LOCALMENTE. NÃO APLICADA EM NENHUM AMBIENTE.
-- ============================================================================

BEGIN;

DROP TABLE IF EXISTS public.agenda_audit_logs;
DROP TABLE IF EXISTS public.agenda_user_preferences;
DROP TABLE IF EXISTS public.agenda_notification_deliveries;
DROP TABLE IF EXISTS public.agenda_notification_jobs;
DROP TABLE IF EXISTS public.agenda_reminders;
DROP TABLE IF EXISTS public.agenda_occurrence_status;
DROP TABLE IF EXISTS public.agenda_recurrence_exceptions;
DROP TABLE IF EXISTS public.agenda_participants;
DROP TABLE IF EXISTS public.agenda_events;
DROP TABLE IF EXISTS public.agenda_categories;

COMMIT;
