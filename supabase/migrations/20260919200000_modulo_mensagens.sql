-- FIORIX: Migração do Módulo Mensagens Corporativas V1
-- Tabelas, Índices de Performance e Políticas de Row Level Security (RLS)

DO $$ BEGIN
  -- 0. ENUMS DO MÓDULO MENSAGENS
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversaTipo') THEN
    CREATE TYPE public."ConversaTipo" AS ENUM ('DIRECT', 'GROUP');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MembroPapel') THEN
    CREATE TYPE public."MembroPapel" AS ENUM ('ADMIN', 'MEMBER');
  END IF;

  -- 1. CONVERSAS
  CREATE TABLE IF NOT EXISTS public.fiorix_conversas (
    id TEXT PRIMARY KEY DEFAULT ('c_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    tipo public."ConversaTipo" NOT NULL DEFAULT 'DIRECT'::public."ConversaTipo",
    titulo TEXT,
    descricao TEXT,
    avatar_url TEXT,
    criado_por TEXT REFERENCES public."User"(id) ON DELETE SET NULL,
    last_message_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
  );

  CREATE INDEX IF NOT EXISTS idx_fiorix_conversas_tenant ON public.fiorix_conversas (tenant_id);
  CREATE INDEX IF NOT EXISTS idx_fiorix_conversas_last_msg ON public.fiorix_conversas (tenant_id, last_message_at DESC);

  -- 2. MEMBROS DA CONVERSA
  CREATE TABLE IF NOT EXISTS public.fiorix_conversa_membros (
    id TEXT PRIMARY KEY DEFAULT ('cm_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    conversa_id TEXT NOT NULL REFERENCES public.fiorix_conversas(id) ON DELETE CASCADE,
    usuario_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
    papel public."MembroPapel" NOT NULL DEFAULT 'MEMBER'::public."MembroPapel",
    joined_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    muted BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_conversa_usuario UNIQUE (conversa_id, usuario_id)
  );

  CREATE INDEX IF NOT EXISTS idx_fiorix_conversa_membros_tenant ON public.fiorix_conversa_membros (tenant_id);
  CREATE INDEX IF NOT EXISTS idx_fiorix_conversa_membros_usuario ON public.fiorix_conversa_membros (usuario_id);
  CREATE INDEX IF NOT EXISTS idx_fiorix_conversa_membros_conv ON public.fiorix_conversa_membros (conversa_id);

  -- 3. MENSAGENS
  CREATE TABLE IF NOT EXISTS public.fiorix_mensagens (
    id TEXT PRIMARY KEY DEFAULT ('m_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    conversa_id TEXT NOT NULL REFERENCES public.fiorix_conversas(id) ON DELETE CASCADE,
    remetente_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
    conteudo TEXT NOT NULL,
    resposta_a_id TEXT REFERENCES public.fiorix_mensagens(id) ON DELETE SET NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
  );

  CREATE INDEX IF NOT EXISTS idx_fiorix_mensagens_tenant ON public.fiorix_mensagens (tenant_id);
  CREATE INDEX IF NOT EXISTS idx_fiorix_mensagens_conv_created ON public.fiorix_mensagens (conversa_id, created_at ASC);
  CREATE INDEX IF NOT EXISTS idx_fiorix_mensagens_remetente ON public.fiorix_mensagens (remetente_id);

  -- 4. ANEXOS DE MENSAGENS
  CREATE TABLE IF NOT EXISTS public.fiorix_mensagem_anexos (
    id TEXT PRIMARY KEY DEFAULT ('ma_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    mensagem_id TEXT NOT NULL REFERENCES public.fiorix_mensagens(id) ON DELETE CASCADE,
    nome_arquivo TEXT NOT NULL,
    tamanho_bytes INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
  );

  CREATE INDEX IF NOT EXISTS idx_fiorix_mensagem_anexos_tenant ON public.fiorix_mensagem_anexos (tenant_id);
  CREATE INDEX IF NOT EXISTS idx_fiorix_mensagem_anexos_msg ON public.fiorix_mensagem_anexos (mensagem_id);

  -- 5. REAÇÕES DE MENSAGENS
  CREATE TABLE IF NOT EXISTS public.fiorix_mensagem_reacoes (
    id TEXT PRIMARY KEY DEFAULT ('mr_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    mensagem_id TEXT NOT NULL REFERENCES public.fiorix_mensagens(id) ON DELETE CASCADE,
    usuario_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_mensagem_usuario_emoji UNIQUE (mensagem_id, usuario_id, emoji)
  );

  CREATE INDEX IF NOT EXISTS idx_fiorix_mensagem_reacoes_tenant ON public.fiorix_mensagem_reacoes (tenant_id);
  CREATE INDEX IF NOT EXISTS idx_fiorix_mensagem_reacoes_msg ON public.fiorix_mensagem_reacoes (mensagem_id);

  -- 6. PUSH SUBSCRIPTIONS
  CREATE TABLE IF NOT EXISTS public.fiorix_push_subscriptions (
    id TEXT PRIMARY KEY DEFAULT ('ps_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    usuario_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device_name TEXT,
    user_agent TEXT,
    ip_address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    revoked_at TIMESTAMPTZ
  );

  CREATE INDEX IF NOT EXISTS idx_fiorix_push_subscriptions_tenant ON public.fiorix_push_subscriptions (tenant_id);
  CREATE INDEX IF NOT EXISTS idx_fiorix_push_subscriptions_usuario ON public.fiorix_push_subscriptions (usuario_id);

  -- 7. PREFERÊNCIAS DE NOTIFICAÇÃO
  CREATE TABLE IF NOT EXISTS public.fiorix_messaging_notification_settings (
    id TEXT PRIMARY KEY DEFAULT ('mns_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    usuario_id TEXT NOT NULL UNIQUE REFERENCES public."User"(id) ON DELETE CASCADE,
    direct_messages BOOLEAN NOT NULL DEFAULT TRUE,
    group_messages BOOLEAN NOT NULL DEFAULT TRUE,
    sound BOOLEAN NOT NULL DEFAULT TRUE,
    preview_content BOOLEAN NOT NULL DEFAULT FALSE,
    browser_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
  );

  CREATE INDEX IF NOT EXISTS idx_fiorix_msg_settings_tenant ON public.fiorix_messaging_notification_settings (tenant_id);

  -- 8. POLÍTICAS DO TENANT
  CREATE TABLE IF NOT EXISTS public.fiorix_messaging_policies (
    id TEXT PRIMARY KEY DEFAULT ('mp_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    tenant_id TEXT NOT NULL UNIQUE REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    direct_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    groups_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    attachments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    max_attachment_bytes INTEGER NOT NULL DEFAULT 26214400,
    allowed_mimes TEXT[] NOT NULL DEFAULT ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    retention_days INTEGER NOT NULL DEFAULT 365,
    allow_delete BOOLEAN NOT NULL DEFAULT TRUE,
    allow_edit BOOLEAN NOT NULL DEFAULT TRUE,
    edit_window_minutes INTEGER NOT NULL DEFAULT 15,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
  );

  -- 9. AUDITORIA FORENSE DE MENSAGENS (INSERT-ONLY)
  CREATE TABLE IF NOT EXISTS public.fiorix_messaging_audit_logs (
    id TEXT PRIMARY KEY DEFAULT ('mal_' || substr(md5(random()::text || clock_timestamp()::text), 1, 24)),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    actor_user_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    metadata JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
  );

  CREATE INDEX IF NOT EXISTS idx_fiorix_msg_audit_tenant ON public.fiorix_messaging_audit_logs (tenant_id);
  CREATE INDEX IF NOT EXISTS idx_fiorix_msg_audit_actor ON public.fiorix_messaging_audit_logs (actor_user_id);
  CREATE INDEX IF NOT EXISTS idx_fiorix_msg_audit_action ON public.fiorix_messaging_audit_logs (action);
  CREATE INDEX IF NOT EXISTS idx_fiorix_msg_audit_created ON public.fiorix_messaging_audit_logs (created_at DESC);

  -- HABILITAÇÃO DE ROW LEVEL SECURITY (RLS)
  ALTER TABLE public.fiorix_conversas ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.fiorix_conversa_membros ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.fiorix_mensagens ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.fiorix_mensagem_anexos ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.fiorix_mensagem_reacoes ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.fiorix_push_subscriptions ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.fiorix_messaging_notification_settings ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.fiorix_messaging_policies ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.fiorix_messaging_audit_logs ENABLE ROW LEVEL SECURITY;

  -- POLÍTICAS DE RLS (DEFESA EM PROFUNDIDADE MULTI-TENANT)
  DROP POLICY IF EXISTS "tenant_isolation_conversas" ON public.fiorix_conversas;
  CREATE POLICY "tenant_isolation_conversas" ON public.fiorix_conversas
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

  DROP POLICY IF EXISTS "tenant_isolation_conversa_membros" ON public.fiorix_conversa_membros;
  CREATE POLICY "tenant_isolation_conversa_membros" ON public.fiorix_conversa_membros
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

  DROP POLICY IF EXISTS "tenant_isolation_mensagens" ON public.fiorix_mensagens;
  CREATE POLICY "tenant_isolation_mensagens" ON public.fiorix_mensagens
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

  DROP POLICY IF EXISTS "tenant_isolation_mensagem_anexos" ON public.fiorix_mensagem_anexos;
  CREATE POLICY "tenant_isolation_mensagem_anexos" ON public.fiorix_mensagem_anexos
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

  DROP POLICY IF EXISTS "tenant_isolation_mensagem_reacoes" ON public.fiorix_mensagem_reacoes;
  CREATE POLICY "tenant_isolation_mensagem_reacoes" ON public.fiorix_mensagem_reacoes
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

  DROP POLICY IF EXISTS "tenant_isolation_push_subscriptions" ON public.fiorix_push_subscriptions;
  CREATE POLICY "tenant_isolation_push_subscriptions" ON public.fiorix_push_subscriptions
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

  DROP POLICY IF EXISTS "tenant_isolation_messaging_settings" ON public.fiorix_messaging_notification_settings;
  CREATE POLICY "tenant_isolation_messaging_settings" ON public.fiorix_messaging_notification_settings
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

  DROP POLICY IF EXISTS "tenant_isolation_messaging_policies" ON public.fiorix_messaging_policies;
  CREATE POLICY "tenant_isolation_messaging_policies" ON public.fiorix_messaging_policies
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

  DROP POLICY IF EXISTS "tenant_isolation_messaging_audit_logs" ON public.fiorix_messaging_audit_logs;
  CREATE POLICY "tenant_isolation_messaging_audit_logs" ON public.fiorix_messaging_audit_logs
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

END $$;
