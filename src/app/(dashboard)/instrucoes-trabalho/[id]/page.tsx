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

  try {
    const data = await getItDetailData(id);

    if (!data) {
      notFound();
    }

    return <ItDetailViewClient initialData={data} />;
  } catch (err) {
    console.error('Erro ao carregar detalhe da IT:', err);
    notFound();
  }
}
