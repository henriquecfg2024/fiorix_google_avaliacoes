import { supabaseAdmin } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { sendWebPushNotification } from '@/lib/webpush';

/**
 * Broadcast genérico para membros de uma conversa (edição, exclusão, reação, typing).
 * Diferente do dispatchRealtimeAndPush, não dispara Web Push — apenas Realtime.
 */
export async function broadcastToConversation(params: {
  tenantId: string;
  conversationId: string;
  senderId: string;
  event: string;
  payload: Record<string, any>;
}) {
  const { tenantId, conversationId, senderId, event, payload } = params;

  try {
    const members = await prisma.conversaMembro.findMany({
      where: { conversaId: conversationId, tenantId },
      select: { usuarioId: true },
    });

    const targetUserIds = members
      .map((m) => m.usuarioId)
      .filter((id) => id !== senderId);

    for (const userId of targetUserIds) {
      try {
        const channelName = `user_${tenantId}_${userId}`;
        const channel = supabaseAdmin.channel(channelName);
        await channel.send({ type: 'broadcast', event, payload });
      } catch (err) {
        console.warn(`[Realtime] Falha no broadcast ${event} para ${userId}:`, err);
      }
    }
  } catch (err) {
    console.warn(`[Realtime] Erro ao buscar membros para broadcast ${event}:`, err);
  }
}

export interface DispatchMessageEventParams {
  tenantId: string;
  conversationId: string;
  isGroup: boolean;
  conversationTitle?: string;
  senderId: string;
  senderName: string;
  message: {
    id: string;
    conteudo: string;
    createdAt: string | Date;
    hasAttachments: boolean;
  };
  recipientUserIds: string[];
}

/**
 * Despacha mensagem em tempo real para os membros da conversa via canais isolados por usuário.
 * Dispara também notificações Web Push respeitando as preferências de privacidade de cada usuário.
 */
export async function dispatchRealtimeAndPush(params: DispatchMessageEventParams) {
  const {
    tenantId,
    conversationId,
    isGroup,
    conversationTitle,
    senderId,
    senderName,
    message,
    recipientUserIds,
  } = params;

  // Filtra apenas destinatários (exclui o próprio remetente)
  const targetUserIds = recipientUserIds.filter((id) => id !== senderId);
  if (targetUserIds.length === 0) return;

  // 1. Notificação em Tempo Real via Supabase Channel Privado (user:${tenantId}:${userId})
  for (const userId of targetUserIds) {
    try {
      const channelName = `user_${tenantId}_${userId}`;
      const channel = supabaseAdmin.channel(channelName);
      
      await channel.send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          conversationId,
          senderId,
          senderName,
          messageId: message.id,
          conteudo: message.conteudo,
          createdAt: message.createdAt,
          hasAttachments: message.hasAttachments,
          isGroup,
          conversationTitle,
        },
      });
    } catch (realtimeErr) {
      console.warn(`[Realtime] Falha no envio para usuário ${userId}:`, realtimeErr);
    }
  }

  // 2. Disparo de Web Push Notification
  // Carrega configurações de notificação e subscriptions ativas dos destinatários em paralelo
  for (const userId of targetUserIds) {
    try {
      // Busca preferências do usuário
      const settings = await prisma.messagingNotificationSettings.findUnique({
        where: { usuarioId: userId },
      });

      // Se desativou notificações no navegador, ignora
      if (settings && !settings.browserNotifications) {
        continue;
      }
      // Se for grupo e desativou grupos, ignora
      if (isGroup && settings && !settings.groupMessages) {
        continue;
      }
      // Se for DM e desativou DMs, ignora
      if (!isGroup && settings && !settings.directMessages) {
        continue;
      }

      // Busca subscriptions ativas
      const activeSubscriptions = await prisma.pushSubscription.findMany({
        where: {
          usuarioId: userId,
          tenantId,
          isActive: true,
        },
      });

      if (activeSubscriptions.length === 0) continue;

      // Monta o payload do Push respeitando a privacidade (previewContent)
      const allowPreview = settings?.previewContent === true;

      const pushTitle = isGroup
        ? (conversationTitle || 'Grupo')
        : senderName;

      let pushBody = 'Você recebeu uma nova mensagem no FIORIX.';
      if (allowPreview) {
        pushBody = message.hasAttachments && !message.conteudo
          ? '📎 Enviou um anexo'
          : (message.conteudo.length > 80 ? `${message.conteudo.substring(0, 80)}...` : message.conteudo);
      }

      for (const sub of activeSubscriptions) {
        await sendWebPushNotification(sub, {
          title: pushTitle,
          body: pushBody,
          icon: '/icon-192.svg',
          badge: '/icon-192.svg',
          tag: `chat_${conversationId}`,
          data: {
            url: `/mensagens?c=${conversationId}`,
            conversationId,
            messageId: message.id,
            tenantId,
            timestamp: Date.now(),
          },
        });
      }
    } catch (pushErr) {
      console.warn(`[WebPush] Erro ao processar push para usuário ${userId}:`, pushErr);
    }
  }
}
