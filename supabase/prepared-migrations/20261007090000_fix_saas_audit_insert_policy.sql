-- ============================================================================
-- ⚠️  MIGRATION CORRETIVA PREPARADA — NÃO APLICAR  ⚠️
-- ============================================================================
-- FIORIX — Fase 6.0 | Saneamento de Pré-Requisitos de Segurança
-- Arquivo : 20261007090000_fix_saas_audit_insert_policy.sql
-- Status  : PREPARADA LOCALMENTE. NÃO APLICADA EM NENHUM AMBIENTE.
-- Local   : supabase/prepared-migrations/ (fora de supabase/migrations/ para
--           que o Supabase CLI nunca a aplique automaticamente).
--
-- PROIBIÇÃO: aplicação em PRODUÇÃO somente com registro formal de mudança e
-- autorização humana específica do MASTER. Antes disso, homologação
-- obrigatória em staging com evidências.
--
-- FRAGILIDADE CORRIGIDA
--   A policy histórica `rls_saas_audit_insert` (migration 20261005160000)
--   permite INSERT a qualquer usuário `authenticated` cujo tenant coincida:
--       WITH CHECK (is_master_user() OR tenant_id = get_auth_tenant_id())
--   Um usuário comum do tenant poderia forjar registros na trilha de
--   auditoria de governança via PostgREST/Supabase client.
--
-- CORREÇÃO
--   - Remove a policy permissiva de INSERT.
--   - Cria policy de INSERT exclusiva do MASTER, vinculada ao próprio
--     auth.uid() (o MASTER não pode registrar evento em nome de terceiro).
--   - Mantém: SELECT existente, policy de service_role e trigger de
--     imutabilidade (UPDATE/DELETE continuam proibidos).
--
-- COMO O BACKEND CONTINUA AUDITANDO
--   O backend grava auditoria via Prisma com a role proprietária da conexão
--   (DATABASE_URL), que não é afetada por policies RLS desta tabela, ou via
--   service_role (policy `rls_saas_audit_service_role`). Nenhum dos dois
--   caminhos depende da policy removida. A escrita direta pelo cliente
--   (anon/authenticated não-MASTER) deixa de ser possível.
--
-- NÃO ALTERA a migration histórica 20261005160000 (já aplicada).
-- Idempotente. Rollback: 20261007090000_fix_saas_audit_insert_policy_rollback.sql
-- ============================================================================

BEGIN;

-- 1. Remove apenas a policy de INSERT permissiva
DROP POLICY IF EXISTS rls_saas_audit_insert ON public.fiorix_saas_governance_audit;
DROP POLICY IF EXISTS rls_saas_audit_insert_master_only ON public.fiorix_saas_governance_audit;

-- 2. INSERT direto por usuário autenticado: somente MASTER, em nome próprio
CREATE POLICY rls_saas_audit_insert_master_only ON public.fiorix_saas_governance_audit
FOR INSERT TO authenticated
WITH CHECK (
  public.is_master_user()
  AND user_id IS NOT NULL
  AND user_id = (auth.uid())::text
);

-- 3. Garantias explícitas: anon não possui privilégio de escrita na auditoria
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.fiorix_saas_governance_audit FROM anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.fiorix_saas_governance_audit FROM authenticated;

-- 4. Imutabilidade preservada (trigger histórico permanece; recriado apenas se ausente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_protect_fiorix_saas_governance_audit'
      AND tgrelid = 'public.fiorix_saas_governance_audit'::regclass
  ) THEN
    CREATE TRIGGER trg_protect_fiorix_saas_governance_audit
    BEFORE UPDATE OR DELETE ON public.fiorix_saas_governance_audit
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_fiorix_saas_governance_audit_mutation();
  END IF;
END
$$;

COMMIT;

-- VERIFICAÇÃO PÓS-APLICAÇÃO (somente em staging, somente leitura):
--   SELECT policyname, cmd, roles FROM pg_policies
--   WHERE tablename = 'fiorix_saas_governance_audit' ORDER BY policyname;
--   Esperado: rls_saas_audit_insert ausente; rls_saas_audit_insert_master_only presente.
