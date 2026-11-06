"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  ScrollText,
  RefreshCw,
  Trash2,
  Download,
  X,
  Search,
  CheckSquare,
  Square,
  Loader2,
  Copy,
  Check,
  Users,
  ShieldCheck,
  Hash,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { SecurePDFViewer } from "@/components/comunicados/SecurePDFViewer";
import {
  deleteHoleritesRH,
  listarHoleritesArmazenadosRHAction,
  listarLogsAcessoHoleriteAction,
  obterMapaColaboradoresCpfHoleritesAction,
  revelarCpfHoleriteAction,
  revelarCpfsEmLoteHoleritesAction,
  HoleriteArmazenadoRHItem,
  HoleriteLogEntry,
  ColaboradorCpfResumoHolerite,
} from "@/app/actions/holerites";

interface HoleriteUploaderProps {
  userRole?: string;
}

type HoleriteSortField =
  | "colaborador"
  | "cpf"
  | "competencia"
  | "dataUpload"
  | "uploadedBy"
  | "visualizacoes"
  | "status";

type SortDirection = "asc" | "desc";

interface UploadResultadoItem {
  id?: string;
  arquivo: string;
  cpfInformado?: string;
  colaborador?: string | null;
  competencia?: string;
  status: string;
  motivo?: string;
}

export function HoleriteUploader({ userRole = "RH" }: HoleriteUploaderProps) {
  const router = useRouter();
  const canRevealCpf = ["ADMIN", "RH", "MASTER"].includes(userRole);

  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadReport, setUploadReport] = useState<UploadResultadoItem[] | null>(null);

  const [loadingList, setLoadingList] = useState(true);
  const [holeritesList, setHoleritesList] = useState<HoleriteArmazenadoRHItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<HoleriteSortField>("dataUpload");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  // Revelação auditada de CPF completo na tabela de Holerites
  const [revealedCpfs, setRevealedCpfs] = useState<Record<string, string>>({});
  const [visibleCpfIds, setVisibleCpfIds] = useState<Record<string, boolean>>({});
  const [revealingCpfId, setRevealingCpfId] = useState<string | null>(null);
  const [revealingAllCpfs, setRevealingAllCpfs] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal de Consulta de CPFs do Cadastro Oficial (GESTOR)
  const [cpfDirectoryOpen, setCpfDirectoryOpen] = useState(false);
  const [cpfDirectoryLoading, setCpfDirectoryLoading] = useState(false);
  const [cpfDirectorySearch, setCpfDirectorySearch] = useState("");
  const [cpfDirectoryList, setCpfDirectoryList] = useState<ColaboradorCpfResumoHolerite[]>([]);
  const [dirRevealedCpfs, setDirRevealedCpfs] = useState<Record<string, string>>({});
  const [dirVisibleCpfKeys, setDirVisibleCpfKeys] = useState<Record<string, boolean>>({});
  const [dirRevealingKey, setDirRevealingKey] = useState<string | null>(null);
  const [dirRevealingAll, setDirRevealingAll] = useState(false);

  // Substituição individual de PDF
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [replacingItem, setReplacingItem] = useState<HoleriteArmazenadoRHItem | null>(null);

  // Modais de PDF, Logs e Exclusão
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<HoleriteArmazenadoRHItem | null>(null);
  const [viewPdfItem, setViewPdfItem] = useState<HoleriteArmazenadoRHItem | null>(null);
  const [viewLogsItem, setViewLogsItem] = useState<HoleriteArmazenadoRHItem | null>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsEntries, setLogsEntries] = useState<HoleriteLogEntry[]>([]);

  const carregarHolerites = useCallback(async () => {
    setLoadingList(true);
    try {
      const lista = await listarHoleritesArmazenadosRHAction();
      setHoleritesList(lista);
    } catch (err) {
      console.error("Erro ao carregar holerites armazenados:", err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    // Limpa qualquer dado residual antigo de protótipo em localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("fiorix_custom_holerites");
        localStorage.removeItem("fiorix_deleted_holerites");
      } catch {}
    }
    carregarHolerites();
  }, [carregarHolerites]);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setFiles(Array.from(e.target.files));
    setUploadReport(null);
  };

  const processarEnvioArquivos = async (arquivos: File[], replace = false) => {
    if (arquivos.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      for (const f of arquivos) {
        formData.append("files", f);
      }
      if (replace) {
        formData.append("replace", "true");
      }

      const res = await fetch("/api/rh/upload-holerites", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Falha ao processar os arquivos PDF.");
        return;
      }

      const resultados: UploadResultadoItem[] = data.resultados || [];
      setUploadReport(resultados);

      const aprovados = Number(data.aprovados || 0);
      const rejeitados = Number(data.rejeitados || 0);

      if (aprovados > 0 && rejeitados === 0) {
        toast.success(
          `${aprovados} ${
            aprovados === 1 ? "holerite validado e armazenado" : "holerites validados e armazenados"
          } com sucesso.`
        );
      } else if (aprovados > 0 && rejeitados > 0) {
        toast.warning(
          `${aprovados} aceito(s) e ${rejeitados} bloqueado(s) pela validação estrita de CPF.`
        );
      } else {
        toast.error(
          `Nenhum arquivo aceito (${rejeitados} bloqueado(s) na validação 1-para-1 de CPF). Veja os detalhes abaixo.`
        );
      }

      setFiles([]);
      await carregarHolerites();
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar lote de holerites.");
    } finally {
      setUploading(false);
      setReplacingItem(null);
    }
  };

  const handleUpload = () => processarEnvioArquivos(files, false);

  const handleReplaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    await processarEnvioArquivos([f], true);
  };

  const handleCopyCpf = async (cpfStr: string, key: string, digitsOnly = true) => {
    const texto = digitsOnly ? cpfStr.replace(/\D/g, "") : cpfStr;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiedId(key);
      toast.success(`CPF copiado (${texto}).`);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  // Revelar / Ocultar CPF individual na tabela de Holerites
  const handleToggleRowCpf = async (item: HoleriteArmazenadoRHItem) => {
    if (!canRevealCpf) return;

    if (visibleCpfIds[item.id]) {
      setVisibleCpfIds((prev) => ({ ...prev, [item.id]: false }));
      return;
    }

    if (revealedCpfs[item.id]) {
      setVisibleCpfIds((prev) => ({ ...prev, [item.id]: true }));
      return;
    }

    setRevealingCpfId(item.id);
    try {
      const res = await revelarCpfHoleriteAction({
        holeriteId: item.id,
        usuarioId: item.usuarioId,
        registroGestor: item.registroGestor ?? null,
        colaboradorNome: item.colaborador,
        arquivoNome: item.arquivoNome,
      });

      if (res.success && res.cpf) {
        setRevealedCpfs((prev) => ({ ...prev, [item.id]: res.cpf! }));
        setVisibleCpfIds((prev) => ({ ...prev, [item.id]: true }));
      } else {
        toast.error(res.erro || "CPF completo indisponível para este colaborador.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Sem permissão para revelar CPF completo.");
    } finally {
      setRevealingCpfId(null);
    }
  };

  const filteredHolerites = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = holeritesList.filter((h) => {
      if (!q) return true;
      const revealed = visibleCpfIds[h.id] ? revealedCpfs[h.id] : "";
      return (
        h.colaborador.toLowerCase().includes(q) ||
        h.cpfMascarado.toLowerCase().includes(q) ||
        (revealed && revealed.includes(q)) ||
        h.mesAno.includes(q)
      );
    });

    const factor = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "colaborador":
          cmp = a.colaborador.localeCompare(b.colaborador, "pt-BR", { sensitivity: "base" });
          break;
        case "cpf": {
          const cpfA = (visibleCpfIds[a.id] && revealedCpfs[a.id] ? revealedCpfs[a.id] : a.cpfMascarado).replace(/\D/g, "");
          const cpfB = (visibleCpfIds[b.id] && revealedCpfs[b.id] ? revealedCpfs[b.id] : b.cpfMascarado).replace(/\D/g, "");
          cmp = cpfA.localeCompare(cpfB);
          break;
        }
        case "competencia":
          cmp = (a.ano * 100 + a.mes) - (b.ano * 100 + b.mes);
          break;
        case "dataUpload": {
          const tA = a.dataUploadIso ? new Date(a.dataUploadIso).getTime() : 0;
          const tB = b.dataUploadIso ? new Date(b.dataUploadIso).getTime() : 0;
          cmp = tA - tB;
          break;
        }
        case "uploadedBy":
          cmp = a.uploadedBy.localeCompare(b.uploadedBy, "pt-BR", { sensitivity: "base" });
          break;
        case "visualizacoes":
          cmp = a.visualizacoes - b.visualizacoes;
          break;
        case "status":
          cmp = a.status.localeCompare(b.status, "pt-BR", { sensitivity: "base" });
          break;
      }
      if (cmp !== 0) return cmp * factor;
      return a.colaborador.localeCompare(b.colaborador, "pt-BR", { sensitivity: "base" });
    });
  }, [holeritesList, searchTerm, visibleCpfIds, revealedCpfs, sortField, sortDir]);

  const handleToggleSort = (field: HoleriteSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(
        field === "competencia" || field === "dataUpload" || field === "visualizacoes"
          ? "desc"
          : "asc"
      );
    }
  };

  const renderSortIcon = (field: HoleriteSortField) => {
    if (sortField !== field) {
      return (
        <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-70 group-hover/th:opacity-100 group-hover/th:text-slate-300 transition-all shrink-0" />
      );
    }
    return sortDir === "asc" ? (
      <ArrowUp className="w-3 h-3 text-cyan-400 shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-cyan-400 shrink-0" />
    );
  };

  const allRowsCpfVisible =
    filteredHolerites.length > 0 &&
    filteredHolerites.every((h) => Boolean(visibleCpfIds[h.id] && revealedCpfs[h.id]));

  const handleToggleAllRowsCpf = async () => {
    if (!canRevealCpf || filteredHolerites.length === 0) return;

    if (allRowsCpfVisible) {
      setVisibleCpfIds({});
      return;
    }

    setRevealingAllCpfs(true);
    try {
      const pendentes = filteredHolerites.filter((h) => !revealedCpfs[h.id]);
      let novos: Record<string, string> = {};
      if (pendentes.length > 0) {
        const res = await revelarCpfsEmLoteHoleritesAction({
          itens: pendentes.map((h) => ({
            id: h.id,
            colaboradorNome: h.colaborador,
            usuarioId: h.usuarioId,
            registroGestor: h.registroGestor ?? null,
            arquivoNome: h.arquivoNome,
          })),
        });
        novos = res.cpfsPorItemId || {};
      }

      const merged = { ...revealedCpfs, ...novos };
      setRevealedCpfs(merged);
      const vis: Record<string, boolean> = { ...visibleCpfIds };
      for (const h of filteredHolerites) {
        if (merged[h.id]) vis[h.id] = true;
      }
      setVisibleCpfIds(vis);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao revelar CPFs da listagem.");
    } finally {
      setRevealingAllCpfs(false);
    }
  };

  // Diretório de CPFs do Cadastro GESTOR (apoio ao RH para nomenclatura CPF_MM-AAAA.pdf)
  const abrirModalDiretorioCpfs = async () => {
    setCpfDirectoryOpen(true);
    if (cpfDirectoryList.length > 0) return;
    setCpfDirectoryLoading(true);
    try {
      const lista = await obterMapaColaboradoresCpfHoleritesAction();
      setCpfDirectoryList(lista);
    } catch {
      toast.error("Erro ao consultar colaboradores do GESTOR.");
    } finally {
      setCpfDirectoryLoading(false);
    }
  };

  const getDirKey = (c: ColaboradorCpfResumoHolerite, idx: number) =>
    `${c.registroGestor ?? "u"}_${c.nome}_${idx}`;

  const handleToggleDirCpf = async (c: ColaboradorCpfResumoHolerite, key: string) => {
    if (!canRevealCpf) return;
    if (dirVisibleCpfKeys[key]) {
      setDirVisibleCpfKeys((prev) => ({ ...prev, [key]: false }));
      return;
    }
    if (dirRevealedCpfs[key]) {
      setDirVisibleCpfKeys((prev) => ({ ...prev, [key]: true }));
      return;
    }

    setDirRevealingKey(key);
    try {
      const res = await revelarCpfHoleriteAction({
        usuarioId: c.usuarioId,
        registroGestor: c.registroGestor ?? null,
        colaboradorNome: c.nome,
      });
      if (res.success && res.cpf) {
        setDirRevealedCpfs((prev) => ({ ...prev, [key]: res.cpf! }));
        setDirVisibleCpfKeys((prev) => ({ ...prev, [key]: true }));
      } else {
        toast.error(res.erro || "CPF não localizado.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Sem permissão para revelar CPF.");
    } finally {
      setDirRevealingKey(null);
    }
  };

  const filteredDirectory = cpfDirectoryList.filter((c, idx) => {
    const q = cpfDirectorySearch.trim().toLowerCase();
    if (!q) return true;
    const key = getDirKey(c, idx);
    const rev = dirVisibleCpfKeys[key] ? dirRevealedCpfs[key] : "";
    return (
      c.nome.toLowerCase().includes(q) ||
      (c.registroGestor != null && String(c.registroGestor).includes(q.replace(/^#/, ""))) ||
      (c.cpfMascarado && c.cpfMascarado.includes(q)) ||
      (rev && (rev.includes(q) || rev.replace(/\D/g, "").includes(q)))
    );
  });

  const handleToggleAllDirCpfs = async () => {
    if (!canRevealCpf || filteredDirectory.length === 0) return;
    const allVis = filteredDirectory.every((c) => {
      const idx = cpfDirectoryList.indexOf(c);
      const k = getDirKey(c, idx);
      return Boolean(dirVisibleCpfKeys[k] && dirRevealedCpfs[k]);
    });

    if (allVis) {
      setDirVisibleCpfKeys({});
      return;
    }

    setDirRevealingAll(true);
    try {
      const itens = filteredDirectory.map((c) => {
        const idx = cpfDirectoryList.indexOf(c);
        return {
          id: getDirKey(c, idx),
          colaboradorNome: c.nome,
          usuarioId: c.usuarioId,
          registroGestor: c.registroGestor ?? null,
        };
      });
      const res = await revelarCpfsEmLoteHoleritesAction({ itens });
      const merged = { ...dirRevealedCpfs, ...(res.cpfsPorItemId || {}) };
      setDirRevealedCpfs(merged);
      const nextVis: Record<string, boolean> = { ...dirVisibleCpfKeys };
      for (const it of itens) {
        if (merged[it.id]) nextVis[it.id] = true;
      }
      setDirVisibleCpfKeys(nextVis);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao revelar CPFs.");
    } finally {
      setDirRevealingAll(false);
    }
  };

  const abrirModalLogs = async (item: HoleriteArmazenadoRHItem) => {
    setViewLogsItem(item);
    setLogsLoading(true);
    try {
      const entries = await listarLogsAcessoHoleriteAction(item.id);
      setLogsEntries(entries);
    } catch {
      setLogsEntries([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredHolerites.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredHolerites.map((h) => h.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const confirmDeleteHolerite = async (motivo: string) => {
    if (!itemToDelete) return;
    const deletedId = itemToDelete.id;
    const nomeColab = itemToDelete.colaborador;
    const mesAno = itemToDelete.mesAno;

    setHoleritesList((prev) => prev.filter((h) => h.id !== deletedId));
    setSelectedIds((prev) => prev.filter((id) => id !== deletedId));
    setDeleteModalOpen(false);
    setItemToDelete(null);

    try {
      await deleteHoleritesRH({
        ids: [deletedId],
        colaboradoresNomes: [nomeColab],
        motivo: motivo || `Exclusão de holerite ${mesAno} de ${nomeColab} pelo RH`,
      });
      toast.success(`Holerite ${mesAno} de ${nomeColab} excluído com registro WORM.`);
      router.refresh();
    } catch {
      toast.error("Erro ao excluir holerite no servidor.");
      await carregarHolerites();
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    if (
      !confirm(
        `Deseja excluir ${count} holerite(s) selecionado(s)? Esta ação será registrada na trilha de auditoria WORM.`
      )
    ) {
      return;
    }

    const idsToDelete = [...selectedIds];
    const nomesAfetados = holeritesList
      .filter((h) => idsToDelete.includes(h.id))
      .map((h) => h.colaborador);

    setHoleritesList((prev) => prev.filter((h) => !idsToDelete.includes(h.id)));
    setSelectedIds([]);

    try {
      await deleteHoleritesRH({
        ids: idsToDelete,
        colaboradoresNomes: nomesAfetados,
        motivo: `Exclusão em lote de ${count} holerites selecionados pelo RH`,
      });
      toast.success(`${count} holerite(s) excluído(s) com registro na trilha WORM.`);
      router.refresh();
    } catch {
      toast.error("Erro ao excluir holerites em lote.");
      await carregarHolerites();
    }
  };

  const handleExportLogsCsv = () => {
    const selecionados = holeritesList.filter((h) => selectedIds.includes(h.id));
    if (selecionados.length === 0) return;
    const headers = ["Colaborador", "CPF (LGPD)", "Competencia", "Data Upload", "Enviado Por", "Visualizacoes", "Hash SHA-256"];
    const rows = selecionados.map((s) =>
      [s.colaborador, s.cpfMascarado, s.mesAno, s.dataUpload, s.uploadedBy, s.visualizacoes, s.hash]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(";")
    );
    const csv = "\uFEFF" + [headers.join(";"), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `custodia-holerites-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório CSV exportado.");
  };

  return (
    <div className="space-y-6">
      {/* Input oculto para substituição individual de PDF */}
      <input
        ref={replaceInputRef}
        type="file"
        accept=".pdf"
        onChange={handleReplaceFileChange}
        className="hidden"
      />

      {/* 1. Card Upload em Lote (Validação Estrita 1-para-1 dos 11 dígitos do CPF) */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-6 py-5 gap-4 border-b border-white/10 bg-[#0B1020]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Upload em Lote de Holerites & Comprovantes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Padrão de nomenclatura obrigatório:{" "}
                <code className="text-cyan-300 font-mono font-semibold">CPF_MM-AAAA.pdf</code>{" "}
                (exigência estrita dos 11 dígitos exatos do colaborador cadastrado no GESTOR)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canRevealCpf && (
              <button
                type="button"
                onClick={abrirModalDiretorioCpfs}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 hover:bg-cyan-500/20 text-xs font-bold text-cyan-300 transition-all cursor-pointer"
                title="Consultar e copiar o CPF completo dos colaboradores cadastrados no GESTOR"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Consultar CPFs (GESTOR)</span>
              </button>
            )}

            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-[11px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 w-fit">
              Validação Estrita 11 Dígitos (1-para-1)
            </span>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Dropzone Area */}
          <div className="relative border-2 border-dashed border-white/15 hover:border-cyan-500/45 rounded-2xl p-8 flex flex-col items-center justify-center transition-all bg-[#080D1A] hover:bg-[#0E1528]/70 group cursor-pointer">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white text-center">
              Arraste os arquivos PDF ou clique para selecionar
            </p>
            <p className="text-xs text-slate-400 mt-1 text-center">
              Até 5MB por arquivo • CPFs divergentes ou não pertencentes à Serventia são bloqueados automaticamente
            </p>
            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={handleFileSelection}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>

          {files.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#080D1A] border border-cyan-500/30 rounded-2xl">
              <span className="text-xs text-slate-200 font-medium">
                <strong className="text-cyan-400 font-bold">{files.length}</strong>{" "}
                {files.length === 1
                  ? "arquivo PDF selecionado para validação 1-para-1"
                  : "arquivos PDF selecionados para validação 1-para-1"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={uploading}
                  onClick={() => setFiles([])}
                  className="text-xs text-slate-400 hover:text-white h-9 rounded-xl"
                >
                  Limpar
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpload}
                  disabled={uploading}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs h-9 px-4 rounded-xl shadow-sm shadow-indigo-500/20 gap-1.5 cursor-pointer"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Validando CPFs e Enviando...</span>
                    </>
                  ) : (
                    <span>Confirmar Upload em Lote</span>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Relatório transparente do processamento do lote */}
          {uploadReport && uploadReport.length > 0 && (
            <div className="rounded-2xl border border-white/15 bg-[#080D1A] p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Resultado da Validação 1-para-1 por CPF
                </span>
                <button
                  type="button"
                  onClick={() => setUploadReport(null)}
                  className="text-xs text-slate-400 hover:text-white cursor-pointer"
                >
                  Fechar resumo
                </button>
              </div>

              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {uploadReport.map((r, i) => {
                  const ok = r.status === "MATCH" || r.status === "SUBSTITUÍDO";
                  return (
                    <div
                      key={`${r.arquivo}-${i}`}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-xl border text-xs ${
                        ok
                          ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-200"
                          : "bg-rose-500/10 border-rose-500/25 text-rose-200"
                      }`}
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        {ok ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div className="min-w-0">
                          <div className="font-mono font-bold truncate">{r.arquivo}</div>
                          <div className="text-[11px] opacity-90">
                            {ok
                              ? `Vinculado a ${r.colaborador} • Competência ${r.competencia}`
                              : r.motivo || r.status}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold uppercase shrink-0 ${
                          ok ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Card Tabela de Gestão de Holerites Armazenados (100% Banco PostgreSQL) */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-6 py-5 gap-4 border-b border-white/10 bg-[#0B1020]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Holerites Armazenados & Registro de Visualizações
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Custódia oficial no PostgreSQL/Storage privado • Clique no ícone do olho para revelar ou copiar o CPF completo
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canRevealCpf && filteredHolerites.length > 0 && (
              <button
                type="button"
                onClick={handleToggleAllRowsCpf}
                disabled={revealingAllCpfs}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-white/15 bg-[#080D1A] hover:bg-[#0E1528] text-xs font-semibold text-cyan-300 transition-all cursor-pointer"
                title={
                  allRowsCpfVisible
                    ? "Ocultar todos os CPFs"
                    : "Revelar o CPF completo de todos os registros listados (auditado LGPD)"
                }
              >
                {revealingAllCpfs ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : allRowsCpfVisible ? (
                  <EyeOff className="w-3.5 h-3.5" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span>{allRowsCpfVisible ? "Ocultar CPFs" : "Ver CPFs Completos"}</span>
              </button>
            )}

            {/* Menu de Ordenação por Coluna */}
            <div className="inline-flex items-center h-9 bg-[#080D1A] border border-white/15 rounded-xl px-3 gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <select
                aria-label="Ordenar holerites por coluna"
                value={`${sortField}:${sortDir}`}
                onChange={(e) => {
                  const [f, d] = e.target.value.split(":") as [HoleriteSortField, SortDirection];
                  setSortField(f);
                  setSortDir(d);
                }}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1"
              >
                <option value="dataUpload:desc" className="bg-[#0B1020] text-white">Ordenar: Data Upload (Recente)</option>
                <option value="dataUpload:asc" className="bg-[#0B1020] text-white">Ordenar: Data Upload (Antiga)</option>
                <option value="colaborador:asc" className="bg-[#0B1020] text-white">Ordenar: Colaborador (A–Z)</option>
                <option value="colaborador:desc" className="bg-[#0B1020] text-white">Ordenar: Colaborador (Z–A)</option>
                <option value="competencia:desc" className="bg-[#0B1020] text-white">Ordenar: Competência (Recente)</option>
                <option value="competencia:asc" className="bg-[#0B1020] text-white">Ordenar: Competência (Antiga)</option>
                <option value="cpf:asc" className="bg-[#0B1020] text-white">Ordenar: CPF (Crescente)</option>
                <option value="cpf:desc" className="bg-[#0B1020] text-white">Ordenar: CPF (Decrescente)</option>
                <option value="uploadedBy:asc" className="bg-[#0B1020] text-white">Ordenar: Enviado Por (A–Z)</option>
                <option value="uploadedBy:desc" className="bg-[#0B1020] text-white">Ordenar: Enviado Por (Z–A)</option>
                <option value="visualizacoes:desc" className="bg-[#0B1020] text-white">Ordenar: Visualizações (Maior)</option>
                <option value="visualizacoes:asc" className="bg-[#0B1020] text-white">Ordenar: Visualizações (Menor)</option>
                <option value="status:asc" className="bg-[#0B1020] text-white">Ordenar: Status (A–Z)</option>
                <option value="status:desc" className="bg-[#0B1020] text-white">Ordenar: Status (Z–A)</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar colaborador, CPF ou mês..."
                className="bg-[#080D1A] border border-white/15 pl-9 text-xs h-9 rounded-xl text-white placeholder:text-slate-500 focus:border-cyan-500/50"
              />
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Bulk Action Bar */}
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-indigo-500/10 border border-indigo-500/25 rounded-2xl animate-in fade-in">
              <span className="text-xs text-indigo-200 font-medium">
                <strong className="text-white font-bold">{selectedIds.length}</strong>{" "}
                holerite(s) selecionado(s)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportLogsCsv}
                  className="bg-[#080D1A] border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 text-xs font-semibold h-8 rounded-xl gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Exportar CSV</span>
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleBulkDelete}
                  className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold h-8 rounded-xl gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Excluir Selecionados</span>
                </Button>
              </div>
            </div>
          )}

          {/* Tabela de Holerites */}
          <div className="border border-white/10 rounded-2xl overflow-x-auto bg-[#080D1A]">
            <table className="w-full text-left text-xs min-w-[820px]">
              <thead className="bg-[#0E1528] text-slate-400 uppercase font-mono text-[11px] tracking-wider border-b border-white/10">
                <tr>
                  <th className="pl-4 pr-2 py-3.5 w-9 text-center">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      {selectedIds.length === filteredHolerites.length &&
                      filteredHolerites.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-3.5 py-3.5 font-bold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleToggleSort("colaborador")}
                      className={`group/th inline-flex items-center gap-1.5 uppercase tracking-wider cursor-pointer transition-colors ${
                        sortField === "colaborador" ? "text-cyan-300" : "hover:text-white"
                      }`}
                      title="Clique para ordenar por Colaborador"
                    >
                      <span>Colaborador</span>
                      {renderSortIcon("colaborador")}
                    </button>
                  </th>
                  <th className="px-3.5 py-3.5 font-bold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleToggleSort("cpf")}
                      className={`group/th inline-flex items-center gap-1.5 uppercase tracking-wider cursor-pointer transition-colors ${
                        sortField === "cpf" ? "text-cyan-300" : "hover:text-white"
                      }`}
                      title="Clique para ordenar por CPF"
                    >
                      <span>CPF (LGPD)</span>
                      {renderSortIcon("cpf")}
                    </button>
                  </th>
                  <th className="px-3.5 py-3.5 font-bold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleToggleSort("competencia")}
                      className={`group/th inline-flex items-center gap-1.5 uppercase tracking-wider cursor-pointer transition-colors ${
                        sortField === "competencia" ? "text-cyan-300" : "hover:text-white"
                      }`}
                      title="Clique para ordenar por Competência"
                    >
                      <span>Competência</span>
                      {renderSortIcon("competencia")}
                    </button>
                  </th>
                  <th className="px-3.5 py-3.5 font-bold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleToggleSort("dataUpload")}
                      className={`group/th inline-flex items-center gap-1.5 uppercase tracking-wider cursor-pointer transition-colors ${
                        sortField === "dataUpload" ? "text-cyan-300" : "hover:text-white"
                      }`}
                      title="Clique para ordenar por Data de Upload"
                    >
                      <span>Data Upload</span>
                      {renderSortIcon("dataUpload")}
                    </button>
                  </th>
                  <th className="px-3.5 py-3.5 font-bold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleToggleSort("uploadedBy")}
                      className={`group/th inline-flex items-center gap-1.5 uppercase tracking-wider cursor-pointer transition-colors ${
                        sortField === "uploadedBy" ? "text-cyan-300" : "hover:text-white"
                      }`}
                      title="Clique para ordenar por Enviado Por"
                    >
                      <span>Enviado Por</span>
                      {renderSortIcon("uploadedBy")}
                    </button>
                  </th>
                  <th className="px-3.5 py-3.5 font-bold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleToggleSort("visualizacoes")}
                      className={`group/th inline-flex items-center gap-1.5 uppercase tracking-wider cursor-pointer transition-colors ${
                        sortField === "visualizacoes" ? "text-cyan-300" : "hover:text-white"
                      }`}
                      title="Clique para ordenar por Visualizações"
                    >
                      <span>Visualizações</span>
                      {renderSortIcon("visualizacoes")}
                    </button>
                  </th>
                  <th className="px-3.5 py-3.5 font-bold whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => handleToggleSort("status")}
                      className={`group/th inline-flex items-center gap-1.5 uppercase tracking-wider cursor-pointer transition-colors ${
                        sortField === "status" ? "text-cyan-300" : "hover:text-white"
                      }`}
                      title="Clique para ordenar por Status"
                    >
                      <span>Status</span>
                      {renderSortIcon("status")}
                    </button>
                  </th>
                  <th className="pl-2 pr-4 py-3.5 font-bold text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-slate-200">
                {loadingList ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                      <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
                      <span>Carregando holerites armazenados...</span>
                    </td>
                  </tr>
                ) : filteredHolerites.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <FileText className="w-8 h-8 text-slate-600" />
                        <p className="font-semibold text-sm text-slate-300">
                          Nenhum holerite armazenado
                        </p>
                        <p className="text-xs text-slate-500 max-w-md">
                          Envie os arquivos PDF no formato <code className="text-cyan-300">CPF_MM-AAAA.pdf</code> acima.
                          Precisa conferir o CPF real de um colaborador? Clique em{" "}
                          <strong className="text-slate-300">Consultar CPFs (GESTOR)</strong>.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredHolerites.map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const isCpfRevealed = Boolean(visibleCpfIds[item.id] && revealedCpfs[item.id]);
                    const cpfExibido = isCpfRevealed ? revealedCpfs[item.id] : item.cpfMascarado;

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-white/[0.03] transition-colors ${
                          isSelected ? "bg-indigo-500/[0.06]" : ""
                        }`}
                      >
                        <td className="pl-4 pr-2 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelect(item.id)}
                            className="text-slate-400 hover:text-white cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        <td className="px-3.5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">
                                  {item.colaborador}
                                </span>
                                {item.registroGestor != null && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                                    <Hash className="w-2.5 h-2.5" />
                                    {item.registroGestor}
                                  </span>
                                )}
                              </div>
                              {item.setor && (
                                <span className="text-[11px] text-slate-400">{item.setor}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* CPF com opção de Ver Completo + Copiar */}
                        <td className="px-3.5 py-3.5 font-mono text-xs whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className={
                                isCpfRevealed ? "text-white font-bold" : "text-slate-300"
                              }
                            >
                              {cpfExibido}
                            </span>

                            {canRevealCpf && item.temCpfCadastrado && (
                              <button
                                type="button"
                                onClick={() => handleToggleRowCpf(item)}
                                disabled={revealingCpfId === item.id}
                                className="p-1 rounded-md text-cyan-400 hover:text-cyan-300 hover:bg-white/8 transition-colors cursor-pointer"
                                title={
                                  isCpfRevealed
                                    ? "Ocultar CPF"
                                    : "Ver CPF completo (auditado LGPD)"
                                }
                              >
                                {revealingCpfId === item.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : isCpfRevealed ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}

                            {isCpfRevealed && revealedCpfs[item.id] && (
                              <button
                                type="button"
                                onClick={() => handleCopyCpf(revealedCpfs[item.id], item.id, true)}
                                className="p-1 rounded-md text-emerald-400 hover:text-emerald-300 hover:bg-white/8 transition-colors cursor-pointer"
                                title="Copiar 11 dígitos do CPF"
                              >
                                {copiedId === item.id ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="px-3.5 py-3.5 font-mono text-xs text-cyan-300 font-bold whitespace-nowrap">
                          {item.mesAno}
                        </td>
                        <td className="px-3.5 py-3.5 font-mono text-xs text-slate-400 whitespace-nowrap">
                          {item.dataUpload}
                        </td>
                        <td className="px-3.5 py-3.5 text-xs font-medium text-slate-300 whitespace-nowrap">
                          {item.uploadedBy}
                        </td>
                        <td className="px-3.5 py-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-xs text-white">
                            {item.visualizacoes}
                          </span>
                          <span className="text-[11px] text-slate-400 ml-1">acessos</span>
                        </td>
                        <td className="px-3.5 py-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              item.status === "Visualizado"
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : "bg-slate-500/15 text-slate-300 border-slate-500/30"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.status === "Visualizado" ? "bg-emerald-400" : "bg-slate-400"
                              }`}
                            />
                            {item.status}
                          </span>
                        </td>
                        <td className="pl-2 pr-4 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setViewPdfItem(item)}
                              title="Visualizar PDF Oficial Armazenado"
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-white/8 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirModalLogs(item)}
                              title="Ver Logs Reais de Acesso (LGPD)"
                              className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-white/8 rounded-lg transition-colors cursor-pointer"
                            >
                              <ScrollText className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReplacingItem(item);
                                replaceInputRef.current?.click();
                              }}
                              title={`Substituir PDF (${item.arquivoNome})`}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-white/8 rounded-lg transition-colors cursor-pointer"
                            >
                              <RefreshCw
                                className={`w-4 h-4 ${
                                  uploading && replacingItem?.id === item.id ? "animate-spin" : ""
                                }`}
                              />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setItemToDelete(item);
                                setDeleteModalOpen(true);
                              }}
                              title="Excluir Holerite (Auditoria WORM)"
                              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/8 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Real de PDF (SecurePDFViewer) */}
      {viewPdfItem && (
        <SecurePDFViewer
          documentTitle={`Holerite ${viewPdfItem.mesAno} — ${viewPdfItem.colaborador}`}
          documentType="holerite"
          documentId={viewPdfItem.id}
          fileUrl={`/api/holerites/${viewPdfItem.id}/download`}
          userName={viewPdfItem.colaborador}
          allowDownload={true}
          onClose={() => setViewPdfItem(null)}
        />
      )}

      {/* Modal de Logs Reais de Acesso do Holerite */}
      {viewLogsItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
          onClick={() => setViewLogsItem(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl bg-[#0B1020] border border-white/15 rounded-[24px] flex flex-col shadow-2xl overflow-hidden text-white"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0E1528]">
              <div className="flex items-center gap-2.5">
                <ScrollText className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Logs Reais de Acesso e Custódia (LGPD)
                  </h3>
                  <p className="text-xs text-slate-400">
                    {viewLogsItem.colaborador} • Competência {viewLogsItem.mesAno}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewLogsItem(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-[#080D1A] space-y-3 max-h-[360px] overflow-y-auto">
              {logsLoading ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" />
                  Consultando trilha de auditoria...
                </div>
              ) : logsEntries.length === 0 ? (
                <div className="p-4 rounded-xl border border-white/8 bg-white/[0.02] text-xs text-slate-400 text-center">
                  Nenhuma visualização ou download registrado até o momento para este documento.
                </div>
              ) : (
                logsEntries.map((lg) => (
                  <div
                    key={lg.id}
                    className="p-3.5 bg-white/[0.03] rounded-xl border border-white/8 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-cyan-300">{lg.tipo}</span>
                      <span className="font-mono text-slate-400">{lg.dataHora}</span>
                    </div>
                    <p className="text-slate-300">
                      Usuário: <strong>{lg.operador}</strong> • IP: {lg.ip}
                    </p>
                  </div>
                ))
              )}

              <div className="p-3 bg-white/[0.02] rounded-xl border border-white/8 text-[11px] font-mono text-slate-400 break-all">
                SHA-256: {viewLogsItem.hash}
              </div>
            </div>

            <div className="px-6 py-3 bg-[#0E1528] flex justify-end">
              <Button
                size="sm"
                onClick={() => setViewLogsItem(null)}
                className="bg-white/10 hover:bg-white/20 text-xs rounded-xl cursor-pointer"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Consulta de CPFs do Cadastro Oficial (GESTOR) */}
      {cpfDirectoryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
          onClick={() => setCpfDirectoryOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-[24px] border border-white/15 bg-[#0B1020] shadow-2xl text-white overflow-hidden"
          >
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-white/10 bg-[#0E1528]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Consulta de CPFs · Cadastro Oficial (GESTOR)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Visualize e copie os 11 dígitos exatos para nomear os arquivos{" "}
                    <code className="text-cyan-300 font-mono">CPF_MM-AAAA.pdf</code>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCpfDirectoryOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-white/10 bg-[#0B1020] flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={cpfDirectorySearch}
                  onChange={(e) => setCpfDirectorySearch(e.target.value)}
                  placeholder="Buscar por nome ou nº de registro..."
                  className="pl-9 h-9 bg-[#080D1A] border-white/15 text-xs text-white rounded-xl"
                />
              </div>

              <Button
                type="button"
                size="sm"
                onClick={handleToggleAllDirCpfs}
                disabled={dirRevealingAll || filteredDirectory.length === 0}
                className="h-9 px-3.5 rounded-xl bg-cyan-600/20 border border-cyan-500/35 hover:bg-cyan-600/30 text-cyan-200 text-xs font-bold gap-1.5 cursor-pointer"
              >
                {dirRevealingAll ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
                <span>Ver / Ocultar Todos</span>
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-white/8 bg-[#080D1A]">
              {cpfDirectoryLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
                  Consultando cadastro sincronizado do GESTOR...
                </div>
              ) : filteredDirectory.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Nenhum colaborador encontrado para esta busca.
                </div>
              ) : (
                filteredDirectory.map((c) => {
                  const origIdx = cpfDirectoryList.indexOf(c);
                  const key = getDirKey(c, origIdx);
                  const isRev = Boolean(dirVisibleCpfKeys[key] && dirRevealedCpfs[key]);
                  const displayCpf = isRev ? dirRevealedCpfs[key] : c.cpfMascarado || "Sem CPF";

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/[0.03]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{c.nome}</span>
                          {c.registroGestor != null && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                              #{c.registroGestor}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 font-mono text-xs">
                        <span className={isRev ? "text-white font-bold" : "text-slate-400"}>
                          {displayCpf}
                        </span>

                        {c.temCpfCadastrado && (
                          <button
                            type="button"
                            onClick={() => handleToggleDirCpf(c, key)}
                            disabled={dirRevealingKey === key}
                            className="p-1.5 rounded-lg text-cyan-400 hover:text-cyan-300 hover:bg-white/8 transition-colors cursor-pointer"
                            title={isRev ? "Ocultar CPF" : "Ver CPF completo (auditado LGPD)"}
                          >
                            {dirRevealingKey === key ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : isRev ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}

                        {isRev && dirRevealedCpfs[key] && (
                          <button
                            type="button"
                            onClick={() => handleCopyCpf(dirRevealedCpfs[key], key, true)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-sans font-semibold text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                            title="Copiar 11 dígitos sem pontuação para nomear o PDF"
                          >
                            {copiedId === key ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>Copiar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-6 py-3 border-t border-white/10 bg-[#0E1528] flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Toda revelação de CPF é registrada na trilha LGPD (Prov. 213/2026)
              </span>
              <Button
                type="button"
                size="sm"
                onClick={() => setCpfDirectoryOpen(false)}
                className="h-8 px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs cursor-pointer"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão LGPD */}
      {itemToDelete && (
        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setItemToDelete(null);
          }}
          onConfirm={confirmDeleteHolerite}
          title="Excluir Holerite (LGPD Art. 5 II)"
          itemDescription={`Holerite ${itemToDelete.mesAno} de ${itemToDelete.colaborador} (CPF: ${itemToDelete.cpfMascarado})`}
          wormWarning="Excluir holerite? Dado pessoal sensível (LGPD Art. 5 II) será removido do storage ativo, mantendo o hash e registro na trilha WORM por 5 anos conforme Provimento 213/2026."
        />
      )}
    </div>
  );
}
