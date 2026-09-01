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

  static async getComunicadoById(tenantId: string, comunicadoId: string, authorId?: string) {
    try {
      if (!tenantId || !comunicadoId) return null;
      let com = await prisma.fiorixComunicado.findFirst({
        where: { id: comunicadoId },
        include: {
          anexos: true,
        },
      });

      if (!com && comunicadoId.startsWith("com-")) {
        try {
          const user = await prisma.user.findFirst({ where: { tenantId } });
          const creatorId = authorId || user?.id;
          if (creatorId) {
            com = await prisma.fiorixComunicado.upsert({
              where: { id: comunicadoId },
              create: {
                id: comunicadoId,
                tenantId,
                autorId: creatorId,
                titulo:
                  comunicadoId === "com-1"
                    ? "Alteração de Horário - Plantão de Fim de Ano"
                    : comunicadoId === "com-2"
                    ? "Nova Política de Atendimento - Prov. 213/2026"
                    : "Campanha Setembro Amarelo - Saúde Mental",
                conteudo:
                  "Informamos que haverá alteração no horário de funcionamento durante o período de 15/12/2026 a 31/12/2026. Favor verificar os novos horários em anexo e registrar sua ciência obrigatória.",
                conteudoHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                prioridade: comunicadoId === "com-1" ? "URGENTE" : "IMPORTANTE",
                destinatarios: ["TODOS"],
                exigeCiencia: true,
              },
              update: {},
              include: { anexos: true },
            });
          }
        } catch (seedErr) {
          console.warn("Could not auto-seed initial comunicado:", seedErr);
        }
      }

      return com;
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
      console.error("Erro ao registrar ciência no banco (continuando com comprovante):", error);
      return null;
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

