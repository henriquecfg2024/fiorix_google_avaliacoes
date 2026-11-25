import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  agendaJsonReply,
  ensureAgendaFeatureActive,
  handleAgendaApiError,
} from '@/lib/agenda/api-helpers';
import { requireAgendaAccess } from '@/lib/agenda/permissions';
import {
  deleteAgendaEvent,
  getAgendaEventById,
  updateAgendaEvent,
} from '@/lib/agenda/service';

export const dynamic = 'force-dynamic';

const updateEventSchema = z.object({
  scope: z.enum(['SINGLE', 'THIS_AND_FOLLOWING', 'ALL']).optional(),
  occurrenceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  title: z.string().trim().min(2).max(180).optional(),
  description: z.string().max(4000).nullable().optional(),
  categoryId: z.string().max(120).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  localStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  localStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  localEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  localEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  allDay: z.boolean().optional(),
  location: z.string().max(240).nullable().optional(),
  meetingLink: z.string().max(500).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  priority: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'CRITICA']).optional(),
  visibility: z
    .enum(['INDIVIDUAL', 'COMPARTILHADO', 'SETORIAL', 'INSTITUCIONAL'])
    .optional(),
  isConfidential: z.boolean().optional(),
  department: z.string().max(120).nullable().optional(),
  recurrenceType: z
    .enum([
      'UNICO',
      'DIARIO',
      'SEMANAL',
      'QUINZENAL',
      'MENSAL',
      'BIMESTRAL',
      'TRIMESTRAL',
      'SEMESTRAL',
      'ANUAL',
      'PERSONALIZADO',
    ])
    .optional(),
  reminders: z
    .array(
      z.object({
        channel: z.enum(['EMAIL', 'POPUP', 'PUSH']),
        offsetMinutes: z.number().int().min(0).max(525_600),
        isMandatory: z.boolean().optional(),
      })
    )
    .max(20)
    .optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    const { id } = await context.params;
    const event = await getAgendaEventById(ctx, id);
    return agendaJsonReply({ event });
  } catch (error) {
    return handleAgendaApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const parsed = updateEventSchema.safeParse(body);
    if (!parsed.success) {
      return agendaJsonReply({ error: 'Dados inválidos para atualização.' }, 400);
    }
    const updated = await updateAgendaEvent(ctx, id, parsed.data);
    return agendaJsonReply(updated);
  } catch (error) {
    return handleAgendaApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    const { id } = await context.params;
    await deleteAgendaEvent(ctx, id);
    return agendaJsonReply({ ok: true });
  } catch (error) {
    return handleAgendaApiError(error);
  }
}
