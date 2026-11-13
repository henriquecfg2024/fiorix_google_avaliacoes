import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { maskSecrets, redactLogString } from '../src/utils/logger.js';
import { computeBufferSha256, verifyBundleChecksum } from '../src/services/self-updater.js';

describe('Fase 4 — Segurança do Fiorix Connector (Logs, Segredos e Self-Updater)', () => {
  it('redige strings com Bearer token e credenciais em URLs sem expor o valor bruto', () => {
    const raw =
      'Falha proxy Authorization: Bearer conn_super_secret_98765 em https://proxyuser:proxypass@10.0.0.2:3128 e postgres://dbu:dbpass123@db.local:5432/fiorix';
    const redacted = redactLogString(raw);

    expect(redacted).toContain('Bearer ***MASKED***');
    expect(redacted).toContain('https://proxyuser:***MASKED***@10.0.0.2:3128');
    expect(redacted).toContain('postgres://dbu:***MASKED***@db.local:5432/fiorix');
    expect(redacted).not.toContain('conn_super_secret_98765');
    expect(redacted).not.toContain('proxypass');
    expect(redacted).not.toContain('dbpass123');
  });

  it('mascara chaves sensíveis, arrays e referências circulares no logger sem stack overflow', () => {
    const circular: Record<string, unknown> = {
      name: 'req-err',
      headers: {
        authorization: 'Bearer ultra-secret-header',
      },
      nested: {
        password: 'mssql-secret-password',
        cpf: '12345678900',
      },
      items: ['Authorization: Bearer inline-array-secret'],
    };
    circular.self = circular;

    const info: Record<string, unknown> = {
      level: 'error',
      message: 'Erro chamando https://srv:topsecret@api.local/sync com Bearer msg-secret-123',
      err: circular,
    };

    const formatter = maskSecrets();
    const out = formatter.transform(info as never) as Record<string, unknown>;

    expect(String(out.message)).not.toContain('topsecret');
    expect(String(out.message)).not.toContain('msg-secret-123');

    const serialized = JSON.stringify(out, (_k, v) => (v === out.err ? '[Circular]' : v));
    expect(serialized).not.toContain('ultra-secret-header');
    expect(serialized).not.toContain('mssql-secret-password');
    expect(serialized).not.toContain('12345678900');
    expect(serialized).not.toContain('inline-array-secret');
  });

  it('valida integridade de bundle no self-updater (verifyBundleChecksum com timingSafeEqual)', () => {
    const validBuf = Buffer.alloc(2048, 0x41);
    const digest = computeBufferSha256(validBuf);

    expect(verifyBundleChecksum(validBuf, digest)).toBe(true);
    expect(verifyBundleChecksum(validBuf, digest.toUpperCase())).toBe(true);

    // Rejeita buffer truncado (< 1024 bytes), hash adulterado ou byte alterado
    expect(verifyBundleChecksum(Buffer.alloc(512, 0x41), digest)).toBe(false);
    expect(verifyBundleChecksum(validBuf, '0'.repeat(64))).toBe(false);
    expect(verifyBundleChecksum(validBuf, 'not-a-sha256')).toBe(false);

    const tampered = Buffer.from(validBuf);
    tampered[2047] ^= 0xff;
    expect(verifyBundleChecksum(tampered, digest)).toBe(false);

    const src = fs.readFileSync(
      path.resolve(process.cwd(), 'src/services/self-updater.ts'),
      'utf8',
    );
    expect(src).toContain('timingSafeEqual');
  });
});
