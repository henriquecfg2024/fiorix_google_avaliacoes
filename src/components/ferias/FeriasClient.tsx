"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Briefcase, Calendar, Clock, AlertCircle } from "lucide-react";
import { FeriasTimeline } from "@/components/ferias/FeriasTimeline";
import { EscalaAnualClient } from "@/components/ferias/EscalaAnualClient";
import { getEscalaAnualAction } from "@/app/actions/ferias";
import { EscalaItem, PublicacaoStatus } from "@/lib/ferias/ferias-repository";

interface FeriasClientProps {
  userRole?: string;
  userName?: string;
}

export function FeriasClient({ userRole = "USER", userName = "Colaborador" }: FeriasClientProps) {
  const [mounted, setMounted] = useState(false);
  const isManager = ["ADMIN", "RH", "MASTER", "GESTOR"].includes(userRole);

  const [activeTab, setActiveTab] = useState<"minhas" | "escala">(isManager ? "escala" : "minhas");
  const [ano] = useState(2027);
  const [loading, setLoading] = useState(true);
  const [publicacao, setPublicacao] = useState<PublicacaoStatus>({ ano, status: "RASCUNHO" });
  const [minhasFerias, setMinhasFerias] = useState<EscalaItem | null>(null);

  useEffect(() => {
    setMounted(true);
    getEscalaAnualAction({ ano })
      .then((res) => {
        setPublicacao(res.publicacao);
        if (res.colaboradores && res.colaboradores.length > 0) {
          setMinhasFerias(res.colaboradores[0]);
        }
      })
      .catch((err) => console.error("Erro ao carregar férias:", err))
      .finally(() => setLoading(false));
  }, [ano]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#070A12] text-white p-8">
        <div className="mx-auto max-w-[1600px] space-y-6">
          <div className="h-8 w-48 bg-white/5 rounded-xl animate-pulse" />
          <div className="h-64 bg-[#0B1020]/72 rounded-[28px] border border-white/8 animate-pulse" />
        </div>
      </div>
    );
  }

  // Eventos de férias — apenas se houver registros reais
  const feriasEventos = minhasFerias?.historico?.map((h, i) => ({
    id: `ev-${i}`,
    data: h.data,
    tipo: "confirmacao" as const,
    titulo: `Férias ${minhasFerias.ano} — ${h.para}`,
    autorNome: h.por,
    detalhes: h.motivo,
  })) || [];

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-20">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/12 via-indigo-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-5 py-6 sm:px-8 space-y-8">
        {/* Se for gestor e estiver na aba de escala anual, exibe a tela administrativa consolidada */}
        {isManager && activeTab === "escala" ? (
          <div>
            {/* Seletor de abas para gestor */}
            <div className="flex justify-end mb-4">
              <div className="flex gap-1.5 p-1 bg-white/[0.04] rounded-2xl border border-white/8 text-xs font-bold">
                <button
                  onClick={() => setActiveTab("escala")}
                  className="px-4 py-2 rounded-xl transition-all cursor-pointer bg-indigo-600 text-white shadow-lg"
                >
                  Escala Anual de Férias
                </button>
                <button
                  onClick={() => setActiveTab("minhas")}
                  className="px-4 py-2 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-white"
                >
                  Minhas Férias
                </button>
              </div>
            </div>

            <EscalaAnualClient
              initialAno={ano}
              initialPublicacao={publicacao}
              userRole={userRole}
            />
          </div>
        ) : (
          /* ─────────────────────────────────────────────────────────────
              TELA "MINHAS FÉRIAS" DO COLABORADOR
          ───────────────────────────────────────────────────────────── */
          <div className="space-y-6">
            {/* Header */}
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
                    MINHAS FÉRIAS
                  </h1>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Programação individual e histórico de concessões.
                </p>
              </div>

              {isManager && (
                <div className="flex gap-1.5 p-1 bg-white/[0.04] rounded-2xl border border-white/8 text-xs font-bold">
                  <button
                    onClick={() => setActiveTab("escala")}
                    className="px-4 py-2 rounded-xl transition-all cursor-pointer text-slate-400 hover:text-white"
                  >
                    Escala Anual de Férias
                  </button>
                  <button
                    onClick={() => setActiveTab("minhas")}
                    className="px-4 py-2 rounded-xl transition-all cursor-pointer bg-indigo-600 text-white shadow-lg"
                  >
                    Minhas Férias
                  </button>
                </div>
              )}
            </div>

            {/* Quando a escala estiver em rascunho ou retirada do ar (para colaborador comum) */}
            {!isManager && publicacao.status !== "PUBLICADA" ? (
              <div className="w-full max-w-3xl mx-auto py-12 px-6 rounded-[28px] border border-white/10 bg-[#0B1020]/72 backdrop-blur-xl text-center space-y-4 shadow-xl">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                  <Calendar className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">
                    A escala anual de férias ainda não foi publicada pelo RH.
                  </h3>
                  <p className="text-sm text-slate-400 max-w-md mx-auto">
                    Aguarde a divulgação ou entre em contato com o setor responsável.
                  </p>
                </div>
              </div>
            ) : (
              /* Quando publicada (ou gestor visualizando suas férias) */
              <div className="w-full max-w-5xl space-y-6">
                {/* Card Principal de Férias Previstas */}
                <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl space-y-6">
                  <div className="flex items-center justify-between border-b border-white/8 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                        <Briefcase className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Próximas Férias Previstas ({ano})
                        </span>
                        <h3 className="text-xl font-bold text-white">
                          {minhasFerias?.p1Inicio && minhasFerias?.p1Fim ? (
                            <span>
                              {minhasFerias.p1Inicio.split("-").reverse().join("/")} até{" "}
                              {minhasFerias.p1Fim.split("-").reverse().join("/")}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Nenhuma previsão cadastrada</span>
                          )}
                        </h3>
                      </div>
                    </div>

                    <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-400">
                      {minhasFerias?.totalDias || 0} DIAS
                    </span>
                  </div>

                  {minhasFerias?.p1Inicio ? (
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/8 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>1º Período:</span>
                        <span className="font-mono font-bold text-white">
                          {minhasFerias.p1Inicio.split("-").reverse().join("/")} a{" "}
                          {minhasFerias.p1Fim?.split("-").reverse().join("/")} ({minhasFerias.p1Dias} dias)
                        </span>
                      </div>
                      {minhasFerias.p2Inicio && (
                        <div className="flex items-center justify-between text-xs text-slate-300 border-t border-white/5 pt-2">
                          <span>2º Período:</span>
                          <span className="font-mono font-bold text-white">
                            {minhasFerias.p2Inicio.split("-").reverse().join("/")} a{" "}
                            {minhasFerias.p2Fim?.split("-").reverse().join("/")} ({minhasFerias.p2Dias} dias)
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/8 text-center">
                      <p className="text-sm text-slate-400 italic">
                        Seu período de férias ainda não foi cadastrado pelo RH.
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Entre em contato com o setor de Recursos Humanos para mais informações.
                      </p>
                    </div>
                  )}
                </div>

                {/* Histórico e Trilha de Alterações — Apenas se houver registros reais */}
                {feriasEventos.length > 0 && (
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
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
