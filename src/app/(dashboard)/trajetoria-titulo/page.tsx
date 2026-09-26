import { Metadata } from 'next';
import { MapPin, Calendar } from 'lucide-react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { TrajetoriaClient } from '@/components/trajetoria/TrajetoriaClient';

export const metadata: Metadata = {
  title: 'Rastreio do Título • FIORIX',
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
        {/* ── Breadcrumb — condicional por perfil ── */}
        <nav className="flex items-center gap-2 text-xs text-slate-500 dark:text-white/35 font-medium">
          {isColaborador ? (
            <>
              <span>Trabalho</span>
              <span>/</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">Rastreio do Título</span>
            </>
          ) : (
            <>
              <span>Operacional &amp; BI</span>
              <span>/</span>
              <span className="text-blue-600 dark:text-blue-400 font-semibold">Localização de Títulos</span>
            </>
          )}
        </nav>

        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-white/6">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div
              className="flex items-center justify-center w-12 h-12 rounded-2xl shrink-0
                bg-blue-50 border border-blue-200 text-blue-600 dark:bg-gradient-to-br dark:from-blue-600/25 dark:to-indigo-600/15 dark:border-blue-500/25 dark:text-blue-400 shadow-sm"
            >
              <MapPin className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>

            {/* Title */}
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Rastreio do Título
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Consulte a situação e a última localização conhecida de um
                protocolo no Cartório.
              </p>
            </div>
          </div>

          {/* Date / time display */}
          <div
            className="flex items-center gap-2.5 shrink-0 px-3.5 py-2 rounded-xl
              border border-slate-800/80 bg-[#0B1020]/90 backdrop-blur-xl shadow-xs"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <div className="text-right">
              <p className="text-xs font-bold text-slate-800 dark:text-white/80">
                {dataHora} &nbsp;{hora}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-white/40 capitalize">
                {diaCapitalizado}
              </p>
            </div>
          </div>
        </div>

        {/* ── Client component ── */}
        <TrajetoriaClient initialProtocolo={initialProtocolo} />
      </div>
    </div>
  );
}
