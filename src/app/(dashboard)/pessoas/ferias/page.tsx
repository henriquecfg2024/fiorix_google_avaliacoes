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
    <div className="flex-1 w-full bg-[#05050a] min-h-[calc(100vh-56px)] text-white pb-16">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#080A12]/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-white/70">
              FÉRIAS & AUSÊNCIAS
            </h1>
            <p className="mt-1 text-xs text-white/50">
              Planejamento, previsão legal e histórico de alterações em conformidade com a CLT.
            </p>
          </div>

          <div className="flex gap-2 p-1 bg-[#12141F] rounded-xl border border-white/5 text-xs font-bold">
            <button
              onClick={() => setActiveTab("minhas")}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === "minhas" ? "bg-indigo-600 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              Minhas Férias
            </button>
            <button
              onClick={() => setActiveTab("equipe")}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeTab === "equipe" ? "bg-indigo-600 text-white" : "text-white/60 hover:text-white"
              }`}
            >
              Escala da Equipe
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8 space-y-8">
        {activeTab === "minhas" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Card Principal de Férias Previstas */}
            <div className="lg:col-span-8 space-y-6">
              <div className="p-6 rounded-2xl bg-[#0d0d16] border border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-white/40 uppercase">Próximo Período Programado</span>
                      <h2 className="text-xl font-black text-white">15/12/2026 a 03/01/2027</h2>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    20 dias de descanso
                  </span>
                </div>

                <div className="p-4 bg-[#12141F] rounded-xl border border-white/5 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white">Antecedência Legal (CLT Art. 135)</span>
                    <p className="text-[11px] text-emerald-400 font-medium mt-0.5">
                      ✓ Em conformidade: 105 dias de antecedência para a data prevista.
                    </p>
                  </div>
                  <span className="text-xs font-mono text-cyan-400 font-bold bg-cyan-950/50 px-2.5 py-1 rounded border border-cyan-800/50">
                    STATUS: ENTREGUE
                  </span>
                </div>

                {/* Timeline de Alterações */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-xs font-bold text-white/70 uppercase">Trilha de Histórico de Programação</h3>
                  <div className="p-4 bg-[#101019] rounded-xl border border-white/5">
                    <FeriasTimeline eventos={feriasEventos} />
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna de Avisos e Regras */}
            <div className="lg:col-span-4 space-y-6">
              <div className="p-6 rounded-2xl bg-[#0d0d16] border border-white/5 space-y-4">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">Avisos Formais de Férias</h3>
                <div className="p-4 bg-[#12141F] rounded-xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">Aviso Formal 2026/2027</span>
                    <FileText className="w-4 h-4 text-cyan-400" />
                  </div>
                  <p className="text-[11px] text-white/50 leading-relaxed">
                    Documento assinado digitalmente e protocolado no sistema de RH.
                  </p>
                  <Button variant="outline" size="sm" className="w-full mt-2 text-xs border-white/10 text-white/80">
                    Visualizar Documento de Aviso
                  </Button>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-[#0d0d16] border border-white/5 space-y-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-xs font-bold text-white uppercase">Garantias Legais</h4>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">
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
