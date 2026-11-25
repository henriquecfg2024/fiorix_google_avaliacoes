import type { NextRequest } from 'next/server';
import { auth } from '@/auth';
import { agendaJsonReply, handleAgendaApiError } from '@/lib/agenda/api-helpers';
import { getWelcomeSummaryForSession } from '@/lib/agenda/service';
import type { AgendaWelcomeScenario } from '@/lib/agenda/types';
import { requireAuth } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

const VALID_PREVIEW_SCENARIOS = new Set<AgendaWelcomeScenario>([
  'A_UM_COMPROMISSO',
  'B_VARIOS_COMPROMISSOS',
  'C_SEM_COMPROMISSOS',
  'D_TODOS_CONCLUIDOS',
  'E_COM_ATRASADOS',
  'F_FALHA_CONSULTA',
  'G_SEM_PERMISSAO_AGENDA',
]);

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const session = await auth();
    const authAt = (session?.user as { authAt?: number } | undefined)?.authAt;

    const { searchParams } = new URL(request.url);
    const rawPreview = searchParams.get('preview') as AgendaWelcomeScenario | null;
    const allowPreview =
      process.env.NODE_ENV !== 'production' || String(user.role).toUpperCase() === 'MASTER';
    const scenarioPreview =
      allowPreview && rawPreview && VALID_PREVIEW_SCENARIOS.has(rawPreview)
        ? rawPreview
        : undefined;

    const welcome = await getWelcomeSummaryForSession({
      user,
      authAt,
      scenarioPreview,
    });
    return agendaJsonReply(welcome);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Não autorizado.';
    if (msg.includes('autorizado') || msg.includes('inativa')) {
      return agendaJsonReply({ error: msg }, 401);
    }
    return handleAgendaApiError(error);
  }
}
