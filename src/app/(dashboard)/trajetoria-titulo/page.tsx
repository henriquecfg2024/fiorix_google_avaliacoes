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
    <div className="min-h-full p-4 md:p-6 lg:p-8 space-y-6">
      {/* ── Breadcrumb — condicional por perfil ── */}
      <nav className="flex items-center gap-2 text-xs text-white/30 font-medium">
        {isColaborador ? (
          <>
            <span>Trabalho</span>
            <span>/</span>
            <span className="text-white/60">Rastreio do Título</span>
          </>
        ) : (
          <>
            <span>Operacional &amp; BI</span>
            <span>/</span>
            <span className="text-white/60">Localização de Títulos</span>
          </>
        )}
      </nav>

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl shrink-0
              bg-gradient-to-br from-blue-600/30 to-indigo-600/20 border border-blue-500/25"
          >
            <MapPin className="w-5 h-5 text-blue-400" />
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Rastreio do Título
            </h1>
            <p className="text-sm text-white/40 mt-0.5">
              Consulte a situação e a última localização conhecida de um
              protocolo no Cartório.
            </p>
          </div>
        </div>

        {/* Date / time display */}
        <div
          className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-lg
            border border-white/[0.07] bg-white/[0.03]"
        >
          <Calendar className="w-3.5 h-3.5 text-white/30" />
          <div className="text-right">
            <p className="text-xs font-bold text-white/70">
              {dataHora} &nbsp;{hora}
            </p>
            <p className="text-[10px] text-white/30 capitalize">
              {diaCapitalizado}
            </p>
          </div>
        </div>
      </div>

      {/* ── Client component ── */}
      <TrajetoriaClient initialProtocolo={initialProtocolo} />
    </div>
  );
}
