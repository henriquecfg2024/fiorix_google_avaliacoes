import { prisma } from '@/lib/prisma';
import { randomUUID } from 'node:crypto';
import {
  decryptFieldSecret,
  encryptFieldSecret,
} from '@/lib/security/field-crypto';

export interface SmtpEmailConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  from?: string;
  resendApiKey?: string;
}

export interface WhatsAppConfig {
  apikey?: string;
  instanceUrl?: string;
  token?: string;
  chatId?: string;
  /** Lista de telefones adicionais com suas API Keys (CallMeBot) */
  phones?: Array<{ phone: string; apikey: string; label?: string }>;
}

export interface AlertChannelConfig {
  id?: string;
  tenantId: string;
  name: string;
  webhookUrl: string;
  channelType: 'discord' | 'slack' | 'generic';
  enabled: boolean;
  notifyConnectorOffline: boolean;
  notifySyncFailed: boolean;
  notifyModuleDelayed: boolean;
  cooldownMinutes: number;
  lastTriggeredAt?: string | null;

  // E-mail corporativo nativo
  emailEnabled?: boolean;
  emailRecipients?: string;
  emailProvider?: 'smtp' | 'resend';
  emailConfig?: SmtpEmailConfig;

  // WhatsApp nativo (CallMeBot / Evolution / Z-API)
  whatsappEnabled?: boolean;
  whatsappProvider?: 'callmebot' | 'evolution' | 'zapi';
  whatsappPhone?: string;
  whatsappConfig?: WhatsAppConfig;
}

export interface AlertLogItem {
  id: string;
  tenantId: string;
  eventType: string;
  title: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  channelType: string;
  statusCode?: number | null;
  success: boolean;
  errorMessage?: string | null;
  createdAt: string;
}

export interface ConnectorTelemetryData {
  tenantId: string;
  connectorId: string;
  uptimeSeconds?: number | null;
  ramMb?: number | null;
  cpuPercent?: number | null;
  queuePending?: number | null;
  queueFailed?: number | null;
  details?: Record<string, any> | null;
  recordedAt?: string | null;
}

export const ALERT_SECRET_MASK = '••••••••';

export function maskWebhookSecretUrl(rawUrl?: string | null): string {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes(ALERT_SECRET_MASK)) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return `${parsed.origin}/${ALERT_SECRET_MASK}`;
  } catch {
    return ALERT_SECRET_MASK;
  }
}

export function maskAlertConfigSecrets<T extends Partial<AlertChannelConfig> | null | undefined>(
  config: T
): T {
  if (!config) return config;

  const masked: any = {
    ...config,
    webhookUrl: config.webhookUrl ? maskWebhookSecretUrl(config.webhookUrl) : '',
  };

  if (config.emailConfig && typeof config.emailConfig === 'object') {
    masked.emailConfig = {
      ...config.emailConfig,
      ...(config.emailConfig.pass ? { pass: ALERT_SECRET_MASK } : {}),
      ...(config.emailConfig.resendApiKey ? { resendApiKey: ALERT_SECRET_MASK } : {}),
    };
  }

  if (config.whatsappConfig && typeof config.whatsappConfig === 'object') {
    const rawPhones = Array.isArray(config.whatsappConfig.phones)
      ? config.whatsappConfig.phones
      : undefined;
    masked.whatsappConfig = {
      ...config.whatsappConfig,
      ...(config.whatsappConfig.apikey ? { apikey: ALERT_SECRET_MASK } : {}),
      ...(config.whatsappConfig.token ? { token: ALERT_SECRET_MASK } : {}),
      ...(rawPhones
        ? {
            phones: rawPhones.map((p) => ({
              ...p,
              apikey: p?.apikey ? ALERT_SECRET_MASK : '',
            })),
          }
        : {}),
    };
  }

  return masked as T;
}

export function restoreMaskedAlertSecrets<T extends Record<string, any>>(
  incoming: T,
  existing: AlertChannelConfig | null | undefined
): T {
  if (!existing) return incoming;

  const restored: any = { ...incoming };

  // 1. Restaura webhookUrl se o cliente reenviou o valor mascarado sem alterá-lo
  if (typeof restored.webhookUrl === 'string' && restored.webhookUrl.includes(ALERT_SECRET_MASK)) {
    restored.webhookUrl = existing.webhookUrl || '';
  }

  // 2. Restaura credenciais de E-mail (SMTP pass / Resend API Key)
  if (restored.emailConfig && typeof restored.emailConfig === 'object') {
    const nextEmail = { ...restored.emailConfig };
    if (
      (nextEmail.pass === ALERT_SECRET_MASK || nextEmail.pass === '' || nextEmail.pass === undefined) &&
      existing.emailConfig?.pass
    ) {
      if (nextEmail.pass === ALERT_SECRET_MASK || !nextEmail.pass) {
        nextEmail.pass = existing.emailConfig.pass;
      }
    }
    if (nextEmail.resendApiKey === ALERT_SECRET_MASK && existing.emailConfig?.resendApiKey) {
      nextEmail.resendApiKey = existing.emailConfig.resendApiKey;
    }
    restored.emailConfig = nextEmail;
  }

  // 3. Restaura credenciais de WhatsApp (API Key principal, token e chaves por número adicional)
  if (restored.whatsappConfig && typeof restored.whatsappConfig === 'object') {
    const existingPhoneKeys = new Map<string, string>();
    if (existing.whatsappPhone && existing.whatsappConfig?.apikey) {
      existingPhoneKeys.set(existing.whatsappPhone.trim(), existing.whatsappConfig.apikey);
    }
    if (Array.isArray(existing.whatsappConfig?.phones)) {
      for (const p of existing.whatsappConfig.phones) {
        if (p?.phone && p?.apikey) {
          existingPhoneKeys.set(String(p.phone).trim(), String(p.apikey));
        }
      }
    }

    const nextWa = { ...restored.whatsappConfig };
    if (nextWa.apikey === ALERT_SECRET_MASK) {
      const targetPrimaryPhone = String(restored.whatsappPhone ?? existing.whatsappPhone ?? '').trim();
      nextWa.apikey =
        (targetPrimaryPhone && existingPhoneKeys.get(targetPrimaryPhone)) ||
        existing.whatsappConfig?.apikey ||
        '';
    }
    if (nextWa.token === ALERT_SECRET_MASK && existing.whatsappConfig?.token) {
      nextWa.token = existing.whatsappConfig.token;
    }
    if (Array.isArray(nextWa.phones)) {
      nextWa.phones = nextWa.phones.map((p: any) => {
        if (p && p.apikey === ALERT_SECRET_MASK) {
          const phoneKey = String(p.phone || '').trim();
          return {
            ...p,
            apikey: existingPhoneKeys.get(phoneKey) || '',
          };
        }
        return p;
      });
    }
    restored.whatsappConfig = nextWa;
  }

  return restored as T;
}

// As tabelas já existem no PostgreSQL em produção. Evita rodar 13 comandos DDL pesados em cada invocação serverless.
let tablesInitialized = true;
let detailsColumnInitialized = false;

async function ensureConnectorDetailsColumn(): Promise<void> {
  if (detailsColumnInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.fiorix_connector_telemetry
        ADD COLUMN IF NOT EXISTS details JSONB;
    `);
    detailsColumnInitialized = true;
  } catch {
    // Mantém operação resiliente caso a tabela ainda vá ser criada por ensureAlertTablesExist
  }
}

export async function ensureAlertTablesExist(force = false): Promise<void> {
  if (tablesInitialized && !force) return;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.fiorix_operations_alert_channels (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT 'Webhook Principal',
        webhook_url TEXT NOT NULL DEFAULT '',
        channel_type TEXT NOT NULL DEFAULT 'generic',
        enabled BOOLEAN NOT NULL DEFAULT true,
        notify_connector_offline BOOLEAN NOT NULL DEFAULT true,
        notify_sync_failed BOOLEAN NOT NULL DEFAULT true,
        notify_module_delayed BOOLEAN NOT NULL DEFAULT true,
        cooldown_minutes INT NOT NULL DEFAULT 15,
        last_triggered_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_tenant_alert_channel UNIQUE (tenant_id)
      );
    `);

    // Retrocompatibilidade / Migração de colunas para E-mail e WhatsApp
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.fiorix_operations_alert_channels 
        ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.fiorix_operations_alert_channels 
        ADD COLUMN IF NOT EXISTS email_recipients TEXT NOT NULL DEFAULT '';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.fiorix_operations_alert_channels 
        ADD COLUMN IF NOT EXISTS email_provider TEXT NOT NULL DEFAULT 'smtp';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.fiorix_operations_alert_channels 
        ADD COLUMN IF NOT EXISTS email_config JSONB;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.fiorix_operations_alert_channels 
        ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT false;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.fiorix_operations_alert_channels 
        ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT NOT NULL DEFAULT 'callmebot';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.fiorix_operations_alert_channels 
        ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT NOT NULL DEFAULT '';
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE public.fiorix_operations_alert_channels 
        ADD COLUMN IF NOT EXISTS whatsapp_config JSONB;
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.fiorix_operations_alert_logs (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'WARNING',
        channel_type TEXT NOT NULL,
        status_code INT,
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_alert_logs_tenant_created 
        ON public.fiorix_operations_alert_logs (tenant_id, created_at DESC);
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.fiorix_connector_telemetry (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        connector_id TEXT NOT NULL,
        uptime_seconds INT,
        ram_mb INT,
        cpu_percent INT,
        queue_pending INT,
        queue_failed INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_conn_telemetry_tenant_conn 
        ON public.fiorix_connector_telemetry (tenant_id, connector_id, created_at DESC);
    `);

    await prisma.$executeRawUnsafe(
      `ALTER TABLE public.fiorix_operations_alert_channels ENABLE ROW LEVEL SECURITY;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE public.fiorix_operations_alert_logs ENABLE ROW LEVEL SECURITY;`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE public.fiorix_connector_telemetry ENABLE ROW LEVEL SECURITY;`
    );
    tablesInitialized = true;
  } catch (err) {
    console.error('Falha ao inicializar tabelas de telemetria e alertas:', err);
  }
}

function encryptAlertSecret(raw?: string | null): string {
  if (!raw) return '';
  return encryptFieldSecret(raw, 'alert-channels');
}

function decryptAlertSecret(stored?: string | null): string {
  if (!stored) return '';
  try {
    return decryptFieldSecret(stored, 'alert-channels');
  } catch (err) {
    console.warn('[Alert Storage] Falha ao descriptografar credencial de alerta:', err);
    return '';
  }
}

export function encryptEmailConfigAtRest(emailConfig?: SmtpEmailConfig): SmtpEmailConfig {
  if (!emailConfig || typeof emailConfig !== 'object') return {};
  return {
    ...emailConfig,
    ...(emailConfig.pass ? { pass: encryptAlertSecret(emailConfig.pass) } : {}),
    ...(emailConfig.resendApiKey ? { resendApiKey: encryptAlertSecret(emailConfig.resendApiKey) } : {}),
  };
}

export function decryptEmailConfigAtRest(emailConfig?: SmtpEmailConfig): SmtpEmailConfig {
  if (!emailConfig || typeof emailConfig !== 'object') return {};
  return {
    ...emailConfig,
    ...(emailConfig.pass ? { pass: decryptAlertSecret(emailConfig.pass) } : {}),
    ...(emailConfig.resendApiKey ? { resendApiKey: decryptAlertSecret(emailConfig.resendApiKey) } : {}),
  };
}

export function encryptWhatsAppConfigAtRest(whatsappConfig?: WhatsAppConfig): WhatsAppConfig {
  if (!whatsappConfig || typeof whatsappConfig !== 'object') return {};
  return {
    ...whatsappConfig,
    ...(whatsappConfig.apikey ? { apikey: encryptAlertSecret(whatsappConfig.apikey) } : {}),
    ...(whatsappConfig.token ? { token: encryptAlertSecret(whatsappConfig.token) } : {}),
    ...(Array.isArray(whatsappConfig.phones)
      ? {
          phones: whatsappConfig.phones.map((p) => ({
            ...p,
            apikey: p?.apikey ? encryptAlertSecret(p.apikey) : '',
          })),
        }
      : {}),
  };
}

export function decryptWhatsAppConfigAtRest(whatsappConfig?: WhatsAppConfig): WhatsAppConfig {
  if (!whatsappConfig || typeof whatsappConfig !== 'object') return {};
  return {
    ...whatsappConfig,
    ...(whatsappConfig.apikey ? { apikey: decryptAlertSecret(whatsappConfig.apikey) } : {}),
    ...(whatsappConfig.token ? { token: decryptAlertSecret(whatsappConfig.token) } : {}),
    ...(Array.isArray(whatsappConfig.phones)
      ? {
          phones: whatsappConfig.phones.map((p) => ({
            ...p,
            apikey: p?.apikey ? decryptAlertSecret(p.apikey) : '',
          })),
        }
      : {}),
  };
}

export async function getAlertConfig(tenantId: string): Promise<AlertChannelConfig | null> {
  await ensureAlertTablesExist();

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT 
        id,
        tenant_id as "tenantId",
        name,
        webhook_url as "webhookUrl",
        channel_type as "channelType",
        enabled,
        notify_connector_offline as "notifyConnectorOffline",
        notify_sync_failed as "notifySyncFailed",
        notify_module_delayed as "notifyModuleDelayed",
        cooldown_minutes as "cooldownMinutes",
        last_triggered_at as "lastTriggeredAt",
        email_enabled as "emailEnabled",
        email_recipients as "emailRecipients",
        email_provider as "emailProvider",
        email_config as "emailConfig",
        whatsapp_enabled as "whatsappEnabled",
        whatsapp_provider as "whatsappProvider",
        whatsapp_phone as "whatsappPhone",
        whatsapp_config as "whatsappConfig"
      FROM public.fiorix_operations_alert_channels
      WHERE tenant_id = $1
      LIMIT 1;
    `,
      tenantId
    );

    if (rows.length === 0) return null;

    const r = rows[0];
    const parsedEmailConfig = r.emailConfig
      ? typeof r.emailConfig === 'string'
        ? JSON.parse(r.emailConfig)
        : r.emailConfig
      : {};
    const parsedWhatsAppConfig = r.whatsappConfig
      ? typeof r.whatsappConfig === 'string'
        ? JSON.parse(r.whatsappConfig)
        : r.whatsappConfig
      : {};

    return {
      id: r.id,
      tenantId: r.tenantId,
      name: r.name,
      webhookUrl: decryptAlertSecret(r.webhookUrl),
      channelType: r.channelType,
      enabled: Boolean(r.enabled),
      notifyConnectorOffline: Boolean(r.notifyConnectorOffline),
      notifySyncFailed: Boolean(r.notifySyncFailed),
      notifyModuleDelayed: Boolean(r.notifyModuleDelayed),
      cooldownMinutes: Number(r.cooldownMinutes || 15),
      lastTriggeredAt: r.lastTriggeredAt ? new Date(r.lastTriggeredAt).toISOString() : null,
      emailEnabled: Boolean(r.emailEnabled),
      emailRecipients: r.emailRecipients || '',
      emailProvider: r.emailProvider || 'smtp',
      emailConfig: decryptEmailConfigAtRest(parsedEmailConfig),
      whatsappEnabled: Boolean(r.whatsappEnabled),
      whatsappProvider: r.whatsappProvider || 'callmebot',
      whatsappPhone: r.whatsappPhone || '',
      whatsappConfig: decryptWhatsAppConfigAtRest(parsedWhatsAppConfig),
    };
  } catch (err) {
    console.warn('Erro ao carregar configurações de alertas:', err);
    return null;
  }
}

export async function saveAlertConfig(
  tenantId: string,
  data: Omit<AlertChannelConfig, 'tenantId' | 'id'>
): Promise<AlertChannelConfig> {
  await ensureAlertTablesExist();

  const id = randomUUID();
  const encryptedWebhookUrl = encryptAlertSecret(data.webhookUrl || '');
  const encryptedEmailConfig = encryptEmailConfigAtRest(data.emailConfig);
  const encryptedWhatsAppConfig = encryptWhatsAppConfigAtRest(data.whatsappConfig);

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO public.fiorix_operations_alert_channels (
      id, tenant_id, name, webhook_url, channel_type, enabled,
      notify_connector_offline, notify_sync_failed, notify_module_delayed,
      cooldown_minutes, email_enabled, email_recipients, email_provider,
      email_config, whatsapp_enabled, whatsapp_provider, whatsapp_phone,
      whatsapp_config, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16, $17, $18::jsonb, NOW())
    ON CONFLICT (tenant_id) DO UPDATE SET
      name = EXCLUDED.name,
      webhook_url = EXCLUDED.webhook_url,
      channel_type = EXCLUDED.channel_type,
      enabled = EXCLUDED.enabled,
      notify_connector_offline = EXCLUDED.notify_connector_offline,
      notify_sync_failed = EXCLUDED.notify_sync_failed,
      notify_module_delayed = EXCLUDED.notify_module_delayed,
      cooldown_minutes = EXCLUDED.cooldown_minutes,
      email_enabled = EXCLUDED.email_enabled,
      email_recipients = EXCLUDED.email_recipients,
      email_provider = EXCLUDED.email_provider,
      email_config = EXCLUDED.email_config,
      whatsapp_enabled = EXCLUDED.whatsapp_enabled,
      whatsapp_provider = EXCLUDED.whatsapp_provider,
      whatsapp_phone = EXCLUDED.whatsapp_phone,
      whatsapp_config = EXCLUDED.whatsapp_config,
      updated_at = NOW();
  `,
    id,
    tenantId,
    data.name || 'Notificações Principais',
    encryptedWebhookUrl,
    data.channelType || 'generic',
    data.enabled ?? true,
    data.notifyConnectorOffline ?? true,
    data.notifySyncFailed ?? true,
    data.notifyModuleDelayed ?? true,
    data.cooldownMinutes ?? 15,
    data.emailEnabled ?? false,
    data.emailRecipients ?? '',
    data.emailProvider ?? 'smtp',
    JSON.stringify(encryptedEmailConfig),
    data.whatsappEnabled ?? false,
    data.whatsappProvider ?? 'callmebot',
    data.whatsappPhone ?? '',
    JSON.stringify(encryptedWhatsAppConfig)
  );

  return {
    id,
    tenantId,
    ...data,
  };
}

export async function recordAlertLog(
  tenantId: string,
  log: Omit<AlertLogItem, 'id' | 'tenantId' | 'createdAt'>
): Promise<void> {
  await ensureAlertTablesExist();

  const id = randomUUID();
  try {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO public.fiorix_operations_alert_logs (
        id, tenant_id, event_type, title, message, severity,
        channel_type, status_code, success, error_message, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW());
    `,
      id,
      tenantId,
      log.eventType,
      log.title,
      log.message,
      log.severity,
      log.channelType,
      log.statusCode ?? null,
      log.success,
      log.errorMessage ?? null
    );

    if (log.success) {
      await prisma.$executeRawUnsafe(
        `
        UPDATE public.fiorix_operations_alert_channels
        SET last_triggered_at = NOW()
        WHERE tenant_id = $1;
      `,
        tenantId
      );
    }
  } catch (err) {
    console.warn('Erro ao salvar log de alerta:', err);
  }
}

export async function getRecentAlertLogs(tenantId: string, limit = 15): Promise<AlertLogItem[]> {
  await ensureAlertTablesExist();

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT 
        id,
        tenant_id as "tenantId",
        event_type as "eventType",
        title,
        message,
        severity,
        channel_type as "channelType",
        status_code as "statusCode",
        success,
        error_message as "errorMessage",
        created_at as "createdAt"
      FROM public.fiorix_operations_alert_logs
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2;
    `,
      tenantId,
      limit
    );

    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      eventType: r.eventType,
      title: r.title,
      message: r.message,
      severity: r.severity,
      channelType: r.channelType,
      statusCode: r.statusCode,
      success: Boolean(r.success),
      errorMessage: r.errorMessage,
      createdAt: new Date(r.createdAt).toISOString(),
    }));
  } catch (err) {
    console.warn('Erro ao buscar histórico de alertas:', err);
    return [];
  }
}

export async function recordConnectorTelemetry(data: ConnectorTelemetryData): Promise<void> {
  await ensureAlertTablesExist();
  await ensureConnectorDetailsColumn();

  try {
    const id = randomUUID();
    if (data.details && typeof data.details === 'object') {
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO public.fiorix_connector_telemetry (
          id, tenant_id, connector_id, uptime_seconds, ram_mb,
          cpu_percent, queue_pending, queue_failed, details, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, NOW());
      `,
        id,
        data.tenantId,
        data.connectorId,
        data.uptimeSeconds ?? null,
        data.ramMb ?? null,
        data.cpuPercent ?? null,
        data.queuePending ?? null,
        data.queueFailed ?? null,
        JSON.stringify(data.details)
      );
    } else {
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO public.fiorix_connector_telemetry (
          id, tenant_id, connector_id, uptime_seconds, ram_mb,
          cpu_percent, queue_pending, queue_failed, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW());
      `,
        id,
        data.tenantId,
        data.connectorId,
        data.uptimeSeconds ?? null,
        data.ramMb ?? null,
        data.cpuPercent ?? null,
        data.queuePending ?? null,
        data.queueFailed ?? null
      );
    }
  } catch (err) {
    console.warn('Erro ao gravar telemetria do conector:', err);
  }
}

export async function getLatestConnectorTelemetry(
  tenantId: string,
  connectorId: string
): Promise<ConnectorTelemetryData | null> {
  await ensureAlertTablesExist();
  await ensureConnectorDetailsColumn();

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT 
        uptime_seconds as "uptimeSeconds",
        ram_mb as "ramMb",
        cpu_percent as "cpuPercent",
        queue_pending as "queuePending",
        queue_failed as "queueFailed",
        details,
        created_at as "createdAt"
      FROM public.fiorix_connector_telemetry
      WHERE tenant_id = $1 AND connector_id = $2
      ORDER BY created_at DESC
      LIMIT 1;
    `,
      tenantId,
      connectorId
    );

    if (rows.length === 0) return null;

    const r = rows[0];
    const parsedDetails = r.details
      ? (typeof r.details === 'string' ? JSON.parse(r.details) : r.details)
      : null;

    return {
      tenantId,
      connectorId,
      uptimeSeconds: r.uptimeSeconds,
      ramMb: r.ramMb,
      cpuPercent: r.cpuPercent,
      queuePending: r.queuePending,
      queueFailed: r.queueFailed,
      details: parsedDetails,
      recordedAt: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    };
  } catch (err) {
    console.warn('Erro ao buscar telemetria mais recente:', err);
    return null;
  }
}
