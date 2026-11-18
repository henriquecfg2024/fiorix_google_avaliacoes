import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GestaoDocumentalAbas } from '@/components/documental/GestaoDocumentalAbas';
import { PesquisaRegistralClient } from '@/components/documental/PesquisaRegistralClient';
import { BotaoVoltarTelaAnterior } from '@/components/ui/BotaoVoltarTelaAnterior';
import { requireDocumentAccess, DocumentAccessError } from '@/lib/documental/access';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pesquisa Registral Integrada — Gestão Documental | FIORIX',
};

export default async function PesquisaRegistralPage() {
  try {
    await requireDocumentAccess('/gestao-documental/pesquisa');
  } catch (err) {
    if (err instanceof DocumentAccessError) {
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

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-16 font-sans">
      {/* Ambient Glow (Padrão FIORIX) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500/8 via-indigo-500/8 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8 space-y-6">
        {/* BARRA DE NAVEGAÇÃO COMPACTA EM LINHA ÚNICA (PADRÃO FIORIX) */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1 pb-3 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400 tracking-wider">GESTÃO DOCUMENTAL</span>
              <span className="text-slate-600">/</span>
              <span className="text-cyan-400 font-extrabold tracking-wider">PESQUISA REGISTRAL</span>
              <h1 className="sr-only">Pesquisa Registral Integrada</h1>
            </div>

            <GestaoDocumentalAbas ativa="pesquisa" />
          </div>

          <BotaoVoltarTelaAnterior />
        </div>

        <PesquisaRegistralClient />
      </div>
    </div>
  );
}
