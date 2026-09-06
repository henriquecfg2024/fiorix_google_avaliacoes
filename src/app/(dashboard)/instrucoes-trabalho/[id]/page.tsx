import React from 'react';
import { notFound } from 'next/navigation';
import { getItDetailData } from '@/app/actions/its';
import { ItDetailViewClient } from '@/components/its/ItDetailViewClient';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function InstrucaoTrabalhoDetailPage({ params }: PageProps) {
  const data = await getItDetailData(params.id);

  if (!data) {
    notFound();
  }

  return <ItDetailViewClient initialData={data} />;
}
