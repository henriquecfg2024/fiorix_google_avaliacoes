-- Migration: 20260930140000_ensure_public_grants.sql
-- Compliance Supabase Data API (Outubro 2026)
-- Garante GRANTs explícitos para todas as tabelas, views e sequences no schema public
-- para anon, authenticated e service_role.

-- 1. Permissão de uso no schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- 2. Concessão de permissões em todas as tabelas e views existentes
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- 3. Concessão de permissões em todas as sequences existentes (IDs auto-increment)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- 4. Permissões de execução para rotinas/funções existentes
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- 5. Privilégios padrão para qualquer objeto criado futuramente no schema public
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT SELECT ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT ALL ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public 
  GRANT EXECUTE ON ROUTINES TO authenticated, service_role;
