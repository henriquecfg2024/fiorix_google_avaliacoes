-- Migration: Módulo Qualidade (Gestão de Prazos)
-- Criada em: 2026-10-09

-- 1. Coluna de Origem (ONR / Recepção) na tabela de retornos
ALTER TABLE public.fiorix_retornos_dados
  ADD COLUMN IF NOT EXISTS protocolo_entidade VARCHAR(100);

-- 2. Metas de Qualidade por Colaborador
CREATE TABLE IF NOT EXISTS public.fiorix_qualidade_metas (
    id VARCHAR(30) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    colaborador_nome VARCHAR(255) NOT NULL,
    atividade VARCHAR(100) NOT NULL,
    origem VARCHAR(50),
    meta_valor INT NOT NULL,
    competencia_inicio VARCHAR(7) NOT NULL,
    criado_por VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fiorix_qualidade_metas_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    CONSTRAINT fiorix_qualidade_metas_unique UNIQUE (tenant_id, colaborador_nome, atividade, competencia_inicio)
);

CREATE INDEX IF NOT EXISTS idx_fiorix_qualidade_metas_tenant_colab 
    ON public.fiorix_qualidade_metas (tenant_id, colaborador_nome);

-- 3. Limites de Erro por Colaborador / Tipo
CREATE TABLE IF NOT EXISTS public.fiorix_qualidade_limites (
    id VARCHAR(30) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    colaborador_nome VARCHAR(255) NOT NULL,
    tipo_retorno VARCHAR(100) NOT NULL,
    limite_percentual DECIMAL(5, 2) NOT NULL,
    competencia_inicio VARCHAR(7) NOT NULL,
    criado_por VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fiorix_qualidade_limites_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    CONSTRAINT fiorix_qualidade_limites_unique UNIQUE (tenant_id, colaborador_nome, tipo_retorno, competencia_inicio)
);

CREATE INDEX IF NOT EXISTS idx_fiorix_qualidade_limites_tenant_colab 
    ON public.fiorix_qualidade_limites (tenant_id, colaborador_nome);

-- 4. Revisão Manual de Causas de Erro (Auditoria de Gestão)
CREATE TABLE IF NOT EXISTS public.fiorix_qualidade_revisoes_causa (
    id VARCHAR(30) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    id_andamento BIGINT NOT NULL,
    numero_prenotacao INT NOT NULL,
    categoria_sugerida VARCHAR(100),
    categoria_revisada VARCHAR(100) NOT NULL,
    justificativa TEXT,
    revisado_por VARCHAR(255),
    revisado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fiorix_qualidade_revisoes_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    CONSTRAINT fiorix_qualidade_revisoes_unique UNIQUE (tenant_id, id_andamento)
);

CREATE INDEX IF NOT EXISTS idx_fiorix_qualidade_revisoes_tenant_prenotacao 
    ON public.fiorix_qualidade_revisoes_causa (tenant_id, numero_prenotacao);

-- RLS & MULTI-TENANT ISOLATION
ALTER TABLE public.fiorix_qualidade_metas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_qualidade_limites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_qualidade_revisoes_causa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_qualidade_metas" ON public.fiorix_qualidade_metas;
CREATE POLICY "tenant_isolation_qualidade_metas" ON public.fiorix_qualidade_metas
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS "tenant_isolation_qualidade_limites" ON public.fiorix_qualidade_limites;
CREATE POLICY "tenant_isolation_qualidade_limites" ON public.fiorix_qualidade_limites
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

DROP POLICY IF EXISTS "tenant_isolation_qualidade_revisoes" ON public.fiorix_qualidade_revisoes_causa;
CREATE POLICY "tenant_isolation_qualidade_revisoes" ON public.fiorix_qualidade_revisoes_causa
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- GRANTS EXPLICITOS DATA API (SUPABASE COMPLIANCE)
GRANT SELECT ON public.fiorix_qualidade_metas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_qualidade_metas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_qualidade_metas TO service_role;

GRANT SELECT ON public.fiorix_qualidade_limites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_qualidade_limites TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_qualidade_limites TO service_role;

GRANT SELECT ON public.fiorix_qualidade_revisoes_causa TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_qualidade_revisoes_causa TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_qualidade_revisoes_causa TO service_role;
