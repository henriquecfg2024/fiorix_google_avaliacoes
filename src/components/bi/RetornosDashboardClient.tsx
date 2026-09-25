"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Search,
  Printer,
  FileDown,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  RefreshCw,
} from "lucide-react";
import { RetornoItem, ResponsavelContagem, RetornosResponse } from "@/lib/retornos/types";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function RetornosDashboardClient() {
  // Dados principais
  const [items, setItems] = useState<RetornoItem[]>([]);
  const [responsaveis, setResponsaveis] = useState<ResponsavelContagem[]>([]);
  const [kpis, setKpis] = useState({ total: 0, corrigidos: 0, semMarcador: 0 });
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [selectedAba, setSelectedAba] = useState<"ALL" | "PESSOAL" | "REAL" | "RECEPCAO">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClassificacao, setSelectedClassificacao] = useState<"ALL" | "CORRIGIDO" | "SEM_MARCADOR">("ALL");
  const [selectedResponsavelId, setSelectedResponsavelId] = useState<string | null>(null);
  const [showAllResponsaveis, setShowAllResponsaveis] = useState(false);
  const [sortResponsaveisBy, setSortResponsaveisBy] = useState<"maior" | "menor" | "nome">("maior");

  // Paginação e Ordenação da Tabela
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string>("dataRetorno");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modais
  const [selectedEvento, setSelectedEvento] = useState<RetornoItem | null>(null);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfScope, setPdfScope] = useState<"filtered" | "current">("filtered");
  const [pdfContentType, setPdfContentType] = useState<"resumido" | "detalhado">("resumido");
  const [includeResumoResponsavel, setIncludeResumoResponsavel] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [allFilteredItemsForPrint, setAllFilteredItemsForPrint] = useState<RetornoItem[] | null>(null);
  const [isLoadingPrintAll, setIsLoadingPrintAll] = useState(false);

  // Debounce da busca
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Carregamento de dados da API
  const fetchData = useCallback(async () => {
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        aba: selectedAba,
        classificacao: selectedClassificacao,
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
      });

      if (debouncedSearch) params.set("search", debouncedSearch);
      if (selectedResponsavelId) params.set("idResponsavel", selectedResponsavelId);

      const res = await fetch(`/api/bi/retornos/data?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: RetornosResponse = await res.json();
      if (!data.success) throw new Error("Falha ao obter dados");

      setItems(data.items || []);
      setKpis(data.kpis || { total: 0, corrigidos: 0, semMarcador: 0 });
      setResponsaveis(data.responsaveis || []);
      setLastSyncAt(data.lastSyncAt || null);
    } catch (err: unknown) {
      console.error("Erro ao carregar retornos:", err);
      toast.error("Erro ao carregar retornos. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedAba, selectedClassificacao, debouncedSearch, selectedResponsavelId, currentPage, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Limpar filtros
  const handleLimparFiltros = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedClassificacao("ALL");
    setSelectedResponsavelId(null);
    setSelectedAba("ALL");
    setCurrentPage(1);
  };

  // Alternar ordenação
  const handleHeaderSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  // Lista de responsáveis ordenada
  const orderedResponsaveis = useMemo(() => {
    const list = [...responsaveis];
    if (sortResponsaveisBy === "maior") {
      list.sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome));
    } else if (sortResponsaveisBy === "menor") {
      list.sort((a, b) => a.quantidade - b.quantidade || a.nome.localeCompare(b.nome));
    } else if (sortResponsaveisBy === "nome") {
      list.sort((a, b) => a.nome.localeCompare(b.nome));
    }
    return list;
  }, [responsaveis, sortResponsaveisBy]);

  const visibleResponsaveis = showAllResponsaveis ? orderedResponsaveis : orderedResponsaveis.slice(0, 4);

  // Formatação de data/hora
  const formatDateTime = (iso: string | null | undefined): { datePart: string; timePart: string; full: string } => {
    if (!iso) return { datePart: "-", timePart: "", full: "-" };
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return { datePart: String(iso), timePart: "", full: String(iso) };
      const datePart = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
      const timePart = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      return { datePart, timePart, full: `${datePart} ${timePart}` };
    } catch {
      return { datePart: String(iso), timePart: "", full: String(iso) };
    }
  };

  // GERAÇÃO DIRETA DE PDF (jspdf + jspdf-autotable)
  const handleGeneratePdf = async () => {
    setIsGeneratingPdf(true);
    try {
      // Determina os itens que irão para o PDF
      let exportItems: RetornoItem[] = [];
      if (pdfScope === "current") {
        exportItems = items;
      } else {
        // Busca todos os itens correspondentes aos filtros ativos (limite de segurança 2.500)
        const params = new URLSearchParams({
          aba: selectedAba,
          classificacao: selectedClassificacao,
          page: "1",
          pageSize: "2500",
          sortBy,
          sortOrder,
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (selectedResponsavelId) params.set("idResponsavel", selectedResponsavelId);

        const res = await fetch(`/api/bi/retornos/data?${params.toString()}`);
        const data: RetornosResponse = await res.json();
        exportItems = data.items || [];
      }

      if (exportItems.length === 0) {
        toast.error("Nenhum evento encontrado para gerar o PDF.");
        return;
      }

      const doc = new jsPDF({
        orientation: pdfContentType === "resumido" ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });

      const now = new Date();
      const dateFormatted = now.toLocaleDateString("pt-BR");
      const timeFormatted = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      // Cabeçalho institucional
      doc.setFontSize(14);
      doc.setTextColor(20, 25, 40);
      doc.text("FIORIX — GESTÃO DE PRAZOS", 14, 15);
      doc.setFontSize(11);
      doc.setTextColor(80, 90, 110);
      doc.text("Relatório Oficial de Retornos e Notas Devolutivas", 14, 21);

      doc.setFontSize(8);
      doc.text(`Emissão: ${dateFormatted} às ${timeFormatted} • Total de Eventos: ${exportItems.length}`, 14, 27);
      if (lastSyncAt) {
        const syncDate = new Date(lastSyncAt).toLocaleString("pt-BR");
        doc.text(`Última sincronização com WebRI: ${syncDate}`, 14, 31);
      }

      let startY = lastSyncAt ? 35 : 31;

      // Resumo de responsáveis (se selecionado)
      if (includeResumoResponsavel && responsaveis.length > 0) {
        doc.setFontSize(10);
        doc.setTextColor(20, 25, 40);
        doc.text("Resumo de Eventos sem Marcador de Correção por Destinatário (Tipos 292, 293 e 294):", 14, startY);

        const respTableRows = responsaveis.slice(0, 10).map((r) => [r.nome, r.quantidade.toString()]);
        autoTable(doc, {
          startY: startY + 2,
          head: [["Destinatário Responsável", "Qtd. Eventos"]],
          body: respTableRows,
          theme: "striped",
          headStyles: { fillColor: [40, 50, 70], textColor: [255, 255, 255], fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 1.5 },
          margin: { left: 14, right: 14 },
        });

        const autoTableDoc = doc as unknown as { lastAutoTable: { finalY: number } };
        startY = autoTableDoc.lastAutoTable.finalY + 8;
      }

      // Tabela de Itens (Resumida ou Detalhada)
      if (pdfContentType === "resumido") {
        const tableData = exportItems.map((item) => {
          const dt = formatDateTime(item.dataRetorno);
          return [
            item.numeroPrenotacao.toString(),
            item.formaTitulo || "-",
            `${item.familiaRetorno} (${item.siglaRetorno})`,
            dt.full,
            item.usuarioDestinoRetorno || "Não informado",
            item.usuarioOrigem || "-",
            item.classificacao,
          ];
        });

        autoTable(doc, {
          startY: startY,
          head: [["Prenotação", "Forma do Título", "Tipo / Sigla", "Data Retorno", "Destinatário", "Origem", "Classificação"]],
          body: tableData,
          theme: "grid",
          headStyles: { fillColor: [25, 33, 45], textColor: [255, 255, 255], fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2 },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 14, right: 14 },
          didDrawPage: (data) => {
            // Rodapé com numeração de página e aviso de conformidade
            const internalDoc = doc.internal as unknown as { getNumberOfPages: () => number };
            const pageCount = internalDoc.getNumberOfPages();
            doc.setFontSize(7);
            doc.setTextColor(120, 130, 140);
            doc.text(
              "A classificação se refere ao evento de retorno, não ao status atual do título. FIORIX Compliance.",
              14,
              doc.internal.pageSize.height - 8
            );
            doc.text(
              `Página ${data.pageNumber} de ${pageCount}`,
              doc.internal.pageSize.width - 30,
              doc.internal.pageSize.height - 8
            );
          },
        });
      } else {
        // Relatório detalhado com observações completas
        const tableData = exportItems.map((item) => {
          const dt = formatDateTime(item.dataRetorno);
          return [
            `Prenotação: ${item.numeroPrenotacao}\nRecepção: ${item.tipoRecepcao} (${item.formaTitulo || "Geral"})\nSeq: ${item.seqTitulo}`,
            `Retorno: ${item.tipoRetorno} [${item.siglaRetorno}]\nFamília: ${item.familiaRetorno}\nClassificação: ${item.classificacao}`,
            `Data: ${dt.full}\nDestinatário: ${item.usuarioDestinoRetorno}\nOrigem: ${item.usuarioOrigem}`,
            item.observacao || "Sem observação informada.",
          ];
        });

        autoTable(doc, {
          startY: startY,
          head: [["Título / Prenotação", "Tipo do Retorno", "Partes & Data", "Observação Completa"]],
          body: tableData,
          theme: "grid",
          headStyles: { fillColor: [25, 33, 45], textColor: [255, 255, 255], fontSize: 8 },
          styles: { fontSize: 7, cellPadding: 2.5 },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 40 },
            2: { cellWidth: 40 },
            3: { cellWidth: "auto" },
          },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 14, right: 14 },
          didDrawPage: (data) => {
            const internalDoc = doc.internal as unknown as { getNumberOfPages: () => number };
            const pageCount = internalDoc.getNumberOfPages();
            doc.setFontSize(7);
            doc.setTextColor(120, 130, 140);
            doc.text(
              "A classificação se refere ao evento de retorno, não ao status atual do título. FIORIX Compliance.",
              14,
              doc.internal.pageSize.height - 8
            );
            doc.text(
              `Página ${data.pageNumber} de ${pageCount}`,
              doc.internal.pageSize.width - 30,
              doc.internal.pageSize.height - 8
            );
          },
        });
      }

      // Download direto do arquivo PDF
      const nowIso = now.toISOString().slice(0, 16).replace("T", "_").replace(":", "-");
      doc.save(`FIORIX_Retornos_${nowIso}.pdf`);
      toast.success("PDF gerado e baixado com sucesso!");
      setIsPdfModalOpen(false);
    } catch (err: unknown) {
      console.error("Erro na geração do PDF:", err);
      toast.error("Falha ao gerar PDF. Tente novamente.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // IMPRESSÃO NATIVA — Garante a impressão SOMENTE da lista filtrada completa
  const handlePrint = async () => {
    if (kpis.total > items.length) {
      try {
        setIsLoadingPrintAll(true);
        toast.loading("Carregando lista completa de eventos filtrados para impressão...", { id: "loading-print" });
        const params = new URLSearchParams({
          aba: selectedAba,
          classificacao: selectedClassificacao,
          page: "1",
          pageSize: "2500",
          sortBy,
          sortOrder,
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (selectedResponsavelId) params.set("idResponsavel", selectedResponsavelId);

        const res = await fetch(`/api/bi/retornos/data?${params.toString()}`);
        const data: RetornosResponse = await res.json();
        setAllFilteredItemsForPrint(data.items || []);
        toast.dismiss("loading-print");
        setTimeout(() => {
          window.print();
          setTimeout(() => {
            setAllFilteredItemsForPrint(null);
            setIsLoadingPrintAll(false);
          }, 1500);
        }, 350);
        return;
      } catch {
        toast.dismiss("loading-print");
        setIsLoadingPrintAll(false);
      }
    }
    window.print();
  };

  // IMPRESSÃO DE FICHA DE PROTOCOLO INDIVIDUAL
  const printSingleProtocol = (item: RetornoItem) => {
    const printWindow = window.open("", "_blank", "width=850,height=700");
    if (!printWindow) {
      toast.error("Permita pop-ups no navegador para imprimir a ficha do protocolo.");
      return;
    }
    const dt = formatDateTime(item.dataRetorno);
    const safeObs = item.observacao
      ? item.observacao.replace(/</g, "&lt;").replace(/>/g, "&gt;")
      : "Sem observação informada.";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Ficha do Protocolo ${item.numeroPrenotacao} - Retorno</title>
        <style>
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 28px;
            color: #0f172a;
            background: #ffffff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 14px;
            margin-bottom: 20px;
          }
          .title { font-size: 20px; font-weight: 800; text-transform: uppercase; color: #0f172a; margin: 0; }
          .subtitle { font-size: 12px; color: #475569; margin-top: 4px; }
          .badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
            border: 1px solid #cbd5e1;
            background: ${item.classificacao === "Corrigido" ? "#ecfdf5; color: #065f46; border-color: #a7f3d0;" : "#f1f5f9; color: #334155;"}
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            margin-bottom: 18px;
          }
          .card {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 10px 14px;
            background: #f8fafc;
          }
          .label {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            font-weight: 600;
            margin-bottom: 3px;
          }
          .value {
            font-size: 13px;
            font-weight: 700;
            color: #0f172a;
          }
          .obs-box {
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 16px;
            background: #f8fafc;
            margin-top: 14px;
          }
          .obs-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #334155;
            margin-bottom: 8px;
          }
          .obs-content {
            font-size: 12px;
            line-height: 1.6;
            white-space: pre-wrap;
            color: #0f172a;
          }
          .footer {
            margin-top: 36px;
            padding-top: 12px;
            border-top: 1px dashed #cbd5e1;
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: #64748b;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1 class="title">7º Registro de Imóveis • FIORIX</h1>
            <div class="subtitle">Comprovante do Evento de Retorno • Prenotação ${item.numeroPrenotacao}</div>
          </div>
          <div class="badge">${item.classificacao}</div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="label">Prenotação / Protocolo</div>
            <div class="value">${item.numeroPrenotacao}</div>
          </div>
          <div class="card">
            <div class="label">Tipo de Recepção</div>
            <div class="value">${item.tipoRecepcao} (${item.formaTitulo || "Instrumento Geral"})</div>
          </div>
          <div class="card">
            <div class="label">Tipo de Retorno</div>
            <div class="value">${item.tipoRetorno} [${item.siglaRetorno}]</div>
          </div>
          <div class="card">
            <div class="label">Família do Retorno</div>
            <div class="value">${item.familiaRetorno}</div>
          </div>
          <div class="card">
            <div class="label">Data do Retorno</div>
            <div class="value">${dt.full}</div>
          </div>
          <div class="card">
            <div class="label">Título Sequencial</div>
            <div class="value">Título ${item.seqTitulo || 1}</div>
          </div>
          <div class="card">
            <div class="label">Destinatário Responsável</div>
            <div class="value">${item.usuarioDestinoRetorno}</div>
          </div>
          <div class="card">
            <div class="label">Usuário de Origem</div>
            <div class="value">${item.usuarioOrigem || "Não informado"}</div>
          </div>
        </div>

        <div class="obs-box">
          <div class="obs-title">Observação do Andamento</div>
          <div class="obs-content">${safeObs}</div>
        </div>

        <div class="footer">
          <span>FIORIX Gestão de Prazos • Emitido em ${new Date().toLocaleString("pt-BR")}</span>
          <span>ID Andamento: ${item.idAndamento}</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[#2C3748]/60 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#A4B1C4]">
            <span>GESTÃO DE PRAZOS</span>
            <span className="text-slate-600">/</span>
            <span className="text-[#93B3FF] font-semibold">Retornos</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-[#E6EDF7] uppercase">
              RETORNOS
            </h1>
            <span className="rounded-full border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 text-xs font-medium text-purple-300">
              Controle de Devoluções
            </span>
          </div>
          <p className="text-sm text-[#A4B1C4] mt-1">
            Retornos, responsáveis e observações dos títulos.
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#2C3748] bg-[#19212D] text-xs font-medium text-[#E6EDF7] hover:bg-[#233658] transition-colors focus:outline-none focus:ring-2 focus:ring-[#93B3FF]/40"
          >
            <Printer className="w-4 h-4 text-[#A4B1C4]" />
            <span>Imprimir</span>
          </button>
          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 text-xs font-semibold text-white shadow-lg hover:from-purple-500 hover:to-indigo-500 transition-all focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <FileDown className="w-4 h-4" />
            <span>Gerar PDF</span>
          </button>
        </div>
      </div>

      {/* 2. CARDS DE INDICADORES (KPIS) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
        {/* KPI 1: Eventos de retorno */}
        <div className="rounded-xl border border-[#2C3748] bg-[#19212D]/85 p-5 shadow-lg backdrop-blur-md">
          <div className="text-xs font-medium text-[#A4B1C4]">Eventos de retorno</div>
          <div className="mt-2 text-3xl font-extrabold text-[#E6EDF7]">
            {isLoading ? "..." : kpis.total.toLocaleString("pt-BR")}
          </div>
          <div className="mt-1 text-xs text-[#A4B1C4]/80">Resultados filtrados</div>
        </div>

        {/* KPI 2: Marcados como corrigidos */}
        <div className="rounded-xl border border-[#2C3748] bg-[#19212D]/85 p-5 shadow-lg backdrop-blur-md">
          <div className="text-xs font-medium text-[#A4B1C4]">Marcados como corrigidos</div>
          <div className="mt-2 text-3xl font-extrabold text-[#94DCB7]">
            {isLoading ? "..." : kpis.corrigidos.toLocaleString("pt-BR")}
          </div>
          <div className="mt-1 text-xs text-[#A4B1C4]/80">RTC · RPC · RRC</div>
        </div>

        {/* KPI 3: Sem marcador de correção */}
        <div className="rounded-xl border border-[#2C3748] bg-[#19212D]/85 p-5 shadow-lg backdrop-blur-md">
          <div className="text-xs font-medium text-[#A4B1C4]">Sem marcador de correção</div>
          <div className="mt-2 text-3xl font-extrabold text-[#E6EDF7]">
            {isLoading ? "..." : kpis.semMarcador.toLocaleString("pt-BR")}
          </div>
          <div className="mt-1 text-xs text-[#A4B1C4]/80">RTR · RPE · RRE</div>
        </div>
      </div>

      {/* 3. ABAS E BARRA DE FILTROS */}
      <div className="space-y-4 print:hidden">
        {/* Abas */}
        <div className="flex border-b border-[#2C3748]">
          {[
            { id: "ALL", label: "Todos" },
            { id: "PESSOAL", label: "Pessoal" },
            { id: "REAL", label: "Real" },
            { id: "RECEPCAO", label: "Tela de recepção" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedAba(tab.id as "ALL" | "PESSOAL" | "REAL" | "RECEPCAO");
                setCurrentPage(1);
              }}
              className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                selectedAba === tab.id
                  ? "border-purple-400 text-white font-semibold"
                  : "border-transparent text-[#A4B1C4] hover:text-[#E6EDF7]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Controles de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Campo Buscar */}
          <div className="md:col-span-6 space-y-1.5">
            <label className="text-xs text-[#A4B1C4]">Buscar</label>
            <div className="relative">
              <Search className="w-4 h-4 text-[#A4B1C4] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Prenotação, pessoa ou observação"
                className="w-full bg-[#10151E] border border-[#2C3748] rounded-lg pl-9 pr-3 py-2 text-xs text-[#E6EDF7] placeholder-[#A4B1C4]/60 focus:outline-none focus:ring-1 focus:ring-[#93B3FF] focus:border-[#93B3FF]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A4B1C4] hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Seletor Classificação */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs text-[#A4B1C4]">Classificação</label>
            <select
              value={selectedClassificacao}
              onChange={(e) => {
                setSelectedClassificacao(e.target.value as "ALL" | "CORRIGIDO" | "SEM_MARCADOR");
                setCurrentPage(1);
              }}
              className="w-full bg-[#10151E] border border-[#2C3748] rounded-lg px-3 py-2 text-xs text-[#E6EDF7] focus:outline-none focus:ring-1 focus:ring-[#93B3FF]"
            >
              <option value="ALL">Todas</option>
              <option value="CORRIGIDO">Corrigido</option>
              <option value="SEM_MARCADOR">Sem marcador de correção</option>
            </select>
          </div>

          {/* Botão Limpar */}
          <div className="md:col-span-2">
            <button
              onClick={handleLimparFiltros}
              className="w-full py-2 px-3 rounded-lg border border-[#2C3748] bg-[#19212D] text-xs font-medium text-[#A4B1C4] hover:text-white hover:bg-[#233658] transition-colors"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      {/* 4. CARD ERROS POR RESPONSÁVEL */}
      <div className="rounded-xl border border-[#2C3748] bg-[#19212D]/90 p-5 shadow-lg space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#E6EDF7]">Erros por responsável</h2>
            <p className="text-xs text-[#A4B1C4]">Eventos sem marcador de correção por destinatário</p>
          </div>

          {/* Dropdown de ordenação do card */}
          <div className="flex items-center gap-2">
            <select
              value={sortResponsaveisBy}
              onChange={(e) => setSortResponsaveisBy(e.target.value as "maior" | "menor" | "nome")}
              className="bg-[#10151E] border border-[#2C3748] rounded-lg px-2.5 py-1 text-xs text-[#E6EDF7] focus:outline-none"
            >
              <option value="maior">Maior quantidade</option>
              <option value="menor">Menor quantidade</option>
              <option value="nome">Nome (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Lista de Responsáveis */}
        {visibleResponsaveis.length === 0 ? (
          <div className="py-4 text-center text-xs text-[#A4B1C4] italic">
            Não há eventos sem marcador de correção nos filtros selecionados.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {visibleResponsaveis.map((resp) => {
              const isSelected = selectedResponsavelId === resp.id;
              const initials = resp.nome
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0].toUpperCase())
                .join("");

              return (
                <div
                  key={resp.id}
                  onClick={() => {
                    setSelectedResponsavelId(isSelected ? null : resp.id);
                    setCurrentPage(1);
                  }}
                  className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-[#233658] border-[#93B3FF] shadow-md ring-1 ring-[#93B3FF]"
                      : "bg-[#10151E] border-[#2C3748] hover:border-[#93B3FF]/40 hover:bg-[#161F2E]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#242C3D] flex items-center justify-center text-[11px] font-bold text-[#93B3FF] shrink-0">
                      {initials || "U"}
                    </div>
                    <span className="text-xs text-[#E6EDF7] font-medium truncate" title={resp.nome}>
                      {resp.nome}
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-[#E6EDF7] ml-2 shrink-0">
                    {resp.quantidade}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Ação de expandir / recolher responsáveis */}
        {orderedResponsaveis.length > 4 && (
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => setShowAllResponsaveis(!showAllResponsaveis)}
              className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors"
            >
              {showAllResponsaveis ? "Recolher lista" : `Ver todos os ${orderedResponsaveis.length} responsáveis`}
            </button>

            {selectedResponsavelId && (
              <button
                onClick={() => setSelectedResponsavelId(null)}
                className="text-xs text-[#93B3FF] hover:underline"
              >
                Limpar seleção do responsável
              </button>
            )}
          </div>
        )}

        {/* Nota explicativa de compliance */}
        <p className="text-[11px] text-[#A4B1C4]/80 italic pt-1">
          Contagem de eventos por destinatário: não indica autoria do erro nem quantidade de pendências.
        </p>
      </div>

      {/* 5. TABELA DE EVENTOS DE RETORNO */}
      <div className="rounded-xl border border-[#2C3748] bg-[#19212D]/90 shadow-lg overflow-hidden space-y-0 print:border-0 print:shadow-none print:bg-white print:rounded-none">
        {/* Cabeçalho na tela */}
        <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#2C3748]/60 print:hidden">
          <div>
            <h2 className="text-sm font-semibold text-[#E6EDF7]">Eventos de retorno</h2>
            <span className="text-xs text-[#A4B1C4]">
              {selectedResponsavelId
                ? `Filtrado por responsável`
                : `Todos os responsáveis`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isLoadingPrintAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2C3748] bg-[#10151E] text-xs font-medium text-[#E6EDF7] hover:bg-[#1E293B] hover:text-white transition-all shadow-sm focus:outline-none disabled:opacity-50"
              title="Imprimir lista completa de protocolos"
            >
              <Printer className="w-3.5 h-3.5 text-[#93B3FF]" />
              <span>{isLoadingPrintAll ? "Preparando..." : "Imprimir Lista"}</span>
            </button>
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-500/40 bg-purple-500/10 text-xs font-medium text-purple-300 hover:bg-purple-500/20 transition-all shadow-sm focus:outline-none"
              title="Gerar relatório PDF dos protocolos"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Gerar PDF</span>
            </button>
          </div>
        </div>

        {/* CABEÇALHO EXCLUSIVO PARA IMPRESSÃO (visível apenas na folha impressa ou PDF nativo) */}
        <div className="hidden print:block p-2 pb-3 mb-2 border-b-2 border-slate-900 bg-white text-slate-900">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tight text-slate-900 m-0">
                7º Registro de Imóveis • FIORIX
              </h1>
              <div className="text-xs text-slate-600 font-semibold mt-1">
                Relatório de Eventos de Retorno — Gestão de Prazos
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-600">
              <div>Emissão: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
              <div className="font-bold text-slate-900 mt-0.5">
                Total de Eventos: {kpis.total}
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-300 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-slate-700">
            <div>
              <span className="font-semibold text-slate-900">Família:</span>{" "}
              {selectedAba === "ALL" ? "Todas" : selectedAba === "RECEPCAO" ? "Tela de recepção" : selectedAba === "REAL" ? "Real" : "Pessoal"}
            </div>
            {selectedResponsavelId && (
              <div>
                <span className="font-semibold text-slate-900">Destinatário:</span>{" "}
                {responsaveis.find((r) => r.id === selectedResponsavelId)?.nome || selectedResponsavelId}
              </div>
            )}
            {selectedClassificacao !== "ALL" && (
              <div>
                <span className="font-semibold text-slate-900">Classificação:</span>{" "}
                {selectedClassificacao === "CORRIGIDO" ? "Corrigido" : "Sem marcador de correção"}
              </div>
            )}
            {searchQuery && (
              <div>
                <span className="font-semibold text-slate-900">Busca:</span> &ldquo;{searchQuery}&rdquo;
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto print:overflow-visible">
          <table className="w-full text-left text-xs text-[#E6EDF7] print:text-slate-900 print:text-[10px]">
            <thead className="bg-[#10151E] text-[#A4B1C4] uppercase text-[10px] tracking-wider border-b border-[#2C3748] print:bg-slate-100 print:text-slate-900 print:border-slate-400">
              <tr>
                <th
                  onClick={() => handleHeaderSort("numeroPrenotacao")}
                  className="px-4 py-3 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Prenotação</span>
                    {sortBy === "numeroPrenotacao" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-[#93B3FF]" /> : <ArrowDown className="w-3 h-3 text-[#93B3FF]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("tipoRetorno")}
                  className="px-4 py-3 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Tipo de retorno</span>
                    {sortBy === "tipoRetorno" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-[#93B3FF]" /> : <ArrowDown className="w-3 h-3 text-[#93B3FF]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("dataRetorno")}
                  className="px-4 py-3 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Data do retorno</span>
                    {sortBy === "dataRetorno" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-[#93B3FF]" /> : <ArrowDown className="w-3 h-3 text-[#93B3FF]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("usuarioDestino")}
                  className="px-4 py-3 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Destinatário</span>
                    {sortBy === "usuarioDestino" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-[#93B3FF]" /> : <ArrowDown className="w-3 h-3 text-[#93B3FF]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("classificacao")}
                  className="px-4 py-3 cursor-pointer hover:text-white transition-colors text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Classificação</span>
                    {sortBy === "classificacao" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-[#93B3FF]" /> : <ArrowDown className="w-3 h-3 text-[#93B3FF]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-right print:hidden">
                  <span>Ações</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2C3748]/50 print:divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#A4B1C4]">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-purple-400" />
                      <span>Carregando eventos de retorno...</span>
                    </div>
                  </td>
                </tr>
              ) : (allFilteredItemsForPrint || items).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-[#A4B1C4]">
                    Nenhum evento encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                (allFilteredItemsForPrint || items).map((item) => {
                  const dt = formatDateTime(item.dataRetorno);
                  const isCorrigido = item.classificacao === "Corrigido";

                  return (
                    <tr
                      key={item.idAndamento}
                      className="hover:bg-[#1C2636] transition-colors group print:border-b print:border-slate-300"
                    >
                      {/* Prenotação / Título */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedEvento(item)}
                          className="font-semibold text-purple-300 hover:text-purple-200 underline decoration-purple-400/50 hover:decoration-purple-300 text-left block print:text-slate-900 print:no-underline"
                        >
                          {item.numeroPrenotacao}
                        </button>
                        <span className="text-[11px] text-[#A4B1C4] print:text-slate-600 block truncate max-w-[200px]" title={item.formaTitulo}>
                          {item.formaTitulo || "Instrumento Geral"}
                        </span>
                      </td>

                      {/* Tipo de retorno */}
                      <td className="px-4 py-3">
                        <div className="text-xs text-[#E6EDF7] font-medium print:text-slate-900">{item.familiaRetorno}</div>
                        <div className="text-[11px] text-[#A4B1C4] print:text-slate-600">
                          {item.siglaRetorno} • Título {item.seqTitulo || 1}
                        </div>
                      </td>

                      {/* Data do retorno */}
                      <td className="px-4 py-3">
                        <div className="text-xs text-[#E6EDF7] print:text-slate-900">{dt.datePart}</div>
                        <div className="text-[11px] text-[#A4B1C4] print:text-slate-600">{dt.timePart}</div>
                      </td>

                      {/* Destinatário */}
                      <td className="px-4 py-3">
                        <div className="text-xs text-[#E6EDF7] font-medium print:text-slate-900">{item.usuarioDestinoRetorno}</div>
                        <div className="text-[11px] text-[#A4B1C4] print:text-slate-600">De: {item.usuarioOrigem}</div>
                      </td>

                      {/* Classificação */}
                      <td className="px-4 py-3 text-right">
                        {isCorrigido ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-[#173E31] text-[#94DCB7] border border-[#1E5241] print:bg-emerald-50 print:text-emerald-800 print:border-emerald-300">
                            <Check className="w-3 h-3" />
                            Corrigido
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-medium bg-[#242C3D] text-[#C5D1E0] border border-[#2C3748] print:bg-slate-100 print:text-slate-700 print:border-slate-300">
                            Sem marcador
                          </span>
                        )}
                      </td>

                      {/* Ações de Impressão do Protocolo */}
                      <td className="px-4 py-3 text-right print:hidden">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            printSingleProtocol(item);
                          }}
                          title={`Imprimir ficha da prenotação ${item.numeroPrenotacao}`}
                          className="px-2.5 py-1 rounded-lg border border-[#2C3748] bg-[#10151E] hover:bg-[#233658] text-[#A4B1C4] hover:text-[#93B3FF] transition-all inline-flex items-center gap-1.5 text-[11px] font-medium"
                        >
                          <Printer className="w-3.5 h-3.5 text-[#93B3FF]" />
                          <span>Imprimir</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="p-4 border-t border-[#2C3748]/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-[#A4B1C4] print:hidden">
          <div>
            Exibindo {items.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
            {Math.min(currentPage * pageSize, kpis.total)} de {kpis.total} eventos
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[#A4B1C4] text-[11px]">Exibir:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#10151E] border border-[#2C3748] rounded px-2 py-1 text-xs text-[#E6EDF7] focus:outline-none"
              >
                <option value={10}>10 / pág</option>
                <option value={20}>20 / pág</option>
                <option value={50}>50 / pág</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isLoading}
                className="px-2.5 py-1.5 rounded border border-[#2C3748] bg-[#10151E] disabled:opacity-40 hover:bg-[#233658] text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono">
                {currentPage} / {Math.ceil(kpis.total / pageSize) || 1}
              </span>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage >= Math.ceil(kpis.total / pageSize) || isLoading}
                className="px-2.5 py-1.5 rounded border border-[#2C3748] bg-[#10151E] disabled:opacity-40 hover:bg-[#233658] text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. MODAL DE DETALHES DO EVENTO */}
      {selectedEvento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in print:hidden">
          <div className="w-full max-w-2xl rounded-2xl border border-[#2C3748] bg-[#19212D] text-[#E6EDF7] shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C3748]">
              <div>
                <h3 className="text-lg font-bold text-white">
                  Detalhes do Retorno — Prenotação {selectedEvento.numeroPrenotacao}
                </h3>
                <p className="text-xs text-[#A4B1C4]">Id do Andamento: {selectedEvento.idAndamento}</p>
              </div>
              <button
                onClick={() => setSelectedEvento(null)}
                className="p-1 rounded-lg text-[#A4B1C4] hover:text-white hover:bg-[#2C3748]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-[#10151E] p-2.5 rounded-lg border border-[#2C3748]">
                <span className="text-[#A4B1C4] block text-[10px]">Id Recepção</span>
                <span className="font-semibold text-white">{selectedEvento.idRecepcao || "-"}</span>
              </div>
              <div className="bg-[#10151E] p-2.5 rounded-lg border border-[#2C3748]">
                <span className="text-[#A4B1C4] block text-[10px]">Data Recepção</span>
                <span className="font-semibold text-white">
                  {formatDateTime(selectedEvento.dataRecepcao).full || "-"}
                </span>
              </div>
              <div className="bg-[#10151E] p-2.5 rounded-lg border border-[#2C3748]">
                <span className="text-[#A4B1C4] block text-[10px]">Tipo Recepção</span>
                <span className="font-semibold text-white">{selectedEvento.tipoRecepcao}</span>
              </div>
              <div className="bg-[#10151E] p-2.5 rounded-lg border border-[#2C3748]">
                <span className="text-[#A4B1C4] block text-[10px]">Forma do Título</span>
                <span className="font-semibold text-white">{selectedEvento.formaTitulo || "Não informada"}</span>
              </div>
              <div className="bg-[#10151E] p-2.5 rounded-lg border border-[#2C3748]">
                <span className="text-[#A4B1C4] block text-[10px]">Tipo de Retorno</span>
                <span className="font-semibold text-white">
                  {selectedEvento.tipoRetorno} ({selectedEvento.siglaRetorno})
                </span>
              </div>
              <div className="bg-[#10151E] p-2.5 rounded-lg border border-[#2C3748]">
                <span className="text-[#A4B1C4] block text-[10px]">Classificação</span>
                <span
                  className={`font-semibold ${
                    selectedEvento.classificacao === "Corrigido" ? "text-[#94DCB7]" : "text-[#C5D1E0]"
                  }`}
                >
                  {selectedEvento.classificacao}
                </span>
              </div>
              <div className="bg-[#10151E] p-2.5 rounded-lg border border-[#2C3748]">
                <span className="text-[#A4B1C4] block text-[10px]">Data do Retorno</span>
                <span className="font-semibold text-white">
                  {formatDateTime(selectedEvento.dataRetorno).full}
                </span>
              </div>
              <div className="bg-[#10151E] p-2.5 rounded-lg border border-[#2C3748]">
                <span className="text-[#A4B1C4] block text-[10px]">Usuário Origem</span>
                <span className="font-semibold text-white">{selectedEvento.usuarioOrigem}</span>
              </div>
              <div className="bg-[#10151E] p-2.5 rounded-lg border border-[#2C3748]">
                <span className="text-[#A4B1C4] block text-[10px]">Destinatário do Retorno</span>
                <span className="font-semibold text-white">{selectedEvento.usuarioDestinoRetorno}</span>
              </div>
            </div>

            {/* Observação Completa */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#A4B1C4]">Observação do Andamento:</label>
              <div className="bg-[#10151E] border border-[#2C3748] rounded-xl p-4 text-xs text-[#E6EDF7] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {selectedEvento.observacao || "Sem observação informada."}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => printSingleProtocol(selectedEvento)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2C3748] bg-[#10151E] hover:bg-[#1E293B] text-xs font-semibold text-[#E6EDF7] hover:text-white transition-all shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 text-[#93B3FF]" />
                <span>Imprimir Ficha</span>
              </button>
              <button
                onClick={() => setSelectedEvento(null)}
                className="px-4 py-2 rounded-lg bg-[#242C3D] hover:bg-[#2C3748] text-xs font-medium text-white transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DE CONFIGURAÇÃO DE PDF */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in print:hidden">
          <div className="w-full max-w-lg rounded-2xl border border-[#2C3748] bg-[#19212D] text-[#E6EDF7] shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-[#2C3748]">
              <h3 className="text-base font-bold text-white">Configurar e Gerar PDF</h3>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="p-1 rounded-lg text-[#A4B1C4] hover:text-white hover:bg-[#2C3748]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Abrangência */}
              <div className="space-y-1.5">
                <label className="text-[#A4B1C4] font-medium">Abrangência</label>
                <select
                  value={pdfScope}
                  onChange={(e) => setPdfScope(e.target.value as "filtered" | "current")}
                  className="w-full bg-[#10151E] border border-[#2C3748] rounded-lg px-3 py-2 text-xs text-[#E6EDF7]"
                >
                  <option value="filtered">Todos os resultados filtrados ({kpis.total} eventos)</option>
                  <option value="current">Somente a página atual ({items.length} eventos)</option>
                </select>
              </div>

              {/* Tipo de Conteúdo */}
              <div className="space-y-1.5">
                <label className="text-[#A4B1C4] font-medium">Conteúdo do Relatório</label>
                <select
                  value={pdfContentType}
                  onChange={(e) => setPdfContentType(e.target.value as "resumido" | "detalhado")}
                  className="w-full bg-[#10151E] border border-[#2C3748] rounded-lg px-3 py-2 text-xs text-[#E6EDF7]"
                >
                  <option value="resumido">Listagem resumida (A4 Paisagem)</option>
                  <option value="detalhado">Relatório detalhado com observações completas (A4 Retrato)</option>
                </select>
              </div>

              {/* Checkbox Resumo por Responsável */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkResumo"
                  checked={includeResumoResponsavel}
                  onChange={(e) => setIncludeResumoResponsavel(e.target.checked)}
                  className="w-4 h-4 rounded border-[#2C3748] bg-[#10151E] text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="chkResumo" className="text-xs text-[#E6EDF7] cursor-pointer">
                  Incluir resumo de erros por responsável no relatório
                </label>
              </div>

              <div className="p-3 bg-[#10151E] rounded-lg border border-[#2C3748] text-[#A4B1C4] text-[11px]">
                {pdfScope === "filtered" ? kpis.total : items.length} eventos serão incluídos no arquivo PDF para download direto.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#2C3748]">
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-[#242C3D] hover:bg-[#2C3748] text-xs font-medium text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg disabled:opacity-50 transition-all"
              >
                {isGeneratingPdf ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Gerando PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Gerar e Baixar PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. RODAPÉ DE CONFORMIDADE E SINCRONIZAÇÃO */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#A4B1C4]/80 border-t border-[#2C3748]/30 print:hidden">
        <div>
          {lastSyncAt ? (
            <span>Última sincronização bem-sucedida: {new Date(lastSyncAt).toLocaleString("pt-BR")}</span>
          ) : (
            <span>Sincronização diária via FIORIXConnector</span>
          )}
        </div>
        <div>
          <span>A classificação se refere ao evento de retorno, não ao status atual do título.</span>
        </div>
      </div>
    </div>
  );
}
