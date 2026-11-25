import type { NextRequest } from 'next/server';
import {
  agendaJsonReply,
  ensureAgendaFeatureActive,
  handleAgendaApiError,
} from '@/lib/agenda/api-helpers';
import { requireAgendaAccess } from '@/lib/agenda/permissions';
import { getAgendaDashboardData, type AgendaQueryFilter } from '@/lib/agenda/service';
import type {
  AgendaPriority,
  AgendaRecurrenceType,
  AgendaStatus,
  AgendaVisibility,
} from '@/lib/agenda/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    ensureAgendaFeatureActive();
    const ctx = await requireAgendaAccess(request);
    const { searchParams } = new URL(request.url);

    const filter: AgendaQueryFilter = {
      windowStartDate: searchParams.get('start') || undefined,
      windowEndDate: searchParams.get('end') || undefined,
      categoryId: searchParams.get('categoryId') || undefined,
      ownerUserId: searchParams.get('ownerUserId') || undefined,
      department: searchParams.get('department') || undefined,
      priority: (searchParams.get('priority') as AgendaPriority) || undefined,
      status: (searchParams.get('status') as AgendaStatus) || undefined,
      recurrenceType: (searchParams.get('recurrenceType') as AgendaRecurrenceType) || undefined,
      visibility: (searchParams.get('visibility') as AgendaVisibility) || undefined,
      scopeTab:
        (searchParams.get('scopeTab') as AgendaQueryFilter['scopeTab']) || undefined,
      search: searchParams.get('search') || undefined,
      showCompleted:
        searchParams.get('showCompleted') === 'false'
          ? false
          : searchParams.get('showCompleted') === 'true'
            ? true
            : undefined,
      quickFilter:
        (searchParams.get('quickFilter') as AgendaQueryFilter['quickFilter']) || undefined,
    };

    const data = await getAgendaDashboardData(ctx, filter);
    return agendaJsonReply({
      ...data,
      permissoes: {
        role: ctx.roleUpper,
        canCreateOwn: ctx.canCreateOwn,
        canAssignOrCreateSetorial: ctx.canAssignOrCreateSetorial,
        canCreateInstitucional: ctx.canCreateInstitucional,
        canManageCategories: ctx.canManageCategories,
        canManageModule: ctx.canManageModule,
        isReadOnly: ctx.isReadOnly,
      },
    });
  } catch (error) {
    return handleAgendaApiError(error);
  }
}
