import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import type { Metadata } from 'next';
import { requireRole } from '@/lib/auth-helpers';
import { loadInfraBriefingDashboard } from '@/lib/infra-briefing/store';
import { BriefingMatinalClient } from '@/components/operacoes/BriefingMatinalClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Briefing Matinal da Infraestrutura — SRVSQL · SRVFILES · SRVSIPLANIA | FIORIX',
  description:
    'Briefing diário consolidado às 07:15 BRT com saúde de SQL Server, WebRI IIS, SrvFiles/Connector e Portal SiplanIA / PostgreSQL.',
};

export default async function BriefingMatinalPage() {
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

  const initialData = await loadInfraBriefingDashboard(user.tenantId);

  return (
    <BriefingMatinalClient
      initialData={initialData}
      userName={user.name || 'Administrador'}
      userRole={user.role || 'ADMIN'}
    />
  );
}
