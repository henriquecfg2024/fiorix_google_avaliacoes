import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    connector: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/lib/audit', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/alerts/alert-dispatcher', () => ({
  dispatchAlert: vi.fn().mockResolvedValue(undefined),
}));

import {
  generateRawEnrollmentToken,
  hashEnrollmentToken,
  sanitizeCloudRemoteConfig,
  isCursorStrictlyNewer,
  getLatestReleaseManifest,
  getReleaseArtifactDir,
} from '@/lib/connector/ha-manager';
import * as connectorAuthModule from '@/lib/connectorAuth';
import { GET as getReleaseRoute } from '@/app/api/v1/connector/release/route';
import { GET as getInstallPs1Route } from '@/app/api/v1/connector/install.ps1/route';

describe('FIORIX Multi-Tenant SaaS Connector HA, Provisioning & Release', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('gera tokens de pareamento de alta entropia e persiste apenas SHA-256', () => {
    const t1 = generateRawEnrollmentToken();
    const t2 = generateRawEnrollmentToken();

    expect(t1).toMatch(/^fx_enroll_[a-f0-9]{48}$/);
    expect(t2).toMatch(/^fx_enroll_[a-f0-9]{48}$/);
    expect(t1).not.toBe(t2);

    const h1 = hashEnrollmentToken(t1);
    expect(h1).toHaveLength(64);
    expect(h1).not.toContain('fx_enroll_');
    expect(hashEnrollmentToken(`  ${t1}  `)).toBe(h1);
  });

  it('bloqueia senhas e segredos na configuração remota armazenada na nuvem', () => {
    const sanitized = sanitizeCloudRemoteConfig({
      role: 'PRIMARY',
      priority: 1,
      lanUrl: 'http://srvfiles:8765///',
      sqlHost: '192.168.0.10',
      sqlDatabase: 'WEBRI',
      sqlPassword: 'NUNCA_SALVAR_NA_NUVEM',
      connectorSecret: 'fiorix_conn_secret',
      apiKey: 'secret-key',
      documentRoots: [
        { id: 'IMAGENS', label: 'Acervo Imagens', path: 'D:\\IMAGENS' },
        { id: 'invalido com espaco', path: 'C:\\Temp' },
      ],
    });

    expect((sanitized as any).sqlPassword).toBeUndefined();
    expect((sanitized as any).connectorSecret).toBeUndefined();
    expect((sanitized as any).apiKey).toBeUndefined();
    expect(sanitized.role).toBe('PRIMARY');
    expect(sanitized.lanUrl).toBe('http://srvfiles:8765');
    expect(sanitized.sqlHost).toBe('192.168.0.10');
    expect(sanitized.sqlDatabase).toBe('WEBRI');
    expect(sanitized.documentRoots).toEqual([
      { id: 'imagens', label: 'Acervo Imagens', path: 'D:\\IMAGENS' },
    ]);
  });

  it('compara cursores numéricos e ISO datetime sem regressão no failover HCFG-001 <-> SRVFILES', () => {
    // Cursores numéricos ('100500' > '99999' mesmo que '1' < '9' lexicograficamente!)
    expect(isCursorStrictlyNewer('bi', '100500', '0', '99999', '0')).toBe(true);
    expect(isCursorStrictlyNewer('bi', '99999', '0', '100500', '0')).toBe(false);
    expect(isCursorStrictlyNewer('retornos', '500', '12', '500', '10')).toBe(true);

    // Cursores ISO datetime
    expect(
      isCursorStrictlyNewer(
        'produtividade',
        '2026-11-04T12:30:00.000Z',
        null,
        '2026-11-04T11:00:00.000Z',
        null,
      ),
    ).toBe(true);
    expect(
      isCursorStrictlyNewer(
        'produtividade',
        '2026-11-04T10:00:00.000Z',
        null,
        '2026-11-04T11:00:00.000Z',
        null,
      ),
    ).toBe(false);
  });

  it('valida integridade SHA-256 real dos artefatos compilados de release do Connector', () => {
    const manifest = getLatestReleaseManifest();
    expect(manifest).not.toBeNull();
    expect(manifest!.version).toMatch(/^v\d+\.\d+\.\d+$/);

    const dir = getReleaseArtifactDir();
    const bundleRaw = zlib.gunzipSync(fs.readFileSync(path.join(dir, 'index.js.gz')));
    const bundleSha = crypto.createHash('sha256').update(bundleRaw).digest('hex');
    expect(bundleSha).toBe(manifest!.bundle.sha256);
    expect(bundleRaw.length).toBe(manifest!.bundle.sizeBytes);

    expect(manifest!.nssm).not.toBeNull();
    const nssmRaw = zlib.gunzipSync(path.join(dir, 'nssm.exe.gz') ? fs.readFileSync(path.join(dir, 'nssm.exe.gz')) : Buffer.alloc(0));
    expect(crypto.createHash('sha256').update(nssmRaw).digest('hex')).toBe(manifest!.nssm!.sha256);

    expect(manifest!.rustCli).not.toBeNull();
    const cliRaw = zlib.gunzipSync(fs.readFileSync(path.join(dir, 'fiorix-gd-cli.exe.gz')));
    expect(crypto.createHash('sha256').update(cliRaw).digest('hex')).toBe(manifest!.rustCli!.sha256);
  });

  it('protege /api/v1/connector/release contra acesso não autenticado e entrega bundle assinado quando autenticado', async () => {
    const unauthReq = new NextRequest('https://fiorix.app/api/v1/connector/release?asset=bundle');
    const unauthRes = await getReleaseRoute(unauthReq);
    expect(unauthRes.status).toBe(401);

    vi.spyOn(connectorAuthModule, 'authenticateConnector').mockResolvedValue({
      success: true,
      connector: { id: 'conn_srvfiles', tenantId: 't1', enabled: true } as any,
      tenant: { id: 't1', name: '7º RI SP' } as any,
    });

    const authReq = new NextRequest('https://fiorix.app/api/v1/connector/release?asset=bundle', {
      headers: {
        authorization: 'Bearer fiorix_conn_valid_secret',
        'x-connector-id': 'conn_srvfiles',
      },
    });
    const authRes = await getReleaseRoute(authReq);
    expect(authRes.status).toBe(200);

    const manifest = getLatestReleaseManifest()!;
    expect(authRes.headers.get('x-checksum-sha256')).toBe(manifest.bundle.sha256);
    expect(authRes.headers.get('x-release-version')).toBe(manifest.version);

    const downloadedBytes = Buffer.from(await authRes.arrayBuffer());
    const downloadedHash = crypto.createHash('sha256').update(downloadedBytes).digest('hex');
    expect(downloadedHash).toBe(manifest.bundle.sha256);
  });

  it('gera script PowerShell portátil livre de erros de sintaxe AST no Windows PowerShell 5.1 e launcher .BAT válido', async () => {
    const psReq = new NextRequest('https://fiorix.app/api/v1/connector/install.ps1');
    const psRes = await getInstallPs1Route(psReq);
    expect(psRes.status).toBe(200);
    const psContent = await psRes.text();
    expect(psContent).toContain('function Install-FiorixConnector');
    expect(psContent).toContain('*S-1-5-18:(F)');
    expect(psContent).toContain('Get-FileHash');

    if (process.platform === 'win32') {
      const tmpPs1 = path.join(process.env.TEMP || process.cwd(), `fiorix-ast-check-${Date.now()}.ps1`);
      fs.writeFileSync(tmpPs1, psContent, 'utf8');
      try {
        const parseOut = execFileSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `$tokens = $null; $errors = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('${tmpPs1.replace(/'/g, "''")}', [ref]$tokens, [ref]$errors); if ($errors.Count -gt 0) { Write-Error ($errors | Out-String); exit 1 } else { Write-Output 'AST_OK' }`,
          ],
          { encoding: 'utf8' },
        );
        expect(parseOut.trim()).toBe('AST_OK');
      } finally {
        fs.unlinkSync(tmpPs1);
      }
    }

    const token = generateRawEnrollmentToken();
    const batReq = new NextRequest(
      `https://fiorix.app/api/v1/connector/install.ps1?format=bat&token=${token}`,
    );
    const batRes = await getInstallPs1Route(batReq);
    expect(batRes.status).toBe(200);
    expect(batRes.headers.get('content-disposition')).toContain('Instalar-FIORIX-Connector.bat');
    const batText = await batRes.text();
    expect(batText).toContain(token);
    expect(batText).toContain('Install-FiorixConnector');

    const actReq = new NextRequest(
      'https://fiorix.app/api/v1/connector/install.ps1?format=activate-bat',
    );
    const actRes = await getInstallPs1Route(actReq);
    expect(actRes.status).toBe(200);
    expect(actRes.headers.get('content-disposition')).toContain('Ativar-FIORIX-v2.6.2.bat');
    const actBat = await actRes.text();
    const encMatch = actBat.match(/-EncodedCommand\s+([A-Za-z0-9+/=]+)/);
    expect(encMatch).not.toBeNull();
    const decodedPs = Buffer.from(encMatch![1], 'base64').toString('utf16le');
    expect(decodedPs).toContain('Update-ConnectorFolder');

    if (process.platform === 'win32') {
      const tmpActPs1 = path.join(
        process.env.TEMP || process.cwd(),
        `fiorix-act-ast-${Date.now()}.ps1`,
      );
      fs.writeFileSync(tmpActPs1, decodedPs, 'utf8');
      try {
        const parseOut = execFileSync(
          'powershell.exe',
          [
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `$tokens = $null; $errors = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('${tmpActPs1.replace(/'/g, "''")}', [ref]$tokens, [ref]$errors); if ($errors.Count -gt 0) { Write-Error ($errors | Out-String); exit 1 } else { Write-Output 'AST_OK' }`,
          ],
          { encoding: 'utf8' },
        );
        expect(parseOut.trim()).toBe('AST_OK');
      } finally {
        fs.unlinkSync(tmpActPs1);
      }
    }
  });
});

