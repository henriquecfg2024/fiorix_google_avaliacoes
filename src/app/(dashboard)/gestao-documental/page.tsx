import { DocumentSearch } from '@/components/documental/DocumentSearch';
import { requireDocumentAccess, DocumentAccessError } from '@/lib/documental/access';

export const dynamic = 'force-dynamic';
export default async function DocumentalPage() {
  try { await requireDocumentAccess(); }
  catch (error) {
    if (!(error instanceof DocumentAccessError)) throw error;
    return <div className="p-8"><h1 className="text-2xl font-semibold">Gestão Documental</h1><p className="mt-4 text-slate-300">{error.message}</p></div>;
  }
  return <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
    <header><p className="mb-2 text-xs uppercase tracking-widest text-cyan-400">Gestão de Qualidade / Documentos</p>
      <h1 className="text-2xl font-semibold">Gestão Documental</h1>
      <p className="mt-2 text-slate-400">Consulte documentos nas pastas autorizadas do cartório.</p>
    </header>
    <DocumentSearch />
  </div>;
}
