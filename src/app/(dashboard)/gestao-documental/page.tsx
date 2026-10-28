import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DocumentSearch } from '@/components/documental/DocumentSearch';
import { requireDocumentAccess, DocumentAccessError } from '@/lib/documental/access';

export const dynamic = 'force-dynamic';

export default async function DocumentalPage() {
  try {
    await requireDocumentAccess();
  } catch (error) {
    if (!(error instanceof DocumentAccessError)) throw error;
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold">Gestão Documental</h1>
        <p className="mt-4 text-slate-300">{error.message}</p>
      </div>
    );
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
        <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-3 border-b border-white/8">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">GESTÃO DE QUALIDADE</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-extrabold tracking-wider">GESTÃO DOCUMENTAL</span>
            <h1 className="sr-only">Gestão Documental</h1>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/[0.05] hover:bg-white/[0.1] px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition shadow-sm active:scale-95"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-cyan-400" />
            <span>Voltar ao Início</span>
          </Link>
        </div>

        <DocumentSearch />
      </div>
    </div>
  );
}
