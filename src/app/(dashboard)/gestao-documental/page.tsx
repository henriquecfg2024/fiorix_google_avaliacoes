import { DocumentSearch } from '@/components/documental/DocumentSearch';
import { requireDocumentAccess, DocumentAccessError } from '@/lib/documental/access';

export const dynamic = 'force-dynamic';
export default async function DocumentalPage() {
  try { await requireDocumentAccess(); }
  catch (error) {
    if (!(error instanceof DocumentAccessError)) throw error;
    return <div className="p-8"><h1 className="text-2xl font-semibold">Gestão Documental</h1><p className="mt-4 text-slate-300">{error.message}</p></div>;
  }
  return <div className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="space-y-1 sm:space-y-2">
      <p className="text-xs sm:text-sm uppercase tracking-widest text-cyan-400 font-semibold">Gestão de Qualidade / Documentos</p>
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">Gestão Documental</h1>
      <p className="text-xs sm:text-sm lg:text-base text-slate-400">Consulte documentos nas pastas autorizadas do cartório.</p>
    </header>
    <DocumentSearch />
  </div>;
}
