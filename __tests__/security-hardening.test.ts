import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkLoginLockout,
  recordFailedLogin,
  clearLoginAttempts,
  MAX_LOGIN_ATTEMPTS,
  DUMMY_BCRYPT_HASH,
} from '@/lib/security/login-lockout';
import fs from 'fs';
import path from 'path';

describe('FIORIX — Hardening de Segurança: Autenticação & Brute Force Lockout', () => {
  const testEmail = 'pentest_attack_simulation@cartorio.local';

  beforeEach(async () => {
    await clearLoginAttempts(testEmail);
  });

  it('permite tentativas iniciais sem bloqueio', async () => {
    const status1 = await checkLoginLockout(testEmail);
    expect(status1.isLocked).toBe(false);

    await recordFailedLogin(testEmail);
    await recordFailedLogin(testEmail);
    await recordFailedLogin(testEmail);
    await recordFailedLogin(testEmail);

    const status4 = await checkLoginLockout(testEmail);
    expect(status4.isLocked).toBe(false);
  });

  it('bloqueia temporariamente após 5 tentativas consecutivas incorretas', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedLogin(testEmail);
    }

    const status5 = await checkLoginLockout(testEmail);
    expect(status5.isLocked).toBe(true);
    expect(status5.remainingMinutes).toBeGreaterThanOrEqual(1);
    expect(status5.remainingMinutes).toBeLessThanOrEqual(15);
  });

  it('possui hash dummy precomputado de custo 10 para nivelar tempo de resposta', () => {
    expect(DUMMY_BCRYPT_HASH).toBeDefined();
    expect(DUMMY_BCRYPT_HASH.startsWith('$2a$10$')).toBe(true);
    expect(MAX_LOGIN_ATTEMPTS).toBe(5);
  });

  it('reseta o bloqueio após autenticação bem-sucedida ou limpeza', async () => {
    for (let i = 0; i < 5; i++) {
      await recordFailedLogin(testEmail);
    }
    expect((await checkLoginLockout(testEmail)).isLocked).toBe(true);

    await clearLoginAttempts(testEmail);
    expect((await checkLoginLockout(testEmail)).isLocked).toBe(false);
  });
});

describe('FIORIX — Hardening de Segurança: Validação de Magic Bytes em PDFs', () => {
  function isValidPdfBuffer(buffer: Buffer): boolean {
    return buffer.length >= 5 && buffer.toString('utf-8', 0, 5) === '%PDF-';
  }

  it('aprova buffers legítimos que iniciam com o cabeçalho %PDF-', () => {
    const validPdf = Buffer.from('%PDF-1.7\n%Fake PDF binary content...');
    expect(isValidPdfBuffer(validPdf)).toBe(true);
  });

  it('rejeita arquivos HTML, executáveis ou scripts disfarçados de PDF', () => {
    const fakeHtml = Buffer.from('<!DOCTYPE html><html><script>alert(1)</script></html>');
    const fakeZip = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00]); // PK zip header
    const fakeExe = Buffer.from([0x4D, 0x5A, 0x90, 0x00]); // MZ exe header
    const emptyBuf = Buffer.from([]);

    expect(isValidPdfBuffer(fakeHtml)).toBe(false);
    expect(isValidPdfBuffer(fakeZip)).toBe(false);
    expect(isValidPdfBuffer(fakeExe)).toBe(false);
    expect(isValidPdfBuffer(emptyBuf)).toBe(false);
  });
});

describe('FIORIX — Hardening de Segurança: Isolamento Estrito Multi-Tenant', () => {
  it('garante que a API de trajetória não possui fallbacks permissivos (OR tenant_id IS NULL)', () => {
    const routeFilePath = path.join(
      process.cwd(),
      'src',
      'app',
      'api',
      'trajetoria',
      '[protocolo]',
      'route.ts'
    );
    const content = fs.readFileSync(routeFilePath, 'utf-8');

    // Confirma que a cláusula permissiva legada foi totalmente removida
    expect(content).not.toContain('OR tenant_id IS NULL');

    // Confirma que as 3 queries analíticas filtram estritamente por tenant_id = $2
    expect(content).toContain('WHERE protocolo = $1 AND tenant_id = $2');
    expect(content).toContain('WHERE "Protocolo" = $1 AND tenant_id = $2');
  });
});
