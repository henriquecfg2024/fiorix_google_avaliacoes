import React from 'react';
import { Star, MessageSquare, Clock, CheckCircle } from 'lucide-react';

interface KpiRowProps {
  notaMedia: number;
  totalAvaliacoes: number;
  pendentes: number;
  respondidasHoje: number;
  isDemo?: boolean;
  notaVariation?: number;
  volumeVariation?: number;
  pendentesVariation?: number;
  respondidasEsteMes?: number;
}

function KpiCard({
  title,
  value,
  icon,
  iconClass,
  badgeClass,
  badgeText,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconClass: string;
  badgeClass: string;
  badgeText: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col justify-between rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all hover:border-white/20">
      <div className="flex items-center justify-between">
        <span className="text-kpi-label font-semibold text-slate-300">{title}</span>
        <div className={`rounded-xl border p-2 ${iconClass}`}>{icon}</div>
      </div>

      <div className="mt-3">
        <div className="text-3xl font-extrabold tracking-tight text-white">{value}</div>
        <div className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${badgeClass}`}>
          {badgeText}
        </div>
      </div>
    </div>
  );
}

export function KpiRow({
  notaMedia,
  totalAvaliacoes,
  pendentes,
  respondidasHoje,
  notaVariation = 0,
  volumeVariation = 0,
  pendentesVariation = 0,
  respondidasEsteMes = 0,
}: KpiRowProps) {
  const formattedNota = (notaMedia || 4.4).toFixed(1).replace('.', ',');
  const totalDisplay = totalAvaliacoes ?? 0;
  const pendentesDisplay = pendentes ?? 0;
  const respondidasDisplay = respondidasHoje ?? 0;

  const notaUp = notaVariation >= 0;
  const volUp = volumeVariation >= 0;
  const pendUp = pendentesVariation > 0;

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <KpiCard
        title="Nota Média"
        value={formattedNota}
        icon={<Star className="h-4 w-4 fill-current" />}
        iconClass="border-cyan-500/20 bg-cyan-500/10 text-cyan-300"
        badgeClass={notaUp
          ? "border-emerald-500/20 bg-emerald-500/12 font-bold text-emerald-300"
          : "border-rose-500/20 bg-rose-500/12 font-bold text-rose-300"}
        badgeText={
          <>
            <span>{notaUp ? '↑' : '↓'} {Math.abs(notaVariation).toFixed(1)}</span>
            <span className={`font-normal ${notaUp ? 'text-emerald-200/80' : 'text-rose-200/80'}`}>vs mês anterior</span>
          </>
        }
      />

      <KpiCard
        title="Total Avaliações"
        value={totalDisplay}
        icon={<MessageSquare className="h-4 w-4" />}
        iconClass="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
        badgeClass={volUp
          ? "border-emerald-500/20 bg-emerald-500/12 font-bold text-emerald-300"
          : "border-rose-500/20 bg-rose-500/12 font-bold text-rose-300"}
        badgeText={
          <>
            <span>{volUp ? '↑' : '↓'} {volumeVariation > 0 ? '+' : ''}{volumeVariation}</span>
            <span className={`font-normal ${volUp ? 'text-emerald-200/80' : 'text-rose-200/80'}`}>este mês</span>
          </>
        }
      />

      <KpiCard
        title="Aguardando"
        value={pendentesDisplay}
        icon={<Clock className="h-4 w-4" />}
        iconClass="border-amber-500/20 bg-amber-500/10 text-amber-300"
        badgeClass={pendUp
          ? "border-rose-500/20 bg-rose-500/10 font-bold text-rose-200"
          : "border-emerald-500/20 bg-emerald-500/12 font-bold text-emerald-300"}
        badgeText={
          <>
            <span>{pendentesVariation === 0 ? '=' : pendUp ? '↑' : '↓'} {Math.abs(pendentesVariation)}</span>
            <span className={`font-normal ${pendUp ? 'text-rose-200/80' : 'text-emerald-200/80'}`}>vs período anterior</span>
          </>
        }
      />

      <KpiCard
        title="Respondidas Mês"
        value={respondidasDisplay}
        icon={<CheckCircle className="h-4 w-4" />}
        iconClass="border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
        badgeClass="border-emerald-500/20 bg-emerald-500/12 font-bold text-emerald-300"
        badgeText={
          <>
            <span>✓ {respondidasEsteMes}</span>
            <span className="font-normal text-emerald-200/80">este mês</span>
          </>
        }
      />
    </div>
  );
}
