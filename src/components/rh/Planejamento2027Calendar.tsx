"use client";

import React from "react";
import { Users, AlertTriangle, CheckCircle2 } from "lucide-react";

export interface PlanejamentoColaborador {
  id: string;
  nome: string;
  setor: "Atendimento" | "Registro" | "Financeiro" | "RH" | "Administração" | "Impressão/Arquivo" | "TI";
  p1Inicio: string;
  p1Fim: string;
  p1Dias: number;
  p2Inicio?: string;
  p2Fim?: string;
  p2Dias?: number;
  p3Inicio?: string;
  p3Fim?: string;
  p3Dias?: number;
  totalDias: number;
  status: "planejado" | "pendente" | "conflito" | "publicado";
  observacao?: string;
}

interface Planejamento2027CalendarProps {
  ano?: number;
  colaboradores: PlanejamentoColaborador[];
  onSelectMes?: (mesIndex: number) => void;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const SETOR_COLORS: Record<string, string> = {
  Atendimento: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  Registro: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
  Financeiro: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  RH: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Administração: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  "Impressão/Arquivo": "bg-rose-500/20 text-rose-300 border-rose-500/30",
  TI: "bg-blue-500/20 text-blue-300 border-blue-500/30",
};

export function Planejamento2027Calendar({ ano = 2027, colaboradores, onSelectMes }: Planejamento2027CalendarProps) {
  // Mapeia para cada mês quem está de férias
  const getColaboradoresNoMes = (mesIndex: number) => {
    // mesIndex 0 = Jan, 11 = Dez
    const mesNum = mesIndex + 1;
    return colaboradores.filter((c) => {
      const checarPeriodo = (inicioStr?: string, fimStr?: string) => {
        if (!inicioStr || !fimStr) return false;
        const d1 = new Date(inicioStr);
        const d2 = new Date(fimStr);
        // verifica se o mês está contido no intervalo do ano selecionado
        const m1 = d1.getMonth() + 1;
        const m2 = d2.getMonth() + 1;
        const y1 = d1.getFullYear();
        const y2 = d2.getFullYear();

        if (y1 === ano && (m1 === mesNum || m2 === mesNum || (m1 <= mesNum && m2 >= mesNum))) {
          return true;
        }
        return false;
      };

      return (
        checarPeriodo(c.p1Inicio, c.p1Fim) ||
        checarPeriodo(c.p2Inicio, c.p2Fim) ||
        checarPeriodo(c.p3Inicio, c.p3Fim)
      );
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Calendário Anual de Cobertura — {ano} (12 Meses)
          </h4>
          <p className="text-[11px] text-slate-400">
            Monitoramento de lotação por setor e detecção preventiva de gargalos operacionais
          </p>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span> 0-2 OK
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span> 3-4 Atenção (&gt;3 mesmo setor)
          </span>
          <span className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span> 5+ Conflito Crítico
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {MESES.map((mes, idx) => {
          const emFerias = getColaboradoresNoMes(idx);
          const count = emFerias.length;

          // Agrupa por setor para checar se >3 no mesmo setor
          const setorCount: Record<string, number> = {};
          emFerias.forEach((colab) => {
            setorCount[colab.setor] = (setorCount[colab.setor] || 0) + 1;
          });
          const maxSetor = Math.max(0, ...Object.values(setorCount));
          const hasSetorConflict = maxSetor > 3;

          let statusBg = "border-white/10 bg-[#0d0d18]";
          let badgeColor = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
          let statusText = "Normal";

          if (count >= 5 || hasSetorConflict) {
            statusBg = "border-rose-500/40 bg-rose-950/20";
            badgeColor = "bg-rose-500/20 text-rose-300 border-rose-500/40";
            statusText = hasSetorConflict ? `Conflito (${maxSetor} ${Object.keys(setorCount).find(k => setorCount[k] === maxSetor)})` : "Conflito Crítico";
          } else if (count >= 3) {
            statusBg = "border-amber-500/30 bg-amber-950/15";
            badgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/30";
            statusText = "Atenção";
          }

          return (
            <div
              key={mes}
              onClick={() => onSelectMes?.(idx)}
              className={`rounded-2xl border p-4 transition-all duration-200 hover:border-indigo-500/50 cursor-pointer ${statusBg}`}
            >
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/5">
                <span className="font-bold text-sm text-white">{mes}</span>
                <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                  {count} {count === 1 ? "colab." : "colabs."}
                </span>
              </div>

              <div className="text-[10px] text-slate-400 mb-2 font-mono flex items-center justify-between">
                <span>Status: <span className="font-bold text-white">{statusText}</span></span>
              </div>

              {/* Lista dos primeiros nomes com tag de setor */}
              <div className="space-y-1.5 min-h-[75px] max-h-[110px] overflow-y-auto pr-1">
                {emFerias.length === 0 ? (
                  <p className="text-[11px] text-slate-500 italic py-2 text-center">Nenhum gozo planejado</p>
                ) : (
                  emFerias.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-white/[0.03] px-2 py-1 rounded-lg border border-white/5 text-[11px]"
                    >
                      <span className="text-white truncate max-w-[110px] font-medium" title={c.nome}>
                        {c.nome.split(" ")[0]} {c.nome.split(" ")[1]?.charAt(0) || ""}.
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${SETOR_COLORS[c.setor] || "bg-slate-500/20 text-slate-300"}`}
                      >
                        {c.setor.substring(0, 4)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
