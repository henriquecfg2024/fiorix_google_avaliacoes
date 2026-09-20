import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
import { getConversations } from '@/app/actions/mensagens';
import { MensagensClient } from '@/components/mensagens/MensagensClient';

export const metadata: Metadata = {
  title: 'Mensagens | FIORIX',
  description: 'Mensageria Corporativa e Comunicação Interna Segura',
};

export const dynamic = 'force-dynamic';

export default async function MensagensPage() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect('/login');
  }

  const res = await getConversations();
  const initialConversations = res.success && res.conversations ? res.conversations : [];

  return (
    <MensagensClient
      initialConversations={initialConversations}
      currentUserId={user.id}
      tenantId={user.tenantId}
    />
  );
}
