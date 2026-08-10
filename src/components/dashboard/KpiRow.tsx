import React from 'react';
import { Star, MessageSquare, Clock, CheckCircle } from 'lucide-react';

interface KpiRowProps {
  notaMedia: number;
  totalAvaliacoes: number;
  pendentes: number;
  respondidasHoje: number;
  isDemo?: boolean;
}

export function KpiRow({ notaMedia, totalAvaliacoes, pendentes, respondidasHoje, isDemo }: KpiRowProps) {
  const formattedNota = (notaMedia || 4.4).toFixed(1).replace('.', ',');
  const totalDisplay = totalAvaliacoes ?? 0;
  const pendentesDisplay = pendentes ?? 0;
  const respondidasDisplay = respondidasHoje ?? 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* CARD 1: NOTA MÉDIA */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Nota Média</span>
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
            <Star className="w-4 h-4 fill-blue-600" />
          </div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{formattedNota}</div>
          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            <span>↑ 0,1</span>
            <span className="font-normal text-emerald-600">vs mês anterior</span>
          </div>
        </div>
      </div>

      {/* CARD 2: TOTAL AVALIAÇÕES */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Avaliações</span>
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <MessageSquare className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{totalDisplay}</div>
          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            <span>↑ +23</span>
            <span className="font-normal text-emerald-600">este mês</span>
          </div>
        </div>
      </div>

      {/* CARD 3: AGUARDANDO RESPOSTA */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Aguardando</span>
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{pendentesDisplay}</div>
          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
            <span>↓ 3</span>
            <span className="font-normal text-purple-600">vs ontem</span>
          </div>
        </div>
      </div>

      {/* CARD 4: RESPONDIDAS HOJE */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Respondidas Hoje</span>
          <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
            <CheckCircle className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">{respondidasDisplay}</div>
          <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
            <span>➔ 8</span>
            <span className="font-normal text-slate-600">automáticas</span>
          </div>
        </div>
      </div>
    </div>
  );
}

