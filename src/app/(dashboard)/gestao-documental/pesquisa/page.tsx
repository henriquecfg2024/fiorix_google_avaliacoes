import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GestaoDocumentalAbas } from '@/components/documental/GestaoDocumentalAbas';
import { PesquisaRegistralClient } from '@/components/documental/PesquisaRegistralClient';
import { BotaoVoltarTelaAnterior } from '@/components/ui/BotaoVoltarTelaAnterior';
import { requireDocumentAccess, DocumentAccessError } from '@/lib/documental/access';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pesquisa Registral Integrada | FIORIX',
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
    <div className="relative min-h-screen bg-[#070A12] text-slate-100 overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute top-1/3 right-1/5 h-96 w-96 rounded-full bg-sky-500/10 blur-[130px]" />
      </div>

      <main className="relative z-10 mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-800/80 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-400">
              <span>Gestão Documental</span>
              <span className="text-slate-600">•</span>
              <span className="text-sky-400">WEBRI + SiplanIA</span>
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              Pesquisa Registral Integrada
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              Consulta híbrida somente leitura no Indicador Real, Indicador Pessoal e índice OCR completo das matrículas.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GestaoDocumentalAbas ativa="pesquisa" />
            <BotaoVoltarTelaAnterior />
          </div>
        </header>

        <PesquisaRegistralClient />
      </main>
    </div>
  );
}
