import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { sanitizeDatabaseError } from '@/lib/health/operations-service';
import { dispatchTestAlert } from '@/lib/alerts/alert-dispatcher';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const testAlertSchema = z.object({
  webhookUrl: z.string().trim().url(),
  channelType: z.enum(['discord', 'slack', 'generic']).optional().default('generic'),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole('MASTER', 'ADMIN');
    const tenantId = user.tenantId;

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Payload JSON inválido' }, { status: 400 });
    }

    const parsed = testAlertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'URL do webhook inválida', details: parsed.error.issues }, { status: 400 });
    }

    const result = await dispatchTestAlert(tenantId, parsed.data.webhookUrl, parsed.data.channelType);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Notificação de teste enviada com sucesso ao webhook!',
        statusCode: result.statusCode,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Falha ao entregar notificação ao webhook.',
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
