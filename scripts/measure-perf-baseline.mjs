#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const CONNECTOR_BUNDLE_MAX_BYTES = 2.5 * 1024 * 1024;
const report = {
  repo: 'fiorix',
  measuredAt: new Date().toISOString(),
  connectorReleaseBundle: null,
  nextStaticChunks: null,
};

let hasBlockingFailure = false;

// 1. Orçamento bloqueante do artefato de release do conector (se presente)
const connectorCandidates = [
  'src/lib/connector/release-artifact/index.js.gz',
  'public/connector-releases/index.js.gz',
];
const matchedRelPath = connectorCandidates.find((relPath) =>
  fs.existsSync(path.join(repoRoot, relPath)),
);
const connectorGz = matchedRelPath ? path.join(repoRoot, matchedRelPath) : null;
if (connectorGz && matchedRelPath) {
  const bytes = fs.statSync(connectorGz).size;
  const mb = Number((bytes / (1024 * 1024)).toFixed(3));
  const passed = bytes > 0 && bytes < CONNECTOR_BUNDLE_MAX_BYTES;
  if (!passed) hasBlockingFailure = true;
  report.connectorReleaseBundle = {
    path: matchedRelPath,
    bytes,
    mb,
    limitMb: 2.5,
    status: passed ? 'PASS' : 'FAIL',
  };
} else {
  report.connectorReleaseBundle = {
    path: connectorCandidates[0],
    status: 'ABSENT_SKIPPED',
  };
}

// 2. Relatório informativo dos chunks gerados pelo `next build` (se `.next/static/chunks` existir)
const chunksDir = path.join(repoRoot, '.next', 'static', 'chunks');
if (fs.existsSync(chunksDir)) {
  const chunkFiles = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) {
        const size = fs.statSync(full).size;
        chunkFiles.push({
          file: path.relative(path.join(repoRoot, '.next'), full).replace(/\\/g, '/'),
          kb: Number((size / 1024).toFixed(1)),
          bytes: size,
        });
      }
    }
  };
  walk(chunksDir);
  chunkFiles.sort((a, b) => b.bytes - a.bytes);
  const totalBytes = chunkFiles.reduce((acc, c) => acc + c.bytes, 0);
  report.nextStaticChunks = {
    count: chunkFiles.length,
    totalKb: Number((totalBytes / 1024).toFixed(1)),
    largest5: chunkFiles.slice(0, 5),
    mode: 'informational',
  };
}

const outPath = path.join(os.tmpdir(), 'fiorix-perf-baseline.json');
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

console.log(`[perf-baseline] Relatório salvo em ${outPath}`);
console.log(JSON.stringify(report, null, 2));

const stepSummary = process.env.GITHUB_STEP_SUMMARY;
if (stepSummary) {
  const lines = [
    '### FIORIX — Linha de Base de Performance (Fase 4)',
    '',
    `- Connector Bundle (\`index.js.gz\`): ${report.connectorReleaseBundle?.mb ?? 'N/A'} MB (${report.connectorReleaseBundle?.status})`,
  ];
  if (report.nextStaticChunks) {
    lines.push(
      `- Chunks JS Next.js (\`.next/static/chunks\`): ${report.nextStaticChunks.count} arquivos, total ${report.nextStaticChunks.totalKb} KB (informativo)`,
    );
  }
  fs.appendFileSync(stepSummary, `${lines.join('\n')}\n`, 'utf8');
}

if (hasBlockingFailure) {
  console.error('[perf-baseline] FALHA BLOQUEANTE: orçamento de tamanho excedido.');
  process.exit(1);
}

