import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { getHomeRouteForRole } from '@/lib/permissions';

export default async function Home() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }
  redirect(getHomeRouteForRole(session.user.role));
}
