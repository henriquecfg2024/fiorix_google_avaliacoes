CREATE UNIQUE INDEX IF NOT EXISTS fiorix_produtividade_dados_tenant_pedido_data
ON public.fiorix_produtividade_dados (tenant_id, pedido, data);

ALTER TABLE public.fiorix_produtividade_dados
DROP CONSTRAINT IF EXISTS pk_fiorix_produtividade;

DROP INDEX IF EXISTS public.fiorix_produtividade_dados_pedido_data_idx;
