import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateSync } from 'otplib';

const mockQueryRawUnsafe = vi.fn();
const mockExecuteRawUnsafe = vi.fn();
const mockUserFindUnique = vi.fn();

vi.mock('@/lib/audit', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: (...args: any[]) => mockExecuteRawUnsafe(...args),
    $queryRawUnsafe: (...args: any[]) => mockQueryRawUnsafe(...args),
    user: {
      findUnique: (...args: any[]) => mockUserFindUnique(...args),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    instrucaoTrabalho: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
  },
}));

import {
  escapeHtmlEntities,
  plainTextToSafeHtml,
  sanitizeDocumentHtml,
} from '@/lib/security/html-sanitizer';
import { isRouteAllowedForUser } from '@/lib/nav-permissions/service';
import { generateTotpSecret, verifyTotpToken, verifyTotpTokenAsync } from '@/lib/totp';
import {
  MAX_LOGIN_ATTEMPTS,
  checkLoginLockout,
  clearLoginAttempts,
  recordFailedLogin,
} from '@/lib/security/login-lockout';
import {
  ALERT_SECRET_MASK,
  maskAlertConfigSecrets,
  restoreMaskedAlertSecrets,
} from '@/lib/alerts/alert-storage';

describe('Fase 1 Security Suite — RBAC, Sessão, Anti-Replay, Sanitização XSS e Segredos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecuteRawUnsafe.mockResolvedValue(1);
    mockQueryRawUnsafe.mockResolvedValue([]);
    mockUserFindUnique.mockResolvedValue({
      id: 'u-default',
      role: 'COLABORADOR',
      tenantId: 'tenant-1',
      departamento: null,
    });
  });

  describe('HIGH-06 — Sanitizador determinístico de HTML documental', () => {
    it('remove <script>, <iframe>, <svg>, event handlers e URLs javascript:', () => {
      const maliciousHtml = `
        <h2>Certidão de Objeto e Pé</h2>
        <p onmouseover="fetch('https://attacker.tld')">Conteúdo legítimo.</p>
        <script>window.__pwned = true;</script>
        <img src="x" onerror="alert(document.domain)" />
        <svg onload="alert(1)"></svg>
        <a href="javascript:alert(2)">Abrir</a>
        <a href="https://esaj.tjsp.jus.br/cpopg/open.do">Consulta TJSP</a>
      `;

      const safe = sanitizeDocumentHtml(maliciousHtml, '');

      expect(safe).toContain('<h2>Certidão de Objeto e Pé</h2>');
      expect(safe).toContain('<p>Conteúdo legítimo.</p>');
      expect(safe).not.toContain('onmouseover');
      expect(safe).not.toContain('<script');
      expect(safe).not.toContain('onerror');
      expect(safe).not.toContain('<svg');
      expect(safe).not.toContain('javascript:');
      expect(safe).toContain('href="https://esaj.tjsp.jus.br/cpopg/open.do"');
      expect(safe).toContain('rel="noopener noreferrer"');
    });

    it('preserva imagens data:image/png;base64 legítimas e bloqueia data:text/html', () => {
      const validImg = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA" alt="Selo" />';
      const evilImg = '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" />';

      const outValid = sanitizeDocumentHtml(validImg, '');
      const outEvil = sanitizeDocumentHtml(evilImg, 'Texto reserva');

      expect(outValid).toContain('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA');
      expect(outEvil).not.toContain('data:text/html');
      expect(outEvil).toContain('<p>Texto reserva</p>');
    });

    it('escapa fallback de texto puro e tags não fechadas', () => {
      expect(escapeHtmlEntities('<img onerror=1>')).toBe('&lt;img onerror=1&gt;');
      expect(plainTextToSafeHtml('A < B & C > D')).toBe('<p>A &lt; B &amp; C &gt; D</p>');
      expect(sanitizeDocumentHtml('<p>Ok</p><img src=x onerror=alert(1)', '')).toBe(
        '<p>Ok</p>&lt;img src=x onerror=alert(1)'
      );
    });
  });

  describe('HIGH-09 — RBAC fail-closed (default-deny), prefixo mais específico e rotas exclusivas MASTER', () => {
    it('bloqueia rotas não catalogadas por padrão (default-deny) para perfis não-MASTER', async () => {
      const allowedColab = await isRouteAllowedForUser('/rota-interna-inexistente-xyz', {
        id: 'u-colab',
        role: 'COLABORADOR',
        tenantId: 'tenant-1',
      });
      const allowedAdmin = await isRouteAllowedForUser('/rota-interna-inexistente-xyz', {
        id: 'u-admin',
        role: 'ADMIN',
        tenantId: 'tenant-1',
      });

      expect(allowedColab).toBe(false);
      expect(allowedAdmin).toBe(false);
    });

    it('bloqueia estritamente /master/* e /configuracoes/grupos-permissoes para ADMIN', async () => {
      const adminUser = { id: 'u-admin', role: 'ADMIN', tenantId: 'tenant-1' };
      const masterUser = { id: 'u-master', role: 'MASTER', tenantId: 'tenant-1' };

      expect(await isRouteAllowedForUser('/master/tenants', adminUser)).toBe(false);
      expect(await isRouteAllowedForUser('/configuracoes/grupos-permissoes', adminUser)).toBe(false);
      expect(await isRouteAllowedForUser('/master/tenants', masterUser)).toBe(true);
      expect(await isRouteAllowedForUser('/configuracoes/grupos-permissoes', masterUser)).toBe(true);
    });

    it('usa correspondência pelo prefixo mais longo entre /gestao-documental e /gestao-documental/visualizador', async () => {
      // Simula regra de usuário permitindo gestao_documental mas bloqueando visualizador_documental
      mockQueryRawUnsafe.mockImplementation(async (sql: string) => {
        if (String(sql).includes('fiorix_nav_user_rules')) {
          return [
            { item_id: 'gestao_documental', override: 'ALLOW' },
            { item_id: 'visualizador_documental', override: 'DENY' },
          ];
        }
        return [];
      });

      const user = { id: 'u-prefix-1', role: 'COLABORADOR', tenantId: 'tenant-prefix-1' };

      expect(await isRouteAllowedForUser('/gestao-documental', user)).toBe(true);
      expect(await isRouteAllowedForUser('/gestao-documental/visualizador', user)).toBe(false);
    });

    it('mapeia corretamente o alias /bi/importar para bi_importar (restrito a ADMIN/MASTER por padrão)', async () => {
      const colab = { id: 'u-c', role: 'COLABORADOR', tenantId: 'tenant-1' };
      const admin = { id: 'u-a', role: 'ADMIN', tenantId: 'tenant-1' };

      expect(await isRouteAllowedForUser('/bi/importar', colab)).toBe(false);
      expect(await isRouteAllowedForUser('/bi/importar', admin)).toBe(true);
    });
  });

  describe('HIGH-04 — Proteção Anti-Replay TOTP e Lockout de Força Bruta', () => {
    it('aceita um código TOTP válido uma única vez por escopo e rejeita replay imediato', async () => {
      const secret = generateTotpSecret();
      const code = generateSync({ secret });
      const scope = `login:user-replay-${Date.now()}`;

      expect(await verifyTotpTokenAsync(code, secret, scope)).toBe(true);
      // Replay do mesmo código de 6 dígitos na mesma janela deve ser negado
      expect(await verifyTotpTokenAsync(code, secret, scope)).toBe(false);
      expect(verifyTotpToken(code, secret, scope)).toBe(false);
    });

    it('bloqueia identificador após MAX_LOGIN_ATTEMPTS falhas consecutivas e limpa após sucesso', async () => {
      const identifier = `test-lockout-${Date.now()}@7risp.com.br`;

      for (let i = 0; i < MAX_LOGIN_ATTEMPTS - 1; i++) {
        await recordFailedLogin(identifier);
        expect((await checkLoginLockout(identifier)).isLocked).toBe(false);
      }

      await recordFailedLogin(identifier);
      const lockedState = await checkLoginLockout(identifier);
      expect(lockedState.isLocked).toBe(true);
      expect(lockedState.remainingMinutes).toBeGreaterThanOrEqual(1);

      await clearLoginAttempts(identifier);
      expect((await checkLoginLockout(identifier)).isLocked).toBe(false);
    });
  });

  describe('HIGH-07 — Mascaramento e restauração íntegra de segredos de canais de alerta', () => {
    it('mascara webhookUrl, senha SMTP, Resend API Key, CallMeBot API Keys e tokens no GET e os restaura no POST', () => {
      const storedConfig = {
        id: 'cfg-1',
        tenantId: 'tenant-1',
        name: 'Alertas Produção',
        webhookUrl: 'https://hooks.slack.com/services/T000/B000/SUPER_SECRET_TOKEN',
        channelType: 'slack' as const,
        enabled: true,
        notifyConnectorOffline: true,
        notifySyncFailed: true,
        notifyModuleDelayed: true,
        cooldownMinutes: 15,
        emailEnabled: true,
        emailRecipients: 'ti@cartorio.com.br',
        emailProvider: 'smtp' as const,
        emailConfig: {
          host: 'smtp.office365.com',
          port: 587,
          user: 'alerta@cartorio.com.br',
          pass: 'SmtpSecret!2026',
          resendApiKey: 're_live_secret_999',
        },
        whatsappEnabled: true,
        whatsappProvider: 'callmebot' as const,
        whatsappPhone: '+5511999990001',
        whatsappConfig: {
          apikey: 'cmb-primary-secret',
          token: 'evo-bearer-secret',
          phones: [
            { phone: '+5511999990002', apikey: 'cmb-secondary-secret', label: 'Plantão' },
          ],
        },
      };

      const masked = maskAlertConfigSecrets(storedConfig);

      expect(masked.webhookUrl).toBe(`https://hooks.slack.com/${ALERT_SECRET_MASK}`);
      expect(masked.webhookUrl).not.toContain('SUPER_SECRET_TOKEN');
      expect(masked.emailConfig?.pass).toBe(ALERT_SECRET_MASK);
      expect(masked.emailConfig?.resendApiKey).toBe(ALERT_SECRET_MASK);
      expect(masked.whatsappConfig?.apikey).toBe(ALERT_SECRET_MASK);
      expect(masked.whatsappConfig?.token).toBe(ALERT_SECRET_MASK);
      expect(masked.whatsappConfig?.phones?.[0]?.apikey).toBe(ALERT_SECRET_MASK);

      // Simula reenvio pelo frontend sem alterar os segredos ( inclusive promovendo o telefone secundário! )
      const clientPayloadAfterPromote = {
        ...masked,
        whatsappPhone: '+5511999990002',
        whatsappConfig: {
          ...masked.whatsappConfig,
          apikey: ALERT_SECRET_MASK,
          phones: [],
        },
      };

      const restored = restoreMaskedAlertSecrets(clientPayloadAfterPromote, storedConfig);

      expect(restored.webhookUrl).toBe('https://hooks.slack.com/services/T000/B000/SUPER_SECRET_TOKEN');
      expect(restored.emailConfig?.pass).toBe('SmtpSecret!2026');
      expect(restored.emailConfig?.resendApiKey).toBe('re_live_secret_999');
      expect(restored.whatsappConfig?.token).toBe('evo-bearer-secret');
      // Deve restaurar a chave correspondente ao número promovido (+5511999990002)
      expect(restored.whatsappConfig?.apikey).toBe('cmb-secondary-secret');
    });
  });
});
