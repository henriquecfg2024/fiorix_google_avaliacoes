import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import nextDynamic from 'next/dynamic';
import { getMinhaItData } from '@/app/actions/minha-it';

const MinhaItCleanClient = nextDynamic(
  () => import('@/components/its/MinhaItCleanClient').then((mod) => mod.MinhaItCleanClient),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-50 dark:bg-[#070A12] text-slate-900 dark:text-white p-6 sm:p-8">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="h-8 w-64 rounded-xl bg-slate-200 dark:bg-white/5 animate-pulse" />
          <div className="h-96 rounded-[28px] border border-slate-800/80 bg-[#0B1020]/90 animate-pulse" />
          <div className="h-64 rounded-[28px] border border-slate-800/80 bg-[#0B1020]/90 animate-pulse" />
        </div>
      </div>
    ),
  }
);

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Minhas Instruções de Trabalho • Responsável Técnico | FIORIX',
  description: 'Controle de versão e gestão das instruções de trabalho sob responsabilidade técnica oficial.',
};

interface MinhaItPageProps {
  searchParams?: Promise<{ codigo?: string }> | { codigo?: string };
}

export default async function MinhaItPage({ searchParams }: MinhaItPageProps) {
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : undefined;
  const codigo = typeof resolvedParams?.codigo === 'string' ? resolvedParams.codigo : undefined;

  try {
    const data = await getMinhaItData(codigo);
    return <MinhaItCleanClient initialData={data} />;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error('Erro ao carregar dados de Minha IT:', err);
    redirect('/login');
  }
}
