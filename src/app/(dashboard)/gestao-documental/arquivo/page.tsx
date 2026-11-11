import type { Metadata } from 'next';
import { ArquivoManifestacoes } from '@/components/documental/ArquivoManifestacoes';
import { GestaoDocumentalAbas } from '@/components/documental/GestaoDocumentalAbas';
import { requireArquivoManifestacaoAccess, DocumentAccessError } from '@/lib/documental/access';
import { BotaoVoltarTelaAnterior } from '@/components/ui/BotaoVoltarTelaAnterior';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Arquivo de Manifestações — Gestão Documental | FIORIX',
  description:
    'Procedimentos de manifestação finalizados após a Etapa 2, com consulta ao formulário conferido, histórico e reimpressão.',
};

export default async function ArquivoManifestacoesPage() {
  try {
    await requireArquivoManifestacaoAccess();
  } catch (error) {
    if (!(error instanceof DocumentAccessError)) throw error;
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold">Arquivo de Manifestações</h1>
        <p className="mt-4 text-slate-300">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-16 font-sans">
      {/* Ambient Glow (Padrão FIORIX) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-500/8 via-indigo-500/8 to-emerald-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400 tracking-wider">GESTÃO DOCUMENTAL</span>
              <span className="text-slate-600">/</span>
              <span className="text-cyan-400 font-extrabold tracking-wider">ARQUIVO</span>
              <h1 className="sr-only">Arquivo de Manifestações Finalizadas</h1>
            </div>
            <GestaoDocumentalAbas ativa="arquivo" />
          </div>

          <BotaoVoltarTelaAnterior />
        </div>

        <ArquivoManifestacoes />
      </div>
    </div>
  );
}

