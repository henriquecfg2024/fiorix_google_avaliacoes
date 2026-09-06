import React from 'react';
import { getGovernancaRhData } from '@/app/actions/its';
import { GovernancaRhClient } from '@/components/its/GovernancaRhClient';

export const dynamic = 'force-dynamic';

export default async function InstrucoesTrabalhoMonitoramentoPage() {
  const data = await getGovernancaRhData();
  return <GovernancaRhClient initialData={data} />;
}
