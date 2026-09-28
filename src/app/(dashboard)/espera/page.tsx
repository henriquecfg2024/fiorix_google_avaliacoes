import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { requireRole } from '@/lib/auth-helpers';
import { GestaoEsperaClient } from '@/components/espera/GestaoEsperaClient';

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

  // TODO: verificar se a integração NextQS está configurada no tenant
  const isConfigured = true;

  return (
    <GestaoEsperaClient
      isAdmin={isAdmin}
      isConfigured={isConfigured}
    />
  );
}
