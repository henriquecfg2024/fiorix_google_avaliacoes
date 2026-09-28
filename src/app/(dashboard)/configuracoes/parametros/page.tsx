import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { requireRole } from '@/lib/auth-helpers';
import { ParametrosClient } from '@/components/configuracoes/ParametrosClient';

export const dynamic = 'force-dynamic';

export default async function ParametrosPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let user;
  try {
    user = await requireRole('MASTER', 'ADMIN');
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect('/dashboard');
  }

  if (!user || !user.tenantId) {
    redirect('/dashboard');
  }

  const rawTab = searchParams?.tab;
  const initialTab = Array.isArray(rawTab) ? rawTab[0] : rawTab;

  return (
    <ParametrosClient
      initialTab={initialTab || 'integracoes'}
      userName={user.name || 'Administrador'}
    />
  );
}
