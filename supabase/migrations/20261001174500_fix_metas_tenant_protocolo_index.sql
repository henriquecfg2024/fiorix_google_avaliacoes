-- Migration: Garante índice único (tenant_id, protocolo) em fiorix_metas_dados
-- Data: 2026-10-01
-- Objetivo: Permitir ON CONFLICT (tenant_id, protocolo) seguro em ingestões ao vivo e em lote

CREATE UNIQUE INDEX IF NOT EXISTS fiorix_metas_dados_tenant_protocolo 
ON public.fiorix_metas_dados (tenant_id, protocolo);
