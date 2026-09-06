import { redirect } from 'next/navigation';
import { obterMinhaItId } from '@/app/actions/its';

export const dynamic = 'force-dynamic';

export default async function MinhaItRedirectPage() {
  const itId = await obterMinhaItId();

  if (itId) {
    redirect(`/instrucoes-trabalho/${itId}`);
  } else {
    redirect('/administracao/its');
  }
}
