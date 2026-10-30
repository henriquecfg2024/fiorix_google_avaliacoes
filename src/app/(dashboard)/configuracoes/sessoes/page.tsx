import React from 'react';
import { requireRole } from '@/lib/auth-helpers';
import { getSessoesConfig } from '@/app/actions/sessoes';
import { SessoesClient } from '@/components/configuracoes/SessoesClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Cadastro de Sessões | FIORIX Gestão de Qualidade',
  description: 'Gerenciamento de sessões de documentos, diretórios de rede e parâmetros de busca Siplan.',
};

export default async function SessoesPage() {
  // Acesso exclusivo por MASTER e ADMIN
  await requireRole('ADMIN', 'MASTER');

  const sessoes = await getSessoesConfig();

  return <SessoesClient initialData={sessoes} />;
}
