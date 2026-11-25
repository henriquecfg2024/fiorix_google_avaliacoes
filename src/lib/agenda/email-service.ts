import nodemailer from 'nodemailer';
import { getAlertConfig } from '@/lib/alerts/alert-storage';
import { isAgendaSandboxMode } from './feature-flags';
import { extractFirstName, formatLocalDateBr, formatHourShortBr } from './timezone';
import type { AgendaPriority } from './types';

export interface AgendaEmailComposeInput {
  tenantId?: string;
  recipientName?: string | null;
  recipientEmail: string;
  eventTitle: string;
  localDate: string;
  localTime: string;
  allDay: boolean;
  priority: AgendaPriority;
  countdownLabel: string;
  isConfidential: boolean;
  fiorixUrl?: string;
}

export interface AgendaEmailDispatchResult {
  success: boolean;
  status: 'SANDBOX_SIMULADA' | 'ACEITA_PROVEDOR' | 'ENTREGUE_CONFIRMADA' | 'FALHA';
  providerMessageId: string | null;
  providerHost?: string | null;
  providerResponse?: string | null;
  errorMessage: string | null;
  subject: string;
  html: string;
  text: string;
}

const PRIORITY_LABELS: Record<AgendaPriority, string> = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Monta e-mail institucional responsivo conforme diretriz da Seção 19 do Prompt,
 * minimizando exposição de detalhes para compromissos confidenciais.
 */
export function buildAgendaReminderEmail(input: AgendaEmailComposeInput): {
  subject: string;
  html: string;
  text: string;
} {
  const firstName = extractFirstName(input.recipientName) || 'Colaborador';
  const safeDisplayTitle = input.isConfidential
    ? 'Compromisso reservado na sua Agenda'
    : input.eventTitle;
  const dateLabel = formatLocalDateBr(input.localDate);
  const timeLabel = formatHourShortBr(input.localTime, input.allDay);
  const priorityLabel = PRIORITY_LABELS[input.priority] ?? 'Normal';
  const targetUrl = input.fiorixUrl || 'https://fiorix.app/agenda';

  const subject = input.isConfidential
    ? 'FIORIX | Lembrete de compromisso reservado'
    : `FIORIX | Lembrete de compromisso — ${input.eventTitle}`;

  const text = [
    `Olá, ${firstName}.`,
    '',
    'Este é um lembrete automático da sua Agenda Inteligente do FIORIX.',
    '',
    `Compromisso: ${safeDisplayTitle}`,
    `Data: ${dateLabel}`,
    `Horário: ${timeLabel}`,
    `Prioridade: ${priorityLabel}`,
    `Tempo restante: ${input.countdownLabel}`,
    '',
    'Acesse o FIORIX para consultar os detalhes do compromisso.',
    targetUrl,
    '',
    'FIORIX — Enterprise Digital Governance.',
    'Esta é uma mensagem automática.',
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px;background-color:#F4F6FB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0F172A;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="padding:20px 24px;background:#0F172A;color:#FFFFFF;">
        <div style="font-size:18px;font-weight:800;letter-spacing:0.02em;">FIORIX</div>
        <div style="font-size:12px;color:#CBD5E1;margin-top:2px;">Enterprise Digital Governance · Agenda Inteligente</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0F172A;">Olá, ${escapeHtml(firstName)}.</p>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#334155;">
          Este é um lembrete automático da sua <strong>Agenda Inteligente do FIORIX</strong>.
        </p>

        <table width="100%" border="0" cellspacing="0" cellpadding="10" style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:12px;font-size:13px;margin-bottom:20px;">
          <tr>
            <td width="34%" style="color:#64748B;font-weight:600;border-bottom:1px solid #E2E8F0;">Compromisso:</td>
            <td style="color:#0F172A;font-weight:700;border-bottom:1px solid #E2E8F0;">${escapeHtml(safeDisplayTitle)}</td>
          </tr>
          <tr>
            <td style="color:#64748B;font-weight:600;border-bottom:1px solid #E2E8F0;">Data:</td>
            <td style="color:#0F172A;font-weight:600;border-bottom:1px solid #E2E8F0;">${escapeHtml(dateLabel)}</td>
          </tr>
          <tr>
            <td style="color:#64748B;font-weight:600;border-bottom:1px solid #E2E8F0;">Horário:</td>
            <td style="color:#0F172A;font-weight:600;border-bottom:1px solid #E2E8F0;">${escapeHtml(timeLabel)}</td>
          </tr>
          <tr>
            <td style="color:#64748B;font-weight:600;border-bottom:1px solid #E2E8F0;">Prioridade:</td>
            <td style="color:#4F46E5;font-weight:700;border-bottom:1px solid #E2E8F0;">${escapeHtml(priorityLabel)}</td>
          </tr>
          <tr>
            <td style="color:#64748B;font-weight:600;">Tempo restante:</td>
            <td style="color:#0F172A;font-weight:700;">${escapeHtml(input.countdownLabel)}</td>
          </tr>
        </table>

        <p style="margin:0 0 18px;font-size:13px;color:#475569;">
          Acesse o FIORIX para consultar os detalhes do compromisso.
        </p>

        <a href="${escapeHtml(targetUrl)}" style="display:inline-block;background:#4F46E5;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;padding:11px 20px;border-radius:10px;">
          Abrir Agenda Inteligente
        </a>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 24px;background:#F8FAFC;border-top:1px solid #E2E8F0;font-size:11px;color:#64748B;">
        <div><strong>FIORIX — Enterprise Digital Governance.</strong></div>
        <div style="margin-top:2px;">Esta é uma mensagem automática.</div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html, text };
}

/**
 * Envia lembrete via infraestrutura existente (Resend/SMTP) ou registra em sandbox local
 * quando em homologação/teste, evitando disparos reais a colaboradores durante testes.
 */
export async function dispatchAgendaReminderEmail(
  input: AgendaEmailComposeInput & { idempotencyKey?: string; forceSandbox?: boolean }
): Promise<AgendaEmailDispatchResult> {
  const { subject, html, text } = buildAgendaReminderEmail(input);

  if (input.forceSandbox || isAgendaSandboxMode()) {
    return {
      success: true,
      status: 'SANDBOX_SIMULADA',
      providerMessageId: `sandbox-${Date.now()}`,
      errorMessage: null,
      subject,
      html,
      text,
    };
  }

  const tenantAlertCfg = input.tenantId
    ? await getAlertConfig(input.tenantId).catch(() => null)
    : null;
  const tenantEmailCfg = tenantAlertCfg?.emailConfig;

  const tenantPrefersResend =
    tenantAlertCfg?.emailProvider === 'resend' || Boolean(tenantEmailCfg?.resendApiKey?.trim());
  const tenantHasSmtp = Boolean(
    tenantEmailCfg?.host?.trim() && tenantEmailCfg?.user?.trim() && tenantEmailCfg?.pass?.trim()
  );

  const resendKey = tenantPrefersResend
    ? tenantEmailCfg?.resendApiKey?.trim() || process.env.RESEND_API_KEY?.trim()
    : !tenantHasSmtp
      ? process.env.RESEND_API_KEY?.trim()
      : undefined;
  const fromEmail =
    tenantEmailCfg?.from?.trim() ||
    process.env.SMTP_FROM?.trim() ||
    tenantEmailCfg?.user?.trim() ||
    process.env.SMTP_USER?.trim() ||
    'agenda@fiorix.app';

  if (resendKey) {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      };
      if (input.idempotencyKey) {
        headers['Idempotency-Key'] = input.idempotencyKey;
      }
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          from: `FIORIX Agenda <${fromEmail}>`,
          to: [input.recipientEmail],
          subject,
          html,
          text,
        }),
      });
      if (!res.ok) {
        const bodyErr = await res.text().catch(() => '');
        return {
          success: false,
          status: 'FALHA',
          providerMessageId: null,
          errorMessage: `Resend HTTP ${res.status}: ${bodyErr.slice(0, 200)}`,
          subject,
          html,
          text,
        };
      }
      const parsed = (await res.json().catch(() => null)) as { id?: string } | null;
      return {
        success: true,
        status: 'ACEITA_PROVEDOR',
        providerMessageId: parsed?.id ?? null,
        providerHost: 'api.resend.com',
        providerResponse: `HTTP ${res.status}`,
        errorMessage: null,
        subject,
        html,
        text,
      };
    } catch (err) {
      return {
        success: false,
        status: 'FALHA',
        providerMessageId: null,
        providerHost: 'api.resend.com',
        providerResponse: null,
        errorMessage: err instanceof Error ? err.message : 'Erro ao conectar ao provedor Resend.',
        subject,
        html,
        text,
      };
    }
  }

  const host = tenantEmailCfg?.host?.trim() || process.env.SMTP_HOST?.trim();
  const port = Number(tenantEmailCfg?.port || process.env.SMTP_PORT || 587);
  const user = tenantEmailCfg?.user?.trim() || process.env.SMTP_USER?.trim();
  const pass = tenantEmailCfg?.pass?.trim() || process.env.SMTP_PASS?.trim();
  const secure = tenantEmailCfg?.secure ?? port === 465;

  if (!host || !user || !pass) {
    return {
      success: false,
      status: 'FALHA',
      providerMessageId: null,
      providerHost: host || null,
      providerResponse: null,
      errorMessage:
        'Provedor SMTP/Resend não configurado na Central de Operações nem nas variáveis do servidor.',
      subject,
      html,
      text,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
    });
    const info = await transporter.sendMail({
      from: `FIORIX Agenda <${fromEmail}>`,
      to: input.recipientEmail,
      subject,
      html,
      text,
    });

    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    const providerResponse = typeof info.response === 'string' ? info.response : null;

    console.info('[Agenda Email]', {
      providerHost: host,
      port,
      recipientEmail: input.recipientEmail,
      accepted,
      rejected,
      messageId: info.messageId || null,
      response: providerResponse,
    });

    if (rejected.length > 0 || (Array.isArray(info.accepted) && accepted.length === 0)) {
      const rejectedList = rejected.map((entry) => String(entry)).join(', ') || input.recipientEmail;
      return {
        success: false,
        status: 'FALHA',
        providerMessageId: info.messageId || null,
        providerHost: host,
        providerResponse,
        errorMessage: `Destinatário rejeitado pelo servidor SMTP: ${rejectedList}`,
        subject,
        html,
        text,
      };
    }

    return {
      success: true,
      status: 'ACEITA_PROVEDOR',
      providerMessageId: info.messageId || null,
      providerHost: host,
      providerResponse,
      errorMessage: null,
      subject,
      html,
      text,
    };
  } catch (err) {
    console.warn('[Agenda Email] Falha SMTP:', {
      providerHost: host,
      port,
      recipientEmail: input.recipientEmail,
      error: err instanceof Error ? err.message : 'Falha no envio SMTP.',
    });
    return {
      success: false,
      status: 'FALHA',
      providerMessageId: null,
      providerHost: host,
      providerResponse: null,
      errorMessage: err instanceof Error ? err.message : 'Falha no envio SMTP.',
      subject,
      html,
      text,
    };
  }
}
