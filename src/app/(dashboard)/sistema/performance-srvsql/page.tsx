import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth-helpers';
import { buildSrvsqlPerformanceSnapshot } from '@/lib/srvsql-performance/store';
import { PerformanceSrvsqlClient } from '@/components/operacoes/PerformanceSrvsqlClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Performance do SRVSQL — WEBRI · SQL Server · Serviços do Windows | FIORIX',
  description:
    'Monitoramento, diagnóstico com evidências, cadeias de bloqueio SQL Server, métricas do Windows e dossiê para a SIPLAN.',
};

export default async function PerformanceSrvsqlPage() {
  let user;
  try {
    user = await requireRole('MASTER', 'ADMIN', 'SUBSTITUTO', 'VISITANTE');
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect('/dashboard');
  }

  if (!user || !user.tenantId) {
    redirect('/dashboard');
  }

  const initialSnapshot = buildSrvsqlPerformanceSnapshot(
    user.tenantId,
    'LENTIDAO_BLOQUEIO',
    '30m',
  );

  return (
    <PerformanceSrvsqlClient
      initialSnapshot={initialSnapshot}
      userName={user.name || 'Administrador'}
      userRole={user.role || 'ADMIN'}
    />
  );
}

