-- Migração: Remoção das tabelas de andamentos da tela de Auditoria Operacional (descontinuada)
-- Tabelas exclusivas da auditoria de andamentos

DROP TABLE IF EXISTS public.fiorix_andamentos_dados CASCADE;
DROP TABLE IF EXISTS public.fiorix_andamentos_imports CASCADE;
