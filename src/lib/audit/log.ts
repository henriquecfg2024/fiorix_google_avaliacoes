import { PessoasRepository } from "../pessoas/repository";
import { Prisma } from "@prisma/client";

export async function logAuditEvent(params: {
  tenantId: string;
  usuarioId: string;
  tipo: "comunicado_view" | "comunicado_ciencia" | "holerite_view" | "holerite_print" | "holerite_download_authorized" | "ferias_view" | "lgpd_relatorio" | "lgpd_solicitacao_exclusao" | "ferias_previstas_update" | "comunicado_publish" | "comunicado_cancel";
  recursoId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
  alvoUsuarioId?: string;
}) {
  try {
    await PessoasRepository.logAcesso(params);
  } catch (error) {
    console.error("Falha ao registrar log de auditoria", error);
    // Em sistemas críticos, falhar no log pode requerer falhar a operação inteira.
    // Como os requisitos mandam priorizar estabilidade, aqui logamos o erro localmente.
  }
}
