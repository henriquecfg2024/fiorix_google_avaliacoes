-- Migration: Proteção Inviolável do Usuário MASTER (admin@fiorix.com.br)
-- Garante via trigger que nenhum comando UPDATE ou DELETE possa afetar a conta MASTER na tabela public."User"

CREATE OR REPLACE FUNCTION protect_master_user() 
RETURNS TRIGGER AS $$
BEGIN 
  IF OLD.email = 'admin@fiorix.com.br' OR OLD.role = 'MASTER' THEN 
    RAISE EXCEPTION 'Operação negada: Usuário MASTER protegido e intocável.'; 
  END IF; 
  RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_master ON public."User";

CREATE TRIGGER trg_protect_master
BEFORE UPDATE OR DELETE ON public."User"
FOR EACH ROW EXECUTE FUNCTION protect_master_user();
