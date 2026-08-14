import React from 'react';
import { Bot, AlertTriangle, Sparkles, Calendar, ThumbsUp, Zap } from 'lucide-react';

export function InsightCard() {
  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(30,41,59,0.98),rgba(15,23,42,0.98))] p-5 shadow-[0_18px_45px_rgba(2,6,23,0.35)]">
      <div className="flex items-center gap-2 text-violet-300">
        <Bot className="h-5 w-5 text-violet-400" />
        <h3 className="text-xs font-bold uppercase tracking-[0.22em]">INSIGHTS DA IA</h3>
      </div>

      <div className="space-y-1 rounded-xl border border-amber-500/20 bg-amber-500/8 p-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-100">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <span>Alerta de Atendimento</span>
        </div>
        <p className="text-xs leading-relaxed text-slate-300">
          Reclamações sobre tempo de espera na fila subiram{' '}
          <strong className="font-extrabold text-red-400">+40%</strong> este mês. Recomendamos otimizar a triagem
          inicial na recepção.
        </p>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/15 bg-emerald-500/6 p-2.5">
          <ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p className="text-slate-300">
            <strong className="text-slate-100">Elogio Lucas:</strong> O escrevente <strong>Lucas</strong> foi citado com
            elogios em <strong className="font-bold text-emerald-300">47 avaliações positivas</strong> este mês.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/15 bg-amber-500/6 p-2.5">
          <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-slate-300">
            <strong className="text-slate-100">Padrão Segunda:</strong> Notas dadas às <strong>segundas-feiras</strong>{' '}
            são em média <strong className="font-bold text-amber-300">-0,4★ menores</strong> que nos outros dias.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-red-500/15 bg-red-500/6 p-2.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-slate-300">
            <strong className="text-slate-100">Motivo Agendamento:</strong> Agendamento online foi a causa apontada em{' '}
            <strong className="font-bold text-red-300">70% das 3★</strong>.
          </p>
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-blue-500/15 bg-blue-500/6 p-2.5">
          <Zap className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
          <p className="text-slate-300">
            <strong className="text-slate-100">Impacto SLA:</strong> Respostas enviadas em &lt;24h elevam a satisfação em{' '}
            <strong className="font-bold text-blue-300">+35%</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
