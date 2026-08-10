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
    { icon: '🕐', nome: 'Fila / Espera', pct: 18, isBi: false },
  ];

  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (saudeReputacao / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-5 border-b border-gray-100 mb-6">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <h2 className="text-xs font-bold tracking-widest text-gray-500 uppercase">
            SAÚDE DA REPUTAÇÃO
          </h2>
        </div>
        <span className="bg-gray-100 text-gray-700 text-xs px-2.5 py-1 rounded-full font-semibold">
          10 INDICADORES
        </span>
      </div>

      {/* GRID CONTAINER: 35% LEFT (SCORE) | 65% RIGHT (INDICATORS BY GROUP) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* LEFT COLUMN: SCORE CIRCLE & DISPLAY */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-50/70 rounded-xl border border-slate-100 text-center">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 140 140">
              <circle
                cx="70"
                cy="70"
                r={radius}
                className="text-slate-200"
                strokeWidth="12"
                stroke="currentColor"
                fill="transparent"
              />
              <circle
                cx="70"
                cy="70"
                r={radius}
                stroke="#2B7AE4"
                strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-4xl font-extrabold text-slate-900 tracking-tight">
                {saudeReputacao}
              </span>
              <span className="text-[11px] font-semibold text-slate-500">de 100</span>
            </div>
          </div>

          <div className="mt-3">
            <p className="text-sm font-bold text-slate-800">
              {saudeReputacao} pontos de 100 — <span className="text-blue-600">Bom</span>
            </p>
            <Link
              href="/estatisticas#metodologia-reputacao"
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
            >
              <span>Metodologia e Detalhes ({saudeReputacao} pts)</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* RIGHT COLUMN: 3 GROUPS OF INDICATORS */}
        <div className="lg:col-span-8 space-y-4">
          {/* GROUP A: SAUDÁVEIS 🟢 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider">
              <span>🟢</span>
              <span>Indicadores Saudáveis</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {saudaveis.map((ind, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5 truncate">
                      <span>{ind.icon}</span>
                      <span className="truncate">{ind.nome}</span>
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.5 rounded text-[11px]">
                      {ind.pct}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${ind.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GROUP B: ATENÇÃO 🟡 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 uppercase tracking-wider">
              <span>🟡</span>
              <span>Pontos de Atenção</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {atencao.map((ind, idx) => {
                const isBlue = ind.badgeColor === 'blue';
                return (
                  <div key={idx} className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5 truncate">
                        <span>{ind.icon}</span>
                        <span className="truncate">{ind.nome}</span>
                      </span>
                      <span
                        className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                          isBlue ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {ind.pct}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isBlue ? 'bg-blue-600' : 'bg-amber-500'
                        }`}
                        style={{ width: `${ind.pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GROUP C: CRÍTICOS 🔴 */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 uppercase tracking-wider">
              <span>🔴</span>
              <span>Indicadores Críticos</span>
            </div>
            <div className="bg-red-50/70 border border-red-200 rounded-xl p-3 space-y-2.5">
              {criticos.map((ind, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <span>{ind.icon}</span>
                      <span>{ind.nome}</span>
                      {ind.isBi && (
                        <Link
                          href="/bi"
                          className="bg-red-100 hover:bg-red-200 text-red-700 font-extrabold text-[10px] px-2 py-0.5 rounded transition-colors"
                        >
                          VER BI →
                        </Link>
                      )}
                    </span>
                    <span className="bg-red-100 text-red-700 font-extrabold px-2 py-0.5 rounded text-[11px]">
                      {ind.pct}%
                    </span>
                  </div>
                  <div className="w-full bg-red-200/60 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-red-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${ind.pct}%` }}
                    />
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

