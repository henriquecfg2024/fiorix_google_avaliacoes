import type { NextRequest } from 'next/server';
import {
  agendaJsonReply,
  ensureAgendaFeatureActive,
  handleAgendaApiError,
} from '@/lib/agenda/api-helpers';
import { processDueAgendaNotificationJobs } from '@/lib/agenda/notification-worker';
import {
  AgendaAccessError,
  isCronAuthorized,
  requireAgendaAccess,
} from '@/lib/agenda/permissions';

export const dynamic = 'force-dynamic';

async function executeCronReminderBatch(request: NextRequest, forceSandboxEmail = false) {
  ensureAgendaFeatureActive();
  const hasCronToken = isCronAuthorized(request);
  let tenantId: string | undefined;

  if (!hasCronToken) {
    if (process.env.NODE_ENV === 'production') {
      throw new AgendaAccessError('Token CRON ausente ou inválido.', 401);
    }
    const ctx = await requireAgendaAccess(request);
    if (ctx.roleUpper !== 'MASTER' && ctx.roleUpper !== 'ADMIN') {
      throw new AgendaAccessError('Disparo manual de worker restrito a MASTER/ADMIN.', 403);
    }
    tenantId = ctx.user.tenantId;
  }

  const result = await processDueAgendaNotificationJobs({
    tenantId,
    forceSandboxEmail: forceSandboxEmail || process.env.NODE_ENV !== 'production',
  });

  return agendaJsonReply({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  try {
    return await executeCronReminderBatch(request, false);
  } catch (error) {
    return handleAgendaApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { forceSandboxEmail?: boolean };
    return await executeCronReminderBatch(request, Boolean(body?.forceSandboxEmail));
  } catch (error) {
    return handleAgendaApiError(error);
  }
}
