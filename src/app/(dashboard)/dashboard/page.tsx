import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

import { HealthCard } from '@/components/dashboard/HealthCard';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { KpiRow } from '@/components/dashboard/KpiRow';
import { ReviewCard } from '@/components/dashboard/ReviewCard';
import { OpHealthCard } from '@/components/dashboard/OpHealthCard';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { ColaboradoresChart } from '@/components/dashboard/ColaboradoresChart';

export default async function Dashboard({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await auth();
  const tenantId = session?.user?.tenantId as string;

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

  const syncError = searchParams?.syncError;
  const syncedCount = searchParams?.synced;

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
      {isDemo && (
        <div style={{ 
          gridColumn: '1 / -1', 
          background: isConnected ? '#f0fdf4' : '#eff6ff', 
          color: isConnected ? '#166534' : '#1e3a8a', 
          padding: '14px 20px', 
          borderRadius: '12px', 
          fontSize: '14px', 
          fontWeight: '500', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          border: `1px solid ${isConnected ? '#bbf7d0' : '#bfdbfe'}`, 
          marginBottom: '10px' 
        }}>
          <div>
            {isConnected ? (
              <>✅ <strong>Google Conectado:</strong> Sua conta está vinculada, mas você ainda não possui avaliações importadas no banco de dados. Exibindo dados de exemplo.</>
            ) : (
              <>👋 <strong>Modo Demonstração:</strong> Como você ainda não conectou o Google Meu Negócio, estamos exibindo dados fictícios para você conhecer o painel.</>
            )}
          </div>
          
          {isConnected ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <form action="/api/sync-reviews" method="POST">
                <button type="submit" style={{ background: '#16a34a', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                  🔄 Sincronizar Google Real
                </button>
              </form>

              <form action="/api/seed-reviews" method="POST">
                <button type="submit" style={{ background: '#475569', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                  🧪 Importar Avaliações de Teste
                </button>
              </form>
            </div>
          ) : (
            <a href="/configuracoes" style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'none' }}>
              Conectar Google
            </a>
          )}
        </div>
      )}

      {/* ═══ LEFT ═══ */}
      <div className="left-col">
        <HealthCard />
        <InsightCard />
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
          <ColaboradoresChart />
        </div>
      </div>

      {/* ═══ RIGHT ═══ */}
      <div className="right-col">
        <ReviewCard reviews={latestReviews} />
        <OpHealthCard />
      </div>
    </div>
  );
}
