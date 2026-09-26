"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { FileText, Eye, Download, Lock, ChevronDown, Loader2 } from "lucide-react";
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
  "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/**
 * Gera uma lista de anos relevantes para o seletor (atual + 4 anteriores).
 * Quando houver dados do backend, essa lista pode ser substituída pelos anos com registros.
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

  const handleDownload = (holerite: Holerite) => {
    const a = document.createElement("a");
    a.href = `/api/holerites/${holerite.id}/download`;
    a.download = holerite.arquivoNome;
    a.click();
  };

  return (
    <div className="w-full flex-1 flex flex-col justify-start bg-slate-50 dark:bg-[#070A12] text-slate-900 dark:text-white relative overflow-hidden pb-12">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[90vw] max-w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-violet-500/10 via-indigo-500/8 to-purple-500/6 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-5 py-6 sm:px-8 space-y-6">
        {/* ── Breadcrumb + Header ────────────────────────────────────── */}
        <div className="flex flex-col gap-1.5 pb-4 border-b border-slate-200 dark:border-white/6">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <span className="text-slate-600">/</span>
            <Link href="/pessoas" className="hover:text-white transition-colors">Pessoas</Link>
            <span className="text-slate-600">/</span>
            <span className="text-violet-400 font-semibold">Holerites</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            MEUS HOLERITES
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Consulte e baixe seus comprovantes de pagamento.
          </p>
        </div>

        {/* ── Card Principal ─────────────────────────────────────────── */}
        <div className="rounded-[22px] border border-slate-200 dark:border-white/8 bg-white dark:bg-gradient-to-br dark:from-[#0B1020]/80 dark:to-[#0E0A1C]/60 shadow-sm dark:shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl overflow-hidden">

          {/* Cabeçalho do Card */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-5 gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-violet-500/10 border border-violet-500/15 text-violet-400">
                <FileText className="w-5 h-5" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Holerites de {anoSelecionado}
              </h2>
            </div>

            {/* Seletor de Ano */}
            <div className="relative">
              <select
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                className="appearance-none bg-violet-500/10 border border-violet-500/20 text-slate-800 dark:text-white text-sm font-semibold rounded-xl px-4 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-violet-500/40 cursor-pointer transition-colors hover:bg-violet-500/15"
              >
                {anosDisponiveis.map((ano) => (
                  <option key={ano} value={ano} className="bg-[#0B1020] text-white">
                    {ano}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-violet-400 pointer-events-none" />
            </div>
          </div>

          {/* Divisor sutil */}
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/8 to-transparent" />

          {/* ── Conteúdo ─────────────────────────────────────────────── */}
          <div className="px-6 py-6">
            {loading ? (
              /* Loading State */
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                <p className="text-sm text-slate-400">Carregando holerites...</p>
              </div>
            ) : holeritesFiltrados.length === 0 ? (
              /* ── Estado Vazio ───────────────────────────────────────── */
              <div className="flex flex-col items-center justify-center py-16 gap-5">
                <div className="p-6 rounded-3xl bg-violet-500/8 border border-violet-500/10">
                  <FileText className="w-14 h-14 text-violet-400/70" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Nenhum holerite disponível
                  </h3>
                  <p className="text-sm text-slate-400 max-w-sm">
                    Quando o RH disponibilizar seus comprovantes, eles aparecerão aqui.
                  </p>
                </div>
              </div>
            ) : (
              /* ── Lista de Holerites ─────────────────────────────────── */
              <div className="space-y-3">
                {holeritesFiltrados.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/6 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                  >
                    {/* Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {MESES_PT[h.mes]} de {h.ano}
                        </p>
                        <p className="text-xs text-slate-400">
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
                    <span className="hidden sm:inline-flex text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-3 py-1 rounded-full shrink-0">
                      Disponível
                    </span>

                    {/* Ações */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => setSelectedHolerite({
                          mes: `${String(h.mes).padStart(2, "0")}/${h.ano}`,
                          id: h.id,
                        })}
                        className="bg-violet-600 hover:bg-violet-700 text-white text-xs h-8 px-4 gap-1.5 font-semibold rounded-xl shadow-md shadow-violet-500/20 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Visualizar</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(h)}
                        className="border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 text-xs h-8 px-3 gap-1.5 rounded-xl transition-all"
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

          {/* ── Rodapé discreto do card ──────────────────────────────── */}
          <div className="px-6 py-3 border-t border-slate-200 dark:border-white/5">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Somente você pode visualizar seus documentos.</span>
            </div>
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
