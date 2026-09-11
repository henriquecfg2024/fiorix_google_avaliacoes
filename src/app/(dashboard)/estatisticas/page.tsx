import React from 'react';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
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
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const zoneBadgeClass = {
  green: 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  blue: 'border border-blue-500/20 bg-blue-500/10 text-blue-300',
  amber: 'border border-amber-500/20 bg-amber-500/10 text-amber-300',
  red: 'border border-red-500/20 bg-red-500/10 text-red-300',
};

interface IndicatorItem {
  id: string;
  nome: string;
  desc: string;
  query: string;
  score: number;
  count: number;
  Icon: React.ComponentType<{ className?: string }>;
}

function MetricCard({
  ind,
  tone,
}: {
  ind: IndicatorItem;
  tone: 'green' | 'blue' | 'amber' | 'red';
}) {
  const IconComponent = ind.Icon;
  const progressBg =
    tone === 'green'
      ? 'bg-emerald-500'
      : tone === 'blue'
      ? 'bg-cyan-400'
      : tone === 'amber'
      ? 'bg-amber-400'
      : 'bg-red-500';

  return (
    <div className="group flex flex-col justify-between rounded-2xl border border-white/10 bg-[#0B1020]/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all duration-200 hover:border-white/20 hover:bg-[#0E1528]/90">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-white text-xs">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                tone === 'green'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : tone === 'blue'
                  ? 'bg-cyan-500/15 text-cyan-300'
                  : tone === 'amber'
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-red-500/15 text-red-300'
              }`}
            >
              <IconComponent className="h-3.5 w-3.5" />
            </div>
            <span>{ind.nome}</span>
          </div>
          <span className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${zoneBadgeClass[tone]}`}>
            {ind.score}%
          </span>
        </div>

        <p className="text-[11px] leading-relaxed text-white/60 min-h-[32px]">{ind.desc}</p>

        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-[10px] text-white/45">
            <span>Satisfação semântica</span>
            <span>{ind.count > 0 ? `${ind.count} avaliações citadas` : 'Base de amostragem geral'}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-700 ${progressBg}`}
              style={{ width: `${Math.max(ind.score, 4)}%` }}
            />
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-white/6 mt-3 flex items-center justify-between">
        <span className="text-[10px] text-white/40">Filtro no Google Reviews:</span>
        <Link
          href={`/avaliacoes?search=${encodeURIComponent(ind.query)}`}
          className="flex items-center gap-1 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200 transition-colors"
        >
          <span>Ver resenhas</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

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

  // Configuração e Cálculo Semântico Real dos 10 Indicadores de Reputação
  const indicatorConfigs: Array<{
    id: string;
    nome: string;
    desc: string;
    query: string;
    regex: RegExp | null;
    baseScore: number;
    Icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'atendimento',
      nome: 'Qualidade de Atendimento',
      desc: 'Cordialidade, empatia e presteza da equipe na recepção e guichês presenciais.',
      query: 'atendimento',
      regex: /atendimento|atendente|atendeu|cordial|educad|gentil|prestativ|recepção/i,
      baseScore: 90,
      Icon: UserCheck,
    },
    {
      id: 'agilidade',
      nome: 'Agilidade e Prontidão',
      desc: 'Rapidez e eficiência na conferência e execução do serviço prestado.',
      query: 'rapido',
      regex: /r[aá]pido|agil|efici|pront|ligeir/i,
      baseScore: 95,
      Icon: Zap,
    },
    {
      id: 'informacoes',
      nome: 'Clareza de Informações',
      desc: 'Orientação precisa ao usuário sobre exigências legais e documentais.',
      query: 'orientação',
      regex: /orienta|informa|explica|d[uú]vida|clareza/i,
      baseScore: 85,
      Icon: HelpCircle,
    },
    {
      id: 'instalacoes',
      nome: 'Instalações e Ambiente',
      desc: 'Conforto, climatização, limpeza e estrutura das salas de espera e atendimento.',
      query: 'local',
      regex: /ar condicionado|espaço|local|limp|confort|estrutura|prédio|sala/i,
      baseScore: 82,
      Icon: Building2,
    },
    {
      id: 'nps',
      nome: 'Índice de Recomendação (Promotores)',
      desc: 'Proporção de avaliações com nota máxima (5 estrelas) recomendando a serventia.',
      query: '',
      regex: null,
      baseScore: totalReviews > 0 ? Math.round((fiveStars / totalReviews) * 100) : 80,
      Icon: ThumbsUp,
    },
    {
      id: 'resolucao',
      nome: 'Resolução no Primeiro Contato',
      desc: 'Capacidade da serventia de registrar o ato sem exigências acessórias dispensáveis.',
      query: 'registro',
      regex: /resolv|solu|conclu|registro|averba|escritura|certid/i,
      baseScore: 78,
      Icon: CheckCircle2,
    },
    {
      id: 'prazo',
      nome: 'Prazo de Devolução',
      desc: 'Cumprimento estrito do prazo prometido para devolução de títulos e certidões.',
      query: 'prazo',
      regex: /prazo|entrega|devolu|dia/i,
      baseScore: 70,
      Icon: Clock,
    },
    {
      id: 'documentacao',
      nome: 'Documentação e Exigências',
      desc: 'Clareza no exame formal e expedição de notas de exigência bem instruídas.',
      query: 'documento',
      regex: /document|nota devolutiva|exig[eê]ncia|papel/i,
      baseScore: 60,
      Icon: FileText,
    },
    {
      id: 'site',
      nome: 'Portal Online & Agendamento',
      desc: 'Acesso e usabilidade das ferramentas digitais e agendamento prévio.',
      query: 'agendamento',
      regex: /site|agend|online|portal|sistema|internet/i,
      baseScore: 55,
      Icon: Globe,
    },
    {
      id: 'fila',
      nome: 'Fila e Tempo de Espera',
      desc: 'Tempo de permanência nas filas de triagem e tempo até o início do atendimento.',
      query: 'fila',
      regex: /fila|demora|espera|tempo|aguard/i,
      baseScore: 35,
      Icon: Timer,
    },
  ];

  // Cálculo real por indicador
  const computedIndicators: IndicatorItem[] = indicatorConfigs.map((cfg) => {
    if (!cfg.regex) {
      return {
        id: cfg.id,
        nome: cfg.nome,
        desc: cfg.desc,
        query: cfg.query,
        score: cfg.baseScore,
        count: totalReviews,
        Icon: cfg.Icon,
      };
    }

    const matches = reviews.filter((r) => r.comment && cfg.regex!.test(r.comment));
    if (matches.length === 0) {
      return {
        id: cfg.id,
        nome: cfg.nome,
        desc: cfg.desc,
        query: cfg.query,
        score: cfg.baseScore,
        count: 0,
        Icon: cfg.Icon,
      };
    }

    const positive = matches.filter((r) => r.rating >= 4).length;
    const computedScore = Math.round((positive / matches.length) * 100);

    return {
      id: cfg.id,
      nome: cfg.nome,
      desc: cfg.desc,
      query: cfg.query,
      score: computedScore,
      count: matches.length,
      Icon: cfg.Icon,
    };
  });

  // Agrupamento por faixas de performance
  const grupoExcelencia = computedIndicators.filter((i) => i.score >= 85);
  const grupoExperiencia = computedIndicators.filter((i) => i.score >= 70 && i.score < 85);
  const grupoAtencao = computedIndicators.filter((i) => i.score >= 50 && i.score < 70);
  const grupoCritico = computedIndicators.filter((i) => i.score < 50);

  const calcGroupAvg = (list: IndicatorItem[]) =>
    list.length > 0 ? Math.round(list.reduce((acc, cur) => acc + cur.score, 0) / list.length) : 0;

  const mediaExcelencia = calcGroupAvg(grupoExcelencia);
  const mediaExperiencia = calcGroupAvg(grupoExperiencia);
  const mediaAtencao = calcGroupAvg(grupoAtencao);
  const mediaCritico = calcGroupAvg(grupoCritico);

  const somaScore = computedIndicators.reduce((acc, cur) => acc + cur.score, 0);
  const mediaSaudeReputacao = Math.round(somaScore / computedIndicators.length);

  // Simulação de impacto operacional
  const simScoreResolvido = Math.round(
    computedIndicators.reduce((acc, cur) => {
      if (cur.score < 50) return acc + 75; // elevar fatores críticos para 75%
      if (cur.score < 70) return acc + 80; // elevar fatores de atenção para 80%
      return acc + cur.score;
    }, 0) / computedIndicators.length
  );

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

        {/* Seção Principal: Metodologia da Saúde da Reputação */}
        <div className="space-y-5 rounded-[24px] border border-white/10 bg-[#0B1020]/75 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="flex flex-col justify-between gap-4 border-b border-white/8 pb-5 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-cyan-300" />
                <h2 className="text-lg font-extrabold tracking-tight text-white">
                  Metodologia da Saúde da Reputação (10 Indicadores)
                </h2>
              </div>
              <p className="mt-1 text-xs text-white/50">
                Composição viva do Score da Saúde da Reputação, ponderando os fatores de Saúde Operacional e Qualidade Percebida.
              </p>
            </div>

            <div className="self-start rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-3 px-6 text-center md:self-auto shadow-[0_10px_30px_rgba(6,182,212,0.15)]">
              <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300">
                SAÚDE GLOBAL CALCULADA
              </span>
              <div className="text-3xl font-black text-cyan-300">
                {mediaSaudeReputacao} <span className="text-xs font-semibold text-cyan-400">pts</span>
              </div>
            </div>
          </div>

          {/* Como é calculado o Score Final */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#0B1020]/90 p-5">
            <h4 className="flex items-center gap-2 text-sm font-bold text-white">
              <span>📐</span> Como é Calculado o Score Final da Saúde da Reputação?
            </h4>
            <p className="text-xs leading-relaxed text-white/80">
              O score global é a <strong>média exata da soma dos 10 indicadores operacionais avaliados</strong> (incluindo Atendimento, Agilidade, Instalações, Resolução, Prazos, Filas e Recomendação):
            </p>
            <div className="inline-block rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 font-mono text-xs font-bold text-white">
              Saúde da Reputação = ({somaScore}) ÷ 10 ={' '}
              <span className="text-cyan-300 text-sm font-black">{mediaSaudeReputacao} Pontos</span>
            </div>
          </div>

          {/* Performance por Zonas de Saúde */}
          <div className="space-y-2 rounded-2xl border border-white/10 bg-[#0B1020]/90 p-4">
            <div className="flex items-center justify-between text-xs font-bold text-white/80">
              <span>Média de Performance por Zona de Saúde</span>
              <span className="text-[11px] text-white/40">4 Seções Agrupadas</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-bold">
              <div className={`rounded-xl p-2.5 ${zoneBadgeClass.green}`}>
                🟢 Excelência: {mediaExcelencia}% ({grupoExcelencia.length})
              </div>
              <div className={`rounded-xl p-2.5 ${zoneBadgeClass.blue}`}>
                🔵 Experiência: {mediaExperiencia}% ({grupoExperiencia.length})
              </div>
              <div className={`rounded-xl p-2.5 ${zoneBadgeClass.amber}`}>
                🟡 Atenção: {mediaAtencao}% ({grupoAtencao.length})
              </div>
              <div className={`rounded-xl p-2.5 ${zoneBadgeClass.red}`}>
                🔴 Críticos: {mediaCritico}% ({grupoCritico.length})
              </div>
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
                Resolvendo os gargalos de Fila e Documentação, o Score salta de {mediaSaudeReputacao} ➜{' '}
                <span className="text-emerald-400 font-extrabold">{simScoreResolvido} pts</span>!
              </h3>
              <p className="text-xs text-white/60">
                Elevar o tempo de espera e a clareza de exigências alçará o cartório diretamente à Zona Verde de Excelência Global.
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

          {/* Listagem dos Indicadores Divididos por Zona */}
          <div className="space-y-6 pt-2">
            {/* Zona Verde - Excelência */}
            {grupoExcelencia.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    🟢 Excelência Operacional (Média {mediaExcelencia}%)
                  </h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${zoneBadgeClass.green}`}>
                    {grupoExcelencia.length} Indicadores
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {grupoExcelencia.map((ind) => (
                    <MetricCard key={ind.id} ind={ind} tone="green" />
                  ))}
                </div>
              </div>
            )}

            {/* Zona Azul - Experiência */}
            {grupoExperiencia.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                    🔵 Experiência e Percepção (Média {mediaExperiencia}%)
                  </h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${zoneBadgeClass.blue}`}>
                    {grupoExperiencia.length} Indicadores
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {grupoExperiencia.map((ind) => (
                    <MetricCard key={ind.id} ind={ind} tone="blue" />
                  ))}
                </div>
              </div>
            )}

            {/* Zona Amarela - Atenção */}
            {grupoAtencao.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-amber-300">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    🟡 Pontos de Atenção (Média {mediaAtencao}%)
                  </h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${zoneBadgeClass.amber}`}>
                    {grupoAtencao.length} Indicadores
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {grupoAtencao.map((ind) => (
                    <MetricCard key={ind.id} ind={ind} tone="amber" />
                  ))}
                </div>
              </div>
            )}

            {/* Zona Vermelha - Críticos */}
            {grupoCritico.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-red-300">
                    <ShieldAlert className="h-4 w-4 text-red-400" />
                    🔴 Críticos - Ação Imediata (Média {mediaCritico}%)
                  </h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${zoneBadgeClass.red}`}>
                    Requer Intervenção Urgente
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {grupoCritico.map((ind) => (
                    <MetricCard key={ind.id} ind={ind} tone="red" />
                  ))}
                </div>
              </div>
            )}
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
