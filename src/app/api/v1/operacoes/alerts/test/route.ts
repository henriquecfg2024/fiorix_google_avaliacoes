import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { sanitizeDatabaseError } from '@/lib/health/operations-service';
import { dispatchTestAlert } from '@/lib/alerts/alert-dispatcher';
import { getAlertConfig } from '@/lib/alerts/alert-storage';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const testAlertSchema = z.object({
  channel: z.enum(['webhook', 'email', 'whatsapp', 'all']).optional().default('webhook'),
  webhookUrl: z.string().trim().optional(),
  channelType: z.enum(['discord', 'slack', 'generic']).optional().default('generic'),
  emailEnabled: z.boolean().optional(),
  emailRecipients: z.string().optional(),
  emailProvider: z.enum(['smtp', 'resend']).optional(),
  emailConfig: z.record(z.string(), z.any()).optional(),
  whatsappEnabled: z.boolean().optional(),
  whatsappProvider: z.enum(['callmebot', 'evolution', 'zapi']).optional(),
  whatsappPhone: z.string().optional(),
  whatsappConfig: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const tenantId = user.tenantId;

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Aceita body vazio se estiver usando configs salvas
    }

    const parsed = testAlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Parâmetros de teste inválidos', details: parsed.error.issues }, { status: 400 });
    }

    const data = parsed.data;

    // Se senha SMTP for '••••••••', recuperar do banco
    if (data.emailConfig?.pass === '••••••••' || !data.emailConfig?.pass) {
      const existing = await getAlertConfig(tenantId);
      if (existing?.emailConfig?.pass) {
        data.emailConfig = {
          ...data.emailConfig,
          pass: existing.emailConfig.pass,
        };
      }
    }

    const result = await dispatchTestAlert({
      tenantId,
      channel: data.channel,
      config: data,
    });

    if (result.success) {
      const channelLabel =
        result.channel === 'email'
          ? 'ao E-mail corporativo'
          : result.channel === 'whatsapp'
          ? 'ao WhatsApp'
          : 'ao Webhook';

      return NextResponse.json({
        success: true,
        channel: result.channel,
        message: `Notificação de teste enviada com sucesso ${channelLabel}!`,
        statusCode: result.statusCode,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          channel: result.channel,
          error: result.error || 'Falha ao entregar notificação de teste.',
          statusCode: result.statusCode,
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    if (error.message?.includes('Acesso negado') || error.message?.includes('Não autorizado') || error.message?.includes('Sessão')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const sanitized = sanitizeDatabaseError(error);
    return NextResponse.json({ error: sanitized.message, code: sanitized.code }, { status: 500 });
  }
}
