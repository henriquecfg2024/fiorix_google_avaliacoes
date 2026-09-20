'use server';

import { requireAuth, requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import {
  sanitizeMessageContent,
  logMessagingAudit,
} from '@/lib/mensagens/security';
import { checkRateLimit } from '@/lib/mensagens/rate-limiter';
import { dispatchRealtimeAndPush } from '@/lib/mensagens/realtime';

export interface SerializedConversation {
  id: string;
  tipo: 'DIRECT' | 'GROUP';
  titulo: string;
  descricao?: string | null;
  avatarUrl?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  // V1 fields
  pinnedAt?: string | null;
  archivedAt?: string | null;
  draft?: string | null;
  isMuted?: boolean;
  permissaoEnvio?: string;
  permissaoEdicaoDados?: string;
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
  tipo: 'TEXT' | 'VOICE' | 'FIORIX_CARD';
  isDeleted: boolean;
  createdAt: string;
  editedAt?: string | null;
  // V1 fields
  forwardedFrom?: { id: string; remetenteNome: string } | null;
  cardTipo?: string | null;
  cardReferenciaId?: string | null;
  cardMetadata?: Record<string, string | undefined> | null;
  isFavorited?: boolean;
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
        // V1 fields
        pinnedAt: m.pinnedAt?.toISOString() ?? null,
        archivedAt: m.archivedAt?.toISOString() ?? null,
        draft: m.draft ?? null,
        isMuted: m.muted || (m.mutedUntil ? m.mutedUntil > new Date() : false),
        permissaoEnvio: conv.permissaoEnvio,
        permissaoEdicaoDados: conv.permissaoEdicaoDados,
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
        forwardedFrom: {
          select: { id: true, remetente: { select: { name: true } } },
        },
        favoritos: {
          where: { usuarioId: user.id },
          select: { id: true },
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
        tipo: (msg.tipo || 'TEXT') as 'TEXT' | 'VOICE' | 'FIORIX_CARD',
        isDeleted: msg.isDeleted,
        createdAt: msg.createdAt.toISOString(),
        editedAt: msg.editedAt?.toISOString() || null,
        // V1 fields
        forwardedFrom: msg.forwardedFrom
          ? { id: msg.forwardedFrom.id, remetenteNome: msg.forwardedFrom.remetente.name || 'Usuário' }
          : null,
        cardTipo: msg.cardTipo ?? null,
        cardReferenciaId: msg.cardReferenciaId ?? null,
        cardMetadata: (msg.cardMetadata as Record<string, string | undefined> | null) ?? null,
        isFavorited: msg.favoritos.length > 0,
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

    // Rate limiting (compartilhado entre instâncias)
    if (!await checkRateLimit(user.id, 'sendMessage')) {
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
      tipo: 'TEXT',
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
    // Rate limit: criação de grupo (compartilhado)
    if (!await checkRateLimit(user.id, 'createGroup')) {
      return { success: false, error: 'Limite de criação de grupos atingido. Aguarde.' };
    }
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
    // Rate limit: reações (compartilhado)
    if (!await checkRateLimit(user.id, 'toggleReaction')) {
      return { success: false, error: 'Muitas reações consecutivas. Aguarde.' };
    }

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
export async function getAvailableUsers(
  conversationId?: string,
  query?: string
): Promise<{
  success: boolean;
  users?: { id: string; name: string; role: string }[];
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // Exclui membros já na conversa (se conversationId fornecido)
    let excludeIds: string[] = [user.id];
    if (conversationId) {
      const existingMembers = await prisma.conversaMembro.findMany({
        where: { conversaId: conversationId, tenantId: user.tenantId },
        select: { usuarioId: true },
      });
      excludeIds = [...excludeIds, ...existingMembers.map((m) => m.usuarioId)];
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId: user.tenantId,
        id: { notIn: excludeIds },
        ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: { name: 'asc' },
      take: 20,
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

/**
 * 14. Adicionar participante a uma conversa
 * Se a conversa for DIRECT, ela é convertida automaticamente para GROUP.
 */
export async function addMemberToConversation(
  conversationId: string,
  newUserId: string
): Promise<{ success: boolean; error?: string; promoted?: boolean }> {
  try {
    const user = await requireAuth();

    // REGRA CRÍTICA MULTI-TENANT: valida que o novo usuário pertence à mesma organização
    const newUser = await prisma.user.findFirst({
      where: { id: newUserId, tenantId: user.tenantId },
      select: { id: true, name: true },
    });
    if (!newUser) {
      return { success: false, error: 'Usuário não encontrado na sua organização.' };
    }

    // Busca a conversa e valida que o solicitante é membro
    const conversa = await prisma.conversa.findFirst({
      where: {
        id: conversationId,
        tenantId: user.tenantId,
        membros: { some: { usuarioId: user.id } },
      },
      include: {
        membros: {
          include: {
            usuario: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!conversa) {
      return { success: false, error: 'Conversa não encontrada ou acesso negado.' };
    }

    // Verifica se o usuário já é membro
    if (conversa.membros.some((m) => m.usuarioId === newUserId)) {
      return { success: false, error: 'Este usuário já é participante desta conversa.' };
    }

    let promoted = false;

    await prisma.$transaction(async (tx) => {
      // Se for DIRECT, converte para GROUP com título automático
      if (conversa.tipo === 'DIRECT') {
        const memberNames = conversa.membros.map((m) => m.usuario.name || 'Colaborador');
        const groupTitle = `Grupo: ${[...memberNames, newUser.name || 'Colaborador'].join(', ')}`;
        await tx.conversa.update({
          where: { id: conversationId },
          data: { tipo: 'GROUP', titulo: groupTitle },
        });
        promoted = true;
      }

      // Adiciona o novo membro
      await tx.conversaMembro.create({
        data: {
          tenantId: user.tenantId,
          conversaId: conversationId,
          usuarioId: newUserId,
          papel: 'MEMBER',
        },
      });
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'ADD_MEMBER',
      targetType: 'CONVERSATION',
      targetId: conversationId,
      metadata: { newUserId, promoted },
    });

    return { success: true, promoted };
  } catch (error: any) {
    console.error('[addMemberToConversation] Erro:', error);
    return { success: false, error: error?.message || 'Falha ao adicionar participante' };
  }
}

// ═══════════════════════════════════════════════════════════════
// ONDA 2 — NOVAS ACTIONS V1
// ═══════════════════════════════════════════════════════════════

/**
 * Fixar / desafixar conversa para o usuário atual
 */
export async function pinConversation(
  conversationId: string,
  pin: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const membership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId },
    });
    if (!membership) return { success: false, error: 'Não autorizado.' };

    await prisma.conversaMembro.update({
      where: { id: membership.id },
      data: { pinnedAt: pin ? new Date() : null },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Arquivar / desarquivar conversa para o usuário atual
 */
export async function archiveConversation(
  conversationId: string,
  archive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const membership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId },
    });
    if (!membership) return { success: false, error: 'Não autorizado.' };

    await prisma.conversaMembro.update({
      where: { id: membership.id },
      data: { archivedAt: archive ? new Date() : null },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Marcar conversa como não lida (força unreadCount > 0 ao resetar lastReadAt)
 */
export async function markConversationUnread(
  conversationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const membership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId },
    });
    if (!membership) return { success: false, error: 'Não autorizado.' };

    // Retrocede o lastReadAt para um momento antes da última mensagem
    const lastMsg = await prisma.mensagem.findFirst({
      where: { conversaId: conversationId, tenantId: user.tenantId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
    if (lastMsg) {
      const oneDayBefore = new Date(lastMsg.createdAt.getTime() - 86_400_000);
      await prisma.conversaMembro.update({
        where: { id: membership.id },
        data: { lastReadAt: oneDayBefore },
      });
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Salvar rascunho de texto para uma conversa (por usuário)
 */
export async function saveDraft(
  conversationId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const membership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId },
    });
    if (!membership) return { success: false, error: 'Não autorizado.' };

    await prisma.conversaMembro.update({
      where: { id: membership.id },
      data: { draft: text.trim() || null },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Silenciar / reativar notificações de uma conversa
 */
export async function silenceConversation(
  conversationId: string,
  until: Date | null // null = dessilenciar
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const membership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId },
    });
    if (!membership) return { success: false, error: 'Não autorizado.' };

    await prisma.conversaMembro.update({
      where: { id: membership.id },
      data: {
        mutedUntil: until,
        muted: until !== null,
      },
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Editar mensagem dentro da janela de tempo configurada
 */
export async function editMessage(
  messageId: string,
  newContent: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    // Rate limit: edição (compartilhado)
    if (!await checkRateLimit(user.id, 'editMessage')) {
      return { success: false, error: 'Limite de edições atingido. Aguarde.' };
    }
    const msg = await prisma.mensagem.findFirst({
      where: { id: messageId, tenantId: user.tenantId, remetenteId: user.id, isDeleted: false },
    });
    if (!msg) return { success: false, error: 'Mensagem não encontrada ou sem permissão.' };

    // Valida janela de edição via política do tenant
    const policy = await prisma.messagingPolicy.findUnique({ where: { tenantId: user.tenantId } });
    if (policy && !policy.allowEdit) return { success: false, error: 'Edição de mensagens desativada pela organização.' };
    const windowMin = policy?.editWindowMinutes ?? 15;
    const ageMin = (Date.now() - msg.createdAt.getTime()) / 60_000;
    if (ageMin > windowMin) return { success: false, error: `A mensagem só pode ser editada até ${windowMin} minutos após o envio.` };

    const sanitized = sanitizeMessageContent(newContent);
    if (!sanitized) return { success: false, error: 'Conteúdo inválido.' };

    await prisma.mensagem.update({
      where: { id: messageId },
      data: { conteudo: sanitized, editedAt: new Date() },
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'MESSAGE_EDITED',
      targetType: 'MESSAGE',
      targetId: messageId,
      metadata: { conversaId: msg.conversaId },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Encaminhar mensagem para outra conversa
 */
export async function forwardMessage(
  messageId: string,
  targetConversationId: string
): Promise<{ success: boolean; error?: string; newMessageId?: string }> {
  try {
    const user = await requireAuth();

    // Valida acesso à mensagem original
    const original = await prisma.mensagem.findFirst({
      where: { id: messageId, tenantId: user.tenantId, isDeleted: false },
      include: { conversa: { include: { membros: { where: { usuarioId: user.id } } } } },
    });
    if (!original || original.conversa.membros.length === 0)
      return { success: false, error: 'Mensagem não encontrada ou sem permissão.' };

    // Valida acesso à conversa de destino
    const targetMembership = await prisma.conversaMembro.findFirst({
      where: { conversaId: targetConversationId, usuarioId: user.id, tenantId: user.tenantId },
    });
    if (!targetMembership) return { success: false, error: 'Sem acesso à conversa de destino.' };

    if (!await checkRateLimit(user.id, 'forwardMessage')) return { success: false, error: 'Limite de envio atingido. Aguarde.' };

    const newMsg = await prisma.mensagem.create({
      data: {
        tenantId: user.tenantId,
        conversaId: targetConversationId,
        remetenteId: user.id,
        conteudo: original.conteudo,
        tipo: original.tipo,
        forwardedFromId: original.id,
        cardTipo: original.cardTipo,
        cardReferenciaId: original.cardReferenciaId,
        cardMetadata: original.cardMetadata ?? undefined,
      },
    });

    await prisma.conversa.update({
      where: { id: targetConversationId },
      data: { lastMessageAt: new Date() },
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'MESSAGE_FORWARDED',
      targetType: 'MESSAGE',
      targetId: newMsg.id,
      metadata: { originalMessageId: messageId, targetConversationId },
    });

    return { success: true, newMessageId: newMsg.id };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Favoritar / desfavoritar mensagem
 */
export async function favoriteMessage(
  messageId: string,
  favorite: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // Verifica que a mensagem existe e o usuário tem acesso
    const msg = await prisma.mensagem.findFirst({
      where: { id: messageId, tenantId: user.tenantId },
      include: { conversa: { include: { membros: { where: { usuarioId: user.id } } } } },
    });
    if (!msg || msg.conversa.membros.length === 0)
      return { success: false, error: 'Mensagem não encontrada ou sem permissão.' };

    if (favorite) {
      await prisma.mensagemFavorito.upsert({
        where: { mensagemId_usuarioId: { mensagemId: messageId, usuarioId: user.id } },
        create: { tenantId: user.tenantId, mensagemId: messageId, usuarioId: user.id },
        update: {},
      });
    } else {
      await prisma.mensagemFavorito.deleteMany({
        where: { mensagemId: messageId, usuarioId: user.id, tenantId: user.tenantId },
      });
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Busca global de mensagens (apenas nas conversas do usuário)
 */
export async function searchMessages(
  query: string,
  filter: 'all' | 'messages' | 'files' | 'links' = 'all'
): Promise<{
  success: boolean;
  results?: {
    type: 'message' | 'file' | 'link';
    messageId: string;
    conversaId: string;
    conversaTitulo: string;
    conteudo: string;
    remetenteNome: string;
    createdAt: string;
  }[];
  error?: string;
}> {
  try {
    const user = await requireAuth();
    if (!query || query.trim().length < 2) return { success: true, results: [] };
    // Rate limit: busca (compartilhado)
    if (!await checkRateLimit(user.id, 'searchMessages')) {
      return { success: false, error: 'Muitas buscas consecutivas. Aguarde.' };
    }

    // IDs das conversas que o usuário participa (RLS)
    const memberships = await prisma.conversaMembro.findMany({
      where: { usuarioId: user.id, tenantId: user.tenantId },
      select: { conversaId: true, conversa: { select: { titulo: true } } },
    });
    const conversaIds = memberships.map((m) => m.conversaId);
    const titulos: Record<string, string> = {};
    memberships.forEach((m) => {
      titulos[m.conversaId] = m.conversa.titulo ?? '';
    });

    const results: NonNullable<Awaited<ReturnType<typeof searchMessages>>['results']> = [];

    if (filter === 'all' || filter === 'messages') {
      const msgs = await prisma.mensagem.findMany({
        where: {
          conversaId: { in: conversaIds },
          tenantId: user.tenantId,
          isDeleted: false,
          tipo: 'TEXT',
          conteudo: { contains: query, mode: 'insensitive' },
        },
        include: { remetente: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      });
      msgs.forEach((m) => {
        results.push({
          type: 'message',
          messageId: m.id,
          conversaId: m.conversaId,
          conversaTitulo: titulos[m.conversaId] ?? '',
          conteudo: m.conteudo,
          remetenteNome: m.remetente.name ?? '',
          createdAt: m.createdAt.toISOString(),
        });
      });
    }

    if (filter === 'all' || filter === 'files') {
      const anexos = await prisma.mensagemAnexo.findMany({
        where: {
          tenantId: user.tenantId,
          mensagem: { conversaId: { in: conversaIds }, isDeleted: false },
          nomeArquivo: { contains: query, mode: 'insensitive' },
        },
        include: { mensagem: { include: { remetente: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      anexos.forEach((a) => {
        results.push({
          type: 'file',
          messageId: a.mensagemId,
          conversaId: a.mensagem.conversaId,
          conversaTitulo: titulos[a.mensagem.conversaId] ?? '',
          conteudo: `${a.nomeArquivo} (${(a.tamanhoBytes / 1024).toFixed(0)} KB)`,
          remetenteNome: a.mensagem.remetente.name ?? '',
          createdAt: a.createdAt.toISOString(),
        });
      });
    }

    // Ordenar por data decrescente
    results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, results: results.slice(0, 50) };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Listar arquivos de uma conversa (documentos, imagens, links)
 */
export async function getConversationFiles(
  conversationId: string
): Promise<{
  success: boolean;
  files?: { id: string; nomeArquivo: string; mimeType: string; tamanhoBytes: number; remetenteNome: string; createdAt: string }[];
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const membership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId },
    });
    if (!membership) return { success: false, error: 'Não autorizado.' };

    const anexos = await prisma.mensagemAnexo.findMany({
      where: {
        tenantId: user.tenantId,
        mensagem: { conversaId: conversationId, isDeleted: false },
      },
      include: { mensagem: { include: { remetente: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      files: anexos.map((a) => ({
        id: a.id,
        nomeArquivo: a.nomeArquivo,
        mimeType: a.mimeType,
        tamanhoBytes: a.tamanhoBytes,
        remetenteNome: a.mensagem.remetente.name ?? '',
        createdAt: a.createdAt.toISOString(),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Atualizar dados do grupo (nome, descrição, avatar)
 */
export async function updateGroupSettings(
  conversationId: string,
  data: { titulo?: string; descricao?: string; avatarUrl?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const membership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId },
      include: { conversa: true },
    });
    if (!membership) return { success: false, error: 'Não autorizado.' };

    const conversa = membership.conversa;
    if (conversa.tipo !== 'GROUP') return { success: false, error: 'Apenas grupos podem ter dados alterados.' };

    // Valida permissão de edição de dados
    if (conversa.permissaoEdicaoDados === 'ADMIN_ONLY' && membership.papel !== 'ADMIN')
      return { success: false, error: 'Somente administradores podem alterar dados deste grupo.' };

    await prisma.conversa.update({
      where: { id: conversationId },
      data: {
        titulo: data.titulo ?? undefined,
        descricao: data.descricao ?? undefined,
        avatarUrl: data.avatarUrl ?? undefined,
      },
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'GROUP_UPDATED',
      targetType: 'CONVERSATION',
      targetId: conversationId,
      metadata: { changes: data },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Atualizar permissões de privacidade do grupo
 */
export async function updateGroupPrivacy(
  conversationId: string,
  data: { permissaoEnvio?: 'ALL' | 'ADMIN_ONLY'; permissaoEdicaoDados?: 'ALL' | 'ADMIN_ONLY' }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const membership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId, papel: 'ADMIN' },
    });
    if (!membership) return { success: false, error: 'Somente administradores podem alterar permissões do grupo.' };

    await prisma.conversa.update({
      where: { id: conversationId },
      data: {
        permissaoEnvio: data.permissaoEnvio ?? undefined,
        permissaoEdicaoDados: data.permissaoEdicaoDados ?? undefined,
      },
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'GROUP_PRIVACY_CHANGED',
      targetType: 'CONVERSATION',
      targetId: conversationId,
      metadata: data,
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Remover participante do grupo
 */
export async function removeMemberFromConversation(
  conversationId: string,
  targetUserId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // Actor deve ser ADMIN do grupo
    const actorMembership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId, papel: 'ADMIN' },
    });
    if (!actorMembership) return { success: false, error: 'Somente administradores podem remover participantes.' };

    // Não pode remover a si mesmo (use "Sair do grupo")
    if (targetUserId === user.id) return { success: false, error: 'Use "Sair do grupo" para se remover.' };

    await prisma.conversaMembro.deleteMany({
      where: { conversaId: conversationId, usuarioId: targetUserId, tenantId: user.tenantId },
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'MEMBER_REMOVED',
      targetType: 'CONVERSATION',
      targetId: conversationId,
      metadata: { removedUserId: targetUserId },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Promover / rebaixar participante
 */
export async function changeMemberRole(
  conversationId: string,
  targetUserId: string,
  papel: 'ADMIN' | 'MEMBER'
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    const actorMembership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId, papel: 'ADMIN' },
    });
    if (!actorMembership) return { success: false, error: 'Somente administradores podem alterar funções.' };

    await prisma.conversaMembro.updateMany({
      where: { conversaId: conversationId, usuarioId: targetUserId, tenantId: user.tenantId },
      data: { papel },
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'ROLE_CHANGED',
      targetType: 'CONVERSATION',
      targetId: conversationId,
      metadata: { targetUserId, newPapel: papel },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Buscar conversa por ID com validação de membership (para deep links)
 */
export async function getConversationById(
  conversationId: string
): Promise<{ success: boolean; conversation?: SerializedConversation; error?: string }> {
  try {
    const user = await requireAuth();
    const membership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId },
    });
    if (!membership) return { success: false, error: 'Acesso negado.' };

    const result = await getConversations();
    if (!result.success || !result.conversations) return { success: false, error: 'Erro ao buscar conversa.' };
    const conv = result.conversations.find((c) => c.id === conversationId);
    return conv ? { success: true, conversation: conv } : { success: false, error: 'Conversa não encontrada.' };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

// ─── LINKS DE CONVITE DE GRUPO ────────────────────────────────────────

import crypto from 'crypto';

/**
 * Gerar link de convite para grupo
 */
export async function generateGroupInviteLink(
  conversationId: string,
  options?: { expiresInHours?: number; maxUses?: number }
): Promise<{ success: boolean; token?: string; link?: string; error?: string }> {
  try {
    const user = await requireAuth();
    // Rate limit: geração de convites (compartilhado)
    if (!await checkRateLimit(user.id, 'generateInvite')) {
      return { success: false, error: 'Limite de geração de links atingido. Aguarde.' };
    }

    const actorMembership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId, papel: 'ADMIN' },
      include: { conversa: true },
    });
    if (!actorMembership) return { success: false, error: 'Somente administradores podem gerar links de convite.' };
    if (actorMembership.conversa.tipo !== 'GROUP') return { success: false, error: 'Links de convite são apenas para grupos.' };

    const token = crypto.randomBytes(24).toString('base64url');
    const expiresAt = options?.expiresInHours
      ? new Date(Date.now() + options.expiresInHours * 3_600_000)
      : null;

    await prisma.groupInviteLink.create({
      data: {
        tenantId: user.tenantId,
        conversaId: conversationId,
        criadoPorId: user.id,
        token,
        expiresAt,
        maxUses: options?.maxUses ?? null,
      },
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'INVITE_LINK_GENERATED',
      targetType: 'CONVERSATION',
      targetId: conversationId,
      metadata: { expiresAt, maxUses: options?.maxUses },
    });

    return { success: true, token, link: `/mensagens/convite/${token}` };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Revogar link de convite
 */
export async function revokeGroupInviteLink(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();
    const link = await prisma.groupInviteLink.findUnique({ where: { token } });
    if (!link || link.tenantId !== user.tenantId) return { success: false, error: 'Link não encontrado.' };

    const actorMembership = await prisma.conversaMembro.findFirst({
      where: { conversaId: link.conversaId, usuarioId: user.id, tenantId: user.tenantId, papel: 'ADMIN' },
    });
    if (!actorMembership) return { success: false, error: 'Sem permissão para revogar este link.' };

    await prisma.groupInviteLink.update({
      where: { token },
      data: { isActive: false, revokedAt: new Date() },
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'INVITE_LINK_REVOKED',
      targetType: 'CONVERSATION',
      targetId: link.conversaId,
      metadata: { token },
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Ingressar em grupo via token de convite
 */
export async function joinGroupViaInviteLink(
  token: string
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  try {
    const user = await requireAuth();

    const link = await prisma.groupInviteLink.findUnique({
      where: { token },
      include: { conversa: true },
    });

    // Validações de segurança
    if (!link || !link.isActive) return { success: false, error: 'Link inválido ou expirado.' };
    if (link.tenantId !== user.tenantId) return { success: false, error: 'Este link pertence a outra organização.' };
    if (link.expiresAt && link.expiresAt < new Date()) return { success: false, error: 'Este link de convite expirou.' };
    if (link.maxUses !== null && link.usageCount >= link.maxUses) return { success: false, error: 'Este link atingiu o limite de usos.' };

    // Verifica se já é membro
    const existing = await prisma.conversaMembro.findFirst({
      where: { conversaId: link.conversaId, usuarioId: user.id },
    });
    if (existing) return { success: true, conversationId: link.conversaId };

    // Ingresso + incremento de uso
    await prisma.$transaction([
      prisma.conversaMembro.create({
        data: {
          tenantId: user.tenantId,
          conversaId: link.conversaId,
          usuarioId: user.id,
          papel: 'MEMBER',
        },
      }),
      prisma.groupInviteLink.update({
        where: { token },
        data: { usageCount: { increment: 1 } },
      }),
    ]);

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'MEMBER_JOINED_VIA_INVITE',
      targetType: 'CONVERSATION',
      targetId: link.conversaId,
      metadata: { token },
    });

    return { success: true, conversationId: link.conversaId };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Listar links de convite ativos de um grupo
 */
export async function getGroupInviteLinks(
  conversationId: string
): Promise<{
  success: boolean;
  links?: { token: string; usageCount: number; maxUses: number | null; expiresAt: string | null; createdAt: string }[];
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const actorMembership = await prisma.conversaMembro.findFirst({
      where: { conversaId: conversationId, usuarioId: user.id, tenantId: user.tenantId, papel: 'ADMIN' },
    });
    if (!actorMembership) return { success: false, error: 'Sem permissão.' };

    const links = await prisma.groupInviteLink.findMany({
      where: { conversaId: conversationId, tenantId: user.tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      links: links.map((l) => ({
        token: l.token,
        usageCount: l.usageCount,
        maxUses: l.maxUses,
        expiresAt: l.expiresAt?.toISOString() ?? null,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

// ─── FIORIX CARDS ─────────────────────────────────────────────────────

/**
 * Enviar FIORIX Card para uma conversa (referência segura ao objeto interno)
 */
export async function sendFiorixCard(params: {
  conversationId: string;
  cardTipo: 'IT' | 'TAREFA' | 'COMUNICADO';
  cardReferenciaId: string;
  cardMetadata: {
    titulo: string;
    versao?: string;
    situacao?: string;
    [key: string]: string | undefined;
  };
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const user = await requireAuth();

    const membership = await prisma.conversaMembro.findFirst({
      where: { conversaId: params.conversationId, usuarioId: user.id, tenantId: user.tenantId },
      include: { conversa: true },
    });
    if (!membership) return { success: false, error: 'Não autorizado.' };

    // Valida permissão de envio
    if (membership.conversa.permissaoEnvio === 'ADMIN_ONLY' && membership.papel !== 'ADMIN')
      return { success: false, error: 'Somente administradores podem enviar mensagens neste grupo.' };

    if (!await checkRateLimit(user.id, 'sendFiorixCard')) return { success: false, error: 'Limite de envio atingido.' };

    // IMPORTANTE: NÃO copiamos o conteúdo do objeto, apenas a referência e metadados públicos
    const msg = await prisma.mensagem.create({
      data: {
        tenantId: user.tenantId,
        conversaId: params.conversationId,
        remetenteId: user.id,
        conteudo: `[${params.cardTipo}] ${params.cardMetadata.titulo}`, // fallback textual
        tipo: 'FIORIX_CARD',
        cardTipo: params.cardTipo,
        cardReferenciaId: params.cardReferenciaId,
        cardMetadata: params.cardMetadata,
      },
    });

    await prisma.conversa.update({
      where: { id: params.conversationId },
      data: { lastMessageAt: new Date() },
    });

    await logMessagingAudit({
      tenantId: user.tenantId,
      actorUserId: user.id,
      action: 'FIORIX_CARD_SENT',
      targetType: 'MESSAGE',
      targetId: msg.id,
      metadata: { cardTipo: params.cardTipo, cardReferenciaId: params.cardReferenciaId },
    });

    return { success: true, messageId: msg.id };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

/**
 * Validar acesso a um FIORIX Card (chamado ao clicar "Abrir")
 * Revalida permissão em tempo real — posse do card ≠ acesso permanente
 */
export async function validateFiorixCardAccess(
  messageId: string
): Promise<{
  success: boolean;
  cardTipo?: string;
  cardReferenciaId?: string;
  hasAccess?: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const msg = await prisma.mensagem.findFirst({
      where: { id: messageId, tenantId: user.tenantId, tipo: 'FIORIX_CARD' },
      include: { conversa: { include: { membros: { where: { usuarioId: user.id } } } } },
    });

    if (!msg || msg.conversa.membros.length === 0)
      return { success: false, error: 'Card não encontrado ou sem acesso à conversa.' };

    const cardTipo = msg.cardTipo;
    const cardReferenciaId = msg.cardReferenciaId;

    if (!cardTipo || !cardReferenciaId)
      return { success: false, error: 'Card sem tipo ou referência válida.' };

    // ======================================================================
    // VALIDAÇÃO REAL DE ACESSO — FAIL CLOSED
    // Cada tipo exige fonte autorizativa real no banco.
    // Sem fonte real → hasAccess = false (NUNCA fallback permissivo).
    // ======================================================================
    let hasAccess = false;

    switch (cardTipo) {
      case 'IT': {
        // FAIL CLOSED: tabela fiorix_its existe no banco mas NÃO tem modelo Prisma.
        // Sem fonte autorizativa real → acesso negado até implementação.
        hasAccess = false;
        break;
      }

      case 'TAREFA': {
        // FAIL CLOSED: tabela fiorix_tarefas_dados existe no banco mas NÃO tem modelo Prisma.
        // Sem fonte autorizativa real → acesso negado até implementação.
        hasAccess = false;
        break;
      }

      case 'COMUNICADO': {
        // Autorização real usando mesma regra de PessoasRepository.getComunicados:
        // destinatarios contém "TODOS" OR userId OR user.role
        const comunicado = await prisma.fiorixComunicado.findFirst({
          where: {
            id: cardReferenciaId,
            tenantId: user.tenantId,
            status: 'PUBLICADO',
            OR: [
              { destinatarios: { has: 'TODOS' } },
              { destinatarios: { has: user.id } },
              { destinatarios: { has: String(user.role) } },
            ],
          },
        });
        hasAccess = !!comunicado;
        break;
      }

      default:
        hasAccess = false;
    }

    return {
      success: true,
      cardTipo: cardTipo ?? undefined,
      cardReferenciaId: cardReferenciaId ?? undefined,
      hasAccess,
    };
  } catch (error: any) {
    return { success: false, error: error?.message };
  }
}

