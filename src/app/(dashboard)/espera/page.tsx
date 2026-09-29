import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { GestaoEsperaClient } from '@/components/espera/GestaoEsperaClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

  // Verificar se a integração NextQS está configurada no tenant
  const nextqsConfig = await prisma.integrationConfig.findFirst({
    where: {
      tenantId: user.tenantId,
      integrationId: 'nextqs',
    },
    select: { id: true, status: true, encryptedConfig: true, configIv: true, isActive: true },
  });

  const hasCredentials = !!(nextqsConfig && nextqsConfig.encryptedConfig && nextqsConfig.configIv);
  const isConfigured = hasCredentials && nextqsConfig.status !== 'DISCONNECTED';

  // Auto-heal: se possui credenciais salvas e não está desconectado, garantir isActive: true
  if (hasCredentials && !nextqsConfig.isActive && nextqsConfig.status !== 'DISCONNECTED') {
    await prisma.integrationConfig.update({
      where: { id: nextqsConfig.id },
      data: { isActive: true },
    }).catch(() => null);
  }

  return (
    <GestaoEsperaClient
      isAdmin={isAdmin}
      isConfigured={isConfigured}
    />
  );
}
