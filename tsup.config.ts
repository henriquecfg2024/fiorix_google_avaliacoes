import { defineConfig } from 'tsup';
import fs from 'node:fs';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  target: 'node22',
  platform: 'node',
  noExternal: [/.*/],
  banner: {
    js: [
      'import { createRequire as __fiorixCreateRequire } from "node:module";',
      'import { fileURLToPath as __fiorixFileURLToPath } from "node:url";',
      'import { dirname as __fiorixDirname } from "node:path";',
      'const require = __fiorixCreateRequire(import.meta.url);',
      'const __filename = __fiorixFileURLToPath(import.meta.url);',
      'const __dirname = __fiorixDirname(__filename);',
    ].join(' '),
  },
  async onSuccess() {
    const distPath = 'dist/index.js';
    if (fs.existsSync(distPath)) {
      let content = fs.readFileSync(distPath, 'utf8');
      content = content.replace(/from ["']sqlite["']/g, 'from "node:sqlite"');
      content = content.replace(/import\(["']sqlite["']\)/g, 'import("node:sqlite")');
      fs.writeFileSync(distPath, content, 'utf8');
    }
  },
});
