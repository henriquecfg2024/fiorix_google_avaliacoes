import React from 'react';
import { Bot, AlertTriangle, Sparkles, Calendar, ThumbsUp, Zap } from 'lucide-react';

export function InsightCard() {
  return (
    <div className="space-y-4 rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex items-center gap-2 text-cyan-300">
        <Bot className="h-5 w-5 text-cyan-300" />
        <h3 className="text-xs font-bold uppercase tracking-[0.22em]">INSIGHTS DA IA</h3>
      </div>

      <div className="space-y-1 rounded-xl border border-amber-500/14 bg-amber-500/[0.035] p-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-300" />
          <span>Alerta de Atendimento</span>
        </div>
        <p className="text-xs leading-relaxed text-slate-300">
          Reclamações sobre tempo de espera na fila subiram{' '}
          <strong className="font-extrabold text-rose-300">+40%</strong> este mês. Recomendamos otimizar a triagem
          inicial na recepção.
        </p>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/12 bg-emerald-500/[0.03] p-2.5">
          <ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
          <p className="text-slate-300">
            <strong className="text-slate-100">Elogio Lucas:</strong> O escrevente <strong>Lucas</strong> foi citado com
            elogios em <strong className="font-bold text-emerald-300">47 avaliações positivas</strong> este mês.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/12 bg-amber-500/[0.03] p-2.5">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p className="text-slate-300">
            <strong className="text-slate-100">Padrão Segunda:</strong> Notas dadas às <strong>segundas-feiras</strong>{' '}
            são em média <strong className="font-bold text-amber-300">-0,4★ menores</strong> que nos outros dias.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-rose-500/12 bg-rose-500/[0.03] p-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
          <p className="text-slate-300">
            <strong className="text-slate-100">Motivo Agendamento:</strong> Agendamento online foi a causa apontada em{' '}
            <strong className="font-bold text-rose-300">70% das 3★</strong>.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-cyan-500/12 bg-cyan-500/[0.03] p-2.5">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
          <p className="text-slate-300">
            <strong className="text-slate-100">Impacto SLA:</strong> Respostas enviadas em &lt;24h elevam a satisfação em{' '}
            <strong className="font-bold text-cyan-300">+35%</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
