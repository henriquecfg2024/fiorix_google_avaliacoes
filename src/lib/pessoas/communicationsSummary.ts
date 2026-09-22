import { PessoasRepository } from "./repository";
import { prisma } from "../prisma";

export interface CommunicationSummary {
  unreadCount: number;
  pendingAcknowledgements: number;
  urgentPending: number;
  totalCommunications: number;
  latestUrgentExpiration?: string | null;
  status: "action_required" | "ack_pending" | "new_messages" | "all_clear";
  statusLabel: string;
  subtext: string;
  badgeLabel: string;
  isAllClear: boolean;
}

/**
 * Canonical calculation of communication metrics for a user.
 * Shared across /pessoas and /pessoas/comunicados.
 */
export function calculateCommunicationSummary(
  comunicados: Array<{
    id: string;
    prioridade?: string;
    exigeCiencia?: boolean;
    visualizado?: boolean;
    lido?: boolean;
    dataExpiracao?: Date | string | null;
    ciencias?: Array<any>;
  }>
): CommunicationSummary {
  const totalCommunications = comunicados.length;

  let unreadCount = 0;
  let pendingAcknowledgements = 0;
  let urgentPending = 0;
  let latestUrgentExpiration: string | null = null;

  for (const c of comunicados) {
    const isVisualizado = Boolean(c.visualizado ?? c.lido);
    if (!isVisualizado) {
      unreadCount++;
    }

    const hasCiencia = c.ciencias && c.ciencias.length > 0;
    const isPendingAck = Boolean(c.exigeCiencia) && !hasCiencia;

    if (isPendingAck) {
      pendingAcknowledgements++;
      const isUrgent = c.prioridade === "URGENTE";
      if (isUrgent) {
        urgentPending++;
        if (c.dataExpiracao && !latestUrgentExpiration) {
          latestUrgentExpiration =
            typeof c.dataExpiracao === "string"
              ? c.dataExpiracao
              : c.dataExpiracao.toISOString();
        }
      }
    }
  }

  // Canonical status determination
  let status: CommunicationSummary["status"] = "all_clear";
  let statusLabel = "Tudo em dia";
  let badgeLabel = "EM DIA";

  if (urgentPending > 0) {
    status = "action_required";
    statusLabel = "Ação necessária";
    badgeLabel = urgentPending === 1 ? "1 URGENTE" : `${urgentPending} URGENTES`;
  } else if (pendingAcknowledgements > 0) {
    status = "ack_pending";
    statusLabel = "Ciência pendente";
    badgeLabel = "CIÊNCIA PENDENTE";
  } else if (unreadCount > 0) {
    status = "new_messages";
    statusLabel = "Novos comunicados";
    badgeLabel = "NÃO LIDOS";
  }

  // Canonical subtext formatting
  let subtext = "Nenhuma ciência pendente";
  if (status !== "all_clear") {
    const unreadStr =
      unreadCount === 1 ? "1 não lido" : `${unreadCount} não lidos`;
    const ackStr =
      pendingAcknowledgements === 1
        ? "1 ciência pendente"
        : `${pendingAcknowledgements} ciências pendentes`;

    if (unreadCount > 0 && pendingAcknowledgements > 0) {
      subtext = `${unreadStr} • ${ackStr}`;
    } else if (pendingAcknowledgements > 0) {
      subtext = ackStr;
    } else {
      subtext = unreadStr;
    }
  }

  return {
    unreadCount,
    pendingAcknowledgements,
    urgentPending,
    totalCommunications,
    latestUrgentExpiration,
    status,
    statusLabel,
    subtext,
    badgeLabel,
    isAllClear: status === "all_clear",
  };
}

/**
 * Fetches communication summary for user from database with reliable auto-seeding.
 */
export async function getCommunicationSummaryForUser(
  tenantId: string,
  userId: string,
  role: string = "USER"
): Promise<CommunicationSummary> {
  try {
    const comunicados = await PessoasRepository.getComunicados(tenantId, userId, role);

    return calculateCommunicationSummary(
      (comunicados || []).map((c) => ({
        id: c.id,
        prioridade: c.prioridade,
        exigeCiencia: c.exigeCiencia,
        visualizado: Boolean(c.ciencias?.[0]?.dataVisualizacao || c.ciencias?.[0]?.dataCiencia),
        dataExpiracao: c.dataExpiracao,
        ciencias: c.ciencias || [],
      }))
    );
  } catch (error) {
    console.error("Erro ao obter resumo de comunicados:", error);
    return calculateCommunicationSummary([]);
  }
}
