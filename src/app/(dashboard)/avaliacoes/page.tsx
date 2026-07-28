import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Link from 'next/link';
import { ReviewItemCard } from '@/components/avaliacoes/ReviewItemCard';

export default async function AvaliacoesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await auth();
  const tenantId = (session?.user?.tenantId as string) || 'cartorio-7ri-sp';

  const statusFilter = typeof searchParams?.status === 'string' ? searchParams.status : undefined;
  const ratingFilter = typeof searchParams?.rating === 'string' ? parseInt(searchParams.rating, 10) : undefined;

  const whereClause: any = { tenantId };
  if (statusFilter === 'PENDING') whereClause.status = 'PENDING';
  if (statusFilter === 'RESPONDED') whereClause.status = 'RESPONDED';
  if (ratingFilter) whereClause.rating = ratingFilter;

  const reviews = await prisma.review.findMany({
    where: whereClause,
    include: {
      response: true
    },
    orderBy: { publishedAt: 'desc' },
  });

  const totalCount = await prisma.review.count({ where: { tenantId } });
  const pendingCount = await prisma.review.count({ where: { tenantId, status: 'PENDING' } });
  const respondedCount = await prisma.review.count({ where: { tenantId, status: 'RESPONDED' } });

  return (
    <div className="layout" style={{ gridTemplateColumns: '1fr' }}>
      <div className="center-col">
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Avaliações do Google Meu Negócio</div>
              <div className="chart-sub">Gerencie e responda às avaliações recebidas pelo cartório.</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <Link href="/avaliacoes" className={`period-tab ${!statusFilter ? 'active' : ''}`}>
                Todas ({totalCount})
              </Link>
              <Link href="/avaliacoes?status=PENDING" className={`period-tab ${statusFilter === 'PENDING' ? 'active' : ''}`}>
                ⏳ Pendentes ({pendingCount})
              </Link>
              <Link href="/avaliacoes?status=RESPONDED" className={`period-tab ${statusFilter === 'RESPONDED' ? 'active' : ''}`}>
                ✅ Respondidas ({respondedCount})
              </Link>
            </div>
          </div>

          {reviews.length === 0 ? (
            <div style={{ marginTop: '20px', padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', color: '#64748b' }}>
              <p style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Nenhuma avaliação encontrada com estes filtros.</p>
              <p style={{ fontSize: '13px' }}>Acesse o Dashboard para sincronizar ou importar novas avaliações.</p>
            </div>
          ) : (
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {reviews.map((rev) => (
                <ReviewItemCard key={rev.id} review={rev} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
