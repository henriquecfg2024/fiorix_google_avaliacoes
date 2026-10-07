-- ==============================================================================
-- FIORIX SaaS: Migração Aditiva e Segura de Planos e Políticas RBAC (Fase 2)
-- Arquivo: supabase/migrations/20261005160000_create_saas_plans_and_permissions.sql
-- 
-- Princípios de Segurança e Governança Garantidos:
-- 1. Exclusivamente aditiva e não-destrutiva.
-- 2. Não altera dados, tabelas ou registros existentes do 7º RI-SP.
-- 3. Funções SECURITY DEFINER com search_path fixo para resolução de MASTER e tenant.
-- 4. RLS Deny by Default sem qualquer dependência de variáveis controláveis pelo cliente.
-- 5. Imutabilidade absoluta da tabela fiorix_saas_governance_audit (bloqueio de UPDATE/DELETE via Trigger).
-- 6. Unicidade de políticas globais e por tenant com suporte a NULL via índices parciais.
-- 7. Unicidade de versão (plan_id, version) e vínculo obrigatório de planos customizados ao tenant.
-- ==============================================================================

-- 1. ENUM LABELS (GESTOR e CONSULTA) AO TIPO Role (Idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'Role' AND e.enumlabel = 'GESTOR'
  ) THEN
    ALTER TYPE public."Role" ADD VALUE 'GESTOR';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'Role' AND e.enumlabel = 'CONSULTA'
  ) THEN
    ALTER TYPE public."Role" ADD VALUE 'CONSULTA';
  END IF;
END $$;

-- 2. TABELA: fiorix_saas_plans (Planos Oficiais e Personalizados)
CREATE TABLE IF NOT EXISTS public.fiorix_saas_plans (
  id TEXT PRIMARY KEY,
  code VARCHAR(64) UNIQUE NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  tier VARCHAR(32) DEFAULT 'PRO' NOT NULL, -- BASIC, PRO, OMEGA, CUSTOM
  is_official BOOLEAN DEFAULT false NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  tenant_id TEXT REFERENCES public."Tenant"(id) ON DELETE RESTRICT,
  modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INT DEFAULT 1 NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT chk_saas_plans_tenant_binding CHECK (
    (is_official = true AND tenant_id IS NULL) OR 
    (is_official = false AND tenant_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_fiorix_saas_plans_code ON public.fiorix_saas_plans(code);
CREATE INDEX IF NOT EXISTS idx_fiorix_saas_plans_tenant_id ON public.fiorix_saas_plans(tenant_id);

-- 3. TABELA: fiorix_saas_plan_versions (Histórico auditável de versões)
CREATE TABLE IF NOT EXISTS public.fiorix_saas_plan_versions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES public.fiorix_saas_plans(id) ON DELETE CASCADE,
  version INT NOT NULL,
  modules JSONB NOT NULL,
  changed_by TEXT,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT uq_saas_plan_versions_plan_version UNIQUE (plan_id, version)
);

CREATE INDEX IF NOT EXISTS idx_fiorix_saas_plan_versions_plan_id ON public.fiorix_saas_plan_versions(plan_id);

-- 4. TABELA: fiorix_saas_role_policies (Matriz de Políticas RBAC/PBAC)
CREATE TABLE IF NOT EXISTS public.fiorix_saas_role_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES public."Tenant"(id) ON DELETE CASCADE,
  role VARCHAR(64) NOT NULL,
  module_id VARCHAR(120) NOT NULL,
  can_view BOOLEAN DEFAULT false NOT NULL,
  can_create BOOLEAN DEFAULT false NOT NULL,
  can_edit BOOLEAN DEFAULT false NOT NULL,
  can_approve BOOLEAN DEFAULT false NOT NULL,
  can_delete BOOLEAN DEFAULT false NOT NULL,
  can_export BOOLEAN DEFAULT false NOT NULL,
  can_admin BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Unicidade estrita: índices parciais impedem duplicidade quando tenant_id for NULL ou NOT NULL
CREATE UNIQUE INDEX IF NOT EXISTS uq_saas_role_policies_global 
ON public.fiorix_saas_role_policies (role, module_id) 
WHERE tenant_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_saas_role_policies_tenant 
ON public.fiorix_saas_role_policies (role, module_id, tenant_id) 
WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_fiorix_saas_role_policies_lookup ON public.fiorix_saas_role_policies(role, module_id, tenant_id);

-- 5. TABELA: fiorix_saas_governance_audit (Trilha de Auditoria Imutável)
CREATE TABLE IF NOT EXISTS public.fiorix_saas_governance_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  user_id TEXT,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id TEXT,
  previous_state JSONB,
  new_state JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fiorix_saas_governance_audit_created_at ON public.fiorix_saas_governance_audit(created_at);
CREATE INDEX IF NOT EXISTS idx_fiorix_saas_governance_audit_tenant_id ON public.fiorix_saas_governance_audit(tenant_id);

-- 6. IMUTABILIDADE DA AUDITORIA: Trigger que bloqueia UPDATE e DELETE
CREATE OR REPLACE FUNCTION public.fn_prevent_fiorix_saas_governance_audit_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Operação não permitida: A tabela fiorix_saas_governance_audit é estritamente imutável. Atualizações e exclusões são proibidas por governança e conformidade LGPD/SaaS.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_fiorix_saas_governance_audit ON public.fiorix_saas_governance_audit;

CREATE TRIGGER trg_protect_fiorix_saas_governance_audit
BEFORE UPDATE OR DELETE ON public.fiorix_saas_governance_audit
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_fiorix_saas_governance_audit_mutation();

-- 7. FUNÇÕES DE SEGURANÇA (SECURITY DEFINER COM SEARCH_PATH FIXO)
-- Estas funções resolvem papel e tenant a partir do JWT criptograficamente assinado
-- ou do vínculo real na tabela User por auth.uid(), eliminando qualquer manipulação client-side.

CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'role'),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_role'),
    (
      SELECT u.role::text 
      FROM public."User" u 
      WHERE u.id = auth.uid()::text 
         OR (auth.uid() IS NOT NULL AND u.email = nullif(current_setting('request.jwt.claim.email', true), ''))
      LIMIT 1
    ),
    'ANONYMOUS'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_master_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.get_auth_user_role() = 'MASTER';
$$;

CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.tenant_id', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb -> 'app_metadata' ->> 'tenant_id'),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'tenant_id'),
    (
      SELECT u."tenantId" 
      FROM public."User" u 
      WHERE u.id = auth.uid()::text 
         OR (auth.uid() IS NOT NULL AND u.email = nullif(current_setting('request.jwt.claim.email', true), ''))
      LIMIT 1
    )
  );
$$;

-- 8. SEGURANÇA: HABILITAR RLS COM POLÍTICAS DENY BY DEFAULT
ALTER TABLE public.fiorix_saas_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_saas_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_saas_role_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_saas_governance_audit ENABLE ROW LEVEL SECURITY;

-- Limpeza de políticas prévias se existirem
DROP POLICY IF EXISTS allow_service_plans ON public.fiorix_saas_plans;
DROP POLICY IF EXISTS allow_service_plan_versions ON public.fiorix_saas_plan_versions;
DROP POLICY IF EXISTS allow_service_role_policies ON public.fiorix_saas_role_policies;
DROP POLICY IF EXISTS allow_service_governance_audit ON public.fiorix_saas_governance_audit;
DROP POLICY IF EXISTS rls_saas_plans_select ON public.fiorix_saas_plans;
DROP POLICY IF EXISTS rls_saas_plans_write_master ON public.fiorix_saas_plans;
DROP POLICY IF EXISTS rls_saas_plans_service_role ON public.fiorix_saas_plans;
DROP POLICY IF EXISTS rls_saas_plan_versions_select ON public.fiorix_saas_plan_versions;
DROP POLICY IF EXISTS rls_saas_plan_versions_write_master ON public.fiorix_saas_plan_versions;
DROP POLICY IF EXISTS rls_saas_plan_versions_service_role ON public.fiorix_saas_plan_versions;
DROP POLICY IF EXISTS rls_saas_role_policies_select ON public.fiorix_saas_role_policies;
DROP POLICY IF EXISTS rls_saas_role_policies_write_master ON public.fiorix_saas_role_policies;
DROP POLICY IF EXISTS rls_saas_role_policies_service_role ON public.fiorix_saas_role_policies;
DROP POLICY IF EXISTS rls_saas_audit_select ON public.fiorix_saas_governance_audit;
DROP POLICY IF EXISTS rls_saas_audit_insert ON public.fiorix_saas_governance_audit;
DROP POLICY IF EXISTS rls_saas_audit_service_role ON public.fiorix_saas_governance_audit;

-- ── fiorix_saas_plans ──
-- Leitura: Planos oficiais são públicos para usuários autenticados; planos customizados apenas para o próprio tenant ou MASTER
CREATE POLICY rls_saas_plans_select ON public.fiorix_saas_plans
FOR SELECT TO authenticated
USING (
  is_official = true OR
  tenant_id = public.get_auth_tenant_id() OR
  public.is_master_user()
);

-- Escrita/Exclusão: EXCLUSIVA de MASTER (Bloqueio total a tenants comuns)
CREATE POLICY rls_saas_plans_write_master ON public.fiorix_saas_plans
FOR ALL TO authenticated
USING (public.is_master_user())
WITH CHECK (public.is_master_user());

-- Service Role backend
CREATE POLICY rls_saas_plans_service_role ON public.fiorix_saas_plans
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ── fiorix_saas_plan_versions ──
CREATE POLICY rls_saas_plan_versions_select ON public.fiorix_saas_plan_versions
FOR SELECT TO authenticated
USING (
  public.is_master_user() OR
  EXISTS (
    SELECT 1 FROM public.fiorix_saas_plans p
    WHERE p.id = plan_id AND (
      p.is_official = true OR
      p.tenant_id = public.get_auth_tenant_id()
    )
  )
);

CREATE POLICY rls_saas_plan_versions_write_master ON public.fiorix_saas_plan_versions
FOR ALL TO authenticated
USING (public.is_master_user())
WITH CHECK (public.is_master_user());

CREATE POLICY rls_saas_plan_versions_service_role ON public.fiorix_saas_plan_versions
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ── fiorix_saas_role_policies ──
-- Leitura: Políticas canônicas globais (tenant_id IS NULL) ou políticas do próprio tenant
CREATE POLICY rls_saas_role_policies_select ON public.fiorix_saas_role_policies
FOR SELECT TO authenticated
USING (
  tenant_id IS NULL OR
  tenant_id = public.get_auth_tenant_id() OR
  public.is_master_user()
);

-- Escrita/Administração: EXCLUSIVA de MASTER
CREATE POLICY rls_saas_role_policies_write_master ON public.fiorix_saas_role_policies
FOR ALL TO authenticated
USING (public.is_master_user())
WITH CHECK (public.is_master_user());

CREATE POLICY rls_saas_role_policies_service_role ON public.fiorix_saas_role_policies
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- ── fiorix_saas_governance_audit ──
-- Leitura: Exclusiva de MASTER ou do próprio tenant auditado
CREATE POLICY rls_saas_audit_select ON public.fiorix_saas_governance_audit
FOR SELECT TO authenticated
USING (
  public.is_master_user() OR
  tenant_id = public.get_auth_tenant_id()
);

-- Inserção: Permitida para registrar auditoria com validação de vínculo
CREATE POLICY rls_saas_audit_insert ON public.fiorix_saas_governance_audit
FOR INSERT TO authenticated
WITH CHECK (
  public.is_master_user() OR
  tenant_id = public.get_auth_tenant_id()
);

CREATE POLICY rls_saas_audit_service_role ON public.fiorix_saas_governance_audit
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 9. SEED CANÔNICO DOS 3 PLANOS OFICIAIS (Decisão Comercial Aprovada: 10 / 21 / 23)
INSERT INTO public.fiorix_saas_plans (id, code, name, description, tier, is_official, is_active, tenant_id, modules, version)
VALUES 
(
  'plan_basic_official',
  'BASIC',
  'FIORIX Basic',
  'Essencial (10 módulos): Foco em Avaliações Google, Reputação, Metas, Tarefas, Retornos e Instruções de Trabalho.',
  'BASIC',
  true,
  true,
  NULL,
  '["core.dashboard", "google.avaliacoes", "google.estatisticas", "google.relatorios", "prazos.tarefas", "prazos.metas", "prazos.retornos", "its.gestao", "its.minha_it", "rotina.comunicados"]'::jsonb,
  1
),
(
  'plan_pro_official',
  'PRO',
  'FIORIX Pro',
  'Gestão Integrada (21 módulos): Inclui Espera NextQS, Recepção, Prazos BI, Impressões, Rastreio, Gestão de Pessoas (RH, Férias, Holerites), Mensagens e Central de Operações.',
  'PRO',
  true,
  true,
  NULL,
  '["core.dashboard", "google.avaliacoes", "google.estatisticas", "google.relatorios", "prazos.tarefas", "prazos.metas", "prazos.retornos", "its.gestao", "its.minha_it", "rotina.comunicados", "prazos.espera", "prazos.recepcao", "prazos.bi", "prazos.impressoes", "prazos.rastreio", "pessoas.gestao", "pessoas.ferias", "pessoas.holerites", "rotina.mensagens", "rotina.comunicados_rh", "sistema.operacoes"]'::jsonb,
  1
),
(
  'plan_omega_official',
  'OMEGA',
  'FIORIX Omega',
  'Enterprise Completo (23 módulos): Todos os 21 módulos do PRO mais Carga de Contingência e Configurações Avançadas de Sistema.',
  'OMEGA',
  true,
  true,
  NULL,
  '["core.dashboard", "google.avaliacoes", "google.estatisticas", "google.relatorios", "prazos.tarefas", "prazos.metas", "prazos.retornos", "its.gestao", "its.minha_it", "rotina.comunicados", "prazos.espera", "prazos.recepcao", "prazos.bi", "prazos.impressoes", "prazos.rastreio", "pessoas.gestao", "pessoas.ferias", "pessoas.holerites", "rotina.mensagens", "rotina.comunicados_rh", "sistema.operacoes", "sistema.contingencia", "sistema.configuracoes"]'::jsonb,
  1
)
ON CONFLICT (code) DO NOTHING;
