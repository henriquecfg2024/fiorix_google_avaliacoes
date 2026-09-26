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
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  MessageSquareText,
  Maximize2,
  Copy,
  ChevronDown,
  ChevronUp,
  Calendar,
  BarChart3,
  Clock,
  History,
  Filter,
} from "lucide-react";
import { RetornoItem, ResponsavelContagem, ResponsavelContagemCompleta, ErroMensal, RetornosResponse, RetornosKpis, TopCausa } from "@/lib/retornos/types";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function escapeHtml(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function RetornosDashboardClient() {
  // Dados principais
  const [items, setItems] = useState<RetornoItem[]>([]);
  const [responsaveis, setResponsaveis] = useState<ResponsavelContagem[]>([]);
  const [responsaveisCompleto, setResponsaveisCompleto] = useState<ResponsavelContagemCompleta[]>([]);
  const [errosMensais, setErrosMensais] = useState<ErroMensal[]>([]);
  const [kpis, setKpis] = useState<RetornosKpis>({
    total: 0,
    corrigidos: 0,
    semMarcador: 0,
    reingressos: 0,
    taxaRetrabalho: 0,
    tempoMedioDias: 0,
    taxaResolucao: 0,
  });
  const [topCausas, setTopCausas] = useState<TopCausa[]>([]);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [selectedAba, setSelectedAba] = useState<"ALL" | "PESSOAL" | "REAL" | "RECEPCAO">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClassificacao, setSelectedClassificacao] = useState<"ALL" | "CORRIGIDO" | "SEM_MARCADOR">("ALL");
  const [selectedResponsavelId, setSelectedResponsavelId] = useState<string | null>(null);
  const [selectedCausaId, setSelectedCausaId] = useState<string | null>(null);
  const [showAllResponsaveis, setShowAllResponsaveis] = useState(false);
  const [sortResponsaveisBy, setSortResponsaveisBy] = useState<"maior" | "menor" | "nome">("maior");

  // Filtro de período
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Paginação e Ordenação da Tabela
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string>("dataRetorno");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modais
  const [selectedEvento, setSelectedEvento] = useState<RetornoItem | null>(null);
  const [selectedObsModal, setSelectedObsModal] = useState<RetornoItem | null>(null);
  const [expandedObsIds, setExpandedObsIds] = useState<Set<string>>(new Set());

  const toggleExpandObs = (id: string) => {
    setExpandedObsIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/bi/retornos/data?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: RetornosResponse = await res.json();
      if (!data.success) throw new Error("Falha ao obter dados");

      setItems(data.items || []);
      setKpis(data.kpis || { total: 0, corrigidos: 0, semMarcador: 0, reingressos: 0, taxaRetrabalho: 0, tempoMedioDias: 0, taxaResolucao: 0 });
      setResponsaveis(data.responsaveis || []);
      setResponsaveisCompleto(data.responsaveisCompleto || []);
      setErrosMensais(data.errosMensais || []);
      setTopCausas(data.topCausas || []);
      setLastSyncAt(data.lastSyncAt || null);
    } catch (err: unknown) {
      console.error("Erro ao carregar retornos:", err);
      toast.error("Erro ao carregar retornos. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedAba, selectedClassificacao, debouncedSearch, selectedResponsavelId, currentPage, pageSize, sortBy, sortOrder, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Limpar filtros
  const handleLimparFiltros = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    setSelectedClassificacao("ALL");
    setSelectedResponsavelId(null);
    setSelectedCausaId(null);
    setSelectedAba("ALL");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  };

  // Mapeamento de palavras-chave para filtro local por causa
  const CAUSAS_KEYWORDS: Record<string, string[]> = useMemo(() => ({
    firma: ["firma", "reconhecimento", "assinatura", "procuraç", "procuracao", "poderes", "mandato", "representa", "semelhança", "semelhanca"],
    tributos: ["itbi", "tribut", "guia", "imposto", "recolhimento", "cnd", "certidão fiscal", "certidao fiscal", "valor venal", "darf"],
    certidoes: ["certidão", "certidao", "casamento", "óbito", "obito", "ausência", "ausencia", "falta", "comprovação", "comprovacao", "anexo", "apresentar", "complementar", "documento", "cópia", "copia"],
    divergencia: ["divergência", "divergencia", "matrícula", "matricula", "confrontaç", "confrontac", "planta", "lote", "memorial", "área", "area", "perimétrica", "perimetrica", "quadra", "descrição", "descricao"],
    qualificacao: ["qualificação", "qualificacao", "cpf", "rg", "estado civil", "regime de bens", "nacionalidade", "profissão", "profissao", "filiação", "filiacao", "nome", "solteiro", "casado"],
  }), []);

  // Itens filtrados (incluindo filtro por causa quando ativo)
  const displayedItems = useMemo(() => {
    const base = allFilteredItemsForPrint || items;
    if (!selectedCausaId) return base;
    const keywords = CAUSAS_KEYWORDS[selectedCausaId];
    if (!keywords) return base;
    return base.filter((item) => {
      const lower = (item.observacao || "").toLowerCase();
      return keywords.some((kw) => lower.includes(kw));
    });
  }, [allFilteredItemsForPrint, items, selectedCausaId, CAUSAS_KEYWORDS]);

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
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

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
      doc.text(`Emissão: ${dateFormatted} às ${timeFormatted} • Eventos: ${exportItems.length} • Retrabalho: ${(kpis.taxaRetrabalho || 0).toFixed(1)}% • Tempo Médio: ${kpis.tempoMedioDias || 0}d`, 14, 27);
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
            item.observacao ? (item.observacao.length > 50 ? item.observacao.slice(0, 48) + "..." : item.observacao) : "-",
            item.classificacao,
          ];
        });

        autoTable(doc, {
          startY: startY,
          head: [["Prenotação", "Forma do Título", "Tipo / Sigla", "Data Retorno", "Destinatário", "Origem", "Observação", "Classificação"]],
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
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

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
    const safeObs = escapeHtml(item.observacao || "Sem observação informada.");
    const safePrenotacao = escapeHtml(item.numeroPrenotacao);
    const safeClassificacao = escapeHtml(item.classificacao);
    const safeTipoRecepcao = escapeHtml(item.tipoRecepcao);
    const safeFormaTitulo = escapeHtml(item.formaTitulo || "Instrumento Geral");
    const safeTipoRetorno = escapeHtml(item.tipoRetorno);
    const safeSiglaRetorno = escapeHtml(item.siglaRetorno);
    const safeFamiliaRetorno = escapeHtml(item.familiaRetorno);
    const safeDataRetorno = escapeHtml(dt.full);
    const safeSeqTitulo = escapeHtml(item.seqTitulo || 1);
    const safeUsuarioDestino = escapeHtml(item.usuarioDestinoRetorno);
    const safeUsuarioOrigem = escapeHtml(item.usuarioOrigem || "Não informado");
    const safeIdAndamento = escapeHtml(item.idAndamento);

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Ficha do Protocolo ${safePrenotacao} - Retorno</title>
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
            <div class="subtitle">Comprovante do Evento de Retorno • Prenotação ${safePrenotacao}</div>
          </div>
          <div class="badge">${safeClassificacao}</div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="label">Prenotação / Protocolo</div>
            <div class="value">${safePrenotacao}</div>
          </div>
          <div class="card">
            <div class="label">Tipo de Recepção</div>
            <div class="value">${safeTipoRecepcao} (${safeFormaTitulo})</div>
          </div>
          <div class="card">
            <div class="label">Tipo de Retorno</div>
            <div class="value">${safeTipoRetorno} [${safeSiglaRetorno}]</div>
          </div>
          <div class="card">
            <div class="label">Família do Retorno</div>
            <div class="value">${safeFamiliaRetorno}</div>
          </div>
          <div class="card">
            <div class="label">Data do Retorno</div>
            <div class="value">${safeDataRetorno}</div>
          </div>
          <div class="card">
            <div class="label">Título Sequencial</div>
            <div class="value">Título ${safeSeqTitulo}</div>
          </div>
          <div class="card">
            <div class="label">Destinatário Responsável</div>
            <div class="value">${safeUsuarioDestino}</div>
          </div>
          <div class="card">
            <div class="label">Usuário de Origem</div>
            <div class="value">${safeUsuarioOrigem}</div>
          </div>
        </div>

        <div class="obs-box">
          <div class="obs-title">Observação do Andamento</div>
          <div class="obs-content">${safeObs}</div>
        </div>

        <div class="footer">
          <span>FIORIX Gestão de Prazos • Emitido em ${new Date().toLocaleString("pt-BR")}</span>
          <span>ID Andamento: ${safeIdAndamento}</span>
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-white/8 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-white/50">
            <span>GESTÃO DE PRAZOS</span>
            <span className="text-slate-400 dark:text-white/30">/</span>
            <span className="text-cyan-600 dark:text-cyan-300 font-semibold">Retornos</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white uppercase">
              RETORNOS
            </h1>
            <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-700 dark:text-cyan-300">
              Controle de Devoluções
            </span>
          </div>
          <p className="text-sm text-slate-500 dark:text-white/50 mt-1">
            Retornos, responsáveis e observações dos títulos.
          </p>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-xs font-medium text-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
          >
            <Printer className="w-4 h-4 text-slate-500 dark:text-white/70" />
            <span>Imprimir</span>
          </button>
          <button
            onClick={() => setIsPdfModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-xs font-semibold text-white shadow-lg hover:from-purple-500 hover:to-indigo-500 transition-all focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <FileDown className="w-4 h-4" />
            <span>Gerar PDF</span>
          </button>
        </div>
      </div>

      {/* 2. CARDS DE INDICADORES (KPIS) — PADRÃO FIORIX */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 print:hidden">
        {/* KPI 1: Eventos de retorno */}
        <div className="group relative flex min-h-[130px] flex-col justify-between overflow-hidden rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 p-5 shadow-sm shadow-sm backdrop-blur-xl transition-all hover:border-cyan-400/50">
          <div className="flex justify-between items-start w-full">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/55">
              Eventos de retorno
            </span>
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2 transition-all group-hover:brightness-110">
              <RotateCcw className="w-4 h-4 text-cyan-400" />
            </div>
          </div>
          <div className="mt-auto space-y-1">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#22D3EE]">
              {isLoading ? "..." : kpis.total.toLocaleString("pt-BR")}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
              Resultados no período
            </div>
          </div>
        </div>

        {/* KPI 2: Marcados como corrigidos */}
        <div className="group relative flex min-h-[130px] flex-col justify-between overflow-hidden rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 p-5 shadow-sm shadow-sm backdrop-blur-xl transition-all hover:border-emerald-400/50">
          <div className="flex justify-between items-start w-full">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/55">
              Corrigidos
            </span>
            <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/15 p-2 transition-all group-hover:brightness-110">
              <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            </div>
          </div>
          <div className="mt-auto space-y-1">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#10B981]">
              {isLoading ? "..." : kpis.corrigidos.toLocaleString("pt-BR")}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
              RTC · RPC · RRC {kpis.total > 0 ? `(${((kpis.corrigidos / kpis.total) * 100).toFixed(1)}%)` : ""}
            </div>
          </div>
        </div>

        {/* KPI 3: Sem marcador de correção */}
        <div className="group relative flex min-h-[130px] flex-col justify-between overflow-hidden rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 p-5 shadow-sm shadow-sm backdrop-blur-xl transition-all hover:border-amber-400/50">
          <div className="flex justify-between items-start w-full">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/55">
              Sem marcador
            </span>
            <div className="rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/15 p-2 transition-all group-hover:brightness-110">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            </div>
          </div>
          <div className="mt-auto space-y-1">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F59E0B]">
              {isLoading ? "..." : kpis.semMarcador.toLocaleString("pt-BR")}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
              RTR · RPE · RRE {kpis.total > 0 ? `(${((kpis.semMarcador / kpis.total) * 100).toFixed(1)}%)` : ""}
            </div>
          </div>
        </div>

        {/* KPI 4: Taxa de Retrabalho (Reingressos) */}
        <div className="group relative flex min-h-[130px] flex-col justify-between overflow-hidden rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 p-5 shadow-sm shadow-sm backdrop-blur-xl transition-all hover:border-purple-400/50">
          <div className="flex justify-between items-start w-full">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/55">
              Taxa retrabalho
            </span>
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/15 p-2 transition-all group-hover:brightness-110">
              <History className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <div className="mt-auto space-y-1">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#A855F7]">
              {isLoading ? "..." : `${(kpis.taxaRetrabalho || 0).toFixed(1)}%`}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
              {(kpis.reingressos || 0).toLocaleString("pt-BR")} reingressos na base
            </div>
          </div>
        </div>

        {/* KPI 5: Tempo Médio de Retorno */}
        <div className="group relative flex min-h-[130px] flex-col justify-between overflow-hidden rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 p-5 shadow-sm shadow-sm backdrop-blur-xl transition-all hover:border-blue-400/50">
          <div className="flex justify-between items-start w-full">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/55">
              Tempo médio
            </span>
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/15 p-2 transition-all group-hover:brightness-110">
              <Clock className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <div className="mt-auto space-y-1">
            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#3B82F6]">
              {isLoading ? "..." : (kpis.tempoMedioDias > 0 ? `${kpis.tempoMedioDias}d` : "—")}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-[#9CA3AF]">
              Ciclo médio até a devolução
            </div>
          </div>
        </div>
      </div>

      {/* 3. ABAS E BARRA DE FILTROS */}
      <div className="space-y-4 print:hidden">
        {/* Abas */}
        <div className="flex border-b border-white/8 bg-slate-100 dark:bg-[#0B1020]/40 rounded-t-xl px-2">
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
                  ? "border-cyan-500 dark:border-cyan-400 text-cyan-700 dark:text-cyan-300 font-bold bg-white dark:bg-white/[0.03]"
                  : "border-transparent text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white/80"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Controles de Filtros */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            {/* Campo Buscar */}
            <div className="md:col-span-4 space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-white/50 font-medium">Buscar</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 dark:text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Prenotação, pessoa ou observação..."
                  className="w-full bg-white dark:bg-[#0C1323] border border-slate-200 dark:border-white/8 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-white/35 shadow-sm focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filtro de Período - Data Início */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-white/50 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                De
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white dark:bg-[#0C1323] border border-slate-200 dark:border-white/8 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400"
              />
            </div>

            {/* Filtro de Período - Data Fim */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-white/50 font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Até
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-white dark:bg-[#0C1323] border border-slate-200 dark:border-white/8 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400"
              />
            </div>

            {/* Seletor Classificação */}
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs text-slate-500 dark:text-white/50 font-medium">Classificação</label>
              <select
                value={selectedClassificacao}
                onChange={(e) => {
                  setSelectedClassificacao(e.target.value as "ALL" | "CORRIGIDO" | "SEM_MARCADOR");
                  setCurrentPage(1);
                }}
                className="w-full bg-white dark:bg-[#0C1323] border border-slate-200 dark:border-white/8 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white shadow-sm focus:outline-none focus:ring-1 focus:ring-cyan-400 focus:border-cyan-400"
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
                className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-white/8 bg-slate-100 dark:bg-white/[0.04] text-xs font-medium text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors"
              >
                Limpar
              </button>
            </div>
          </div>

          {/* Indicadores de filtros ativos */}
          <div className="flex flex-wrap items-center gap-2">
            {(dateFrom || dateTo) && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 w-fit">
                <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span className="text-xs text-cyan-800 dark:text-cyan-200 font-medium">
                  Período: {dateFrom ? new Date(dateFrom + "T00:00:00").toLocaleDateString("pt-BR") : "início"} — {dateTo ? new Date(dateTo + "T00:00:00").toLocaleDateString("pt-BR") : "hoje"}
                </span>
                <button
                  onClick={() => { setDateFrom(""); setDateTo(""); setCurrentPage(1); }}
                  className="text-cyan-600 dark:text-cyan-400 hover:text-slate-900 dark:hover:text-white transition-colors ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {selectedCausaId && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 w-fit">
                <Filter className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span className="text-xs text-purple-800 dark:text-purple-200 font-medium">
                  Causa: {topCausas.find((c) => c.id === selectedCausaId)?.nome || selectedCausaId}
                </span>
                <button
                  onClick={() => { setSelectedCausaId(null); setCurrentPage(1); }}
                  className="text-purple-600 dark:text-purple-400 hover:text-slate-900 dark:hover:text-white transition-colors ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4A. CARD — ERROS MÊS A MÊS */}
      <div className="rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-5 print:hidden">
        {/* Cabeçalho do Card */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Erros mês a mês
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 mt-1">
              Erros registrados e corrigidos por mês • 2026
            </p>
          </div>
          {errosMensais.length > 0 && (
            <div className="text-right">
              <div className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 font-medium">Total no período</div>
              <div className="text-3xl sm:text-4xl font-extrabold text-cyan-600 dark:text-[#22D3EE] tracking-tight">
                {errosMensais.reduce((s, m) => s + m.total, 0).toLocaleString("pt-BR")}
              </div>
            </div>
          )}
        </div>

        {errosMensais.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400 dark:text-white/40 italic">
            Nenhum dado mensal disponível para o período selecionado.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Legenda Centralizada */}
            <div className="flex items-center justify-center gap-6 sm:gap-8 pt-1 pb-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-white/90">Total</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-white/90">Corrigidos</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F97316]" />
                <span className="text-xs sm:text-sm font-medium text-slate-700 dark:text-white/90">Sem marcador</span>
              </div>
            </div>

            {/* Lista de Barras por Mês */}
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {errosMensais.map((m) => {
                const percCorrigidos = m.total > 0 ? (m.corrigidos / m.total) * 100 : 0;
                const percSemMarcador = m.total > 0 ? (m.semMarcador / m.total) * 100 : 0;

                return (
                  <div key={m.mes} className="flex items-center gap-3 sm:gap-4 group">
                    {/* Rótulo do Mês */}
                    <span className="text-base sm:text-lg font-medium text-slate-700 dark:text-white/90 w-16 sm:w-20 text-right shrink-0">
                      {m.mesLabel}
                    </span>

                    {/* Barra Empilhada em Pílula */}
                    <div className="flex-1 h-11 sm:h-12 rounded-full overflow-hidden flex items-center bg-slate-100 dark:bg-[#131927] border border-slate-200 dark:border-white/5 shadow-inner relative">
                      {/* Segmento Corrigidos (Verde Esmeralda) */}
                      {m.corrigidos > 0 && (
                        <div
                          className="h-full bg-[#10B981] flex items-center justify-center transition-all duration-500 hover:brightness-110"
                          style={{ width: `${percCorrigidos}%` }}
                          title={`${m.corrigidos} corrigidos (${percCorrigidos.toFixed(1)}%)`}
                        >
                          <span className="text-white font-extrabold text-sm sm:text-base drop-shadow-sm select-none">
                            {m.corrigidos}
                          </span>
                        </div>
                      )}

                      {/* Segmento Sem Marcador (Laranja Vibrante) */}
                      {m.semMarcador > 0 && (
                        <div
                          className="h-full bg-[#F97316] flex items-center justify-center transition-all duration-500 hover:brightness-110"
                          style={{ width: `${percSemMarcador}%` }}
                          title={`${m.semMarcador} sem marcador (${percSemMarcador.toFixed(1)}%)`}
                        >
                          <span className="text-white font-extrabold text-sm sm:text-base drop-shadow-sm select-none">
                            {m.semMarcador}
                          </span>
                        </div>
                      )}

                      {/* Caso ambos sejam 0 */}
                      {m.total === 0 && (
                        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 dark:text-white/40">
                          0
                        </div>
                      )}
                    </div>

                    {/* Total numérico à direita */}
                    <span className="text-base sm:text-lg font-bold text-slate-800 dark:text-white/80 w-10 sm:w-12 text-left shrink-0 pl-1">
                      {m.total}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Rodapé explicativo */}
            <div className="pt-2 border-t border-white/8">
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-white/45">
                Barra empilhada: Total = Corrigidos + Sem marcador • Valores exibem contagens mensais
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 4B. CARD — TOP CAUSAS DE EXIGÊNCIA & RETORNO — PADRÃO FIORIX */}
      <div className="rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-5 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                Top causas de exigência
              </h2>
              <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
                Análise de Causa Raiz
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 mt-1">
              Classificação semântica dos motivos de notas devolutivas e reingressos
            </p>
          </div>

          {topCausas.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/8 px-3.5 py-2 rounded-2xl text-xs">
              <span className="text-slate-500 dark:text-white/50">Principal fator:</span>
              <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: topCausas[0].cor }} />
                {topCausas[0].nome} ({topCausas[0].percentual}%)
              </span>
            </div>
          )}
        </div>

        {/* Grid de Causas com Barras de Progresso e Filtro Clicável */}
        {topCausas.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-white/40 italic">
            Nenhuma exigência identificada no período selecionado.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {topCausas.map((causa) => {
                const isSelected = selectedCausaId === causa.id;

                return (
                  <div
                    key={causa.id}
                    onClick={() => {
                      setSelectedCausaId(isSelected ? null : causa.id);
                      setCurrentPage(1);
                    }}
                    className={`group p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-400 dark:border-cyan-400/60 ring-2 ring-cyan-400/40 shadow-md"
                        : "bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/6 hover:border-slate-300 dark:hover:border-white/20 hover:bg-slate-100/70 dark:hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: causa.cor }} />
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                          {causa.nome}
                        </span>
                      </div>
                      <span
                        className="text-xs font-mono font-bold px-2 py-0.5 rounded-full shrink-0"
                        style={{ backgroundColor: `${causa.cor}18`, color: causa.cor }}
                      >
                        {causa.percentual}%
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-500 dark:text-white/50 line-clamp-1">
                      {causa.descricao}
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${causa.percentual}%`, backgroundColor: causa.cor }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10.5px]">
                        <span className="text-slate-500 dark:text-white/60 font-medium">
                          <strong>{causa.quantidade}</strong> títulos afetados
                        </span>
                        <span className={`font-semibold ${isSelected ? "text-cyan-600 dark:text-cyan-300" : "text-slate-400 dark:text-white/40 group-hover:text-slate-700 dark:group-hover:text-white/70"}`}>
                          {isSelected ? "Filtro ativo ✓" : "Filtrar"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Banner explicativo quando filtro por causa está ativo */}
            {selectedCausaId && (
              <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-xs">
                <div className="flex items-center gap-2 text-cyan-800 dark:text-cyan-200">
                  <Filter className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>
                    Filtrando tabela por causa: <strong>{topCausas.find((c) => c.id === selectedCausaId)?.nome}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCausaId(null)}
                  className="text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:underline"
                >
                  Remover filtro de causa
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4C. CARD ERROS POR RESPONSÁVEL — PADRÃO FIORIX */}
      <div className="rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 p-6 shadow-sm backdrop-blur-xl space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">Erros por responsável</h2>
            <p className="text-xs text-slate-500 dark:text-white/50">Eventos sem marcador de correção por destinatário</p>
          </div>

          {/* Dropdown de ordenação do card */}
          <div className="flex items-center gap-2">
            <select
              value={sortResponsaveisBy}
              onChange={(e) => setSortResponsaveisBy(e.target.value as "maior" | "menor" | "nome")}
              className="bg-white dark:bg-[#0C1323] border border-slate-200 dark:border-white/8 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-white shadow-sm focus:outline-none focus:border-cyan-400"
            >
              <option value="maior">Maior quantidade</option>
              <option value="menor">Menor quantidade</option>
              <option value="nome">Nome (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Lista de Responsáveis */}
        {visibleResponsaveis.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 dark:text-white/40 italic">
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
                  className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-400 dark:border-cyan-400/50 ring-1 ring-cyan-400/50 shadow-md"
                      : "bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/8 hover:border-cyan-400/60 dark:hover:border-white/20 hover:bg-slate-100/80 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-[11px] font-bold text-cyan-600 dark:text-[#22D3EE] shrink-0">
                      {initials || "U"}
                    </div>
                    <span className="text-xs text-slate-800 dark:text-white/90 font-medium truncate uppercase" title={resp.nome.toUpperCase()}>
                      {resp.nome.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-extrabold text-slate-900 dark:text-white ml-2 shrink-0 px-2 py-0.5 rounded-lg bg-slate-200/70 dark:bg-white/[0.06] border border-slate-300/80 dark:border-white/10 font-mono">
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
              className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
            >
              {showAllResponsaveis ? "Recolher lista" : `Ver todos os ${orderedResponsaveis.length} responsáveis`}
            </button>

            {selectedResponsavelId && (
              <button
                onClick={() => setSelectedResponsavelId(null)}
                className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Limpar seleção do responsável
              </button>
            )}
          </div>
        )}

        {/* Nota explicativa de compliance */}
        <p className="text-[11px] text-slate-400 dark:text-white/40 italic pt-1">
          Contagem de eventos por destinatário: não indica autoria do erro nem quantidade de pendências.
        </p>
      </div>

      {/* 5. TABELA DE EVENTOS DE RETORNO — PADRÃO FIORIX */}
      <div className="rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 shadow-sm backdrop-blur-xl overflow-hidden space-y-0 print:border-0 print:shadow-none print:bg-white print:rounded-none">
        {/* Cabeçalho na tela */}
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-white/8 print:hidden">
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white">Eventos de retorno</h2>
            <span className="text-xs text-slate-500 dark:text-white/50">
              {selectedResponsavelId
                ? `Filtrado por responsável`
                : `Todos os responsáveis`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={isLoadingPrintAll}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] text-xs font-medium text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-all shadow-sm focus:outline-none disabled:opacity-50"
              title="Imprimir lista completa de protocolos"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-white/70" />
              <span>{isLoadingPrintAll ? "Preparando..." : "Imprimir Lista"}</span>
            </button>
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/15 text-xs font-semibold text-cyan-700 dark:text-cyan-200 hover:bg-cyan-500/25 transition-all shadow-sm focus:outline-none"
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
                Total: {kpis.total} • Retrabalho: {(kpis.taxaRetrabalho || 0).toFixed(1)}% • Tempo Médio: {kpis.tempoMedioDias || 0}d
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
          <table className="w-full text-left text-xs text-slate-900 dark:text-white print:text-slate-900 print:text-[10px]">
            <thead className="bg-slate-50 dark:bg-[#0B1020]/95 text-slate-600 dark:text-[#9CA3AF] uppercase text-[10px] tracking-wider border-b border-white/8 print:bg-slate-100 print:text-slate-900 print:border-slate-400">
              <tr>
                <th
                  onClick={() => handleHeaderSort("numeroPrenotacao")}
                  className="px-4 py-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Prenotação</span>
                    {sortBy === "numeroPrenotacao" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-cyan-500 dark:text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("tipoRetorno")}
                  className="px-4 py-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Tipo de retorno</span>
                    {sortBy === "tipoRetorno" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-cyan-500 dark:text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("dataRetorno")}
                  className="px-4 py-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Data do retorno</span>
                    {sortBy === "dataRetorno" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-cyan-500 dark:text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("usuarioDestino")}
                  className="px-4 py-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Destinatário</span>
                    {sortBy === "usuarioDestino" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-cyan-500 dark:text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleHeaderSort("observacao")}
                  className="px-4 py-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors min-w-[260px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Observação</span>
                    {sortBy === "observacao" ? (
                      sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-cyan-500 dark:text-cyan-400" /> : <ArrowDown className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/8 print:divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-500 dark:text-white/50">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-cyan-500 dark:text-cyan-400" />
                      <span>Carregando eventos de retorno...</span>
                    </div>
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-xs text-slate-400 dark:text-white/40">
                    Nenhum evento encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                displayedItems.map((item) => {
                  const dt = formatDateTime(item.dataRetorno);

                  return (
                    <tr
                      key={item.idAndamento}
                      className="hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors group print:border-b print:border-slate-300"
                    >
                      {/* Prenotação / Título */}
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedEvento(item)}
                          className="font-semibold text-cyan-600 dark:text-[#22D3EE] hover:text-cyan-700 dark:hover:text-cyan-300 underline decoration-cyan-500/40 hover:decoration-cyan-400 text-left block print:text-slate-900 print:no-underline"
                        >
                          {item.numeroPrenotacao}
                        </button>
                        <span className="text-[11px] text-slate-500 dark:text-white/45 print:text-slate-600 block truncate max-w-[200px]" title={item.formaTitulo}>
                          {item.formaTitulo || "Instrumento Geral"}
                        </span>
                      </td>

                      {/* Tipo de retorno */}
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-900 dark:text-white font-medium print:text-slate-900">{item.familiaRetorno}</div>
                        <div className="text-[11px] text-slate-500 dark:text-white/45 print:text-slate-600">
                          {item.siglaRetorno} • Título {item.seqTitulo || 1}
                        </div>
                      </td>

                      {/* Data do retorno */}
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-800 dark:text-white print:text-slate-900">{dt.datePart}</div>
                        <div className="text-[11px] text-slate-500 dark:text-white/45 print:text-slate-600">{dt.timePart}</div>
                      </td>

                      {/* Destinatário */}
                      <td className="px-4 py-3">
                        <div className="text-xs text-slate-900 dark:text-white font-medium print:text-slate-900">{item.usuarioDestinoRetorno}</div>
                        <div className="text-[11px] text-slate-500 dark:text-white/45 print:text-slate-600">De: {item.usuarioOrigem}</div>
                      </td>

                      {/* Observação com Prévia (2 linhas) + Expansão inline e Pop-up */}
                      <td className="px-4 py-3 min-w-[260px]">
                        {item.observacao ? (
                          <div className="space-y-1">
                            <p
                              className={`text-xs text-slate-700 dark:text-white/80 leading-relaxed print:text-slate-800 ${
                                expandedObsIds.has(item.idAndamento)
                                  ? "whitespace-pre-wrap break-words"
                                  : "line-clamp-2"
                              }`}
                              title={!expandedObsIds.has(item.idAndamento) ? item.observacao : undefined}
                            >
                              {item.observacao}
                            </p>
                            {item.observacao.length > 65 && (
                              <div className="flex items-center gap-2 print:hidden pt-0.5">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpandObs(item.idAndamento);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
                                >
                                  {expandedObsIds.has(item.idAndamento) ? (
                                    <>
                                      <ChevronUp className="w-3 h-3" />
                                      <span>Recolher</span>
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="w-3 h-3" />
                                      <span>Ver mais</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedObsModal(item);
                                  }}
                                  title="Abrir observação completa em pop-up"
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-slate-400 dark:text-white/45 hover:text-cyan-600 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-[10.5px]"
                                >
                                  <Maximize2 className="w-3 h-3" />
                                  <span>Pop-up</span>
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-[#6B7280] italic print:text-slate-400">
                            Sem observação
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="p-4 border-t border-slate-200 dark:border-white/8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-500 dark:text-white/50 print:hidden">
          <div>
            Exibindo {displayedItems.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}–
            {Math.min(currentPage * pageSize, selectedCausaId ? displayedItems.length : kpis.total)} de {selectedCausaId ? displayedItems.length : kpis.total} eventos
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 dark:text-white/40 text-[11px]">Exibir:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-[#0C1323] border border-slate-200 dark:border-white/8 rounded-xl px-2 py-1 text-xs text-slate-800 dark:text-white focus:outline-none"
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
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/[0.04] disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-mono text-slate-700 dark:text-white/80">
                {currentPage} / {Math.ceil(kpis.total / pageSize) || 1}
              </span>
              <button
                onClick={() => setCurrentPage((p) => p + 1)}
                disabled={currentPage >= Math.ceil(kpis.total / pageSize) || isLoading}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/8 bg-slate-50 dark:bg-white/[0.04] disabled:opacity-40 hover:bg-slate-100 dark:hover:bg-white/[0.08] text-slate-700 dark:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. MODAL EXCLUSIVO DE OBSERVAÇÃO DO PROTOCOLO */}
      {selectedObsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in print:hidden">
          <div className="w-full max-w-xl rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 text-slate-900 dark:text-white shadow-2xl backdrop-blur-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-white/8">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300">
                    Protocolo {selectedObsModal.numeroPrenotacao}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-white/50">
                    {selectedObsModal.tipoRetorno} [{selectedObsModal.siglaRetorno}]
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1.5 flex items-center gap-2">
                  <MessageSquareText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  <span>Observação do Retorno</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/45 mt-0.5">
                  Destinatário: <strong className="text-slate-800 dark:text-white/80">{selectedObsModal.usuarioDestinoRetorno}</strong> • De: {selectedObsModal.usuarioOrigem}
                </p>
              </div>
              <button
                onClick={() => setSelectedObsModal(null)}
                className="p-1.5 rounded-xl text-slate-400 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-white/45">
                Conteúdo da Observação
              </span>
              <div className="bg-[#080D1A] border border-white/20 rounded-xl p-4 text-xs text-slate-900 dark:text-white/95 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto font-sans selection:bg-cyan-500/30">
                {selectedObsModal.observacao || "Sem observação informada."}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedObsModal.observacao) {
                      navigator.clipboard.writeText(selectedObsModal.observacao);
                      toast.success("Observação copiada para a área de transferência!");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-xs font-medium text-slate-700 dark:text-white transition-all shadow-sm"
                >
                  <Copy className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  <span>Copiar texto</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const item = selectedObsModal;
                    setSelectedObsModal(null);
                    setSelectedEvento(item);
                  }}
                  className="text-xs text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:underline px-2 py-1"
                >
                  Ver ficha completa
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedObsModal(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.10] text-xs font-medium text-slate-700 dark:text-white transition-colors border border-slate-200 dark:border-white/10"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DE DETALHES DO EVENTO — PADRÃO FIORIX */}
      {selectedEvento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in print:hidden">
          <div className="w-full max-w-2xl rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 text-slate-900 dark:text-white shadow-2xl backdrop-blur-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-white/8">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Detalhes do Retorno — Prenotação {selectedEvento.numeroPrenotacao}
                </h3>
                <p className="text-xs text-slate-500 dark:text-white/45">Id do Andamento: {selectedEvento.idAndamento}</p>
              </div>
              <button
                onClick={() => setSelectedEvento(null)}
                className="p-1.5 rounded-xl text-slate-400 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 dark:bg-[#0C1323] p-3 rounded-xl border border-slate-200 dark:border-white/8">
                <span className="text-slate-400 dark:text-white/45 block text-[10px] uppercase font-semibold tracking-wider">Id Recepção</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedEvento.idRecepcao || "-"}</span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0C1323] p-3 rounded-xl border border-slate-200 dark:border-white/8">
                <span className="text-slate-400 dark:text-white/45 block text-[10px] uppercase font-semibold tracking-wider">Data Recepção</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatDateTime(selectedEvento.dataRecepcao).full || "-"}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0C1323] p-3 rounded-xl border border-slate-200 dark:border-white/8">
                <span className="text-slate-400 dark:text-white/45 block text-[10px] uppercase font-semibold tracking-wider">Tipo Recepção</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedEvento.tipoRecepcao}</span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0C1323] p-3 rounded-xl border border-slate-200 dark:border-white/8">
                <span className="text-slate-400 dark:text-white/45 block text-[10px] uppercase font-semibold tracking-wider">Forma do Título</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedEvento.formaTitulo || "Não informada"}</span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0C1323] p-3 rounded-xl border border-slate-200 dark:border-white/8">
                <span className="text-slate-400 dark:text-white/45 block text-[10px] uppercase font-semibold tracking-wider">Tipo de Retorno</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {selectedEvento.tipoRetorno} ({selectedEvento.siglaRetorno})
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0C1323] p-3 rounded-xl border border-slate-200 dark:border-white/8">
                <span className="text-slate-400 dark:text-white/45 block text-[10px] uppercase font-semibold tracking-wider">Classificação</span>
                <span
                  className={`font-semibold ${
                    selectedEvento.classificacao === "Corrigido" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-600 dark:text-white/70"
                  }`}
                >
                  {selectedEvento.classificacao}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0C1323] p-3 rounded-xl border border-slate-200 dark:border-white/8">
                <span className="text-slate-400 dark:text-white/45 block text-[10px] uppercase font-semibold tracking-wider">Data do Retorno</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {formatDateTime(selectedEvento.dataRetorno).full}
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0C1323] p-3 rounded-xl border border-slate-200 dark:border-white/8">
                <span className="text-slate-400 dark:text-white/45 block text-[10px] uppercase font-semibold tracking-wider">Usuário Origem</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedEvento.usuarioOrigem}</span>
              </div>
              <div className="bg-slate-50 dark:bg-[#0C1323] p-3 rounded-xl border border-slate-200 dark:border-white/8">
                <span className="text-slate-400 dark:text-white/45 block text-[10px] uppercase font-semibold tracking-wider">Destinatário do Retorno</span>
                <span className="font-semibold text-slate-900 dark:text-white">{selectedEvento.usuarioDestinoRetorno}</span>
              </div>
            </div>

            {/* Observação Completa */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-white/50">Observação do Andamento:</label>
              <div className="bg-[#080D1A] border border-white/20 rounded-xl p-4 text-xs text-slate-800 dark:text-white/90 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                {selectedEvento.observacao || "Sem observação informada."}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => printSingleProtocol(selectedEvento)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] hover:bg-slate-200 dark:hover:bg-white/[0.08] text-xs font-semibold text-slate-700 dark:text-white transition-all shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>Imprimir Ficha</span>
              </button>
              <button
                onClick={() => setSelectedEvento(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.10] text-xs font-medium text-slate-700 dark:text-white transition-colors border border-slate-200 dark:border-white/10"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL DE CONFIGURAÇÃO DE PDF — PADRÃO FIORIX */}
      {isPdfModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in print:hidden">
          <div className="w-full max-w-lg rounded-[24px] border border-slate-800/80 bg-[#0B1020]/90 text-slate-900 dark:text-white shadow-2xl backdrop-blur-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/8">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Configurar e Gerar PDF</h3>
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 dark:text-white/50 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Abrangência */}
              <div className="space-y-1.5">
                <label className="text-slate-500 dark:text-white/50 font-medium">Abrangência</label>
                <select
                  value={pdfScope}
                  onChange={(e) => setPdfScope(e.target.value as "filtered" | "current")}
                  className="w-full bg-[#080D1A] border border-white/20 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white shadow-sm focus:outline-none focus:border-cyan-400"
                >
                  <option value="filtered">Todos os resultados filtrados ({kpis.total} eventos)</option>
                  <option value="current">Somente a página atual ({items.length} eventos)</option>
                </select>
              </div>

              {/* Tipo de Conteúdo */}
              <div className="space-y-1.5">
                <label className="text-slate-500 dark:text-white/50 font-medium">Conteúdo do Relatório</label>
                <select
                  value={pdfContentType}
                  onChange={(e) => setPdfContentType(e.target.value as "resumido" | "detalhado")}
                  className="w-full bg-[#080D1A] border border-white/20 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white shadow-sm focus:outline-none focus:border-cyan-400"
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
                  className="w-4 h-4 rounded border-slate-300 dark:border-white/20 bg-white dark:bg-[#0C1323] text-cyan-500 focus:ring-cyan-400"
                />
                <label htmlFor="chkResumo" className="text-xs text-slate-700 dark:text-white/80 cursor-pointer">
                  Incluir resumo de erros por responsável no relatório
                </label>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-[#0C1323] rounded-xl border border-slate-200 dark:border-white/8 text-slate-500 dark:text-white/50 text-[11px]">
                {pdfScope === "filtered" ? kpis.total : items.length} eventos serão incluídos no arquivo PDF para download direto.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-white/8">
              <button
                onClick={() => setIsPdfModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.10] text-xs font-medium text-slate-700 dark:text-white transition-colors border border-slate-200 dark:border-white/10"
              >
                Cancelar
              </button>
              <button
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-xs font-semibold text-white shadow-lg disabled:opacity-50 transition-all"
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
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-white/40 border-t border-slate-200 dark:border-white/8 print:hidden">
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
