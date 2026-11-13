import { prisma } from '@/lib/prisma';
import type { AuthenticatedUser } from '@/lib/auth-helpers';

const PRIVILEGED_IT_ROLES = new Set(['MASTER', 'ADMIN', 'RH', 'SUBSTITUTO', 'GESTOR']);

export function validateStrictPdfMetadata(
  fileName?: string | null,
  declaredMimeType?: string | null
): { valid: boolean; safeFileName: string; error?: string } {
  const rawName = String(fileName || '').trim();
  if (!rawName) {
    return { valid: false, safeFileName: '', error: 'Nome do arquivo PDF é obrigatório.' };
  }

  const lower = rawName.toLowerCase();
  if (!lower.endsWith('.pdf')) {
    return {
      valid: false,
      safeFileName: '',
      error: 'Formato inválido: apenas documentos PDF (.pdf) são permitidos para Instruções de Trabalho.',
    };
  }

  const mime = String(declaredMimeType || '').trim().toLowerCase();
  if (mime && mime !== 'application/pdf' && mime !== 'application/x-pdf') {
    return {
      valid: false,
      safeFileName: '',
      error: `Tipo MIME inválido (${mime}). Apenas application/pdf é permitido.`,
    };
  }

  const baseWithoutExt = rawName.slice(0, -4);
  const cleanBase =
    baseWithoutExt
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/\.+/g, '_')
      .slice(0, 80) || 'documento';

  return { valid: true, safeFileName: `${cleanBase}.pdf` };
}

/**
 * Verifica se o usuário autenticado possui permissão legítima para enviar PDFs de IT:
 * - Perfis gestores (MASTER, ADMIN, RH, SUBSTITUTO, GESTOR); ou
 * - Colaborador habilitado como Tutor (`pode_ser_tutor = true`); ou
 * - Guardião, autor, responsável técnico, substituto ativo ou corresponsável de IT do mesmo tenant.
 */
export async function canUserUploadItDocument(user: AuthenticatedUser): Promise<boolean> {
  if (!user?.id || !user?.tenantId) return false;

  const roleUpper = String(user.role || '').trim().toUpperCase();
  if (PRIVILEGED_IT_ROLES.has(roleUpper)) {
    return true;
  }
  if (roleUpper === 'VISITANTE') {
    return false;
  }

  try {
    const tutorRows = await prisma.$queryRawUnsafe<Array<{ pode_ser_tutor: boolean }>>(
      `SELECT COALESCE(pode_ser_tutor, false) AS pode_ser_tutor
       FROM public."User"
       WHERE id = $1 AND "tenantId" = $2
       LIMIT 1`,
      user.id,
      user.tenantId
    );
    if (tutorRows[0]?.pode_ser_tutor === true) {
      return true;
    }
  } catch {
    // Coluna pode_ser_tutor opcional em bancos iniciais
  }

  try {
    const todayIso = new Date().toISOString().slice(0, 10);
    const custodianRows = await prisma.$queryRawUnsafe<Array<{ ok: number }>>(
      `SELECT 1 AS ok
       FROM public.fiorix_its
       WHERE tenant_id = $1
         AND deleted_at IS NULL
         AND (
           responsavel_tecnico_id = $2
           OR guardiao_id = $2
           OR autor_id = $2
           OR (substituto_id = $2 AND (substituto_ate IS NULL OR substituto_ate::date >= $3::date))
         )
       LIMIT 1`,
      user.tenantId,
      user.id,
      todayIso
    );
    if (custodianRows.length > 0) return true;

    const partRows = await prisma.$queryRawUnsafe<Array<{ ok: number }>>(
      `SELECT 1 AS ok
       FROM public.fiorix_its_participants
       WHERE tenant_id = $1
         AND usuario_id = $2
         AND status = 'ativo'
         AND papel IN ('RESPONSAVEL_PRINCIPAL', 'CORRESPONSAVEL')
       LIMIT 1`,
      user.tenantId,
      user.id
    );
    return partRows.length > 0;
  } catch {
    return false;
  }
}

