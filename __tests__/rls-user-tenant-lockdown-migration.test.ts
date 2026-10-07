import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Migration de segurança PREPARADA (não aplicada): RLS em public."User" e public."Tenant".
 * Inspeção estática apenas. Nenhuma conexão com banco.
 */
const ROOT = path.resolve(__dirname, '..');
const PREPARED_DIR = path.join(ROOT, 'supabase', 'prepared-migrations');
const APPLIED_DIR = path.join(ROOT, 'supabase', 'migrations');
const MIGRATION = '20261007160000_fiorix_rls_user_tenant_lockdown.sql';
const ROLLBACK = '20261007160000_fiorix_rls_user_tenant_lockdown_rollback.sql';
const HISTORICAL = '20261005160000_create_saas_plans_and_permissions.sql';
const FN = 'fn_prevent_fiorix_saas_governance_audit_mutation';

const read = (dir: string, file: string) => fs.readFileSync(path.join(dir, file), 'utf8');
const code = (sql: string) =>
  sql
    .split(/\r?\n/)
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n');

const mig = read(PREPARED_DIR, MIGRATION);
const rb = read(PREPARED_DIR, ROLLBACK);
const migCode = code(mig);
const rbCode = code(rb);

describe('Migration de segurança RLS User/Tenant — arquivos e cabeçalhos', () => {
  it('reside só em prepared-migrations (o Supabase CLI não aplica)', () => {
    for (const f of [MIGRATION, ROLLBACK]) {
      expect(fs.existsSync(path.join(PREPARED_DIR, f)), f).toBe(true);
      expect(fs.existsSync(path.join(APPLIED_DIR, f)), f).toBe(false);
    }
  });

  it('cabeçalho "NÃO APLICAR", "NÃO APLICADA EM NENHUM AMBIENTE" e autorização do MASTER', () => {
    for (const [f, sql] of [[MIGRATION, mig], [ROLLBACK, rb]] as const) {
      expect(sql, f).toMatch(/NÃO APLICAR/);
      expect(sql, f).toMatch(/NÃO APLICAD[AO] EM NENHUM AMBIENTE/);
      expect(sql, f).toMatch(/autorização .*MASTER/i);
    }
  });

  it('ambos são transacionais', () => {
    for (const c of [migCode, rbCode]) {
      expect(c).toMatch(/^\s*BEGIN;/m);
      expect(c).toMatch(/^\s*COMMIT;/m);
    }
  });

  it('README lista a migration depois da correção das funções de identidade', () => {
    const readme = read(PREPARED_DIR, 'README.md');
    const idIdx = readme.indexOf('20261007091000_fix_identity_functions_by_id.sql');
    const newIdx = readme.indexOf(MIGRATION);
    expect(idIdx).toBeGreaterThan(-1);
    expect(newIdx).toBeGreaterThan(idIdx);
  });
});

describe('Migration de segurança RLS User/Tenant — conteúdo', () => {
  it('verifica premissas (dono postgres, sem FORCE, funções SECURITY DEFINER) ANTES de qualquer alteração', () => {
    const guard = migCode.indexOf("v_owner <> 'postgres'");
    expect(guard).toBeGreaterThan(-1);
    expect(migCode).toMatch(/relforcerowsecurity/);
    expect(migCode).toMatch(/prosecdef = false/);
    expect(migCode.match(/RAISE EXCEPTION/g)!.length).toBeGreaterThanOrEqual(4);
    expect(guard).toBeLessThan(migCode.indexOf('ENABLE ROW LEVEL SECURITY'));
    expect(guard).toBeLessThan(migCode.indexOf('REVOKE ALL'));
  });

  it('ativa RLS em User e Tenant, sem FORCE', () => {
    expect(migCode).toMatch(/ALTER TABLE public\."User" ENABLE ROW LEVEL SECURITY;/);
    expect(migCode).toMatch(/ALTER TABLE public\."Tenant" ENABLE ROW LEVEL SECURITY;/);
    // A guarda cita FORCE na mensagem de erro; proíbe-se apenas o comando.
    expect(migCode).not.toMatch(/ALTER\s+TABLE[^;]*FORCE\s+ROW\s+LEVEL\s+SECURITY/i);
  });

  it('revoga só de PUBLIC, anon e authenticated; não concede nada; não toca postgres/service_role', () => {
    expect(migCode).toMatch(/REVOKE ALL ON TABLE public\."User" FROM PUBLIC, anon, authenticated;/);
    expect(migCode).toMatch(/REVOKE ALL ON TABLE public\."Tenant" FROM PUBLIC, anon, authenticated;/);
    expect(migCode).not.toMatch(/\bGRANT\b/);
    for (const line of migCode.split('\n').filter((l) => /REVOKE/.test(l))) {
      expect(line).not.toMatch(/service_role|postgres/);
    }
  });

  it('cria policies de negação explícitas e idempotentes para anon/authenticated', () => {
    for (const [table, policy] of [['User', 'rls_user_deny_external'], ['Tenant', 'rls_tenant_deny_external']]) {
      expect(migCode).toMatch(new RegExp(`tablename = '${table}'\\s+AND policyname = '${policy}'`));
      expect(migCode).toMatch(new RegExp(`CREATE POLICY ${policy}\\s+ON public\\."${table}"\\s+FOR ALL\\s+TO anon, authenticated\\s+USING \\(false\\)\\s+WITH CHECK \\(false\\);`));
    }
    expect(migCode).toMatch(/IF NOT EXISTS \(\s*SELECT 1 FROM pg_policies/);
  });

  it('fixa o search_path da função de trigger que existe na migration histórica (nome exato)', () => {
    expect(read(APPLIED_DIR, HISTORICAL)).toMatch(new RegExp(`FUNCTION public\\.${FN}\\(\\)`));
    expect(migCode).toMatch(new RegExp(`ALTER FUNCTION public\\.${FN}\\(\\)\\s+SET search_path = pg_catalog, public;`));
    expect(migCode).toMatch(new RegExp(`to_regprocedure\\('public\\.${FN}\\(\\)'\\)`));
  });

  it('não altera estrutura nem dados (sem DROP/TRUNCATE/DELETE/CASCADE/colunas)', () => {
    expect(migCode).not.toMatch(/\b(DROP|TRUNCATE|DELETE|CASCADE|INSERT|UPDATE)\b/);
    expect(migCode).not.toMatch(/ALTER TABLE[^;]*\b(ADD|DROP|ALTER) COLUMN\b/);
  });
});

describe('Rollback não destrutivo', () => {
  it('remove as policies de forma idempotente', () => {
    expect(rbCode).toMatch(/IF EXISTS \(\s*SELECT 1 FROM pg_policies/);
    expect(rbCode).toMatch(/DROP POLICY rls_user_deny_external ON public\."User";/);
    expect(rbCode).toMatch(/DROP POLICY rls_tenant_deny_external ON public\."Tenant";/);
  });

  it('desativa RLS e restaura o search_path padrão da função', () => {
    expect(rbCode).toMatch(/ALTER TABLE public\."User" DISABLE ROW LEVEL SECURITY;/);
    expect(rbCode).toMatch(/ALTER TABLE public\."Tenant" DISABLE ROW LEVEL SECURITY;/);
    expect(rbCode).toMatch(new RegExp(`ALTER FUNCTION public\\.${FN}\\(\\)\\s+RESET search_path;`));
  });

  it('não reconcede privilégios a papéis externos e documenta o motivo', () => {
    expect(rbCode).not.toMatch(/\bGRANT\b/);
    expect(rb).toMatch(/NÃO devolve privilégios a PUBLIC\/anon\/authenticated/);
  });

  it('não usa DROP TABLE, CASCADE, DELETE ou TRUNCATE', () => {
    expect(rbCode).not.toMatch(/DROP TABLE|\bCASCADE\b|\bDELETE\b|\bTRUNCATE\b/);
  });
});

describe('Premissa no código da aplicação', () => {
  it('nenhum arquivo de src acessa "User" ou "Tenant" pela API REST do Supabase (supabase-js)', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full);
        else if (/\.(ts|tsx)$/.test(e.name) && /\.from\(\s*['"](User|Tenant)['"]/.test(fs.readFileSync(full, 'utf8'))) offenders.push(full);
      }
    };
    walk(path.join(ROOT, 'src'));
    expect(offenders).toEqual([]);
  });
});
