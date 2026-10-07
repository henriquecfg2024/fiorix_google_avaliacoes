-- ============================================================================
-- ⚠️  MIGRATION ADITIVA PREPARADA — NÃO APLICAR  ⚠️
-- ============================================================================
-- FIORIX — Fase V1.2 | Permissões de Navegação por Departamento e Colaborador
-- Arquivo : 20261007120000_fiorix_nav_permissions_v1.sql
-- Status  : PREPARADA LOCALMENTE. NÃO APLICADA EM NENHUM AMBIENTE.
-- Local   : supabase/prepared-migrations/ (fora de supabase/migrations/).
-- Contexto: 7º Oficial de Registro de Imóveis de São Paulo (7º RI-SP).
--
-- PROIBIÇÃO ABSOLUTA:
-- Aplicação em PRODUÇÃO ou STAGING somente com registro formal de mudança e
-- autorização humana prévia e expressa do MASTER.
--
-- NOTA ARQUITETURAL SOBRE IDENTIDADE E RLS (ABORDAGEM A):
-- 1. O FIORIX utiliza NextAuth com credenciais e chaves CUID na tabela public."User".
-- 2. O backend (Next.js / Prisma) acessa o PostgreSQL diretamente via pool de
--    conexão, sem transitar pela gateway PostgREST e sem fornecer auth.uid().
-- 3. RLS baseado em auth.uid() NÃO fornece autorização para o fluxo atual do
--    NextAuth/Prisma.
-- 4. O controle de acesso granular deve ser rigorosamente aplicado na camada de
--    aplicação/servidor (Server Actions com requireRole('MASTER')).
-- 5. RLS é ativado nas tabelas como segurança em profundidade, revogando privilégios
--    de PUBLIC, anon e authenticated para garantir que nenhuma API PostgREST externa
--    do Supabase acesse essas tabelas.
-- 6. Integridade de tenant: Triggers impedem descompasso de tenant entre a regra
--    e os registros vinculados (departamento / usuário) sem alterar tabelas preexistentes.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. TABELA: fiorix_nav_group_rules (Regras por Departamento)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiorix_nav_group_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    departamento_id UUID NOT NULL REFERENCES public.fiorix_departamentos(id) ON DELETE RESTRICT,
    departamento_nome TEXT NOT NULL,
    menu_key TEXT NOT NULL,
    item_href TEXT,
    visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT NOT NULL
);

-- Índice único por expressão (COALESCE para tratar NULL como raiz do grupo)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiorix_nav_group_rules_item
ON public.fiorix_nav_group_rules (tenant_id, departamento_id, menu_key, (COALESCE(item_href, '')));

CREATE INDEX IF NOT EXISTS idx_fiorix_nav_group_rules_lookup
ON public.fiorix_nav_group_rules (tenant_id, departamento_id);

-- ----------------------------------------------------------------------------
-- 2. TABELA: fiorix_nav_user_rules (Exceções por Colaborador)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiorix_nav_user_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES public."User"(id) ON DELETE RESTRICT,
    menu_key TEXT NOT NULL,
    item_href TEXT,
    visible BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT NOT NULL
);

-- Índice único por expressão (COALESCE para tratar NULL como raiz do grupo)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiorix_nav_user_rules_item
ON public.fiorix_nav_user_rules (tenant_id, user_id, menu_key, (COALESCE(item_href, '')));

CREATE INDEX IF NOT EXISTS idx_fiorix_nav_user_rules_lookup
ON public.fiorix_nav_user_rules (tenant_id, user_id);

-- ----------------------------------------------------------------------------
-- 3. TABELA: fiorix_nav_audit (Trilha de Auditoria Imutável do MASTER)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fiorix_nav_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    actor_email TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('DEPARTAMENTO', 'USUARIO')),
    target_id TEXT NOT NULL,
    target_name TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('SET_RULE', 'REMOVE_RULE', 'RESET_ALL')),
    rule_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fiorix_nav_audit_tenant_time
ON public.fiorix_nav_audit (tenant_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. INTEGRIDADE DE TENANT (Sem alterar tabelas existentes)
-- ----------------------------------------------------------------------------

-- Validação de tenant para departamento
CREATE OR REPLACE FUNCTION public.fn_check_nav_group_rule_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_dept_tenant TEXT;
BEGIN
  SELECT tenant_id INTO v_dept_tenant
  FROM public.fiorix_departamentos
  WHERE id = NEW.departamento_id;

  IF v_dept_tenant IS NULL THEN
    RAISE EXCEPTION 'Departamento inválido ou inexistente: %', NEW.departamento_id;
  END IF;

  IF v_dept_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch: departamento % (tenant %) não pertence ao tenant da regra (%)',
      NEW.departamento_id, v_dept_tenant, NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_nav_group_rule_tenant ON public.fiorix_nav_group_rules;
CREATE TRIGGER trg_check_nav_group_rule_tenant
BEFORE INSERT OR UPDATE ON public.fiorix_nav_group_rules
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_nav_group_rule_tenant();

-- Validação de tenant para usuário
CREATE OR REPLACE FUNCTION public.fn_check_nav_user_rule_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user_tenant TEXT;
BEGIN
  SELECT "tenantId" INTO v_user_tenant
  FROM public."User"
  WHERE id = NEW.user_id;

  IF v_user_tenant IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido ou inexistente: %', NEW.user_id;
  END IF;

  IF v_user_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Tenant mismatch: usuário % (tenant %) não pertence ao tenant da regra (%)',
      NEW.user_id, v_user_tenant, NEW.tenant_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_nav_user_rule_tenant ON public.fiorix_nav_user_rules;
CREATE TRIGGER trg_check_nav_user_rule_tenant
BEFORE INSERT OR UPDATE ON public.fiorix_nav_user_rules
FOR EACH ROW
EXECUTE FUNCTION public.fn_check_nav_user_rule_tenant();

-- ----------------------------------------------------------------------------
-- 5. TRIGGER DE IMUTABILIDADE DA AUDITORIA (Bloqueio de UPDATE, DELETE e TRUNCATE)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_prevent_fiorix_nav_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'A tabela fiorix_nav_audit é estritamente imutável (append-only). Proibido UPDATE, DELETE ou TRUNCATE.';
END;
$$;

DROP TRIGGER IF EXISTS trg_fiorix_nav_audit_immutable ON public.fiorix_nav_audit;
CREATE TRIGGER trg_fiorix_nav_audit_immutable
BEFORE UPDATE OR DELETE ON public.fiorix_nav_audit
FOR EACH ROW
EXECUTE FUNCTION public.fn_prevent_fiorix_nav_audit_mutation();

DROP TRIGGER IF EXISTS trg_fiorix_nav_audit_truncate ON public.fiorix_nav_audit;
CREATE TRIGGER trg_fiorix_nav_audit_truncate
BEFORE TRUNCATE ON public.fiorix_nav_audit
FOR EACH STATEMENT
EXECUTE FUNCTION public.fn_prevent_fiorix_nav_audit_mutation();

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) & REVOGAÇÃO DE PRIVILÉGIOS PÚBLICOS
-- ----------------------------------------------------------------------------

ALTER TABLE public.fiorix_nav_group_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_nav_user_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_nav_audit ENABLE ROW LEVEL SECURITY;

-- Revogação explícita de privilégios para roles externas do PostgREST
REVOKE ALL ON TABLE public.fiorix_nav_group_rules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fiorix_nav_user_rules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fiorix_nav_audit FROM PUBLIC, anon, authenticated;

-- Policies estritas idempotentes via bloco DO consultando pg_policies
DO $$
BEGIN
  -- fiorix_nav_group_rules: Bloqueio estrito para acessos PostgREST
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fiorix_nav_group_rules'
      AND policyname = 'rls_fiorix_nav_group_rules_deny_external'
  ) THEN
    CREATE POLICY rls_fiorix_nav_group_rules_deny_external
    ON public.fiorix_nav_group_rules
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);
  END IF;

  -- fiorix_nav_user_rules: Bloqueio estrito para acessos PostgREST
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fiorix_nav_user_rules'
      AND policyname = 'rls_fiorix_nav_user_rules_deny_external'
  ) THEN
    CREATE POLICY rls_fiorix_nav_user_rules_deny_external
    ON public.fiorix_nav_user_rules
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);
  END IF;

  -- fiorix_nav_audit: Bloqueio estrito para acessos PostgREST
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fiorix_nav_audit'
      AND policyname = 'rls_fiorix_nav_audit_deny_external'
  ) THEN
    CREATE POLICY rls_fiorix_nav_audit_deny_external
    ON public.fiorix_nav_audit
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. METADADOS DA ESTRUTURA (INSTALAÇÃO; ATIVAÇÃO FUNCIONAL DEPENDE DO BACKEND)
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.fiorix_nav_group_rules IS 'ESTRUTURA V1.2 INSTALADA — ATIVAÇÃO FUNCIONAL DEPENDE DO BACKEND';
COMMENT ON TABLE public.fiorix_nav_user_rules IS 'ESTRUTURA V1.2 INSTALADA — ATIVAÇÃO FUNCIONAL DEPENDE DO BACKEND';
COMMENT ON TABLE public.fiorix_nav_audit IS 'ESTRUTURA V1.2 INSTALADA — ATIVAÇÃO FUNCIONAL DEPENDE DO BACKEND';

COMMIT;
