-- ============================================================================
-- ⚠️  MIGRATION PREPARADA — NÃO APLICAR SEM AUTORIZAÇÃO DO MASTER  ⚠️
-- ============================================================================
-- FIORIX — Agenda Inteligente V1.0 + Boas-Vindas Inteligentes
-- Arquivo : 20261125090000_fiorix_agenda_inteligente_v1.sql
-- Status  : PREPARADA LOCALMENTE. NÃO APLICADA EM NENHUM AMBIENTE.
-- Local   : supabase/prepared-migrations/ (fora de supabase/migrations/).
--
-- Rollback correspondente:
--   20261125090000_fiorix_agenda_inteligente_v1_rollback.sql
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.agenda_categories (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  slug text NOT NULL,
  name text NOT NULL,
  color text NOT NULL,
  icon text NOT NULL,
  scope text NOT NULL DEFAULT 'INSTITUCIONAL',
  owner_user_id text NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_agenda_categories_tenant_slug UNIQUE (tenant_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_agenda_categories_tenant_scope
  ON public.agenda_categories (tenant_id, scope, is_active);

CREATE TABLE IF NOT EXISTS public.agenda_events (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  category_id text NULL REFERENCES public.agenda_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NULL,
  color text NOT NULL,
  icon text NOT NULL,
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  all_day boolean NOT NULL DEFAULT false,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  local_start_date text NOT NULL,
  local_start_time text NOT NULL,
  local_end_date text NOT NULL,
  local_end_time text NOT NULL,
  location text NULL,
  meeting_link text NULL,
  notes text NULL,
  priority text NOT NULL DEFAULT 'NORMAL',
  status text NOT NULL DEFAULT 'AGENDADO',
  visibility text NOT NULL DEFAULT 'INDIVIDUAL',
  is_confidential boolean NOT NULL DEFAULT false,
  owner_user_id text NOT NULL,
  owner_name text NULL,
  department text NULL,
  recurrence_type text NOT NULL DEFAULT 'UNICO',
  recurrence_rule jsonb NULL,
  rrule_text text NULL,
  attachments_json jsonb NULL,
  completed_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  retention_class text NOT NULL DEFAULT 'OPERACIONAL',
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_agenda_events_window CHECK (end_at >= start_at),
  CONSTRAINT chk_agenda_events_visibility CHECK (visibility IN ('INDIVIDUAL', 'COMPARTILHADO', 'SETORIAL', 'INSTITUCIONAL'))
);

CREATE INDEX IF NOT EXISTS idx_agenda_events_tenant_window
  ON public.agenda_events (tenant_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_agenda_events_owner_vis
  ON public.agenda_events (tenant_id, owner_user_id, visibility);
CREATE INDEX IF NOT EXISTS idx_agenda_events_dept_vis
  ON public.agenda_events (tenant_id, department, visibility);
CREATE INDEX IF NOT EXISTS idx_agenda_events_status
  ON public.agenda_events (tenant_id, status, start_at);

CREATE TABLE IF NOT EXISTS public.agenda_participants (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  user_name text NULL,
  user_email text NULL,
  rsvp_status text NOT NULL DEFAULT 'PENDENTE',
  can_edit boolean NOT NULL DEFAULT false,
  responded_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_agenda_participants_event_user UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agenda_participants_user
  ON public.agenda_participants (tenant_id, user_id, rsvp_status);

CREATE TABLE IF NOT EXISTS public.agenda_recurrence_exceptions (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  occurrence_date text NOT NULL,
  scope text NOT NULL DEFAULT 'SINGLE',
  action text NOT NULL DEFAULT 'MODIFIED',
  override_start timestamptz NULL,
  override_end timestamptz NULL,
  override_title text NULL,
  override_notes text NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_agenda_rec_exc_event_date UNIQUE (event_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_agenda_rec_exc_lookup
  ON public.agenda_recurrence_exceptions (tenant_id, event_id, occurrence_date);

CREATE TABLE IF NOT EXISTS public.agenda_occurrence_status (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  occurrence_date text NOT NULL,
  status text NOT NULL DEFAULT 'AGENDADO',
  completed_by text NULL,
  completed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_agenda_occ_status_event_date UNIQUE (event_id, occurrence_date)
);

CREATE INDEX IF NOT EXISTS idx_agenda_occ_status_lookup
  ON public.agenda_occurrence_status (tenant_id, status, occurrence_date);

CREATE TABLE IF NOT EXISTS public.agenda_reminders (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  channel text NOT NULL,
  offset_minutes integer NOT NULL,
  is_mandatory boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_reminders_lookup
  ON public.agenda_reminders (tenant_id, event_id, user_id);

CREATE TABLE IF NOT EXISTS public.agenda_notification_jobs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES public.agenda_events(id) ON DELETE CASCADE,
  reminder_id text NULL REFERENCES public.agenda_reminders(id) ON DELETE SET NULL,
  recipient_user_id text NOT NULL,
  occurrence_key text NOT NULL,
  channel text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'PENDENTE',
  snoozed_until timestamptz NULL,
  read_at timestamptz NULL,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 4,
  locked_at timestamptz NULL,
  locked_by text NULL,
  last_error text NULL,
  payload_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_jobs_recipient_due
  ON public.agenda_notification_jobs (tenant_id, recipient_user_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_agenda_jobs_worker_due
  ON public.agenda_notification_jobs (status, scheduled_for);

CREATE TABLE IF NOT EXISTS public.agenda_notification_deliveries (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  job_id text NOT NULL REFERENCES public.agenda_notification_jobs(id) ON DELETE CASCADE,
  recipient_user_id text NOT NULL,
  recipient_email text NULL,
  channel text NOT NULL,
  status text NOT NULL,
  provider_message_id text NULL,
  attempts integer NOT NULL DEFAULT 1,
  error_message text NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_deliveries_job
  ON public.agenda_notification_deliveries (tenant_id, job_id);
CREATE INDEX IF NOT EXISTS idx_agenda_deliveries_user
  ON public.agenda_notification_deliveries (tenant_id, recipient_user_id, processed_at DESC);

CREATE TABLE IF NOT EXISTS public.agenda_user_preferences (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  default_view text NOT NULL DEFAULT 'MENSAL',
  week_starts_on integer NOT NULL DEFAULT 0,
  preferred_categories jsonb NULL,
  default_channel text NOT NULL DEFAULT 'EMAIL',
  default_offset_minutes integer NOT NULL DEFAULT 30,
  quiet_hours_start text NULL,
  quiet_hours_end text NULL,
  show_completed boolean NOT NULL DEFAULT true,
  web_push_enabled boolean NOT NULL DEFAULT false,
  calendar_compact_format boolean NOT NULL DEFAULT false,
  theme_mode text NOT NULL DEFAULT 'light',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_agenda_user_prefs UNIQUE (tenant_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.agenda_audit_logs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  event_id text NULL,
  actor_user_id text NOT NULL,
  actor_name text NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  summary text NOT NULL,
  metadata jsonb NULL,
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_audit_tenant
  ON public.agenda_audit_logs (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agenda_audit_event
  ON public.agenda_audit_logs (tenant_id, event_id);

-- ── RLS & LOCKDOWN (padrão FIORIX / fail-closed) ────────────────────────────
ALTER TABLE public.agenda_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_recurrence_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_occurrence_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_notification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_audit_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.agenda_categories FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agenda_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agenda_participants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agenda_recurrence_exceptions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agenda_occurrence_status FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agenda_reminders FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agenda_notification_jobs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agenda_notification_deliveries FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agenda_user_preferences FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.agenda_audit_logs FROM PUBLIC, anon, authenticated;

-- Políticas por tenant para sessões com contexto explícito de tenant/usuário
CREATE POLICY agenda_categories_tenant_isolation ON public.agenda_categories
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()));

-- Compromissos INDIVIDUAL são estritamente privados ao dono/criador
CREATE POLICY agenda_events_tenant_and_privacy ON public.agenda_events
  USING (
    tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id())
    AND (
      visibility <> 'INDIVIDUAL'
      OR owner_user_id = COALESCE(NULLIF(current_setting('app.current_user_id', true), ''), (auth.uid())::text)
      OR created_by = COALESCE(NULLIF(current_setting('app.current_user_id', true), ''), (auth.uid())::text)
    )
  )
  WITH CHECK (
    tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id())
  );

CREATE POLICY agenda_participants_tenant_isolation ON public.agenda_participants
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()));

CREATE POLICY agenda_recurrence_exceptions_tenant_isolation ON public.agenda_recurrence_exceptions
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()));

CREATE POLICY agenda_occurrence_status_tenant_isolation ON public.agenda_occurrence_status
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()));

CREATE POLICY agenda_reminders_tenant_isolation ON public.agenda_reminders
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()));

CREATE POLICY agenda_notification_jobs_tenant_isolation ON public.agenda_notification_jobs
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()));

CREATE POLICY agenda_notification_deliveries_tenant_isolation ON public.agenda_notification_deliveries
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()));

CREATE POLICY agenda_user_preferences_tenant_isolation ON public.agenda_user_preferences
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()));

CREATE POLICY agenda_audit_logs_tenant_isolation ON public.agenda_audit_logs
  USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()))
  WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), public.get_auth_tenant_id()));

COMMIT;

-- NOTA DE DEPLOY (pg_cron recomendado em produção após autorização MASTER):
--   Agendar chamada a cada 5 minutos para POST https://fiorix.app/api/cron/agenda-reminders
--   com header Authorization: Bearer <CRON_SECRET> para processar lembretes em lote sem polling contínuo.
