import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { generateSync } from 'otplib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireAuth = vi.fn();
const mockQueryRawUnsafe = vi.fn();
const mockExecuteRawUnsafe = vi.fn();
const mockConversaMembroFindFirst = vi.fn();
const mockMessagingPolicyFindUnique = vi.fn();
const mockCreateSignedUploadUrl = vi.fn();
const mockStorageUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockListBuckets = vi.fn();
const mockCreateBucket = vi.fn();
const mockCheckRateLimit = vi.fn();

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock('@/lib/mensagens/rate-limiter', () => ({
  checkRateLimit: (...args: any[]) => mockCheckRateLimit(...args),
}));

vi.mock('@/lib/audit', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: (...args: any[]) => mockQueryRawUnsafe(...args),
    $executeRawUnsafe: (...args: any[]) => mockExecuteRawUnsafe(...args),
    conversaMembro: {
      findFirst: (...args: any[]) => mockConversaMembroFindFirst(...args),
    },
    messagingPolicy: {
      findUnique: (...args: any[]) => mockMessagingPolicyFindUnique(...args),
    },
    messagingAuditLog: {
      create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
    },
  },
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      listBuckets: (...args: any[]) => mockListBuckets(...args),
      createBucket: (...args: any[]) => mockCreateBucket(...args),
      from: () => ({
        createSignedUploadUrl: (...args: any[]) => mockCreateSignedUploadUrl(...args),
        upload: (...args: any[]) => mockStorageUpload(...args),
        getPublicUrl: (...args: any[]) => mockGetPublicUrl(...args),
      }),
    },
  },
}));

import {
  decryptFieldSecret,
  encryptFieldSecret,
  isEncryptedFieldSecret,
  resolveDomainKeys,
} from '@/lib/security/field-crypto';
import { decryptToken, encryptToken } from '@/lib/crypto';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  isEncryptedTotpSecret,
  verifyTotpToken,
} from '@/lib/totp';
import { getAlertConfig, saveAlertConfig } from '@/lib/alerts/alert-storage';
import { validateAttachmentMetadata } from '@/lib/mensagens/security';
import {
  canUserUploadItDocument,
  validateStrictPdfMetadata,
} from '@/lib/security/it-upload-guard';
import {
  UnsafeOutboundUrlError,
  assertSafeOutboundUrl,
  isPrivateOrReservedIp,
} from '@/lib/security/ssrf-guard';
import { escapeCsvCell, formatCsvRow } from '@/lib/security/csv-escape';
import { POST as postMensagensUpload } from '@/app/api/mensagens/upload/route';
import { POST as postItsSignedUrl } from '@/app/api/its/signed-url/route';
import { POST as postItsUploadPdf } from '@/app/api/its/upload-pdf/route';

function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('Fase 2 Security Suite — RLS/Grants, At-Rest Crypto, Signed Uploads, Anti-SSRF, Anti-CSV & Schema', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockReset();
    mockQueryRawUnsafe.mockReset();
    mockExecuteRawUnsafe.mockReset();
    mockConversaMembroFindFirst.mockReset();
    mockMessagingPolicyFindUnique.mockReset();
    mockCreateSignedUploadUrl.mockReset();
    mockStorageUpload.mockReset();
    mockGetPublicUrl.mockReset();
    mockListBuckets.mockReset();
    mockCreateBucket.mockReset();
    mockCheckRateLimit.mockReset();

    process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock_service_role_key_valid_len';
    process.env.FIORIX_INTEGRATION_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    process.env.AUTH_SECRET = 'mock-auth-secret-with-at-least-32-characters!!';

    mockCheckRateLimit.mockResolvedValue(true);
    mockExecuteRawUnsafe.mockResolvedValue(1);
    mockQueryRawUnsafe.mockResolvedValue([]);
    mockListBuckets.mockResolvedValue({ data: [{ name: 'fiorix-mensagens-anexos' }], error: null });
    mockCreateBucket.mockResolvedValue({ data: null, error: null });
    mockCreateSignedUploadUrl.mockResolvedValue({
      data: {
        signedUrl: 'https://storage.example/signed-upload',
        token: 'tok-123',
        path: 'tenant-1/conv-1/file.pdf',
      },
      error: null,
    });
    mockStorageUpload.mockResolvedValue({ data: { path: 'uploads/tenant-1/doc.pdf' }, error: null });
    mockGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://storage.example/public/doc.pdf' } });
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  describe('Pacote 2.1 (CRIT-08 & HIGH-12) — Revogação Anon/Public e RLS Completo', () => {
    it('remove URL e publishable key hardcoded de src/lib/supabase.ts', () => {
      const supabaseLibSrc = fs.readFileSync(
        path.resolve(__dirname, '../src/lib/supabase.ts'),
        'utf8'
      );
      expect(supabaseLibSrc).not.toContain('uvieekfizuzujpwfbjww.supabase.co');
      expect(supabaseLibSrc).not.toContain('sb_publishable_');
    });

    it('nenhuma API Route ou Server Action importa o cliente anon `supabase` no servidor', () => {
      const serverDirs = [
        path.resolve(__dirname, '../src/app/api'),
        path.resolve(__dirname, '../src/app/actions'),
      ];
      const files = serverDirs.flatMap((d) => collectTsFiles(d));
      expect(files.length).toBeGreaterThan(20);

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        // Permite apenas `supabaseAdmin` (nunca `import { supabase }` ou `import { supabase, ... }`)
        expect(content, `Uso indevido de cliente anon em ${file}`).not.toMatch(
          /import\s*\{[^}]*\bsupabase\b[^}]*\}\s*from\s*['"]@\/lib\/supabase['"]/
        );
      }
    });

    it('migration 20261113000000_lockdown_public_schema_and_rls.sql revoga grants, ativa RLS sem FORCE e corrige NULLIF + snake_case', () => {
      const sqlPath = path.resolve(
        __dirname,
        '../supabase/migrations/20261113000000_lockdown_public_schema_and_rls.sql'
      );
      expect(fs.existsSync(sqlPath)).toBe(true);
      const sql = fs.readFileSync(sqlPath, 'utf8');

      expect(sql).toContain('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;');
      expect(sql).toContain('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;');
      expect(sql).toMatch(
        /ALTER DEFAULT PRIVILEGES IN SCHEMA public\s+REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;/
      );
      expect(sql).toContain('ENABLE ROW LEVEL SECURITY');
      expect(sql).not.toMatch(/ALTER\s+TABLE[^\n;]*FORCE\s+ROW\s+LEVEL\s+SECURITY/i);
      expect(sql).toContain("NULLIF(current_setting('app.current_tenant_id', true), '')");
      expect(sql).toContain('DROP POLICY IF EXISTS rls_saas_audit_insert');
      expect(sql).toContain('fiorix_holerites');
      expect(sql).toContain('fiorix_colaboradores');
      expect(sql).toContain('SET search_path = pg_catalog, public');
    });
  });

  describe('Pacote 2.2 (HIGH-07) — Criptografia Autenticada AES-256-GCM em Repouso', () => {
    it('criptografa e descriptografa com integridade GCM, rejeita adulteração e suporta rotação de chaves', () => {
      const secret = 'JBSWY3DPEHPK3PXP';
      const encrypted = encryptFieldSecret(secret, 'totp-secret');

      expect(isEncryptedFieldSecret(encrypted)).toBe(true);
      expect(encrypted.startsWith('enc:v1:')).toBe(true);
      expect(encrypted).not.toContain(secret);
      expect(encryptFieldSecret(encrypted, 'totp-secret')).toBe(encrypted); // idempotente
      expect(decryptFieldSecret(encrypted, 'totp-secret')).toBe(secret);

      // Adulteração do authTag deve falhar
      const tampered = encrypted.slice(0, -4) + (encrypted.endsWith('0000') ? 'ffff' : '0000');
      expect(() => decryptFieldSecret(tampered, 'totp-secret')).toThrow();

      // Rotação: segredo gravado apenas com AUTH_SECRET continua legível após introduzir FIORIX_INTEGRATION_ENCRYPTION_KEY
      delete process.env.FIORIX_INTEGRATION_ENCRYPTION_KEY;
      const encryptedWithAuthSecret = encryptFieldSecret('smtp-pass-legado', 'alert-channels');
      process.env.FIORIX_INTEGRATION_ENCRYPTION_KEY =
        'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
      expect(decryptFieldSecret(encryptedWithAuthSecret, 'alert-channels')).toBe('smtp-pass-legado');

      // Retrocompatibilidade com valor legado em texto plano
      expect(decryptFieldSecret('valor-legado-em-texto-plano', 'alert-channels')).toBe(
        'valor-legado-em-texto-plano'
      );
    });

    it('atua em modo fail-closed em produção caso nenhuma chave criptográfica exista', () => {
      delete process.env.FIORIX_INTEGRATION_ENCRYPTION_KEY;
      delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
      delete process.env.AUTH_SECRET;
      delete process.env.NEXTAUTH_SECRET;
      delete process.env.VITEST;
      (process.env as any).NODE_ENV = 'production';

      expect(() => resolveDomainKeys('totp-secret')).toThrow(/Nenhuma chave criptográfica configurada/);
    });

    it('verifica códigos TOTP tanto para segredos criptografados (enc:v1:) quanto Base32 legados', () => {
      const rawBase32 = generateTotpSecret();
      const encryptedSecret = encryptTotpSecret(rawBase32);
      expect(isEncryptedTotpSecret(encryptedSecret)).toBe(true);
      expect(decryptTotpSecret(encryptedSecret)).toBe(rawBase32);

      const validCode = generateSync({ secret: rawBase32 });
      expect(verifyTotpToken(validCode, encryptedSecret)).toBe(true);
      expect(verifyTotpToken(validCode, rawBase32)).toBe(true);
    });

    it('saveAlertConfig grava credenciais criptografadas no SQL e getAlertConfig descriptografa transparentemente', async () => {
      const saved = await saveAlertConfig('tenant-1', {
        name: 'Canal Operacional',
        webhookUrl: 'https://hooks.slack.com/services/T111/B222/SECRET999',
        channelType: 'slack',
        enabled: true,
        notifyConnectorOffline: true,
        notifySyncFailed: true,
        notifyModuleDelayed: false,
        cooldownMinutes: 15,
        emailEnabled: true,
        emailRecipients: 'ops@cartorio.com.br',
        emailProvider: 'smtp',
        emailConfig: {
          host: 'smtp.cartorio.com.br',
          port: 587,
          user: 'alerta@cartorio.com.br',
          pass: 'SenhaSuperSecreta!2026',
          resendApiKey: 're_live_secret_token',
        },
        whatsappEnabled: true,
        whatsappProvider: 'evolution',
        whatsappPhone: '5511999999999',
        whatsappConfig: {
          instanceUrl: 'https://evo.cartorio.com.br',
          apikey: 'evo-api-key-secret',
          token: 'zapi-client-token-secret',
          phones: [{ phone: '5511888888888', apikey: 'callmebot-key-1' }],
        },
      });

      expect(saved.webhookUrl).toBe('https://hooks.slack.com/services/T111/B222/SECRET999');

      const insertCall = mockExecuteRawUnsafe.mock.calls.find((call) =>
        String(call[0]).includes('INSERT INTO public.fiorix_operations_alert_channels')
      );
      expect(insertCall).toBeDefined();
      const serializedSqlArgs = JSON.stringify(insertCall!.slice(1));
      expect(serializedSqlArgs).not.toContain('SECRET999');
      expect(serializedSqlArgs).not.toContain('SenhaSuperSecreta!2026');
      expect(serializedSqlArgs).not.toContain('re_live_secret_token');
      expect(serializedSqlArgs).not.toContain('evo-api-key-secret');
      expect(serializedSqlArgs).not.toContain('callmebot-key-1');
      expect(serializedSqlArgs).toContain('enc:v1:');

      // Simula leitura do banco contendo os valores criptografados
      const persistedWebhook = insertCall![4] as string;
      const persistedEmailJson = insertCall![14] as string;
      const persistedWhatsJson = insertCall![18] as string;

      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          id: 'ch-1',
          tenantId: 'tenant-1',
          name: 'Canal Operacional',
          webhookUrl: persistedWebhook,
          channelType: 'slack',
          enabled: true,
          notifyConnectorOffline: true,
          notifySyncFailed: true,
          notifyModuleDelayed: false,
          cooldownMinutes: 15,
          emailEnabled: true,
          emailRecipients: 'ops@cartorio.com.br',
          emailProvider: 'smtp',
          emailConfig: persistedEmailJson,
          whatsappEnabled: true,
          whatsappProvider: 'evolution',
          whatsappPhone: '5511999999999',
          whatsappConfig: persistedWhatsJson,
        },
      ]);

      const loaded = await getAlertConfig('tenant-1');
      expect(loaded?.webhookUrl).toBe('https://hooks.slack.com/services/T111/B222/SECRET999');
      expect(loaded?.emailConfig?.pass).toBe('SenhaSuperSecreta!2026');
      expect(loaded?.emailConfig?.resendApiKey).toBe('re_live_secret_token');
      expect(loaded?.whatsappConfig?.apikey).toBe('evo-api-key-secret');
      expect(loaded?.whatsappConfig?.phones?.[0]?.apikey).toBe('callmebot-key-1');
    });

    it('crypto.ts (Google OAuth) realiza round-trip autenticado e preserva fallback legado', () => {
      const token = 'ya29.a0AfH6SMBx-google-oauth-refresh-token';
      const enc = encryptToken(token);
      expect(enc).not.toContain(token);
      expect(decryptToken(enc)).toBe(token);
      expect(decryptToken('plaintext-legacy-oauth-token')).toBe('plaintext-legacy-oauth-token');
    });
  });

  describe('Pacote 2.2 (HIGH-10) — Validação Estrita em Signed Uploads e PDFs de IT', () => {
    it('validateAttachmentMetadata bloqueia extensões executáveis/HTML/SVG e valida MIME e tamanho', () => {
      expect(validateAttachmentMetadata('payload.exe', 'application/octet-stream', 1024, 10_000_000).valid).toBe(false);
      expect(validateAttachmentMetadata('xss.html', 'text/html', 512, 10_000_000).valid).toBe(false);
      expect(validateAttachmentMetadata('vetor.svg', 'image/svg+xml', 512, 10_000_000).valid).toBe(false);
      expect(validateAttachmentMetadata('script.ps1', 'text/plain', 512, 10_000_000).valid).toBe(false);
      expect(validateAttachmentMetadata('falso.pdf', 'text/html', 1024, 10_000_000).valid).toBe(false);
      expect(validateAttachmentMetadata('vazio.pdf', 'application/pdf', 0, 10_000_000).valid).toBe(false);
      expect(validateAttachmentMetadata('grande.pdf', 'application/pdf', 30_000_000, 25_000_000).valid).toBe(false);

      const okPdf = validateAttachmentMetadata('Certidão Matrícula 123.pdf', 'application/pdf', 24_000, 25_000_000);
      expect(okPdf.valid).toBe(true);
      expect(okPdf.safeExtension).toBe('.pdf');
    });

    it('POST /api/mensagens/upload (JSON signed URL) bloqueia .html/.exe antes de chamar createSignedUploadUrl', async () => {
      mockRequireAuth.mockResolvedValue({
        id: 'u-1',
        tenantId: 'tenant-1',
        role: 'COLABORADOR',
      });
      mockConversaMembroFindFirst.mockResolvedValue({ id: 'm-1' });
      mockMessagingPolicyFindUnique.mockResolvedValue({
        attachmentsEnabled: true,
        maxAttachmentBytes: 26214400,
      });

      const badReq = new NextRequest('http://localhost/api/mensagens/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileName: 'armadilha.html',
          fileSize: 2048,
          mimeType: 'text/html',
          conversationId: 'conv-1',
        }),
      });

      const badRes = await postMensagensUpload(badReq);
      expect(badRes.status).toBe(400);
      expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();

      const goodReq = new NextRequest('http://localhost/api/mensagens/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileName: 'laudo.pdf',
          fileSize: 4096,
          mimeType: 'application/pdf',
          conversationId: 'conv-1',
        }),
      });

      const goodRes = await postMensagensUpload(goodReq);
      expect(goodRes.status).toBe(200);
      expect(mockCreateSignedUploadUrl).toHaveBeenCalledTimes(1);
    });

    it('bloqueia VISITANTE e COLABORADOR sem custódia em /api/its/signed-url e exige PDF estrito para ADMIN', async () => {
      // 1) VISITANTE bloqueado com 403
      mockRequireAuth.mockResolvedValueOnce({
        id: 'u-vis',
        tenantId: 'tenant-1',
        role: 'VISITANTE',
      });
      const visReq = new NextRequest('http://localhost/api/its/signed-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'it.pdf', contentType: 'application/pdf', fileSize: 1024 }),
      });
      const visRes = await postItsSignedUrl(visReq);
      expect(visRes.status).toBe(403);

      // 2) COLABORADOR comum sem tutoria nem custódia bloqueado com 403
      mockRequireAuth.mockResolvedValueOnce({
        id: 'u-col',
        tenantId: 'tenant-1',
        role: 'COLABORADOR',
      });
      mockQueryRawUnsafe
        .mockResolvedValueOnce([{ pode_ser_tutor: false }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const colReq = new NextRequest('http://localhost/api/its/signed-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'it.pdf', contentType: 'application/pdf', fileSize: 1024 }),
      });
      const colRes = await postItsSignedUrl(colReq);
      expect(colRes.status).toBe(403);

      // 3) ADMIN tentando subir .html bloqueado com 400
      mockRequireAuth.mockResolvedValueOnce({
        id: 'u-adm',
        tenantId: 'tenant-1',
        role: 'ADMIN',
      });
      const htmlReq = new NextRequest('http://localhost/api/its/signed-url', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fileName: 'xss.html', contentType: 'text/html', fileSize: 1024 }),
      });
      const htmlRes = await postItsSignedUrl(htmlReq);
      expect(htmlRes.status).toBe(400);

      // 4) Upload proxy /api/its/upload-pdf fixa contentType: 'application/pdf' mesmo se cliente enviar outro MIME vazio
      mockRequireAuth.mockResolvedValueOnce({
        id: 'u-adm',
        tenantId: 'tenant-1',
        role: 'ADMIN',
      });
      const pdfBytes = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF', 'utf8');
      const form = new FormData();
      form.append('file', new File([pdfBytes], 'procedimento.pdf', { type: 'application/pdf' }));
      form.append('codigo', 'IT-001');

      const uploadReq = new NextRequest('http://localhost/api/its/upload-pdf', {
        method: 'POST',
        body: form,
      });
      const uploadRes = await postItsUploadPdf(uploadReq);
      expect(uploadRes.status).toBe(200);
      expect(mockStorageUpload).toHaveBeenCalledWith(
        expect.stringContaining('uploads/tenant-1/'),
        expect.any(Buffer),
        expect.objectContaining({ contentType: 'application/pdf', upsert: false })
      );

      expect(validateStrictPdfMetadata('manual.svg', 'image/svg+xml').valid).toBe(false);
      expect(await canUserUploadItDocument({ id: 'u-m', tenantId: 't-1', role: 'MASTER' } as any)).toBe(true);
    });
  });

  describe('Pacote 2.2 (MED-04) — Proteção Centralizada Anti-SSRF', () => {
    it('bloqueia IPs privados, loopback, link-local/metadata, IPv6 mapeado, credenciais e DNS rebinding', async () => {
      const blockedUrls = [
        'http://hooks.slack.com/services/T00/B00/X00', // HTTP não permitido fora de development
        'file:///etc/passwd',
        'https://admin:secret@hooks.slack.com/services',
        'https://localhost:8080/admin',
        'https://api.internal/v1',
        'https://metadata.google.internal/computeMetadata/v1/',
        'https://127.0.0.1/private',
        'https://10.0.0.25/webhook',
        'https://172.16.10.4/webhook',
        'https://192.168.1.50/webhook',
        'https://169.254.169.254/latest/meta-data/',
        'https://[::1]/admin',
        'https://[::ffff:127.0.0.1]/admin',
      ];

      for (const bad of blockedUrls) {
        await expect(assertSafeOutboundUrl(bad)).rejects.toBeInstanceOf(UnsafeOutboundUrlError);
      }

      // DNS Rebinding: domínio público que resolve para IP interno/metadata
      await expect(
        assertSafeOutboundUrl('https://rebind.attacker.example/hook', {
          lookupFn: async () => [{ address: '169.254.169.254', family: 4 }],
        })
      ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);

      await expect(
        assertSafeOutboundUrl('https://rebind2.attacker.example/hook', {
          lookupFn: async () => [{ address: '10.12.0.5', family: 4 }],
        })
      ).rejects.toBeInstanceOf(UnsafeOutboundUrlError);

      // Destino HTTPS público legítimo
      const safe = await assertSafeOutboundUrl('https://hooks.slack.com/services/T00/B00/X00', {
        lookupFn: async () => [{ address: '54.230.10.20', family: 4 }],
      });
      expect(safe.hostname).toBe('hooks.slack.com');
      expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
      expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    });
  });

  describe('Pacote 2.2 (MED-06 & MED-09) — Anti-CSV Formula Injection e Chave Composta no Schema', () => {
    it('neutraliza fórmulas perigosas (=, +, -, @, |, tab) preservando números negativos legítimos', () => {
      expect(escapeCsvCell("=CMD|' /C calc'!A0")).toBe("\"'=CMD|' /C calc'!A0\"");
      expect(escapeCsvCell('+SUM(A1:A10)')).toBe('"\'+SUM(A1:A10)"');
      expect(escapeCsvCell('-2+3')).toBe('"\'-2+3"');
      expect(escapeCsvCell('@IMPORTXML(A1,"//a")')).toBe('"\'@IMPORTXML(A1,""//a"")"');
      expect(escapeCsvCell('|/bin/sh')).toBe('"\'|/bin/sh"');
      expect(escapeCsvCell('\t=1+1')).toBe('"\'\t=1+1"');
      expect(escapeCsvCell('  =HYPERLINK("http://evil")')).toBe('"\'  =HYPERLINK(""http://evil"")"');

      // Números negativos reais não devem receber apóstrofo
      expect(escapeCsvCell(-42.5)).toBe('"-42.5"');
      expect(escapeCsvCell('-123,45')).toBe('"-123,45"');
      expect(escapeCsvCell('-15')).toBe('"-15"');
      expect(formatCsvRow(['João "Silva"', '=1+1', 100])).toBe('"João ""Silva""";"\'=1+1";"100"');
    });

    it('alinha PK composta @@id([tenantId, protocolo]) em FiorixMetasDados no schema.prisma', () => {
      const schema = fs.readFileSync(
        path.resolve(__dirname, '../prisma/schema.prisma'),
        'utf8'
      );
      const modelMatch = schema.match(/model\s+FiorixMetasDados\s*\{([\s\S]*?)\n\}/);
      expect(modelMatch).not.toBeNull();
      const body = modelMatch![1];
      expect(body).not.toMatch(/protocolo\s+Int\s+@id/);
      expect(body).toContain('@@id([tenantId, protocolo])');
    });
  });
});
