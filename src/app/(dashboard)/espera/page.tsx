import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
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

  // Verificar se a integração NextQS está configurada e ativa no tenant
  const nextqsConfig = await prisma.integrationConfig.findFirst({
    where: {
      tenantId: user.tenantId,
      integrationId: 'nextqs',
      isActive: true,
    },
    select: { id: true, status: true, encryptedConfig: true },
  });

  const isConfigured = !!(nextqsConfig && nextqsConfig.encryptedConfig);

  return (
    <GestaoEsperaClient
      isAdmin={isAdmin}
      isConfigured={isConfigured}
    />
  );
}
