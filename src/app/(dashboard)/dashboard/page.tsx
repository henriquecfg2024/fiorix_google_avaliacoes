import React from 'react';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';

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
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect('/login');
  }
  const tenantId = user.tenantId;

  // Fetch real data from Prisma
  const totalReviews = await prisma.review.count({ where: { tenantId, deletedFromGoogle: false } });
  const googleConnection = await prisma.googleConnection.findFirst({ where: { tenantId } });
  
  const isConnected = !!googleConnection;
  const isDemo = totalReviews === 0;

  // Real KPI aggregation
  const avgRatingRes = await prisma.review.aggregate({
    where: { tenantId, deletedFromGoogle: false },
    _avg: { rating: true }
  });
  const notaMedia = avgRatingRes._avg.rating || 0;

  const pendentes = await prisma.review.count({
    where: { tenantId, status: 'PENDING', deletedFromGoogle: false }
  });

  const respondidasHoje = await prisma.review.count({
    where: {
      tenantId,
      status: 'RESPONDED',
      deletedFromGoogle: false,
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

  function getColabRank(fromDate?: Date) {
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
  }

  const monthColaboradores = getColabRank(startOfMonth);
  const quarterColaboradores = getColabRank(startOfQuarter);
  const totalColaboradores = getColabRank(undefined);

  const rawSyncError = searchParams?.syncError;
  const syncError = Array.isArray(rawSyncError) ? rawSyncError[0] : rawSyncError;

  const rawSynced = searchParams?.synced;
  const syncedCount = Array.isArray(rawSynced) ? rawSynced[0] : rawSynced;

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        <div className="rounded-[28px] border border-white/8 bg-[#0B1020]/72 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-white/42">
            <span>Dashboard</span>
            <span className="text-white/20">/</span>
            <span>Visão Geral</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-[2.15rem] font-black tracking-[0.01em] text-transparent bg-clip-text bg-gradient-to-r from-slate-50 via-white to-amber-300">
              FIORIX Dashboard - Visão Consolidada
            </h1>
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 font-mono text-xs text-emerald-300">
              PAINEL EXECUTIVO
            </span>
          </div>

          <p className="max-w-4xl text-sm leading-relaxed text-white/58">
            Visão consolidada das avaliações do Google, desempenho dos colaboradores, saúde da reputação e insights inteligentes.
          </p>
        </div>
      {syncError && (
        <div className="flex items-center gap-3 rounded-[20px] border border-rose-500/20 bg-[#0B1020]/80 px-5 py-4 text-sm text-rose-200 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-500/20 bg-rose-500/10 text-base">!</span>
          <span><strong>Erro ao Sincronizar com o Google:</strong> {syncError}</span>
        </div>
      )}

      {syncedCount && (
        <div className="flex items-center gap-3 rounded-[20px] border border-emerald-500/20 bg-[#0B1020]/80 px-5 py-4 text-sm text-emerald-200 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-base">v</span>
          <span><strong>Sincronização Concluída:</strong> {syncedCount} novas avaliações importadas!</span>
        </div>
      )}

      {!isConnected && isDemo && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-[20px] border border-amber-400/20 bg-[#0B1020]/80 px-5 py-4 text-sm text-amber-100 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/20 bg-amber-400/10 text-base">i</span>
            <span>
              <strong>Modo Demonstração:</strong> Como você ainda não conectou o Google Meu Negócio, estamos exibindo dados de exemplo para demonstração do painel.
            </span>
          </div>
          <a
            href="/configuracoes"
            className="rounded-xl border border-amber-400/20 bg-amber-400/15 px-4 py-2 text-xs font-bold whitespace-nowrap text-amber-200 transition-colors hover:bg-amber-400/25 self-end sm:self-auto"
          >
            Conectar Google &rarr;
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
      </main>
    </div>
  );
}
