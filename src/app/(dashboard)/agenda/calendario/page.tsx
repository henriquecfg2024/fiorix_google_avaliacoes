import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { isAgendaEnabled } from '@/lib/agenda/feature-flags';
import { AgendaInteligenteClient } from '@/components/agenda/AgendaInteligenteClient';

export const dynamic = 'force-dynamic';

export default function AgendaCalendarioPage() {
  if (!isAgendaEnabled()) {
    redirect('/dashboard');
  }
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Carregando Calendário...</div>}>
      <AgendaInteligenteClient initialSection="calendario" initialView="MENSAL" />
    </Suspense>
  );
}
