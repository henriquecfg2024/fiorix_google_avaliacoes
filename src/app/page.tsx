import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { getHomeRouteForRole } from '@/lib/permissions';
import { getFirstAllowedRouteForUser } from '@/lib/nav-permissions/service';

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  let role = session.user.role || 'USER';
  let tenantId = (session.user as any).tenantId || '';
  let departamento: string | null = (session.user as any).departamento || null;

  if (session.user.id) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, tenantId: true, departamento: true },
      });
      if (dbUser) {
        role = String(dbUser.role || role);
        tenantId = dbUser.tenantId || tenantId;
        departamento = dbUser.departamento ?? departamento;
      }
    } catch {}
  }

  if (session.user.id && tenantId) {
    const target = await getFirstAllowedRouteForUser({
      id: session.user.id,
      role,
      tenantId,
      departamento,
    });
    redirect(target);
  }

  redirect(getHomeRouteForRole(role));
}
