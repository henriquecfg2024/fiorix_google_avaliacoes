import React from 'react';
import Link from 'next/link';

export function HealthCard() {
  const saudeReputacao = 68;

  const saudaveis = [
    { icon: '🕘', nome: 'Horário de Atendimento', pct: 96 },
    { icon: '💳', nome: 'Pagamento', pct: 93 },
    { icon: '🤝', nome: 'Qualidade de Atendimento', pct: 91 },
    { icon: '💡', nome: 'Clareza de Informações', pct: 88 },
  ];

  const atencao = [
    { icon: '🌟', nome: 'Índice de Recomendação', pct: 85, badgeColor: 'blue' },
    { icon: '🎯', nome: 'Resolução no 1º Contato', pct: 82, badgeColor: 'blue' },
    { icon: '📄', nome: 'Documentação', pct: 59, badgeColor: 'amber' },
    { icon: '🌐', nome: 'Site / Agendamento', pct: 42, badgeColor: 'amber' },
  ];

  const criticos = [
    { icon: '⏱️', nome: 'Prazo de Entrega', pct: 22, isBi: true },
    { icon: '🕐', nome: 'Fila / Espera', pct: 18, isBi: true, biPath: '/bi/produtividade' },
  ];

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (saudeReputacao / 100) * circumference;

  return (
    <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all">
      <div className="mb-6 flex items-center justify-between border-b border-white/8 pb-5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400" />
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-slate-300">SAÚDE DA REPUTAÇÃO</h2>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-200">
          10 INDICADORES
        </span>
      </div>

      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 flex flex-col items-center justify-center rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-center">
          <div className="relative flex h-36 w-36 items-center justify-center">
            <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r={radius} className="text-slate-700" strokeWidth="12" stroke="currentColor" fill="transparent" />
              <circle
                cx="70"
                cy="70"
                r={radius}
                stroke="#22D3EE"
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="drop-shadow-[0_0_18px_rgba(34,211,238,0.25)] transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-extrabold tracking-tight text-white">{saudeReputacao}</span>
              <span className="text-[11px] font-semibold text-slate-400">de 100</span>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-sm font-bold text-slate-100">
              {saudeReputacao} pontos de 100 — <span className="text-cyan-300">Bom</span>
            </p>
            <Link
              href="/estatisticas#metodologia-reputacao"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 transition-colors hover:text-cyan-200 hover:underline"
            >
              <span>Metodologia e Detalhes ({saudeReputacao} pts)</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        <div className="space-y-4 lg:col-span-8">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
              <span>🟢</span>
              <span>Indicadores Saudáveis</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {saudaveis.map((ind, idx) => (
                <div key={idx} className="space-y-1.5 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.025] p-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                    <span className="flex items-center gap-1.5 truncate">
                      <span>{ind.icon}</span>
                      <span className="truncate">{ind.nome}</span>
                    </span>
                    <span className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-bold text-emerald-300">
                      {ind.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/70">
                    <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${ind.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-amber-300">
              <span>🟡</span>
              <span>Pontos de Atenção</span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {atencao.map((ind, idx) => {
                const isBlue = ind.badgeColor === 'blue';
                return (
                <div key={idx} className="space-y-1.5 rounded-xl border border-white/8 bg-white/[0.025] p-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{ind.icon}</span>
                        <span className="truncate">{ind.nome}</span>
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${
                          isBlue ? 'border border-cyan-500/20 bg-cyan-500/10 text-cyan-300' : 'border border-amber-500/20 bg-amber-500/10 text-amber-300'
                        }`}
                      >
                        {ind.pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-700/70">
                      <div className={`h-full rounded-full transition-all duration-500 ${isBlue ? 'bg-cyan-400' : 'bg-amber-500'}`} style={{ width: `${ind.pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-rose-300">
              <span>🔴</span>
              <span>Indicadores Críticos</span>
            </div>
            <div className="space-y-2.5 rounded-2xl border border-rose-500/14 bg-rose-500/[0.03] p-3">
              {criticos.map((ind, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-100">
                    <span className="flex items-center gap-1.5">
                      <span>{ind.icon}</span>
                      <span>{ind.nome}</span>
                      {ind.isBi && (
                        <Link
                          href={ind.biPath || '/bi'}
                          className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[10px] font-extrabold text-rose-300 transition-colors hover:bg-rose-500/18"
                        >
                          VER BI →
                        </Link>
                      )}
                    </span>
                    <span className="rounded border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-extrabold text-rose-300">
                      {ind.pct}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-rose-950/40">
                    <div className="h-full rounded-full bg-rose-500 transition-all duration-500" style={{ width: `${ind.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
