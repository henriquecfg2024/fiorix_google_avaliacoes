-- Migration: 20260831_comunicados_v2_compliant.sql
-- Provimento 213/2026 e Trilha WORM de Conformidade

-- FIX 1: Soft-delete com trilha WORM para Prov.213/2026 Art.7
ALTER TABLE fiorix_comunicados 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, 
  ADD COLUMN IF NOT EXISTS deleted_by UUID, 
  ADD COLUMN IF NOT EXISTS motivo_exclusao TEXT, 
  ADD COLUMN IF NOT EXISTS hash_exclusao TEXT, 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'publicado';

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_fiorix_comunicados_status'
  ) THEN
    ALTER TABLE fiorix_comunicados 
      ADD CONSTRAINT chk_fiorix_comunicados_status CHECK (status IN ('publicado','arquivado','excluido'));
  END IF;
END $$;

ALTER TABLE fiorix_holerites 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, 
  ADD COLUMN IF NOT EXISTS deleted_by UUID, 
  ADD COLUMN IF NOT EXISTS motivo_exclusao TEXT, 
  ADD COLUMN IF NOT EXISTS hash_exclusao TEXT, 
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativo';

ALTER TABLE fiorix_ferias_previstas 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, 
  ADD COLUMN IF NOT EXISTS deleted_by UUID;

ALTER TABLE fiorix_ferias_avisos 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ, 
  ADD COLUMN IF NOT EXISTS deleted_by UUID;
