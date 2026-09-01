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
      <div className="p-6 rounded-2xl bg-[#0d0d16] border border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3.5 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Capacidade Operacional do Cartório</h3>
            <p className="text-xs text-white/50 mt-0.5">Visão consolidada de disponibilidade da equipe</p>
          </div>
        </div>

        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-cyan-400">{porcentagemDisponivel}%</span>
              <span className="text-xs text-white/60">disponível</span>
            </div>
            <p className="text-[11px] text-white/40">{disponiveisCount} de {totalColaboradores} colaboradores</p>
          </div>

          <div className="h-8 w-px bg-white/10 hidden sm:block" />

          <div className="text-right">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
              <UserX className="w-3.5 h-3.5" /> {emFeriasCount} em férias
            </span>
            <span className="text-[11px] text-white/40">Previstas para o mês</span>
          </div>
        </div>
      </div>

      {/* Calendário da Equipe */}
      <div className="p-6 rounded-2xl bg-[#0d0d16] border border-white/5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">Escala do Mês • {mesAtual}</h3>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 px-2 border-white/10 text-white/70 hover:text-white">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-2 border-white/10 text-white/70 hover:text-white">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Lista / Linhas de Gantt do Mês */}
        <div className="space-y-3">
          {colaboradoresEmFerias.map((colab) => (
            <div key={colab.id} className="p-3 bg-[#101019] rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs flex items-center justify-center">
                  {colab.nome.charAt(0)}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{colab.nome}</h4>
                  <span className="text-[10px] text-white/40">{colab.setor}</span>
                </div>
              </div>

              {/* Barra de Período */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded border border-cyan-800/40">
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
