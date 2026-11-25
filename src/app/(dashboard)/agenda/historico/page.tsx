import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { isAgendaEnabled } from '@/lib/agenda/feature-flags';
import { AgendaInteligenteClient } from '@/components/agenda/AgendaInteligenteClient';

export const dynamic = 'force-dynamic';

export default function AgendaHistoricoPage() {
  if (!isAgendaEnabled()) {
    redirect('/dashboard');
  }
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Carregando Histórico...</div>}>
      <AgendaInteligenteClient initialSection="historico" initialView="LISTA" />
    </Suspense>
  );
}
