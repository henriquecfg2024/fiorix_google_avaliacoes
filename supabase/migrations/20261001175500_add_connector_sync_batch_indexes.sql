-- Migration: Cria índices compostos para acelerar consultas da Central de Operações
-- Data: 2026-10-01
-- Objetivo: Evitar table scan em ConnectorSyncBatch nas consultas de últimos lotes e telemetria temporal

CREATE INDEX IF NOT EXISTS "ConnectorSyncBatch_tenant_src_rec_idx" 
ON public."ConnectorSyncBatch" ("tenantId", "connectorId", "source", "receivedAt" DESC);

CREATE INDEX IF NOT EXISTS "ConnectorSyncBatch_tenant_rec_idx" 
ON public."ConnectorSyncBatch" ("tenantId", "receivedAt" DESC);
