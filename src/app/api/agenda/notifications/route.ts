import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  agendaJsonReply,
  ensureAgendaFeatureActive,
  handleAgendaApiError,
} from '@/lib/agenda/api-helpers';
import { requireAgendaAccess } from '@/lib/agenda/permissions';
import {
  actOnAgendaNotification,
  listAgendaNotificationsForUser,
} from '@/lib/agenda/service';

export const dynamic = 'force-dynamic';

const notificationActionSchema = z.object({
  action: z.enum(['MARK_READ', 'MARK_ALL_READ', 'SNOOZE', 'DISMISS', 'CONCLUDE_EVENT']),
  jobId: z.string().max(120).optional(),
  snoozeMinutes: z.union([z.literal(5), z.literal(15), z.literal(30), z.literal(60)]).optional(),
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
    const result = await actOnAgendaNotification(ctx, parsed.data);
    return agendaJsonReply(result);
  } catch (error) {
    return handleAgendaApiError(error);
  }
}
