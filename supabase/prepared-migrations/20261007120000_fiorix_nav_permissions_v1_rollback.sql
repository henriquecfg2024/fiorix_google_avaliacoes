-- ============================================================================
-- ⚠️  SCRIPT DE ROLLBACK NÃO-DESTRUTIVO — NÃO APLICAR  ⚠️
-- ============================================================================
-- FIORIX — Fase V1.2 | Rollback Seguro das Permissões de Navegação
-- Arquivo : 20261007120000_fiorix_nav_permissions_v1_rollback.sql
-- Status  : PREPARADO LOCALMENTE. NÃO APLICADO EM NENHUM AMBIENTE.
-- Local   : supabase/prepared-migrations/ (fora de supabase/migrations/).
-- Contexto: 7º Oficial de Registro de Imóveis de São Paulo (7º RI-SP).
--
-- PROIBIÇÃO ABSOLUTA:
-- Aplicação em PRODUÇÃO ou STAGING somente com registro formal de mudança e
-- autorização humana prévia e expressa do MASTER.
--
-- REGRAS E DIRETRIZES DE SEGURANÇA DO ROLLBACK:
-- 1. PROIBIDO o uso de DROP TABLE, CASCADE, DELETE FROM ou TRUNCATE.
-- 2. Preserva 100% dos dados cadastrados e todo o histórico de auditoria intactos.
-- 3. Preserva RLS habilitado em todas as tabelas.
-- 4. Preserva os triggers de integridade e o trigger de imutabilidade da auditoria.
-- 5. Revoga quaisquer privilégios residuais concedidos a PUBLIC, anon e authenticated.
-- 6. Remove as policies criadas na migration de forma idempotente via pg_policies.
--
-- LIMITAÇÃO ARQUITETURAL DE SUSPENSÃO DO BACKEND:
-- Este script de rollback revoga e fecha os acessos externos do banco de dados.
-- Contudo, como o backend do FIORIX opera via Prisma Client conectando-se diretamente
-- ao pool PostgreSQL, este script isoladamente NÃO suspende consultas disparadas
-- pelo próprio servidor da aplicação caso o código continue chamando as tabelas.
-- A suspensão funcional completa para os colaboradores exige adicionalmente a desativação
-- da funcionalidade na camada de aplicação (via feature flag ou remoção das chamadas).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. REMOÇÃO IDEMPOTENTE DAS POLICIES CRIADAS NA FASE V1.2
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Remover policy de fiorix_nav_group_rules se existir
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fiorix_nav_group_rules'
      AND policyname = 'rls_fiorix_nav_group_rules_deny_external'
  ) THEN
    DROP POLICY rls_fiorix_nav_group_rules_deny_external ON public.fiorix_nav_group_rules;
  END IF;

  -- Remover policy de fiorix_nav_user_rules se existir
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fiorix_nav_user_rules'
      AND policyname = 'rls_fiorix_nav_user_rules_deny_external'
  ) THEN
    DROP POLICY rls_fiorix_nav_user_rules_deny_external ON public.fiorix_nav_user_rules;
  END IF;

  -- Remover policy de fiorix_nav_audit se existir
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'fiorix_nav_audit'
      AND policyname = 'rls_fiorix_nav_audit_deny_external'
  ) THEN
    DROP POLICY rls_fiorix_nav_audit_deny_external ON public.fiorix_nav_audit;
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. REFORÇO DE REVOGAÇÃO DE PRIVILÉGIOS (MANTENDO RLS ATIVO)
-- ----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.fiorix_nav_group_rules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fiorix_nav_user_rules FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.fiorix_nav_audit FROM PUBLIC, anon, authenticated;

-- Garantir que RLS permaneça habilitado
ALTER TABLE public.fiorix_nav_group_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_nav_user_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_nav_audit ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. MARCAÇÃO DE STATUS SUSPENSO NOS METADADOS DO BANCO
-- ----------------------------------------------------------------------------
COMMENT ON TABLE public.fiorix_nav_group_rules IS 'STATUS: SUSPENSO / INATIVO VIA ROLLBACK NÃO-DESTRUTIVO (DADOS PRESERVADOS)';
COMMENT ON TABLE public.fiorix_nav_user_rules IS 'STATUS: SUSPENSO / INATIVO VIA ROLLBACK NÃO-DESTRUTIVO (DADOS PRESERVADOS)';
COMMENT ON TABLE public.fiorix_nav_audit IS 'STATUS: SUSPENSO / INATIVO VIA ROLLBACK NÃO-DESTRUTIVO (DADOS PRESERVADOS)';

COMMIT;
