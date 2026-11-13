#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const distBundle = path.join(repoRoot, 'dist', 'index.js');
if (!fs.existsSync(distBundle)) {
  console.error('[connector-perf] dist/index.js não encontrado. Execute `npm run build` antes.');
  process.exit(1);
}

const rawBytes = fs.statSync(distBundle).size;
const gzBytes = zlib.gzipSync(fs.readFileSync(distBundle), { level: 9 }).length;
const LIMIT_BYTES = 2.5 * 1024 * 1024;
const passed = gzBytes > 0 && gzBytes < LIMIT_BYTES;

const report = {
  repo: 'fiorix-connector',
  measuredAt: new Date().toISOString(),
  bundlePath: 'dist/index.js',
  rawKb: Number((rawBytes / 1024).toFixed(1)),
  gzipKb: Number((gzBytes / 1024).toFixed(1)),
  gzipMb: Number((gzBytes / (1024 * 1024)).toFixed(3)),
  limitMb: 2.5,
  status: passed ? 'PASS' : 'FAIL',
};

const outPath = path.join(
  process.env.RUNNER_TEMP || os.tmpdir(),
  'fiorix-connector-perf-baseline.json',
);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));

const stepSummary = process.env.GITHUB_STEP_SUMMARY;
if (stepSummary) {
  fs.appendFileSync(
    stepSummary,
    `### FIORIX Connector — Bundle\n- \`dist/index.js\`: ${report.rawKb} KB bruto / ${report.gzipKb} KB gzip (${report.status})\n`,
    'utf8',
  );
}

if (!passed) {
  console.error('[connector-perf] FALHA: bundle gzip ultrapassou 2.5 MB.');
  process.exit(1);
}

