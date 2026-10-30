import type { Metadata } from 'next';
import { requireDocumentAccess, DocumentAccessError } from '@/lib/documental/access';
import { VisualizadorJanela } from '@/components/documental/VisualizadorJanela';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Visualizador de Imagens — FIORIX',
  description: 'Visualizador oficial de imagens e documentos do acervo.',
};

export default async function VisualizadorPage({
  searchParams,
}: {
  searchParams: { id?: string };
}) {
  try {
    await requireDocumentAccess();
  } catch (error) {
    if (!(error instanceof DocumentAccessError)) throw error;
    return (
      <main className="p-8 text-gray-800 bg-[#EAEAEA] min-h-screen">
        <h1 className="text-xl font-bold text-[#0F3D6E]">Conferência de Documento</h1>
        <p className="mt-3 text-sm text-gray-600">{error.message}</p>
      </main>
    );
  }

  return <VisualizadorJanela id={searchParams?.id || ''} />;
}
