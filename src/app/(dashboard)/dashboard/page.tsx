import React from 'react';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { isRedirectError } from 'next/dist/client/components/redirect';
import { requireAuth } from '@/lib/auth-helpers';

import { ReputationHealth } from '@/components/dashboard/ReputationHealth';
import { computeReputationHealth } from '@/lib/reputation-health';
import { InsightCard } from '@/components/dashboard/InsightCard';
import { KpiRow } from '@/components/dashboard/KpiRow';
import { ReviewCard } from '@/components/dashboard/ReviewCard';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { ColaboradoresChart } from '@/components/dashboard/ColaboradoresChart';

export const dynamic = 'force-dynamic';

export default async function Dashboard({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let user;
  try {
    user = await requireAuth();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    redirect('/login');
  }

  if (!user || !user.tenantId) {
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
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfQuarter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // ── Real KPI Variations ──
  const activeReviews = allReviews.filter(r => !r.deletedFromGoogle);
  const thisMonthReviews = activeReviews.filter(r => new Date(r.publishedAt) >= startOfMonth);
  const lastMonthReviews = activeReviews.filter(r => {
    const d = new Date(r.publishedAt);
    return d >= startOfLastMonth && d < startOfMonth;
  });

  const avgThisMonth = thisMonthReviews.length > 0
    ? thisMonthReviews.reduce((s, r) => s + r.rating, 0) / thisMonthReviews.length : 0;
  const avgLastMonth = lastMonthReviews.length > 0
    ? lastMonthReviews.reduce((s, r) => s + r.rating, 0) / lastMonthReviews.length : 0;
  const notaVariation = avgLastMonth > 0 ? Math.round((avgThisMonth - avgLastMonth) * 10) / 10 : 0;
  const volumeVariation = thisMonthReviews.length - lastMonthReviews.length;

  const pendentesOntem = activeReviews.filter(r => {
    const d = new Date(r.publishedAt);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return r.status === 'PENDING' && d < yesterday;
  }).length;
  const pendentesVariation = pendentes - pendentesOntem;

  const respondidas = activeReviews.filter(r => r.status === 'RESPONDED').length;
  const respondidasEsteMes = thisMonthReviews.filter(r => r.status === 'RESPONDED').length;

  // ── Real Health Indicators — Análise por Assunto ──
  const totalActive = activeReviews.length;
  const taxaResposta = totalActive > 0 ? Math.round((respondidas / totalActive) * 100) : 0;
  const negativos = totalActive > 0 ? Math.round((activeReviews.filter(r => r.rating <= 2).length / totalActive) * 100) : 0;

  // Topic keywords map — each topic has keywords that identify it in reviews
  const topicDefs: { nome: string; icon: string; keywords: string[] }[] = [
    { nome: 'Atendimento', icon: '🤝', keywords: ['atendimento', 'atendeu', 'atendida', 'atendido', 'recepção', 'recepcionista', 'educad', 'cordial', 'simpátic', 'gentil', 'grosseir', 'mal educad'] },
    { nome: 'Competência Profissional', icon: '🎯', keywords: ['competent', 'profission', 'conhecimento', 'esclarec', 'orientou', 'explicou', 'dúvida', 'informaç'] },
    { nome: 'Tempo de Espera / Fila', icon: '⏱️', keywords: ['espera', 'fila', 'demora', 'demorou', 'lento', 'rápido', 'ágil', 'agilidade'] },
    { nome: 'Documentação', icon: '📄', keywords: ['documento', 'certidão', 'registro', 'escritura', 'reconhecimento', 'firma', 'autenticação', 'cópia'] },
    { nome: 'Telefone / Contato', icon: '📞', keywords: ['telefone', 'ligação', 'ligar', 'contato', 'email', 'whatsapp'] },
    { nome: 'Infraestrutura', icon: '🏢', keywords: ['estrutura', 'ambiente', 'limpo', 'organizado', 'confortável', 'café', 'ar condicionado', 'banheiro'] },
    { nome: 'Prazo de Entrega', icon: '📦', keywords: ['prazo', 'entrega', 'atraso', 'atrasado', 'demorado'] },
    { nome: 'Preço / Taxas', icon: '💰', keywords: ['preço', 'taxa', 'caro', 'valor', 'custo', 'emolumento', 'cobr'] },
    { nome: 'Agendamento / Site', icon: '🌐', keywords: ['agendamento', 'site', 'online', 'internet', 'sistema', 'agendar'] },
    { nome: 'Estacionamento', icon: '🅿️', keywords: ['estacionamento', 'estacionar', 'carro', 'vaga'] },
  ];

  // Calculate satisfaction per topic
  const topicResults = topicDefs.map(topic => {
    const matchedReviews = activeReviews.filter(r => {
      if (!r.comment) return false;
      const lc = r.comment.toLowerCase();
      return topic.keywords.some(kw => lc.includes(kw));
    });
    if (matchedReviews.length < 3) return null; // Min 3 mentions to show
    const positiveCount = matchedReviews.filter(r => r.rating >= 4).length;
    const pct = Math.round((positiveCount / matchedReviews.length) * 100);
    return { icon: topic.icon, nome: topic.nome, pct, mentions: matchedReviews.length };
  }).filter((t): t is NonNullable<typeof t> => t !== null);

  // Sort by mentions (most discussed first)
  topicResults.sort((a, b) => b.mentions - a.mentions);

  // Calculate weighted score based on topic satisfaction (weighted by mention count)
  const totalMentions = topicResults.reduce((s, t) => s + t.mentions, 0);
  const weightedScore = totalMentions > 0
    ? Math.round(topicResults.reduce((s, t) => s + t.pct * (t.mentions / totalMentions), 0))
    : 0;

  const healthIndicators = {
    saudaveis: topicResults
      .filter(i => i.pct >= 70)
      .map(({ mentions, ...rest }) => rest),
    atencao: topicResults
      .filter(i => i.pct >= 40 && i.pct < 70)
      .map(({ mentions, ...rest }) => ({ ...rest, badgeColor: 'amber' as const })),
    criticos: topicResults
      .filter(i => i.pct < 40)
      .map(({ mentions, ...rest }) => ({ ...rest, isBi: false, biPath: undefined })),
    score: weightedScore,
  };

  // ── Real Trend Chart Data ──
  const trendData: { month: string; nota: number; volume: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthReviews = activeReviews.filter(r => {
      const rd = new Date(r.publishedAt);
      return rd >= d && rd < nextD;
    });
    const monthName = d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
    const avgNota = monthReviews.length > 0
      ? Math.round((monthReviews.reduce((s, r) => s + r.rating, 0) / monthReviews.length) * 10) / 10
      : 0;
    trendData.push({ month: monthName.charAt(0).toUpperCase() + monthName.slice(1), nota: avgNota, volume: monthReviews.length });
  }


  // ── Collaborator Rankings ──
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

  // ── Real Insights ──
  const topColab = totalColaboradores[0];
  const lowRatingReviews = activeReviews.filter(r => r.rating <= 2);
  const lowRatingKeywords = new Map<string, number>();
  const keywords = ['espera', 'fila', 'demora', 'lento', 'prazo', 'atendimento', 'agendamento', 'documento', 'taxa', 'preço'];
  lowRatingReviews.forEach(r => {
    if (!r.comment) return;
    const lc = r.comment.toLowerCase();
    keywords.forEach(kw => { if (lc.includes(kw)) lowRatingKeywords.set(kw, (lowRatingKeywords.get(kw) || 0) + 1); });
  });
  const topComplaint = [...lowRatingKeywords.entries()].sort((a, b) => b[1] - a[1])[0];

  // Day-of-week analysis
  const dayAvgs = [0, 1, 2, 3, 4, 5, 6].map(day => {
    const dayReviews = activeReviews.filter(r => new Date(r.publishedAt).getDay() === day);
    return dayReviews.length > 0 ? dayReviews.reduce((s, r) => s + r.rating, 0) / dayReviews.length : 0;
  });
  const overallAvg = notaMedia || 0;
  const worstDay = dayAvgs.indexOf(Math.min(...dayAvgs.filter(d => d > 0)));
  const worstDayDiff = dayAvgs[worstDay] > 0 ? Math.round((dayAvgs[worstDay] - overallAvg) * 10) / 10 : 0;
  const dayNames = ['Domingos', 'Segundas', 'Terças', 'Quartas', 'Quintas', 'Sextas', 'Sábados'];

  const insights = {
    topComplaint: topComplaint ? { keyword: topComplaint[0], count: topComplaint[1], total: lowRatingReviews.length } : null,
    topColab: topColab ? { nome: topColab.nome, elogios: topColab.elogios } : null,
    worstDay: worstDayDiff < -0.2 ? { day: dayNames[worstDay], diff: worstDayDiff } : null,
    taxaResposta,
    respondidas,
    totalActive,
  };

  const rawSyncError = searchParams?.syncError;
  const syncError = Array.isArray(rawSyncError) ? rawSyncError[0] : rawSyncError;

  const rawSynced = searchParams?.synced;
  const syncedCount = Array.isArray(rawSynced) ? rawSynced[0] : rawSynced;

  const reputationHealth = computeReputationHealth(activeReviews);

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-300">Visão Geral</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Visão Consolidada
              </h1>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                PAINEL EXECUTIVO
              </span>
            </div>
          </div>
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

      {/* HEALTH CARD TOP SECTION (VERSÃO EXECUTIVA COMPACTA) */}
      <ReputationHealth variant="executive" data={reputationHealth} />

      {/* KPI ROW */}
      <KpiRow
        isDemo={isDemo}
        notaMedia={isDemo ? 4.4 : notaMedia}
        totalAvaliacoes={isDemo ? 536 : totalReviews}
        pendentes={isDemo ? 7 : pendentes}
        respondidasHoje={isDemo ? 12 : respondidasHoje}
        notaVariation={isDemo ? 0.1 : notaVariation}
        volumeVariation={isDemo ? 23 : volumeVariation}
        pendentesVariation={isDemo ? -3 : pendentesVariation}
        respondidasEsteMes={isDemo ? 8 : respondidasEsteMes}
      />

      {/* MAIN CONTENT GRID: 2 COLUMNS ON DESKTOP */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (7 COLS): CHARTS */}
        <div className="lg:col-span-7 space-y-6">
          <TrendChart data={isDemo ? undefined : trendData} />
          <ColaboradoresChart
            monthData={monthColaboradores}
            quarterData={quarterColaboradores}
            totalData={totalColaboradores}
          />
        </div>

        {/* RIGHT COLUMN (5 COLS): REVIEWS & INSIGHTS */}
        <div className="lg:col-span-5 space-y-6">
          <ReviewCard reviews={latestReviews} />
          <InsightCard insights={isDemo ? undefined : insights} />
        </div>
      </div>
      </main>
    </div>
  );
}
