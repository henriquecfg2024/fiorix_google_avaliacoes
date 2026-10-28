import { defineConfig } from 'tsup';
import fs from 'node:fs';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  target: 'node22',
  platform: 'node',
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
