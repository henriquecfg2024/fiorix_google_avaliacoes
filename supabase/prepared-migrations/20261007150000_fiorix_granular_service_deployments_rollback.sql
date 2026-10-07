-- Rollback da migration 20261007150000_fiorix_granular_service_deployments.sql
DROP TRIGGER IF EXISTS trg_fiorix_block_granular_audit_mutation ON public.fiorix_granular_audit;
DROP FUNCTION IF EXISTS public.fn_fiorix_block_granular_audit_mutation();

DROP TABLE IF EXISTS public.fiorix_granular_audit CASCADE;
DROP TABLE IF EXISTS public.fiorix_service_suspensions CASCADE;
DROP TABLE IF EXISTS public.fiorix_service_deployments CASCADE;
DROP TABLE IF EXISTS public.fiorix_tenant_services CASCADE;
