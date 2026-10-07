-- ============================================================================
-- ⚠️  SCRIPT DE ROLLBACK PREPARADO — NÃO APLICAR AUTOMATICAMENTE  ⚠️
-- ============================================================================
-- FIORIX — Rollback V2 | Permissões de Navegação por Perfil (Role) e Colaborador (User)
-- Arquivo : 20261007180000_fiorix_nav_permissions_v2_rollback.sql
-- Status  : PREPARADO LOCALMENTE.
-- Local   : supabase/prepared-migrations/
-- ============================================================================

BEGIN;

DROP TRIGGER IF EXISTS trg_check_nav_user_rule_tenant ON public.fiorix_nav_user_rules;
DROP FUNCTION IF EXISTS public.fn_check_nav_user_rule_tenant();

DROP TABLE IF EXISTS public.fiorix_nav_user_rules CASCADE;
DROP TABLE IF EXISTS public.fiorix_nav_role_rules CASCADE;

COMMIT;
