import { Metadata } from 'next';

import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { TrajetoriaClient } from '@/components/trajetoria/TrajetoriaClient';

export const metadata: Metadata = {
  title: 'Rastreio • FIORIX',
  description:
    'Consulte a situação e a última localização conhecida de um protocolo no Cartório.',
};

export default async function LocalizacaoTitulosPage({
  searchParams,
}: {
  searchParams?: { p?: string; protocolo?: string };
}) {
  let session = null;
  try {
    session = await auth();
  } catch (err) {
    if (isRedirectError(err)) throw err;
  }

  if (!session?.user) {
    redirect('/login');
  }

  const role = session.user.role ?? 'USER';
  if (role === 'RH') {
    redirect('/sistema/pessoas');
  }
  const isColaborador = role === 'COLABORADOR';

  const initialProtocolo =
    searchParams?.protocolo || searchParams?.p || '';

  const now = new Date();
  const dataHora = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hora = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const diaSemana = now.toLocaleDateString('pt-BR', { weekday: 'long' });
  const diaCapitalizado =
    diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070A12] text-slate-800 dark:text-white relative overflow-hidden pb-16 font-sans">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-cyan-500/5 dark:from-blue-500/12 dark:via-indigo-500/10 dark:to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] p-4 md:p-6 lg:p-8 space-y-6">
        {/* BARRA DE NAVEGAÇÃO COMPACTA EM LINHA ÚNICA (PADRÃO FIORIX) */}
        <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-2 border-b border-slate-200 dark:border-white/6">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">GESTÃO DE PRAZOS</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-extrabold tracking-wider">RASTREIO</span>
            <h1 className="sr-only">Rastreio e Localização de Protocolos</h1>
          </div>
        </div>

        {/* ── Client component ── */}
        <TrajetoriaClient initialProtocolo={initialProtocolo} />
      </div>
    </div>
  );
}
