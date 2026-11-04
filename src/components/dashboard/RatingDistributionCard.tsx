import React from 'react';
import { Star, ThumbsUp, MinusCircle, AlertCircle } from 'lucide-react';

export interface StarBucket {
  stars: 5 | 4 | 3 | 2 | 1;
  count: number;
  pct: number;
}

interface RatingDistributionCardProps {
  distribution?: StarBucket[];
  totalActive?: number;
  notaMedia?: number;
  isDemo?: boolean;
}

const DEMO_DISTRIBUTION: StarBucket[] = [
  { stars: 5, count: 418, pct: 78 },
  { stars: 4, count: 54, pct: 10 },
  { stars: 3, count: 21, pct: 4 },
  { stars: 2, count: 15, pct: 3 },
  { stars: 1, count: 28, pct: 5 },
];

const BAR_STYLES: Record<5 | 4 | 3 | 2 | 1, { fill: string; text: string }> = {
  5: {
    fill: 'bg-gradient-to-r from-emerald-500 to-cyan-400',
    text: 'text-emerald-300',
  },
  4: {
    fill: 'bg-gradient-to-r from-teal-500 to-emerald-400',
    text: 'text-teal-300',
  },
  3: {
    fill: 'bg-gradient-to-r from-amber-500 to-amber-300',
    text: 'text-amber-300',
  },
  2: {
    fill: 'bg-gradient-to-r from-orange-500 to-amber-400',
    text: 'text-orange-300',
  },
  1: {
    fill: 'bg-gradient-to-r from-rose-600 to-rose-400',
    text: 'text-rose-300',
  },
};

export function RatingDistributionCard({
  distribution,
  totalActive = 0,
  notaMedia = 0,
  isDemo = false,
}: RatingDistributionCardProps) {
  const rows = !isDemo && distribution && distribution.length === 5 ? distribution : DEMO_DISTRIBUTION;
  const total = !isDemo && distribution ? totalActive : 536;
  const media = !isDemo && distribution ? notaMedia : 4.4;

  const positivasCount = (rows.find((r) => r.stars === 5)?.count ?? 0) + (rows.find((r) => r.stars === 4)?.count ?? 0);
  const neutrasCount = rows.find((r) => r.stars === 3)?.count ?? 0;
  const criticasCount = (rows.find((r) => r.stars === 2)?.count ?? 0) + (rows.find((r) => r.stars === 1)?.count ?? 0);

  const positivasPct = total > 0 ? Math.round((positivasCount / total) * 100) : 0;
  const neutrasPct = total > 0 ? Math.round((neutrasCount / total) * 100) : 0;
  const criticasPct = total > 0 ? Math.round((criticasCount / total) * 100) : 0;

  return (
    <div className="flex h-full flex-col justify-between rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl transition-all">
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-white/8 pb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 shrink-0 fill-amber-400/20 text-amber-400" />
              <h3 className="text-base font-bold text-white">Distribuição de Notas &amp; Satisfação</h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              Volume acumulado por faixa de estrelas e índice de aprovação no Google
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isDemo ? (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-200">
                DEMO
              </span>
            ) : (
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-300 tabular-nums">
                Média {media.toFixed(1).replace('.', ',')} ★ · {total} aval.
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3 py-1">
          {rows.map((row) => {
            const style = BAR_STYLES[row.stars];
            const widthPct = row.count > 0 ? Math.max(row.pct, 2) : 0;
            return (
              <div key={row.stars} className="flex items-center gap-3">
                <div className={`flex w-11 shrink-0 items-center gap-1 text-xs font-bold tabular-nums ${style.text}`}>
                  <span>{row.stars}</span>
                  <span className="text-[11px]">★</span>
                </div>

                <div className="h-3 flex-1 overflow-hidden rounded-full border border-white/10 bg-[#080D1A]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${style.fill}`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>

                <div className="flex w-24 shrink-0 items-center justify-end gap-1.5 text-right font-mono text-xs tabular-nums">
                  <span className="font-bold text-white">{row.count}</span>
                  <span className="w-10 text-slate-400">({row.pct}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-2.5 border-t border-white/8 pt-4 sm:grid-cols-3">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/25 bg-[#080D1A] px-3.5 py-2.5 sm:block">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
            <ThumbsUp className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>Aprovação (4–5★)</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5 sm:mt-1">
            <span className="text-base font-extrabold text-white tabular-nums">{positivasPct}%</span>
            <span className="text-[11px] text-slate-400 tabular-nums">({positivasCount})</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-amber-500/25 bg-[#080D1A] px-3.5 py-2.5 sm:block">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
            <MinusCircle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            <span>Neutras (3★)</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5 sm:mt-1">
            <span className="text-base font-extrabold text-white tabular-nums">{neutrasPct}%</span>
            <span className="text-[11px] text-slate-400 tabular-nums">({neutrasCount})</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/25 bg-[#080D1A] px-3.5 py-2.5 sm:block">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-rose-300">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
            <span>Críticas (1–2★)</span>
          </div>
          <div className="mt-0.5 flex items-baseline gap-1.5 sm:mt-1">
            <span className="text-base font-extrabold text-white tabular-nums">{criticasPct}%</span>
            <span className="text-[11px] text-slate-400 tabular-nums">({criticasCount})</span>
          </div>
        </div>
      </div>
    </div>
  );
}
