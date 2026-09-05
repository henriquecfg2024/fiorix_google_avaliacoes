import {
  getAlertConfig,
  recordAlertLog,
  AlertChannelConfig,
} from './alert-storage';
import { sendAlertEmail } from './email-dispatcher';
import { sendAlertWhatsApp } from './whatsapp-dispatcher';

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
    if (!config) {
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

    const promises: Promise<any>[] = [];

    // 1. Disparo de Webhook (se ativo e com URL)
    if (config.enabled && config.webhookUrl) {
      promises.push(
        (async () => {
          try {
            const urlLower = config.webhookUrl.toLowerCase();
            const isDiscord = config.channelType === 'discord' || urlLower.includes('discord.com/api/webhooks');
            const isSlack = config.channelType === 'slack' || urlLower.includes('hooks.slack.com');

            let payload: any;
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
              channelType: isDiscord ? 'discord' : isSlack ? 'slack' : 'webhook',
              statusCode: res.status,
              success,
              errorMessage: success ? null : `HTTP ${res.status} ${res.statusText}`,
            });
          } catch (err: any) {
            await recordAlertLog(params.tenantId, {
              eventType: params.eventType,
              title: params.title,
              message: params.message,
              severity: params.severity,
              channelType: 'webhook',
              statusCode: 0,
              success: false,
              errorMessage: err?.message || 'Falha de conexão',
            });
          }
        })()
      );
    }

    // 2. Disparo de E-mail Corporativo
    if (config.emailEnabled && config.emailRecipients) {
      promises.push(
        (async () => {
          const res = await sendAlertEmail({
            config,
            eventType: params.eventType,
            title: params.title,
            message: params.message,
            severity: params.severity,
          });

          await recordAlertLog(params.tenantId, {
            eventType: params.eventType,
            title: params.title,
            message: `E-mail enviado para ${res.recipientsCount} destinatários`,
            severity: params.severity,
            channelType: 'email',
            statusCode: res.statusCode || (res.success ? 200 : 500),
            success: res.success,
            errorMessage: res.errorMessage || null,
          });
        })()
      );
    }

    // 3. Disparo de WhatsApp
    if (config.whatsappEnabled && config.whatsappPhone) {
      promises.push(
        (async () => {
          const res = await sendAlertWhatsApp({
            config,
            eventType: params.eventType,
            title: params.title,
            message: params.message,
            severity: params.severity,
          });

          await recordAlertLog(params.tenantId, {
            eventType: params.eventType,
            title: params.title,
            message: `Mensagem WhatsApp disparada via ${config.whatsappProvider || 'callmebot'}`,
            severity: params.severity,
            channelType: 'whatsapp',
            statusCode: res.statusCode || (res.success ? 200 : 500),
            success: res.success,
            errorMessage: res.errorMessage || null,
          });
        })()
      );
    }

    if (promises.length === 0) return false;

    await Promise.allSettled(promises);
    return true;
  } catch (err: any) {
    console.warn('[Alert Dispatcher] Erro inesperado ao processar alertas:', err?.message);
    return false;
  }
}

export interface TestAlertRequestParams {
  tenantId: string;
  channel: 'all' | 'webhook' | 'email' | 'whatsapp';
  config?: Partial<AlertChannelConfig>;
}

export async function dispatchTestAlert(
  params: TestAlertRequestParams
): Promise<{ success: boolean; channel: string; statusCode?: number; error?: string }> {
  const { tenantId, channel, config: incomingConfig } = params;

  // Carregar config atual do banco e mesclar com as incoming se fornecidas na requisição
  const saved = await getAlertConfig(tenantId);
  const activeConfig: AlertChannelConfig = {
    tenantId,
    name: incomingConfig?.name || saved?.name || 'Canal de Teste',
    webhookUrl: incomingConfig?.webhookUrl ?? saved?.webhookUrl ?? '',
    channelType: incomingConfig?.channelType ?? saved?.channelType ?? 'generic',
    enabled: incomingConfig?.enabled ?? saved?.enabled ?? true,
    notifyConnectorOffline: true,
    notifySyncFailed: true,
    notifyModuleDelayed: true,
    cooldownMinutes: 15,
    emailEnabled: incomingConfig?.emailEnabled ?? saved?.emailEnabled ?? true,
    emailRecipients: incomingConfig?.emailRecipients ?? saved?.emailRecipients ?? '',
    emailProvider: incomingConfig?.emailProvider ?? saved?.emailProvider ?? 'smtp',
    emailConfig: incomingConfig?.emailConfig ?? saved?.emailConfig ?? {},
    whatsappEnabled: incomingConfig?.whatsappEnabled ?? saved?.whatsappEnabled ?? true,
    whatsappProvider: incomingConfig?.whatsappProvider ?? saved?.whatsappProvider ?? 'callmebot',
    whatsappPhone: incomingConfig?.whatsappPhone ?? saved?.whatsappPhone ?? '',
    whatsappConfig: incomingConfig?.whatsappConfig ?? saved?.whatsappConfig ?? {},
  };

  if (channel === 'email') {
    const res = await sendAlertEmail({
      config: activeConfig,
      eventType: 'test',
      title: 'Teste de Alerta Operacional por E-mail',
      message: 'Este é um e-mail de validação disparado pela Central de Operações do FIORIX para confirmar que o canal corporativo está funcionando perfeitamente.',
      severity: 'INFO',
    });

    await recordAlertLog(tenantId, {
      eventType: 'test',
      title: 'Teste de Notificação por E-mail',
      message: res.success ? `Enviado com sucesso para: ${activeConfig.emailRecipients}` : (res.errorMessage || 'Falha no envio de e-mail'),
      severity: 'INFO',
      channelType: 'email',
      statusCode: res.statusCode || (res.success ? 200 : 500),
      success: res.success,
      errorMessage: res.errorMessage || null,
    });

    return {
      success: res.success,
      channel: 'email',
      statusCode: res.statusCode,
      error: res.errorMessage,
    };
  }

  if (channel === 'whatsapp') {
    const res = await sendAlertWhatsApp({
      config: activeConfig,
      eventType: 'test',
      title: 'Teste de Alerta Operacional no WhatsApp',
      message: 'Olá! Este é um teste da Central de Operações do FIORIX. Seu WhatsApp foi conectado com sucesso para receber alertas de telemetria.',
      severity: 'INFO',
    });

    await recordAlertLog(tenantId, {
      eventType: 'test',
      title: 'Teste de Notificação por WhatsApp',
      message: res.success ? `Mensagem enviada com sucesso para ${activeConfig.whatsappPhone}` : (res.errorMessage || 'Falha no envio do WhatsApp'),
      severity: 'INFO',
      channelType: 'whatsapp',
      statusCode: res.statusCode || (res.success ? 200 : 500),
      success: res.success,
      errorMessage: res.errorMessage || null,
    });

    return {
      success: res.success,
      channel: 'whatsapp',
      statusCode: res.statusCode,
      error: res.errorMessage,
    };
  }

  // Canal Webhook
  try {
    const webhookUrl = activeConfig.webhookUrl;
    if (!webhookUrl) {
      return { success: false, channel: 'webhook', error: 'URL do Webhook não preenchida' };
    }

    const urlLower = webhookUrl.toLowerCase();
    const isDiscord = activeConfig.channelType === 'discord' || urlLower.includes('discord.com/api/webhooks');
    const isSlack = activeConfig.channelType === 'slack' || urlLower.includes('hooks.slack.com');

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
      title: 'Teste de Notificação por Webhook',
      message: 'Envio manual de teste de webhook',
      severity: 'INFO',
      channelType: isDiscord ? 'discord' : isSlack ? 'slack' : 'webhook',
      statusCode: res.status,
      success,
      errorMessage: success ? null : `HTTP ${res.status} ${res.statusText}`,
    });

    return {
      success,
      channel: 'webhook',
      statusCode: res.status,
      error: success ? undefined : `Destino retornou HTTP ${res.status}: ${res.statusText}`,
    };
  } catch (err: any) {
    return {
      success: false,
      channel: 'webhook',
      error: err?.message || 'Falha ao conectar com o Webhook',
    };
  }
}
