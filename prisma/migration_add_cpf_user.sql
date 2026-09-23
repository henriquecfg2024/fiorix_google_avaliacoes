-- Migração: Adicionar CPF, departamento e cargo ao model User
-- Data: 2026-09-23
-- Motivo: Permitir vinculação correta de holerites por CPF no upload do RH

-- Adiciona colunas (IF NOT EXISTS para idempotência)
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS departamento TEXT;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS cargo TEXT;

-- Índice único parcial: CPF único por tenant (ignora NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS "User_tenantId_cpf_key"
  ON public."User" ("tenantId", "cpf")
  WHERE cpf IS NOT NULL;
