-- Backfill de tenantId para dados existentes de BI, Metas e Produtividade
DO $$
DECLARE
  v_default_tenant_id TEXT;
BEGIN
  -- Obter o ID do primeiro tenant (Cartório) da base de dados
  SELECT id INTO v_default_tenant_id FROM public."Tenant" ORDER BY "createdAt" ASC LIMIT 1;

  IF v_default_tenant_id IS NULL THEN
    v_default_tenant_id := 'cms3xd0wm00002pw9j2k0ahan';
  END IF;

  -- Backfill Fiorix BI Imports
  UPDATE public.fiorix_bi_imports
  SET tenant_id = v_default_tenant_id
  WHERE tenant_id IS NULL OR tenant_id = '';

  -- Backfill Fiorix BI Data
  UPDATE public.fiorix_bi_data
  SET tenant_id = v_default_tenant_id
  WHERE tenant_id IS NULL OR tenant_id = '';

  -- Backfill Fiorix Metas Imports
  UPDATE public.fiorix_metas_imports
  SET tenant_id = v_default_tenant_id
  WHERE tenant_id IS NULL OR tenant_id = '';

  -- Backfill Fiorix Metas Dados
  UPDATE public.fiorix_metas_dados
  SET tenant_id = v_default_tenant_id
  WHERE tenant_id IS NULL OR tenant_id = '';

  -- Backfill Produtividade Imports (se a tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fiorix_produtividade_imports') THEN
    ALTER TABLE public.fiorix_produtividade_imports ADD COLUMN IF NOT EXISTS tenant_id TEXT;
    UPDATE public.fiorix_produtividade_imports
    SET tenant_id = v_default_tenant_id
    WHERE tenant_id IS NULL OR tenant_id = '';
  END IF;

  -- Backfill Produtividade Dados (se a tabela existir)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'fiorix_produtividade_dados') THEN
    ALTER TABLE public.fiorix_produtividade_dados ADD COLUMN IF NOT EXISTS tenant_id TEXT;
    UPDATE public.fiorix_produtividade_dados
    SET tenant_id = v_default_tenant_id
    WHERE tenant_id IS NULL OR tenant_id = '';
  END IF;

  RAISE NOTICE 'Backfill de tenant_id concluído com sucesso para o tenant %', v_default_tenant_id;
END $$;
