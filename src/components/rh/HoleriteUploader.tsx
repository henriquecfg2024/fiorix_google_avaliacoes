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
  Calendar,
  Clock,
  Scale,
  UserX,
  ClipboardCheck,
  FileCheck2,
  Layers,
  Palmtree,
  Lock,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { DossieCorregedoriaHoleritesModal } from "./DossieCorregedoriaHoleritesModal";
import { SecurePDFViewer } from "@/components/comunicados/SecurePDFViewer";
import {
  auditarIntegridadeStorageHoleritesAction,
  deleteHoleritesRH,
  homologarCompetenciaHoleritesAction,
  listarHoleritesArmazenadosRHAction,
  listarLogsAcessoHoleriteAction,
  obterMapaColaboradoresCpfHoleritesAction,
  obterPainelGovernancaHoleritesAction,
  reabrirCompetenciaHoleritesAction,
  registrarDispensaLegalHoleriteAction,
  removerDispensaLegalHoleriteAction,
  revelarCpfHoleriteAction,
  revelarCpfsEmLoteHoleritesAction,
  HoleriteArmazenadoRHItem,
  HoleriteLogEntry,
  ColaboradorCpfResumoHolerite,
  ResultadoAuditoriaIntegridade,
} from "@/app/actions/holerites";
import type {
  ColaboradorFaltanteHolerite,
  PainelGovernancaHoleritesData,
  ResumoCompetenciaHolerite,
} from "@/lib/holerites/holerites-governance-repository";

interface HoleriteUploaderProps {
  userRole?: string;
}

type HoleriteSortField =
  | "colaborador"
  | "cpf"
  | "competencia"
  | "prazoClt"
  | "dataUpload"
  | "uploadedBy"
  | "visualizacoes"
  | "status";

type SortDirection = "asc" | "desc";
type ActiveMainTab = "arquivados" | "faltantes" | "checklist_clt";

interface UploadResultadoItem {
  id?: string;
  arquivo: string;
  cpfInformado?: string;
  colaborador?: string | null;
  competencia?: string;
  mes?: number;
  ano?: number;
  prazoLegalClt?: string;
  noPrazoClt?: boolean;
  diasAtrasoClt?: number;
  status: string;
  motivo?: string;
}

const OPCOES_MOTIVO_DISPENSA = [
  { value: "AFASTAMENTO_INSS", label: "Afastamento Previdenciário (INSS)" },
  { value: "FERIAS_MES_ANTERIOR", label: "Férias Pagas Integralmente no Mês Anterior" },
  { value: "LICENCA_SEM_VENCIMENTO", label: "Licença sem Vencimentos" },
  { value: "CONTRATO_SUSPENSO", label: "Suspensão Temporária de Contrato" },
  { value: "OUTRO_LEGAL", label: "Outra Hipótese Legal / Administrativa" },
];

export function HoleriteUploader({ userRole = "RH" }: HoleriteUploaderProps) {
  const router = useRouter();
  const canManageGovernance = ["ADMIN", "RH", "MASTER"].includes(userRole);
  const canRevealCpf = ["ADMIN", "RH", "MASTER"].includes(userRole);

  // Estado do Painel Anual & Mensal de Governança CLT
  const [anoSelecionado, setAnoSelecionado] = useState<number>(new Date().getFullYear());
  const [selectedMes, setSelectedMes] = useState<number | null>(null); // null = Mostrar Todo o Acervo
  const [initializedSelection, setInitializedSelection] = useState(false);
  const [painelGov, setPainelGov] = useState<PainelGovernancaHoleritesData | null>(null);
  const [loadingGov, setLoadingGov] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveMainTab>("arquivados");

  // Upload em lote / linha individual
  const [files, setFiles] = useState<File[]>([]);
  const [justificativaAtrasoInput, setJustificativaAtrasoInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadReport, setUploadReport] = useState<UploadResultadoItem[] | null>(null);

  // Lista de holerites armazenados no banco
  const [loadingList, setLoadingList] = useState(true);
  const [holeritesList, setHoleritesList] = useState<HoleriteArmazenadoRHItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sortField, setSortField] = useState<HoleriteSortField>("dataUpload");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  // Filtros e CPFs da aba "Faltantes na Competência"
  const [faltantesSearch, setFaltantesSearch] = useState("");
  const [faltantesSetor, setFaltantesSetor] = useState("TODOS");
  const [faltantesRevealedCpfs, setFaltantesRevealedCpfs] = useState<Record<string, string>>({});
  const [faltantesVisibleCpfs, setFaltantesVisibleCpfs] = useState<Record<string, boolean>>({});
  const [faltantesRevealingKey, setFaltantesRevealingKey] = useState<string | null>(null);
  const [faltantesRevealingAll, setFaltantesRevealingAll] = useState(false);
  const [copyingFilenameKey, setCopyingFilenameKey] = useState<string | null>(null);

  // Upload rápido a partir da linha de Faltante
  const rowUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [faltanteUploadAlvo, setFaltanteUploadAlvo] = useState<ColaboradorFaltanteHolerite | null>(null);

  // Modal de Justificativa / Dispensa Legal de Ausência
  const [dispensaModalColab, setDispensaModalColab] = useState<ColaboradorFaltanteHolerite | null>(null);
  const [dispensaMotivo, setDispensaMotivo] = useState("AFASTAMENTO_INSS");
  const [dispensaDescricao, setDispensaDescricao] = useState("");
  const [salvandoDispensa, setSalvandoDispensa] = useState(false);

  // Homologação CLT & Auditoria SHA-256 + Dossiê Corregedoria
  const [homologacaoObs, setHomologacaoObs] = useState("");
  const [homologando, setHomologando] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);
  const [auditandoStorage, setAuditandoStorage] = useState(false);
  const [resultadoAuditoria, setResultadoAuditoria] = useState<ResultadoAuditoriaIntegridade | null>(null);
  const [dossieOpen, setDossieOpen] = useState(false);

  // Revelação auditada de CPF completo na tabela de Arquivados
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

  const carregarTudo = useCallback(
    async (targetAno: number, keepMonthSelection = true) => {
      setLoadingList(true);
      setLoadingGov(true);
      try {
        const [lista, painel] = await Promise.all([
          listarHoleritesArmazenadosRHAction(),
          obterPainelGovernancaHoleritesAction(targetAno),
        ]);
        setHoleritesList(lista);
        setPainelGov(painel);
        if (!keepMonthSelection || !initializedSelection) {
          setSelectedMes(painel.competenciaSugeridaMes);
          setInitializedSelection(true);
        }
      } catch (err) {
        console.error("Erro ao carregar governança e holerites:", err);
      } finally {
        setLoadingList(false);
        setLoadingGov(false);
      }
    },
    [initializedSelection]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("fiorix_custom_holerites");
        localStorage.removeItem("fiorix_deleted_holerites");
      } catch {}
    }
    carregarTudo(anoSelecionado, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTrocarAno = async (novoAno: number) => {
    setAnoSelecionado(novoAno);
    setSelectedIds([]);
    setLoadingGov(true);
    try {
      const painel = await obterPainelGovernancaHoleritesAction(novoAno);
      setPainelGov(painel);
      setSelectedMes(painel.competenciaSugeridaMes);
    } catch {
      toast.error("Erro ao alternar ano de competência.");
    } finally {
      setLoadingGov(false);
    }
  };

  // Competência ativa de referência para KPIs, Faltantes e Checklist CLT
  const compAtiva: ResumoCompetenciaHolerite | null = useMemo(() => {
    if (!painelGov) return null;
    const mesRef = selectedMes ?? painelGov.competenciaSugeridaMes;
    return (
      painelGov.competencias.find((c) => c.mes === mesRef) ||
      painelGov.competencias[0] ||
      null
    );
  }, [painelGov, selectedMes]);

  const competenciasMensais = useMemo(
    () => (painelGov ? painelGov.competencias.filter((c) => c.mes >= 1 && c.mes <= 12) : []),
    [painelGov]
  );

  const competenciasDecimo = useMemo(
    () => (painelGov ? painelGov.competencias.filter((c) => c.mes === 13 || c.mes === 14) : []),
    [painelGov]
  );

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
      if (justificativaAtrasoInput.trim()) {
        formData.append("justificativaAtraso", justificativaAtrasoInput.trim());
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

      // Se houve arquivos aprovados de um mês/ano específico, foca automaticamente nessa competência
      const primeiroOk = resultados.find(
        (r) => (r.status === "MATCH" || r.status === "SUBSTITUÍDO") && r.ano && r.mes
      );

      const targetAno = primeiroOk?.ano || anoSelecionado;
      if (primeiroOk?.ano && primeiroOk.ano !== anoSelecionado) {
        setAnoSelecionado(primeiroOk.ano);
      }
      if (primeiroOk?.mes) {
        setSelectedMes(primeiroOk.mes);
      }

      if (aprovados > 0 && rejeitados === 0) {
        toast.success(
          `${aprovados} ${
            aprovados === 1 ? "holerite validado e arquivado" : "holerites validados e arquivados"
          } com sucesso.`
        );
      } else if (aprovados > 0 && rejeitados > 0) {
        toast.warning(
          `${aprovados} aceito(s) e ${rejeitados} bloqueado(s) pela validação estrita 1-para-1 de CPF.`
        );
      } else {
        toast.error(
          `Nenhum arquivo aceito (${rejeitados} bloqueado(s) na validação 1-para-1 de CPF). Veja os detalhes abaixo.`
        );
      }

      setFiles([]);
      setJustificativaAtrasoInput("");
      await carregarTudo(targetAno, true);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar lote de holerites.");
    } finally {
      setUploading(false);
      setReplacingItem(null);
      setFaltanteUploadAlvo(null);
    }
  };

  const handleUpload = () => processarEnvioArquivos(files, false);

  const handleReplaceFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    await processarEnvioArquivos([f], true);
  };

  const handleRowFaltanteUploadChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    await processarEnvioArquivos([f], false);
  };

  const handleCopyText = async (texto: string, key: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiedId(key);
      toast.success(msg);
      setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const handleCopyCpf = (cpfStr: string, key: string, digitsOnly = true) => {
    const texto = digitsOnly ? cpfStr.replace(/\D/g, "") : cpfStr;
    return handleCopyText(texto, key, `CPF copiado (${texto}).`);
  };

  // Revelar / Ocultar CPF individual na tabela de Arquivados
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

  // Filtra e ordena Holerites Arquivados
  const filteredHolerites = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const base = holeritesList.filter((h) => {
      if (selectedMes !== null) {
        if (h.ano !== anoSelecionado || h.mes !== selectedMes) return false;
      }
      if (!q) return true;
      const revealed = visibleCpfIds[h.id] ? revealedCpfs[h.id] : "";
      return (
        h.colaborador.toLowerCase().includes(q) ||
        (h.registroGestor != null && String(h.registroGestor).includes(q.replace(/^#/, ""))) ||
        h.cpfMascarado.toLowerCase().includes(q) ||
        (revealed && (revealed.includes(q) || revealed.replace(/\D/g, "").includes(q))) ||
        h.mesAno.toLowerCase().includes(q) ||
        h.hash.toLowerCase().includes(q)
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
          const cpfA = (visibleCpfIds[a.id] && revealedCpfs[a.id]
            ? revealedCpfs[a.id]
            : a.cpfMascarado
          ).replace(/\D/g, "");
          const cpfB = (visibleCpfIds[b.id] && revealedCpfs[b.id]
            ? revealedCpfs[b.id]
            : b.cpfMascarado
          ).replace(/\D/g, "");
          cmp = cpfA.localeCompare(cpfB);
          break;
        }
        case "competencia":
          cmp = a.ano * 100 + a.mes - (b.ano * 100 + b.mes);
          break;
        case "prazoClt": {
          if (a.entregueNoPrazoClt !== b.entregueNoPrazoClt) {
            cmp = a.entregueNoPrazoClt ? -1 : 1;
          } else {
            cmp = a.diasAtrasoClt - b.diasAtrasoClt;
          }
          break;
        }
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
  }, [
    holeritesList,
    selectedMes,
    anoSelecionado,
    searchTerm,
    visibleCpfIds,
    revealedCpfs,
    sortField,
    sortDir,
  ]);

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

  // ── Assistente Inteligente de Faltantes ("Quem Faltou?") ──────────────────
  const setoresFaltantes = useMemo(() => {
    if (!compAtiva) return [];
    const s = new Set<string>();
    for (const f of compAtiva.faltantes) {
      if (f.setor) s.add(f.setor);
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [compAtiva]);

  const filteredFaltantes = useMemo(() => {
    if (!compAtiva) return [];
    const q = faltantesSearch.trim().toLowerCase();
    return compAtiva.faltantes.filter((f) => {
      if (faltantesSetor !== "TODOS" && f.setor !== faltantesSetor) return false;
      if (!q) return true;
      const rev = faltantesVisibleCpfs[f.chaveUnica] ? faltantesRevealedCpfs[f.chaveUnica] : "";
      return (
        f.nome.toLowerCase().includes(q) ||
        f.setor.toLowerCase().includes(q) ||
        (f.registroGestor != null && String(f.registroGestor).includes(q.replace(/^#/, ""))) ||
        (f.cpfMascarado && f.cpfMascarado.toLowerCase().includes(q)) ||
        (rev && (rev.includes(q) || rev.replace(/\D/g, "").includes(q)))
      );
    });
  }, [compAtiva, faltantesSearch, faltantesSetor, faltantesVisibleCpfs, faltantesRevealedCpfs]);

  const handleToggleFaltanteCpf = async (f: ColaboradorFaltanteHolerite) => {
    if (!canRevealCpf) return;
    const key = f.chaveUnica;
    if (faltantesVisibleCpfs[key]) {
      setFaltantesVisibleCpfs((prev) => ({ ...prev, [key]: false }));
      return;
    }
    if (faltantesRevealedCpfs[key]) {
      setFaltantesVisibleCpfs((prev) => ({ ...prev, [key]: true }));
      return;
    }

    setFaltantesRevealingKey(key);
    try {
      const res = await revelarCpfHoleriteAction({
        usuarioId: f.usuarioId,
        registroGestor: f.registroGestor ?? null,
        colaboradorNome: f.nome,
      });
      if (res.success && res.cpf) {
        setFaltantesRevealedCpfs((prev) => ({ ...prev, [key]: res.cpf! }));
        setFaltantesVisibleCpfs((prev) => ({ ...prev, [key]: true }));
      } else {
        toast.error(res.erro || "CPF completo não localizado no cadastro GESTOR.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao consultar CPF.");
    } finally {
      setFaltantesRevealingKey(null);
    }
  };

  const handleToggleAllFaltantesCpf = async () => {
    if (!canRevealCpf || filteredFaltantes.length === 0) return;
    const allVis = filteredFaltantes.every(
      (f) => Boolean(faltantesVisibleCpfs[f.chaveUnica] && faltantesRevealedCpfs[f.chaveUnica])
    );
    if (allVis) {
      setFaltantesVisibleCpfs({});
      return;
    }

    setFaltantesRevealingAll(true);
    try {
      const pendentes = filteredFaltantes.filter((f) => !faltantesRevealedCpfs[f.chaveUnica]);
      let novos: Record<string, string> = {};
      if (pendentes.length > 0) {
        const res = await revelarCpfsEmLoteHoleritesAction({
          itens: pendentes.map((f) => ({
            id: f.chaveUnica,
            colaboradorNome: f.nome,
            usuarioId: f.usuarioId,
            registroGestor: f.registroGestor ?? null,
          })),
        });
        novos = res.cpfsPorItemId || {};
      }
      const merged = { ...faltantesRevealedCpfs, ...novos };
      setFaltantesRevealedCpfs(merged);
      const nextVis: Record<string, boolean> = { ...faltantesVisibleCpfs };
      for (const f of filteredFaltantes) {
        if (merged[f.chaveUnica]) nextVis[f.chaveUnica] = true;
      }
      setFaltantesVisibleCpfs(nextVis);
    } catch {
      toast.error("Erro ao revelar CPFs dos colaboradores faltantes.");
    } finally {
      setFaltantesRevealingAll(false);
    }
  };

  const handleCopyExpectedPdfFilename = async (f: ColaboradorFaltanteHolerite) => {
    if (!compAtiva) return;
    const key = f.chaveUnica;
    const sufixo =
      compAtiva.mes === 13
        ? `13-1-${compAtiva.ano}`
        : compAtiva.mes === 14
        ? `13-2-${compAtiva.ano}`
        : `${String(compAtiva.mes).padStart(2, "0")}-${compAtiva.ano}`;

    let cpfFmt = faltantesRevealedCpfs[key];
    if (!cpfFmt && canRevealCpf && f.temCpfCadastrado) {
      setCopyingFilenameKey(key);
      try {
        const res = await revelarCpfHoleriteAction({
          usuarioId: f.usuarioId,
          registroGestor: f.registroGestor ?? null,
          colaboradorNome: f.nome,
        });
        if (res.success && res.cpf) {
          cpfFmt = res.cpf;
          setFaltantesRevealedCpfs((prev) => ({ ...prev, [key]: res.cpf! }));
        }
      } finally {
        setCopyingFilenameKey(null);
      }
    }

    const digits = (cpfFmt || "").replace(/\D/g, "");
    if (digits.length !== 11) {
      toast.error("Colaborador sem CPF de 11 dígitos cadastrado no GESTOR.");
      return;
    }

    const fileName = `${digits}_${sufixo}.pdf`;
    await handleCopyText(fileName, `fn_${key}`, `Nome exato copiado: ${fileName}`);
  };

  const handleSalvarDispensaLegal = async () => {
    if (!dispensaModalColab || !compAtiva) return;
    setSalvandoDispensa(true);
    try {
      const res = await registrarDispensaLegalHoleriteAction({
        usuarioId: dispensaModalColab.usuarioId,
        registroGestor: dispensaModalColab.registroGestor,
        colaboradorNome: dispensaModalColab.nome,
        ano: compAtiva.ano,
        mes: compAtiva.mes,
        motivoCodigo: dispensaMotivo,
        descricao: dispensaDescricao,
      });
      if (!res.success) {
        toast.error(res.erro || "Falha ao registrar dispensa legal.");
        return;
      }
      toast.success(
        `Ausência legal de ${dispensaModalColab.nome} registrada na competência ${compAtiva.codigo} (WORM).`
      );
      setDispensaModalColab(null);
      setDispensaDescricao("");
      await carregarTudo(anoSelecionado, true);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar justificativa legal.");
    } finally {
      setSalvandoDispensa(false);
    }
  };

  const handleRemoverDispensa = async (id: string) => {
    try {
      await removerDispensaLegalHoleriteAction(id);
      toast.success("Dispensa legal removida e colaborador retornado à lista de elegíveis.");
      await carregarTudo(anoSelecionado, true);
    } catch {
      toast.error("Erro ao remover dispensa legal.");
    }
  };

  // ── Homologação CLT & Auditoria SHA-256 ───────────────────────────────────
  const handleHomologarCompetencia = async () => {
    if (!compAtiva) return;
    if (
      compAtiva.faltantesCount > 0 &&
      !confirm(
        `Atenção: ainda constam ${compAtiva.faltantesCount} colaborador(es) sem holerite ou justificativa na competência ${compAtiva.codigo}. Deseja homologar parcialmente mesmo assim com registro na trilha WORM?`
      )
    ) {
      return;
    }

    setHomologando(true);
    try {
      const res = await homologarCompetenciaHoleritesAction({
        ano: compAtiva.ano,
        mes: compAtiva.mes,
        observacoes: homologacaoObs,
      });
      if (!res.success) {
        toast.error(res.erro || "Não foi possível homologar a competência.");
        return;
      }
      toast.success(
        `Competência ${compAtiva.codigo} homologada com sucesso! Manifesto SHA-256 gravado na trilha WORM.`
      );
      setHomologacaoObs("");
      await carregarTudo(anoSelecionado, true);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao homologar competência.");
    } finally {
      setHomologando(false);
    }
  };

  const handleReabrirCompetencia = async () => {
    if (!compAtiva) return;
    if (
      !confirm(
        `Deseja reabrir administrativamente a competência ${compAtiva.codigo} para envio complementar ou retificação?`
      )
    ) {
      return;
    }
    setReabrindo(true);
    try {
      await reabrirCompetenciaHoleritesAction({
        ano: compAtiva.ano,
        mes: compAtiva.mes,
      });
      toast.success(`Competência ${compAtiva.codigo} reaberta para retificação.`);
      await carregarTudo(anoSelecionado, true);
    } catch {
      toast.error("Erro ao reabrir competência.");
    } finally {
      setReabrindo(false);
    }
  };

  const handleAuditarIntegridade = async () => {
    setAuditandoStorage(true);
    try {
      const res = await auditarIntegridadeStorageHoleritesAction({
        ano: selectedMes !== null ? anoSelecionado : null,
        mes: selectedMes,
      });
      setResultadoAuditoria(res);
      if (res.success) {
        toast.success(
          `Integridade 100% confirmada: ${res.integros}/${res.verificados} PDF(s) verificados no Storage e SHA-256 (WORM).`
        );
      } else {
        toast.warning(
          `Auditoria concluída com ${res.inconsistencias.length} alerta(s) em ${res.verificados} registro(s).`
        );
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao auditar integridade do Storage.");
    } finally {
      setAuditandoStorage(false);
    }
  };

  // Diretório de CPFs do Cadastro GESTOR
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
      await carregarTudo(anoSelecionado, true);
      router.refresh();
    } catch {
      toast.error("Erro ao excluir holerite no servidor.");
      await carregarTudo(anoSelecionado, true);
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
      await carregarTudo(anoSelecionado, true);
      router.refresh();
    } catch {
      toast.error("Erro ao excluir holerites em lote.");
      await carregarTudo(anoSelecionado, true);
    }
  };

  const handleExportLogsCsv = () => {
    const selecionados = holeritesList.filter((h) => selectedIds.includes(h.id));
    if (selecionados.length === 0) return;
    const headers = [
      "Colaborador",
      "Registro GESTOR",
      "CPF (LGPD)",
      "Competencia",
      "Prazo Legal CLT",
      "Tempestividade CLT",
      "Data Upload",
      "Enviado Por",
      "Visualizacoes",
      "Hash SHA-256",
    ];
    const rows = selecionados.map((s) =>
      [
        s.colaborador,
        s.registroGestor != null ? `#${s.registroGestor}` : "",
        s.cpfMascarado,
        s.mesAno,
        s.prazoLegalCltBr,
        s.entregueNoPrazoClt ? "NO PRAZO CLT" : `APOS PRAZO (+${s.diasAtrasoClt}d)`,
        s.dataUpload,
        s.uploadedBy,
        s.visualizacoes,
        s.hash,
      ]
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

  // Indicadores derivados para a faixa executiva superior
  const totalAtivosServentia = painelGov?.totalColaboradoresAtivos || 65;
  const checklistConcluidosCount = compAtiva
    ? compAtiva.checklist.filter((i) => i.concluido).length
    : 0;

  const getCardBarColor = (c: ResumoCompetenciaHolerite) => {
    if (c.homologada || c.statusPrazo === "COMPLETA_NO_PRAZO") return "bg-emerald-400";
    if (c.statusPrazo === "COMPLETA_COM_ATRASO" || c.statusPrazo === "PRAZO_PROXIMO")
      return "bg-amber-400";
    if (c.statusPrazo === "PENDENTE_ATRASO" && c.arquivadosCount > 0) return "bg-rose-400";
    if (c.arquivadosCount > 0) return "bg-cyan-400";
    return "bg-slate-600";
  };

  return (
    <div className="space-y-6">
      {/* Inputs ocultos para substituição individual e envio direto por linha de faltante */}
      <input
        ref={replaceInputRef}
        type="file"
        accept=".pdf"
        onChange={handleReplaceFileChange}
        className="hidden"
      />
      <input
        ref={rowUploadInputRef}
        type="file"
        accept=".pdf"
        onChange={handleRowFaltanteUploadChange}
        className="hidden"
      />

      {/* ══════════════════════════════════════════════════════════════════════
          FAIXA 1: 3 CARDS EXECUTIVOS INTERATIVOS (PADRÃO FIORIX)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Holerites Disponibilizados (Competência Ativa ou Acervo Geral) */}
        <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {selectedMes !== null ? "Arquivados na Competência" : "Acervo Geral Custodiado"}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                {selectedMes !== null && compAtiva ? compAtiva.codigo : `ACERVO TOTAL`}
              </span>
            </div>
            <div className="text-2xl font-black text-white leading-tight">
              {loadingGov
                ? "..."
                : selectedMes !== null && compAtiva
                ? `${compAtiva.arquivadosCount} ${
                    compAtiva.arquivadosCount === 1 ? "documento" : "documentos"
                  }`
                : `${holeritesList.length} ${
                    holeritesList.length === 1 ? "documento" : "documentos"
                  }`}
            </div>
            <p className="text-xs text-slate-400 truncate">
              {painelGov
                ? `Banco total: ${painelGov.totalHoleritesAcervoGeral} PDF(s) • Hash SHA-256 ativo`
                : "Distribuídos com hash SHA-256 via portal"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-inner">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Cobertura Nominal × Cadastro Oficial GESTOR */}
        <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Cobertura da Folha Ativa
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                GESTOR ({totalAtivosServentia})
              </span>
            </div>
            <div className="text-2xl font-black text-white leading-tight">
              {loadingGov || !compAtiva
                ? "..."
                : `${compAtiva.arquivadosCount + compAtiva.dispensadosCount} / ${
                    compAtiva.elegiveisCount
                  } atendidos`}
            </div>
            {compAtiva && compAtiva.faltantesCount > 0 ? (
              <button
                type="button"
                onClick={() => {
                  if (selectedMes === null) setSelectedMes(compAtiva.mes);
                  setActiveTab("faltantes");
                }}
                className="text-xs text-amber-300 hover:text-amber-200 font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>
                  Faltam {compAtiva.faltantesCount} em {compAtiva.codigo} — conferir faltantes →
                </span>
              </button>
            ) : (
              <p className="text-xs text-emerald-400/90 font-medium">
                100% dos colaboradores elegíveis atendidos em {compAtiva?.codigo}
              </p>
            )}
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Validação Trabalhista CLT (Art. 459 § 1º / 5º Dia Útil) & Custódia WORM */}
        <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Prazo Legal CLT & WORM
              </span>
              {compAtiva && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                    compAtiva.homologada
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : compAtiva.statusPrazo === "PENDENTE_ATRASO"
                      ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                      : compAtiva.statusPrazo === "PRAZO_PROXIMO"
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      : "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                  }`}
                >
                  {compAtiva.homologada
                    ? "HOMOLOGADA"
                    : compAtiva.statusPrazo === "PENDENTE_ATRASO"
                    ? "PRAZO VENCIDO"
                    : compAtiva.statusPrazo === "PRAZO_PROXIMO"
                    ? "PRAZO PRÓXIMO"
                    : "ART. 459 §1º CLT"}
                </span>
              )}
            </div>
            <div className="text-2xl font-black text-white leading-tight">
              {compAtiva ? `Até ${compAtiva.prazoClt.dataLimiteBr}` : "Custódia ativa"}
            </div>
            <button
              type="button"
              onClick={() => {
                if (compAtiva && selectedMes === null) setSelectedMes(compAtiva.mes);
                setActiveTab("checklist_clt");
              }}
              className="text-xs text-slate-400 hover:text-cyan-300 transition-colors text-left truncate block max-w-full cursor-pointer"
            >
              {compAtiva?.prazoClt.caiNoSabado && compAtiva.prazoClt.sextaBancariaRecomendadaBr
                ? `Sábado útil • Bancos até sexta (${compAtiva.prazoClt.sextaBancariaRecomendadaBr})`
                : `Checklist CLT: ${checklistConcluidosCount}/5 itens validados →`}
            </button>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          FAIXA 2: MAPA ANUAL & MENSAL DE COMPETÊNCIAS (CADASTRO ESTRUTURADO)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between px-6 py-4 gap-3.5 border-b border-white/10 bg-[#0B1020]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Cadastro Anual & Mensal de Holerites · {anoSelecionado}
              </h2>
              <p className="text-xs text-slate-400">
                Selecione uma competência para auditar entregas no prazo CLT, colaboradores faltantes ou abrir o Dossiê da Corregedoria
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Ano */}
            <div className="inline-flex items-center h-9 bg-[#080D1A] border border-white/15 rounded-xl px-3 gap-2">
              <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <select
                aria-label="Selecionar ano do cadastro de holerites"
                value={anoSelecionado}
                onChange={(e) => handleTrocarAno(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1"
              >
                {(
                  painelGov?.anosDisponiveis || [
                    anoSelecionado + 1,
                    anoSelecionado,
                    anoSelecionado - 1,
                  ]
                ).map((a) => (
                  <option key={a} value={a} className="bg-[#0B1020] text-white">
                    Ano {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Botão Mostrar Todo o Acervo */}
            <button
              type="button"
              onClick={() => {
                setSelectedMes(null);
                setActiveTab("arquivados");
              }}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                selectedMes === null
                  ? "bg-cyan-500/20 border-cyan-500/45 text-cyan-200 shadow-xs"
                  : "bg-[#080D1A] border-white/15 text-slate-300 hover:text-white hover:bg-[#0E1528]"
              }`}
              title="Exibir todos os holerites armazenados de todos os meses e anos"
            >
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Mostrar Todo o Acervo ({holeritesList.length})</span>
            </button>

            {/* Botão Auditar Integridade SHA-256 & Storage */}
            <button
              type="button"
              onClick={handleAuditarIntegridade}
              disabled={auditandoStorage}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold text-emerald-300 transition-all cursor-pointer"
              title="Verificar presença física no Supabase Storage privado e integridade dos hashes SHA-256"
            >
              {auditandoStorage ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileCheck2 className="w-3.5 h-3.5" />
              )}
              <span>Auditar SHA-256</span>
            </button>

            {/* Botão Dossiê Corregedoria */}
            <button
              type="button"
              onClick={() => setDossieOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-indigo-500/40 bg-indigo-600/25 hover:bg-indigo-600/40 text-xs font-bold text-indigo-200 transition-all cursor-pointer"
              title="Abrir Banco de Dados Completo & Certidão para Corregedoria (CGJ-SP / CNJ)"
            >
              <Scale className="w-3.5 h-3.5 text-indigo-300" />
              <span>Dossiê Corregedoria</span>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Grade dos 12 Meses (JAN..DEZ) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2.5">
            {competenciasMensais.map((c) => {
              const isSelected = selectedMes === c.mes;
              const atendidos = c.arquivadosCount + c.dispensadosCount;
              return (
                <div key={c.mes} className="flex flex-col items-stretch gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedMes(isSelected ? null : c.mes)}
                    className={`rounded-2xl p-3 text-left transition-all border cursor-pointer ${
                      isSelected
                        ? "bg-cyan-500/15 border-cyan-400/60 ring-1 ring-cyan-400/40 shadow-sm"
                        : "bg-[#080D1A] border-white/10 hover:border-white/25 hover:bg-[#0E1528]/70"
                    }`}
                    title={`${c.titulo} • Limite CLT: ${c.prazoClt.dataLimiteBr} • ${atendidos}/${c.elegiveisCount} atendidos`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`text-[11px] font-mono font-extrabold tracking-wider ${
                          isSelected ? "text-cyan-300" : "text-slate-400"
                        }`}
                      >
                        {c.sigla}
                      </span>
                      {c.homologada ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : c.statusPrazo === "PENDENTE_ATRASO" && c.arquivadosCount > 0 ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : null}
                    </div>

                    <div className="text-base font-black text-white mt-1">
                      {c.percentualCobertura}%
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full transition-all ${getCardBarColor(c)}`}
                        style={{
                          width: `${
                            c.arquivadosCount > 0 || c.dispensadosCount > 0
                              ? Math.max(8, c.percentualCobertura)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </button>

                  {/* Pílula elegante abaixo de cada card mensal */}
                  <div
                    className={`px-2 py-1 rounded-full text-center text-[10px] font-mono font-semibold border truncate ${
                      c.arquivadosCount > 0 || c.dispensadosCount > 0
                        ? "bg-cyan-500/10 border-cyan-500/25 text-cyan-300"
                        : "bg-white/[0.02] border-white/8 text-slate-500"
                    }`}
                    title={`Prazo CLT: ${c.prazoClt.dataLimiteBr}`}
                  >
                    {atendidos}/{c.elegiveisCount} env.
                  </div>
                </div>
              );
            })}
          </div>

          {/* Faixa Complementar de 13º Salário (Lei 4.749/1965) */}
          {competenciasDecimo.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
              {competenciasDecimo.map((c) => {
                const isSelected = selectedMes === c.mes;
                const atendidos = c.arquivadosCount + c.dispensadosCount;
                return (
                  <button
                    key={c.mes}
                    type="button"
                    onClick={() => setSelectedMes(isSelected ? null : c.mes)}
                    className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-indigo-500/15 border-indigo-400/60 text-white"
                        : "bg-[#080D1A] border-white/10 hover:border-white/20 text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
                        {c.sigla}
                      </span>
                      <span className="text-xs font-bold text-white truncate">{c.titulo}</span>
                      <span className="hidden sm:inline text-[11px] font-mono text-slate-400">
                        • Limite Legal: {c.prazoClt.dataLimiteBr}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-cyan-300 shrink-0">
                      {atendidos}/{c.elegiveisCount} ({c.percentualCobertura}%)
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Banner de Resultado da Auditoria Técnica SHA-256 (quando acionada) */}
          {resultadoAuditoria && (
            <div
              className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-2xl border text-xs ${
                resultadoAuditoria.success
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-200"
              }`}
            >
              <div className="flex items-start sm:items-center gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                <div>
                  <strong>
                    Auditoria Técnica Concluída ({resultadoAuditoria.verificadoEmBr}):
                  </strong>{" "}
                  {resultadoAuditoria.integros} de {resultadoAuditoria.verificados} documento(s)
                  com presença física verificada no Storage privado e hash SHA-256 válido.{" "}
                  <span className="font-mono text-[11px] opacity-80">
                    Protocolo WORM: {resultadoAuditoria.protocoloHash.slice(0, 16)}...
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResultadoAuditoria(null)}
                className="text-slate-300 hover:text-white text-[11px] font-semibold shrink-0 cursor-pointer"
              >
                Ocultar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          FAIXA 3: CARD DE UPLOAD EM LOTE 1-PARA-1 POR CPF + DIAGNÓSTICO CLT
      ══════════════════════════════════════════════════════════════════════ */}
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
                Nomenclatura obrigatória:{" "}
                <code className="text-cyan-300 font-mono font-semibold">CPF_MM-AAAA.pdf</code> (ou{" "}
                <code className="text-indigo-300 font-mono font-semibold">CPF_13-1-AAAA.pdf</code>{" "}
                para 13º) • Validação automática do 5º dia útil CLT
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
          <div className="relative border-2 border-dashed border-white/15 hover:border-cyan-500/45 rounded-2xl p-7 flex flex-col items-center justify-center transition-all bg-[#080D1A] hover:bg-[#0E1528]/70 group cursor-pointer">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <UploadCloud className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-white text-center">
              Arraste os arquivos PDF ou clique para selecionar
            </p>
            <p className="text-xs text-slate-400 mt-1 text-center">
              Até 5MB por arquivo • CPFs divergentes ou de ex-colaboradores desligados são bloqueados automaticamente
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
            <div className="p-4 bg-[#080D1A] border border-cyan-500/30 rounded-2xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs text-slate-200 font-medium">
                  <strong className="text-cyan-400 font-bold">{files.length}</strong>{" "}
                  {files.length === 1
                    ? "arquivo PDF selecionado para validação 1-para-1 e checagem CLT"
                    : "arquivos PDF selecionados para validação 1-para-1 e checagem CLT"}
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
                        <span>Validando CPF & Prazo CLT...</span>
                      </>
                    ) : (
                      <span>Confirmar Upload em Lote</span>
                    )}
                  </Button>
                </div>
              </div>

              <div className="pt-2 border-t border-white/8 flex flex-col sm:flex-row sm:items-center gap-2">
                <span className="text-[11px] text-slate-400 shrink-0">
                  Observação / justificativa de retificação (opcional):
                </span>
                <Input
                  value={justificativaAtrasoInput}
                  onChange={(e) => setJustificativaAtrasoInput(e.target.value)}
                  placeholder="Ex: Reenvio retificador / admissão complementar..."
                  className="h-8 bg-[#0B1020] border-white/10 text-xs text-white rounded-xl"
                />
              </div>
            </div>
          )}

          {/* Diagnóstico Inteligente Pós-Upload */}
          {uploadReport && uploadReport.length > 0 && (
            <div className="rounded-2xl border border-white/15 bg-[#080D1A] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Diagnóstico de Envio · Validação 1-para-1 & Prazo Trabalhista CLT
                </span>
                <div className="flex items-center gap-3">
                  {compAtiva && compAtiva.faltantesCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("faltantes")}
                      className="text-xs font-bold text-amber-300 hover:text-amber-200 cursor-pointer"
                    >
                      Ver {compAtiva.faltantesCount} faltante(s) em {compAtiva.codigo} →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setUploadReport(null)}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer"
                  >
                    Fechar resumo
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto">
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
                              ? `Vinculado a ${r.colaborador} • Competência ${r.competencia}${
                                  r.prazoLegalClt
                                    ? r.noPrazoClt !== false
                                      ? ` • Entregue NO PRAZO CLT (limite ${r.prazoLegalClt})`
                                      : ` • Entregue +${r.diasAtrasoClt}d após limite CLT (${r.prazoLegalClt})`
                                    : ""
                                }`
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

      {/* ══════════════════════════════════════════════════════════════════════
          FAIXA 4: CENTRAL OPERACIONAL (ARQUIVADOS | FALTANTES | CHECKLIST CLT)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 backdrop-blur-xl shadow-sm overflow-hidden">
        {/* Cabeçalho de Abas e Controles Contextuais */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between px-6 py-4 gap-4 border-b border-white/10 bg-[#0B1020]/80">
          {/* Segmented Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("arquivados")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activeTab === "arquivados"
                  ? "bg-indigo-500/20 border-indigo-400/50 text-white shadow-xs"
                  : "bg-[#080D1A] border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                Arquivados{" "}
                {selectedMes !== null && compAtiva
                  ? `em ${compAtiva.codigo} (${filteredHolerites.length})`
                  : `no Acervo (${filteredHolerites.length})`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedMes === null && compAtiva) setSelectedMes(compAtiva.mes);
                setActiveTab("faltantes");
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activeTab === "faltantes"
                  ? "bg-amber-500/20 border-amber-400/50 text-amber-100 shadow-xs"
                  : "bg-[#080D1A] border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <UserX className="w-3.5 h-3.5 text-amber-400" />
              <span>
                Faltantes em {compAtiva?.codigo || "..."} ({compAtiva?.faltantesCount ?? 0})
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (selectedMes === null && compAtiva) setSelectedMes(compAtiva.mes);
                setActiveTab("checklist_clt");
              }}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                activeTab === "checklist_clt"
                  ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-100 shadow-xs"
                  : "bg-[#080D1A] border-white/10 text-slate-400 hover:text-white"
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Checklist CLT & Homologação ({checklistConcluidosCount}/5)
              </span>
            </button>
          </div>

          {/* Controles da Aba "Arquivados" */}
          {activeTab === "arquivados" && (
            <div className="flex flex-wrap items-center gap-2.5">
              {selectedMes !== null && compAtiva && (
                <button
                  type="button"
                  onClick={() => setSelectedMes(null)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-300 hover:bg-cyan-500/25 cursor-pointer"
                  title="Remover filtro do mês e exibir todo o acervo"
                >
                  <span>Filtro: {compAtiva.codigo}</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {canRevealCpf && filteredHolerites.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllRowsCpf}
                  disabled={revealingAllCpfs}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-white/15 bg-[#080D1A] hover:bg-[#0E1528] text-xs font-semibold text-cyan-300 transition-all cursor-pointer"
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
                    const [f, d] = e.target.value.split(":") as [
                      HoleriteSortField,
                      SortDirection,
                    ];
                    setSortField(f);
                    setSortDir(d);
                  }}
                  className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1"
                >
                  <option value="dataUpload:desc" className="bg-[#0B1020] text-white">
                    Ordenar: Data Upload (Recente)
                  </option>
                  <option value="dataUpload:asc" className="bg-[#0B1020] text-white">
                    Ordenar: Data Upload (Antiga)
                  </option>
                  <option value="colaborador:asc" className="bg-[#0B1020] text-white">
                    Ordenar: Colaborador (A–Z)
                  </option>
                  <option value="colaborador:desc" className="bg-[#0B1020] text-white">
                    Ordenar: Colaborador (Z–A)
                  </option>
                  <option value="competencia:desc" className="bg-[#0B1020] text-white">
                    Ordenar: Competência (Recente)
                  </option>
                  <option value="competencia:asc" className="bg-[#0B1020] text-white">
                    Ordenar: Competência (Antiga)
                  </option>
                  <option value="prazoClt:asc" className="bg-[#0B1020] text-white">
                    Ordenar: Prazo CLT (No Prazo primeiro)
                  </option>
                  <option value="prazoClt:desc" className="bg-[#0B1020] text-white">
                    Ordenar: Prazo CLT (Após Prazo primeiro)
                  </option>
                  <option value="cpf:asc" className="bg-[#0B1020] text-white">
                    Ordenar: CPF (Crescente)
                  </option>
                  <option value="cpf:desc" className="bg-[#0B1020] text-white">
                    Ordenar: CPF (Decrescente)
                  </option>
                  <option value="uploadedBy:asc" className="bg-[#0B1020] text-white">
                    Ordenar: Enviado Por (A–Z)
                  </option>
                  <option value="visualizacoes:desc" className="bg-[#0B1020] text-white">
                    Ordenar: Visualizações (Maior)
                  </option>
                  <option value="status:asc" className="bg-[#0B1020] text-white">
                    Ordenar: Status (A–Z)
                  </option>
                </select>
              </div>

              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar nome, CPF, hash..."
                  className="bg-[#080D1A] border border-white/15 pl-9 text-xs h-9 rounded-xl text-white placeholder:text-slate-500 focus:border-cyan-500/50"
                />
              </div>
            </div>
          )}

          {/* Controles da Aba "Faltantes" */}
          {activeTab === "faltantes" && compAtiva && (
            <div className="flex flex-wrap items-center gap-2.5">
              {canRevealCpf && filteredFaltantes.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllFaltantesCpf}
                  disabled={faltantesRevealingAll}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-white/15 bg-[#080D1A] hover:bg-[#0E1528] text-xs font-semibold text-cyan-300 transition-all cursor-pointer"
                >
                  {faltantesRevealingAll ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                  <span>Ver / Ocultar CPFs</span>
                </button>
              )}

              <select
                aria-label="Filtrar faltantes por setor"
                value={faltantesSetor}
                onChange={(e) => setFaltantesSetor(e.target.value)}
                className="h-9 bg-[#080D1A] border border-white/15 rounded-xl px-3 text-xs font-semibold text-white"
              >
                <option value="TODOS">Todos os Setores</option>
                {setoresFaltantes.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={faltantesSearch}
                  onChange={(e) => setFaltantesSearch(e.target.value)}
                  placeholder="Buscar colaborador faltante..."
                  className="bg-[#080D1A] border border-white/15 pl-9 text-xs h-9 rounded-xl text-white placeholder:text-slate-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── CONTEÚDO DA ABA 1: ARQUIVADOS ─────────────────────────────── */}
        {activeTab === "arquivados" && (
          <div className="p-4 sm:p-5 space-y-4">
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

            <div className="border border-white/10 rounded-2xl overflow-x-auto bg-[#080D1A]">
              <table className="w-full text-left text-xs min-w-[960px]">
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
                      >
                        <span>Competência</span>
                        {renderSortIcon("competencia")}
                      </button>
                    </th>
                    <th className="px-3.5 py-3.5 font-bold whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleSort("prazoClt")}
                        className={`group/th inline-flex items-center gap-1.5 uppercase tracking-wider cursor-pointer transition-colors ${
                          sortField === "prazoClt" ? "text-cyan-300" : "hover:text-white"
                        }`}
                      >
                        <span>Prazo CLT</span>
                        {renderSortIcon("prazoClt")}
                      </button>
                    </th>
                    <th className="px-3.5 py-3.5 font-bold whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleSort("dataUpload")}
                        className={`group/th inline-flex items-center gap-1.5 uppercase tracking-wider cursor-pointer transition-colors ${
                          sortField === "dataUpload" ? "text-cyan-300" : "hover:text-white"
                        }`}
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
                      >
                        <span>Status</span>
                        {renderSortIcon("status")}
                      </button>
                    </th>
                    <th className="pl-2 pr-4 py-3.5 font-bold text-right whitespace-nowrap">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8 text-slate-200">
                  {loadingList ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center text-slate-400">
                        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin mx-auto mb-2" />
                        <span>Carregando holerites armazenados...</span>
                      </td>
                    </tr>
                  ) : filteredHolerites.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2.5">
                          <FileText className="w-8 h-8 text-slate-600" />
                          <p className="font-semibold text-sm text-slate-300">
                            {selectedMes !== null && compAtiva
                              ? `Nenhum holerite arquivado na competência ${compAtiva.codigo}`
                              : "Nenhum holerite encontrado"}
                          </p>
                          <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                            {selectedMes !== null && holeritesList.length > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedMes(null)}
                                className="h-8 rounded-xl bg-white/5 border-white/15 text-xs text-cyan-300 cursor-pointer"
                              >
                                Mostrar Todo o Acervo ({holeritesList.length})
                              </Button>
                            )}
                            {compAtiva && compAtiva.faltantesCount > 0 && (
                              <Button
                                size="sm"
                                onClick={() => setActiveTab("faltantes")}
                                className="h-8 rounded-xl bg-amber-500/20 border border-amber-500/35 text-xs text-amber-200 font-bold cursor-pointer"
                              >
                                Ver {compAtiva.faltantesCount} Colaboradores Elegíveis desta Competência
                              </Button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredHolerites.map((item) => {
                      const isSelected = selectedIds.includes(item.id);
                      const isCpfRevealed = Boolean(
                        visibleCpfIds[item.id] && revealedCpfs[item.id]
                      );
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
                                  onClick={() =>
                                    handleCopyCpf(revealedCpfs[item.id], item.id, true)
                                  }
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

                          {/* Nova Coluna: Validação do Prazo Legal CLT */}
                          <td className="px-3.5 py-3.5 whitespace-nowrap">
                            {item.entregueNoPrazoClt ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  <CheckCircle2 className="w-3 h-3" />
                                  NO PRAZO CLT
                                </span>
                                <div className="text-[10px] font-mono text-slate-400">
                                  Limite: {item.prazoLegalCltBr}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                  title={item.justificativaAtraso || undefined}
                                >
                                  <Clock className="w-3 h-3" />
                                  +{item.diasAtrasoClt}d APÓS PRAZO
                                </span>
                                <div className="text-[10px] font-mono text-slate-400">
                                  Limite: {item.prazoLegalCltBr}
                                </div>
                              </div>
                            )}
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
                                  item.status === "Visualizado"
                                    ? "bg-emerald-400"
                                    : "bg-slate-400"
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
                                    uploading && replacingItem?.id === item.id
                                      ? "animate-spin"
                                      : ""
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
        )}

        {/* ── CONTEÚDO DA ABA 2: ASSISTENTE DE FALTANTES ("QUEM FALTOU?") ── */}
        {activeTab === "faltantes" && compAtiva && (
          <div className="p-4 sm:p-5 space-y-5">
            {/* Banner Resumo Inteligente da Competência */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-2xl border border-white/10 bg-[#080D1A]">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">
                    Conferência Nominal de Cobertura · {compAtiva.titulo}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    Prazo CLT: {compAtiva.prazoClt.dataLimiteBr}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Cruzamento automático entre a base ativa do GESTOR ({compAtiva.elegiveisCount}{" "}
                  elegíveis admitidos até o fim da competência, já descontados desligados) e os PDFs
                  custodiados ({compAtiva.arquivadosCount} enviados
                  {compAtiva.dispensadosCount > 0
                    ? ` + ${compAtiva.dispensadosCount} ausência(s) legal(is) justificada(s)`
                    : ""}
                  ).
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border ${
                    compAtiva.faltantesCount === 0
                      ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                      : "bg-amber-500/15 border-amber-500/30 text-amber-200"
                  }`}
                >
                  {compAtiva.faltantesCount === 0
                    ? "0 Faltantes (100% Coberto)"
                    : `${compAtiva.faltantesCount} Faltante(s)`}
                </span>
              </div>
            </div>

            {/* Tabela de Colaboradores Faltantes */}
            {compAtiva.faltantesCount === 0 ? (
              <div className="p-10 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="text-base font-bold text-white">
                  Todos os colaboradores elegíveis foram atendidos em {compAtiva.codigo}!
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Não há nenhum holerite pendente nesta competência. Você já pode acessar a aba{" "}
                  <strong className="text-emerald-300">Checklist CLT & Homologação</strong> para
                  encerrar formalmente a folha.
                </p>
              </div>
            ) : (
              <div className="border border-white/10 rounded-2xl overflow-x-auto bg-[#080D1A]">
                <table className="w-full text-left text-xs min-w-[900px]">
                  <thead className="bg-[#0E1528] text-slate-400 uppercase font-mono text-[11px] border-b border-white/10">
                    <tr>
                      <th className="px-4 py-3.5 font-bold">Colaborador sem Holerite</th>
                      <th className="px-3.5 py-3.5 font-bold">Setor / Admissão</th>
                      <th className="px-3.5 py-3.5 font-bold">CPF (LGPD)</th>
                      <th className="px-3.5 py-3.5 font-bold">Nomenclatura Esperada do PDF</th>
                      <th className="px-4 py-3.5 font-bold text-right">Ações Inteligentes RH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/8 text-slate-200">
                    {filteredFaltantes.map((f) => {
                      const isRev = Boolean(
                        faltantesVisibleCpfs[f.chaveUnica] && faltantesRevealedCpfs[f.chaveUnica]
                      );
                      const cpfDisplay = isRev
                        ? faltantesRevealedCpfs[f.chaveUnica]
                        : f.cpfMascarado || "Sem CPF";
                      const digitsRev = (faltantesRevealedCpfs[f.chaveUnica] || "").replace(
                        /\D/g,
                        ""
                      );
                      const sufixo =
                        compAtiva.mes === 13
                          ? `13-1-${compAtiva.ano}`
                          : compAtiva.mes === 14
                          ? `13-2-${compAtiva.ano}`
                          : `${String(compAtiva.mes).padStart(2, "0")}-${compAtiva.ano}`;
                      const nomePdfExato =
                        isRev && digitsRev.length === 11
                          ? `${digitsRev}_${sufixo}.pdf`
                          : f.padraoArquivoSugerido;

                      return (
                        <tr key={f.chaveUnica} className="hover:bg-white/[0.03]">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white">{f.nome}</span>
                              {f.registroGestor != null && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                                  <Hash className="w-2.5 h-2.5" />
                                  {f.registroGestor}
                                </span>
                              )}
                              {f.emFeriasNoMes && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                                  title="Colaborador possui programação de férias neste mês"
                                >
                                  <Palmtree className="w-3 h-3" />
                                  Em Férias no mês
                                </span>
                              )}
                            </div>
                            {f.cargo && (
                              <div className="text-[11px] text-slate-400">{f.cargo}</div>
                            )}
                          </td>

                          <td className="px-3.5 py-3.5 whitespace-nowrap">
                            <div className="font-medium text-slate-200">{f.setor}</div>
                            {f.dataAdmissaoBr && (
                              <div className="text-[11px] font-mono text-slate-400">
                                Adm. {f.dataAdmissaoBr}
                              </div>
                            )}
                          </td>

                          <td className="px-3.5 py-3.5 font-mono whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <span className={isRev ? "text-white font-bold" : "text-slate-400"}>
                                {cpfDisplay}
                              </span>
                              {canRevealCpf && f.temCpfCadastrado && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleFaltanteCpf(f)}
                                  disabled={faltantesRevealingKey === f.chaveUnica}
                                  className="p-1 rounded text-cyan-400 hover:text-cyan-300 hover:bg-white/8 cursor-pointer"
                                  title={isRev ? "Ocultar CPF" : "Ver CPF completo (auditado LGPD)"}
                                >
                                  {faltantesRevealingKey === f.chaveUnica ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : isRev ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="px-3.5 py-3.5 font-mono whitespace-nowrap">
                            <div className="inline-flex items-center gap-2">
                              <code className="px-2 py-1 rounded-lg bg-[#0B1020] border border-white/10 text-cyan-300 text-[11px]">
                                {nomePdfExato}
                              </code>
                              {canRevealCpf && f.temCpfCadastrado && (
                                <button
                                  type="button"
                                  onClick={() => handleCopyExpectedPdfFilename(f)}
                                  disabled={copyingFilenameKey === f.chaveUnica}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/10 text-[11px] font-sans font-semibold text-slate-200 cursor-pointer"
                                  title="Copiar o nome exato do PDF com os 11 dígitos do CPF para renomear o arquivo"
                                >
                                  {copyingFilenameKey === f.chaveUnica ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : copiedId === `fn_${f.chaveUnica}` ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-cyan-400" />
                                  )}
                                  <span>Copiar Nome</span>
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {canManageGovernance && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFaltanteUploadAlvo(f);
                                      rowUploadInputRef.current?.click();
                                    }}
                                    disabled={uploading}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold cursor-pointer"
                                    title="Selecionar e enviar o PDF deste colaborador agora"
                                  >
                                    {uploading &&
                                    faltanteUploadAlvo?.chaveUnica === f.chaveUnica ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <UploadCloud className="w-3.5 h-3.5" />
                                    )}
                                    <span>Enviar PDF</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDispensaModalColab(f);
                                      setDispensaMotivo(
                                        f.emFeriasNoMes
                                          ? "FERIAS_MES_ANTERIOR"
                                          : "AFASTAMENTO_INSS"
                                      );
                                      setDispensaDescricao("");
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/12 text-slate-300 hover:text-white text-[11px] font-semibold cursor-pointer"
                                    title="Registrar justificativa legal para ausência de holerite nesta competência"
                                  >
                                    <span>Justificar Ausência</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Lista de Dispensas / Ausências Legais Já Justificadas na Competência */}
            {compAtiva.dispensas.length > 0 && (
              <div className="rounded-2xl border border-white/10 bg-[#080D1A] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Ausências Legais Justificadas em {compAtiva.codigo} ({compAtiva.dispensas.length})
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">Auditado WORM</span>
                </div>
                <div className="divide-y divide-white/8">
                  {compAtiva.dispensas.map((d) => (
                    <div
                      key={d.id}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-white">{d.colaboradorNome}</span>{" "}
                        <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/25 text-[10px] font-mono font-bold ml-1">
                          {d.motivoLabel}
                        </span>
                        {d.descricao && (
                          <span className="text-slate-400 ml-2">• {d.descricao}</span>
                        )}
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Registrado por {d.registradoPorNome} em {d.criadoEmBr}
                        </div>
                      </div>
                      {canManageGovernance && (
                        <button
                          type="button"
                          onClick={() => handleRemoverDispensa(d.id)}
                          className="text-rose-400 hover:text-rose-300 text-[11px] font-semibold cursor-pointer self-start sm:self-auto"
                        >
                          Remover justificativa
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CONTEÚDO DA ABA 3: CHECKLIST TRABALHISTA CLT & HOMOLOGAÇÃO ── */}
        {activeTab === "checklist_clt" && compAtiva && (
          <div className="p-5 sm:p-6 space-y-5">
            {/* Cabeçalho Normativo da Competência */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#080D1A] p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Scale className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-bold text-white">
                    Validação de Tempestividade Trabalhista · {compAtiva.titulo}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  <strong>Fundamento Legal:</strong> {compAtiva.prazoClt.fundamentoLegal}. A data
                  máxima legal para pagamento e disponibilização dos recibos salariais desta
                  competência é{" "}
                  <strong className="text-cyan-300 font-mono">
                    {compAtiva.prazoClt.dataLimiteBr}
                  </strong>{" "}
                  (considerados os feriados oficiais nacionais, do Estado de SP e do Município de
                  São Paulo).
                </p>
                {compAtiva.prazoClt.caiNoSabado &&
                  compAtiva.prazoClt.sextaBancariaRecomendadaBr && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>
                        <strong>Alerta Preventivo Bancário:</strong> O 5º dia útil recai no sábado (
                        {compAtiva.prazoClt.dataLimiteBr}). Para liquidação bancária sem atraso
                        (Súmula 381 TST), recomenda-se concluir o envio até sexta-feira,{" "}
                        <strong>{compAtiva.prazoClt.sextaBancariaRecomendadaBr}</strong>.
                      </span>
                    </div>
                  )}
              </div>

              {/* Card Status de Homologação */}
              <div
                className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 ${
                  compAtiva.homologada
                    ? "bg-emerald-500/10 border-emerald-500/30"
                    : "bg-[#080D1A] border-white/10"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase font-bold text-slate-400">
                      Status de Fechamento
                    </span>
                    {compAtiva.homologada ? (
                      <Lock className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Unlock className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="text-lg font-black text-white">
                    {compAtiva.homologada ? "Competência Homologada" : "Competência Aberta"}
                  </div>
                  <p className="text-xs text-slate-400">
                    {compAtiva.homologada
                      ? `Encerrada por ${compAtiva.homologadoPorNome} em ${compAtiva.homologadoEmBr}`
                      : `${checklistConcluidosCount} de 5 requisitos concluídos`}
                  </p>
                </div>

                {compAtiva.homologada && compAtiva.manifestHashSha256 && (
                  <div className="p-2 rounded-xl bg-black/30 border border-emerald-500/25 font-mono text-[10px] text-emerald-300 break-all">
                    Manifesto SHA-256: {compAtiva.manifestHashSha256}
                  </div>
                )}
              </div>
            </div>

            {/* Lista dos 5 Itens do Checklist CLT */}
            <div className="space-y-2.5">
              {compAtiva.checklist.map((item) => (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border transition-all ${
                    item.concluido
                      ? "bg-emerald-500/[0.06] border-emerald-500/25"
                      : item.severidade === "alerta"
                      ? "bg-amber-500/[0.07] border-amber-500/30"
                      : "bg-[#080D1A] border-white/10"
                  }`}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border font-mono text-xs font-bold ${
                        item.concluido
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : item.severidade === "alerta"
                          ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                          : "bg-white/5 border-white/15 text-slate-400"
                      }`}
                    >
                      {item.concluido ? <Check className="w-4 h-4" /> : item.ordem}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white">{item.titulo}</div>
                      <p className="text-xs text-slate-400 mt-0.5">{item.descricao}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {item.id === "cobertura_envio" && compAtiva.faltantesCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveTab("faltantes")}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/35 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
                      >
                        Ver {compAtiva.faltantesCount} faltante(s)
                      </button>
                    )}
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border ${
                        item.concluido
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                          : item.severidade === "alerta"
                          ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                          : "bg-white/5 border-white/10 text-slate-300"
                      }`}
                    >
                      {item.statusTexto}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Ação de Homologação Oficial ou Reabertura */}
            {canManageGovernance && (
              <div className="p-4 rounded-2xl border border-white/12 bg-[#080D1A] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {compAtiva.homologada ? (
                  <>
                    <div className="text-xs text-slate-300">
                      Esta competência encontra-se formalmente homologada com ata criptográfica na
                      trilha WORM. Caso precise incluir holerite complementar, reabra a competência.
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setDossieOpen(true)}
                        className="h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1.5 cursor-pointer"
                      >
                        <Scale className="w-3.5 h-3.5" />
                        <span>Emitir Certidão Corregedoria</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={reabrindo}
                        onClick={handleReabrirCompetencia}
                        className="h-9 rounded-xl border-white/15 bg-white/5 hover:bg-white/10 text-slate-200 text-xs cursor-pointer"
                      >
                        {reabrindo ? "Reabrindo..." : "Reabrir Competência"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex-1 space-y-1.5">
                      <label className="text-xs font-bold text-white block">
                        Observações de Fechamento da Competência {compAtiva.codigo} (opcional)
                      </label>
                      <Input
                        value={homologacaoObs}
                        onChange={(e) => setHomologacaoObs(e.target.value)}
                        placeholder="Ex: Folha mensal conferida pelo DP e arquivada integralmente dentro do 5º dia útil CLT..."
                        className="h-9 bg-[#0B1020] border-white/15 text-xs text-white rounded-xl"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleHomologarCompetencia}
                      disabled={
                        homologando ||
                        (compAtiva.arquivadosCount === 0 && compAtiva.dispensadosCount === 0)
                      }
                      className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold gap-2 shadow-sm cursor-pointer shrink-0"
                    >
                      {homologando ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Gerando Manifesto SHA-256...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-4 h-4" />
                          <span>Homologar Competência {compAtiva.codigo} (WORM)</span>
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAIS COMPLEMENTARES
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Modal Dossiê de Rastreabilidade RH & Corregedoria */}
      <DossieCorregedoriaHoleritesModal
        isOpen={dossieOpen}
        initialAno={anoSelecionado}
        onClose={() => setDossieOpen(false)}
        onInspectPdf={(item) => setViewPdfItem(item)}
      />

      {/* Modal Justificar Ausência Legal na Competência */}
      {dispensaModalColab && compAtiva && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setDispensaModalColab(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-[24px] border border-white/15 bg-[#0B1020] shadow-2xl text-white overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0E1528]">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Justificar Ausência Legal de Holerite
                </h3>
                <p className="text-xs text-slate-400">
                  {dispensaModalColab.nome} • Competência {compAtiva.codigo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDispensaModalColab(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 bg-[#080D1A]">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Motivo Legal / Trabalhista *
                </label>
                <select
                  value={dispensaMotivo}
                  onChange={(e) => setDispensaMotivo(e.target.value)}
                  className="w-full h-10 bg-[#0B1020] border border-white/15 rounded-xl px-3 text-xs font-semibold text-white"
                >
                  {OPCOES_MOTIVO_DISPENSA.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Complemento / Observação para Auditoria (opcional)
                </label>
                <Input
                  value={dispensaDescricao}
                  onChange={(e) => setDispensaDescricao(e.target.value)}
                  placeholder="Ex: Afastamento previdenciário a partir de 05/10/2026..."
                  className="bg-[#0B1020] border-white/15 text-xs text-white rounded-xl"
                />
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                O colaborador será contabilizado como ausência legal justificada nesta competência,
                com registro nominal na trilha WORM para eventual conferência da Corregedoria.
              </p>
            </div>

            <div className="px-6 py-3.5 bg-[#0E1528] border-t border-white/10 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setDispensaModalColab(null)}
                className="text-xs text-slate-400 hover:text-white rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={salvandoDispensa}
                onClick={handleSalvarDispensaLegal}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                {salvandoDispensa ? "Registrando..." : "Salvar Justificativa (WORM)"}
              </Button>
            </div>
          </div>
        </div>
      )}

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
                    {viewLogsItem.colaborador} • Competência {viewLogsItem.mesAno} • Limite CLT:{" "}
                    {viewLogsItem.prazoLegalCltBr}
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
