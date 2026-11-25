import type { NextRequest } from 'next/server';
import { z } from 'zod';
import {
  agendaJsonReply,
  ensureAgendaFeatureActive,
  handleAgendaApiError,
} from '@/lib/agenda/api-helpers';
import { requireAgendaAccess } from '@/lib/agenda/permissions';
import { listAgendaCategories, upsertAgendaCategory } from '@/lib/agenda/service';

export const dynamic = 'force-dynamic';

const categorySchema = z.object({
  id: z.string().max(120).optional(),
  name: z.string().trim().min(2).max(60),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string().min(1).max(50),
  scope: z.enum(['PESSOAL', 'INSTITUCIONAL']).optional(),
});

export async function GET(request: NextRequest) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    return agendaJsonReply({ categories: await listAgendaCategories(ctx) });
  } catch (error) {
    return handleAgendaApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    const body = await request.json().catch(() => null);
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) {
      return agendaJsonReply({ error: 'Categoria inválida.' }, 400);
    }
    const category = await upsertAgendaCategory(ctx, parsed.data);
    return agendaJsonReply({ category }, 201);
  } catch (error) {
    return handleAgendaApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  return POST(request);
}
