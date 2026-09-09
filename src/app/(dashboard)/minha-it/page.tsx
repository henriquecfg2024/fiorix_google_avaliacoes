import React from 'react';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
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

  try {
    const data = await getMinhaItData(codigo);
    return <MinhaItCleanClient initialData={data} />;
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error('Erro ao carregar dados de Minha IT:', err);
    redirect('/login');
  }
}
