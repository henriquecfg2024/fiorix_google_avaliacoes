"use client";

import React, { useState } from "react";
import { Users, Calendar as CalendarIcon, ChevronLeft, ChevronRight, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ColaboradorFerias {
  id: string;
  nome: string;
  setor: string;
  inicio: string;
  fim: string;
  dias: number;
}

export function FeriasCalendar() {
  const [mesAtual, setMesAtual] = useState("Dezembro 2026");

  // Dados mockados/reais da Serventia (7º RI)
  const colaboradoresEmFerias: ColaboradorFerias[] = [
    { id: "1", nome: "Mariana Oliveira", setor: "Prenotação", inicio: "01/12", fim: "20/12", dias: 20 },
    { id: "2", nome: "Carlos Eduardo Silva", setor: "Registro", inicio: "10/12", fim: "30/12", dias: 20 },
    { id: "3", nome: "Fernanda Costa", setor: "Certidões", inicio: "15/12", fim: "04/01", dias: 20 },
    { id: "4", nome: "Henrique Gama", setor: "Administração", inicio: "15/12", fim: "03/01", dias: 20 },
    { id: "5", nome: "Luciana Martins", setor: "Balcão / Atendimento", inicio: "20/12", fim: "10/01", dias: 20 },
  ];

  const totalColaboradores = 46;
  const emFeriasCount = 13;
  const disponiveisCount = totalColaboradores - emFeriasCount;
  const porcentagemDisponivel = Math.round((disponiveisCount / totalColaboradores) * 100);

  return (
    <div className="space-y-6">
      {/* Capacidade do Setor Card */}
      <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.22)] p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_20px_rgba(34,211,238,0.15)]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Capacidade Operacional do Cartório</h3>
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                NORMAL
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Visão consolidada de disponibilidade da equipe da Serventia</p>
          </div>
        </div>

        <div className="flex items-center gap-8 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-white/8 pt-4 md:pt-0">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-cyan-400 tracking-tight">{porcentagemDisponivel}%</span>
              <span className="text-xs text-slate-300 font-bold uppercase tracking-wider">disponível</span>
            </div>
            <div className="w-32 bg-slate-700/60 h-1.5 rounded-full mt-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-violet-500 to-cyan-400 h-full w-[72%]" />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{disponiveisCount} de {totalColaboradores} colaboradores</p>
          </div>

          <div className="h-10 w-px bg-white/10 hidden sm:block" />

          <div className="text-right">
            <span className="text-xs font-bold text-amber-400 flex items-center justify-end gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
              <UserX className="w-3.5 h-3.5" /> {emFeriasCount} em férias
            </span>
            <span className="text-[11px] text-slate-400 block mt-1.5">Previstas para o mês</span>
          </div>
        </div>
      </div>

      {/* Calendário da Equipe */}
      <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.22)] p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-white/8 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Escala do Mês • {mesAtual}</h3>
              <p className="text-[11px] text-slate-400">Cronograma de afastamentos programados</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 px-2.5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2.5 border-white/10 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Lista / Linhas de Gantt do Mês */}
        <div className="space-y-3">
          {colaboradoresEmFerias.map((colab) => (
            <div
              key={colab.id}
              className="p-4 bg-[#070A12]/60 hover:bg-white/[0.04] transition-all rounded-2xl border border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-300 font-bold text-xs flex items-center justify-center shadow-[0_0_12px_rgba(99,102,241,0.15)]">
                  {colab.nome.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white tracking-wide">{colab.nome}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="rounded-md bg-white/[0.04] border border-white/8 px-2 py-0.5 text-[10px] text-slate-400 font-medium">
                      {colab.setor}
                    </span>
                    <span className="text-[10px] text-emerald-400 font-medium">Homologado</span>
                  </div>
                </div>
              </div>

              {/* Barra de Período */}
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3.5 py-1 font-mono text-xs font-bold text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.1)]">
                  {colab.inicio} até {colab.fim} ({colab.dias} dias)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
