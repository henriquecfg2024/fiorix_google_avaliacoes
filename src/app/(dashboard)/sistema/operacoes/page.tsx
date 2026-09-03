import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth-helpers';
import { getOperationsHealth } from '@/lib/health/operations-service';
import { CentralOperacoesClient } from '@/components/operacoes/CentralOperacoesClient';

export const dynamic = 'force-dynamic';

export default async function OperacoesPage() {
  let user;
  try {
    user = await requireRole('MASTER', 'ADMIN');
  } catch (err) {
    redirect('/dashboard');
  }

  const initialHealth = await getOperationsHealth(user.tenantId);

  return <CentralOperacoesClient initialHealth={initialHealth} userName={user.name || 'Administrador'} />;
}
