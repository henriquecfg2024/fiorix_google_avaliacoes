import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { getMemorialInfraSnapshot } from '@/lib/memorial-infraestrutura/store';
import { MemorialInfraestruturaClient } from '@/components/operacoes/MemorialInfraestruturaClient';
import { BotaoVoltarTelaAnterior } from '@/components/ui/BotaoVoltarTelaAnterior';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Memorial dos Servidores 7º RI (Exclusivo MASTER) | FIORIX',
  description:
    'Documentação contínua, governança e métricas Antes vs. Depois dos servidores SRVSQL, SRVFILES e SRVSIPLANIA.',
};

export default async function MemorialInfraestruturaPage() {
  let sessionUser;
  try {
    sessionUser = await requireAuth();
  } catch {
    redirect('/login');
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, role: true, tenantId: true, name: true, email: true },
  });

  if (!dbUser || dbUser.role !== 'MASTER' || sessionUser.role !== 'MASTER') {
    redirect('/dashboard');
  }

  const effectiveTenantId = sessionUser.tenantId || dbUser.tenantId;
  const snapshot = await getMemorialInfraSnapshot(effectiveTenantId);
  const masterName = dbUser.name || dbUser.email || 'MASTER';

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-16 font-sans">
      {/* Ambient Glow (Padrão FIORIX) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500/8 via-cyan-500/8 to-emerald-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8 space-y-6">
        {/* Barra compacta em linha única (div para evitar conflito com regra global header de globals.css) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1 pb-3 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400 tracking-wider">SISTEMA &amp; TECNOLOGIA</span>
              <span className="text-slate-600">/</span>
              <span className="text-cyan-400 font-extrabold tracking-wider">MEMORIAL DOS SERVIDORES</span>
              <h1 className="sr-only">Memorial Técnico e Executivo dos Servidores do 7º RI</h1>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-200">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
              Exclusivo MASTER
            </span>
          </div>

          <BotaoVoltarTelaAnterior fallbackHref="/sistema/briefing-matinal" />
        </div>

        <MemorialInfraestruturaClient initialSnapshot={snapshot} masterName={masterName} />
      </div>
    </div>
  );
}
