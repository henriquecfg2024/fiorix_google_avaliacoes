import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function InstrucoesTrabalhoRoutePage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  const userRole = String(session.user.role || 'COLABORADOR').toUpperCase();

  // Perfis de liderança/gestão acessam a Governança completa de ITs
  if (['SUBSTITUTO', 'ADMIN', 'MASTER'].includes(userRole)) {
    redirect('/administracao/its');
  }

  // Colaboradores e outros perfis são direcionados para sua tela de IT
  redirect('/minha-it');
}
