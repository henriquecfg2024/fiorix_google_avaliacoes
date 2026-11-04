import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const connectorRoot = path.resolve(__dirname, '..');
const saasTargetDir = path.resolve(connectorRoot, '..', 'fiorix', 'src', 'lib', 'connector', 'release-artifact');

const versionFile = fs.readFileSync(path.join(connectorRoot, 'src', 'config', 'version.ts'), 'utf8');
const versionMatch = versionFile.match(/AGENT_VERSION\s*=\s*['"]([^'"]+)['"]/);
if (!versionMatch) {
  throw new Error('Não foi possível extrair AGENT_VERSION de src/config/version.ts');
}
const version = versionMatch[1];

function sha256Hex(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const bundlePath = path.join(connectorRoot, 'dist', 'index.js');
if (!fs.existsSync(bundlePath)) {
  throw new Error('dist/index.js não encontrado. Execute npm run build primeiro.');
}

const bundleRaw = fs.readFileSync(bundlePath);
const bundleSha256 = sha256Hex(bundleRaw);
const bundleGz = zlib.gzipSync(bundleRaw, { level: 9 });

const nssmPath = path.join(connectorRoot, 'tools', 'nssm', 'nssm.exe');
let nssmMeta = null;
if (fs.existsSync(nssmPath)) {
  const nssmRaw = fs.readFileSync(nssmPath);
  const nssmGz = zlib.gzipSync(nssmRaw, { level: 9 });
  fs.mkdirSync(saasTargetDir, { recursive: true });
  fs.writeFileSync(path.join(saasTargetDir, 'nssm.exe.gz'), nssmGz);
  nssmMeta = {
    sha256: sha256Hex(nssmRaw),
    sizeBytes: nssmRaw.length,
    gzipBytes: nssmGz.length,
  };
}

const cliCandidates = [
  process.env.FIORIX_GD_CLI_PATH,
  path.join(connectorRoot, 'bin', 'fiorix-gd-cli.exe'),
  'B:\\henrique-dev\\app-biblioteca\\src-tauri\\target\\release\\fiorix-gd-cli.exe',
  'B:\\henrique-dev\\app-biblioteca\\src-tauri\\target\\debug\\fiorix-gd-cli.exe',
].filter(Boolean);

let rustCliMeta = null;
for (const candidate of cliCandidates) {
  if (candidate && fs.existsSync(candidate)) {
    const cliRaw = fs.readFileSync(candidate);
    const cliGz = zlib.gzipSync(cliRaw, { level: 9 });
    fs.mkdirSync(saasTargetDir, { recursive: true });
    fs.writeFileSync(path.join(saasTargetDir, 'fiorix-gd-cli.exe.gz'), cliGz);
    rustCliMeta = {
      sha256: sha256Hex(cliRaw),
      sizeBytes: cliRaw.length,
      gzipBytes: cliGz.length,
    };
    break;
  }
}

fs.mkdirSync(saasTargetDir, { recursive: true });
fs.writeFileSync(path.join(saasTargetDir, 'index.js.gz'), bundleGz);

const manifest = {
  version,
  publishedAt: new Date().toISOString(),
  bundle: {
    fileName: 'index.js',
    sha256: bundleSha256,
    sizeBytes: bundleRaw.length,
    gzipBytes: bundleGz.length,
  },
  nssm: nssmMeta,
  rustCli: rustCliMeta,
};

fs.writeFileSync(path.join(saasTargetDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(`[Release Builder] Pacote FIORIX Connector ${version} gerado com sucesso!`);
console.log(`  -> Bundle SHA-256: ${bundleSha256}`);
console.log(`  -> Bundle Size:    ${Math.round(bundleRaw.length / 1024)} KB (${Math.round(bundleGz.length / 1024)} KB gzip)`);
if (nssmMeta) console.log(`  -> NSSM Size:      ${Math.round(nssmMeta.sizeBytes / 1024)} KB (${Math.round(nssmMeta.gzipBytes / 1024)} KB gzip)`);
if (rustCliMeta) console.log(`  -> Rust CLI Size:  ${Math.round(rustCliMeta.sizeBytes / 1024)} KB (${Math.round(rustCliMeta.gzipBytes / 1024)} KB gzip)`);

