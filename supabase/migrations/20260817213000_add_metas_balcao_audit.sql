ALTER TABLE public.fiorix_metas_dados
  ADD COLUMN IF NOT EXISTS d_balcao_registrado TIMESTAMP,
  ADD COLUMN IF NOT EXISTS d_balcao_devolvido TIMESTAMP;

COMMENT ON COLUMN public.fiorix_metas_dados.d_balcao_registrado
  IS 'Ultimo andamento BALCAO REGISTRADO (tipo 76) recebido da fonte.';

COMMENT ON COLUMN public.fiorix_metas_dados.d_balcao_devolvido
  IS 'Ultimo andamento BALCAO DEVOLVIDO (tipo 75) recebido da fonte.';
