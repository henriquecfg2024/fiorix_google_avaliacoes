#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import process from 'node:process';

const WATCHED_PATHS = [
  'src',
  'public',
  'prisma',
  'scripts/vercel-ignore-build.mjs',
  'next.config.mjs',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tailwind.config.ts',
  'postcss.config.mjs',
  'vercel.json',
];

function log(message) {
  console.log(`[vercel-ignore-build] ${message}`);
}

function runGit(args) {
  const result = spawnSync('git', args, { stdio: 'ignore' });
  return typeof result.status === 'number' ? result.status : 1;
}

const commitRef = process.env.VERCEL_GIT_COMMIT_REF || '';
if (commitRef === 'connector-main') {
  log('Branch connector-main não requer build web na Vercel (exit 0 = skip).');
  process.exit(0);
}

const vercelEnv = process.env.VERCEL_ENV || '';
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA || '';
const previousSha = process.env.VERCEL_GIT_PREVIOUS_SHA || '';

if (
  vercelEnv !== 'production' &&
  commitSha &&
  runGit(['merge-base', '--is-ancestor', commitSha, 'origin/main']) === 0
) {
  log('Preview de commit já presente em origin/main; evitando build duplicado (exit 0 = skip).');
  process.exit(0);
}

let baseRef = '';
if (previousSha) {
  if (commitSha && previousSha === commitSha) {
    log('Redeploy manual do mesmo commit detectado; executando build (exit 1 = build).');
    process.exit(1);
  }
  if (runGit(['cat-file', '-e', `${previousSha}^{commit}`]) !== 0) {
    log('SHA anterior indisponível no clone raso; executando build por segurança (exit 1 = build).');
    process.exit(1);
  }
  baseRef = previousSha;
} else {
  if (vercelEnv === 'production') {
    log('Sem VERCEL_GIT_PREVIOUS_SHA em produção; executando build (exit 1 = build).');
    process.exit(1);
  }
  if (runGit(['rev-parse', '--verify', 'HEAD^']) !== 0) {
    log('Sem commit pai disponível; executando build (exit 1 = build).');
    process.exit(1);
  }
  baseRef = 'HEAD^';
}

const diffStatus = runGit(['diff', '--quiet', baseRef, 'HEAD', '--', ...WATCHED_PATHS]);
if (diffStatus === 0) {
  log(`Nenhuma alteração relevante de runtime/build entre ${baseRef} e HEAD (exit 0 = skip).`);
  process.exit(0);
}

log(`Alterações relevantes detectadas entre ${baseRef} e HEAD; executando build (exit 1 = build).`);
process.exit(1);

