"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Briefcase, Calendar, Clock, AlertTriangle, ShieldCheck, FileText, CheckCircle2, Lock } from "lucide-react";
import { FeriasTimeline } from "@/components/ferias/FeriasTimeline";
import { FeriasCalendar } from "@/components/ferias/FeriasCalendar";
import { Button } from "@/components/ui/button";

interface FeriasClientProps {
  userRole?: string;
  userName?: string;
}

export function FeriasClient({ userRole = "USER", userName = "Colaborador" }: FeriasClientProps) {
  const [activeTab, setActiveTab] = useState<"minhas" | "equipe">("minhas");

  const isManager = userRole === "ADMIN" || userRole === "RH" || userRole === "MASTER" || userRole === "GESTOR";

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
              <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
              <span className="text-slate-600">/</span>
              <Link href="/pessoas" className="hover:text-white transition-colors">Pessoas</Link>
              <span className="text-slate-600">/</span>
              <span className="text-emerald-400 font-semibold">Férias</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                FÉRIAS
              </h1>
              <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300">
                CLT ART. 135
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Planejamento, previsão legal e histórico de alterações em conformidade com as normas da Corregedoria.
            </p>
          </div>

          {/* Subtabs de Férias (Escala da Equipe visível apenas para RH / Gestores) */}
          {isManager && (
            <div className="flex gap-1.5 p-1 bg-white/[0.04] rounded-2xl border border-white/8 text-xs font-bold">
              <button
                onClick={() => setActiveTab("minhas")}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === "minhas" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
                }`}
              >
                Minhas Férias
              </button>
              <button
                onClick={() => setActiveTab("equipe")}
                className={`px-4 py-2 rounded-xl transition-all cursor-pointer ${
                  activeTab === "equipe" ? "bg-indigo-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
                }`}
              >
                Escala da Equipe
              </button>
            </div>
          )}
        </div>

        {(!isManager || activeTab === "minhas") ? (
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
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Próximas Férias Previstas</span>
                      <h3 className="text-xl font-bold text-white">15/12/2026 a 03/01/2027</h3>
                    </div>
                  </div>

                  <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-300">
                    20 DIAS
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-[#070A12]/60 border border-white/8 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Início do Período</span>
                    <p className="text-sm font-bold text-white">15/12/2026</p>
                    <span className="text-[10px] text-slate-400">Terça-feira</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#070A12]/60 border border-white/8 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Término</span>
                    <p className="text-sm font-bold text-white">03/01/2027</p>
                    <span className="text-[10px] text-slate-400">Domingo</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#070A12]/60 border border-white/8 space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Retorno ao Trabalho</span>
                    <p className="text-sm font-bold text-emerald-400">04/01/2027</p>
                    <span className="text-[10px] text-slate-400">Segunda-feira</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 flex items-start gap-3">
                  <Clock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Aviso formal homologado em 31/08/2026. Conforme o Art. 135 da CLT, o aviso de concessão de férias foi emitido com mais de 30 dias de antecedência (105 dias).
                  </p>
                </div>
              </div>

              {/* Histórico e Trilha de Alterações */}
              <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
                <div className="flex items-center justify-between border-b border-white/8 pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Linha do Tempo de Previsões & Alterações</h3>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">HISTÓRICO IMUTÁVEL</span>
                </div>

                <FeriasTimeline eventos={feriasEventos} />
              </div>
            </div>

            {/* Coluna Lateral: Garantias Legais */}
            <div className="lg:col-span-4 space-y-6">
              <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-4">
                <h3 className="text-xs font-black text-white uppercase tracking-wider border-b border-white/8 pb-3">
                  GARANTIAS LEGAIS & CORREGEDORIA
                </h3>

                <div className="space-y-3 text-xs text-slate-300">
                  <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/[0.02] border border-white/8">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-white">Art. 135 da CLT</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        A concessão das férias participada por escrito ao empregado com antecedência de, no mínimo, 30 dias.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-white/[0.02] border border-white/8">
                    <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-white">Continuidade do Serviço</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Escala organizada de modo a manter 100% da capacidade de atendimento e atos registrais.
                      </p>
                    </div>
                  </div>
                </div>
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
