import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { requireRole } from '@/lib/auth-helpers';
import { GestaoEsperaClient } from '@/components/espera/GestaoEsperaClient';
import { getEsperaData } from '@/lib/espera/espera-service';

export const dynamic = 'force-dynamic';

export default async function EsperaPage() {
  let user;
  try {
    user = await requireRole('MASTER', 'ADMIN', 'SUBSTITUTO');
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect('/dashboard');
  }

  if (!user || !user.tenantId) {
    redirect('/dashboard');
  }

  const isAdmin = user.role === 'MASTER' || user.role === 'ADMIN';

  // Buscar dados iniciais no servidor para o mês corrente (SSR instantâneo)
  const initialData = await getEsperaData(user.tenantId, 'mes').catch(() => null);

  return (
    <GestaoEsperaClient
      isAdmin={isAdmin}
      isConfigured={initialData?.configured ?? true}
      initialData={initialData}
    />
  );
}
