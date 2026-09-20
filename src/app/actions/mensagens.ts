'use server';

import { requireAuth, requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import {
  sanitizeMessageContent,
  checkMessageRateLimit,
  logMessagingAudit,
} from '@/lib/mensagens/security';
import { dispatchRealtimeAndPush } from '@/lib/mensagens/realtime';

export interface SerializedConversation {
  id: string;
  tipo: 'DIRECT' | 'GROUP';
  titulo: string;
  descricao?: string | null;
  avatarUrl?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  otherMember?: {
    id: string;
    name: string;
    role: string;
  } | null;
  membros: {
    id: string;
    userId: string;
    name: string;
    role: string;
    papel: 'ADMIN' | 'MEMBER';
  }[];
  lastMessage?: {
    id: string;
    conteudo: string;
    remetenteId: string;
    remetenteNome: string;
    createdAt: string;
    isDeleted: boolean;
  } | null;
}

export interface SerializedMessage {
  id: string;
  conversaId: string;
  remetenteId: string;
  remetenteNome: string;
  remetenteRole: string;
  conteudo: string;
  isDeleted: boolean;
  createdAt: string;
  editedAt?: string | null;
  respostaA?: {
    id: string;
    conteudo: string;
    remetenteNome: string;
  } | null;
  anexos: {
    id: string;
    nomeArquivo: string;
    tamanhoBytes: number;
    mimeType: string;
  }[];
  reacoes: {
    emoji: string;
    count: number;
    hasReacted: boolean;
  }[];
}

/**
 * 1. Lista todas as conversas do usuário autenticado no tenant
 */
export async function getConversations(): Promise<{ success: boolean; conversations?: SerializedConversation[]; error?: string }> {
  try {
    const user = await requireAuth();

    const memberships = await prisma.conversaMembro.findMany({
      where: {
        usuarioId: user.id,
        tenantId: user.tenantId,
      },
      include: {
        conversa: {
          include: {
            membros: {
              include: {
                usuario: {
                  select: { id: true, name: true, role: true },
                },
              },
            },
            mensagens: {
              take: 1,
              orderBy: { createdAt: 'desc' },
              include: {
                remetente: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: {
        conversa: {
          lastMessageAt: 'desc',
        },
      },
    });

    const result: SerializedConversation[] = [];

    for (const m of memberships) {
      const conv = m.conversa;

      // Conta mensagens não lidas
      const unreadCount = await prisma.mensagem.count({
        where: {
          conversaId: conv.id,
          createdAt: { gt: m.lastReadAt },
          remetenteId: { not: user.id },
          isDeleted: false,
        },
      });

      // Se for DIRECT, o título e avatar são os do outro membro
      const otherMemberData = conv.membros.find((cm) => cm.usuarioId !== user.id);
      const displayTitle = conv.tipo === 'DIRECT'
        ? (otherMemberData?.usuario?.name || 'Colega de Trabalho')
        : (conv.titulo || 'Grupo');

      const lastMsg = conv.mensagens[0];

      result.push({
        id: conv.id,
        tipo: conv.tipo as 'DIRECT' | 'GROUP',
        titulo: displayTitle,
        descricao: conv.descricao,
        avatarUrl: conv.avatarUrl,
        lastMessageAt: conv.lastMessageAt.toISOString(),
        unreadCount,
        otherMember: otherMemberData
          ? {
              id: otherMemberData.usuario.id,
              name: otherMemberData.usuario.name || 'Usuário',
              role: otherMemberData.usuario.role,
            }
          : null,
        membros: conv.membros.map((cm) => ({
          id: cm.id,
          userId: cm.usuario.id,
          name: cm.usuario.name || 'Usuário',
          role: cm.usuario.role,
          papel: cm.papel as 'ADMIN' | 'MEMBER',
        })),
        lastMessage: lastMsg
          ? {
              id: lastMsg.id,
              conteudo: lastMsg.isDeleted ? 'Mensagem removida' : lastMsg.conteudo,
              remetenteId: lastMsg.remetenteId,
              remetenteNome: lastMsg.remetente.name || 'Usuário',
              createdAt: lastMsg.createdAt.toISOString(),
              isDeleted: lastMsg.isDeleted,
            }
          : null,
      });
    }

    return { success: true, conversations: result };
  } catch (error: any) {
    console.error('[getConversations] Erro:', error);
    return { success: false, error: error?.message || 'Falha ao buscar conversas' };
  }
}

/**
 * 2. Busca histórico de mensagens de uma conversa com paginação
 */
export async function getMessages(
  conversationId: string,
  limit: number = 50,
  before?: string
): Promise<{ success: boolean; messages?: SerializedMessage[]; error?: string }> {
  try {
    const user = await requireAuth();

    // Valida se é membro da conversa no tenant
    const membership = await prisma.conversaMembro.findFirst({
      where: {
        conversaId: conversationId,
        usuarioId: user.id,
        tenantId: user.tenantId,
      },
    });

    if (!membership) {
      return { success: false, error: 'Acesso negado: Você não participa desta conversa.' };
    }

    const messages = await prisma.mensagem.findMany({
      where: {
        conversaId: conversationId,
        tenantId: user.tenantId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
      include: {
        remetente: { select: { id: true, name: true, role: true } },
        anexos: {
          select: { id: true, nomeArquivo: true, tamanhoBytes: true, mimeType: true },
        },
        reacoes: {
          select: { id: true, emoji: true, usuarioId: true },
        },
        respostaA: {
          select: {
            id: true,
            conteudo: true,
            remetente: { select: { name: true } },
          },
        },
      },
    });

    // Serializa reações agrupadas por emoji
    const serialized: SerializedMessage[] = messages.map((msg) => {
      const reactionMap = new Map<string, { count: number; hasReacted: boolean }>();
      for (const r of msg.reacoes) {
        const entry = reactionMap.get(r.emoji) || { count: 0, hasReacted: false };
        entry.count += 1;
        if (r.usuarioId === user.id) entry.hasReacted = true;
        reactionMap.set(r.emoji, entry);
      }

      const reacoesArray = Array.from(reactionMap.entries()).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        hasReacted: data.hasReacted,
      }));

      return {
        id: msg.id,
        conversaId: msg.conversaId,
        remetenteId: msg.remetenteId,
        remetenteNome: msg.remetente.name || 'Usuário',
        remetenteRole: msg.remetente.role,
        conteudo: msg.isDeleted ? 'Mensagem removida' : msg.conteudo,
        isDeleted: msg.isDeleted,
        createdAt: msg.createdAt.toISOString(),
        editedAt: msg.editedAt?.toISOString() || null,
        respostaA: msg.respostaA
          ? {
              id: msg.respostaA.id,
              conteudo: msg.respostaA.conteudo,
              remetenteNome: msg.respostaA.remetente.name || 'Usuário',
            }
          : null,
        anexos: msg.isDeleted ? [] : msg.anexos,
        reacoes: msg.isDeleted ? [] : reacoesArray,
      };
    });

    return { success: true, messages: serialized };
  } catch (error: any) {
    console.error('[getMessages] Erro:', error);
    return { success: false, error: error?.message || 'Falha ao buscar mensagens' };
  }
}

/**
 * 3. Envia uma mensagem em uma conversa
 */
export async function sendMessage(params: {
  conversationId: string;
  conteudo: string;
  replyToId?: string;
  attachmentData?: {
    nomeArquivo: string;
    tamanhoBytes: number;
    mimeType: string;
    storagePath: string;
  };
}): Promise<{ success: boolean; message?: SerializedMessage; error?: string }> {
  try {
    const user = await requireAuth();
    const { conversationId, conteudo: rawConteudo, replyToId, attachmentData } = params;

    // Rate limiting
    if (!checkMessageRateLimit(user.id)) {
      return { success: false, error: 'Você está enviando mensagens rápido demais. Aguarde alguns segundos.' };
    }

    const sanitized = sanitizeMessageContent(rawConteudo);
    if (!sanitized && !attachmentData) {
      return { success: false, error: 'A mensagem não pode estar vazia.' };
    }

    // Valida participação do usuário
    const membership = await prisma.conversaMembro.findFirst({
      where: {
        conversaId: conversationId,
        usuarioId: user.id,
        tenantId: user.tenantId,
      },
      include: {
        conversa: {
          include: {
            membros: { select: { usuarioId: true } },
          },
        },
      },
    });

    if (!membership) {
      return { success: false, error: 'Acesso negado: Você não participa desta conversa.' };
    }

    const now = new Date();

    // Cria a mensagem e anexo em transação
    const created = await prisma.$transaction(async (tx) => {
      const msg = await tx.mensagem.create({
        data: {
          tenantId: user.tenantId,
          conversaId: conversationId,
          remetenteId: user.id,
          conteudo: sanitized,
          respostaAId: replyToId || null,
          createdAt: now,
        },
        include: {
          remetente: { select: { id: true, name: true, role: true } },
          respostaA: {
            select: {
              id: true,
              conteudo: true,
              remetente: { select: { name: true } },
            },
          },
        },
      });

      let anexoResult: any = null;
      if (attachmentData) {
        anexoResult = await tx.mensagemAnexo.create({
          data: {
            tenantId: user.tenantId,
            mensagemId: msg.id,
            nomeArquivo: attachmentData.nomeArquivo,
            tamanhoBytes: attachmentData.tamanhoBytes,
            mimeType: attachmentData.mimeType,
            storagePath: attachmentData.storagePath,
          },
        });
      }

      // Atualiza lastMessageAt da conversa
      await tx.conversa.update({
        where: { id: conversationId },
        data: { lastMessageAt: now },
      });

      // Atualiza lastReadAt do remetente
      await tx.conversaMembro.update({
        where: { id: membership.id },
        data: { lastReadAt: now },
      });

      return { msg, anexo: anexoResult };
    });

    // Dispara eventos em tempo real e Web Push para os membros
    const recipientIds = membership.conversa.membros.map((m) => m.usuarioId);
    dispatchRealtimeAndPush({
      tenantId: user.tenantId,
      conversationId,
      isGroup: membership.conversa.tipo === 'GROUP',
      conversationTitle: membership.conversa.titulo || undefined,
      senderId: user.id,
      senderName: user.name || 'Colega',
      message: {
        id: created.msg.id,
        conteudo: sanitized,
        createdAt: now.toISOString(),
        hasAttachments: !!created.anexo,
      },
      recipientUserIds: recipientIds,
    }).catch(() => {});

    const serialized: SerializedMessage = {
      id: created.msg.id,
      conversaId: created.msg.conversaId,
      remetenteId: created.msg.remetenteId,
      remetenteNome: created.msg.remetente.name || 'Usuário',
      remetenteRole: created.msg.remetente.role,
      conteudo: created.msg.conteudo,
      isDeleted: false,
      createdAt: created.msg.createdAt.toISOString(),
      respostaA: created.msg.respostaA
        ? {
            id: created.msg.respostaA.id,
            conteudo: created.msg.respostaA.conteudo,
            remetenteNome: created.msg.respostaA.remetente.name || 'Usuário',
          }
        : null,
      anexos: created.anexo
        ? [
            {
              id: created.anexo.id,
              nomeArquivo: created.anexo.nomeArquivo,
              tamanhoBytes: created.anexo.tamanhoBytes,
              mimeType: created.anexo.mimeType,
            },
          ]
        : [],
      reacoes: [],
    };

    return { success: true, message: serialized };
  } catch (error: any) {
    console.error('[sendMessage] Erro:', error);
    return { success: false, error: error?.message || 'Falha ao enviar mensagem' };
  }
}

/**
 * 4. Cria conversa direta (1-para-1)
 */
export async function createDirectConversation(targetUserId: string): Promise<{
  success: boolean;
  conversationId?: string;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    if (targetUserId === user.id) {
      return { success: false, error: 'Não é possível iniciar uma conversa consigo mesmo.' };
    }

    // REGRA CRÍTICA MULTI-TENANT: valida se o usuário alvo pertence à mesma organização
    const targetUser = await prisma.user.findFirst({
      where: {
        id: targetUserId,
        tenantId: user.tenantId,
      },
    });

    if (!targetUser) {
      return { success: false, error: 'Usuário não localizado ou pertence a outra organização.' };
    }

    // Verifica se já existe conversa direta entre os dois
    const existingMembership = await prisma.conversaMembro.findFirst({
      where: {
        usuarioId: user.id,
        tenantId: user.tenantId,
        conversa: {
          tipo: 'DIRECT',
          membros: {
            some: { usuarioId: targetUserId },
          },
        },
      },
      select: { conversaId: true },
    });

    if (existingMembership) {
      return { success: true, conversationId: existingMembership.conversaId };
    }

    // Cria nova conversa direta
    const newConv = await prisma.$transaction(async (tx) => {
      const conv = await tx.conversa.create({
        data: {
          tenantId: user.tenantId,
          tipo: 'DIRECT',
          criadoPor: user.id,
        },
      });

      await tx.conversaMembro.createMany({
        data: [
          { tenantId: user.tenantId, conversaId: conv.id, usuarioId: user.id, papel: 'ADMIN' },
          { tenantId: user.tenantId, conversaId: conv.id, usuarioId: targetUserId, papel: 'MEMBER' },
        ],
      });

      return conv;
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'CREATE_DIRECT_CONVERSATION',
      targetType: 'CONVERSATION',
      targetId: newConv.id,
      metadata: { targetUserId },
    });

    return { success: true, conversationId: newConv.id };
  } catch (error: any) {
    console.error('[createDirectConversation] Erro:', error);
    return { success: false, error: error?.message || 'Falha ao iniciar conversa' };
  }
}

/**
 * 5. Cria conversa em grupo
 */
export async function createGroupConversation(params: {
  titulo: string;
  descricao?: string;
  memberUserIds: string[];
}): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  try {
    const user = await requireAuth();
    const { titulo, descricao, memberUserIds } = params;

    if (!titulo?.trim()) {
      return { success: false, error: 'O título do grupo é obrigatório.' };
    }

    // Verifica política de grupos no tenant
    const policy = await prisma.messagingPolicy.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (policy && !policy.groupsEnabled) {
      return { success: false, error: 'A criação de grupos está desativada para sua organização.' };
    }

    // REGRA CRÍTICA MULTI-TENANT: valida todos os participantes no mesmo tenant
    const validUsers = await prisma.user.findMany({
      where: {
        id: { in: memberUserIds },
        tenantId: user.tenantId,
      },
      select: { id: true },
    });

    const validUserIds = validUsers.map((u) => u.id);
    const uniqueMembers = Array.from(new Set([user.id, ...validUserIds]));

    if (uniqueMembers.length < 2) {
      return { success: false, error: 'Adicione pelo menos mais 1 participante da sua organização para criar o grupo.' };
    }

    const group = await prisma.$transaction(async (tx) => {
      const conv = await tx.conversa.create({
        data: {
          tenantId: user.tenantId,
          tipo: 'GROUP',
          titulo: titulo.trim(),
          descricao: descricao?.trim() || null,
          criadoPor: user.id,
        },
      });

      await tx.conversaMembro.createMany({
        data: uniqueMembers.map((memberId) => ({
          tenantId: user.tenantId,
          conversaId: conv.id,
          usuarioId: memberId,
          papel: memberId === user.id ? 'ADMIN' : 'MEMBER',
        })),
      });

      return conv;
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'CREATE_GROUP_CONVERSATION',
      targetType: 'CONVERSATION',
      targetId: group.id,
      metadata: { titulo, memberCount: uniqueMembers.length },
    });

    return { success: true, conversationId: group.id };
  } catch (error: any) {
    console.error('[createGroupConversation] Erro:', error);
    return { success: false, error: error?.message || 'Falha ao criar grupo' };
  }
}

/**
 * 6. Marca conversa como lida
 */
export async function markAsRead(conversationId: string): Promise<{ success: boolean }> {
  try {
    const user = await requireAuth();

    await prisma.conversaMembro.updateMany({
      where: {
        conversaId: conversationId,
        usuarioId: user.id,
        tenantId: user.tenantId,
      },
      data: {
        lastReadAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

/**
 * 7. Exclusão lógica de mensagem (Soft-Delete)
 */
export async function deleteMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    const msg = await prisma.mensagem.findFirst({
      where: { id: messageId, tenantId: user.tenantId },
      include: {
        conversa: {
          include: {
            membros: {
              where: { usuarioId: user.id },
            },
          },
        },
      },
    });

    if (!msg) {
      return { success: false, error: 'Mensagem não encontrada.' };
    }

    const membership = msg.conversa.membros[0];
    const isSender = msg.remetenteId === user.id;
    const isGroupAdmin = membership?.papel === 'ADMIN';

    if (!isSender && !isGroupAdmin) {
      return { success: false, error: 'Permissão insuficiente para remover esta mensagem.' };
    }

    await prisma.mensagem.update({
      where: { id: messageId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        conteudo: 'Mensagem removida',
      },
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'DELETE_MESSAGE',
      targetType: 'MESSAGE',
      targetId: messageId,
      metadata: { conversationId: msg.conversaId },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Erro ao remover mensagem' };
  }
}

/**
 * 8. Adicionar ou remover reação emoji
 */
export async function toggleReaction(messageId: string, emoji: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // Valida se usuário é membro da conversa da mensagem
    const msg = await prisma.mensagem.findFirst({
      where: { id: messageId, tenantId: user.tenantId },
      include: {
        conversa: {
          include: {
            membros: { where: { usuarioId: user.id } },
          },
        },
      },
    });

    if (!msg || msg.conversa.membros.length === 0) {
      return { success: false, error: 'Mensagem não acessível.' };
    }

    const existing = await prisma.mensagemReacao.findUnique({
      where: {
        mensagemId_usuarioId_emoji: {
          mensagemId: messageId,
          usuarioId: user.id,
          emoji,
        },
      },
    });

    if (existing) {
      await prisma.mensagemReacao.delete({
        where: { id: existing.id },
      });
    } else {
      await prisma.mensagemReacao.create({
        data: {
          tenantId: user.tenantId,
          mensagemId: messageId,
          usuarioId: user.id,
          emoji,
        },
      });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Falha ao processar reação' };
  }
}

/**
 * 9. Lista contatos autorizados da organização para "Nova Conversa"
 * Projeção mínima segura (sem senhas, totp, cpf ou dados sensíveis)
 */
export async function getAvailableUsers(): Promise<{
  success: boolean;
  users?: { id: string; name: string; role: string }[];
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const users = await prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        id: { not: user.id },
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: 'asc' },
    });

    return {
      success: true,
      users: users.map((u) => ({
        id: u.id,
        name: u.name || 'Colaborador',
        role: u.role,
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Falha ao buscar usuários' };
  }
}

/**
 * 10. Busca configurações de notificação do usuário
 */
export async function getNotificationSettings() {
  try {
    const user = await requireAuth();

    let settings = await prisma.messagingNotificationSettings.findUnique({
      where: { usuarioId: user.id },
    });

    if (!settings) {
      settings = await prisma.messagingNotificationSettings.create({
        data: {
          tenantId: user.tenantId,
          usuarioId: user.id,
        },
      });
    }

    return { success: true, settings };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * 11. Atualiza configurações de notificação do usuário
 */
export async function updateNotificationSettings(data: {
  directMessages?: boolean;
  groupMessages?: boolean;
  sound?: boolean;
  previewContent?: boolean;
  browserNotifications?: boolean;
}) {
  try {
    const user = await requireAuth();

    const updated = await prisma.messagingNotificationSettings.upsert({
      where: { usuarioId: user.id },
      update: data,
      create: {
        tenantId: user.tenantId,
        usuarioId: user.id,
        ...data,
      },
    });

    return { success: true, settings: updated };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * 12. Gestão Administrativa: Métricas Operacionais
 */
export async function getAdminMessagingMetrics() {
  try {
    const user = await requireRole('ADMIN', 'MASTER');

    const [
      totalUsers,
      totalConversations,
      totalGroups,
      totalMessages,
      totalAttachments,
      activeSubscriptions,
    ] = await Promise.all([
      prisma.user.count({ where: { tenantId: user.tenantId } }),
      prisma.conversa.count({ where: { tenantId: user.tenantId, tipo: 'DIRECT' } }),
      prisma.conversa.count({ where: { tenantId: user.tenantId, tipo: 'GROUP' } }),
      prisma.mensagem.count({ where: { tenantId: user.tenantId, isDeleted: false } }),
      prisma.mensagemAnexo.count({ where: { tenantId: user.tenantId } }),
      prisma.pushSubscription.count({ where: { tenantId: user.tenantId, isActive: true } }),
    ]);

    // Busca política do tenant
    let policy = await prisma.messagingPolicy.findUnique({
      where: { tenantId: user.tenantId },
    });

    if (!policy) {
      policy = await prisma.messagingPolicy.create({
        data: { tenantId: user.tenantId },
      });
    }

    // Últimos logs de auditoria
    const auditLogs = await prisma.messagingAuditLog.findMany({
      where: { tenantId: user.tenantId },
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        actorUser: { select: { name: true, role: true } },
      },
    });

    return {
      success: true,
      metrics: {
        totalUsers,
        totalConversations,
        totalGroups,
        totalMessages,
        totalAttachments,
        activeSubscriptions,
      },
      policy,
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        actorName: log.actorUser.name || 'Usuário',
        actorRole: log.actorUser.role,
        ipAddress: log.ipAddress,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Falha ao buscar métricas de mensagens' };
  }
}

/**
 * 13. Gestão Administrativa: Atualizar Políticas do Tenant
 */
export async function updateAdminMessagingPolicy(data: {
  directEnabled?: boolean;
  groupsEnabled?: boolean;
  attachmentsEnabled?: boolean;
  maxAttachmentBytes?: number;
  retentionDays?: number;
  allowDelete?: boolean;
  allowEdit?: boolean;
  editWindowMinutes?: number;
}) {
  try {
    const user = await requireRole('ADMIN', 'MASTER');

    const updated = await prisma.messagingPolicy.upsert({
      where: { tenantId: user.tenantId },
      update: data,
      create: {
        tenantId: user.tenantId,
        ...data,
      },
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'UPDATE_MESSAGING_POLICY',
      targetType: 'POLICY',
      targetId: updated.id,
      metadata: data,
    });

    return { success: true, policy: updated };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Falha ao atualizar políticas' };
  }
}
