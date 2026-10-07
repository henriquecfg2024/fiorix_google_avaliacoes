-- ============================================================================
-- ⚠️  MIGRATION ADITIVA PREPARADA — NÃO APLICAR AUTOMATICAMENTE  ⚠️
-- ============================================================================
-- FIORIX — V2 | Permissões de Navegação por Perfil (Role) e Colaborador (User)
-- Arquivo : 20261007180000_fiorix_nav_permissions_v2.sql
-- Status  : PREPARADA LOCALMENTE. NÃO APLICADA EM PRODUÇÃO OU STAGING.
-- Local   : supabase/prepared-migrations/
-- Contexto: Multi-tenant (7º RI-SP e demais cartórios SaaS da plataforma).
--
-- PROIBIÇÃO ABSOLUTA:
-- Aplicação em PRODUÇÃO ou STAGING somente com registro formal de mudança e
-- autorização humana prévia e expressa do MASTER.
--
-- NOTA ARQUITETURAL SOBRE IDENTIDADE E RLS:
-- 1. O FIORIX utiliza NextAuth com credenciais e chaves na tabela public."User".
-- 2. O backend (Next.js / Prisma) conecta diretamente via pool PostgreSQL como role de serviço.
-- 3. A autorização administrativa é estritamente validada no servidor (requireRole('MASTER')).
-- 4. RLS é habilitado nas tabelas como defesa em profundidade, revogando privilégios de
--    PUBLIC, anon e authenticated para isolar o acesso direto via PostgREST externo.
-- 5. Trigger de integridade impede que uma regra de usuário seja salva para tenant distinto
--    do tenant cadastrado na conta em public."User".
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. TABELA: fiorix_nav_role_rules (Regras por Perfil / Role do Sistema)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiorix_nav_role_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'SUBSTITUTO', 'RH', 'USER', 'COLABORADOR')),
    item_id TEXT NOT NULL,
    visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT NOT NULL
);

-- Índice único por tenant + role + item_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiorix_nav_role_rules_item
ON public.fiorix_nav_role_rules (tenant_id, role, item_id);

CREATE INDEX IF NOT EXISTS idx_fiorix_nav_role_rules_lookup
ON public.fiorix_nav_role_rules (tenant_id, role);

-- ----------------------------------------------------------------------------
-- 2. TABELA: fiorix_nav_user_rules (Exceções Individuais por Colaborador)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiorix_nav_user_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    override TEXT NOT NULL CHECK (override IN ('ALLOW', 'DENY')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT NOT NULL
);

-- Índice único por tenant + user_id + item_id
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiorix_nav_user_rules_item
ON public.fiorix_nav_user_rules (tenant_id, user_id, item_id);

CREATE INDEX IF NOT EXISTS idx_fiorix_nav_user_rules_lookup
ON public.fiorix_nav_user_rules (tenant_id, user_id);

-- ----------------------------------------------------------------------------
-- 3. INTEGRIDADE DE TENANT VIA TRIGGER (Sem alterar tabelas existentes)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_check_nav_user_rule_tenant()
RETURNS TRIGGER AS $$
DECLARE
    v_user_tenant TEXT;
BEGIN
    SELECT "tenantId" INTO v_user_tenant
    FROM public."User"
    WHERE id = NEW.user_id;

    IF v_user_tenant IS NULL THEN
        RAISE EXCEPTION 'Usuário % não encontrado para validação de tenant.', NEW.user_id;
    END IF;

    IF v_user_tenant <> NEW.tenant_id THEN
        RAISE EXCEPTION 'Descompasso de tenant: Usuário pertence ao tenant %, mas a regra é para %.',
            v_user_tenant, NEW.tenant_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_nav_user_rule_tenant ON public.fiorix_nav_user_rules;
CREATE TRIGGER trg_check_nav_user_rule_tenant
    BEFORE INSERT OR UPDATE ON public.fiorix_nav_user_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_check_nav_user_rule_tenant();

-- ----------------------------------------------------------------------------
-- 4. SEGURANÇA EM PROFUNDIDADE: ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.fiorix_nav_role_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_nav_user_rules ENABLE ROW LEVEL SECURITY;

-- Revoga privilégios de PostgREST para clientes externos
REVOKE ALL ON public.fiorix_nav_role_rules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.fiorix_nav_user_rules FROM PUBLIC, anon, authenticated;

-- Concede privilégios para a role do serviço de backend (postgres / service_role)
GRANT ALL ON public.fiorix_nav_role_rules TO postgres, service_role;
GRANT ALL ON public.fiorix_nav_user_rules TO postgres, service_role;

COMMIT;
