import React from 'react';
import { getDepartamentos } from '@/app/actions/departamentos';
import { DepartamentosClient } from '@/components/configuracoes/DepartamentosClient';
import { requireRole } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Departamentos | FIORIX',
  description: 'Gestão de departamentos da organização',
};

export default async function DepartamentosPage() {
  await requireRole('ADMIN', 'MASTER', 'RH');
  const data = await getDepartamentos();

  return <DepartamentosClient initialData={data} />;
}
