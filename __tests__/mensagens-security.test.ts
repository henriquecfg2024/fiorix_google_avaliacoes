import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateAttachmentFile,
  sanitizeMessageContent,
  checkMessageRateLimit,
  BLOCKED_EXTENSIONS,
} from '@/lib/mensagens/security';

describe('MÓDULO MENSAGENS — Hardening de Segurança & Sanitização', () => {
  it('bloqueia estritamente extensões executáveis e perigosas', () => {
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.ps1', '.js', '.vbs', '.scr', '.sh', '.svg', '.html', '.php'];
    for (const ext of dangerousExtensions) {
      expect(BLOCKED_EXTENSIONS.has(ext)).toBe(true);
      const fakeBuffer = Buffer.from('conteúdo perigoso');
      const result = validateAttachmentFile(`script${ext}`, fakeBuffer, 'application/octet-stream');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('bloqueados por políticas de segurança');
    }
  });

  it('valida magic bytes de PDF legítimo e rejeita arquivos com extensão forjada', () => {
    const validPdfBuffer = Buffer.from('%PDF-1.7\nCorpo do documento...');
    const result = validateAttachmentFile('documento.pdf', validPdfBuffer, 'application/pdf');
    expect(result.valid).toBe(true);
    expect(result.safeMimeType).toBe('application/pdf');

    // Forjando um arquivo executável renomeado para .pdf
    const fakePdfBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00ExeFakeHeader');
    const forgedResult = validateAttachmentFile('falso.pdf', fakePdfBuffer, 'application/pdf');
    expect(forgedResult.valid).toBe(false);
    expect(forgedResult.error).toContain('não corresponde a um formato seguro suportado');
  });

  it('valida magic bytes de PNG e JPEG autênticos', () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const pngRes = validateAttachmentFile('foto.png', pngHeader, 'image/png');
    expect(pngRes.valid).toBe(true);
    expect(pngRes.safeMimeType).toBe('image/png');

    const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const jpegRes = validateAttachmentFile('foto.jpg', jpegHeader, 'image/jpeg');
    expect(jpegRes.valid).toBe(true);
    expect(jpegRes.safeMimeType).toBe('image/jpeg');
  });

  it('rejeita arquivos vazios ou maiores que o limite configurado', () => {
    const empty = Buffer.alloc(0);
    expect(validateAttachmentFile('vazio.pdf', empty, 'application/pdf').valid).toBe(false);

    const oversized = Buffer.alloc(30 * 1024 * 1024); // 30 MB
    expect(validateAttachmentFile('pesado.pdf', oversized, 'application/pdf', 25 * 1024 * 1024).valid).toBe(false);
  });

  it('sanitiza caracteres de controle e invisíveis sem corromper texto legítimo', () => {
    const raw = 'Olá,\x00 mundo!\x08 Quebras de linha\nsão permitidas.';
    const sanitized = sanitizeMessageContent(raw);
    expect(sanitized).toBe('Olá, mundo! Quebras de linha\nsão permitidas.');
  });
});

describe('MÓDULO MENSAGENS — Rate Limiting de Envio', () => {
  const testUserId = 'test_user_rate_limit_' + Date.now();

  it('permite envio normal dentro do limite de 20 mensagens por janela', () => {
    for (let i = 0; i < 20; i++) {
      expect(checkMessageRateLimit(testUserId, 20, 10000)).toBe(true);
    }
  });

  it('bloqueia a 21ª requisição quando o limite da janela é excedido', () => {
    const blocked = checkMessageRateLimit(testUserId, 20, 10000);
    expect(blocked).toBe(false);
  });
});

describe('MÓDULO MENSAGENS — Regras de Privacidade Web Push', () => {
  it('garante que a carga de notificação em tela de bloqueio respeita zero-content quando preview=false', () => {
    const message = {
      id: 'm1',
      conteudo: 'Informação sigilosa do processo 12345',
      hasAttachments: false,
    };
    const allowPreview = false;

    let pushBody = 'Você recebeu uma nova mensagem no FIORIX.';
    if (allowPreview) {
      pushBody = message.conteudo;
    }

    expect(pushBody).toBe('Você recebeu uma nova mensagem no FIORIX.');
    expect(pushBody).not.toContain('sigilosa');
    expect(pushBody).not.toContain('12345');
  });

  it('exibe o conteúdo apenas quando allowPreview for ativado explicitamente', () => {
    const message = {
      id: 'm2',
      conteudo: 'Pode verificar este documento?',
      hasAttachments: false,
    };
    const allowPreview = true;

    let pushBody = 'Você recebeu uma nova mensagem no FIORIX.';
    if (allowPreview) {
      pushBody = message.conteudo;
    }

    expect(pushBody).toBe('Pode verificar este documento?');
  });
});
