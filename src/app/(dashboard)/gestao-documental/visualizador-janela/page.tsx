import type { Metadata } from 'next';
import { requireDocumentAccess, DocumentAccessError } from '@/lib/documental/access';
import { VisualizadorJanela } from '@/components/documental/VisualizadorJanela';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Visualizador de Imagens — FIORIX',
  description: 'Janela separada do visualizador de documentos.',
};

export default async function VisualizadorJanelaPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  try {
    await requireDocumentAccess();
  } catch (error) {
    if (!(error instanceof DocumentAccessError)) throw error;
    return (
      <main className="p-8 text-white">
        <h1 className="text-xl font-semibold">Conferência de documento</h1>
        <p className="mt-3 text-slate-300">{error.message}</p>
      </main>
    );
  }

  return <VisualizadorJanela id={searchParams.id || ''} />;
}
