// FIORIX PWA — Service Worker com Web Push & Deep Linking Seguro
const SW_VERSION = 'fiorix-sw-v1.0.3';

const PUBLIC_UNAUTHENTICATED_PATHS = ['/login', '/convite', '/verifica', '/esqueci-senha'];

function sanitizeInternalRelativeUrl(rawUrl) {
  const candidate = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (/^\/(?!\/)/.test(candidate)) {
    return candidate;
  }
  return '/mensagens';
}

function isAuthenticatedSameOriginClient(clientUrl) {
  try {
    const parsed = new URL(clientUrl);
    if (parsed.origin !== self.location.origin) return false;
    return !PUBLIC_UNAUTHENTICATED_PATHS.some(
      (pub) => parsed.pathname === pub || parsed.pathname.startsWith(pub + '/')
    );
  } catch {
    return false;
  }
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Limpeza explícita de notificações abertas no logout (LOW-05)
self.addEventListener('message', (event) => {
  if (event?.data?.type === 'FIORIX_LOGOUT_CLEANUP') {
    event.waitUntil(
      self.registration
        .getNotifications()
        .then((notifications) => {
          for (const n of notifications) {
            n.close();
          }
        })
        .catch(() => {})
    );
  }
});

// Manipulação de Push Notifications recebidas em segundo plano
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = {
      title: 'FIORIX',
      body: event.data.text() || 'Você recebeu uma nova mensagem.',
    };
  }

  const title = data.title || 'FIORIX';
  const safeTargetUrl = sanitizeInternalRelativeUrl(
    data.data?.url || (data.data?.conversationId ? `/mensagens?c=${data.data.conversationId}` : '/mensagens')
  );

  const options = {
    body: data.body || 'Você recebeu uma nova mensagem corporativa.',
    icon: data.icon || '/icon-192.svg',
    badge: data.badge || '/icon-192.svg',
    tag: data.tag || (data.data?.conversationId ? `chat_${data.data.conversationId}` : 'fiorix_msg'),
    renotify: true,
    silent: false,
    data: {
      url: safeTargetUrl,
      conversationId: data.data?.conversationId,
      timestamp: Date.now(),
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  // Envia postMessage apenas para abas da mesma origem fora de telas públicas/login
  const notifyWindows = self.clients
    .matchAll({ type: 'window', includeUncontrolled: false })
    .then((windowClients) => {
      for (const client of windowClients) {
        if (!isAuthenticatedSameOriginClient(client.url)) continue;
        client.postMessage({
          type: 'PLAY_NOTIFICATION_SOUND',
          title,
          body: options.body,
          conversationId: options.data?.conversationId,
        });
      }
    });

  const showNotification = self.registration.showNotification(title, options);

  event.waitUntil(Promise.allSettled([showNotification, notifyWindows]));
});

// Clique na notificação — Deep Linking Seguro restrito a caminhos internos
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = sanitizeInternalRelativeUrl(event.notification.data?.url);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: false }).then((windowClients) => {
      for (const client of windowClients) {
        if (!isAuthenticatedSameOriginClient(client.url)) continue;
        if (
          client.url.includes('/mensagens') ||
          client.url.includes('/minha-it') ||
          client.url.includes('/dashboard')
        ) {
          return client.focus().then(() => {
            if (client.navigate) {
              return client.navigate(targetUrl);
            }
          });
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', () => {});
