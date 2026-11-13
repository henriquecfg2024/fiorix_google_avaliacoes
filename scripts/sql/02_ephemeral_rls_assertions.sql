-- ============================================================================
-- FIORIX — Verificações reais de isolamento RLS, privilégios e search_path
-- Executado APÓS `20261113000000_lockdown_public_schema_and_rls.sql` em banco
-- PostgreSQL efêmero com dados sintéticos.
-- ============================================================================

-- 1. Todas as tabelas de public (exceto _prisma_migrations) devem ter RLS ativo e FORCE RLS desligado
DO $$
DECLARE
  v_missing text;
  v_forced text;
BEGIN
  SELECT c.relname INTO v_missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relname <> '_prisma_migrations'
    AND c.relrowsecurity = false
  LIMIT 1;

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'Falha RLS: tabela public."%" sem ROW LEVEL SECURITY ativo.', v_missing;
  END IF;

  SELECT c.relname INTO v_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind IN ('r', 'p')
    AND c.relforcerowsecurity = true
  LIMIT 1;

  IF v_forced IS NOT NULL THEN
    RAISE EXCEPTION 'Falha FORCE RLS: tabela public."%" está com relforcerowsecurity=true.', v_forced;
  END IF;
END;
$$;

-- 2. Privilégios revogados para PUBLIC, anon e authenticated; mantidos para service_role
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.fiorix_holerites', 'SELECT')
     OR has_table_privilege('authenticated', 'public.fiorix_holerites', 'SELECT')
     OR has_table_privilege('anon', 'public."User"', 'SELECT')
     OR has_table_privilege('authenticated', 'public."User"', 'SELECT') THEN
    RAISE EXCEPTION 'Falha de privilégios: anon ou authenticated ainda possuem SELECT no schema public.';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.fiorix_holerites', 'SELECT') THEN
    RAISE EXCEPTION 'Falha service_role: service_role perdeu SELECT esperado.';
  END IF;
END;
$$;

-- 3. Verifica ALTER DEFAULT PRIVILEGES criando e inspecionando uma tabela sonda temporária
CREATE TABLE public._ci_default_priv_probe (
  id integer PRIMARY KEY
);

DO $$
BEGIN
  IF has_table_privilege('anon', 'public._ci_default_priv_probe', 'SELECT')
     OR has_table_privilege('authenticated', 'public._ci_default_priv_probe', 'SELECT') THEN
    RAISE EXCEPTION 'Falha ALTER DEFAULT PRIVILEGES: nova tabela recebeu grant para anon/authenticated.';
  END IF;

  IF NOT has_table_privilege('service_role', 'public._ci_default_priv_probe', 'SELECT') THEN
    RAISE EXCEPTION 'Falha ALTER DEFAULT PRIVILEGES: nova tabela não recebeu grant para service_role.';
  END IF;
END;
$$;

DROP TABLE public._ci_default_priv_probe;

-- 4. Ausência de policies duplicadas no mesmo papel/comando e uso de InitPlan em policies com current_setting/auth.uid
DO $$
DECLARE
  v_dup text;
  v_non_initplan text;
BEGIN
  SELECT tablename || ' (' || cmd || ')' INTO v_dup
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename, cmd, roles
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF v_dup IS NOT NULL THEN
    RAISE EXCEPTION 'Falha: policies duplicadas encontradas em %.', v_dup;
  END IF;

  SELECT tablename || '.' || policyname INTO v_non_initplan
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      (coalesce(qual, '') ~* '(current_setting|auth\.uid)' AND coalesce(qual, '') !~* 'select\s+')
      OR (coalesce(with_check, '') ~* '(current_setting|auth\.uid)' AND coalesce(with_check, '') !~* 'select\s+')
    )
  LIMIT 1;

  IF v_non_initplan IS NOT NULL THEN
    RAISE EXCEPTION 'Falha Auth RLS InitPlan: policy % não encapsula SELECT.', v_non_initplan;
  END IF;
END;
$$;

-- 5. search_path imutável fixado nas funções protegidas pela migração
DO $$
DECLARE
  fn_name text;
  v_cfg text[];
BEGIN
  FOREACH fn_name IN ARRAY ARRAY[
    'public.fn_prevent_fiorix_saas_governance_audit_mutation()',
    'public.fn_check_nav_user_rule_tenant()',
    'public.doc_manifestacao_imutavel()'
  ] LOOP
    SELECT proconfig INTO v_cfg
    FROM pg_proc
    WHERE oid = to_regprocedure(fn_name);

    IF v_cfg IS NULL OR NOT EXISTS (
      SELECT 1
      FROM unnest(v_cfg) AS elem
      WHERE regexp_replace(replace(elem, '"', ''), '\s+', ' ', 'g') = 'search_path=pg_catalog, public'
    ) THEN
      RAISE EXCEPTION 'Falha search_path em %: proconfig=%', fn_name, coalesce(v_cfg::text, '<NULL>');
    END IF;
  END LOOP;
END;
$$;

-- 6. Testes em execução real com SET LOCAL ROLE + rollback limpo:
--    a) anon/authenticated bloqueados por falta de grant (42501)
--    b) mesmo com grant temporário dentro do bloco ROLLBACK, RLS bloqueia GUC vazia e tenant cruzado (42501)
--    c) service_role lê integralmente os dados sintéticos da aplicação
BEGIN;
  DO $$
  DECLARE
    v_blocked boolean := false;
    v_cnt integer := 0;
  BEGIN
    SET LOCAL ROLE anon;
    BEGIN
      SELECT COUNT(*) INTO v_cnt FROM public.fiorix_holerites;
    EXCEPTION WHEN SQLSTATE '42501' THEN
      v_blocked := true;
    END;
    IF NOT v_blocked THEN
      RAISE EXCEPTION 'Falha: role anon conseguiu consultar public.fiorix_holerites (cnt=%).', v_cnt;
    END IF;
    RESET ROLE;

    -- Testa RLS puro concedendo temporariamente SELECT, INSERT dentro da transação revertida no final
    GRANT SELECT, INSERT ON public.fiorix_holerites TO authenticated;
    SET LOCAL ROLE authenticated;

    -- Caso 1: GUC app.current_tenant_id vazia -> retorna 0 linhas e bloqueia INSERT
    PERFORM set_config('app.current_tenant_id', '', true);
    SELECT COUNT(*) INTO v_cnt FROM public.fiorix_holerites;
    IF v_cnt <> 0 THEN
      RAISE EXCEPTION 'Falha fail-closed: GUC vazia retornou % linhas.', v_cnt;
    END IF;

    v_blocked := false;
    BEGIN
      INSERT INTO public.fiorix_holerites (id, tenant_id, usuario_id, arquivo_nome)
      VALUES ('hol-bad-empty', 'tenant-a', '11111111-1111-4111-8111-111111111111', 'x.pdf');
    EXCEPTION WHEN SQLSTATE '42501' THEN
      v_blocked := true;
    END;
    IF NOT v_blocked THEN
      RAISE EXCEPTION 'Falha RLS WITH CHECK: INSERT permitido com app.current_tenant_id vazio.';
    END IF;

    -- Caso 2: GUC = tenant-a -> lê apenas 1 linha (tenant-a) e bloqueia INSERT em tenant-b
    PERFORM set_config('app.current_tenant_id', 'tenant-a', true);
    SELECT COUNT(*) INTO v_cnt FROM public.fiorix_holerites;
    IF v_cnt <> 1 THEN
      RAISE EXCEPTION 'Falha isolamento SELECT tenant-a: esperado 1, obtido %.', v_cnt;
    END IF;

    v_blocked := false;
    BEGIN
      INSERT INTO public.fiorix_holerites (id, tenant_id, usuario_id, arquivo_nome)
      VALUES ('hol-cross-tenant', 'tenant-b', '22222222-2222-4222-8222-222222222222', 'cross.pdf');
    EXCEPTION WHEN SQLSTATE '42501' THEN
      v_blocked := true;
    END;
    IF NOT v_blocked THEN
      RAISE EXCEPTION 'Falha cross-tenant: authenticated(tenant-a) inseriu em tenant-b.';
    END IF;

    RESET ROLE;
  END;
  $$;
ROLLBACK;

BEGIN;
  DO $$
  DECLARE
    v_srv_cnt integer := 0;
  BEGIN
    SET LOCAL ROLE service_role;
    SELECT COUNT(*) INTO v_srv_cnt FROM public.fiorix_holerites;
    IF v_srv_cnt < 2 THEN
      RAISE EXCEPTION 'Falha acesso legítimo service_role: esperado >= 2, obtido %.', v_srv_cnt;
    END IF;
    RESET ROLE;
  END;
  $$;
ROLLBACK;
