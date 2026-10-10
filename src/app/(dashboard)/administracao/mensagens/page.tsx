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
        {/* BARRA DE NAVEGAÇÃO COMPACTA EM LINHA ÚNICA (PADRÃO FIORIX) */}
        <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-2 border-b border-slate-200 dark:border-white/6">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">SISTEMA & TECNOLOGIA</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-extrabold tracking-wider">GESTÃO DE MENSAGENS</span>
            <h1 className="sr-only">Gestão de Mensagens Corporativas</h1>
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
