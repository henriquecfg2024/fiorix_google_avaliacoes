-- ============================================================================
-- FIORIX — Fase 6.1: Implantação e Disponibilidade Granular de Serviços
-- Arquivo: 20261007150000_fiorix_granular_service_deployments.sql
--
-- ⚠️ ARQUIVO DE MIGRAÇÃO APENAS PREPARADO (NÃO APLICADO).
-- NENHUMA EXECUÇÃO EM PRODUÇÃO OU STAGING SEM AUTORIZAÇÃO FORMAL DO MASTER.
--
-- Finalidade:
-- Implementar a camada física para a arquitetura de implantação granular:
-- 1. fiorix_tenant_services: Serviços contratados e vigência no nível de cliente (C1)
-- 2. fiorix_service_deployments: Liberações por departamento e exceções por usuário (C2)
-- 3. fiorix_service_suspensions: Suspensões expressas do MASTER (C4)
-- 4. fiorix_granular_audit: Trilha imutável e transacional de governança granular
-- ============================================================================

-- 1. Serviços Ativos / Contratados por Cliente (C1)
CREATE TABLE IF NOT EXISTS public.fiorix_tenant_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,                                -- ex: 'prazos.bi', 'prazos'
    source_template TEXT,                                 -- 'OMEGA', 'PRO', 'BASIC' ou NULL
    contract_ref TEXT,                                    -- Referência do contrato comercial
    status TEXT NOT NULL DEFAULT 'ACTIVE',                -- 'ACTIVE', 'INACTIVE', 'SUSPENDED'
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,                              -- NULL = vigência indeterminada
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT NOT NULL,
    CONSTRAINT uq_tenant_service UNIQUE (tenant_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_services_tenant_status 
ON public.fiorix_tenant_services(tenant_id, status);

-- 2. Regras de Implantação: Departamentos e Usuários (C2)
CREATE TABLE IF NOT EXISTS public.fiorix_service_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    scope_type TEXT NOT NULL,                             -- 'DEPARTMENT' ou 'USER'
    target_id TEXT NOT NULL,                              -- departamento_id (UUID) ou user_id
    effect TEXT NOT NULL,                                 -- 'ALLOW' ou 'DENY'
    action_ceiling TEXT[],                                -- Ações permitidas (NULL = todas suportadas)
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT NOT NULL,
    CONSTRAINT uq_service_deployment UNIQUE (tenant_id, node_id, scope_type, target_id),
    CONSTRAINT chk_scope_type CHECK (scope_type IN ('DEPARTMENT', 'USER')),
    CONSTRAINT chk_effect CHECK (effect IN ('ALLOW', 'DENY'))
);

CREATE INDEX IF NOT EXISTS idx_service_deployments_lookup 
ON public.fiorix_service_deployments(tenant_id, target_id, scope_type);

-- 3. Suspensões Expressas do MASTER (C4)
CREATE TABLE IF NOT EXISTS public.fiorix_service_suspensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    scope_level TEXT NOT NULL,                            -- 'GLOBAL', 'TENANT', 'DEPARTMENT', 'USER', 'ROLE'
    target_id TEXT,                                       -- ID específico conforme o escopo (NULL para TENANT)
    reason TEXT NOT NULL,
    suspended_by TEXT NOT NULL,
    suspended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reinstated_at TIMESTAMPTZ,
    CONSTRAINT chk_suspension_scope CHECK (scope_level IN ('GLOBAL', 'TENANT', 'DEPARTMENT', 'USER', 'ROLE'))
);

CREATE INDEX IF NOT EXISTS idx_service_suspensions_active 
ON public.fiorix_service_suspensions(tenant_id, node_id) 
WHERE reinstated_at IS NULL;

-- 4. Trilha de Auditoria Imutável Granular
CREATE TABLE IF NOT EXISTS public.fiorix_granular_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL,                               -- ID do lote transacional
    actor_user_id TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    operation TEXT NOT NULL,                              -- 'SET_DEPLOYMENT', 'REMOVE_DEPLOYMENT', 'SUSPEND', 'REINSTATE'
    node_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    previous_state JSONB,
    new_state JSONB,
    step_up_authenticated BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_granular_audit_tenant_batch 
ON public.fiorix_granular_audit(tenant_id, batch_id);

-- Imutabilidade estrita via trigger na tabela de auditoria
CREATE OR REPLACE FUNCTION public.fn_fiorix_block_granular_audit_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'A tabela fiorix_granular_audit é estritamente imutável (bloqueio de UPDATE/DELETE)';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fiorix_block_granular_audit_mutation ON public.fiorix_granular_audit;
CREATE TRIGGER trg_fiorix_block_granular_audit_mutation
    BEFORE UPDATE OR DELETE ON public.fiorix_granular_audit
    FOR EACH ROW EXECUTE FUNCTION public.fn_fiorix_block_granular_audit_mutation();

-- RLS: Habilitado em todas as tabelas novas
ALTER TABLE public.fiorix_tenant_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_service_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_service_suspensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_granular_audit ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS: Apenas leitura por authenticated do mesmo tenant; gravação somente via service_role/MASTER
CREATE POLICY rls_tenant_services_select ON public.fiorix_tenant_services
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT "tenantId" FROM public."User" WHERE id = auth.uid()::text));

CREATE POLICY rls_service_deployments_select ON public.fiorix_service_deployments
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT "tenantId" FROM public."User" WHERE id = auth.uid()::text));

CREATE POLICY rls_service_suspensions_select ON public.fiorix_service_suspensions
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT "tenantId" FROM public."User" WHERE id = auth.uid()::text));

CREATE POLICY rls_granular_audit_select ON public.fiorix_granular_audit
    FOR SELECT TO authenticated
    USING (tenant_id = (SELECT "tenantId" FROM public."User" WHERE id = auth.uid()::text));
