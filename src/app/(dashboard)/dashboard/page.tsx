import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

import { HealthCard } from '@/components/dashboard/HealthCard';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { KpiRow } from '@/components/dashboard/KpiRow';
import { ReviewCard } from '@/components/dashboard/ReviewCard';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { ColaboradoresChart } from '@/components/dashboard/ColaboradoresChart';

export default async function Dashboard({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await auth();
  const tenantId = (session?.user?.tenantId as string) || 'cartorio-7ri-sp';

  // Fetch real data from Prisma
  const totalReviews = await prisma.review.count({ where: { tenantId } });
  const googleConnection = await prisma.googleConnection.findFirst({ where: { tenantId } });
  
  const isConnected = !!googleConnection;
  const isDemo = totalReviews === 0;

  // Real KPI aggregation
  const avgRatingRes = await prisma.review.aggregate({
    where: { tenantId },
    _avg: { rating: true }
  });
  const notaMedia = avgRatingRes._avg.rating || 0;

  const pendentes = await prisma.review.count({
    where: { tenantId, status: 'PENDING' }
  });

  const respondidasHoje = await prisma.review.count({
    where: {
      tenantId,
      status: 'RESPONDED',
    }
  });

  const latestReviews = !isDemo
    ? await prisma.review.findMany({
        where: { tenantId },
        orderBy: { publishedAt: 'desc' },
        take: 3,
      })
    : undefined;

  // Real Collaborator Rankings from DB
  const dbColaboradores = await prisma.colaborador.findMany({
    where: { tenantId, active: true },
    include: {
      mentions: {
        include: { review: true }
      }
    }
  });

  const allReviews = await prisma.review.findMany({
    where: { tenantId }
  });

  const topColaboradoresData = dbColaboradores.map((colab) => {
    const namesToSearch = [colab.name, ...(colab.aliases || [])].map(n => n.trim().toLowerCase()).filter(Boolean);
    const matchedReviews = allReviews.filter(rev => {
      if (!rev.comment) return false;
      const commentLower = rev.comment.toLowerCase();
      return namesToSearch.some(term => commentLower.includes(term));
    });

    const relationalReviews = colab.mentions.map(m => m.review).filter(Boolean);
    const combinedReviewsMap = new Map();
    [...relationalReviews, ...matchedReviews].forEach(rev => {
      if (rev && rev.id) combinedReviewsMap.set(rev.id, rev);
    });
    
    const uniqueReviews = Array.from(combinedReviewsMap.values());
    const elogios = uniqueReviews.filter(rev => rev.rating >= 4 || rev.aiSentiment === 'POSITIVE').length;

    return {
      nome: colab.name,
      elogios: uniqueReviews.length > 0 ? elogios : 0
    };
  }).sort((a, b) => b.elogios - a.elogios).slice(0, 5);

  const rawSyncError = searchParams?.syncError;
  const syncError = Array.isArray(rawSyncError) ? rawSyncError[0] : rawSyncError;

  const rawSynced = searchParams?.synced;
  const syncedCount = Array.isArray(rawSynced) ? rawSynced[0] : rawSynced;

  return (
    <div className="layout">
      {syncError && (
        <div style={{ gridColumn: '1 / -1', background: '#fee2e2', color: '#991b1b', padding: '12px 20px', borderRadius: '12px', fontSize: '14px', marginBottom: '10px', border: '1px solid #fca5a5' }}>
          ❌ <strong>Erro ao Sincronizar com o Google:</strong> {syncError}
        </div>
      )}

      {syncedCount && (
        <div style={{ gridColumn: '1 / -1', background: '#dcfce7', color: '#166534', padding: '12px 20px', borderRadius: '12px', fontSize: '14px', marginBottom: '10px', border: '1px solid #86efac' }}>
          🎉 <strong>Sincronização Concluída:</strong> {syncedCount} novas avaliações importadas!
        </div>
      )}

      {!isConnected && isDemo && (
        <div style={{ 
          gridColumn: '1 / -1', 
          background: '#eff6ff', 
          color: '#1e3a8a', 
          padding: '14px 20px', 
          borderRadius: '12px', 
          fontSize: '14px', 
          fontWeight: '500', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          border: '1px solid #bfdbfe', 
          marginBottom: '10px' 
        }}>
          <div>
            👋 <strong>Modo Demonstração:</strong> Como você ainda não conectou o Google Meu Negócio, estamos exibindo dados fictícios para você conhecer o painel.
          </div>
          
          <a href="/configuracoes" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'none' }}>
            Conectar Google
          </a>
        </div>
      )}

      {/* ═══ LEFT ═══ */}
      <div className="left-col">
        <HealthCard />
      </div>

      {/* ═══ CENTER ═══ */}
      <div className="center-col">
        <KpiRow 
          isDemo={isDemo}
          notaMedia={isDemo ? 4.4 : notaMedia}
          totalAvaliacoes={isDemo ? 536 : totalReviews}
          pendentes={isDemo ? 7 : pendentes}
          respondidasHoje={isDemo ? 12 : respondidasHoje}
        />

        {/* AREA CHART */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Tendência de Avaliações</div>
              <div className="chart-sub">Evolução da nota média e volume — últimos 6 meses</div>
            </div>
            <div className="period-tabs">
              <button className="period-tab">7d</button>
              <button className="period-tab active">30d</button>
              <button className="period-tab">90d</button>
              <button className="period-tab">1a</button>
            </div>
          </div>
          <TrendChart />
        </div>

        {/* COLABORADORES CHART */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Ranking dos Colaboradores</div>
              <div className="chart-sub">Menções positivas extraídas por IA das avaliações</div>
            </div>
            <div className="period-tabs">
              <button className="period-tab active">Este mês</button>
              <button className="period-tab">Trimestre</button>
            </div>
          </div>
          <ColaboradoresChart data={topColaboradoresData} />
        </div>
      </div>

      {/* ═══ RIGHT ═══ */}
      <div className="right-col">
        <ReviewCard reviews={latestReviews} />
        <InsightCard />
      </div>
    </div>
  );
}
