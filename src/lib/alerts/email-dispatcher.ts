import nodemailer from 'nodemailer';
import type { AlertChannelConfig } from './alert-storage';

export interface EmailDispatchResult {
  success: boolean;
  recipientsCount: number;
  statusCode?: number;
  errorMessage?: string;
}

export function generateAlertEmailHtml(params: {
  title: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  eventType: string;
  timestamp?: string;
  centralUrl?: string;
}): string {
  const { title, message, severity, eventType, timestamp, centralUrl } = params;

  const severityConfig = {
    CRITICAL: {
      label: 'CRÍTICO / INCIDENTE',
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.15)',
      borderColor: '#dc2626',
      badgeBg: '#7f1d1d',
      badgeText: '#fca5a5',
    },
    WARNING: {
      label: 'ATENÇÃO / DEGRADADO',
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.15)',
      borderColor: '#d97706',
      badgeBg: '#78350f',
      badgeText: '#fde68a',
    },
    INFO: {
      label: 'NOTIFICAÇÃO OPERACIONAL',
      color: '#3b82f6',
      bgColor: 'rgba(59, 130, 246, 0.15)',
      borderColor: '#2563eb',
      badgeBg: '#1e3a8a',
      badgeText: '#93c5fd',
    },
  }[severity] || {
    label: 'NOTIFICAÇÃO',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: '#2563eb',
    badgeBg: '#1e3a8a',
    badgeText: '#93c5fd',
  };

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const targetUrl = centralUrl || 'https://fiorix.app/sistema/operacoes';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:24px;background-color:#0b0f19;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e2e8f0;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:12px;overflow:hidden;">
    <!-- Header -->
    <tr>
      <td style="padding:24px;background:linear-gradient(135deg, #111827 0%, #1e1b4b 100%);border-bottom:1px solid #1f2937;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <div style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">
                FIORIX <span style="font-size:12px;font-weight:600;color:#818cf8;background:rgba(99,102,241,0.15);padding:3px 8px;border-radius:6px;margin-left:8px;text-transform:uppercase;">Central de Operações</span>
              </div>
              <div style="font-size:13px;color:#9ca3af;margin-top:4px;">
                Cartório de Registro de Imóveis • Sistema de Telemetria
              </div>
            </td>
            <td align="right">
              <span style="display:inline-block;padding:4px 10px;font-size:11px;font-weight:700;color:${severityConfig.badgeText};background:${severityConfig.badgeBg};border:1px solid ${severityConfig.borderColor};border-radius:20px;">
                ${severityConfig.label}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body Alert -->
    <tr>
      <td style="padding:28px 24px;">
        <div style="background:${severityConfig.bgColor};border-left:4px solid ${severityConfig.color};padding:16px;border-radius:0 8px 8px 0;margin-bottom:24px;">
          <h2 style="margin:0 0 8px 0;font-size:18px;font-weight:700;color:#ffffff;">
            ${title}
          </h2>
          <p style="margin:0;font-size:14px;line-height:1.5;color:#e5e7eb;">
            ${message}
          </p>
        </div>

        <!-- Metadata Table -->
        <table width="100%" border="0" cellspacing="0" cellpadding="8" style="background:#0f172a;border:1px solid #1e293b;border-radius:8px;font-size:13px;margin-bottom:24px;">
          <tr>
            <td width="35%" style="color:#94a3b8;font-weight:600;border-bottom:1px solid #1e293b;">Tipo do Evento:</td>
            <td style="color:#f1f5f9;font-weight:500;border-bottom:1px solid #1e293b;font-family:monospace;">${eventType}</td>
          </tr>
          <tr>
            <td style="color:#94a3b8;font-weight:600;border-bottom:1px solid #1e293b;">Severidade:</td>
            <td style="color:${severityConfig.color};font-weight:700;border-bottom:1px solid #1e293b;">${severity}</td>
          </tr>
          <tr>
            <td style="color:#94a3b8;font-weight:600;border-bottom:1px solid #1e293b;">Data e Horário:</td>
            <td style="color:#f1f5f9;font-weight:500;border-bottom:1px solid #1e293b;">${formattedTime} (Brasília)</td>
          </tr>
          <tr>
            <td style="color:#94a3b8;font-weight:600;">Ambiente:</td>
            <td style="color:#10b981;font-weight:600;">● Produção (Cartório Online)</td>
          </tr>
        </table>

        <!-- CTA Button -->
        <div style="text-align:center;margin:28px 0 12px 0;">
          <a href="${targetUrl}" target="_blank" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg, #4f46e5 0%, #3730a3 100%);color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;border-radius:8px;box-shadow:0 4px 12px rgba(79,70,229,0.3);">
            Abrir Central de Operações no Navegador &rarr;
          </a>
        </div>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding:16px 24px;background:#090d16;border-top:1px solid #1f2937;font-size:12px;color:#6b7280;text-align:center;">
        Este é um alerta automático gerado pelo serviço de telemetria do FIORIX.<br>
        Para ajustar a frequência de notificações ou destinatários, acesse a Central de Operações.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendAlertEmail(params: {
  config: AlertChannelConfig;
  eventType: string;
  title: string;
  message: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
}): Promise<EmailDispatchResult> {
  const { config, eventType, title, message, severity } = params;

  if (!config.emailEnabled) {
    return { success: false, recipientsCount: 0, errorMessage: 'Canal de e-mail desativado nas configurações' };
  }

  const recipients = (config.emailRecipients || '')
    .split(/[,;]+/)
    .map((r) => r.trim())
    .filter((r) => r.length > 3 && r.includes('@'));

  if (recipients.length === 0) {
    return { success: false, recipientsCount: 0, errorMessage: 'Nenhum e-mail de destinatário válido configurado' };
  }

  const emailCfg = config.emailConfig || {};
  const html = generateAlertEmailHtml({
    title,
    message,
    severity,
    eventType,
    timestamp: new Date().toISOString(),
  });

  const severityPrefix = severity === 'CRITICAL' ? '🔴 [CRÍTICO]' : severity === 'WARNING' ? '🟡 [ATENÇÃO]' : '🔵 [INFO]';
  const subject = `${severityPrefix} FIORIX: ${title}`;

  // Se configurado via Resend API Key
  if (config.emailProvider === 'resend' || emailCfg.resendApiKey) {
    const apiKey = emailCfg.resendApiKey || process.env.RESEND_API_KEY;
    if (!apiKey) {
      return { success: false, recipientsCount: recipients.length, errorMessage: 'Chave de API do Resend não informada' };
    }

    try {
      const fromEmail = emailCfg.from || 'FIORIX Alertas <alertas@fiorix.app>';
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: recipients,
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        return { success: false, recipientsCount: recipients.length, statusCode: res.status, errorMessage: `Resend API erro: ${errorText}` };
      }

      return { success: true, recipientsCount: recipients.length, statusCode: res.status };
    } catch (err: any) {
      return { success: false, recipientsCount: recipients.length, errorMessage: err?.message || 'Falha ao conectar com Resend' };
    }
  }

  // Envio padrão via Nodemailer (SMTP - Office 365, Gmail, Domínio Próprio)
  const host = emailCfg.host || process.env.SMTP_HOST;
  const port = Number(emailCfg.port || process.env.SMTP_PORT || 587);
  const user = emailCfg.user || process.env.SMTP_USER;
  const pass = emailCfg.pass || process.env.SMTP_PASS;
  const from = emailCfg.from || process.env.SMTP_FROM || user || 'alertas@fiorix.app';

  if (!host || !user || !pass) {
    return {
      success: false,
      recipientsCount: recipients.length,
      errorMessage: 'Configurações de SMTP incompletas. Preencha Servidor (Host), Usuário e Senha nas configurações de e-mail.',
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false, // Compatibilidade com servidores de cartório
      },
    });

    await transporter.sendMail({
      from: `FIORIX Alertas <${from}>`,
      to: recipients.join(', '),
      subject,
      html,
    });

    return {
      success: true,
      recipientsCount: recipients.length,
      statusCode: 200,
    };
  } catch (err: any) {
    return {
      success: false,
      recipientsCount: recipients.length,
      errorMessage: err?.message || 'Falha no envio SMTP',
    };
  }
}
