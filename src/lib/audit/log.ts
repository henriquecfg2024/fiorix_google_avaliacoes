import { PessoasRepository } from "../pessoas/repository";
import { Prisma } from "@prisma/client";

type AuditEventTipo =
  | "comunicado_view" | "comunicado_ciencia"
  | "holerite_view" | "holerite_print" | "holerite_download_authorized"
  | "ferias_view" | "lgpd_relatorio" | "lgpd_solicitacao_exclusao"
  | "ferias_previstas_update" | "comunicado_publish" | "comunicado_cancel"
  | "user_created" | "user_role_changed";

export interface AuditEventParams {
  tenantId: string;
  usuarioId: string;
  tipo: AuditEventTipo;
  recursoId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
  alvoUsuarioId?: string;
}

/**
 * Registra log de auditoria com falha silenciosa.
 * Usar para operações onde a estabilidade é mais importante que a rastreabilidade absoluta.
 */
export async function logAuditEvent(params: AuditEventParams) {
  try {
    await PessoasRepository.logAcesso(params);
  } catch (error) {
    console.error("Falha ao registrar log de auditoria", error);
  }
}

/**
 * Registra log de auditoria ESTRITA — lança exceção se o log falhar.
 * Usar em operações críticas onde a auditabilidade é obrigatória (download/visualização de holerites).
 * Se o log falhar, a operação inteira é bloqueada.
 */
export async function logAuditEventStrict(params: AuditEventParams): Promise<void> {
  const result = await PessoasRepository.logAcesso(params);
  if (!result) {
    throw new Error("Auditoria obrigatória falhou — operação bloqueada por segurança.");
  }
}
