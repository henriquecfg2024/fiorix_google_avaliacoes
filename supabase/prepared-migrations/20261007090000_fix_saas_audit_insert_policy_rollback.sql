-- ============================================================================
-- ⚠️  ROLLBACK PREPARADO — NÃO APLICAR  ⚠️
-- ============================================================================
-- FIORIX — Fase 6.0 | Rollback de 20261007090000_fix_saas_audit_insert_policy.sql
-- Status: PREPARADO LOCALMENTE. NÃO APLICADO EM NENHUM AMBIENTE.
-- Uso: somente se a correção for aplicada em staging e precisar ser revertida.
-- Restaura exatamente a policy histórica (permissiva) de 20261005160000.
-- Produção: proibido sem registro formal de mudança e autorização do MASTER.
-- ============================================================================

BEGIN;

DROP POLICY IF EXISTS rls_saas_audit_insert_master_only ON public.fiorix_saas_governance_audit;
DROP POLICY IF EXISTS rls_saas_audit_insert ON public.fiorix_saas_governance_audit;

CREATE POLICY rls_saas_audit_insert ON public.fiorix_saas_governance_audit
FOR INSERT TO authenticated
WITH CHECK (
  public.is_master_user() OR
  tenant_id = public.get_auth_tenant_id()
);

-- Observação: os REVOKEs da correção não são revertidos (não concediam
-- capacidade necessária a nenhum fluxo legado). O trigger de imutabilidade
-- permanece intocado.

COMMIT;
