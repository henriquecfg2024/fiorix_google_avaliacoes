-- Migração: Criação da tabela fiorix_impressoes_dados
-- Data: 2026-09-25
-- Módulo: Gestão de Prazos -> Controle de Impressões (Apurado exclusivamente por andamentos reais do WebRI)

CREATE TABLE IF NOT EXISTS public.fiorix_impressoes_dados (
    tenant_id text NOT NULL REFERENCES public."Tenant"(id) ON DELETE CASCADE,
    id_andamento bigint NOT NULL,
    id_recepcao integer,
    numero_prenotacao integer NOT NULL,
    seq_titulo integer DEFAULT 1,
    data_entrada timestamp with time zone,
    tipo_prenotacao character varying(50),
    natureza character varying(255),
    numero_livro character varying(100),
    id_tipo_andamento integer NOT NULL,
    sigla_andamento character varying(20),
    tipo_andamento character varying(100),
    tipo_impressao character varying(50) NOT NULL, -- 'LIVRO' | 'CERTIDAO'
    data_impressao timestamp with time zone NOT NULL,
    id_operador character varying(50),
    operador character varying(255),
    id_usuario_destino character varying(50),
    usuario_destino character varying(255),
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fiorix_impressoes_dados_pkey PRIMARY KEY (tenant_id, id_andamento)
);

CREATE INDEX IF NOT EXISTS idx_fiorix_impressoes_tenant_data 
    ON public.fiorix_impressoes_dados (tenant_id, data_impressao DESC);

CREATE INDEX IF NOT EXISTS idx_fiorix_impressoes_tenant_tipo 
    ON public.fiorix_impressoes_dados (tenant_id, tipo_impressao);

CREATE INDEX IF NOT EXISTS idx_fiorix_impressoes_tenant_prenotacao 
    ON public.fiorix_impressoes_dados (tenant_id, numero_prenotacao);

CREATE INDEX IF NOT EXISTS idx_fiorix_impressoes_tenant_operador 
    ON public.fiorix_impressoes_dados (tenant_id, operador);
