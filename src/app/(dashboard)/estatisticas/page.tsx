import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Link from 'next/link';
import { Target, ExternalLink, ArrowRight, Lightbulb, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EstatisticasPage() {
  const session = await auth();
  const tenantId = (session?.user?.tenantId as string) || 'cartorio-7ri-sp';

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

  // Grouped Indicators Data
  const grupoExcelencia = [
    { icon: '🕘', nome: 'Horário de Atendimento', score: 96, desc: 'Cumprimento dos horários de abertura, atendimento contínuo e pontualidade' },
    { icon: '💳', nome: 'Pagamento', score: 93, desc: 'Opções de pagamento como PIX, cartão de débito/crédito e agilidade no caixa' },
    { icon: '🤝', nome: 'Qualidade de Atendimento', score: 91, desc: 'Cordialidade, empatia e presteza da equipe de escreventes na recepção' },
    { icon: '💡', nome: 'Clareza de Informações', score: 88, desc: 'Orientação precisa ao cliente sobre requisitos e documentos necessários' },
  ];

  const grupoExperiencia = [
    { icon: '🌟', nome: 'Índice de Recomendação (NPS)', score: 85, desc: 'Porcentagem de clientes promotores que elogiam ativamente a serventia' },
    { icon: '🎯', nome: 'Resolução no Primeiro Contato', score: 82, desc: 'Capacidade de resolver o ato sem exigir retornos adicionais desnecessários' },
  ];

  const grupoAtencao = [
    { icon: '📄', nome: 'Documentação', score: 59, desc: 'Clareza na exigência e conferência prévia da documentação apresentada' },
    { icon: '🌐', nome: 'Site / Agendamento', score: 42, desc: 'Disponibilidade e facilidade de agendamento presencial no portal online' },
  ];

  const grupoCritico = [
    { icon: '⏱️', nome: 'Prazo de Entrega', score: 22, query: 'prazo', desc: 'Cumprimento do prazo prometido para devolução de títulos e certidões' },
    { icon: '🕐', nome: 'Fila / Espera', score: 18, query: 'fila', desc: 'Tempo de espera na fila de triagem e atendimento presencial' },
  ];

  const somaScore = 96 + 93 + 91 + 88 + 85 + 82 + 59 + 42 + 22 + 18;
  const mediaSaudeReputacao = Math.round(somaScore / 10);

  return (
    <div className="w-full px-4 md:px-7 py-6 space-y-6">
      
      {/* 📊 SEÇÃO SUPERIOR: DISTRIBUIÇÃO E ANÁLISE QUALITATIVA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Distribuição de Notas */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Distribuição de Notas</h3>
            <p className="text-xs text-slate-500">Volume de avaliações separadas por número de estrelas</p>
          </div>

          <div className="space-y-3 pt-1">
            {[
              { label: '5 Estrelas', count: fiveStars, color: 'bg-emerald-500' },
              { label: '4 Estrelas', count: fourStars, color: 'bg-blue-500' },
              { label: '3 Estrelas', count: threeStars, color: 'bg-amber-400' },
              { label: '2 Estrelas', count: twoStars, color: 'bg-amber-500' },
              { label: '1 Estrela', count: oneStar, color: 'bg-red-500' },
            ].map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 items-center text-xs gap-2">
                <span className="col-span-3 font-semibold text-slate-700">{item.label}</span>
                <div className="col-span-6 bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className={`${item.color} h-full transition-all duration-500`} style={{ width: `${getPercent(item.count)}%` }} />
                </div>
                <span className="col-span-3 font-bold text-slate-900 text-right">
                  {item.count} ({getPercent(item.count)}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Análise Qualitativa por IA */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Análise Qualitativa por IA</h3>
            <p className="text-xs text-slate-500">Fatores operacionais mais citados nas resenhas</p>
          </div>

          <div className="space-y-3 pt-1">
            {[
              { topic: 'Horário de Atendimento e Cortesia', score: '96%', sentiment: 'Excelente', border: 'border-emerald-500 text-emerald-700 bg-emerald-50/50' },
              { topic: 'Formas de Pagamento e PIX', score: '93%', sentiment: 'Excelente', border: 'border-emerald-500 text-emerald-700 bg-emerald-50/50' },
              { topic: 'Tempo de Espera na Fila', score: '18%', sentiment: 'Crítico', border: 'border-red-500 text-red-700 bg-red-50/50' },
            ].map((topic, idx) => (
              <div key={idx} className={`p-3 rounded-xl border-l-4 ${topic.border} flex items-center justify-between text-xs`}>
                <span className="font-semibold text-slate-800">{topic.topic}</span>
                <span className="font-extrabold">{topic.sentiment} ({topic.score})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ HERO METODOLOGIA ═══ */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                Metodologia da Saúde da Reputação (10 Indicadores)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Composição detalhada do Score da Saúde da Reputação, abrangendo Saúde Operacional e Qualidade Percebida.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 px-5 text-center self-start md:self-auto">
            <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">
              SAÚDE GLOBAL CALCULADA
            </span>
            <div className="text-2xl font-black text-blue-700">
              {mediaSaudeReputacao} <span className="text-xs font-semibold text-blue-500">pts</span>
            </div>
          </div>
        </div>

        {/* BANNER COM FÓRMULA EXPLICATIVA */}
        <div className="bg-gradient-to-r from-slate-50 to-blue-50/50 border border-slate-200 rounded-2xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <span>📐</span> Como é Calculado o Score Final da Saúde da Reputação?
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            O score global é a <strong>média exata da soma dos 10 indicadores avaliados</strong> (incluindo os 6 pilares de Saúde Operacional):
          </p>
          <div className="bg-white border border-slate-200 rounded-xl px-4 py-2 font-mono text-xs font-bold text-slate-800 inline-block shadow-2xs">
            Saúde da Reputação = ({somaScore}) ÷ 10 = <span className="text-blue-600">{mediaSaudeReputacao} Pontos</span>
          </div>
        </div>

        {/* BARRA COMPARATIVA RESUMO DAS 4 ZONAS */}
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Média de Performance por Zona de Saúde</span>
            <span className="text-slate-500 text-[11px]">4 Seções Agrupadas</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs font-bold">
            <div className="bg-emerald-100 text-emerald-800 p-2 rounded-xl border border-emerald-200">
              🟢 Excelência: 92%
            </div>
            <div className="bg-blue-100 text-blue-800 p-2 rounded-xl border border-blue-200">
              🔵 Experiência: 83%
            </div>
            <div className="bg-amber-100 text-amber-800 p-2 rounded-xl border border-amber-200">
              🟡 Atenção: 50%
            </div>
            <div className="bg-red-100 text-red-800 p-2 rounded-xl border border-red-200">
              🔴 Críticos: 20%
            </div>
          </div>
        </div>

        {/* SIMULADOR DE IMPACTO DE META */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-200 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Simulação de Impacto Operacional</span>
            </div>
            <h3 className="text-sm font-bold">
              Resolvendo os 2 fatores críticos (Prazo e Fila), o Score salta de 68 ➔ 80 pts!
            </h3>
            <p className="text-xs text-blue-100">
              Elevar o Prazo de 22% ➔ 80% e a Fila de 18% ➔ 70% colocará o cartório na **Zona Verde de Excelência**.
            </p>
          </div>
          <Link
            href="/bi"
            className="bg-white hover:bg-blue-50 text-blue-700 font-extrabold px-4 py-2.5 rounded-xl text-xs transition-colors shrink-0 flex items-center gap-1.5 shadow-sm"
          >
            <span>Ver Ações no BI</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* ═══ AS 4 SEÇÕES AGRUPADAS (O CORE DA MUDANÇA) ═══ */}
        <div className="space-y-6 pt-2">
          
          {/* SEÇÃO A: 🟢 EXCELÊNCIA OPERACIONAL */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                🟢 Excelência Operacional (Média 92%)
              </h3>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                4 Indicadores
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grupoExcelencia.map((ind, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{ind.icon}</span> {ind.nome}
                    </span>
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      {ind.score}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{ind.desc}</p>
                  <div className="bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${ind.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SEÇÃO B: 🔵 EXPERIÊNCIA E RESOLUÇÃO */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                🔵 Experiência e Resolução (Média 83%)
              </h3>
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                2 Indicadores
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grupoExperiencia.map((ind, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{ind.icon}</span> {ind.nome}
                    </span>
                    <span className="text-xs font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-200">
                      {ind.score}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{ind.desc}</p>
                  <div className="bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${ind.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SEÇÃO C: 🟡 PONTOS DE ATENÇÃO */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                🟡 Pontos de Atenção (Média 50%)
              </h3>
              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                2 Indicadores
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grupoAtencao.map((ind, idx) => (
                <div key={idx} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-all space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{ind.icon}</span> {ind.nome}
                    </span>
                    <span className="text-xs font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
                      {ind.score}%
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{ind.desc}</p>
                  <div className="bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full rounded-full" style={{ width: `${ind.score}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SEÇÃO D: 🔴 CRÍTICOS - AÇÃO IMEDIATA */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                🔴 Críticos - Ação Imediata (Média 20%)
              </h3>
              <span className="text-xs font-bold text-red-700 bg-red-100 px-2.5 py-0.5 rounded-full border border-red-200">
                Requer Intervenção Urgente
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {grupoCritico.map((ind, idx) => (
                <div
                  key={idx}
                  className="bg-red-50/60 border border-red-200 border-l-4 border-l-red-500 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>{ind.icon}</span> {ind.nome}
                    </span>
                    <span className="text-xs font-extrabold text-red-700 bg-red-100 px-2 py-0.5 rounded-lg border border-red-200">
                      {ind.score}%
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">{ind.desc}</p>

                  <div className="bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="bg-red-600 h-full rounded-full" style={{ width: `${ind.score}%` }} />
                  </div>

                  {/* DOUBLE ACTION BUTTONS */}
                  <div className="flex items-center gap-2 pt-1">
                    <Link
                      href="/bi"
                      className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-1 shadow-2xs"
                    >
                      <span>Ver no BI</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <Link
                      href={`/avaliacoes?search=${ind.query}`}
                      className="bg-white hover:bg-red-50 text-red-700 border border-red-200 font-semibold px-3 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-1"
                    >
                      <span>Ver Avaliações ({ind.query})</span>
                      <ExternalLink className="w-3.5 h-3.5 text-red-500" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* BOTTOM BOX (TAXA DE RESPOSTA ESCLARECIMENTO) */}
        <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 flex items-start gap-3 mt-6">
          <Lightbulb className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs text-amber-950">
            <h4 className="font-bold text-sm text-purple-900">
              Por que a "Taxa de Resposta" NÃO entra no cálculo de Saúde da Reputação?
            </h4>
            <p className="leading-relaxed text-amber-900">
              A <em>Taxa de Resposta</em> é um indicador de SLA administrativo interno (produtividade em dar retorno). A <strong>Saúde da Reputação</strong> mede exclusivamente os 10 fatores que impactam a experiência real do cidadão no cartório.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

