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

  // Real Collaborator Rankings from DB filtered by time periods
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

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfQuarter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const getColabRank = (fromDate?: Date) => {
    const nameMap = new Map<string, number>();
    dbColaboradores.forEach((colab) => {
      const namesToSearch = [colab.name, ...(colab.aliases || [])].map(n => n.trim().toLowerCase()).filter(Boolean);
      const matchedReviews = allReviews.filter(rev => {
        if (!rev.comment) return false;
        if (fromDate && new Date(rev.publishedAt) < fromDate) return false;
        const commentLower = rev.comment.toLowerCase();
        return namesToSearch.some(term => commentLower.includes(term));
      });

      const relationalReviews = colab.mentions
        .map(m => m.review)
        .filter(rev => rev && (!fromDate || new Date(rev.publishedAt) >= fromDate));

      const combinedReviewsMap = new Map();
      [...relationalReviews, ...matchedReviews].forEach(rev => {
        if (rev && rev.id) combinedReviewsMap.set(rev.id, rev);
      });
      
      const uniqueReviews = Array.from(combinedReviewsMap.values());
      const elogios = uniqueReviews.filter(rev => rev.rating >= 4 || rev.aiSentiment === 'POSITIVE').length;

      const normName = colab.name.trim();
      const current = nameMap.get(normName) || 0;
      nameMap.set(normName, Math.max(current, elogios));
    });

    return Array.from(nameMap.entries())
      .map(([nome, elogios]) => ({ nome, elogios }))
      .sort((a, b) => b.elogios - a.elogios)
      .slice(0, 5);
  };

  const monthColaboradores = getColabRank(startOfMonth);
  const quarterColaboradores = getColabRank(startOfQuarter);
  const totalColaboradores = getColabRank(undefined);

  const rawSyncError = searchParams?.syncError;
  const syncError = Array.isArray(rawSyncError) ? rawSyncError[0] : rawSyncError;

  const rawSynced = searchParams?.synced;
  const syncedCount = Array.isArray(rawSynced) ? rawSynced[0] : rawSynced;

  return (
    <div className="w-full px-4 md:px-7 py-6 space-y-6">
      {syncError && (
        <div className="bg-red-50 text-red-800 p-3.5 px-5 rounded-2xl text-sm border border-red-200 flex items-center gap-2">
          <span>❌</span>
          <span><strong>Erro ao Sincronizar com o Google:</strong> {syncError}</span>
        </div>
      )}

      {syncedCount && (
        <div className="bg-emerald-50 text-emerald-800 p-3.5 px-5 rounded-2xl text-sm border border-emerald-200 flex items-center gap-2">
          <span>🎉</span>
          <span><strong>Sincronização Concluída:</strong> {syncedCount} novas avaliações importadas!</span>
        </div>
      )}

      {!isConnected && isDemo && (
        <div className="bg-blue-50/80 text-blue-900 p-4 px-5 rounded-2xl text-sm border border-blue-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span>👋</span>
            <span>
              <strong>Modo Demonstração:</strong> Como você ainda não conectou o Google Meu Negócio, estamos exibindo dados de exemplo para demonstração do painel.
            </span>
          </div>
          <a
            href="/configuracoes"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap self-end sm:self-auto"
          >
            Conectar Google →
          </a>
        </div>
      )}

      {/* HEALTH CARD TOP SECTION */}
      <HealthCard />

      {/* KPI ROW */}
      <KpiRow
        isDemo={isDemo}
        notaMedia={isDemo ? 4.4 : notaMedia}
        totalAvaliacoes={isDemo ? 536 : totalReviews}
        pendentes={isDemo ? 7 : pendentes}
        respondidasHoje={isDemo ? 12 : respondidasHoje}
      />

      {/* MAIN CONTENT GRID: 2 COLUMNS ON DESKTOP */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (7 COLS): CHARTS */}
        <div className="lg:col-span-7 space-y-6">
          <TrendChart />
          <ColaboradoresChart
            monthData={monthColaboradores}
            quarterData={quarterColaboradores}
            totalData={totalColaboradores}
          />
        </div>

        {/* RIGHT COLUMN (5 COLS): REVIEWS & INSIGHTS */}
        <div className="lg:col-span-5 space-y-6">
          <ReviewCard reviews={latestReviews} />
          <InsightCard />
        </div>
      </div>
    </div>
  );
}

