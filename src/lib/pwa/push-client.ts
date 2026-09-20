'use client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });
    return registration;
  } catch (error) {
    console.warn('[PWA] Falha ao registrar Service Worker:', error);
    return null;
  }
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.warn('[PWA] Erro ao obter subscription existente:', error);
    return null;
  }
}

export async function subscribeToPushNotifications(): Promise<{
  success: boolean;
  error?: string;
  subscription?: PushSubscription;
}> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, error: 'Notificações Web Push não suportadas neste navegador.' };
  }

  try {
    // 1. Solicita permissão de notificação
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Permissão de notificação negada pelo usuário.' };
    }

    // 2. Garante registro do SW
    await registerServiceWorker();
    const registration = await navigator.serviceWorker.ready;

    // 3. Busca a chave pública VAPID do servidor
    const resKey = await fetch('/api/push/vapid-public-key');
    if (!resKey.ok) {
      throw new Error('Não foi possível obter a chave pública VAPID.');
    }
    const { publicKey } = await resKey.json();

    const applicationServerKey = urlBase64ToUint8Array(publicKey) as unknown as BufferSource;

    // 4. Cria a subscription no navegador
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    const subJson = subscription.toJSON();

    // 5. Envia ao backend do FIORIX
    const deviceName = detectDeviceName();
    const saveRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        p256dh: subJson.keys?.p256dh,
        auth: subJson.keys?.auth,
        deviceName,
        userAgent: navigator.userAgent,
      }),
    });

    if (!saveRes.ok) {
      const err = await saveRes.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao salvar a subscription no servidor.');
    }

    return { success: true, subscription };
  } catch (error: any) {
    console.error('[PWA] Erro ao registrar Web Push:', error);
    return { success: false, error: error?.message || 'Erro inesperado ao ativar notificações.' };
  }
}

export async function unsubscribeFromPushNotifications(): Promise<{
  success: boolean;
  error?: string;
}> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { success: false, error: 'Web Push não suportado.' };
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();

      // Notifica o backend para revogar
      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || 'Erro ao desativar notificações.' };
  }
}

function detectDeviceName(): string {
  if (typeof window === 'undefined') return 'Dispositivo';
  const ua = navigator.userAgent;
  const isPWA = window.matchMedia('(display-mode: standalone)').matches;
  const pwaTag = isPWA ? ' (PWA)' : '';

  if (/iPhone/i.test(ua)) return `iPhone${pwaTag}`;
  if (/iPad/i.test(ua)) return `iPad${pwaTag}`;
  if (/Android/i.test(ua)) return `Android${pwaTag}`;
  if (/Windows/i.test(ua)) return `Windows PC${pwaTag}`;
  if (/Macintosh/i.test(ua)) return `MacBook/Mac${pwaTag}`;
  if (/Linux/i.test(ua)) return `Linux${pwaTag}`;
  return `Navegador Web${pwaTag}`;
}
