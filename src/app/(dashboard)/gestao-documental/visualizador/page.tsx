import type { Metadata } from 'next';
import { requireDocumentAccess, DocumentAccessError } from '@/lib/documental/access';
import { VisualizadorJanela } from '@/components/documental/VisualizadorJanela';
import { VisualizadorDedicado } from '@/components/documental/VisualizadorDedicado';
import { listarAbasGestaoDocumentalVisiveis } from '@/components/documental/GestaoDocumentalAbas';

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

  const abasNavegacao = await listarAbasGestaoDocumentalVisiveis('visualizador');

  return (
    <div className="h-full w-full bg-[#070A12] text-white overflow-hidden flex flex-col font-sans">
      <h1 className="sr-only">Visualizador de Documentos</h1>
      <VisualizadorDedicado
        initialMatricula={initialMatricula}
        initialSessao={initialSessao}
        modoJanelaSeparada={modoJanelaSeparada}
        abasNavegacao={abasNavegacao}
      />
    </div>
  );
}
