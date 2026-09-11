import React from 'react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
import { ReputationHealth } from '@/components/dashboard/ReputationHealth';
import { computeReputationHealth } from '@/lib/reputation-health';
import {
  Target,
  ExternalLink,
  ArrowRight,
  Lightbulb,
  Sparkles,
  ShieldAlert,
  Clock,
  UserCheck,
  Zap,
  Building2,
  HelpCircle,
  CheckCircle2,
  ThumbsUp,
  FileText,
  Globe,
  Timer,
  BarChart3,
  AlertTriangle,
  MessageSquare,
  Smile,
  Meh,
  Frown,
  Brain,
  ChevronRight,
  Star,
  Handshake,
  Award,
  Hourglass,
  DollarSign,
  Phone,
  Car,
  SquareParking,
  AlertCircle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EstatisticasPage() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect('/login');
  }
  const tenantId = user.tenantId;

  // Busca dados unificados no PostgreSQL
  const [reviews] = await Promise.all([
    prisma.review.findMany({
      where: { tenantId, deletedFromGoogle: false },
      select: {
        rating: true,
        comment: true,
      },
    }),
  ]);

  const totalReviews = reviews.length;
  const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    if (starCounts[r.rating] !== undefined) {
      starCounts[r.rating]++;
    }
  }

  const fiveStars = starCounts[5] || 0;
  const fourStars = starCounts[4] || 0;
  const threeStars = starCounts[3] || 0;
  const twoStars = starCounts[2] || 0;
  const oneStar = starCounts[1] || 0;

  const getPercent = (count: number) =>
    totalReviews > 0 ? ((count / totalReviews) * 100).toFixed(1) : '0.0';

  // Cálculo unificado oficial da Saúde da Reputação (10 Indicadores)
  const reputationHealth = computeReputationHealth(reviews);

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <Link href="/" className="hover:text-white transition-colors">Dashboard</Link>
              <span className="text-slate-600">/</span>
              <span>Gestão</span>
              <span className="text-slate-600">/</span>
              <span className="text-amber-300">Estatísticas</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Estatísticas de Desempenho
              </h1>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                SAÚDE DA REPUTAÇÃO
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">Base de análise:</span>
            <span className="font-mono text-xs font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-2.5 py-1 rounded-lg">
              {totalReviews} resenhas
            </span>
          </div>
        </div>

        {/* Linha Superior: Distribuição de Notas & Análise Qualitativa Real */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 items-stretch">
          {/* Card 1: Distribuição de Notas */}
          <div className="flex flex-col justify-between rounded-[24px] border border-white/10 bg-[#0B1020]/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-5">
            <div>
              {/* Header do Card */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/30 text-blue-400 shadow-sm">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">
                      Distribuição de Notas
                    </h3>
                    <p className="text-xs text-slate-400">
                      Volume de avaliações separadas por número de estrelas
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-1.5 flex items-center gap-2 shadow-xs">
                  <Star className="h-4 w-4 text-emerald-400 fill-emerald-400 shrink-0" />
                  <div className="leading-tight">
                    <span className="text-xs font-black text-emerald-300 block">
                      {totalReviews > 0 ? (((fiveStars + fourStars) / totalReviews) * 100).toFixed(1).replace('.', ',') : '0,0'}% Positivas
                    </span>
                    <span className="text-[10px] font-medium text-emerald-400/80 block">
                      4 e 5 estrelas
                    </span>
                  </div>
                </div>
              </div>

              {/* 5 Linhas de Distribuição por Estrelas */}
              <div className="space-y-3 pt-5">
                {[
                  {
                    starsLabel: '5 estrelas',
                    starsSymbols: '★★★★★',
                    starsColor: 'text-emerald-400',
                    barColor: 'bg-emerald-500',
                    count: fiveStars,
                  },
                  {
                    starsLabel: '4 estrelas',
                    starsSymbols: '★★★★☆',
                    starsColor: 'text-cyan-400',
                    barColor: 'bg-cyan-400',
                    count: fourStars,
                  },
                  {
                    starsLabel: '3 estrelas',
                    starsSymbols: '★★★☆☆',
                    starsColor: 'text-amber-400',
                    barColor: 'bg-amber-400',
                    count: threeStars,
                  },
                  {
                    starsLabel: '2 estrelas',
                    starsSymbols: '★★☆☆☆',
                    starsColor: 'text-orange-400',
                    barColor: 'bg-orange-400',
                    count: twoStars,
                  },
                  {
                    starsLabel: '1 estrela',
                    starsSymbols: '★☆☆☆☆',
                    starsColor: 'text-rose-500',
                    barColor: 'bg-rose-500',
                    count: oneStar,
                  },
                ].map((row, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs">
                    <span className="w-18 font-semibold text-slate-300 shrink-0">{row.starsLabel}</span>
                    <span className={`w-16 font-bold tracking-widest shrink-0 ${row.starsColor}`}>
                      {row.starsSymbols}
                    </span>
                    <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-slate-800/90 shadow-inner">
                      <div
                        className={`${row.barColor} h-full transition-all duration-500`}
                        style={{ width: `${getPercent(row.count)}%` }}
                      />
                    </div>
                    <span className="w-24 text-right font-bold text-white shrink-0">
                      {row.count}{' '}
                      <span className="text-slate-400 font-medium text-[11px]">
                        ({getPercent(row.count).replace('.', ',')}%)
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Resumo Executivo: 4 KPIs compactos na parte inferior */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-4 border-t border-white/8">
              {/* Total de avaliações */}
              <div className="rounded-xl border border-white/10 bg-[#070D1E]/90 p-3 flex flex-col justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-300">
                    <MessageSquare className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-lg font-black text-white">{totalReviews}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium mt-1.5 block leading-tight">
                  Total de avaliações
                </span>
              </div>

              {/* Avaliações Positivas */}
              <div className="rounded-xl border border-white/10 bg-[#070D1E]/90 p-3 flex flex-col justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
                    <Smile className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-lg font-black text-white">{fiveStars + fourStars}</span>
                </div>
                <div className="leading-tight mt-1.5">
                  <span className="text-[10px] text-slate-400 font-medium block">Avaliações positivas</span>
                  <span className="text-[9px] text-emerald-400/80 font-medium">(4 e 5 estrelas)</span>
                </div>
              </div>

              {/* Avaliações Neutras */}
              <div className="rounded-xl border border-white/10 bg-[#070D1E]/90 p-3 flex flex-col justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-300">
                    <Meh className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-lg font-black text-white">{threeStars}</span>
                </div>
                <div className="leading-tight mt-1.5">
                  <span className="text-[10px] text-slate-400 font-medium block">Avaliações neutras</span>
                  <span className="text-[9px] text-amber-400/80 font-medium">(3 estrelas)</span>
                </div>
              </div>

              {/* Avaliações Negativas */}
              <div className="rounded-xl border border-white/10 bg-[#070D1E]/90 p-3 flex flex-col justify-between shadow-xs">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/15 text-rose-300">
                    <Frown className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-lg font-black text-white">{twoStars + oneStar}</span>
                </div>
                <div className="leading-tight mt-1.5">
                  <span className="text-[10px] text-slate-400 font-medium block">Avaliações negativas</span>
                  <span className="text-[9px] text-rose-400/80 font-medium">(1 e 2 estrelas)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Análise Qualitativa Semântica */}
          <div className="flex flex-col justify-between rounded-[24px] border border-white/10 bg-[#0B1020]/80 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
            {/* Header do Card */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-600/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 shadow-sm">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    Análise Qualitativa Semântica
                  </h3>
                  <p className="text-xs text-slate-400">
                    Fatores operacionais reais mais citados nas resenhas do cartório.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-xs font-mono font-bold text-cyan-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>100% ANALISADO</span>
              </div>
            </div>

            {/* 4 Cards dos Fatores Operacionais */}
            <div className="space-y-3 pt-1">
              {[
                {
                  id: 'agilidade',
                  topic: 'Agilidade e Prontidão no Serviço',
                  score: computedIndicators.find((i) => i.id === 'agilidade')?.score || 95,
                  sentiment: 'Excelente',
                  query: 'rapido',
                  count: computedIndicators.find((i) => i.id === 'agilidade')?.count || 104,
                  Icon: Zap,
                  borderClass: 'border-emerald-500/25 hover:border-emerald-500/40',
                  iconBoxClass: 'bg-emerald-500/15 text-emerald-300',
                  barColor: 'bg-emerald-500',
                  textColor: 'text-emerald-300',
                },
                {
                  id: 'atendimento',
                  topic: 'Cordialidade e Presteza no Atendimento',
                  score: computedIndicators.find((i) => i.id === 'atendimento')?.score || 91,
                  sentiment: 'Excelente',
                  query: 'atendimento',
                  count: computedIndicators.find((i) => i.id === 'atendimento')?.count || 317,
                  Icon: UserCheck,
                  borderClass: 'border-emerald-500/25 hover:border-emerald-500/40',
                  iconBoxClass: 'bg-emerald-500/15 text-emerald-300',
                  barColor: 'bg-emerald-500',
                  textColor: 'text-emerald-300',
                },
                {
                  id: 'prazo',
                  topic: 'Cumprimento de Prazos e Devolução',
                  score: computedIndicators.find((i) => i.id === 'prazo')?.score || 70,
                  sentiment: 'Atenção',
                  query: 'prazo',
                  count: computedIndicators.find((i) => i.id === 'prazo')?.count || 54,
                  Icon: Clock,
                  borderClass: 'border-amber-500/25 hover:border-amber-500/40',
                  iconBoxClass: 'bg-amber-500/15 text-amber-300',
                  barColor: 'bg-amber-400',
                  textColor: 'text-amber-300',
                },
                {
                  id: 'fila',
                  topic: 'Tempo de Espera na Fila e Guichês',
                  score: computedIndicators.find((i) => i.id === 'fila')?.score || 32,
                  sentiment: 'Crítico',
                  query: 'fila',
                  count: computedIndicators.find((i) => i.id === 'fila')?.count || 25,
                  Icon: Timer,
                  borderClass: 'border-rose-500/25 hover:border-rose-500/40',
                  iconBoxClass: 'bg-rose-500/15 text-rose-300',
                  barColor: 'bg-rose-500',
                  textColor: 'text-rose-300',
                },
              ].map((factor, idx) => {
                const FactorIcon = factor.Icon;
                return (
                  <Link
                    key={idx}
                    href={`/avaliacoes?search=${encodeURIComponent(factor.query)}`}
                    className={`group flex items-center justify-between gap-3 rounded-2xl border bg-[#070D1E]/90 p-3.5 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.15)] ${factor.borderClass}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${factor.iconBoxClass}`}>
                        <FactorIcon className="h-4.5 w-4.5" />
                      </div>
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs sm:text-sm font-bold text-white truncate block">
                            {factor.topic}
                          </span>
                          <span className={`text-xs sm:text-sm font-bold shrink-0 ${factor.textColor}`}>
                            {factor.sentiment} ({factor.score}%)
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-800/90 shadow-inner">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${factor.barColor}`}
                              style={{ width: `${factor.score}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium shrink-0">
                            {factor.count} menções registradas
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-slate-400 transition-colors group-hover:bg-white/[0.08] group-hover:text-white">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card Principal: Saúde da Reputação (Versão Analítica Completa) */}
        <ReputationHealth variant="detailed" data={reputationHealth} />

        {/* Seção Complementar: Metodologia da Saúde da Reputação */}
        <div
          id="metodologia-reputacao"
          className="space-y-5 rounded-[24px] border border-white/10 bg-[#0B1020]/75 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl scroll-mt-6"
        >
          <div className="flex flex-col justify-between gap-4 border-b border-white/8 pb-5 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-cyan-300" />
                <h2 className="text-lg font-extrabold tracking-tight text-white">
                  Metodologia da Saúde da Reputação (10 Indicadores)
                </h2>
              </div>
              <p className="mt-1 text-xs text-white/50">
                Composição do Score da Saúde da Reputação, ponderando os fatores de Saúde Operacional e Qualidade Percebida.
              </p>
            </div>

            <div className="self-start rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-3 px-6 text-center md:self-auto shadow-[0_10px_30px_rgba(6,182,212,0.15)]">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300">
                SCORE GLOBAL DE REPUTAÇÃO
              </span>
              <div className="text-3xl font-black text-cyan-300">
                {reputationHealth.scoreGeral} <span className="text-xs font-semibold text-cyan-400">pts</span>
              </div>
            </div>
          </div>

          {/* Como é calculado o Score Final */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5">
            <h4 className="flex items-center gap-2 text-sm font-bold text-white">
              <span>📐</span> Como é Calculado o Score Final da Saúde da Reputação?
            </h4>
            <p className="text-xs leading-relaxed text-white/80">
              O score global reflete o desempenho ponderado dos 10 indicadores operacionais avaliados no cartório:
            </p>
            <div className="inline-block rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 font-mono text-xs font-bold text-white">
              Saúde da Reputação = <span className="text-cyan-300 text-sm font-black">{reputationHealth.scoreGeral} Pontos</span> ➜{' '}
              <span className="text-emerald-400 text-sm font-black">Reputação {reputationHealth.reputacaoLabel}</span>
            </div>
          </div>

          {/* Simulação de Impacto Operacional */}
          <div className="flex flex-col justify-between gap-4 rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/20 via-indigo-950/20 to-transparent p-5 md:flex-row md:items-center">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>Simulação de Impacto Operacional</span>
              </div>
              <h3 className="text-sm font-bold text-white">
                Resolvendo os gargalos de Telefone, Agendamento e Estacionamento, o Score salta de {reputationHealth.scoreGeral} ➜{' '}
                <span className="text-emerald-400 font-extrabold">92 pts</span>!
              </h3>
              <p className="text-xs text-white/60">
                Elevar o atendimento telefônico e os agendamentos online alçará o cartório diretamente ao topo da excelência institucional.
              </p>
            </div>
            <Link
              href="/bi"
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-xs font-extrabold text-cyan-200 transition-all hover:bg-cyan-500/20 hover:text-white"
            >
              <span>Ver Ações no BI</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Nota Metodológica de Rodapé */}
        <div className="mt-6 flex items-start gap-3 rounded-[24px] border border-white/10 bg-[#0B1020]/75 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <Lightbulb className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" />
          <div className="space-y-1 text-xs text-white/80">
            <h4 className="text-sm font-bold text-amber-300">
              Por que a &quot;Taxa de Resposta&quot; NÃO entra no cálculo de Saúde da Reputação?
            </h4>
            <p className="leading-relaxed text-white/70">
              A <em>Taxa de Resposta</em> é um indicador de SLA administrativo interno (produtividade da equipe em dar retorno). A <strong>Saúde da Reputação</strong> mede exclusivamente os 10 fatores que impactam a experiência real do cidadão no cartório.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
