import React from 'react';
import { prisma } from '@/lib/prisma';
import { loadColaboradoresComReviews } from '@/lib/colaboradores-data';
import { countElogios, getColaboradorReviews } from '@/lib/colaboradores-metrics';
import { getTenantIdOrDefault } from '@/lib/tenant';

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
  const tenantId = await getTenantIdOrDefault();

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

  const demoReviewsSample = [
    {
      id: 'demo-1',
      reviewerName: 'Raquel Pereira Nascimento',
      rating: 5,
      comment: 'Atendimento muito cortês e ágil pela equipe do cartório.',
      status: 'RESPONDED',
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'demo-2',
      reviewerName: 'Walquiron Alves',
      rating: 5,
      comment: 'Excelente atendimento, Sr. Lucas esclareceu as dúvidas, só tenho a agradecer!!!',
      status: 'RESPONDED',
      publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'demo-3',
      reviewerName: 'Glória Gomes',
      rating: 5,
      comment: 'Gostaria de registrar meu agradecimento pelo excelente atendimento prestado pela Ana.',
      status: 'RESPONDED',
      publishedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'demo-4',
      reviewerName: 'Carlos Mendonça',
      rating: 4,
      comment: 'Muito rápido e eficiente. Atendimento nota 10!',
      status: 'RESPONDED',
      publishedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'demo-5',
      reviewerName: 'Maria Santos',
      rating: 3,
      comment: 'Atendimento bom, mas o tempo de espera na fila poderia ser menor.',
      status: 'PENDING',
      publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    },
  ];

  const latestReviews = !isDemo
    ? await prisma.review.findMany({
        where: { tenantId },
        orderBy: { publishedAt: 'desc' },
        take: 5,
      })
    : demoReviewsSample;

  const { colaboradores: dbColaboradores, reviews: allReviews } = await loadColaboradoresComReviews(tenantId);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfQuarter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const getColabRank = (fromDate?: Date) =>
    dbColaboradores
      .map((colab) => ({
        nome: colab.name,
        elogios: countElogios(getColaboradorReviews(colab, allReviews, fromDate)),
      }))
      .sort((a, b) => b.elogios - a.elogios)
      .slice(0, 5);

  const monthColaboradores = getColabRank(startOfMonth);
  const quarterColaboradores = getColabRank(startOfQuarter);
  const totalColaboradores = getColabRank(undefined);

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
          <ColaboradoresChart 
            monthData={monthColaboradores} 
            quarterData={quarterColaboradores} 
            totalData={totalColaboradores} 
          />
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
