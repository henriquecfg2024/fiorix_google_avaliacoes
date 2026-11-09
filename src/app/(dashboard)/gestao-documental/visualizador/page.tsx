import type { Metadata } from 'next';
import { requireDocumentAccess, DocumentAccessError } from '@/lib/documental/access';
import { VisualizadorJanela } from '@/components/documental/VisualizadorJanela';
import { VisualizadorDedicado } from '@/components/documental/VisualizadorDedicado';
import { GestaoDocumentalAbas } from '@/components/documental/GestaoDocumentalAbas';
import { BotaoVoltarTelaAnterior } from '@/components/ui/BotaoVoltarTelaAnterior';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Visualizador de Documentos — FIORIX',
  description: 'Visualizador oficial de imagens, matrículas e processos do acervo.',
};

export default async function VisualizadorPage({
  searchParams,
}: {
  searchParams:
    | Promise<{ id?: string; matricula?: string; sessao?: string; janela?: string }>
    | { id?: string; matricula?: string; sessao?: string; janela?: string };
}) {
  const sp = searchParams ? await Promise.resolve(searchParams) : {};
  const janelaId = sp?.id?.trim();
  const initialMatricula = sp?.matricula?.trim() || '';
  const initialSessao = sp?.sessao?.trim() || '';
  const modoJanelaSeparada = sp?.janela === '1';

  try {
    await requireDocumentAccess(janelaId ? undefined : '/gestao-documental/visualizador');
  } catch (error) {
    if (!(error instanceof DocumentAccessError)) throw error;
    return (
      <main className="p-8 text-white bg-[#070A12] min-h-screen">
        <h1 className="text-xl font-bold text-cyan-400">Visualizador de Documentos</h1>
        <p className="mt-3 text-sm text-slate-300">{error.message}</p>
      </main>
    );
  }

  if (janelaId) {
    return <VisualizadorJanela id={janelaId} />;
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-8 font-sans">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500/8 via-indigo-500/8 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1 pb-3 border-b border-white/10">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400 tracking-wider">GESTÃO DOCUMENTAL</span>
              <span className="text-slate-600">/</span>
              <span className="text-cyan-400 font-extrabold tracking-wider">VISUALIZADOR</span>
              <h1 className="sr-only">Visualizador de Documentos</h1>
            </div>

            <GestaoDocumentalAbas ativa="visualizador" />
          </div>

          <BotaoVoltarTelaAnterior />
        </div>

        <VisualizadorDedicado
          initialMatricula={initialMatricula}
          initialSessao={initialSessao}
          modoJanelaSeparada={modoJanelaSeparada}
        />
      </div>
    </div>
  );
}
