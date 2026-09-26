import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth-helpers';
import { getAdminMessagingMetrics } from '@/app/actions/mensagens';
import { GestaoMensagensClient } from '@/components/mensagens/admin/GestaoMensagensClient';
import { MessageCircle, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Gestão de Mensagens | FIORIX',
  description: 'Governança, Políticas e Métricas de Mensageria Corporativa',
};

export const dynamic = 'force-dynamic';

export default async function GestaoMensagensPage() {
  try {
    await requireRole('ADMIN', 'MASTER');
  } catch {
    redirect('/dashboard');
  }

  const res = await getAdminMessagingMetrics();

  if (!res.success || !res.metrics || !res.policy) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs">
        Falha ao carregar métricas de gestão de mensagens: {res.error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-500/30 dark:bg-[#070A12] dark:text-white transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-indigo-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200 dark:border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Administração</span>
              <span className="text-slate-600">/</span>
              <span className="text-indigo-400">Gestão de Mensagens</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <MessageCircle className="w-6 h-6 text-indigo-400" />
                Gestão de Mensagens Corporativas
              </h1>
              <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                GOVERNANÇA & SEGURANÇA
              </span>
            </div>
          </div>
        </div>

        <GestaoMensagensClient
          metrics={res.metrics}
          policy={res.policy}
          auditLogs={res.auditLogs || []}
        />
      </main>
    </div>
  );
}
