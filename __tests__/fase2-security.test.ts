import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AGENT_VERSION } from '../src/config/version';
import { resolveDocumentCliPath } from '../src/services/document-search';

describe('Fase 2 Security — Connector Hardening (MED-09 & v2.6.9)', () => {
  const originalDocCli = process.env.DOCUMENTAL_CLI_PATH;
  const originalGdCli = process.env.FIORIX_GD_CLI_PATH;

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalDocCli === undefined) delete process.env.DOCUMENTAL_CLI_PATH;
    else process.env.DOCUMENTAL_CLI_PATH = originalDocCli;

    if (originalGdCli === undefined) delete process.env.FIORIX_GD_CLI_PATH;
    else process.env.FIORIX_GD_CLI_PATH = originalGdCli;
  });

  it('atualiza AGENT_VERSION para v2.6.9+', () => {
    expect(AGENT_VERSION).toMatch(/^v2\.6\.(9|1\d)$/);
  });

  it('resolveDocumentCliPath resolve relativo ao diretório do conector e nunca referencia B:\\henrique-dev\\fiorix-gestao-documental', () => {
    delete process.env.DOCUMENTAL_CLI_PATH;
    delete process.env.FIORIX_GD_CLI_PATH;
    vi.spyOn(process, 'cwd').mockReturnValue('C:\\ProgramData\\Fiorix\\Connector');

    const resolved = resolveDocumentCliPath();
    expect(resolved).toBe(path.join('C:\\ProgramData\\Fiorix\\Connector', 'bin', 'fiorix-gd-cli.exe'));
    expect(resolved.toLowerCase()).not.toContain('henrique-dev');
    expect(resolved.toLowerCase()).not.toContain('fiorix-gestao-documental');
  });

  it('resolveDocumentCliPath respeita DOCUMENTAL_CLI_PATH quando configurado', () => {
    process.env.DOCUMENTAL_CLI_PATH = 'C:\\Fiorix\\Connector\\bin\\custom-gd-cli.exe';
    const resolved = resolveDocumentCliPath();
    expect(resolved).toBe(path.resolve('C:\\Fiorix\\Connector\\bin\\custom-gd-cli.exe'));
  });

  it('remove fallbacks de raiz inteira de disco (H:\\ e W:\\) e caminhos de desenvolvedor no código-fonte', () => {
    const searchSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/services/document-search.ts'),
      'utf8',
    );
    const workerSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/services/document-worker.ts'),
      'utf8',
    );

    expect(searchSrc.toLowerCase()).not.toContain('henrique-dev');
    expect(workerSrc).not.toMatch(/existsSync\(\s*['"]H:\\\\['"]\s*\)/i);
    expect(workerSrc).not.toMatch(/existsSync\(\s*['"]W:\\\\['"]\s*\)/i);
    expect(workerSrc).not.toMatch(/path:\s*['"]H:\\\\['"]/i);
    expect(workerSrc).not.toMatch(/path:\s*['"]W:\\\\['"]/i);
  });
});
