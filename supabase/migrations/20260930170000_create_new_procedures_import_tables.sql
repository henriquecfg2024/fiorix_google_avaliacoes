-- Migração: Criação das tabelas de importação para Retornos, Impressões e Andamentos
-- Procedures: dbo.pr_Fiorix_BI_Retornos, dbo.pr_Fiorix_BI_Impressoes, dbo.pr_Fiorix_BI_Andamentos

-- 1. fiorix_retornos_imports
CREATE TABLE IF NOT EXISTS public.fiorix_retornos_imports (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL DEFAULT '',
    import_key VARCHAR(100),
    arquivo VARCHAR(255), 
    periodo VARCHAR(100), 
    data_hora TIMESTAMP DEFAULT NOW(), 
    linhas INT, 
    inseridas INT, 
    importado_por VARCHAR(100), 
    status VARCHAR(20)
);

CREATE UNIQUE INDEX IF NOT EXISTS fiorix_retornos_imports_tenant_import_key
ON public.fiorix_retornos_imports (tenant_id, import_key);

ALTER TABLE public.fiorix_retornos_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_retornos_imports" ON public.fiorix_retornos_imports;
CREATE POLICY "tenant_isolation_retornos_imports" ON public.fiorix_retornos_imports
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

GRANT SELECT ON public.fiorix_retornos_imports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_retornos_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_retornos_imports TO service_role;


-- 2. fiorix_impressoes_imports
CREATE TABLE IF NOT EXISTS public.fiorix_impressoes_imports (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL DEFAULT '',
    import_key VARCHAR(100),
    arquivo VARCHAR(255), 
    periodo VARCHAR(100), 
    data_hora TIMESTAMP DEFAULT NOW(), 
    linhas INT, 
    inseridas INT, 
    importado_por VARCHAR(100), 
    status VARCHAR(20)
);

CREATE UNIQUE INDEX IF NOT EXISTS fiorix_impressoes_imports_tenant_import_key
ON public.fiorix_impressoes_imports (tenant_id, import_key);

ALTER TABLE public.fiorix_impressoes_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_impressoes_imports" ON public.fiorix_impressoes_imports;
CREATE POLICY "tenant_isolation_impressoes_imports" ON public.fiorix_impressoes_imports
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

GRANT SELECT ON public.fiorix_impressoes_imports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_impressoes_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_impressoes_imports TO service_role;


-- 3. fiorix_andamentos_imports
CREATE TABLE IF NOT EXISTS public.fiorix_andamentos_imports (
    id SERIAL PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL DEFAULT '',
    import_key VARCHAR(100),
    arquivo VARCHAR(255), 
    periodo VARCHAR(100), 
    data_hora TIMESTAMP DEFAULT NOW(), 
    linhas INT, 
    inseridas INT, 
    importado_por VARCHAR(100), 
    status VARCHAR(20)
);

CREATE UNIQUE INDEX IF NOT EXISTS fiorix_andamentos_imports_tenant_import_key
ON public.fiorix_andamentos_imports (tenant_id, import_key);

ALTER TABLE public.fiorix_andamentos_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation_andamentos_imports" ON public.fiorix_andamentos_imports;
CREATE POLICY "tenant_isolation_andamentos_imports" ON public.fiorix_andamentos_imports
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true))
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

GRANT SELECT ON public.fiorix_andamentos_imports TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_andamentos_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fiorix_andamentos_imports TO service_role;
