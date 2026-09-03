-- Migration: 20260902_v3_fix.sql
-- V3 FIX: Planejamento 2027 Anual e View de Conflitos para Serventia Notarial / Registral

-- FIX 2: Tabela planejamento 2027 anual
CREATE TABLE IF NOT EXISTS fiorix_ferias_planejamento_2027 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES auth.users,
  colaborador_nome TEXT,
  setor TEXT, -- Atendimento, Registro, Financeiro, RH, Administração
  periodo_1_inicio DATE,
  periodo_1_fim DATE,
  periodo_1_dias INT GENERATED ALWAYS AS (periodo_1_fim - periodo_1_inicio + 1) STORED,
  periodo_2_inicio DATE,
  periodo_2_fim DATE,
  periodo_2_dias INT,
  periodo_3_inicio DATE,
  periodo_3_fim DATE,
  periodo_3_dias INT,
  total_dias INT GENERATED ALWAYS AS (
    COALESCE(periodo_1_fim - periodo_1_inicio + 1, 0) + 
    COALESCE(periodo_2_fim - periodo_2_inicio + 1, 0) + 
    COALESCE(periodo_3_fim - periodo_3_inicio + 1, 0)
  ) STORED,
  ano INT DEFAULT 2027,
  status TEXT DEFAULT 'planejado' CHECK (status IN ('pendente','planejado','conflito','publicado')),
  observacao TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  motivo_exclusao TEXT,
  hash_exclusao TEXT,
  historico JSONB DEFAULT '[]'::jsonb,
  UNIQUE(usuario_id, ano)
);

-- View para detectar conflitos por setor/mês (mais de 3 no mesmo setor no mesmo mês)
CREATE OR REPLACE VIEW vw_conflitos_ferias_2027 AS
SELECT 
  setor, 
  EXTRACT(MONTH FROM periodo_1_inicio) as mes, 
  COUNT(*) as qtd 
FROM fiorix_ferias_planejamento_2027 
WHERE deleted_at IS NULL 
GROUP BY setor, EXTRACT(MONTH FROM periodo_1_inicio) 
HAVING COUNT(*) > 3;
