#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const dbUrlRaw = process.env.FIORIX_EPHEMERAL_PG_URL?.trim();
if (!dbUrlRaw) {
  console.error(
    '[verify-postgres-rls-live] ERRO: defina FIORIX_EPHEMERAL_PG_URL apontando para um PostgreSQL efêmero local (localhost/127.0.0.1).',
  );
  process.exit(2);
}

let parsedUrl;
try {
  parsedUrl = new URL(dbUrlRaw);
} catch {
  console.error('[verify-postgres-rls-live] ERRO: FIORIX_EPHEMERAL_PG_URL inválida.');
  process.exit(2);
}

const ALLOWED_LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);
const host = parsedUrl.hostname.toLowerCase();

if (!ALLOWED_LOCAL_HOSTS.has(host)) {
  console.error(
    `[verify-postgres-rls-live] BLOQUEADO: host remoto "${host}" recusado. Este script executa apenas em banco efêmero local (localhost/127.0.0.1).`,
  );
  process.exit(2);
}

const sqlFiles = [
  path.join(__dirname, 'sql/01_ephemeral_supabase_bootstrap.sql'),
  path.join(repoRoot, 'supabase/migrations/20261113000000_lockdown_public_schema_and_rls.sql'),
  path.join(__dirname, 'sql/02_ephemeral_rls_assertions.sql'),
];

for (const file of sqlFiles) {
  if (!fs.existsSync(file)) {
    console.error(`[verify-postgres-rls-live] Arquivo SQL ausente: ${file}`);
    process.exit(1);
  }
}

for (const file of sqlFiles) {
  const rel = path.relative(repoRoot, file).replace(/\\/g, '/');
  console.log(`[verify-postgres-rls-live] Executando ${rel}...`);
  const res = spawnSync(
    'psql',
    [dbUrlRaw, '-v', 'ON_ERROR_STOP=1', '-f', file],
    { encoding: 'utf8' },
  );

  if (res.error) {
    console.error(
      `[verify-postgres-rls-live] Falha ao invocar psql para ${rel}: ${res.error.message}`,
    );
    process.exit(1);
  }

  if (res.status !== 0) {
    console.error(`[verify-postgres-rls-live] Falha SQL em ${rel} (exit=${res.status}):`);
    if (res.stderr) console.error(res.stderr.trim());
    process.exit(res.status || 1);
  }
}

console.log('[verify-postgres-rls-live] OK: bootstrap, migração de lockdown e asserções RLS validados com isolamento em PostgreSQL efêmero.');

