-- ==============================================================================
-- FIORIX - MIGRAÇÃO PARA ZERAR OS 3 WARNINGS DO SUPABASE LINTER
-- Arquivo: 20260923_fix_supabase_warnings.sql
-- Descrição:
--   1. Corrige 'Function Search Path Mutable' em public.trg_fiorix_prevent_audit_tampering
--      fixando explicitamente o parâmetro search_path = ''.
--   2. Corrige 'Public Bucket Allows Listing' nos buckets storage.fiorix-its e storage.it-documentos
--      removendo políticas genéricas de SELECT em storage.objects que expunham a listagem pública.
-- ==============================================================================

-- 1. Fix: Function Search Path Mutable
ALTER FUNCTION public.trg_fiorix_prevent_audit_tampering() SET search_path = '';

-- 2. Fix: Public Bucket Allows Listing
DROP POLICY IF EXISTS "allow-all l1s17l_0" ON storage.objects;
DROP POLICY IF EXISTS "allow-all-fiorix-its-select" ON storage.objects;
