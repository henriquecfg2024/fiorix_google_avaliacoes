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

    await Promise.allSettled(
      targetUserIds.map(async (userId) => {
        try {
          const channelName = `user_${tenantId}_${userId}`;
          const channel = supabaseAdmin.channel(channelName);
          await channel.send({ type: 'broadcast', event, payload });
        } catch (err) {
          console.warn(`[Realtime] Falha no broadcast ${event} para ${userId}:`, err);
        }
      })
    );
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
 * Executa em paralelo para eliminar latência.
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

  // 1. Notificação em Tempo Real via Supabase Channel Privado (em paralelo para todos os membros)
  const realtimePromise = Promise.allSettled(
    targetUserIds.map(async (userId) => {
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
    })
  );

  // 2. Disparo de Web Push Notification em lote (única consulta no DB)
  const pushPromise = (async () => {
    try {
      const [allSettings, allSubscriptions] = await Promise.all([
        prisma.messagingNotificationSettings.findMany({
          where: { usuarioId: { in: targetUserIds } },
        }),
        prisma.pushSubscription.findMany({
          where: {
            usuarioId: { in: targetUserIds },
            tenantId,
            isActive: true,
          },
        }),
      ]);

      const settingsMap = new Map(allSettings.map((s) => [s.usuarioId, s]));
      const subsByUser = new Map<string, typeof allSubscriptions>();
      for (const sub of allSubscriptions) {
        const list = subsByUser.get(sub.usuarioId) || [];
        list.push(sub);
        subsByUser.set(sub.usuarioId, list);
      }

      const pushPromises: Promise<any>[] = [];

      for (const userId of targetUserIds) {
        const settings = settingsMap.get(userId);
        if (settings && !settings.browserNotifications) continue;
        if (isGroup && settings && !settings.groupMessages) continue;
        if (!isGroup && settings && !settings.directMessages) continue;

        const userSubs = subsByUser.get(userId);
        if (!userSubs || userSubs.length === 0) continue;

        const allowPreview = settings?.previewContent === true;
        const pushTitle = isGroup ? (conversationTitle || 'Grupo') : senderName;
        let pushBody = 'Você recebeu uma nova mensagem no FIORIX.';
        if (allowPreview) {
          pushBody = message.hasAttachments && !message.conteudo
            ? '📎 Enviou um anexo'
            : (message.conteudo.length > 80 ? `${message.conteudo.substring(0, 80)}...` : message.conteudo);
        }

        for (const sub of userSubs) {
          pushPromises.push(
            sendWebPushNotification(sub, {
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
            }).catch((err) => console.warn(`[WebPush] Falha envio:`, err))
          );
        }
      }

      await Promise.allSettled(pushPromises);
    } catch (pushErr) {
      console.warn('[WebPush] Erro ao processar push:', pushErr);
    }
  })();

  await Promise.all([realtimePromise, pushPromise]);
}
