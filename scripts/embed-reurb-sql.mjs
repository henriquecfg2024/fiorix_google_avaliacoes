import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const connectorRoot = path.resolve(__dirname, '..');
const sqlPath = path.join(connectorRoot, 'sql', 'reurb_onr_importar_em_lote.sql');
const outPath = path.join(connectorRoot, 'src', 'db', 'reurb-sql-embedded.ts');

if (!fs.existsSync(sqlPath)) {
  throw new Error(`Arquivo SQL não encontrado para embutir no bundle: ${sqlPath}`);
}

const sqlText = fs.readFileSync(sqlPath, 'utf8').replace(/^\uFEFF/, '');
const outContent = [
  '// Arquivo gerado automaticamente por scripts/embed-reurb-sql.mjs.',
  '// Fonte canônica: sql/reurb_onr_importar_em_lote.sql (estritamente somente leitura).',
  `export const EMBEDDED_REURB_SQL: string = ${JSON.stringify(sqlText)};`,
  '',
].join('\n');

fs.writeFileSync(outPath, outContent, 'utf8');
console.log(
  `[embed-reurb-sql] Script REURB embutido com sucesso (${Math.round(sqlText.length / 1024)} KB) -> ${path.relative(connectorRoot, outPath)}`
);
