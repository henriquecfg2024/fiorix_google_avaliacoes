import Link from 'next/link';
import { FileText, Eye, Archive, Clock } from 'lucide-react';
import { requireAuth } from '@/lib/auth-helpers';
import { isNavPermissionsFeatureEnabled, isRouteAllowedForUser } from '@/lib/nav-permissions/service';

type Aba = 'manifestacoes' | 'visualizador' | 'historico' | 'conferencia';

const ABAS: { id: Aba; href: string; rotulo: string; Icone: typeof FileText }[] = [
  { id: 'manifestacoes', href: '/gestao-documental', rotulo: 'Manifestações', Icone: FileText },
  { id: 'visualizador', href: '/gestao-documental/visualizador', rotulo: 'Visualizador', Icone: Eye },
  { id: 'historico', href: '/gestao-documental/historico', rotulo: 'Histórico', Icone: Archive },
  { id: 'conferencia', href: '/gestao-documental/conferencia', rotulo: 'Em Conferência', Icone: Clock },
];

/** Alternador de submenus da Gestão Documental (Manifestações / Visualizador / Histórico / Em Conferência). */
export async function GestaoDocumentalAbas({ ativa }: { ativa: Aba }) {
  let podeManifestacoes = true;
  let podeVisualizador = true;
  let podeHistorico = true;
  let podeConferencia = true;

  try {
    const user = await requireAuth();
    if (isNavPermissionsFeatureEnabled()) {
      const [allowManif, allowVis, allowHist, allowConf] = await Promise.all([
        isRouteAllowedForUser('/gestao-documental', user),
        isRouteAllowedForUser('/gestao-documental/visualizador', user),
        isRouteAllowedForUser('/gestao-documental/historico', user),
        isRouteAllowedForUser('/gestao-documental/conferencia', user),
      ]);
      podeManifestacoes = allowManif;
      podeVisualizador = allowVis;
      podeHistorico = allowHist;
      podeConferencia = allowConf || allowManif;
    }
  } catch {
    // Em caso de falha na sessão, exibe apenas a aba ativa
  }

  const abasVisiveis = ABAS.filter((aba) => {
    if (aba.id === ativa) return true;
    if (aba.id === 'manifestacoes') return podeManifestacoes;
    if (aba.id === 'visualizador') return podeVisualizador;
    if (aba.id === 'historico') return podeHistorico;
    if (aba.id === 'conferencia') return podeConferencia;
    return true;
  });

  if (abasVisiveis.length <= 1) {
    return null;
  }

  return (
    <nav aria-label="Submenus da Gestão Documental" className="flex items-center rounded-lg border border-white/15 bg-slate-900/80 p-0.5 text-xs font-semibold">
      {abasVisiveis.map(({ id, href, rotulo, Icone }) => (
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
