import { NextResponse } from 'next/server';
import { isAgendaEnabled } from './feature-flags';
import { AgendaAccessError } from './permissions';

export function agendaJsonReply(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}

export function ensureAgendaFeatureActive(): void {
  if (!isAgendaEnabled()) {
    throw new AgendaAccessError('Módulo Agenda Inteligente V1.0 desativado neste ambiente.', 404);
  }
}

export function handleAgendaApiError(error: unknown) {
  if (error instanceof AgendaAccessError) {
    return agendaJsonReply({ error: error.message }, error.status);
  }
  const msg = error instanceof Error ? error.message : 'Erro interno na Agenda Inteligente.';
  return agendaJsonReply({ error: msg }, 500);
}
