-- Migration para remover RLS permissivo "allow all" e reforçar isolamento multi-tenant
-- Removendo políticas permissivas legadas
DROP POLICY IF EXISTS "allow all" ON public.fiorix_bi_data;
DROP POLICY IF EXISTS "allow all" ON public.fiorix_bi_imports;
DROP POLICY IF EXISTS "allow all" ON public.fiorix_metas_imports;
DROP POLICY IF EXISTS "allow all" ON public.fiorix_metas_dados;

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.fiorix_bi_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_bi_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_metas_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiorix_metas_dados ENABLE ROW LEVEL SECURITY;

-- Garantir que por padrão acessos anônimos diretos pelo PostgREST/Supabase passem por validação ou sejam bloqueados.
-- Apenas chamadas autenticadas via Server (Prisma / Service Role) possuem acesso total parametrizado por tenantId.

CREATE POLICY "tenant_isolation_bi_imports" ON public.fiorix_bi_imports
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY "tenant_isolation_bi_data" ON public.fiorix_bi_data
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));
