import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  agendaJsonReply,
  ensureAgendaFeatureActive,
  handleAgendaApiError,
} from '@/lib/agenda/api-helpers';
import { requireAgendaAccess } from '@/lib/agenda/permissions';
import { createAgendaEvent, getAgendaDashboardData } from '@/lib/agenda/service';

export const dynamic = 'force-dynamic';

const recurrenceRuleSchema = z.object({
  frequency: z.enum([
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
  ]),
  interval: z.number().int().min(1).max(365),
  weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  monthDay: z.number().int().min(1).max(31).nullable().optional(),
  businessDayRule: z.enum(['NONE', 'FIRST_BUSINESS_DAY', 'LAST_BUSINESS_DAY']).optional(),
  monthEndPolicy: z.enum(['ULTIMO_DIA', 'IGNORAR_MES']).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  maxOccurrences: z.number().int().min(1).max(500).nullable().optional(),
  unlimited: z.boolean().optional(),
  customUnit: z.enum(['DIAS', 'SEMANAS', 'MESES', 'ANOS']).optional(),
  holidayDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
});

const createEventSchema = z.object({
  title: z.string().trim().min(2).max(180),
  description: z.string().max(4000).nullable().optional(),
  categoryId: z.string().max(120).nullable().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  localStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  localStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  localEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  localEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  allDay: z.boolean().optional(),
  timezone: z.string().max(80).optional(),
  location: z.string().max(240).nullable().optional(),
  meetingLink: z.string().max(500).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  priority: z.enum(['BAIXA', 'NORMAL', 'ALTA', 'CRITICA']).optional(),
  visibility: z
    .enum(['INDIVIDUAL', 'COMPARTILHADO', 'SETORIAL', 'INSTITUCIONAL'])
    .optional(),
  isConfidential: z.boolean().optional(),
  ownerUserId: z.string().max(120).optional(),
  ownerName: z.string().max(180).nullable().optional(),
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
  recurrenceRule: recurrenceRuleSchema.nullable().optional(),
  participantIds: z
    .array(
      z.object({
        userId: z.string().min(1).max(120),
        userName: z.string().max(180).nullable().optional(),
        userEmail: z.string().email().max(180).nullable().optional(),
        canEdit: z.boolean().optional(),
      })
    )
    .max(100)
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

export async function GET(request: NextRequest) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    const data = await getAgendaDashboardData(ctx, {});
    return agendaJsonReply({ occurrences: data.occurrences });
  } catch (error) {
    return handleAgendaApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    if (ctx.isReadOnly) {
      return agendaJsonReply(
        { error: 'Perfil VISITANTE é somente leitura e não pode criar compromissos.' },
        403
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = createEventSchema.safeParse(body);
    if (!parsed.success) {
      return agendaJsonReply(
        { error: 'Dados inválidos no formulário de compromisso.', details: parsed.error.flatten() },
        400
      );
    }

    const created = await createAgendaEvent(ctx, parsed.data);
    return agendaJsonReply(created, 201);
  } catch (error) {
    return handleAgendaApiError(error);
  }
}
