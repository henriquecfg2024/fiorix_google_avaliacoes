import React from 'react';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Link from 'next/link';
import { ReviewItemCard } from '@/components/avaliacoes/ReviewItemCard';

export const dynamic = 'force-dynamic';

export default async function AvaliacoesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  const tenantId = session.user.tenantId as string;

  const rawStatus = Array.isArray(searchParams?.status) ? searchParams.status[0] : searchParams?.status;
  const statusFilter = typeof rawStatus === 'string' ? rawStatus : undefined;

  const rawRating = Array.isArray(searchParams?.rating) ? searchParams.rating[0] : searchParams?.rating;
  const parsedRating = typeof rawRating === 'string' ? parseInt(rawRating, 10) : undefined;
  const ratingFilter = (parsedRating && !isNaN(parsedRating)) ? parsedRating : undefined;
  const rawSearch = Array.isArray(searchParams?.search) ? searchParams.search[0] : searchParams?.search;
  const searchQuery = typeof rawSearch === 'string' ? rawSearch.trim() : undefined;

  const whereClause: any = { tenantId };
  if (statusFilter === 'PENDING') whereClause.status = 'PENDING';
  if (statusFilter === 'RESPONDED') whereClause.status = 'RESPONDED';
  if (ratingFilter) whereClause.rating = ratingFilter;
  if (searchQuery) {
    whereClause.comment = { contains: searchQuery, mode: 'insensitive' };
  }

  let reviews: any[] = [];
  let totalCount = 0;
  let pendingCount = 0;
  let respondedCount = 0;

  try {
    reviews = await prisma.review.findMany({
      where: whereClause,
      include: {
        response: true
      },
      orderBy: { publishedAt: 'desc' },
    });

    totalCount = await prisma.review.count({ where: { tenantId } });
    pendingCount = await prisma.review.count({ where: { tenantId, status: 'PENDING' } });
    respondedCount = await prisma.review.count({ where: { tenantId, status: 'RESPONDED' } });
  } catch (err) {
    console.error('Error fetching reviews:', err);
  }

  return (
    <div className="layout" style={{ gridTemplateColumns: '1fr' }}>
      <div className="center-col">
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Avaliações do Google Meu Negócio</div>
              <div className="chart-sub">Gerencie e responda às avaliações recebidas pelo cartório.</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Link href="/avaliacoes" className={`period-tab ${!statusFilter && !searchQuery ? 'active' : ''}`}>
                Todas ({totalCount})
              </Link>
              <Link href="/avaliacoes?status=PENDING" className={`period-tab ${statusFilter === 'PENDING' ? 'active' : ''}`}>
                ⏳ Aguardando resposta ({pendingCount})
              </Link>
              <Link href="/avaliacoes?status=RESPONDED" className={`period-tab ${statusFilter === 'RESPONDED' ? 'active' : ''}`}>
                ✅ Respondidas ({respondedCount})
              </Link>
            </div>
          </div>

          {searchQuery && (
            <div style={{ marginTop: '16px', padding: '10px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#1d4ed8', fontWeight: '600' }}>
                🔍 Filtrando avaliações mencionando: "{searchQuery}" ({reviews.length} resultado{reviews.length !== 1 ? 's' : ''})
              </span>
              <Link href="/avaliacoes" style={{ fontSize: '12px', color: '#3b82f6', textDecoration: 'none', fontWeight: '700' }}>
                ✕ Limpar filtro
              </Link>
            </div>
          )}

          {!Array.isArray(reviews) || !reviews.length ? (
            <div style={{ marginTop: '20px', padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', color: '#64748b' }}>
              <p style={{ fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Nenhuma avaliação encontrada com estes filtros.</p>
              <p style={{ fontSize: '13px' }}>Acesse o Dashboard para sincronizar ou importar novas avaliações.</p>
            </div>
          ) : (
            <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {reviews?.map ? reviews.map((rev) => (
                <ReviewItemCard key={rev.id} review={rev} />
              )) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
