import { playNotificationChime } from './sound';

export interface ShowDesktopNotificationOptions {
  title: string;
  body: string;
  conversationId?: string;
  onClick?: () => void;
}

let originalTitle: string | null = null;
let titleFlashTimer: ReturnType<typeof setInterval> | null = null;

export function flashDocumentTitle(messageSender: string) {
  if (typeof document === 'undefined') return;
  if (!originalTitle) {
    originalTitle = document.title;
  }

  if (titleFlashTimer) clearInterval(titleFlashTimer);

  let showNew = true;
  titleFlashTimer = setInterval(() => {
    if (document.hidden) {
      document.title = showNew ? `🔔 Nova mensagem de ${messageSender}` : (originalTitle || 'FIORIX');
      showNew = !showNew;
    } else {
      if (titleFlashTimer) clearInterval(titleFlashTimer);
      titleFlashTimer = null;
      if (originalTitle) document.title = originalTitle;
    }
  }, 1200);

  const onFocus = () => {
    if (titleFlashTimer) clearInterval(titleFlashTimer);
    titleFlashTimer = null;
    if (originalTitle) document.title = originalTitle;
    window.removeEventListener('focus', onFocus);
  };
  window.addEventListener('focus', onFocus);
}

/**
 * Dispara aviso sonoro, pisca o título da aba e exibe notificação nativa do Windows/OS se permitida.
 */
export function notifyNewMessage(options: ShowDesktopNotificationOptions) {
  if (typeof window === 'undefined') return;

  const { title, body, conversationId, onClick } = options;

  // 1. Som de notificação
  playNotificationChime();

  // 2. Piscar o título da aba se estiver em segundo plano
  if (document.hidden) {
    flashDocumentTitle(title);
  }

  // 3. Notificação nativa da área de trabalho (Windows Action Center / macOS Notification Center)
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body: body.length > 90 ? `${body.substring(0, 90)}...` : body,
        icon: '/icon-192.svg',
        badge: '/icon-192.svg',
        tag: conversationId ? `chat_${conversationId}` : 'fiorix_new_msg',
        silent: false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (onClick) {
          onClick();
        } else if (conversationId) {
          window.location.href = `/mensagens?c=${conversationId}`;
        }
      };
    } catch (e) {
      console.warn('[DesktopNotification] Erro ao disparar new Notification, tentando via ServiceWorker:', e);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            reg.showNotification(title, {
              body: body.length > 90 ? `${body.substring(0, 90)}...` : body,
              icon: '/icon-192.svg',
              badge: '/icon-192.svg',
              tag: conversationId ? `chat_${conversationId}` : 'fiorix_new_msg',
              data: { url: conversationId ? `/mensagens?c=${conversationId}` : '/mensagens' },
            });
          })
          .catch(() => {});
      }
    }
  }
}
