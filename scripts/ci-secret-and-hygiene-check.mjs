#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.json', '.yml', '.yaml', '.sql', '.ps1', '.md', '.txt',
]);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'logs', 'data']);

const SECRET_RULES = [
  {
    name: 'Supabase Secret Key',
    regex: new RegExp(['s', 'b', '_', 's', 'e', 'c', 'r', 'e', 't', '_', '[A-Za-z0-9_-]{12,}'].join(''), 'g'),
  },
  {
    name: 'Private Key Block',
    regex: new RegExp(['-----BEGIN ', '(?:RSA |EC |OPENSSH )?', 'PRIVATE KEY-----'].join(''), 'g'),
  },
  {
    name: 'AWS Access Key',
    regex: new RegExp(['\\bA', 'KIA', '[0-9A-Z]{16}\\b'].join(''), 'g'),
  },
  {
    name: 'GitHub PAT',
    regex: new RegExp(['\\bg', 'hp_', '[A-Za-z0-9]{28,}\\b'].join(''), 'g'),
  },
  {
    name: 'Slack Bot Token',
    regex: new RegExp(['\\bxo', 'xb-', '[0-9A-Za-z-]{20,}\\b'].join(''), 'g'),
  },
];

const findings = [];

function scanFileContent(displayName, fullPath) {
  let content;
  try {
    content = fs.readFileSync(fullPath, 'utf8');
  } catch {
    return;
  }

  for (const rule of SECRET_RULES) {
    rule.regex.lastIndex = 0;
    if (rule.regex.test(content)) {
      findings.push(
        `[SECRET] ${rule.name} detectado em ${displayName} (valor ocultado nos logs)`,
      );
    }
  }
}

try {
  const trackedRaw = execSync('git ls-files', { cwd: repoRoot, encoding: 'utf8' });
  for (const rel of trackedRaw.split(/\r?\n/).filter(Boolean)) {
    const base = path.basename(rel);
    if (base.startsWith('.env') && !base.endsWith('.example')) {
      findings.push(`[TRACKED_ENV] Arquivo sensível versionado no Git: ${rel}`);
    }
  }
} catch {
  // Ignore se fora de worktree Git
}

function walkTree(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, full).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      walkTree(full);
      continue;
    }
    if (!entry.isFile()) continue;

    if (/\s*\(\d+\)(\..+)?$/.test(entry.name)) {
      findings.push(`[DUPLICATE_FILE] Arquivo duplicado detectado: ${rel}`);
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (!TEXT_EXTS.has(ext)) continue;
    if (rel === 'scripts/ci-secret-and-hygiene-check.mjs') continue;

    scanFileContent(rel, full);
  }
}

walkTree(repoRoot);

const workflowsDir = path.join(repoRoot, '.github', 'workflows');
if (fs.existsSync(workflowsDir)) {
  for (const file of fs.readdirSync(workflowsDir)) {
    if (!file.endsWith('.yml') && !file.endsWith('.yaml')) continue;
    const rel = `.github/workflows/${file}`;
    const yml = fs.readFileSync(path.join(workflowsDir, file), 'utf8');

    if (/\bpull_request_target\b/.test(yml)) {
      findings.push(`[WORKFLOW] Evento inseguro pull_request_target proibido em ${rel}`);
    }
    if (/write-all/.test(yml)) {
      findings.push(`[WORKFLOW] Permissão ampla write-all proibida em ${rel}`);
    }
    if (!/permissions:\s*\r?\n\s+contents:\s*read\b/.test(yml)) {
      findings.push(`[WORKFLOW] Permissão mínima contents: read ausente em ${rel}`);
    }

    const usesMatches = [...yml.matchAll(/uses:\s*([A-Za-z0-9._-]+\/[A-Za-z0-9._/-]+)@([^\s#]+)/g)];
    for (const m of usesMatches) {
      if (!/^[0-9a-f]{40}$/.test(m[2])) {
        findings.push(
          `[WORKFLOW] Action externa sem SHA de 40 caracteres em ${rel}: ${m[1]}@${m[2]}`,
        );
      }
    }
  }
}

if (findings.length > 0) {
  console.error(`[ci-hygiene] Falhou com ${findings.length} ocorrência(s):`);
  for (const f of findings) console.error(` - ${f}`);
  process.exit(1);
}

console.log('[ci-hygiene] OK: nenhum segredo, arquivo duplicado, .env rastreado ou workflow sem SHA-40 encontrado.');

