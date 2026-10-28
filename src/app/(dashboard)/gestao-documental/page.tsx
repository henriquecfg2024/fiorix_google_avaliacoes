import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
    <header className="space-y-2">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition group shadow-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-cyan-400 transition-transform group-hover:-translate-x-0.5" />
          <span>Voltar ao Início</span>
        </Link>
      </div>
      <p className="text-xs sm:text-sm uppercase tracking-widest text-cyan-400 font-semibold">Gestão de Qualidade / Documentos</p>
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white">Gestão Documental</h1>
      <p className="text-xs sm:text-sm lg:text-base text-slate-400">Consulte documentos nas pastas autorizadas do cartório.</p>
    </header>
    <DocumentSearch />
  </div>;
}
