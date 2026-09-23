-- ==============================================================================
-- FIORIX - ROLLBACK DOS 3 WARNINGS
-- Arquivo: 20260923_rollback_warnings.sql
-- ==============================================================================

ALTER FUNCTION public.trg_fiorix_prevent_audit_tampering() RESET search_path;

CREATE POLICY "allow-all l1s17l_0" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'it-documentos');

CREATE POLICY "allow-all-fiorix-its-select" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'fiorix-its');
