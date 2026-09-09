-- Migration: Adicionar 'SUBSTITUTO' ao tipo enum Role
-- Permite atribuir a função formal de Oficial Substituto para governança exclusiva de ITs

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'Role' AND e.enumlabel = 'SUBSTITUTO'
  ) THEN
    ALTER TYPE public."Role" ADD VALUE 'SUBSTITUTO';
  END IF;
END $$;
