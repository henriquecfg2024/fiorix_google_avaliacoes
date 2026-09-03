"use client";

import React, { useState } from "react";
import { PlanejamentoColaborador } from "./Planejamento2027Calendar";

interface Planejamento2027GanttProps {
  ano?: number;
  colaboradores: PlanejamentoColaborador[];
}

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const SETOR_BAR_COLORS: Record<string, string> = {
  Atendimento: "from-cyan-500 to-blue-500 shadow-cyan-500/20",
  Registro: "from-indigo-500 to-purple-500 shadow-indigo-500/20",
  Financeiro: "from-emerald-500 to-teal-500 shadow-emerald-500/20",
  RH: "from-purple-500 to-pink-500 shadow-purple-500/20",
  Administração: "from-amber-500 to-orange-500 shadow-amber-500/20",
};

export function Planejamento2027Gantt({ ano = 2027, colaboradores }: Planejamento2027GanttProps) {
  const [filterSetor, setFilterSetor] = useState<string>("TODOS");

  const totalDiasAno = 365;

  const getDayOfYear = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 0;
    const start = new Date(d.getFullYear(), 0, 0);
    const diff = d.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  };

  const filteredColabs = colaboradores.filter((c) => {
    if (filterSetor === "TODOS") return true;
    return c.setor === filterSetor;
  });

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0d0d18] p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-white">
            Timeline / Gantt Anual — Escala Consolidada {ano}
          </h4>
          <p className="text-[11px] text-slate-400">
            Visualização contínua de períodos de gozo por colaborador ao longo dos 365 dias
          </p>
        </div>

        {/* Filtro de Setor */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">Setor:</span>
          <select
            value={filterSetor}
            onChange={(e) => setFilterSetor(e.target.value)}
            className="bg-[#05050a] border border-white/15 text-white text-xs rounded-xl px-3 py-1.5 outline-none font-medium"
          >
            <option value="TODOS">Todos os Setores (45)</option>
            <option value="Atendimento">Atendimento (18)</option>
            <option value="Registro">Registro (15)</option>
            <option value="Financeiro">Financeiro (5)</option>
            <option value="RH">RH (3)</option>
            <option value="Administração">Administração (4)</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Header meses */}
          <div className="grid grid-cols-12 gap-0 border-b border-white/10 pb-2 text-[11px] font-mono text-slate-400 text-center pl-48">
            {MESES_ABREV.map((m) => (
              <div key={m} className="border-l border-white/5 first:border-l-0">
                {m}
              </div>
            ))}
          </div>

          {/* Colaboradores Linhas */}
          <div className="divide-y divide-white/5 py-2">
            {filteredColabs.map((colab) => {
              // Calcula posições de barras
              const periods = [
                { inicio: colab.p1Inicio, fim: colab.p1Fim, dias: colab.p1Dias, label: "P1" },
                colab.p2Inicio && colab.p2Fim ? { inicio: colab.p2Inicio, fim: colab.p2Fim, dias: colab.p2Dias || 0, label: "P2" } : null,
                colab.p3Inicio && colab.p3Fim ? { inicio: colab.p3Inicio, fim: colab.p3Fim, dias: colab.p3Dias || 0, label: "P3" } : null,
              ].filter(Boolean) as Array<{ inicio: string; fim: string; dias: number; label: string }>;

              return (
                <div key={colab.id} className="flex items-center py-2 hover:bg-white/[0.02] group">
                  {/* Nome do Colaborador e Setor */}
                  <div className="w-48 shrink-0 pr-3">
                    <div className="text-xs font-semibold text-white truncate" title={colab.nome}>
                      {colab.nome}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {colab.setor} • <span className="text-cyan-400">{colab.totalDias}d</span>
                    </div>
                  </div>

                  {/* Barra do Ano */}
                  <div className="flex-1 relative h-6 bg-white/[0.02] rounded-lg border border-white/5 overflow-hidden">
                    {/* Grid lines mensais */}
                    <div className="absolute inset-0 grid grid-cols-12 pointer-events-none">
                      {MESES_ABREV.map((_, i) => (
                        <div key={i} className="border-r border-white/5 h-full" />
                      ))}
                    </div>

                    {/* Barras de férias */}
                    {periods.map((p, pIdx) => {
                      const dayStart = getDayOfYear(p.inicio);
                      const dayEnd = getDayOfYear(p.fim);
                      if (dayStart <= 0 || dayEnd <= 0) return null;

                      const leftPercent = Math.max(0, Math.min(100, (dayStart / totalDiasAno) * 100));
                      const widthPercent = Math.max(1.5, Math.min(100 - leftPercent, ((dayEnd - dayStart + 1) / totalDiasAno) * 100));

                      const barColor = SETOR_BAR_COLORS[colab.setor] || "from-indigo-500 to-purple-500 shadow-indigo-500/20";

                      return (
                        <div
                          key={pIdx}
                          title={`${colab.nome} (${colab.setor}): ${p.label} - ${new Date(p.inicio).toLocaleDateString("pt-BR")} a ${new Date(p.fim).toLocaleDateString("pt-BR")} (${p.dias} dias)`}
                          style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                          className={`absolute top-0.5 bottom-0.5 rounded-md bg-gradient-to-r ${barColor} shadow-md flex items-center justify-center text-[9px] font-mono font-bold text-white cursor-pointer hover:brightness-125 transition-all z-10`}
                        >
                          {widthPercent > 4 ? `${p.dias}d` : ""}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
