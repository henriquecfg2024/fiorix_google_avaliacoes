// FIORIX PWA — Service Worker com Web Push & Deep Linking Seguro
const SW_VERSION = 'fiorix-sw-v1.0.2';

self.addEventListener('install', (event) => {
  // Ativação imediata do novo Service Worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Reivindica controle imediato de todos os clientes abertos
  event.waitUntil(self.clients.claim());
});

// Manipulação de Push Notifications recebidas em segundo plano
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'FIORIX',
      body: event.data.text() || 'Você recebeu uma nova mensagem.',
    };
  }

  const title = data.title || 'FIORIX';
  const options = {
    body: data.body || 'Você recebeu uma nova mensagem corporativa.',
    icon: data.icon || '/icon-192.svg',
    badge: data.badge || '/icon-192.svg',
    tag: data.tag || (data.data?.conversationId ? `chat_${data.data.conversationId}` : 'fiorix_msg'),
    renotify: true,
    silent: false, // Força reprodução de som nativo do sistema operacional
    data: {
      url: data.data?.url || (data.data?.conversationId ? `/mensagens?c=${data.data.conversationId}` : '/mensagens'),
      conversationId: data.data?.conversationId,
      timestamp: Date.now(),
    },
    vibrate: [200, 100, 200],
    requireInteraction: false,
  };

  // Envia mensagem para todas as abas abertas do FIORIX para tocarem o som corporativo diretamente
  const notifyWindows = self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
    for (const client of windowClients) {
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

// Clique na notificação — Deep Linking Seguro
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/mensagens';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. Procura se o FIORIX já está aberto em alguma aba
      for (const client of windowClients) {
        if (client.url.includes('/mensagens') || client.url.includes('/minha-it') || client.url.includes('/dashboard')) {
          // Foca na aba existente e navega para a conversa solicitada
          return client.focus().then(() => {
            if (client.navigate) {
              return client.navigate(targetUrl);
            }
          });
        }
      }

      // 2. Se não houver aba aberta, abre uma nova janela
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Fechamento de notificação pelo usuário
self.addEventListener('notificationclose', (event) => {
  // Evento registrado se necessário para telemetria local
});
