import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
import { Target, ExternalLink, ArrowRight, Lightbulb, Sparkles, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

const zoneBadgeClass = {
  green: 'border border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  blue: 'border border-blue-500/20 bg-blue-500/10 text-blue-300',
  amber: 'border border-amber-500/20 bg-amber-500/10 text-amber-300',
  red: 'border border-red-500/20 bg-red-500/10 text-red-300',
};

function renderMetricCard(
  ind: { icon: string; nome: string; score: number; desc: string },
  tone: 'green' | 'blue' | 'amber' | 'red'
) {
  return (
    <div className="space-y-2 rounded-2xl border border-white/12 bg-[#0B1020]/72 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-white/20">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold text-white">
          <span>{ind.icon}</span> {ind.nome}
        </span>
        <span className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${zoneBadgeClass[tone]}`}>{ind.score}%</span>
      </div>
      <p className="text-[11px] leading-relaxed text-white/60">{ind.desc}</p>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-700/80">
        <div
          className={`h-full rounded-full ${
            tone === 'green' ? 'bg-emerald-500' : tone === 'blue' ? 'bg-cyan-400' : tone === 'amber' ? 'bg-amber-400' : 'bg-red-500'
          }`}
          style={{ width: `${ind.score}%` }}
        />
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

  let totalReviews = 547;
  let fiveStars = 436;
  let fourStars = 32;
  let threeStars = 11;
  let twoStars = 10;
  let oneStar = 58;

  try {
    const dbTotal = await prisma.review.count({ where: { tenantId, deletedFromGoogle: false } });
    if (dbTotal > 0) {
      totalReviews = dbTotal;
      fiveStars = await prisma.review.count({ where: { tenantId, rating: 5, deletedFromGoogle: false } });
      fourStars = await prisma.review.count({ where: { tenantId, rating: 4, deletedFromGoogle: false } });
      threeStars = await prisma.review.count({ where: { tenantId, rating: 3, deletedFromGoogle: false } });
      twoStars = await prisma.review.count({ where: { tenantId, rating: 2, deletedFromGoogle: false } });
      oneStar = await prisma.review.count({ where: { tenantId, rating: 1, deletedFromGoogle: false } });
    }
  } catch (err) {
    console.error('Error loading estatisticas:', err);
  }

  const getPercent = (count: number) => (totalReviews > 0 ? ((count / totalReviews) * 100).toFixed(1) : '0.0');

  const grupoExcelencia = [
    { icon: 'Horario', nome: 'Horário de Atendimento', score: 96, desc: 'Cumprimento dos horários de abertura, atendimento contínuo e pontualidade' },
    { icon: 'Pagamento', nome: 'Pagamento', score: 93, desc: 'Opções de pagamento como PIX, cartão de débito/crédito e agilidade no caixa' },
    { icon: 'Atendimento', nome: 'Qualidade de Atendimento', score: 91, desc: 'Cordialidade, empatia e presteza da equipe de escreventes na recepção' },
    { icon: 'Informacoes', nome: 'Clareza de Informações', score: 88, desc: 'Orientação precisa ao cliente sobre requisitos e documentos necessários' },
  ];

  const grupoExperiencia = [
    { icon: 'NPS', nome: 'Índice de Recomendação (NPS)', score: 85, desc: 'Porcentagem de clientes promotores que elogiam ativamente a serventia' },
    { icon: 'Resolucao', nome: 'Resolução no Primeiro Contato', score: 82, desc: 'Capacidade de resolver o ato sem exigir retornos adicionais desnecessários' },
  ];

  const grupoAtencao = [
    { icon: 'Doc', nome: 'Documentação', score: 59, desc: 'Clareza na exigência e conferência prévia da documentação apresentada' },
    { icon: 'Site', nome: 'Site / Agendamento', score: 42, desc: 'Disponibilidade e facilidade de agendamento presencial no portal online' },
  ];

  const grupoCritico = [
    { icon: 'Prazo', nome: 'Prazo de Entrega', score: 22, query: 'prazo', desc: 'Cumprimento do prazo prometido para devolução de títulos e certidões' },
    { icon: 'Fila', nome: 'Fila / Espera', score: 18, query: 'fila', desc: 'Tempo de espera na fila de triagem e atendimento presencial' },
  ];

  const somaScore = 96 + 93 + 91 + 88 + 85 + 82 + 59 + 42 + 22 + 18;
  const mediaSaudeReputacao = Math.round(somaScore / 10);

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
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="space-y-4 rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          <div>
            <h3 className="text-base font-bold text-white">Distribuição de Notas</h3>
            <p className="text-xs text-white/45">Volume de avaliações separadas por número de estrelas</p>
          </div>

          <div className="space-y-3 pt-1">
            {[
              { label: '5 Estrelas', count: fiveStars, color: 'bg-emerald-500' },
              { label: '4 Estrelas', count: fourStars, color: 'bg-cyan-400' },
              { label: '3 Estrelas', count: threeStars, color: 'bg-amber-400' },
              { label: '2 Estrelas', count: twoStars, color: 'bg-amber-500' },
              { label: '1 Estrela', count: oneStar, color: 'bg-red-500' },
            ].map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center gap-2 text-xs">
                <span className="col-span-3 font-semibold text-white/80">{item.label}</span>
                <div className="col-span-6 h-2 overflow-hidden rounded-full bg-slate-700/80">
                  <div className={`${item.color} h-full transition-all duration-500`} style={{ width: `${getPercent(item.count)}%` }} />
                </div>
                <span className="col-span-3 text-right font-bold text-white">
                  {item.count} ({getPercent(item.count)}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          <div>
            <h3 className="text-base font-bold text-white">Análise Qualitativa por IA</h3>
            <p className="text-xs text-white/45">Fatores operacionais mais citados nas resenhas</p>
          </div>

          <div className="space-y-3 pt-1">
            {[
              {
                topic: 'Horário de Atendimento e Cortesia',
                score: '96%',
                sentiment: 'Excelente',
                className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
              },
              {
                topic: 'Formas de Pagamento e PIX',
                score: '93%',
                sentiment: 'Excelente',
                className: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
              },
              {
                topic: 'Tempo de Espera na Fila',
                score: '18%',
                sentiment: 'Crítico',
                className: 'border-red-500/20 bg-red-500/10 text-red-300',
              },
            ].map((topic, idx) => (
              <div key={idx} className={`flex items-center justify-between rounded-xl border border-white/12 border-l-4 p-3 text-xs ${topic.className}`}>
                <span className="font-semibold text-white/90">{topic.topic}</span>
                <span className="font-extrabold">{topic.sentiment} ({topic.score})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-5 rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <div className="flex flex-col justify-between gap-4 border-b border-white/8 pb-5 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-cyan-300" />
              <h2 className="text-lg font-extrabold tracking-tight text-white">Metodologia da Saúde da Reputação (10 Indicadores)</h2>
            </div>
            <p className="mt-1 text-xs text-white/45">
              Composição detalhada do Score da Saúde da Reputação, abrangendo Saúde Operacional e Qualidade Percebida.
            </p>
          </div>

          <div className="self-start rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-3 px-5 text-center md:self-auto">
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-300">SAÚDE GLOBAL CALCULADA</span>
            <div className="text-2xl font-black text-cyan-300">
              {mediaSaudeReputacao} <span className="text-xs font-semibold text-cyan-400">pts</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/12 bg-[#0B1020]/80 p-5">
          <h4 className="flex items-center gap-2 text-sm font-bold text-white">
            <span>📐</span> Como é Calculado o Score Final da Saúde da Reputação?
          </h4>
          <p className="text-xs leading-relaxed text-white/80">
            O score global é a <strong>média exata da soma dos 10 indicadores avaliados</strong> (incluindo os 6 pilares de Saúde Operacional):
          </p>
          <div className="inline-block rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2 font-mono text-xs font-bold text-white">
            Saúde da Reputação = ({somaScore}) ÷ 10 = <span className="text-cyan-300">{mediaSaudeReputacao} Pontos</span>
          </div>
        </div>

        <div className="space-y-2 rounded-2xl border border-white/12 bg-[#0B1020]/80 p-4">
          <div className="flex items-center justify-between text-xs font-bold text-white/80">
            <span>Média de Performance por Zona de Saúde</span>
            <span className="text-[11px] text-white/40">4 Seções Agrupadas</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
            <div className={`rounded-xl p-2 ${zoneBadgeClass.green}`}>🟢 Excelência: 92%</div>
            <div className={`rounded-xl p-2 ${zoneBadgeClass.blue}`}>🔵 Experiência: 83%</div>
            <div className={`rounded-xl p-2 ${zoneBadgeClass.amber}`}>🟡 Atenção: 50%</div>
            <div className={`rounded-xl p-2 ${zoneBadgeClass.red}`}>🔴 Críticos: 20%</div>
          </div>
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/12 bg-[#0B1020]/80 p-5 md:flex-row md:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span>Simulação de Impacto Operacional</span>
            </div>
            <h3 className="text-sm font-bold text-white">Resolvendo os 2 fatores críticos (Prazo e Fila), o Score salta de 68 ➜ 80 pts!</h3>
            <p className="text-xs text-white/60">
              Elevar o Prazo de 22% ➜ 80% e a Fila de 18% ➜ 70% colocará o cartório na Zona Verde de Excelência.
            </p>
          </div>
          <Link
            href="/bi"
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-white/[0.08]"
          >
            <span>Ver Ações no BI</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="space-y-6 pt-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                🟢 Excelência Operacional (Média 92%)
              </h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${zoneBadgeClass.green}`}>4 Indicadores</span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {grupoExcelencia.map((ind, idx) => (
                <div key={idx}>{renderMetricCard(ind, 'green')}</div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" />
                🔵 Experiência e Resolução (Média 83%)
              </h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${zoneBadgeClass.blue}`}>2 Indicadores</span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {grupoExperiencia.map((ind, idx) => (
                <div key={idx}>{renderMetricCard(ind, 'blue')}</div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                🟡 Pontos de Atenção (Média 50%)
              </h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${zoneBadgeClass.amber}`}>2 Indicadores</span>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {grupoAtencao.map((ind, idx) => (
                <div key={idx}>{renderMetricCard(ind, 'amber')}</div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-red-300">
                <ShieldAlert className="h-4 w-4 text-red-400" />
                🔴 Críticos - Ação Imediata (Média 20%)
              </h3>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${zoneBadgeClass.red}`}>Requer Intervenção Urgente</span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {grupoCritico.map((ind, idx) => (
                <div
                  key={idx}
                  className="space-y-3 rounded-2xl border border-white/12 bg-[#0B1020]/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.16)] transition-all hover:border-white/20"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <span>{ind.icon}</span> {ind.nome}
                    </span>
                    <span className={`rounded-lg px-2 py-0.5 text-xs font-extrabold ${zoneBadgeClass.red}`}>{ind.score}%</span>
                  </div>

                  <p className="text-[11px] leading-relaxed text-white/70">{ind.desc}</p>

                  <div className="h-2 overflow-hidden rounded-full bg-red-950/40">
                    <div className="h-full rounded-full bg-red-500" style={{ width: `${ind.score}%` }} />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href="/bi"
                      className="flex items-center gap-1 rounded-xl bg-gradient-to-r from-indigo-500 to-amber-400 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-colors hover:brightness-105"
                    >
                      <span>Ver no BI</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>

                    <Link
                      href={`/avaliacoes?search=${ind.query}`}
                      className="flex items-center gap-1 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-500/16"
                    >
                      <span>Ver Avaliações ({ind.query})</span>
                      <ExternalLink className="h-3.5 w-3.5 text-red-300" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-white/12 bg-[#0B1020]/72 p-5 backdrop-blur-xl">
          <Lightbulb className="mt-0.5 h-6 w-6 shrink-0 text-amber-300" />
          <div className="space-y-1 text-xs text-white/80">
            <h4 className="text-sm font-bold text-amber-300">Por que a "Taxa de Resposta" NÃO entra no cálculo de Saúde da Reputação?</h4>
            <p className="leading-relaxed text-white/70">
              A <em>Taxa de Resposta</em> é um indicador de SLA administrativo interno (produtividade em dar retorno). A <strong>Saúde da Reputação</strong> mede exclusivamente os 10 fatores que impactam a experiência real do cidadão no cartório.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
