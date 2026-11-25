import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  agendaJsonReply,
  ensureAgendaFeatureActive,
  handleAgendaApiError,
} from '@/lib/agenda/api-helpers';
import { requireAgendaAccess } from '@/lib/agenda/permissions';
import { changeAgendaOccurrenceStatus } from '@/lib/agenda/service';

export const dynamic = 'force-dynamic';

const statusSchema = z.object({
  action: z.enum(['CONCLUIR', 'CANCELAR', 'REAGENDAR', 'RSVP']),
  scope: z.enum(['SINGLE', 'THIS_AND_FOLLOWING', 'ALL']).optional(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rsvpStatus: z.enum(['PENDENTE', 'CONFIRMADO', 'RECUSADO']).optional(),
  newLocalStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  newLocalStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  newLocalEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  newLocalEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return agendaJsonReply({ error: 'Parâmetros inválidos para alteração de status.' }, 400);
    }
    const event = await changeAgendaOccurrenceStatus(ctx, id, parsed.data);
    return agendaJsonReply({ ok: true, event });
  } catch (error) {
    return handleAgendaApiError(error);
  }
}
