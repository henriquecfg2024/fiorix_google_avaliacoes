import React from 'react';
import { getMinhaItData } from '@/app/actions/minha-it';
import { MinhaItCleanClient } from '@/components/its/MinhaItCleanClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Minhas Instruções de Trabalho • Responsável Técnico | FIORIX',
  description: 'Controle de versão e gestão das instruções de trabalho sob responsabilidade técnica oficial.',
};

interface MinhaItPageProps {
  searchParams?: Promise<{ codigo?: string }> | { codigo?: string };
}

export default async function MinhaItPage({ searchParams }: MinhaItPageProps) {
  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : undefined;
  const codigo = typeof resolvedParams?.codigo === 'string' ? resolvedParams.codigo : undefined;

  const data = await getMinhaItData(codigo);

  return <MinhaItCleanClient initialData={data} />;
}
