import { prisma } from '@/lib/prisma';
import { requireAuth, AuthenticatedUser } from '@/lib/auth-helpers';

export type AuditModulo =
  | 'COMUNICADOS'
  | 'ITS'
  | 'USUARIOS'
  | 'DEPARTAMENTOS'
  | 'COLABORADORES'
  | 'FERIAS'
  | 'HOLERITES'
  | 'BI_IMPORTACOES';

export type AuditAcao =
  | 'INCLUSAO'
  | 'ALTERACAO'
  | 'EXCLUSAO'
  | 'IMPORTACAO'
  | 'DESATIVACAO'
  | 'CIENCIA'
  | 'REVISAO';

export interface AuditLogParams {
  modulo: AuditModulo;
  acao: AuditAcao;
  registroId?: string | number | null;
  registroDescricao?: string | null;
  detalhes?: Record<string, any> | null;
  userOverride?: AuthenticatedUser | null;
  ipOrigem?: string | null;
}

/**
 * Registra formalmente um evento de auditoria com usuário, ação, data/hora e metadados.
 */
export async function recordAuditLog(params: AuditLogParams) {
  try {
    let user: AuthenticatedUser | null = params.userOverride || null;
    if (!user) {
      try {
        user = await requireAuth();
      } catch (authErr) {
        // Usuário não autenticado via sessão direta (e.g. scripts ou background)
      }
    }

    const tenantId = user?.tenantId || 'global';
    const usuarioId = user?.id || 'system';
    const usuarioNome = user?.name || 'Sistema / Operador';
    const usuarioEmail = user?.email || 'sistema@fiorix.app';

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_audit_logs 
       (tenant_id, modulo, acao, registro_id, registro_descricao, usuario_id, usuario_nome, usuario_email, detalhes, ip_origem, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, NOW())`,
      tenantId,
      params.modulo,
      params.acao,
      params.registroId ? String(params.registroId) : null,
      params.registroDescricao || null,
      usuarioId,
      usuarioNome,
      usuarioEmail,
      params.detalhes ? JSON.stringify(params.detalhes) : null,
      params.ipOrigem || null
    );
  } catch (err) {
    console.error('Erro ao gravar log de auditoria:', err);
  }
}

/**
 * Busca logs de auditoria por módulo e/ou registro
 */
export async function getAuditLogs(modulo?: AuditModulo, registroId?: string, limit = 50) {
  try {
    const user = await requireAuth();
    let query = `SELECT * FROM public.fiorix_audit_logs WHERE tenant_id = $1`;
    const values: any[] = [user.tenantId];
    let idx = 2;

    if (modulo) {
      query += ` AND modulo = $${idx++}`;
      values.push(modulo);
    }
    if (registroId) {
      query += ` AND registro_id = $${idx++}`;
      values.push(registroId);
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx}`;
    values.push(limit);

    const logs = await prisma.$queryRawUnsafe<any[]>(query, ...values);
    return logs.map((l) => ({
      id: l.id,
      modulo: l.modulo,
      acao: l.acao,
      registroId: l.registro_id,
      registroDescricao: l.registro_descricao,
      usuarioNome: l.usuario_nome,
      usuarioEmail: l.usuario_email,
      detalhes: l.detalhes,
      createdAt: l.created_at,
    }));
  } catch (err) {
    console.error('Erro ao buscar logs de auditoria:', err);
    return [];
  }
}
