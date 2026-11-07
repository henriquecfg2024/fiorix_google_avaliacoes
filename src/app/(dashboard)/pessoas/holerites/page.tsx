"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  FileCheck2,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { SecurePDFViewer } from "@/components/comunicados/SecurePDFViewer";

/** Tipagem do holerite retornado pela API */
interface Holerite {
  id: string;
  mes: number;
  ano: number;
  arquivoNome: string;
  arquivoHash?: string;
  dataUpload: string;
  status?: "Ativo" | "Visualizado" | "Ciente";
  acessosTitular?: number;
  primeiraVisualizacaoEm?: string | null;
  cienciaConfirmadaEm?: string | null;
  cienciaComprovanteHash?: string | null;
}

/** Meses e parcelas do 13º salário em português */
const MESES_PT: Record<number, string> = {
  1: "Janeiro",
  2: "Fevereiro",
  3: "Março",
  4: "Abril",
  5: "Maio",
  6: "Junho",
  7: "Julho",
  8: "Agosto",
  9: "Setembro",
  10: "Outubro",
  11: "Novembro",
  12: "Dezembro",
  13: "13º Salário (1ª Parcela)",
  14: "13º Salário (2ª Parcela)",
};

function getAnosDisponiveis(): number[] {
  const anoAtual = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => anoAtual - i);
}

function escapeHtml(val: string | number | null | undefined): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function HoleritesPage() {
  const [selectedHolerite, setSelectedHolerite] = useState<{ mes: string; id: string } | null>(null);
  const [anoSelecionado, setAnoSelecionado] = useState(new Date().getFullYear());
  const [holerites, setHolerites] = useState<Holerite[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [userName, setUserName] = useState("Colaborador");

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
  const cientesNoAno = holeritesFiltrados.filter((h) => h.status === "Ciente").length;
  const pendentesCiencia = holeritesFiltrados.filter((h) => h.status !== "Ciente");
  const proximoPendenteCiencia = pendentesCiencia[0] || null;
  const holeriteAbertoObj = selectedHolerite
    ? holerites.find((h) => h.id === selectedHolerite.id) || null
    : null;

  const handleDownload = (holerite: Holerite) => {
    const a = document.createElement("a");
    a.href = `/api/holerites/${holerite.id}/download`;
    a.download = holerite.arquivoNome;
    a.click();
    setTimeout(() => fetchHolerites(), 1200);
  };

  const handleConfirmarCiencia = async (holerite: Holerite) => {
    setConfirmingId(holerite.id);
    try {
      const res = await fetch(`/api/holerites/${holerite.id}/ciencia`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Não foi possível confirmar o recebimento.");
        return;
      }
      toast.success(
        "Recebimento e ciência confirmados com protocolo criptográfico SHA-256."
      );
      await fetchHolerites();
    } catch {
      toast.error("Erro de comunicação ao registrar ciência.");
    } finally {
      setConfirmingId(null);
    }
  };

  const handleImprimirComprovantePessoal = (h: Holerite) => {
    const win = window.open("", "_blank", "width=850,height=780");
    if (!win) {
      toast.error("Permita janelas pop-up para imprimir o comprovante.");
      return;
    }
    const compNome = `${MESES_PT[h.mes] || `Mês ${h.mes}`} / ${h.ano}`;
    const dataLib = new Date(h.dataUpload).toLocaleString("pt-BR");
    const dataVis = h.primeiraVisualizacaoEm
      ? new Date(h.primeiraVisualizacaoEm).toLocaleString("pt-BR")
      : "—";
    const dataCiencia = h.cienciaConfirmadaEm
      ? new Date(h.cienciaConfirmadaEm).toLocaleString("pt-BR")
      : "Pendente de confirmação expressa";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comprovante Eletrônico de Recebimento e Ciência — ${escapeHtml(compNome)}</title>
  <style>
    @page { size: A4 portrait; margin: 16mm; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; padding: 12px; font-size: 12px; line-height: 1.5; }
    .hdr { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 18px; }
    .title { font-size: 16px; font-weight: 800; text-transform: uppercase; margin: 0; }
    .sub { font-size: 11px; color: #475569; margin: 4px 0 0 0; }
    .box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 14px; margin-bottom: 14px; background: #f8fafc; }
    .box h3 { margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #334155; letter-spacing: 0.04em; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
    .mono { font-family: Consolas, monospace; font-size: 10.5px; word-break: break-all; }
  </style>
</head>
<body>
  <div class="hdr">
    <p class="title">7º Oficial de Registro de Imóveis de São Paulo</p>
    <p class="sub">COMPROVANTE ELETRÔNICO DE DISPONIBILIZAÇÃO E CIÊNCIA DE DEMONSTRATIVO SALARIAL (CLT ART. 464 & MP Nº 2.200-2/2001)</p>
  </div>
  <div class="box">
    <h3>Identificação do Titular e Competência</h3>
    <div class="grid">
      <div><strong>Colaborador Titular:</strong> ${escapeHtml(userName)}</div>
      <div><strong>Competência:</strong> ${escapeHtml(compNome)}</div>
      <div><strong>Disponibilizado pelo RH em:</strong> ${escapeHtml(dataLib)}</div>
      <div><strong>1ª Abertura pelo Titular:</strong> ${escapeHtml(dataVis)}</div>
      <div><strong>Ciência Eletrônica Confirmada em:</strong> ${escapeHtml(dataCiencia)}</div>
      <div><strong>Situação Atual:</strong> ${escapeHtml(h.status || "Disponível")}</div>
    </div>
  </div>
  <div class="box">
    <h3>Integridade Criptográfica e Trilha Auditável (WORM)</h3>
    <p><strong>Hash SHA-256 do PDF Custodiado:</strong><br/><span class="mono">${escapeHtml(h.arquivoHash || "Verificado no servidor")}</span></p>
    <p><strong>Protocolo SHA-256 da Ciência Eletrônica:</strong><br/><span class="mono">${escapeHtml(h.cienciaComprovanteHash || "Aguardando confirmação expressa")}</span></p>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 250); };</script>
</body>
</html>`;
    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div className="w-full flex-1 min-h-full flex flex-col justify-start bg-[#070A12] text-white relative overflow-hidden pb-12 font-sans">
      {/* Ambient Glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[90vw] max-w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-cyan-500/8 to-emerald-500/8 blur-3xl opacity-60" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto w-full max-w-[1600px] px-5 py-6 sm:px-8 space-y-6">
        {/* BARRA DE NAVEGAÇÃO COMPACTA EM LINHA ÚNICA (PADRÃO FIORIX) */}
        <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">MEU ESPAÇO</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-extrabold tracking-wider">HOLERITES</span>
            <h1 className="sr-only">Meus Holerites — Comprovantes de Pagamento</h1>
          </div>
        </div>

        {/* ── Cards de Indicadores / Resumo Executivo (Padrão FIORIX) ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* KPI 1: Total do Ano */}
          <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Disponíveis no Ano
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                  ANO {anoSelecionado}
                </span>
              </div>
              <div className="text-2xl font-black text-white">
                {loading
                  ? "..."
                  : `${holeritesFiltrados.length} holerite${holeritesFiltrados.length !== 1 ? "s" : ""}`}
              </div>
              <p className="text-xs text-slate-400">Comprovantes liberados pelo RH</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-inner">
              <FileText className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 2: Última Competência */}
          <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Última Competência
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                  LIBERADO
                </span>
              </div>
              <div className="text-2xl font-black text-white truncate">
                {loading
                  ? "..."
                  : ultimoHolerite
                  ? `${MESES_PT[ultimoHolerite.mes] || `Mês ${ultimoHolerite.mes}`}/${ultimoHolerite.ano}`
                  : "Nenhuma"}
              </div>
              <p className="text-xs text-emerald-400/90 font-medium">
                {ultimoHolerite ? "Disponível para visualização e ciência" : "Aguardando próximo ciclo"}
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </div>

          {/* KPI 3: Confirmação de Recebimento e Privacidade */}
          <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Ciência Eletrônica
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                  ART. 464 CLT
                </span>
              </div>
              <div className="text-2xl font-black text-white">
                {loading
                  ? "..."
                  : `${cientesNoAno} / ${holeritesFiltrados.length} cientes`}
              </div>
              <p className="text-xs text-slate-400">Comprovante SHA-256 (MP 2.200-2/2001)</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* ── Card Dedicado: Confirmar Recebimento / Dar Ciência (Art. 464 CLT) ── */}
        {!loading && holeritesFiltrados.length > 0 && (
          <div
            className={`rounded-[24px] border p-5 sm:p-6 backdrop-blur-xl shadow-sm transition-all ${
              proximoPendenteCiencia
                ? "border-amber-500/35 bg-gradient-to-r from-amber-950/35 via-[#0B1020]/95 to-emerald-950/25"
                : "border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-[#0B1020]/95 to-[#0B1020]/95"
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                    proximoPendenteCiencia
                      ? "bg-amber-500/15 border-amber-500/35 text-amber-300"
                      : "bg-emerald-500/15 border-emerald-500/35 text-emerald-300"
                  }`}
                >
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base font-bold text-white">
                      {proximoPendenteCiencia
                        ? "Confirmação de Recebimento / Ciência Pendente"
                        : "Todos os Holerites do Ano com Ciência Confirmada"}
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                        proximoPendenteCiencia
                          ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      }`}
                    >
                      {proximoPendenteCiencia
                        ? `${pendentesCiencia.length} PENDENTE${pendentesCiencia.length > 1 ? "S" : ""}`
                        : "100% REGULAR (ART. 464 CLT)"}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {proximoPendenteCiencia ? (
                      <>
                        Seu demonstrativo de{" "}
                        <strong className="text-white">
                          {MESES_PT[proximoPendenteCiencia.mes] ||
                            `Mês ${proximoPendenteCiencia.mes}`}{" "}
                          de {proximoPendenteCiencia.ano}
                        </strong>{" "}
                        está disponível. Após conferir o documento, registre sua ciência eletrônica para emissão do protocolo criptográfico SHA-256.
                      </>
                    ) : (
                      <>
                        Seus demonstrativos de {anoSelecionado} possuem recibo eletrônico de ciência registrado na trilha auditável WORM.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {proximoPendenteCiencia ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setSelectedHolerite({
                          mes:
                            proximoPendenteCiencia.mes === 13
                              ? `13º (1ª)/${proximoPendenteCiencia.ano}`
                              : proximoPendenteCiencia.mes === 14
                              ? `13º (2ª)/${proximoPendenteCiencia.ano}`
                              : `${String(proximoPendenteCiencia.mes).padStart(2, "0")}/${proximoPendenteCiencia.ano}`,
                          id: proximoPendenteCiencia.id,
                        })
                      }
                      className="border-white/20 bg-white/[0.05] hover:bg-white/[0.1] text-white text-xs h-10 px-4 gap-2 rounded-xl font-semibold cursor-pointer"
                    >
                      <Eye className="w-4 h-4 text-cyan-400" />
                      <span>Abrir Holerite</span>
                    </Button>
                    <Button
                      size="sm"
                      disabled={confirmingId === proximoPendenteCiencia.id}
                      onClick={() => handleConfirmarCiencia(proximoPendenteCiencia)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 px-4 gap-2 rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      {confirmingId === proximoPendenteCiencia.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FileCheck2 className="w-4 h-4" />
                      )}
                      <span>Confirmar Recebimento / Ciente</span>
                    </Button>
                  </>
                ) : ultimoHolerite ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleImprimirComprovantePessoal(ultimoHolerite)}
                    className="border-emerald-500/35 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs h-10 px-4 gap-2 rounded-xl font-semibold cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Emitir Comprovante de Ciência (A4)</span>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* ── Card Principal (Padrão FIORIX) ─────────────────────────── */}
        <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 backdrop-blur-xl shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-5 gap-4 border-b border-white/10 bg-[#0B1020]/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Holerites de {anoSelecionado}
                </h2>
                <p className="text-xs text-slate-400">
                  {holeritesFiltrados.length}{" "}
                  {holeritesFiltrados.length === 1 ? "documento registrado" : "documentos registrados"} • Confirme o recebimento após conferir seu demonstrativo
                </p>
              </div>
            </div>

            {/* Seletor de Ano */}
            <div className="relative self-start sm:self-auto">
              <select
                value={anoSelecionado}
                onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                className="appearance-none bg-[#080D1A] border border-white/15 text-white text-sm font-semibold rounded-xl px-4 py-2.5 pr-10 focus:outline-none focus:border-cyan-500/50 cursor-pointer transition-colors hover:bg-white/[0.04]"
              >
                {anosDisponiveis.map((ano) => (
                  <option key={ano} value={ano} className="bg-[#0B1020] text-white">
                    Ano {ano}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 pointer-events-none" />
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                <p className="text-sm text-slate-400">Carregando holerites...</p>
              </div>
            ) : holeritesFiltrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-5 text-center">
                <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-inner">
                  <FileText className="w-10 h-10 text-cyan-400/80" />
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
              <div className="space-y-3">
                {holeritesFiltrados.map((h) => {
                  const labelComp =
                    h.mes === 13
                      ? `13º (1ª)/${h.ano}`
                      : h.mes === 14
                      ? `13º (2ª)/${h.ano}`
                      : `${String(h.mes).padStart(2, "0")}/${h.ano}`;
                  const isCiente = h.status === "Ciente";
                  const isVisualizado = h.status === "Visualizado";

                  return (
                    <div
                      key={h.id}
                      className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 p-4.5 rounded-2xl bg-[#080D1A] border border-white/10 hover:border-white/20 hover:bg-white/[0.04] transition-all group shadow-xs"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                              Competência: {MESES_PT[h.mes] || `Mês ${h.mes}`} de {h.ano}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                                isCiente
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                  : isVisualizado
                                  ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                                  : "bg-slate-500/15 text-slate-300 border-slate-500/30"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isCiente
                                    ? "bg-emerald-400"
                                    : isVisualizado
                                    ? "bg-indigo-400"
                                    : "bg-slate-400"
                                }`}
                              />
                              {isCiente
                                ? "Ciente Confirmado"
                                : isVisualizado
                                ? "Visualizado"
                                : "Disponível"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Disponibilizado em{" "}
                            {new Date(h.dataUpload).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                            {isCiente && h.cienciaConfirmadaEm && (
                              <span className="text-emerald-400/90 font-mono ml-2">
                                • Ciência em {new Date(h.cienciaConfirmadaEm).toLocaleString("pt-BR")}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() =>
                            setSelectedHolerite({
                              mes: labelComp,
                              id: h.id,
                            })
                          }
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-3.5 gap-1.5 rounded-xl shadow-sm transition-all cursor-pointer"
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
                          <span>Baixar PDF</span>
                        </Button>

                        {!isCiente ? (
                          <Button
                            size="sm"
                            disabled={confirmingId === h.id}
                            onClick={() => handleConfirmarCiencia(h)}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-3.5 gap-1.5 rounded-xl shadow-sm transition-all cursor-pointer"
                            title="Confirmar eletronicamente o recebimento deste demonstrativo de pagamento (Art. 464 CLT)"
                          >
                            {confirmingId === h.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <FileCheck2 className="w-3.5 h-3.5" />
                            )}
                            <span>Confirmar Recebimento</span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleImprimirComprovantePessoal(h)}
                            className="border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs h-9 px-3 gap-1.5 rounded-xl font-semibold transition-all cursor-pointer"
                            title="Imprimir ou salvar em PDF seu comprovante de ciência eletrônica"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Recibo Ciência</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-6 py-3.5 border-t border-white/10 bg-[#0B1020]/80 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Somente você e o RH possuem autorização de acesso a estes documentos (Art. 464 CLT & LGPD).</span>
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
          isCiente={holeriteAbertoObj?.status === "Ciente"}
          confirmingCiencia={confirmingId === selectedHolerite.id}
          onConfirmCiencia={
            holeriteAbertoObj ? () => handleConfirmarCiencia(holeriteAbertoObj) : undefined
          }
          onPrintComprovanteCiencia={
            holeriteAbertoObj
              ? () => handleImprimirComprovantePessoal(holeriteAbertoObj)
              : undefined
          }
          onClose={() => {
            setSelectedHolerite(null);
            fetchHolerites();
          }}
        />
      )}
    </div>
  );
}
