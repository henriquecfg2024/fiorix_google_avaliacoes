import type { AlertChannelConfig } from './alert-storage';

export interface WhatsAppDispatchResult {
  success: boolean;
  statusCode?: number;
  errorMessage?: string;
}

export function formatWhatsAppMessage(params: {
  title: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  eventType: string;
  timestamp?: string;
  centralUrl?: string;
}): string {
  const { title, message, severity, eventType, timestamp, centralUrl } = params;

  const severityIcon =
    severity === 'CRITICAL' ? '🚨 *CRÍTICO / INCIDENTE*' : severity === 'WARNING' ? '⚠️ *ATENÇÃO / DEGRADADO*' : 'ℹ️ *NOTIFICAÇÃO OPERACIONAL*';

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const url = centralUrl || 'https://fiorix.app/sistema/operacoes';

  return `🔔 *FIORIX — CENTRAL DE OPERAÇÕES*

${severityIcon}
*Título:* ${title}
*Diagnóstico:* ${message}

📋 *Detalhes Operacionais:*
• Evento: \`${eventType}\`
• Horário: ${formattedTime} (Brasília)
• Ambiente: Cartório (Produção)

🔗 *Acessar Central:*
${url}`;
}

export async function sendAlertWhatsApp(params: {
  config: AlertChannelConfig;
  eventType: string;
  title: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
}): Promise<WhatsAppDispatchResult> {
  const { config, eventType, title, message, severity } = params;

  if (!config.whatsappEnabled) {
    return { success: false, errorMessage: 'Canal de WhatsApp desativado nas configurações' };
  }

  const phone = (config.whatsappPhone || '').replace(/\s+/g, '').replace(/-/g, '');
  if (!phone || phone.length < 8) {
    return { success: false, errorMessage: 'Número de WhatsApp inválido ou não informado' };
  }

  const whatsappCfg = config.whatsappConfig || {};
  const provider = config.whatsappProvider || 'callmebot';
  const textMsg = formatWhatsAppMessage({
    title,
    message,
    severity,
    eventType,
    timestamp: new Date().toISOString(),
  });

  // Provedor 1: CallMeBot (Gratuito / Sem Servidor)
  if (provider === 'callmebot') {
    const apikey = whatsappCfg.apikey;
    if (!apikey) {
      return {
        success: false,
        errorMessage: 'Chave API do CallMeBot não configurada. Veja as instruções para obter gratuitamente.',
      };
    }

    // CallMeBot requer o número no formato internacional com '+' ou código do país
    let cleanPhone = phone;
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.startsWith('55')) {
        cleanPhone = '+' + cleanPhone;
      } else {
        cleanPhone = '+55' + cleanPhone;
      }
    }

    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(cleanPhone)}&text=${encodeURIComponent(textMsg)}&apikey=${encodeURIComponent(apikey)}`;
      const res = await fetch(url, { method: 'GET' });
      const bodyText = await res.text();

      if (!res.ok || bodyText.toLowerCase().includes('error') || bodyText.toLowerCase().includes('not allowed')) {
        return {
          success: false,
          statusCode: res.status,
          errorMessage: `CallMeBot: ${bodyText.slice(0, 120)}`,
        };
      }

      return { success: true, statusCode: res.status };
    } catch (err: any) {
      return {
        success: false,
        errorMessage: err?.message || 'Falha ao conectar com serviço CallMeBot',
      };
    }
  }

  // Provedor 2: Evolution API
  if (provider === 'evolution') {
    const instanceUrl = (whatsappCfg.instanceUrl || '').replace(/\/$/, '');
    const token = whatsappCfg.token;

    if (!instanceUrl || !token) {
      return {
        success: false,
        errorMessage: 'URL da Evolution API ou Token de acesso não preenchidos.',
      };
    }

    try {
      const cleanNumber = phone.replace('+', '');
      const res = await fetch(`${instanceUrl}/message/sendText`, {
        method: 'POST',
        headers: {
          apikey: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: cleanNumber,
          text: textMsg,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          statusCode: res.status,
          errorMessage: `Evolution API erro ${res.status}: ${errorText.slice(0, 120)}`,
        };
      }

      return { success: true, statusCode: res.status };
    } catch (err: any) {
      return { success: false, errorMessage: err?.message || 'Falha de conexão com Evolution API' };
    }
  }

  // Provedor 3: Z-API
  if (provider === 'zapi') {
    const instanceUrl = (whatsappCfg.instanceUrl || '').replace(/\/$/, '');
    const token = whatsappCfg.token;

    if (!instanceUrl || !token) {
      return {
        success: false,
        errorMessage: 'URL da Z-API ou Client-Token não preenchidos.',
      };
    }

    try {
      const cleanNumber = phone.replace('+', '');
      const res = await fetch(`${instanceUrl}/send-text`, {
        method: 'POST',
        headers: {
          'Client-Token': token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: cleanNumber,
          message: textMsg,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return {
          success: false,
          statusCode: res.status,
          errorMessage: `Z-API erro ${res.status}: ${errorText.slice(0, 120)}`,
        };
      }

      return { success: true, statusCode: res.status };
    } catch (err: any) {
      return { success: false, errorMessage: err?.message || 'Falha de conexão com Z-API' };
    }
  }

  return { success: false, errorMessage: `Provedor de WhatsApp desconhecido: ${provider}` };
}
