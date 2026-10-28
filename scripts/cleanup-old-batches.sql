-- ============================================================
-- FIORIX — LIMPEZA DE LOTES ANTIGOS NO SUPABASE
-- ============================================================
-- Este script remove lotes antigos (> 7 dias) das tabelas:
--   - ConnectorSyncStaging  (payload JSON pesado)
--   - ConnectorSyncBatch    (metadados dos lotes)
--
-- NÃO AFETA:
--   - ConnectorSyncRecord   (registros deduplificados, usado pelo incremental)
--   - ConnectorSourceStatus (status dos sources)
--   - fiorix_metas_dados    (dados vivos)
--   - fiorix_bi_data        (dados vivos)
--   - Nenhuma outra tabela
-- ============================================================

-- 1. VERIFICAÇÃO PRÉVIA — Contagem antes da limpeza
SELECT 'ANTES DA LIMPEZA' AS fase;

SELECT 'ConnectorSyncStaging' AS tabela, COUNT(*) AS registros
FROM "ConnectorSyncStaging"
UNION ALL
SELECT 'ConnectorSyncBatch', COUNT(*)
FROM "ConnectorSyncBatch"
UNION ALL
SELECT 'Staging > 7 dias (a deletar)', COUNT(*)
FROM "ConnectorSyncStaging"
WHERE "createdAt" < NOW() - INTERVAL '7 days'
UNION ALL
SELECT 'Batches > 7 dias (a deletar)', COUNT(*)
FROM "ConnectorSyncBatch"
WHERE "receivedAt" < NOW() - INTERVAL '7 days';

-- 2. DELETAR STAGING ANTIGO (é a tabela mais pesada — contém JSON bruto)
DELETE FROM "ConnectorSyncStaging"
WHERE "createdAt" < NOW() - INTERVAL '7 days';

-- 3. DELETAR BATCHES ANTIGOS (metadados leves, mas sem utilidade após limpeza do staging)
DELETE FROM "ConnectorSyncBatch"
WHERE "receivedAt" < NOW() - INTERVAL '7 days';

-- 4. VERIFICAÇÃO PÓS-LIMPEZA
SELECT 'APÓS A LIMPEZA' AS fase;

SELECT 'ConnectorSyncStaging' AS tabela, COUNT(*) AS registros
FROM "ConnectorSyncStaging"
UNION ALL
SELECT 'ConnectorSyncBatch', COUNT(*)
FROM "ConnectorSyncBatch";
