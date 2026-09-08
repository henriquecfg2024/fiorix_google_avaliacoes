import React from 'react';
import { getMinhasItsData } from '@/app/actions/its';
import { MinhasItsClient } from '@/components/its/MinhasItsClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Minhas Instruções de Trabalho | FIORIX',
};

export default async function MinhaItPage() {
  const data = await getMinhasItsData();

  return <MinhasItsClient initialData={data} />;
}
