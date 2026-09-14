import React from 'react';
import { notFound } from 'next/navigation';
import { getItDetailData } from '@/app/actions/its';
import { ItDetailViewClient } from '@/components/its/ItDetailViewClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function InstrucaoTrabalhoDetailPage({ params }: PageProps) {
  const resolvedParams = await Promise.resolve(params);
  const id = resolvedParams.id;

  if (!id) {
    notFound();
  }

  let data = null;
  try {
    data = await getItDetailData(id);
  } catch (err: any) {
    if (err?.digest?.startsWith?.('NEXT_NOT_FOUND') || err?.message === 'NEXT_NOT_FOUND') {
      throw err;
    }
    console.error('Erro ao carregar detalhe da IT:', err);
    notFound();
  }

  if (!data) {
    notFound();
  }

  return <ItDetailViewClient initialData={data} />;
}
