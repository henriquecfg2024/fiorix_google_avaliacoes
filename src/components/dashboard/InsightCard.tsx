import React from 'react';
import { Bot, AlertTriangle, Sparkles, Calendar, ThumbsUp, Zap } from 'lucide-react';

interface InsightsData {
  topComplaint: { keyword: string; count: number; total: number } | null;
  topColab: { nome: string; elogios: number } | null;
  worstDay: { day: string; diff: number } | null;
  taxaResposta: number;
  respondidas: number;
  totalActive: number;
}

interface InsightCardProps {
  insights?: InsightsData;
}

export function InsightCard({ insights }: InsightCardProps) {
  // Demo fallback
  if (!insights) {
    return (
      <div className="space-y-4 rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="flex items-center gap-2 text-cyan-300">
          <Bot className="h-5 w-5 text-cyan-300" />
          <h3 className="text-card-title font-bold">Insights da IA</h3>
          <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200">DEMO</span>
        </div>
        <div className="flex items-start gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-body-reading text-slate-400">
            Conecte o Google Meu Negócio para gerar insights baseados em dados reais.
          </p>
        </div>
      </div>
    );
  }

  const hasInsights = insights.topComplaint || insights.topColab || insights.worstDay || insights.taxaResposta > 0;

  return (
    <div className="space-y-4 rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex items-center gap-2 text-cyan-300">
        <Bot className="h-5 w-5 text-cyan-300" />
        <h3 className="text-card-title font-bold">Insights da IA</h3>
      </div>

      {!hasInsights && (
        <div className="flex items-start gap-2.5 rounded-lg border border-white/8 bg-white/[0.02] p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p className="text-body-reading text-slate-400">
            Ainda não há dados suficientes para gerar insights. Continue coletando avaliações.
          </p>
        </div>
      )}

      {insights.topComplaint && (
        <div className="space-y-1 rounded-xl border border-amber-500/14 bg-amber-500/[0.035] p-3.5 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 text-indicator-label font-bold text-amber-100">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
            <span>Alerta de Reclamações</span>
          </div>
          <p className="text-body-reading text-[#E5E7EB]">
            A palavra <strong className="font-extrabold text-amber-300">&quot;{insights.topComplaint.keyword}&quot;</strong> aparece em{' '}
            <strong className="font-extrabold text-rose-300">{insights.topComplaint.count} de {insights.topComplaint.total}</strong> avaliações negativas (≤2★).
          </p>
        </div>
      )}

      <div className="space-y-2">
        {insights.topColab && (
          <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/12 bg-emerald-500/[0.03] p-2.5">
            <ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            <p className="text-body-reading text-[#E5E7EB]">
              <strong className="text-slate-100">Destaque:</strong> <strong>{insights.topColab.nome}</strong> foi elogiado(a) em{' '}
              <strong className="font-bold text-emerald-300">{insights.topColab.elogios} avaliações positivas</strong>.
            </p>
          </div>
        )}

        {insights.worstDay && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/12 bg-amber-500/[0.03] p-2.5">
            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <p className="text-body-reading text-[#E5E7EB]">
              <strong className="text-slate-100">Padrão {insights.worstDay.day}:</strong> Notas dadas às{' '}
              <strong>{insights.worstDay.day.toLowerCase()}</strong> são em média{' '}
              <strong className="font-bold text-amber-300">{insights.worstDay.diff}★ menores</strong> que a média geral.
            </p>
          </div>
        )}

        {insights.taxaResposta > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-cyan-500/12 bg-cyan-500/[0.03] p-2.5">
            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <p className="text-body-reading text-[#E5E7EB]">
              <strong className="text-slate-100">Taxa de Resposta:</strong> {insights.respondidas} de {insights.totalActive} avaliações respondidas{' '}
              (<strong className="font-bold text-cyan-300">{insights.taxaResposta}%</strong>).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
