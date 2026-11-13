"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { escapeCsvCell } from "@/lib/security/csv-escape";
import {
  ShieldCheck,
  X,
  Download,
  Printer,
  Search,
  Loader2,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Copy,
  Check,
  Database,
  Scale,
  ScrollText,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  DossieCorregedoriaData,
  HoleriteArmazenadoRHItem,
  obterDossieCorregedoriaHoleritesAction,
} from "@/app/actions/holerites";

interface DossieCorregedoriaHoleritesModalProps {
  isOpen: boolean;
  initialAno: number;
  onClose: () => void;
  onInspectPdf: (item: HoleriteArmazenadoRHItem) => void;
}

type DossieTab = "mapa_anual" | "acervo_nominal" | "trilha_worm";

function escapeHtml(input: string | number | null | undefined): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function DossieCorregedoriaHoleritesModal({
  isOpen,
  initialAno,
  onClose,
  onInspectPdf,
}: DossieCorregedoriaHoleritesModalProps) {
  const [ano, setAno] = useState<number>(initialAno);
  const [loading, setLoading] = useState<boolean>(false);
  const [dossie, setDossie] = useState<DossieCorregedoriaData | null>(null);
  const [activeTab, setActiveTab] = useState<DossieTab>("mapa_anual");

  // Filtros do Banco de Dados Nominal
  const [searchQuery, setSearchQuery] = useState("");
  const [filtroAnoAcervo, setFiltroAnoAcervo] = useState<string>("TODOS");
  const [filtroMesAcervo, setFiltroMesAcervo] = useState<string>("TODOS");
  const [filtroTempestividade, setFiltroTempestividade] = useState<string>("TODOS");
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);

  const carregarDossie = useCallback(async (targetAno: number) => {
    setLoading(true);
    try {
      const data = await obterDossieCorregedoriaHoleritesAction(targetAno);
      setDossie(data);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao carregar o Dossiê de Rastreabilidade.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setAno(initialAno);
      carregarDossie(initialAno);
    }
  }, [isOpen, initialAno, carregarDossie]);

  const acervoFiltrado = useMemo(() => {
    if (!dossie) return [];
    const q = searchQuery.trim().toLowerCase();
    return dossie.acervoNominal.filter((item) => {
      if (filtroAnoAcervo !== "TODOS" && String(item.ano) !== filtroAnoAcervo) return false;
      if (filtroMesAcervo !== "TODOS" && String(item.mes) !== filtroMesAcervo) return false;
      if (filtroTempestividade === "NO_PRAZO" && !item.entregueNoPrazoClt) return false;
      if (filtroTempestividade === "APOS_PRAZO" && item.entregueNoPrazoClt) return false;
      if (filtroTempestividade === "CIENTES" && item.status !== "Ciente") return false;
      if (
        filtroTempestividade === "VISUALIZADOS" &&
        item.status !== "Visualizado" &&
        item.status !== "Ciente"
      )
        return false;
      if (
        filtroTempestividade === "NAO_VISUALIZADOS" &&
        (item.status === "Visualizado" || item.status === "Ciente")
      )
        return false;

      if (!q) return true;
      return (
        item.colaborador.toLowerCase().includes(q) ||
        (item.registroGestor != null && String(item.registroGestor).includes(q.replace(/^#/, ""))) ||
        (item.setor && item.setor.toLowerCase().includes(q)) ||
        item.cpfMascarado.toLowerCase().includes(q) ||
        item.mesAno.toLowerCase().includes(q) ||
        item.hash.toLowerCase().includes(q) ||
        item.arquivoNome.toLowerCase().includes(q)
      );
    });
  }, [dossie, searchQuery, filtroAnoAcervo, filtroMesAcervo, filtroTempestividade]);

  if (!isOpen) return null;

  const handleCopyHash = async (hash: string, key: string) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHashId(key);
      toast.success("Hash SHA-256 copiado para a área de transferência.");
      setTimeout(() => setCopiedHashId((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      toast.error("Não foi possível copiar o hash.");
    }
  };

  const handleExportCsvAuditavel = () => {
    if (!dossie) return;
    const fonte = acervoFiltrado.length > 0 ? acervoFiltrado : dossie.acervoNominal;
    const headers = [
      "Ano",
      "Competencia",
      "Tipo Folha",
      "Registro GESTOR",
      "Colaborador",
      "Setor",
      "CPF Mascarado (LGPD)",
      "Prazo Legal CLT",
      "Data Upload",
      "Tempestividade CLT",
      "Justificativa Atraso",
      "Enviado Por",
      "Status Ciencia Titular",
      "Acessos Titular",
      "1a Abertura Titular",
      "Ciencia Confirmada Em",
      "Protocolo Ciencia SHA-256",
      "Arquivo PDF",
      "Hash Criptografico SHA-256",
    ];

    const rows = fonte.map((r) =>
      [
        r.ano,
        r.mesAno,
        r.tipoFolha,
        r.registroGestor != null ? `#${r.registroGestor}` : "",
        r.colaborador,
        r.setor || "",
        r.cpfMascarado,
        r.prazoLegalCltBr,
        r.dataUpload,
        r.entregueNoPrazoClt ? "NO PRAZO CLT" : `APOS PRAZO (+${r.diasAtrasoClt}d)`,
        r.justificativaAtraso || "",
        r.uploadedBy,
        r.status,
        r.acessosTitular,
        r.primeiraVisualizacaoBr || "Pendente",
        r.cienciaConfirmadaEmBr || "Pendente",
        r.cienciaComprovanteHash || "",
        r.arquivoNome,
        r.hash,
      ]
        .map((v) => escapeCsvCell(v ?? ""))
        .join(";")
    );

    const csv = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dossie-corregedoria-holerites-${ano}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Planilha auditável exportada (${fonte.length} registros).`);
  };

  const handleImprimirCertidaoA4 = () => {
    if (!dossie) return;
    const win = window.open("", "_blank", "width=1100,height=850");
    if (!win) {
      toast.error("Permita janelas pop-up no navegador para gerar a certidão A4 de impressão.");
      return;
    }

    const linhasCompetencias = dossie.painelAno.competencias
      .map(
        (c) => `
        <tr>
          <td><strong>${escapeHtml(c.codigo)}</strong> — ${escapeHtml(c.titulo)}</td>
          <td>${escapeHtml(c.prazoClt.dataLimiteBr)}</td>
          <td style="text-align:center">${c.elegiveisCount}</td>
          <td style="text-align:center">${c.arquivadosCount}</td>
          <td style="text-align:center">${c.dispensadosCount}</td>
          <td style="text-align:center">${c.faltantesCount}</td>
          <td style="text-align:center">${c.noPrazoCount}/${c.arquivadosCount}</td>
          <td>${c.homologada
            ? `<strong>HOMOLOGADA</strong> (${escapeHtml(c.homologadoPorNome || "RH")})`
            : c.arquivadosCount > 0
              ? "Em custódia ativa"
              : "Sem envios"
          }</td>
        </tr>`
      )
      .join("");

    const fonteNominal = acervoFiltrado.length > 0 ? acervoFiltrado : dossie.acervoNominal;
    const linhasNominais = fonteNominal
      .map(
        (h) => `
        <tr>
          <td>${escapeHtml(h.mesAno)}</td>
          <td>${h.registroGestor != null ? `#${h.registroGestor} ` : ""}<strong>${escapeHtml(h.colaborador)}</strong></td>
          <td>${escapeHtml(h.cpfMascarado)}</td>
          <td>${escapeHtml(h.prazoLegalCltBr)}</td>
          <td>${escapeHtml(h.dataUpload)}</td>
          <td>${h.entregueNoPrazoClt ? "NO PRAZO CLT" : `APÓS PRAZO (+${h.diasAtrasoClt}d)`}</td>
          <td><strong>${escapeHtml(h.status)}</strong> (${h.acessosTitular} acesso(s))${
            h.cienciaConfirmadaEmBr
              ? `<br/><span style="font-size:9px">Ciência: ${escapeHtml(h.cienciaConfirmadaEmBr)}</span>`
              : h.primeiraVisualizacaoBr
              ? `<br/><span style="font-size:9px">1ª Abertura: ${escapeHtml(h.primeiraVisualizacaoBr)}</span>`
              : ""
          }</td>
          <td style="font-family:monospace;font-size:9px;word-break:break-all">${escapeHtml(h.hash)}${
            h.cienciaComprovanteHash
              ? `<br/><strong>Recibo:</strong> ${escapeHtml(h.cienciaComprovanteHash)}`
              : ""
          }</td>
        </tr>`
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Dossiê de Custódia e Conformidade Trabalhista — ${escapeHtml(dossie.serventiaNome)}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; font-size: 11px; line-height: 1.4; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title { font-size: 16px; font-weight: 800; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 11px; color: #334155; margin: 3px 0 0 0; }
    .meta-box { text-align: right; font-size: 10px; color: #334155; }
    .badge { display: inline-block; padding: 2px 6px; border: 1px solid #0f172a; font-weight: 700; font-size: 9px; border-radius: 4px; }
    h2 { font-size: 12px; text-transform: uppercase; border-left: 3px solid #0f172a; padding-left: 8px; margin: 16px 0 8px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.03em; }
    .protocol { margin-top: 16px; padding: 10px; border: 1px solid #94a3b8; background: #f8fafc; font-family: monospace; font-size: 10px; word-break: break-all; }
    .signatures { margin-top: 28px; display: flex; justify-content: space-around; text-align: center; }
    .sig-line { width: 280px; border-top: 1px solid #0f172a; padding-top: 5px; font-size: 10px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p class="title">${escapeHtml(dossie.serventiaNome)}</p>
      <p class="subtitle">DOSSIÊ DE RASTREABILIDADE TRABALHISTA (CLT ART. 459, § 1º & ART. 464) E CUSTÓDIA DIGITAL DE HOLERITES</p>
      <p class="subtitle">Conformidade Normativa: Provimento CNJ nº 213/2026 • LGPD (Lei nº 13.709/2018) • Fiscalização CGJ-SP / CNJ</p>
    </div>
    <div class="meta-box">
      <div><span class="badge">EXERCÍCIO BASE ${dossie.anoReferencia}</span></div>
      <div style="margin-top:4px">Emitido em: <strong>${escapeHtml(dossie.emitidoEmBr)}</strong></div>
      <div>Operador: <strong>${escapeHtml(dossie.emitidoPorNome)} (${escapeHtml(dossie.emitidoPorCargo)})</strong></div>
      <div>Localidade: ${escapeHtml(dossie.serventiaCidadeUf)}</div>
    </div>
  </div>

  <h2>1. Mapa Anual de Competências e Cumprimento do Prazo Legal CLT (${dossie.anoReferencia})</h2>
  <table>
    <thead>
      <tr>
        <th>Competência</th>
        <th>Prazo Legal CLT</th>
        <th style="text-align:center">Elegíveis</th>
        <th style="text-align:center">Arquivados</th>
        <th style="text-align:center">Dispensas</th>
        <th style="text-align:center">Faltantes</th>
        <th style="text-align:center">No Prazo CLT</th>
        <th>Situação / Fechamento</th>
      </tr>
    </thead>
    <tbody>${linhasCompetencias}</tbody>
  </table>

  <h2>2. Cadastro Nominal Auditável de Holerites Armazenados (${fonteNominal.length} documento(s) listado(s))</h2>
  <table>
    <thead>
      <tr>
        <th>Comp.</th>
        <th>Colaborador (GESTOR)</th>
        <th>CPF (LGPD)</th>
        <th>Limite CLT</th>
        <th>Data/Hora Upload</th>
        <th>Tempestividade</th>
        <th style="text-align:center">Acessos</th>
        <th>Hash SHA-256 de Custódia Imutável</th>
      </tr>
    </thead>
    <tbody>
      ${linhasNominais || '<tr><td colspan="8" style="text-align:center">Nenhum documento registrado para o filtro selecionado.</td></tr>'}
    </tbody>
  </table>

  <div class="protocol">
    <strong>PROTOCOLO CRIPTOGRÁFICO DE INTEGRIDADE DO DOSSIÊ (SHA-256 / TRILHA WORM):</strong><br/>
    ${escapeHtml(dossie.protocoloVerificacaoSha256)}
  </div>

  <div class="signatures">
    <div class="sig-line">Responsável Departamento Pessoal / RH<br/>${escapeHtml(dossie.serventiaNome)}</div>
    <div class="sig-line">Oficial / Administração da Serventia<br/>Conferência de Governança & Corregedoria</div>
  </div>

  <script>window.onload = function() { setTimeout(function() { window.print(); }, 250); };</script>
</body>
</html>`;

    win.document.open();
    win.document.write(html);
    win.document.close();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[1440px] max-h-[92vh] flex flex-col rounded-[24px] border border-white/15 bg-[#0B1020] shadow-2xl text-white overflow-hidden"
      >
        {/* Top Institutional Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 px-6 py-4 border-b border-white/10 bg-[#0E1528]">
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-indigo-500/15 border border-indigo-500/35 text-indigo-300 flex items-center justify-center shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Cadastro Anual & Mensal de Holerites · Dossiê Corregedoria
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  CGJ-SP • PROV. CNJ 213/2026
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                {dossie?.serventiaNome || "7º Oficial de Registro de Imóveis de São Paulo"} • Rastreabilidade nominal, tempestividade CLT (Art. 459 §1º) e custódia SHA-256
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <select
              aria-label="Selecionar exercício anual do dossiê"
              value={ano}
              onChange={(e) => {
                const nextAno = Number(e.target.value);
                setAno(nextAno);
                carregarDossie(nextAno);
              }}
              className="h-9 bg-[#080D1A] border border-white/15 rounded-xl px-3 text-xs font-bold text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer"
            >
              {(dossie?.painelAno.anosDisponiveis || [ano + 1, ano, ano - 1]).map((a) => (
                <option key={a} value={a} className="bg-[#0B1020] text-white">
                  Exercício {a}
                </option>
              ))}
            </select>

            <Button
              type="button"
              size="sm"
              onClick={handleExportCsvAuditavel}
              disabled={loading || !dossie}
              className="h-9 px-3.5 rounded-xl bg-emerald-600/20 border border-emerald-500/35 hover:bg-emerald-600/30 text-emerald-200 text-xs font-bold gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV Auditável</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleImprimirCertidaoA4}
              disabled={loading || !dossie}
              className="h-9 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1.5 shadow-sm cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Certidão Oficial (A4 / PDF)</span>
            </Button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Fechar dossiê"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-white/10 bg-[#0B1020]">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("mapa_anual")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "mapa_anual"
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/35"
                : "bg-[#080D1A] text-slate-400 border border-white/10 hover:text-white"
                }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>Mapa Anual & Plurianual (CLT)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("acervo_nominal")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "acervo_nominal"
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/35"
                : "bg-[#080D1A] text-slate-400 border border-white/10 hover:text-white"
                }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>
                Banco de Dados Nominal ({dossie ? dossie.acervoNominal.length : 0})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("trilha_worm")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "trilha_worm"
                ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/35"
                : "bg-[#080D1A] text-slate-400 border border-white/10 hover:text-white"
                }`}
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span>
                Trilha Imutável WORM ({dossie ? dossie.trilhaWormRecente.length : 0})
              </span>
            </button>
          </div>

          {dossie && (
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Protocolo: {dossie.protocoloVerificacaoSha256.slice(0, 18)}...</span>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-[#080D1A] space-y-5">
          {loading || !dossie ? (
            <div className="py-20 text-center space-y-3">
              <Loader2 className="w-7 h-7 text-cyan-400 animate-spin mx-auto" />
              <p className="text-xs text-slate-400">
                Consolidando banco anual/mensal, hashes SHA-256 e trilha WORM...
              </p>
            </div>
          ) : activeTab === "mapa_anual" ? (
            <div className="space-y-5">
              {/* Resumo Plurianual */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {dossie.resumoPlurianual.slice(0, 4).map((rp) => (
                  <button
                    key={rp.ano}
                    type="button"
                    onClick={() => {
                      setAno(rp.ano);
                      carregarDossie(rp.ano);
                    }}
                    className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${rp.ano === ano
                      ? "bg-cyan-500/10 border-cyan-500/40"
                      : "bg-[#0B1020] border-white/10 hover:border-white/20"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase text-slate-400">
                        Ano {rp.ano}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                        {rp.competenciasHomologadas}/14 homologadas
                      </span>
                    </div>
                    <div className="text-xl font-black text-white mt-1.5">
                      {rp.totalArquivos} PDF{rp.totalArquivos !== 1 ? "s" : ""} arquivado{rp.totalArquivos !== 1 ? "s" : ""}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      {rp.colaboradoresDistintos} colaboradores atendidos • {rp.totalNoPrazoClt} no prazo CLT
                    </div>
                  </button>
                ))}
              </div>

              {/* Tabela das 14 Competências do Exercício */}
              <div className="border border-white/10 rounded-2xl overflow-x-auto bg-[#0B1020]">
                <table className="w-full text-left text-xs min-w-[860px]">
                  <thead className="bg-[#0E1528] text-slate-400 uppercase font-mono text-[11px] border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 font-bold">Competência</th>
                      <th className="px-3.5 py-3 font-bold">Prazo Legal CLT</th>
                      <th className="px-3.5 py-3 font-bold text-center">Elegíveis</th>
                      <th className="px-3.5 py-3 font-bold text-center">Arquivados</th>
                      <th className="px-3.5 py-3 font-bold text-center">Dispensas</th>
                      <th className="px-3.5 py-3 font-bold text-center">Faltantes</th>
                      <th className="px-3.5 py-3 font-bold text-center">No Prazo CLT</th>
                      <th className="px-3.5 py-3 font-bold">Situação & Manifesto SHA-256</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8 text-slate-200">
                    {dossie.painelAno.competencias.map((c) => (
                      <tr key={c.mes} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <div className="font-bold text-white">{c.titulo}</div>
                          <div className="text-[11px] font-mono text-cyan-300">{c.codigo}</div>
                        </td>
                        <td className="px-3.5 py-3 font-mono whitespace-nowrap">
                          <div className="text-white font-semibold">{c.prazoClt.dataLimiteBr}</div>
                          {c.prazoClt.caiNoSabado && c.prazoClt.sextaBancariaRecomendadaBr && (
                            <div className="text-[10px] text-amber-300">
                              Sexta bancária: {c.prazoClt.sextaBancariaRecomendadaBr}
                            </div>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-center font-mono">{c.elegiveisCount}</td>
                        <td className="px-3.5 py-3 text-center font-mono font-bold text-cyan-300">
                          {c.arquivadosCount}
                        </td>
                        <td className="px-3.5 py-3 text-center font-mono text-slate-300">
                          {c.dispensadosCount}
                        </td>
                        <td className="px-3.5 py-3 text-center font-mono">
                          <span
                            className={
                              c.faltantesCount === 0
                                ? "text-emerald-400 font-bold"
                                : "text-amber-300 font-bold"
                            }
                          >
                            {c.faltantesCount}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-center font-mono">
                          {c.arquivadosCount > 0 ? (
                            <span
                              className={
                                c.foraDoPrazoCount === 0
                                  ? "text-emerald-400 font-bold"
                                  : "text-amber-300 font-bold"
                              }
                            >
                              {c.noPrazoCount}/{c.arquivadosCount}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                        <td className="px-3.5 py-3">
                          {c.homologada ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                <CheckCircle2 className="w-3 h-3" />
                                HOMOLOGADA ({c.homologadoPorNome})
                              </span>
                              {c.manifestHashSha256 && (
                                <div className="text-[10px] font-mono text-slate-400">
                                  SHA-256: {c.manifestHashSha256.slice(0, 20)}...
                                </div>
                              )}
                            </div>
                          ) : c.arquivadosCount > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              Em custódia ({c.percentualCobertura}% coberto)
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-500">Sem lançamentos</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeTab === "acervo_nominal" ? (
            <div className="space-y-4">
              {/* Barra de Busca e Filtros Multi-Critério */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 bg-[#0B1020] p-3.5 rounded-2xl border border-white/10">
                <div className="relative lg:col-span-2">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar colaborador, #registro, setor, CPF ou hash SHA-256..."
                    className="pl-9 h-9 bg-[#080D1A] border-white/15 text-xs text-white rounded-xl"
                  />
                </div>

                <select
                  aria-label="Filtrar por ano"
                  value={filtroAnoAcervo}
                  onChange={(e) => setFiltroAnoAcervo(e.target.value)}
                  className="h-9 bg-[#080D1A] border border-white/15 rounded-xl px-3 text-xs font-semibold text-white"
                >
                  <option value="TODOS">Todos os Anos</option>
                  {dossie.painelAno.anosDisponiveis.map((a) => (
                    <option key={a} value={String(a)}>
                      Ano {a}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar por competência"
                  value={filtroMesAcervo}
                  onChange={(e) => setFiltroMesAcervo(e.target.value)}
                  className="h-9 bg-[#080D1A] border border-white/15 rounded-xl px-3 text-xs font-semibold text-white"
                >
                  <option value="TODOS">Todas as Competências</option>
                  {dossie.painelAno.competencias.map((c) => (
                    <option key={c.mes} value={String(c.mes)}>
                      {c.sigla} — {c.titulo.split("/")[0].trim()}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filtrar por tempestividade CLT"
                  value={filtroTempestividade}
                  onChange={(e) => setFiltroTempestividade(e.target.value)}
                  className="h-9 bg-[#080D1A] border border-white/15 rounded-xl px-3 text-xs font-semibold text-white"
                >
                  <option value="TODOS">Todos os Status CLT</option>
                  <option value="NO_PRAZO">Entregues no Prazo CLT</option>
                  <option value="APOS_PRAZO">Entregues Após o Prazo</option>
                  <option value="CIENTES">Ciência Confirmada pelo Colaborador</option>
                  <option value="VISUALIZADOS">Visualizados / Cientes pelo Colaborador</option>
                  <option value="NAO_VISUALIZADOS">Pendentes de Visualização</option>
                </select>
              </div>

              {/* Tabela Nominal do Banco de Dados */}
              <div className="border border-white/10 rounded-2xl overflow-x-auto bg-[#0B1020]">
                <table className="w-full text-left text-xs min-w-[960px]">
                  <thead className="bg-[#0E1528] text-slate-400 uppercase font-mono text-[11px] border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3 font-bold">Competência</th>
                      <th className="px-3.5 py-3 font-bold">Colaborador</th>
                      <th className="px-3.5 py-3 font-bold">CPF (LGPD)</th>
                      <th className="px-3.5 py-3 font-bold">Limite CLT</th>
                      <th className="px-3.5 py-3 font-bold">Upload & Tempestividade</th>
                      <th className="px-3.5 py-3 font-bold">Ciência / Acessos</th>
                      <th className="px-3.5 py-3 font-bold">Hash SHA-256</th>
                      <th className="px-4 py-3 font-bold text-right">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8 text-slate-200">
                    {acervoFiltrado.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                          <FileText className="w-7 h-7 text-slate-600 mx-auto mb-2" />
                          Nenhum holerite encontrado no banco de dados para os critérios informados.
                        </td>
                      </tr>
                    ) : (
                      acervoFiltrado.map((h) => (
                        <tr key={h.id} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3 font-mono font-bold text-cyan-300 whitespace-nowrap">
                            {h.mesAno}
                          </td>
                          <td className="px-3.5 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white">{h.colaborador}</span>
                              {h.registroGestor != null && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                                  <Hash className="w-2.5 h-2.5" />
                                  {h.registroGestor}
                                </span>
                              )}
                            </div>
                            {h.setor && (
                              <div className="text-[11px] text-slate-400">{h.setor}</div>
                            )}
                          </td>
                          <td className="px-3.5 py-3 font-mono text-slate-300 whitespace-nowrap">
                            {h.cpfMascarado}
                          </td>
                          <td className="px-3.5 py-3 font-mono text-slate-300 whitespace-nowrap">
                            {h.prazoLegalCltBr}
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {h.entregueNoPrazoClt ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  NO PRAZO CLT
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  +{h.diasAtrasoClt}d APÓS PRAZO
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                              {h.dataUpload} • {h.uploadedBy}
                            </div>
                          </td>
                          <td className="px-3.5 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  h.status === "Ciente"
                                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                    : h.status === "Visualizado"
                                    ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                                    : "bg-slate-500/15 text-slate-300 border-slate-500/30"
                                }`}
                              >
                                {h.status}
                              </span>
                              <span className="font-mono font-bold text-white">
                                {h.acessosTitular}
                              </span>
                              <span className="text-[11px] text-slate-400">acesso(s)</span>
                            </div>
                            {h.cienciaConfirmadaEmBr ? (
                              <div className="text-[10px] font-mono text-emerald-400 mt-0.5">
                                Ciência: {h.cienciaConfirmadaEmBr}
                              </div>
                            ) : h.primeiraVisualizacaoBr ? (
                              <div className="text-[10px] font-mono text-indigo-300 mt-0.5">
                                1ª abertura: {h.primeiraVisualizacaoBr}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3.5 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <span title={h.hash}>{h.hash.slice(0, 14)}...</span>
                              <button
                                type="button"
                                onClick={() => handleCopyHash(h.hash, h.id)}
                                className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-white/8 cursor-pointer"
                                title="Copiar hash SHA-256 completo"
                              >
                                {copiedHashId === h.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onInspectPdf(h)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/25 text-[11px] font-bold cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Abrir</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {dossie.trilhaWormRecente.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-white/10 rounded-2xl bg-[#0B1020]">
                  Nenhum evento registrado na trilha WORM até o momento.
                </div>
              ) : (
                dossie.trilhaWormRecente.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 rounded-2xl border border-white/10 bg-[#0B1020]"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {ev.acao}
                        </span>
                        <span className="text-xs font-bold text-white">{ev.descricao}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Operador autenticado: <strong className="text-slate-200">{ev.usuarioNome}</strong>
                      </p>
                    </div>
                    <span className="text-xs font-mono text-slate-400 shrink-0">
                      {ev.dataHoraBr}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/10 bg-[#0E1528] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            Retenção legal mínima de 5 anos (CLT Art. 11 / Art. 464 e Provimento CNJ nº 213/2026) • CPFs protegidos por padrão (LGPD).
          </span>
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="h-8 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs cursor-pointer self-end sm:self-auto"
          >
            Fechar Dossiê
          </Button>
        </div>
      </div>
    </div>
  );
}
