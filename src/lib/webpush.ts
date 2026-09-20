import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

// Chaves VAPID oficiais ou de contingência para desenvolvimento/homologação
// Em produção, devem ser configuradas via NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY
const DEFAULT_VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || 'BM2Fq6l_W6eH_Rz34e8k45n5G0ZfP_nK3B9A9W_7b7pL7V_2mN9K3B9A9W7b7pL7V2mN9K3B9A9W7b7pL7V2mNA=';
const DEFAULT_VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || 'q9x9K3B9A9W7b7pL7V2mN9K3B9A9W7b7pL7V2mN9K3A=';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:suporte@fiorix.com.br';

let vapidConfigured = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;
  try {
    webpush.setVapidDetails(
      VAPID_SUBJECT,
      DEFAULT_VAPID_PUBLIC,
      DEFAULT_VAPID_PRIVATE
    );
    vapidConfigured = true;
  } catch (err) {
    console.warn('[WebPush] Erro ao inicializar VAPID keys. Gerando chaves automáticas:', err);
    try {
      const generated = webpush.generateVAPIDKeys();
      webpush.setVapidDetails(
        VAPID_SUBJECT,
        generated.publicKey,
        generated.privateKey
      );
      vapidConfigured = true;
    } catch (e) {
      console.error('[WebPush] Falha crítica na configuração do VAPID:', e);
    }
  }
}

export function getVapidPublicKey(): string {
  ensureVapidConfigured();
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    conversationId?: string;
    messageId?: string;
    tenantId?: string;
    timestamp?: number;
  };
  silent?: boolean;
}

/**
 * Dispara uma notificação Web Push segura para uma subscription registrada.
 * Se a subscription foi revogada pelo navegador (410 Gone ou 404 Not Found),
 * desativa automaticamente o registro no banco de dados.
 */
export async function sendWebPushNotification(
  subscription: {
    id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  },
  payload: PushNotificationPayload
): Promise<{ success: boolean; error?: string; expired?: boolean }> {
  ensureVapidConfigured();

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    const stringifiedPayload = JSON.stringify(payload);
    await webpush.sendNotification(pushSubscription, stringifiedPayload, {
      TTL: 86400, // 24 horas max no buffer
      urgency: 'high',
    });

    // Atualiza lastUsedAt
    prisma.pushSubscription.update({
      where: { id: subscription.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return { success: true };
  } catch (err: any) {
    const statusCode = err?.statusCode;
    console.warn(`[WebPush] Falha ao enviar push para subscription ${subscription.id} (status: ${statusCode}):`, err?.message);

    // 410 Gone ou 404 Not Found significa que a subscription expirou ou foi cancelada no navegador
    if (statusCode === 410 || statusCode === 404) {
      try {
        await prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: {
            isActive: false,
            revokedAt: new Date(),
          },
        });
      } catch (dbErr) {
        console.error('[WebPush] Erro ao desativar subscription expirada:', dbErr);
      }
      return { success: false, error: 'Subscription expirada/revogada', expired: true };
    }

    return { success: false, error: err?.message || 'Falha no disparo Web Push' };
  }
}
