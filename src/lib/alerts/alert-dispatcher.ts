import {
  getAlertConfig,
  recordAlertLog,
  AlertChannelConfig,
} from './alert-storage';

export type AlertEventType = 'connector_offline' | 'sync_failed' | 'module_delayed' | 'test';

export interface DispatchAlertParams {
  tenantId: string;
  eventType: AlertEventType;
  title: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  metadata?: Record<string, any>;
}

export function formatDiscordPayload(
  title: string,
  message: string,
  severity: 'CRITICAL' | 'WARNING' | 'INFO',
  metadata?: Record<string, any>
) {
  const colorMap = {
    CRITICAL: 15548997, // Vermelho (#ED4245)
    WARNING: 16753920,  // Âmbar/Laranja (#FFA500)
    INFO: 5793266,      // Azul/Cyan (#5865F2)
  };

  const fields = metadata
    ? Object.entries(metadata).map(([k, v]) => ({
        name: k,
        value: String(v),
        inline: true,
      }))
    : [];

  return {
    embeds: [
      {
        title: `${severity === 'CRITICAL' ? '🚨' : severity === 'WARNING' ? '⚠️' : 'ℹ️'} [FIORIX Operações] ${title}`,
        description: message,
        color: colorMap[severity] || 5793266,
        fields,
        footer: {
          text: 'FIORIX Central de Operações • https://fiorix.app/sistema/operacoes',
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export function formatSlackPayload(
  title: string,
  message: string,
  severity: 'CRITICAL' | 'WARNING' | 'INFO',
  metadata?: Record<string, any>
) {
  const icon = severity === 'CRITICAL' ? '🚨' : severity === 'WARNING' ? '⚠️' : 'ℹ️';
  let text = `${icon} *[FIORIX Operações]* ${title}\n${message}\n\n*Painel*: https://fiorix.app/sistema/operacoes`;

  if (metadata) {
    const metaStr = Object.entries(metadata)
      .map(([k, v]) => `• *${k}*: ${v}`)
      .join('\n');
    text += `\n\n${metaStr}`;
  }

  return {
    text,
  };
}

export function formatGenericPayload(
  tenantId: string,
  eventType: string,
  title: string,
  message: string,
  severity: 'CRITICAL' | 'WARNING' | 'INFO',
  metadata?: Record<string, any>
) {
  return {
    platform: 'FIORIX',
    tenantId,
    event: eventType,
    severity,
    title,
    message,
    metadata: metadata || {},
    timestamp: new Date().toISOString(),
    dashboardUrl: 'https://fiorix.app/sistema/operacoes',
  };
}

export async function dispatchAlert(params: DispatchAlertParams): Promise<boolean> {
  try {
    const config = await getAlertConfig(params.tenantId);
    if (!config || !config.enabled || !config.webhookUrl) {
      return false;
    }

    // Verificar se a categoria do alerta está habilitada
    if (params.eventType === 'connector_offline' && !config.notifyConnectorOffline) return false;
    if (params.eventType === 'sync_failed' && !config.notifySyncFailed) return false;
    if (params.eventType === 'module_delayed' && !config.notifyModuleDelayed) return false;

    // Verificar cooldown para evitar flood de mensagens
    if (config.lastTriggeredAt && params.eventType !== 'test') {
      const last = new Date(config.lastTriggeredAt).getTime();
      const diffMinutes = (Date.now() - last) / (1000 * 60);
      if (diffMinutes < config.cooldownMinutes) {
        console.info(`[Alert Dispatcher] Alerta suprimido por cooldown (${diffMinutes.toFixed(1)}m < ${config.cooldownMinutes}m)`);
        return false;
      }
    }

    let payload: any;
    const urlLower = config.webhookUrl.toLowerCase();
    const isDiscord = config.channelType === 'discord' || urlLower.includes('discord.com/api/webhooks');
    const isSlack = config.channelType === 'slack' || urlLower.includes('hooks.slack.com');

    if (isDiscord) {
      payload = formatDiscordPayload(params.title, params.message, params.severity, params.metadata);
    } else if (isSlack) {
      payload = formatSlackPayload(params.title, params.message, params.severity, params.metadata);
    } else {
      payload = formatGenericPayload(
        params.tenantId,
        params.eventType,
        params.title,
        params.message,
        params.severity,
        params.metadata
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const success = res.ok;
    await recordAlertLog(params.tenantId, {
      eventType: params.eventType,
      title: params.title,
      message: params.message,
      severity: params.severity,
      channelType: isDiscord ? 'discord' : isSlack ? 'slack' : 'generic',
      statusCode: res.status,
      success,
      errorMessage: success ? null : `HTTP ${res.status} ${res.statusText}`,
    });

    return success;
  } catch (err: any) {
    console.warn('[Alert Dispatcher] Falha ao enviar alerta:', err?.message);
    await recordAlertLog(params.tenantId, {
      eventType: params.eventType,
      title: params.title,
      message: params.message,
      severity: params.severity,
      channelType: 'unknown',
      statusCode: 0,
      success: false,
      errorMessage: err?.message || 'Falha de conexão',
    });
    return false;
  }
}

export async function dispatchTestAlert(
  tenantId: string,
  webhookUrl: string,
  channelType: 'discord' | 'slack' | 'generic'
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const urlLower = webhookUrl.toLowerCase();
    const isDiscord = channelType === 'discord' || urlLower.includes('discord.com/api/webhooks');
    const isSlack = channelType === 'slack' || urlLower.includes('hooks.slack.com');

    let payload: any;
    if (isDiscord) {
      payload = formatDiscordPayload(
        'Teste de Notificação Operacional',
        'Este é um envio de teste originado pela Central de Operações do FIORIX para validar a conectividade do seu webhook.',
        'INFO',
        {
          Ambiente: 'Produção',
          Status: '100% Conectado',
        }
      );
    } else if (isSlack) {
      payload = formatSlackPayload(
        'Teste de Notificação Operacional',
        'Este é um envio de teste originado pela Central de Operações do FIORIX para validar a conectividade do seu webhook.',
        'INFO',
        {
          Ambiente: 'Produção',
          Status: '100% Conectado',
        }
      );
    } else {
      payload = formatGenericPayload(
        tenantId,
        'test',
        'Teste de Notificação Operacional',
        'Envio de teste para validação de conectividade com a Central de Operações.',
        'INFO',
        {
          Ambiente: 'Produção',
        }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const success = res.ok;
    await recordAlertLog(tenantId, {
      eventType: 'test',
      title: 'Teste de Notificação Operacional',
      message: 'Envio manual de teste de webhook',
      severity: 'INFO',
      channelType: isDiscord ? 'discord' : isSlack ? 'slack' : 'generic',
      statusCode: res.status,
      success,
      errorMessage: success ? null : `HTTP ${res.status}`,
    });

    if (success) {
      return { success: true, statusCode: res.status };
    } else {
      return {
        success: false,
        statusCode: res.status,
        error: `O servidor de destino retornou HTTP ${res.status}: ${res.statusText}`,
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Falha de conexão com a URL informada',
    };
  }
}
