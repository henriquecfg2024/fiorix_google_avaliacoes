import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  agendaJsonReply,
  ensureAgendaFeatureActive,
  handleAgendaApiError,
} from '@/lib/agenda/api-helpers';
import { dispatchAgendaReminderEmail } from '@/lib/agenda/email-service';
import { isAgendaSandboxMode } from '@/lib/agenda/feature-flags';
import { requireAgendaAccess } from '@/lib/agenda/permissions';
import {
  actOnAgendaNotification,
  listAgendaNotificationsForUser,
} from '@/lib/agenda/service';
import { getZonedParts } from '@/lib/agenda/timezone';

export const dynamic = 'force-dynamic';

const notificationActionSchema = z.object({
  action: z.enum([
    'MARK_READ',
    'MARK_ALL_READ',
    'SNOOZE',
    'DISMISS',
    'CONCLUDE_EVENT',
    'TEST_EMAIL',
  ]),
  jobId: z.string().max(120).optional(),
  snoozeMinutes: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]).optional(),
  testEmail: z.string().email().max(180).optional(),
});

export async function GET(request: NextRequest) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    const data = await listAgendaNotificationsForUser(ctx);
    return agendaJsonReply(data);
  } catch (error) {
    return handleAgendaApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    const body = await request.json().catch(() => null);
    const parsed = notificationActionSchema.safeParse(body);
    if (!parsed.success) {
      return agendaJsonReply({ error: 'Ação de notificação inválida.' }, 400);
    }

    if (parsed.data.action === 'TEST_EMAIL') {
      if (ctx.isReadOnly) {
        return agendaJsonReply(
          { error: 'Perfil somente leitura não pode disparar e-mail de teste.' },
          403
        );
      }
      const canSpecifyRecipient = ctx.roleUpper === 'MASTER' || ctx.roleUpper === 'ADMIN';
      const targetEmail =
        (canSpecifyRecipient && parsed.data.testEmail?.trim()) || ctx.user.email?.trim() || '';
      if (!targetEmail) {
        return agendaJsonReply(
          { error: 'Nenhum endereço de e-mail válido encontrado no cadastro do usuário.' },
          400
        );
      }
      const nowParts = getZonedParts(new Date(), 'America/Sao_Paulo');
      const dispatch = await dispatchAgendaReminderEmail({
        tenantId: ctx.user.tenantId,
        recipientName: ctx.user.name,
        recipientEmail: targetEmail,
        eventTitle: 'Teste de Configuração de Lembretes por E-mail',
        localDate: nowParts.dateStr,
        localTime: nowParts.timeStr,
        allDay: false,
        priority: 'NORMAL',
        countdownLabel: 'Teste imediato',
        isConfidential: false,
        forceSandbox: isAgendaSandboxMode(),
      });

      return agendaJsonReply(
        {
          ok: dispatch.success,
          recipientEmail: targetEmail,
          status: dispatch.status,
          errorMessage: dispatch.errorMessage,
        },
        dispatch.success ? 200 : 422
      );
    }

    const result = await actOnAgendaNotification(ctx, {
      action: parsed.data.action,
      jobId: parsed.data.jobId,
      snoozeMinutes: parsed.data.snoozeMinutes,
    });
    return agendaJsonReply(result);
  } catch (error) {
    return handleAgendaApiError(error);
  }
}
