import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

/**
 * PessoasRepository
 * Centraliza o acesso aos dados do módulo de Pessoas garantindo o isolamento multi-tenant.
 */
export class PessoasRepository {
  /**
   * Obtém os comunicados para um usuário específico, respeitando a organização (tenant) e destinatários.
   */
  static async getComunicados(tenantId: string, userId: string, role: string) {
    return prisma.fiorixComunicado.findMany({
      where: {
        tenantId, // ISOLAMENTO MULTI-TENANT OBRIGATÓRIO
        status: "PUBLICADO",
        OR: [
          { destinatarios: { has: "TODOS" } },
          { destinatarios: { has: role } },
          { destinatarios: { has: userId } },
        ],
      },
      orderBy: [
        { prioridade: "asc" }, // URGENTE, IMPORTANTE, NORMAL
        { dataPublicacao: "desc" },
      ],
      include: {
        anexos: true,
        ciencias: {
          where: { usuarioId: userId },
          take: 1,
        },
      },
    });
  }

  static async getComunicadoById(tenantId: string, comunicadoId: string) {
    return prisma.fiorixComunicado.findUnique({
      where: { id: comunicadoId, tenantId },
      include: {
        anexos: true,
      },
    });
  }

  static async registerCiencia(data: {
    tenantId: string;
    comunicadoId: string;
    usuarioId: string;
    ip: string;
    userAgent: string;
    scrollPercent: number;
    comunicadoHash: string;
    comprovanteHash: string;
    qrCodeUrl: string;
  }) {
    return prisma.fiorixComunicadoCiencia.create({
      data: {
        tenantId: data.tenantId,
        comunicadoId: data.comunicadoId,
        usuarioId: data.usuarioId,
        dataVisualizacao: new Date(),
        dataCiencia: new Date(),
        ip: data.ip,
        userAgent: data.userAgent,
        scrollPercent: data.scrollPercent,
        comunicadoHash: data.comunicadoHash,
        comprovanteHash: data.comprovanteHash,
        qrCodeUrl: data.qrCodeUrl,
      },
    });
  }

  static async getHolerites(tenantId: string, usuarioId: string) {
    return prisma.fiorixHolerite.findMany({
      where: {
        tenantId,
        usuarioId,
      },
      orderBy: [
        { ano: "desc" },
        { mes: "desc" },
      ],
    });
  }

  static async getFeriasPrevistas(tenantId: string, usuarioId: string) {
    return prisma.fiorixFeriasPrevista.findUnique({
      where: {
        tenantId_usuarioId: {
          tenantId,
          usuarioId,
        },
      },
      include: {
        historico: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  static async getAvisosFerias(tenantId: string, usuarioId: string) {
    return prisma.fiorixFeriasAviso.findMany({
      where: {
        tenantId,
        usuarioId,
      },
      orderBy: { dataInicio: "desc" },
    });
  }

  static async logAcesso(data: {
    tenantId: string;
    usuarioId: string;
    tipo: string;
    recursoId?: string;
    ip?: string;
    userAgent?: string;
    metadata?: Prisma.InputJsonValue;
    alvoUsuarioId?: string;
  }) {
    return prisma.fiorixAcessoLog.create({
      data,
    });
  }
}
