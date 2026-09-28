"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Eye,
  Download,
  Lock,
  ChevronDown,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SecurePDFViewer } from "@/components/comunicados/SecurePDFViewer";

/** Tipagem do holerite retornado pela server action */
interface Holerite {
  id: string;
  mes: number;
  ano: number;
  arquivoNome: string;
  dataUpload: string;
}

/** Meses em português */
const MESES_PT = [
  "",
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

/**
 * Gera uma lista de anos relevantes para o seletor (atual + 4 anteriores).
 */
function getAnosDisponiveis(): number[] {
  const anoAtual = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => anoAtual - i);
}

export default function HoleritesPage() {
  const [selectedHolerite, setSelectedHolerite] = useState<{ mes: string; id: string } | null>(null);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [holerites, setHolerites] = useState<Holerite[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Colaborador");

  // Carrega holerites do ano selecionado
  const fetchHolerites = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/holerites?ano=${anoSelecionado}`);
      if (res.ok) {
        const data = await res.json();
        setHolerites(data.holerites || []);
        if (data.userName) setUserName(data.userName);
      } else {
        setHolerites([]);
      }
    } catch {
      setHolerites([]);
    } finally {
      setLoading(false);
    }
  }, [anoSelecionado]);

  useEffect(() => {
    fetchHolerites();
  }, [fetchHolerites]);

  const anosDisponiveis = getAnosDisponiveis();
  const holeritesFiltrados = holerites
    .filter((h) => h.ano === anoSelecionado)
    .sort((a, b) => b.mes - a.mes);

  const ultimoHolerite = holeritesFiltrados[0];

  const handleDownload = (holerite: Holerite) => {
    const a = document.createElement("a");
    a.href = `/api/holerites/${holerite.id}/download`;
    a.download = holerite.arquivoNome;
    a.click();
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-start bg-slate-50 dark:bg-[#070A12] text-slate-900 dark:text-white relative overflow-hidden pb-12 font-sans">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[90vw] max-w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/10 via-teal-500/8 to-cyan-500/8 blur-3xl opacity-60" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-5 py-6 sm:px-8 space-y-6">
        {/* ── Breadcrumb + Header ────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5 pb-4 border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Dashboard
            </Link>
            <span className="text-slate-600">/</span>
            <Link href="/pessoas" className="hover:text-white transition-colors">
              Pessoas
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-emerald-400 font-semibold">Holerites</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            MEUS HOLERITES
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Consulte e baixe seus comprovantes de pagamento com autenticidade garantida.
          </p>
        </div>

        {/* ── Cards de Indicadores / Resumo Executivo (Padrão FIORIX) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* KPI 1: Total do Ano */}
          <div className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Disponíveis no Ano
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                  ANO {anoSelecionado}
                </span>
              </div>
              <div className="text-2xl font-black text-white">
                {loading ? "..." : `${holeritesFiltrados.length} holerite${holeritesFiltrados.length !== 1 ? "s" : ""}`}
              </div>
              <p className="text-xs text-slate-400">Comprovantes liberados pelo RH</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-inner">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 2: Última Competência */}
          <div className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Última Competência
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  LIBERADO
                </span>
              </div>
              <div className="text-2xl font-black text-white truncate max-w-[200px]">
                {loading
                  ? "..."
                  : ultimoHolerite
                  ? `${MESES_PT[ultimoHolerite.mes]}/${ultimoHolerite.ano}`
                  : "Nenhuma"}
              </div>
              <p className="text-xs text-emerald-400/90 font-medium">
                {ultimoHolerite ? "Disponível para visualização" : "Aguardando próximo ciclo"}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 3: Segurança e Privacidade */}
          <div className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Privacidade LGPD
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-violet-500/15 text-violet-300 border border-violet-500/25">
                  ART. 464 CLT
                </span>
              </div>
              <div className="text-2xl font-black text-white">Acesso Pessoal</div>
              <p className="text-xs text-slate-400">Trilha de custódia e auditoria WORM</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-violet-500/15 border border-violet-500/30 text-violet-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* ── Card Principal (Padrão FIORIX) ─────────────────────────── */}
        <div className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 backdrop-blur-xl shadow-sm overflow-hidden">
          {/* Cabeçalho do Card */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-5 gap-4 border-b border-white/10 bg-[#0B1020]/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Holerites de {anoSelecionado}
                </h2>
                <p className="text-xs text-slate-400">
                  {holeritesFiltrados.length}{" "}
                  {holeritesFiltrados.length === 1 ? "documento registrado" : "documentos registrados"}
                </p>
              </div>
            </div>

            {/* Seletor de Ano */}
            <div className="relative">
              <select
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                className="appearance-none bg-[#080D1A] border border-white/15 text-white text-sm font-semibold rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-emerald-500/50 cursor-pointer transition-colors hover:bg-white/[0.04]"
              >
                {anosDisponiveis.map((ano) => (
                  <option key={ano} value={ano} className="bg-[#0B1020] text-white">
                    Ano {ano}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400 pointer-events-none" />
            </div>
          </div>

          {/* ── Conteúdo ─────────────────────────────────────────────── */}
          <div className="p-6">
            {loading ? (
              /* Loading State */
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                <p className="text-sm text-slate-400">Carregando holerites...</p>
              </div>
            ) : holeritesFiltrados.length === 0 ? (
              /* ── Estado Vazio ───────────────────────────────────────── */
              <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-inner">
                  <FileText className="w-10 h-10 text-emerald-400/80" />
                </div>
                <div className="space-y-2 max-w-md">
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Nenhum holerite disponível
                  </h3>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Quando o Departamento Pessoal disponibilizar seus comprovantes de {anoSelecionado}, eles aparecerão organizados aqui.
                  </p>
                </div>
              </div>
            ) : (
              /* ── Lista de Holerites ─────────────────────────────────── */
              <div className="space-y-3">
                {holeritesFiltrados.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4.5 rounded-2xl bg-[#080D1A] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all group shadow-xs"
                  >
                    {/* Info */}
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors truncate">
                          Competência: {MESES_PT[h.mes]} de {h.ano}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Disponibilizado em{" "}
                          {new Date(h.dataUpload).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>

                    {/* Status */}
                    <span className="hidden sm:inline-flex text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1 rounded-full shrink-0">
                      Disponível
                    </span>

                    {/* Ações */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() =>
                          setSelectedHolerite({
                            mes: `${String(h.mes).padStart(2, "0")}/${h.ano}`,
                            id: h.id,
                          })
                        }
                        className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs h-9 px-4 gap-1.5 rounded-xl shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Visualizar</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(h)}
                        className="border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-white text-xs h-9 px-3 gap-1.5 rounded-xl font-medium transition-all cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="sm:hidden">PDF</span>
                        <span className="hidden sm:inline">Baixar PDF</span>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Rodapé do Card ───────────────────────────────────────── */}
          <div className="px-6 py-3.5 border-t border-white/10 bg-[#0B1020]/80 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Somente você e o RH possuem autorização de acesso a estes documentos.</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">7º RI SP • SIGA/FIORIX</span>
          </div>
        </div>
      </div>

      {/* ── Visualizador de PDF Seguro ───────────────────────────────── */}
      {selectedHolerite && (
        <SecurePDFViewer
          documentTitle={`Holerite - Competência ${selectedHolerite.mes}`}
          documentType="holerite"
          documentId={selectedHolerite.id}
          fileUrl={`/api/holerites/${selectedHolerite.id}/download`}
          userName={userName}
          allowDownload={true}
          onClose={() => setSelectedHolerite(null)}
        />
      )}
    </div>
  );
}
