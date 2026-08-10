import React from 'react';
import { Bot, AlertTriangle, Sparkles, Calendar, ThumbsUp, Zap } from 'lucide-react';

export function InsightCard() {
  return (
    <div className="bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] border border-violet-200 p-5 rounded-2xl shadow-sm space-y-4">
      {/* HEADER */}
      <div className="flex items-center gap-2 text-violet-800">
        <Bot className="w-5 h-5 text-violet-700" />
        <h3 className="text-xs font-bold tracking-wider uppercase">INSIGHTS DA IA</h3>
      </div>

      {/* ALERT HIGHLIGHT CARD */}
      <div className="bg-white/90 backdrop-blur-sm p-3.5 rounded-xl border border-violet-200/80 shadow-xs space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Alerta de Atendimento</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Reclamações sobre tempo de espera na fila subiram{' '}
          <strong className="text-red-600 font-extrabold">+40%</strong> este mês. Recomendamos otimizar a triagem inicial na recepção.
        </p>
      </div>

      {/* INSIGHT LIST */}
      <div className="space-y-2 text-xs">
        <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white/50 border border-white/60">
          <ThumbsUp className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-slate-700">
            <strong>Elogio Lucas:</strong> O escrevente <strong>Lucas</strong> foi citado com elogios em{' '}
            <strong className="text-emerald-700 font-bold">47 avaliações positivas</strong> este mês.
          </p>
        </div>

        <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white/50 border border-white/60">
          <Calendar className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-slate-700">
            <strong>Padrão Segunda:</strong> Notas dadas às <strong>segundas-feiras</strong> são em média{' '}
            <strong className="text-amber-700 font-bold">-0,4★ menores</strong> que nos outros dias.
          </p>
        </div>

        <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white/50 border border-white/60">
          <Sparkles className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <p className="text-slate-700">
            <strong>Motivo Agendamento:</strong> Agendamento online foi a causa apontada em{' '}
            <strong className="text-red-600 font-bold">70% das 3★</strong>.
          </p>
        </div>

        <div className="flex items-start gap-2.5 p-2 rounded-lg bg-white/50 border border-white/60">
          <Zap className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-slate-700">
            <strong>Impacto SLA:</strong> Respostas enviadas em &lt;24h elevam a satisfação em{' '}
            <strong className="text-blue-700 font-bold">+35%</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}

