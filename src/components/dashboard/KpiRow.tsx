import React from 'react';
import { Star, MessageSquare, Clock, CheckCircle } from 'lucide-react';

interface KpiRowProps {
  notaMedia: number;
  totalAvaliacoes: number;
  pendentes: number;
  respondidasHoje: number;
  isDemo?: boolean;
}

function KpiCard({
  title,
  value,
  icon,
  borderClass,
  iconClass,
  badgeClass,
  badgeText,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  borderClass: string;
  iconClass: string;
  badgeClass: string;
  badgeText: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col justify-between space-y-3 rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl ${borderClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</span>
        <div className={`rounded-xl border p-2 ${iconClass}`}>{icon}</div>
      </div>

      <div>
        <div className="text-3xl font-extrabold tracking-tight text-white">{value}</div>
        <div className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${badgeClass}`}>
          {badgeText}
        </div>
      </div>
    </div>
  );
}

export function KpiRow({ notaMedia, totalAvaliacoes, pendentes, respondidasHoje }: KpiRowProps) {
  const formattedNota = (notaMedia || 4.4).toFixed(1).replace('.', ',');
  const totalDisplay = totalAvaliacoes ?? 0;
  const pendentesDisplay = pendentes ?? 0;
  const respondidasDisplay = respondidasHoje ?? 0;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        title="Nota Média"
        value={formattedNota}
        icon={<Star className="h-4 w-4 fill-current" />}
        borderClass="border-cyan-500/18"
        iconClass="border-cyan-500/18 bg-cyan-500/10 text-cyan-300"
        badgeClass="border-emerald-500/20 bg-emerald-500/12 font-bold text-emerald-300"
        badgeText={
          <>
            <span>↑ 0,1</span>
            <span className="font-normal text-emerald-200/80">vs mês anterior</span>
          </>
        }
      />

      <KpiCard
        title="Total Avaliações"
        value={totalDisplay}
        icon={<MessageSquare className="h-4 w-4" />}
        borderClass="border-emerald-500/18"
        iconClass="border-emerald-500/18 bg-emerald-500/10 text-emerald-300"
        badgeClass="border-emerald-500/20 bg-emerald-500/12 font-bold text-emerald-300"
        badgeText={
          <>
            <span>↑ +23</span>
            <span className="font-normal text-emerald-200/80">este mês</span>
          </>
        }
      />

      <KpiCard
        title="Aguardando"
        value={pendentesDisplay}
        icon={<Clock className="h-4 w-4" />}
        borderClass="border-amber-500/18"
        iconClass="border-amber-500/18 bg-amber-500/10 text-amber-300"
        badgeClass="border-amber-500/20 bg-amber-500/10 font-bold text-amber-200"
        badgeText={
          <>
            <span>↓ 3</span>
            <span className="font-normal text-amber-200/80">vs ontem</span>
          </>
        }
      />

      <KpiCard
        title="Respondidas Hoje"
        value={respondidasDisplay}
        icon={<CheckCircle className="h-4 w-4" />}
        borderClass="border-white/10"
        iconClass="border-white/10 bg-white/[0.04] text-slate-200"
        badgeClass="border-white/10 bg-white/[0.04] font-bold text-slate-200"
        badgeText={
          <>
            <span>↗ 8</span>
            <span className="font-normal text-slate-300/80">automáticas</span>
          </>
        }
      />
    </div>
  );
}
