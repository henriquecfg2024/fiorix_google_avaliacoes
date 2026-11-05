-- ============================================================================
-- FIORIX — Permissões de Navegação por Departamento (fiorix_nav_department_rules)
-- Hierarquia efetiva: Guarda Estrutural > Colaborador (User) > Departamento > Perfil (Role) > Legado
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.fiorix_nav_department_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    departamento TEXT NOT NULL,
    item_id TEXT NOT NULL,
    override TEXT NOT NULL CHECK (override IN ('ALLOW', 'DENY')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fiorix_nav_department_rules_item
ON public.fiorix_nav_department_rules (tenant_id, departamento, item_id);

CREATE INDEX IF NOT EXISTS idx_fiorix_nav_department_rules_lookup
ON public.fiorix_nav_department_rules (tenant_id, LOWER(TRIM(departamento)));

ALTER TABLE public.fiorix_nav_department_rules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.fiorix_nav_department_rules FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.fiorix_nav_department_rules TO postgres, service_role;

COMMIT;
