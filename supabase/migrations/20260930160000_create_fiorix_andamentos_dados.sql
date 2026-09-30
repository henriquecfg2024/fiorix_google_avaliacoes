-- Migração: Criação da tabela fiorix_andamentos_dados (Auditória e Rastreamento Integral de Andamentos WebRI)
-- Baseado nos andamentos de dbo.tblWRIAndamentos

CREATE TABLE IF NOT EXISTS public.fiorix_andamentos_dados (
    tenant_id text NOT NULL,
    id_andamento bigint NOT NULL,
    protocolo integer NOT NULL,
    seq_titulo integer DEFAULT 1,
    data_andamento timestamp with time zone NOT NULL,
    id_tipo_andamento integer NOT NULL,
    sigla_andamento character varying(50),
    tipo_andamento character varying(255),
    natureza character varying(255),
    tipo_prenotacao character varying(50),
    id_usuario_origem character varying(50),
    usuario_origem character varying(255),
    id_usuario_destino character varying(50),
    usuario_destino character varying(255),
    observacao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fiorix_andamentos_dados_pkey PRIMARY KEY (tenant_id, id_andamento)
);

CREATE INDEX IF NOT EXISTS idx_fiorix_andamentos_tenant_protocolo
    ON public.fiorix_andamentos_dados (tenant_id, protocolo);

CREATE INDEX IF NOT EXISTS idx_fiorix_andamentos_tenant_data
    ON public.fiorix_andamentos_dados (tenant_id, data_andamento DESC);

CREATE INDEX IF NOT EXISTS idx_fiorix_andamentos_tenant_tipo
    ON public.fiorix_andamentos_dados (tenant_id, id_tipo_andamento);

ALTER TABLE public.fiorix_andamentos_dados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_andamentos_dados" ON public.fiorix_andamentos_dados;
CREATE POLICY "tenant_isolation_andamentos_dados" ON public.fiorix_andamentos_dados
    AS PERMISSIVE FOR ALL
    TO public
    USING (tenant_id = (SELECT (current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id')));

-- Grants obrigatórios Supabase Data API (Outubro 2026)
GRANT SELECT ON public.fiorix_andamentos_dados TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_andamentos_dados TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_andamentos_dados TO service_role;
