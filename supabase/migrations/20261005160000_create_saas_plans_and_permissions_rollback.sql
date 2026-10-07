-- ==============================================================================
-- FIORIX SaaS: Procedimento Operacional de Rollback Seguro e Não-Destrutivo
-- Arquivo: supabase/migrations/20261005160000_create_saas_plans_and_permissions_rollback.sql
-- 
-- DIRETRIZ INEGOCIÁVEL DE SEGURANÇA E AUDITORIA:
-- 1. O rollback operacional padrão NUNCA é destrutivo.
-- 2. NÃO EXECUTAR DROP TABLE CASCADE EM AMBIENTE DE HOMOLOGAÇÃO OU PRODUÇÃO.
-- 3. Dados de auditoria (fiorix_saas_governance_audit) são imutáveis e jamais podem
--    ser apagados em um rollback operacional.
-- ==============================================================================

-- ── ETAPA 1: PROCEDIMENTO OPERACIONAL PADRÃO (ROLLBACK INSTANTÂNEO EM RUNTIME) ──
-- 
-- Para reverter 100% de qualquer efeito de planos ou políticas sem tocar no banco:
-- No ambiente da Vercel / variáveis de ambiente (.env):
-- 
--   FEATURE_SAAS_PLANS_V1_ENABLED=false
--   FEATURE_ROLE_POLICIES_V1_ENABLED=false
-- 
-- Resultado:
-- O FIORIX entra imediatamente no modo legado onde nenhum acesso de rota,
-- menu ou API é bloqueado, preservando 100% do histórico e das trilhas.

-- ── ETAPA 2: SUSPENSÃO SEGURA DE PLANOS CUSTOMIZADOS (OPCIONAL / ADITIVA) ──
-- 
-- Caso deseje suspender planos customizados sem apagar dados ou histórico:
UPDATE public.fiorix_saas_plans 
SET is_active = false, updated_at = now()
WHERE is_official = false AND is_active = true;

-- ── ETAPA 3: REGISTRO DE EVENTO DE AUDITORIA DO ROLLBACK ──
INSERT INTO public.fiorix_saas_governance_audit (
  id, tenant_id, user_id, action, entity_type, previous_state, new_state, created_at
) VALUES (
  'rollback_event_' || floor(extract(epoch from now())),
  NULL,
  'SYSTEM_OPERATIONAL_ROLLBACK',
  'ROLLBACK_SAFETY_DEACTIVATION',
  'FEATURE_FLAGS',
  '{"FEATURE_SAAS_PLANS_V1_ENABLED": "true"}'::jsonb,
  '{"FEATURE_SAAS_PLANS_V1_ENABLED": "false", "status": "reverted_to_legacy"}'::jsonb,
  now()
);

-- NOTA TÉCNICA:
-- A exclusão de tabelas DDL (DROP TABLE) é terminantemente desaconselhada e
-- violaria a imutabilidade da trilha de governança exigida para conformidade.
