import { prisma } from '@/lib/prisma';

// Lista de extensões expressamente proibidas (executáveis, scripts, vetores XSS e web shells)
export const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.ps1', '.js', '.vbs', '.scr', '.sh', '.bash',
  '.com', '.msi', '.reg', '.dll', '.bin', '.pif', '.hta', '.cpl', '.jar',
  '.svg', '.html', '.htm', '.xhtml', '.phtml', '.php', '.asp', '.aspx', '.jsp',
]);

// Magic bytes signatures para validação profunda de tipo real de arquivo
const FILE_SIGNATURES: { mime: string; check: (buf: Buffer) => boolean }[] = [
  // PDF: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  {
    mime: 'application/pdf',
    check: (buf) => buf.length >= 5 && buf.toString('utf-8', 0, 5) === '%PDF-',
  },
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  {
    mime: 'image/png',
    check: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  },
  // JPEG: FF D8 FF
  {
    mime: 'image/jpeg',
    check: (buf) =>
      buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  // WEBP: RIFF....WEBP
  {
    mime: 'image/webp',
    check: (buf) =>
      buf.length >= 12 &&
      buf.toString('utf-8', 0, 4) === 'RIFF' &&
      buf.toString('utf-8', 8, 12) === 'WEBP',
  },
  // ZIP / DOCX / XLSX: PK.. (0x50 0x4B 0x03 0x04)
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    check: (buf) =>
      buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05),
  },
  {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    check: (buf) =>
      buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05),
  },
];

/**
 * Validação de segurança estrita para arquivos anexos
 */
export function validateAttachmentFile(
  fileName: string,
  buffer: Buffer,
  declaredMimeType: string,
  maxSizeBytes: number = 26214400 // 25 MB default
): { valid: boolean; error?: string; safeMimeType?: string } {
  // 1. Limite de tamanho
  if (buffer.length === 0) {
    return { valid: false, error: 'O arquivo enviado está vazio.' };
  }
  if (buffer.length > maxSizeBytes) {
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(0);
    return { valid: false, error: `O arquivo excede o limite máximo permitido de ${maxMb}MB.` };
  }

  // 2. Extração e checagem de extensão
  const lowerName = fileName.toLowerCase().trim();
  const lastDotIndex = lowerName.lastIndexOf('.');
  if (lastDotIndex === -1) {
    return { valid: false, error: 'O arquivo deve conter uma extensão válida.' };
  }
  const ext = lowerName.substring(lastDotIndex);

  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Arquivos do tipo ${ext} são bloqueados por políticas de segurança corporativa.` };
  }

  // 3. Validação de Magic Bytes
  const matchedSignature = FILE_SIGNATURES.find((sig) => sig.check(buffer));
  if (matchedSignature) {
    return { valid: true, safeMimeType: matchedSignature.mime };
  }

  // Se não bater com nenhuma das assinaturas permitidas (por exemplo, arquivo binário desconhecido ou manipulado)
  // Permitimos se for texto puro (txt / csv) validando ausência de bytes nulos
  if (ext === '.txt' || ext === '.csv') {
    const hasNullByte = buffer.slice(0, 1024).includes(0x00);
    if (!hasNullByte) {
      return { valid: true, safeMimeType: ext === '.csv' ? 'text/csv' : 'text/plain' };
    }
  }

  return {
    valid: false,
    error: 'O conteúdo binário do arquivo não corresponde a um formato seguro suportado (PDF, PNG, JPG, WEBP, DOCX, XLSX, TXT, CSV).',
  };
}

/**
 * Sanitiza o conteúdo textual de mensagens.
 * Remove caracteres de controle invisíveis e normaliza espaços.
 */
export function sanitizeMessageContent(raw: string): string {
  if (!raw) return '';
  // Remove caracteres de controle ANSI / invisíveis maliciosos, preservando quebras de linha normais
  return raw
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '')
    .trim();
}

/**
 * Rate Limiter simples em memória (Janela Deslizante por usuário)
 * Protege contra flooding de mensagens e abuso de endpoints
 */
const rateLimitMap = new Map<string, number[]>();

export function checkMessageRateLimit(
  userId: string,
  maxRequests: number = 20,
  windowMs: number = 10000 // 10 segundos
): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(userId) || [];

  // Remove timestamps fora da janela
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= maxRequests) {
    return false; // Bloqueado por excesso de requisições
  }

  validTimestamps.push(now);
  rateLimitMap.set(userId, validTimestamps);
  return true;
}

/**
 * Registra evento no log de auditoria forense imutável de mensagens
 */
export async function logMessagingAudit(params: {
  tenantId: string;
  actorUserId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    await prisma.messagingAuditLog.create({
      data: {
        tenantId: params.tenantId,
        actorUserId: params.actorUserId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        metadata: params.metadata,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error('[MessagingAuditLog] Erro ao gravar auditoria:', error);
  }
}
