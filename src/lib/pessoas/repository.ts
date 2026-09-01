import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

/**
 * PessoasRepository
 * Centraliza o acesso aos dados do módulo de Pessoas garantindo o isolamento multi-tenant
 * e resiliência contra falhas no banco.
 */
export class PessoasRepository {
  static async getComunicados(tenantId: string, userId: string, role: string) {
    try {
      if (!tenantId) return [];
      const comunicados = await prisma.fiorixComunicado.findMany({
        where: {
          tenantId,
          status: "PUBLICADO",
          OR: [
            { destinatarios: { has: "TODOS" } },
            { destinatarios: { has: role } },
            { destinatarios: { has: userId } },
          ],
        },
        orderBy: [
          { prioridade: "asc" },
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
      return comunicados || [];
    } catch (error) {
      console.error("Erro ao buscar comunicados no banco:", error);
      return [];
    }
  }

  static async getComunicadoById(tenantId: string, comunicadoId: string) {
    try {
      if (!tenantId || !comunicadoId) return null;
      return await prisma.fiorixComunicado.findUnique({
        where: { id: comunicadoId, tenantId },
        include: {
          anexos: true,
        },
      });
    } catch (error) {
      console.error("Erro ao buscar comunicado por ID:", error);
      return null;
    }
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
    try {
      return await prisma.fiorixComunicadoCiencia.create({
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
    } catch (error) {
      console.error("Erro ao registrar ciência no banco:", error);
      throw error;
    }
  }

  static async getHolerites(tenantId: string, usuarioId: string) {
    try {
      if (!tenantId || !usuarioId) return [];
      return await prisma.fiorixHolerite.findMany({
        where: {
          tenantId,
          usuarioId,
        },
        orderBy: [
          { ano: "desc" },
          { mes: "desc" },
        ],
      });
    } catch (error) {
      console.error("Erro ao buscar holerites:", error);
      return [];
    }
  }

  static async getFeriasPrevistas(tenantId: string, usuarioId: string) {
    try {
      if (!tenantId || !usuarioId) return null;
      return await prisma.fiorixFeriasPrevista.findUnique({
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
    } catch (error) {
      console.error("Erro ao buscar férias previstas:", error);
      return null;
    }
  }

  static async getAvisosFerias(tenantId: string, usuarioId: string) {
    try {
      if (!tenantId || !usuarioId) return [];
      return await prisma.fiorixFeriasAviso.findMany({
        where: {
          tenantId,
          usuarioId,
        },
        orderBy: { dataInicio: "desc" },
      });
    } catch (error) {
      console.error("Erro ao buscar avisos de férias:", error);
      return [];
    }
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
    try {
      return await prisma.fiorixAcessoLog.create({
        data,
      });
    } catch (error) {
      console.error("Erro ao registrar log de acesso:", error);
      return null;
    }
  }
}

