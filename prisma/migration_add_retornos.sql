-- Migration: Tabela de Retornos (Gestão de Prazos)
-- Criada em: 2026-09-25

CREATE TABLE IF NOT EXISTS public.fiorix_retornos_dados (
    tenant_id VARCHAR(100) NOT NULL,
    id_andamento BIGINT NOT NULL,
    id_recepcao INT,
    numero_prenotacao INT NOT NULL,
    data_recepcao TIMESTAMP WITH TIME ZONE,
    tipo_recepcao VARCHAR(50),
    forma_titulo VARCHAR(255),
    id_tipo_retorno INT NOT NULL,
    sigla_retorno VARCHAR(20),
    tipo_retorno VARCHAR(100),
    familia_retorno VARCHAR(50),
    classificacao VARCHAR(50),
    data_retorno TIMESTAMP WITH TIME ZONE NOT NULL,
    id_usuario_origem VARCHAR(50),
    usuario_origem VARCHAR(255),
    id_usuario_destino VARCHAR(50),
    usuario_destino_retorno VARCHAR(255),
    observacao TEXT,
    seq_titulo INT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fiorix_retornos_dados_pkey PRIMARY KEY (tenant_id, id_andamento),
    CONSTRAINT fiorix_retornos_dados_tenant_fkey FOREIGN KEY (tenant_id) REFERENCES public."Tenant"(id) ON DELETE CASCADE
);

-- Índices otimizados para filtros e ordenação
CREATE INDEX IF NOT EXISTS idx_fiorix_retornos_tenant_data 
    ON public.fiorix_retornos_dados (tenant_id, data_retorno DESC);

CREATE INDEX IF NOT EXISTS idx_fiorix_retornos_tenant_usuario_destino 
    ON public.fiorix_retornos_dados (tenant_id, id_usuario_destino);

CREATE INDEX IF NOT EXISTS idx_fiorix_retornos_tenant_tipo 
    ON public.fiorix_retornos_dados (tenant_id, id_tipo_retorno);

CREATE INDEX IF NOT EXISTS idx_fiorix_retornos_tenant_prenotacao 
    ON public.fiorix_retornos_dados (tenant_id, numero_prenotacao);

CREATE INDEX IF NOT EXISTS idx_fiorix_retornos_tenant_classificacao
    ON public.fiorix_retornos_dados (tenant_id, classificacao);
