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
 * Detecta se o endpoint pertence ao Apple Push Service (Safari / iOS PWA).
 * Endpoints Apple usam o domínio web.push.apple.com.
 */
function isAppleEndpoint(endpoint: string): boolean {
  return endpoint.includes('web.push.apple.com');
}

/**
 * Dispara uma notificação Web Push segura para uma subscription registrada.
 * Compatível com Google FCM (Chrome/Edge/Android) e Apple Push Service (Safari/iOS PWA).
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

  // Opções de envio compatíveis com Apple Push Service e Google FCM
  const sendOptions: webpush.RequestOptions = {
    TTL: 86400, // 24 horas max no buffer do push service
    urgency: 'high' as const,
  };

  // Apple Push Service (web.push.apple.com) exige o header "Topic"
  // para identificar a origem da notificação. O Topic deve ser a URL do site
  // ou o bundle identifier. Usando o domínio do VAPID subject.
  if (isAppleEndpoint(subscription.endpoint)) {
    const topic = payload.tag || 'fiorix-mensagens';
    sendOptions.headers = {
      ...sendOptions.headers,
      'Topic': topic,
    };
  }

  try {
    const stringifiedPayload = JSON.stringify(payload);
    await webpush.sendNotification(pushSubscription, stringifiedPayload, sendOptions);

    // Atualiza lastUsedAt
    prisma.pushSubscription.update({
      where: { id: subscription.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    return { success: true };
  } catch (err: any) {
    const statusCode = err?.statusCode;
    const responseBody = err?.body || err?.message;
    const isApple = isAppleEndpoint(subscription.endpoint);

    console.warn(
      `[WebPush] Falha ao enviar push para subscription ${subscription.id}` +
      ` (status: ${statusCode}, apple: ${isApple}):`,
      responseBody
    );

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

    // 403 Forbidden — comum no Apple Push Service quando VAPID está incorreto
    if (statusCode === 403) {
      console.error(
        `[WebPush] ⛔ 403 Forbidden (${isApple ? 'Apple' : 'FCM'}). ` +
        `Possível problema com VAPID subject ou chaves. Body: ${responseBody}`
      );
    }

    return { success: false, error: `[${statusCode || 'ERR'}] ${err?.message || 'Falha no disparo Web Push'}` };
  }
}
