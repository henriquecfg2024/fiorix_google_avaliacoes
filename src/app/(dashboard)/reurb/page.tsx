import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { CentralReurbClient } from '@/components/reurb/CentralReurbClient';
import { BotaoVoltarTelaAnterior } from '@/components/ui/BotaoVoltarTelaAnterior';
import { getDefaultSpAnoMes } from '@/lib/reurb/api-helpers';
import {
  isReurbDemoModeActive,
  requireReurbAccess,
  ReurbAccessError,
} from '@/lib/reurb/permissions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Central REURB — Regularização Fundiária Urbana | FIORIX',
};

export default async function CentralReurbPage() {
  let ctx;
  try {
    ctx = await requireReurbAccess();
  } catch (err) {
    if (err instanceof ReurbAccessError) {
      if (err.status === 401) {
        redirect('/login');
      }
      return (
        <div className="min-h-screen bg-[#070A12] text-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-[#0D1322] p-6 text-center space-y-3">
            <h1 className="text-lg font-bold text-rose-300">Acesso restrito</h1>
            <p className="text-sm text-slate-300">{err.message}</p>
            <div className="pt-2 flex justify-center">
              <BotaoVoltarTelaAnterior />
            </div>
          </div>
        </div>
      );
    }
    throw err;
  }

  const { ano, mes } = getDefaultSpAnoMes();
  const demoMode = isReurbDemoModeActive();

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-16 font-sans">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/8 via-cyan-500/8 to-blue-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1 pb-3 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">GESTÃO DOCUMENTAL</span>
            <span className="text-slate-600">/</span>
            <span className="text-emerald-400 font-extrabold tracking-wider">CENTRAL REURB</span>
            <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              ONR v1.4
            </span>
          </div>

          <BotaoVoltarTelaAnterior />
        </div>

        <CentralReurbClient
          initialAno={ano}
          initialMes={mes}
          demoMode={demoMode}
          permissoes={{
            canExportJson: ctx.canExportJson,
            canConfirmImport: ctx.canConfirmImport,
            isReadOnly: ctx.isReadOnly,
          }}
          userRole={String(ctx.user.role)}
        />
      </div>
    </div>
  );
}
