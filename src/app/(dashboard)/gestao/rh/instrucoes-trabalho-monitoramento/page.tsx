import React from 'react';
import { getGovernancaRhData } from '@/app/actions/its';
import { GovernancaRhClient } from '@/components/its/GovernancaRhClient';
import { requireRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export default async function InstrucoesTrabalhoMonitoramentoPage() {
  const currentUser = await requireRole('ADMIN', 'RH', 'MASTER');
  const data = await getGovernancaRhData();
  return <GovernancaRhClient initialData={data} currentUserRole={currentUser.role} />;
}
