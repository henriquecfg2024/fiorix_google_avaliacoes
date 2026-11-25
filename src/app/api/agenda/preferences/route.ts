import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  agendaJsonReply,
  ensureAgendaFeatureActive,
  handleAgendaApiError,
} from '@/lib/agenda/api-helpers';
import { requireAgendaAccess } from '@/lib/agenda/permissions';
import {
  getAgendaDashboardData,
  updateAgendaUserPreferences,
} from '@/lib/agenda/service';

export const dynamic = 'force-dynamic';

const prefPatchSchema = z.object({
  defaultView: z
    .enum(['DIARIO', 'SEMANAL', 'MENSAL', 'SEMESTRAL', 'ANUAL', 'LISTA'])
    .optional(),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
  preferredCategories: z.array(z.string().max(120)).max(30).optional(),
  defaultChannel: z.enum(['EMAIL', 'POPUP', 'PUSH']).optional(),
  defaultOffsetMinutes: z.number().int().min(0).max(525_600).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  showCompleted: z.boolean().optional(),
  webPushEnabled: z.boolean().optional(),
  calendarCompactFormat: z.boolean().optional(),
  themeMode: z.enum(['light', 'dark']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    const { preferences } = await getAgendaDashboardData(ctx, {});
    return agendaJsonReply({ preferences });
  } catch (error) {
    return handleAgendaApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    const body = await request.json().catch(() => null);
    const parsed = prefPatchSchema.safeParse(body);
    if (!parsed.success) {
      return agendaJsonReply({ error: 'Preferências inválidas.' }, 400);
    }
    const preferences = await updateAgendaUserPreferences(ctx, parsed.data);
    return agendaJsonReply({ preferences });
  } catch (error) {
    return handleAgendaApiError(error);
  }
}
