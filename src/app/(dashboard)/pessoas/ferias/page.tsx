"use client";

import React, { useState } from "react";
import { Briefcase, Calendar, Clock, AlertTriangle, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";
import { FeriasTimeline } from "@/components/ferias/FeriasTimeline";
import { FeriasCalendar } from "@/components/ferias/FeriasCalendar";
import { Button } from "@/components/ui/button";

export default function FeriasPage() {
  const [activeTab, setActiveTab] = useState<"minhas" | "equipe">("minhas");

  const feriasEventos = [
    {
      id: "1",
      data: "2026-09-01",
      tipo: "confirmacao" as const,
      titulo: "Previsão confirmada",
      autorNome: "Henrique Gama - Admin",
    },
    {
      id: "2",
      data: "2026-07-16",
      tipo: "alteracao" as const,
      titulo: "Período alterado",
      autorNome: "De: 10/12/2026 - 28/12/2026",
      detalhes: "Para: 15/12/2026 - 03/01/2027",
    },
    {
      id: "3",
      data: "2026-06-10",
      tipo: "criacao" as const,
      titulo: "Previsão criada",
      autorNome: "Henrique Gama - Admin",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-20">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/12 via-indigo-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-5 py-6 sm:px-8 space-y-8">
        {/* Breadcrumb + Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-600">/</span>
              <span>Pessoas</span>
              <span className="text-slate-600">/</span>
              <span className="text-emerald-400">Férias</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                FÉRIAS & AUSÊNCIAS
              </h1>
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                CLT ART. 135
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Planejamento, previsão legal e histórico de alterações em conformidade com as normas da Corregedoria.
            </p>
          </div>

          <div className="flex gap-1.5 p-1 bg-white/[0.04] rounded-2xl border border-white/8 text-xs font-bold">
            <button
              onClick={() => setActiveTab("minhas")}
              className={`px-4 py-2 rounded-xl transition-all ${
                activeTab === "minhas" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
              }`}
            >
              Minhas Férias
            </button>
            <button
              onClick={() => setActiveTab("equipe")}
              className={`px-4 py-2 rounded-xl transition-all ${
                activeTab === "equipe" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
              }`}
            >
              Escala da Equipe
            </button>
          </div>
        </div>

        {activeTab === "minhas" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Card Principal de Férias Previstas */}
            <div className="lg:col-span-8 space-y-6">
              <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-6">
                <div className="flex items-center justify-between border-b border-white/8 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Próximo Período Programado</span>
                      <h2 className="text-2xl font-black text-white mt-0.5">15/12/2026 a 03/01/2027</h2>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 text-xs font-bold font-mono">
                    20 dias de descanso
                  </span>
                </div>

                <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/8 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white">Antecedência Legal (CLT Art. 135)</span>
                    <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                      ✓ Em conformidade: 105 dias de antecedência para a data prevista.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-cyan-300 font-bold bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">
                    STATUS: ENTREGUE
                  </span>
                </div>

                {/* Timeline de Alterações */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Trilha de Histórico de Programação</h3>
                  <div className="p-4 bg-[#070A12]/60 rounded-2xl border border-white/8">
                    <FeriasTimeline eventos={feriasEventos} />
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna de Avisos e Regras */}
            <div className="lg:col-span-4 space-y-6">
              <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
                <h3 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/8 pb-3">Avisos Formais de Férias</h3>
                <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/8 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Aviso Formal 2026/2027</span>
                    <FileText className="w-4 h-4 text-cyan-400" />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Documento assinado digitalmente e protocolado no sistema de RH.
                  </p>
                  <Button variant="outline" size="sm" className="w-full mt-2 text-xs border-white/10 text-slate-200 hover:bg-white/10 rounded-xl">
                    Visualizar Documento de Aviso
                  </Button>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Garantias Legais</h4>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Conforme a legislação vigente e normas da Corregedoria Geral da Justiça, os períodos de férias devem ser homologados com antecedência mínima de 30 dias pela Serventia.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <FeriasCalendar />
        )}
      </div>
    </div>
  );
}
