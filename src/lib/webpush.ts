import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

// VAPID — chaves obrigatórias via variáveis de ambiente.
// NUNCA hardcodar chaves privadas no código-fonte.
// Variáveis necessárias:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY — chave pública (exposta ao frontend)
//   VAPID_PRIVATE_KEY — chave privada (somente servidor, nunca no frontend)
//   VAPID_SUBJECT — identificação do remetente (mailto: ou URL)
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:suporte@fiorix.com.br';

let vapidConfigured = false;
let vapidAvailable = false;

function ensureVapidConfigured() {
  if (vapidConfigured) return;
  vapidConfigured = true; // Marca como tentado para não repetir

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error(
      '[WebPush] ⛔ VAPID keys não configuradas. ' +
      'Defina NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY nas variáveis de ambiente. ' +
      'Web Push ficará desabilitado.'
    );
    vapidAvailable = false;
    return;
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    vapidAvailable = true;
  } catch (err) {
    console.error('[WebPush] ⛔ Falha crítica na configuração VAPID:', err);
    vapidAvailable = false;
  }
}

/** Verifica se o Web Push está disponível (VAPID configurado corretamente) */
export function isWebPushAvailable(): boolean {
  ensureVapidConfigured();
  return vapidAvailable;
}

export function getVapidPublicKey(): string {
  ensureVapidConfigured();
  return VAPID_PUBLIC;
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
  if (!vapidAvailable) {
    return { success: false, error: 'Web Push não disponível: VAPID keys não configuradas.' };
  }


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
