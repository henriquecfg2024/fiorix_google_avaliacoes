import Link from 'next/link';
import { FileText, Eye, Archive } from 'lucide-react';

type Aba = 'manifestacoes' | 'visualizador' | 'historico';

const ABAS: { id: Aba; href: string; rotulo: string; Icone: typeof FileText }[] = [
  { id: 'manifestacoes', href: '/gestao-documental', rotulo: 'Manifestações', Icone: FileText },
  { id: 'visualizador', href: '/gestao-documental/visualizador', rotulo: 'Visualizador', Icone: Eye },
  { id: 'historico', href: '/gestao-documental/historico', rotulo: 'Histórico', Icone: Archive },
];

/** Alternador de submenus da Gestão Documental (Manifestações / Visualizador / Histórico). */
export function GestaoDocumentalAbas({ ativa }: { ativa: Aba }) {
  return (
    <nav aria-label="Submenus da Gestão Documental" className="flex items-center rounded-lg border border-white/15 bg-slate-900/80 p-0.5 text-xs font-semibold">
      {ABAS.map(({ id, href, rotulo, Icone }) => (
        <Link
          key={id}
          href={href}
          aria-current={ativa === id ? 'page' : undefined}
          className={
            ativa === id
              ? 'flex items-center gap-1.5 px-3 py-1 bg-cyan-600/90 text-white shadow-sm transition rounded-md font-bold'
              : 'flex items-center gap-1.5 px-3 py-1 text-slate-400 hover:text-white transition rounded-md'
          }
        >
          <Icone className="h-3.5 w-3.5" />
          <span>{rotulo}</span>
        </Link>
      ))}
    </nav>
  );
}
