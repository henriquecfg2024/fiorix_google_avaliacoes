"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Users,
  CalendarCheck,
  AlertTriangle,
  Calendar as CalendarIcon,
  Search,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  History,
  X,
  Send,
  ArrowLeft,
  UserCheck,
  Eye,
  EyeOff,
  Columns3,
  Download,
  Hash,
  Loader2,
  UserPlus,
  UserMinus,
  CalendarPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EscalaItem, PublicacaoStatus } from "@/lib/ferias/ferias-repository";
import {
  calcularIdadeCompleta,
  formatarDataGestorBr,
} from "@/lib/ferias/idade-calculator";
import {
  getEscalaAnualAction,
  salvarLancamentoFeriasAction,
  removerLancamentoFeriasAction,
  getColaboradoresDisponiveisAction,
  publicarEscalaAnualAction,
  retirarEscalaDoArAction,
  revelarCpfColaboradorFeriasAction,
  removerColaboradoresDaTelaFeriasAction,
} from "@/app/actions/ferias";
import { LancamentoFeriasModal } from "./LancamentoFeriasModal";
import { HistoricoFeriasModal } from "./HistoricoFeriasModal";
import { FichaColaboradorFeriasModal } from "./FichaColaboradorFeriasModal";
import { NovoColaboradorFeriasModal } from "./NovoColaboradorFeriasModal";
import { toast } from "sonner";

function periodoOverlapMesAno(
  inicio: string | undefined,
  fim: string | undefined,
  anoAlvo: number,
  mes1a12: number
): boolean {
  if (!inicio || !fim) return false;
  const isoIni = inicio.slice(0, 10);
  const isoFim = fim.slice(0, 10);
  const d1 = new Date(`${isoIni}T00:00:00Z`);
  const d2 = new Date(`${isoFim}T23:59:59Z`);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  const startOfMonth = Date.UTC(anoAlvo, mes1a12 - 1, 1, 0, 0, 0);
  const endOfMonth = Date.UTC(anoAlvo, mes1a12, 0, 23, 59, 59);
  return d1.getTime() <= endOfMonth && d2.getTime() >= startOfMonth;
}

function colaboradorEmFeriasNoMes(
  colab: EscalaItem,
  anoAlvo: number,
  mes1a12: number
): boolean {
  return (
    periodoOverlapMesAno(colab.p1Inicio, colab.p1Fim, anoAlvo, mes1a12) ||
    periodoOverlapMesAno(colab.p2Inicio, colab.p2Fim, anoAlvo, mes1a12) ||
    periodoOverlapMesAno(colab.p3Inicio, colab.p3Fim, anoAlvo, mes1a12)
  );
}

interface EscalaAnualClientProps {
  initialAno?: number;
  initialPublicacao?: PublicacaoStatus;
  initialColaboradores?: EscalaItem[];
  userRole?: string;
  isInsideRHPanel?: boolean;
  hideBackButton?: boolean;
  readOnly?: boolean;
  onVoltar?: () => void;
}

const MESES = [
  { id: 1, nome: "Jan", completo: "Janeiro" },
  { id: 2, nome: "Fev", completo: "Fevereiro" },
  { id: 3, nome: "Mar", completo: "Março" },
  { id: 4, nome: "Abr", completo: "Abril" },
  { id: 5, nome: "Mai", completo: "Maio" },
  { id: 6, nome: "Jun", completo: "Junho" },
  { id: 7, nome: "Jul", completo: "Julho" },
  { id: 8, nome: "Ago", completo: "Agosto" },
  { id: 9, nome: "Set", completo: "Setembro" },
  { id: 10, nome: "Out", completo: "Outubro" },
  { id: 11, nome: "Nov", completo: "Novembro" },
  { id: 12, nome: "Dez", completo: "Dezembro" },
];

export function EscalaAnualClient({
  initialAno = 2027,
  initialPublicacao,
  initialColaboradores = [],
  userRole = "RH",
  isInsideRHPanel = false,
  hideBackButton = false,
  readOnly = false,
  onVoltar,
}: EscalaAnualClientProps) {
  const [ano, setAno] = useState(initialAno);
  const [loading, setLoading] = useState(false);
  const [publicacao, setPublicacao] = useState<PublicacaoStatus>(
    initialPublicacao || { ano: initialAno, status: "RASCUNHO" }
  );
  const [colaboradores, setColaboradores] = useState<EscalaItem[]>(initialColaboradores);
  const [colaboradoresDisponiveis, setColaboradoresDisponiveis] = useState<
    Array<{
      id: string;
      name: string;
      email: string;
      setor?: string | null;
      cargo?: string | null;
      dadosGestor?: EscalaItem["dadosGestor"];
    }>
  >([]);

  // Filtros e modo de colunas Gestor
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSetor, setSelectedSetor] = useState("TODOS");
  const [selectedMes, setSelectedMes] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [detalhadoGestor, setDetalhadoGestor] = useState(false);

  // Revelação auditada de CPF (LGPD)
  const canRevealCpf = !readOnly && ["ADMIN", "RH", "MASTER"].includes(userRole);
  const [revealedCpfs, setRevealedCpfs] = useState<Record<string, string>>({});
  const [visibleCpfIds, setVisibleCpfIds] = useState<Record<string, boolean>>({});
  const [revealingCpfId, setRevealingCpfId] = useState<string | null>(null);

  // Modais e seleção nominal
  const [lancamentoModalOpen, setLancamentoModalOpen] = useState(false);
  const [novoColabModalOpen, setNovoColabModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EscalaItem | null>(null);
  const [historicoModalOpen, setHistoricoModalOpen] = useState(false);
  const [historicoItem, setHistoricoItem] = useState<EscalaItem | null>(null);
  const [fichaModalOpen, setFichaModalOpen] = useState(false);
  const [fichaItem, setFichaItem] = useState<EscalaItem | null>(null);

  // Seleção em lote e modal de remoção definitiva de ex-colaboradores do FIORIX
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [removeModalItems, setRemoveModalItems] = useState<EscalaItem[]>([]);
  const [removeMotivo, setRemoveMotivo] = useState("Não trabalha mais nesta Serventia");
  const [removingColabs, setRemovingColabs] = useState(false);

  // Menu de ações
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Modal de Publicação da Escala (acionável via badge pelo RH/Gestor)
  const isManager = !readOnly && ["ADMIN", "RH", "MASTER", "GESTOR"].includes(userRole);
  const [pubModalOpen, setPubModalOpen] = useState(false);
  const [pubLoading, setPubLoading] = useState(false);

  const handleTogglePublicacao = async () => {
    setPubLoading(true);
    try {
      if (publicacao.status === "RASCUNHO") {
        const res = await publicarEscalaAnualAction({ ano });
        if (res.success) {
          setPublicacao(res.status);
        }
      } else {
        const res = await retirarEscalaDoArAction({ ano });
        if (res.success) {
          setPublicacao(res.status);
        }
      }
      setPubModalOpen(false);
      await carregarEscala(ano);
    } catch (err) {
      console.error("Erro ao alterar publicação:", err);
    } finally {
      setPubLoading(false);
    }
  };

  // Carrega dados da escala ao alternar ano
  const carregarEscala = async (anoAlvo: number) => {
    setLoading(true);
    try {
      const res = await getEscalaAnualAction({ ano: anoAlvo });
      setPublicacao(res.publicacao);
      setColaboradores(res.colaboradores);
    } catch (err) {
      console.error("Erro ao carregar escala:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarEscala(ano);
  }, [ano]);

  const recarregarColaboradoresDisponiveis = async () => {
    if (readOnly) return;
    try {
      const users = await getColaboradoresDisponiveisAction();
      setColaboradoresDisponiveis(users);
    } catch {}
  };

  // Carrega usuários reais para o modal somente se for gestor/RH
  useEffect(() => {
    recarregarColaboradoresDisponiveis();
  }, [readOnly]);

  // Fechar menu de 3 pontinhos ao clicar fora
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // Revelar / Ocultar CPF individual na tabela (com log de auditoria LGPD)
  const handleToggleInlineCpf = async (colab: EscalaItem) => {
    if (!canRevealCpf) return;

    if (visibleCpfIds[colab.id]) {
      setVisibleCpfIds((prev) => ({ ...prev, [colab.id]: false }));
      return;
    }

    if (revealedCpfs[colab.id]) {
      setVisibleCpfIds((prev) => ({ ...prev, [colab.id]: true }));
      return;
    }

    setRevealingCpfId(colab.id);
    try {
      const res = await revelarCpfColaboradorFeriasAction({
        usuarioId: colab.usuarioId,
        registroGestor: colab.dadosGestor?.registro ?? null,
        nome: colab.nome,
      });
      if (res.success && res.cpf) {
        setRevealedCpfs((prev) => ({ ...prev, [colab.id]: res.cpf! }));
        setVisibleCpfIds((prev) => ({ ...prev, [colab.id]: true }));
      } else {
        toast.error(res.erro || "CPF ainda não sincronizado do GESTOR.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Sem permissão para revelar CPF completo.");
    } finally {
      setRevealingCpfId(null);
    }
  };

  // Estatísticas do resumo
  const totalColaboradores = colaboradores.length;
  const programadosCount = colaboradores.filter((c) => c.status === "programado").length;
  const conflitosCount = colaboradores.filter((c) => c.status === "conflito").length;

  // Cálculo real e deduplicado da ocupação por mês para a visão anual
  const ocupacaoPorMes = useMemo(() => {
    return MESES.map((mesObj, idx) => {
      const mesNumero = idx + 1;
      let count = 0;
      for (const c of colaboradores) {
        if (colaboradorEmFeriasNoMes(c, ano, mesNumero)) {
          count++;
        }
      }

      const percentual =
        totalColaboradores > 0 ? Math.round((count / totalColaboradores) * 100) : 0;

      let cor = "bg-emerald-500";
      if (count === 0) {
        cor = "bg-slate-600";
      } else if (percentual > 50) {
        cor = "bg-orange-500";
      } else if (percentual >= 35) {
        cor = "bg-amber-400";
      }

      return {
        mesIndex: mesNumero,
        nome: mesObj.nome,
        completo: mesObj.completo,
        count,
        percentual,
        cor,
      };
    });
  }, [colaboradores, ano, totalColaboradores]);

  // Lista de setores disponíveis
  const setoresDisponiveis = useMemo(() => {
    const set = new Set<string>();
    colaboradores.forEach((c) => {
      if (c.setor) set.add(c.setor);
    });
    return Array.from(set).sort();
  }, [colaboradores]);

  // Filtra colaboradores (nome, registro Gestor, CPF parcial, setor, cargo, naturalidade, estado civil)
  const filteredColaboradores = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return colaboradores.filter((c) => {
      const dg = c.dadosGestor;
      const matchSearch =
        !q ||
        c.nome.toLowerCase().includes(q) ||
        c.setor.toLowerCase().includes(q) ||
        (c.cargo && c.cargo.toLowerCase().includes(q)) ||
        (dg?.registro != null && String(dg.registro).includes(q.replace(/^#/, ""))) ||
        (dg?.apelido && dg.apelido.toLowerCase().includes(q)) ||
        (dg?.cpfMascarado && dg.cpfMascarado.toLowerCase().includes(q)) ||
        (dg?.naturalidade && dg.naturalidade.toLowerCase().includes(q)) ||
        (dg?.nacionalidade && dg.nacionalidade.toLowerCase().includes(q)) ||
        (dg?.estadoCivil && dg.estadoCivil.toLowerCase().includes(q));

      const matchSetor = selectedSetor === "TODOS" || c.setor === selectedSetor;
      const matchStatus = !statusFilter || c.status === statusFilter;

      const matchMes =
        selectedMes === null || colaboradorEmFeriasNoMes(c, ano, selectedMes);

      return matchSearch && matchSetor && matchStatus && matchMes;
    });
  }, [colaboradores, searchTerm, selectedSetor, statusFilter, selectedMes, ano]);

  // Formata período para exibição
  const formatPeriodo = (inicio?: string, fim?: string) => {
    if (!inicio || !fim) return "A definir";
    const d1 = inicio.split("-").reverse().join("/");
    const d2 = fim.split("-").reverse().join("/");
    return `${d1} – ${d2}`;
  };

  // Exportação CSV rápida (respeitando mascaramento LGPD de CPF por padrão)
  const handleExportCsv = () => {
    const headers = [
      "Registro Gestor",
      "Nome Completo",
      "CPF (LGPD)",
      "Data de Nascimento",
      "Idade Atual",
      "Sexo",
      "Estado Civil",
      "Naturalidade / UF",
      "Nacionalidade",
      "Admissao",
      "Setor",
      "Cargo",
      "Periodo 1",
      "Periodo 2",
      "Periodo 3",
      "Total Dias",
      "Status",
    ];

    const escapeCsv = (val: string | number | null | undefined) => {
      const str = val == null ? "" : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = filteredColaboradores.map((c) => {
      const dg = c.dadosGestor;
      const idade = calcularIdadeCompleta(dg?.dataNascimento);
      const natUf = dg?.naturalidade
        ? dg.uf
          ? `${dg.naturalidade}/${dg.uf}`
          : dg.naturalidade
        : "";
      return [
        dg?.registro ?? "",
        c.nome,
        dg?.cpfMascarado ?? "",
        formatarDataGestorBr(dg?.dataNascimento) ?? "",
        idade?.extenso ?? "",
        dg?.sexo ?? "",
        dg?.estadoCivil ?? "",
        natUf,
        dg?.nacionalidade ?? "",
        formatarDataGestorBr(dg?.dataAdmissao) ?? "",
        c.setor,
        c.cargo ?? "",
        c.p1Inicio && c.p1Fim ? formatPeriodo(c.p1Inicio, c.p1Fim) : "",
        c.p2Inicio && c.p2Fim ? formatPeriodo(c.p2Inicio, c.p2Fim) : "",
        c.p3Inicio && c.p3Fim ? formatPeriodo(c.p3Inicio, c.p3Fim) : "",
        c.totalDias || 0,
        c.status,
      ]
        .map(escapeCsv)
        .join(";");
    });

    const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(";"), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `escala-ferias-gestor-${ano}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Planilha da escala ${ano} exportada com sucesso.`);
  };

  const getAvatarColor = (idx: number) => {
    const colors = [
      "bg-purple-500/20 text-purple-300 border-purple-500/30",
      "bg-blue-500/20 text-blue-300 border-blue-500/30",
      "bg-pink-500/20 text-pink-300 border-pink-500/30",
      "bg-amber-500/20 text-amber-300 border-amber-500/30",
      "bg-teal-500/20 text-teal-300 border-teal-500/30",
      "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    ];
    return colors[idx % colors.length];
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Salvar lançamento
  const handleSaveLancamento = async (dados: any) => {
    const res = await salvarLancamentoFeriasAction(dados);
    if (!res.success) {
      throw new Error(res.erro || "Falha ao salvar");
    }
    await carregarEscala(ano);
  };

  // Limpar apenas o período de férias do ano (mantendo o colaborador na lista)
  const handleDeleteLancamento = async (item: EscalaItem) => {
    if (confirm(`Deseja limpar apenas o período de férias de ${item.nome} em ${ano}?`)) {
      await removerLancamentoFeriasAction({
        usuarioId: item.usuarioId,
        nome: item.nome,
        ano,
      });
      toast.success(`Período de férias de ${item.nome} (${ano}) removido.`);
      await carregarEscala(ano);
    }
  };

  // Seleção individual / em lote na tabela
  const allFilteredSelected =
    filteredColaboradores.length > 0 &&
    filteredColaboradores.every((c) => selectedIds.has(c.id));

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredColaboradores.forEach((c) => next.delete(c.id));
      } else {
        filteredColaboradores.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const abrirModalRemoverColaboradores = (itens: EscalaItem[]) => {
    if (!itens.length) return;
    setRemoveMotivo("Não trabalha mais nesta Serventia");
    setRemoveModalItems(itens);
  };

  const handleConfirmarRemocaoColaboradores = async () => {
    if (removeModalItems.length === 0) return;
    setRemovingColabs(true);
    try {
      const res = await removerColaboradoresDaTelaFeriasAction({
        itens: removeModalItems.map((it) => ({
          usuarioId: it.usuarioId,
          nome: it.nome,
          registroGestor: it.dadosGestor?.registro ?? null,
          setor: it.setor,
        })),
        motivo: removeMotivo.trim() || "Não trabalha mais nesta Serventia",
      });

      if (!res.success) {
        toast.error(res.erro || "Não foi possível remover os colaboradores selecionados.");
        return;
      }

      toast.success(
        res.removidos === 1
          ? `"${removeModalItems[0].nome}" removido definitivamente da tela do FIORIX.`
          : `${res.removidos} colaboradores removidos definitivamente da tela do FIORIX.`
      );

      setSelectedIds((prev) => {
        const next = new Set(prev);
        removeModalItems.forEach((it) => next.delete(it.id));
        return next;
      });
      setRemoveModalItems([]);
      await Promise.all([carregarEscala(ano), recarregarColaboradoresDisponiveis()]);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao remover colaborador do FIORIX.");
    } finally {
      setRemovingColabs(false);
    }
  };

  const percentProgramados =
    totalColaboradores > 0 ? Math.round((programadosCount / totalColaboradores) * 100) : 0;

  const totalTableCols = detalhadoGestor
    ? readOnly
      ? 12
      : 14
    : readOnly
    ? 6
    : 8;

  return (
    <div className="space-y-6 text-white animate-in fade-in duration-200">
      {/* ─────────────────────────────────────────────────────────────
          1. CARDS DE INDICADORES EXECUTIVOS (PADRÃO FIORIX)
      ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* KPI 1: Colaboradores na Escala */}
        <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Colaboradores na Escala
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                ANO {ano}
              </span>
            </div>
            <div className="text-2xl font-black text-white leading-tight">
              {`${totalColaboradores} ${totalColaboradores === 1 ? "colaborador" : "colaboradores"}`}
            </div>
            <p className="text-xs text-slate-400">
              Base nominal ativa integrada ao cadastro GESTOR
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 shadow-inner">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Férias Programadas */}
        <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Férias Programadas
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                HOMOLOGADAS
              </span>
            </div>
            <div className="text-2xl font-black text-white leading-tight">
              {`${programadosCount} ${programadosCount === 1 ? "programado" : "programados"}`}
            </div>
            <p className="text-xs text-emerald-400/90 font-medium">
              {totalColaboradores > 0
                ? `${percentProgramados}% da equipe com período definido`
                : "Nenhuma programação ativa no ano"}
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-inner">
            <CalendarCheck className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Conflitos a Revisar (Interativo) */}
        <button
          type="button"
          onClick={() => setStatusFilter(statusFilter === "conflito" ? null : "conflito")}
          title="Clique para filtrar apenas os conflitos"
          className={`rounded-[24px] border p-5 backdrop-blur-xl shadow-sm flex items-center justify-between gap-4 text-left transition-all cursor-pointer ${
            statusFilter === "conflito"
              ? "border-amber-500/45 bg-amber-500/10 ring-1 ring-amber-400/40"
              : "border-white/15 bg-[#0B1020]/90 hover:border-amber-500/35"
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Conflitos de Lotação
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                  statusFilter === "conflito" || conflitosCount > 0
                    ? "bg-amber-500/15 text-amber-300 border-amber-500/25"
                    : "bg-indigo-500/15 text-indigo-300 border-indigo-500/25"
                }`}
              >
                {statusFilter === "conflito"
                  ? "FILTRO ATIVO"
                  : conflitosCount > 0
                  ? "REVISAR"
                  : "EM DIA"}
              </span>
            </div>
            <div className="text-2xl font-black text-white leading-tight">
              {`${conflitosCount} ${conflitosCount === 1 ? "conflito" : "conflitos"}`}
            </div>
            <p
              className={`text-xs ${
                conflitosCount > 0 ? "text-amber-400/90 font-medium" : "text-slate-400"
              }`}
            >
              {statusFilter === "conflito"
                ? "Exibindo apenas conflitos • clique para limpar"
                : conflitosCount > 0
                ? "Clique para filtrar sobreposições no setor"
                : "Nenhuma sobreposição crítica detectada"}
            </p>
          </div>
          <div
            className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 shadow-inner ${
              conflitosCount > 0
                ? "bg-amber-500/15 border-amber-500/30 text-amber-400"
                : "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
        </button>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. CARD VISÃO ANUAL DE OCUPAÇÃO (PADRÃO FIORIX)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between px-6 py-5 gap-4 border-b border-white/10 bg-[#0B1020]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Visão Anual de Ocupação · {ano}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Clique em um mês para filtrar os colaboradores em gozo de férias na lista nominal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {!hideBackButton && onVoltar && (
              <button
                type="button"
                onClick={onVoltar}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-white/15 bg-[#080D1A] hover:bg-[#0E1528] text-xs font-semibold text-white transition-all cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-400" />
                <span>Voltar</span>
              </button>
            )}

            {selectedMes !== null && (
              <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30">
                <span>Mês: {MESES[selectedMes - 1].completo}</span>
                <button
                  type="button"
                  onClick={() => setSelectedMes(null)}
                  className="hover:text-white cursor-pointer"
                  title="Limpar filtro de mês"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            )}

            {readOnly && (
              <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-300 text-xs font-semibold">
                <span>Somente leitura</span>
              </span>
            )}

            {/* Seletor de Ano */}
            <div className="inline-flex items-center h-9 bg-[#080D1A] border border-white/15 rounded-xl px-3">
              <CalendarIcon className="w-4 h-4 text-cyan-400 mr-2 shrink-0" />
              <select
                value={ano}
                onChange={(e) => setAno(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-1"
              >
                <option value={2026} className="bg-[#0B1020] text-white">Ano 2026</option>
                <option value={2027} className="bg-[#0B1020] text-white">Ano 2027</option>
                <option value={2028} className="bg-[#0B1020] text-white">Ano 2028</option>
              </select>
            </div>

            {/* Badge de Status — Clicável para Gestão de Publicação pelo RH/Gestor */}
            {publicacao.status === "PUBLICADA" ? (
              <button
                type="button"
                onClick={() => isManager && setPubModalOpen(true)}
                disabled={!isManager}
                className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 text-xs font-bold transition-all ${
                  isManager ? "hover:bg-emerald-500/25 cursor-pointer" : "cursor-default"
                }`}
                title={isManager ? "Clique para gerenciar publicação da escala" : undefined}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Escala Publicada</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => isManager && setPubModalOpen(true)}
                disabled={!isManager}
                className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-300 text-xs font-bold transition-all ${
                  isManager ? "hover:bg-amber-500/25 cursor-pointer" : "cursor-default"
                }`}
                title={isManager ? "Clique para publicar a escala anual" : undefined}
              >
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Rascunho (Oculta)</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-2.5">
            {ocupacaoPorMes.map((m) => {
              const isSelected = selectedMes === m.mesIndex;
              const tooltipMes = `${m.completo}: ${m.count} ${
                m.count === 1 ? "colaborador em férias" : "colaboradores em férias"
              } (${m.percentual}% da equipe)`;

              return (
                <div key={m.mesIndex} className="flex flex-col items-stretch gap-1.5 group/mes">
                  <button
                    type="button"
                    onClick={() => setSelectedMes(isSelected ? null : m.mesIndex)}
                    className={`flex flex-col items-center justify-between py-3 px-2 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-cyan-500/15 border-cyan-400/60 ring-1 ring-cyan-400/50 shadow-sm"
                        : "bg-[#080D1A] border-white/10 group-hover/mes:border-cyan-500/35 group-hover/mes:bg-[#0E1528]"
                    }`}
                    title={tooltipMes}
                  >
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        isSelected ? "text-cyan-300" : "text-slate-300"
                      }`}
                    >
                      {m.nome}
                    </span>

                    <span className="text-sm font-black text-white mt-1.5">
                      {m.percentual}%
                    </span>

                    <div className="w-full h-1.5 rounded-full mt-2 overflow-hidden bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${m.cor}`}
                        style={{
                          width: m.count === 0 ? "0%" : `${Math.min(100, Math.max(14, m.percentual))}%`,
                        }}
                      />
                    </div>
                  </button>

                  {/* Contador elegante abaixo de cada card mensal */}
                  <button
                    type="button"
                    onClick={() => setSelectedMes(isSelected ? null : m.mesIndex)}
                    title={tooltipMes}
                    className={`flex items-center justify-center gap-1 py-1 px-1.5 rounded-lg border text-[11px] transition-all cursor-pointer ${
                      isSelected
                        ? "bg-cyan-500/15 border-cyan-400/45 text-cyan-200 font-bold"
                        : m.count > 0
                        ? "bg-[#080D1A]/85 border-white/10 text-slate-300 group-hover/mes:border-cyan-500/30 group-hover/mes:text-white"
                        : "bg-[#080D1A]/40 border-white/[0.05] text-slate-500 group-hover/mes:text-slate-400"
                    }`}
                  >
                    <Users
                      className={`w-3 h-3 shrink-0 ${
                        isSelected
                          ? "text-cyan-300"
                          : m.count > 0
                          ? "text-cyan-400/85"
                          : "text-slate-600"
                      }`}
                    />
                    <span className="font-mono font-bold leading-none">{m.count}</span>
                    <span className="text-[10px] leading-none opacity-85">colab.</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. CARD ESCALA NOMINAL DE FÉRIAS + DADOS GESTOR (PADRÃO FIORIX)
      ───────────────────────────────────────────────────────────── */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 backdrop-blur-xl shadow-sm overflow-hidden">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between px-6 py-5 gap-4 border-b border-white/10 bg-[#0B1020]/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Escala Nominal de Férias · Dados Cadastrais (Gestor)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {`${filteredColaboradores.length} ${
                  filteredColaboradores.length === 1 ? "colaborador listado" : "colaboradores listados"
                } • clique no colaborador para abrir a ficha completa do Gestor`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Campo de Busca Unificada */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Nome, registro, CPF, setor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 h-9 bg-[#080D1A] border border-white/15 text-xs text-white rounded-xl placeholder:text-slate-500 focus:border-cyan-500/50 w-full"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro de Setor */}
            <select
              value={selectedSetor}
              onChange={(e) => setSelectedSetor(e.target.value)}
              className="h-9 px-3.5 bg-[#080D1A] border border-white/15 text-xs font-semibold text-white rounded-xl focus:outline-none focus:border-cyan-500/50 cursor-pointer"
            >
              <option value="TODOS" className="bg-[#0B1020] text-white">Todos os setores</option>
              {setoresDisponiveis.map((s) => (
                <option key={s} value={s} className="bg-[#0B1020] text-white">
                  {s}
                </option>
              ))}
            </select>

            {/* Toggle: Modo Compacto vs Colunas Detalhadas (Gestor) */}
            <button
              type="button"
              onClick={() => setDetalhadoGestor((v) => !v)}
              className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                detalhadoGestor
                  ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                  : "bg-[#080D1A] border-white/15 text-slate-300 hover:text-white hover:bg-[#0E1528]"
              }`}
              title="Alternar entre visão compacta e todas as colunas do Gestor lado a lado"
            >
              <Columns3 className="w-3.5 h-3.5 text-cyan-400" />
              <span>{detalhadoGestor ? "Visão Compacta" : "Colunas Gestor"}</span>
            </button>

            {/* Exportar CSV */}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-white/15 bg-[#080D1A] hover:bg-[#0E1528] text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer"
              title="Exportar escala nominal com dados do Gestor (CPF mascarado LGPD)"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>

            {!readOnly && selectedIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  const selecionados = colaboradores.filter((c) => selectedIds.has(c.id));
                  abrirModalRemoverColaboradores(selecionados);
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-rose-500/35 bg-rose-500/15 hover:bg-rose-500/25 text-xs font-bold text-rose-200 transition-all cursor-pointer"
                title="Remover definitivamente da tela do FIORIX os colaboradores selecionados"
              >
                <UserMinus className="w-3.5 h-3.5 text-rose-400" />
                <span>Remover do FIORIX ({selectedIds.size})</span>
              </button>
            )}

            {/* Botão Novo Colaborador Manual */}
            {!readOnly && (
              <Button
                type="button"
                onClick={() => setNovoColabModalOpen(true)}
                className="h-9 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-500/20 gap-1.5 cursor-pointer"
                title="Cadastrar manualmente um novo colaborador na tela de Férias do FIORIX"
              >
                <UserPlus className="w-4 h-4" />
                <span>Novo Colaborador</span>
              </Button>
            )}

            {/* Botão Programar Férias */}
            {!readOnly && (
              <Button
                type="button"
                onClick={() => {
                  setEditingItem(null);
                  setLancamentoModalOpen(true);
                }}
                className="h-9 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm shadow-indigo-500/20 gap-1.5 cursor-pointer"
                title="Programar ou lançar período de férias para um colaborador"
              >
                <CalendarPlus className="w-4 h-4" />
                <span>Programar Férias</span>
              </Button>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#080D1A]">
            <table
              className={`w-full text-left text-xs ${
                detalhadoGestor ? "min-w-[1460px]" : "min-w-[980px]"
              }`}
            >
              <thead className="bg-[#0E1528] text-slate-400 uppercase font-mono text-[11px] tracking-wider border-b border-white/10">
                <tr>
                  {!readOnly && (
                    <th className="py-3.5 pl-5 pr-2 w-10">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={toggleSelectAllFiltered}
                        title="Selecionar colaboradores listados"
                        className="w-4 h-4 rounded border-white/20 bg-[#080D1A] accent-cyan-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="py-3.5 px-5 font-bold">Colaborador</th>
                  {detalhadoGestor ? (
                    <>
                      <th className="py-3.5 px-4 font-bold">CPF</th>
                      <th className="py-3.5 px-4 font-bold">Data Nasc.</th>
                      <th className="py-3.5 px-4 font-bold">Idade Atual</th>
                      <th className="py-3.5 px-4 font-bold">Sexo</th>
                      <th className="py-3.5 px-4 font-bold">Estado Civil</th>
                      <th className="py-3.5 px-4 font-bold">Naturalidade / UF</th>
                      <th className="py-3.5 px-4 font-bold">Nacionalidade</th>
                    </>
                  ) : (
                    <th className="py-3.5 px-5 font-bold">Dados Pessoais (Gestor)</th>
                  )}
                  <th className="py-3.5 px-5 font-bold">Setor / Admissão</th>
                  <th className="py-3.5 px-5 font-bold">Período de Férias</th>
                  <th className="py-3.5 px-4 font-bold text-center">Dias</th>
                  <th className="py-3.5 px-5 font-bold">Status</th>
                  {!readOnly && (
                    <th className="py-3.5 px-5 font-bold text-right">Ações</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-slate-200">
                {filteredColaboradores.length === 0 ? (
                  <tr>
                    <td
                      colSpan={totalTableCols}
                      className="py-12 px-5 text-center text-slate-400"
                    >
                      <Users className="w-8 h-8 mx-auto text-slate-600 mb-2" />
                      <p className="font-semibold text-sm text-slate-300">
                        Nenhum colaborador encontrado
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Ajuste os filtros de busca, setor ou mês para visualizar a escala.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredColaboradores.map((colab, idx) => {
                    const isMenuOpen = openMenuId === colab.id;
                    const dg = colab.dadosGestor;
                    const idade = calcularIdadeCompleta(dg?.dataNascimento);
                    const dataNascBr = formatarDataGestorBr(dg?.dataNascimento);
                    const dataAdmBr = formatarDataGestorBr(dg?.dataAdmissao);
                    const natUf = dg?.naturalidade
                      ? dg.uf
                        ? `${dg.naturalidade}/${dg.uf}`
                        : dg.naturalidade
                      : null;
                    const isCpfRevealed = Boolean(visibleCpfIds[colab.id] && revealedCpfs[colab.id]);
                    const displayCpf = isCpfRevealed
                      ? revealedCpfs[colab.id]
                      : dg?.cpfMascarado || null;

                    const resumoDemografico = [dg?.sexo, dg?.estadoCivil, natUf, dg?.nacionalidade]
                      .filter(Boolean)
                      .join(" • ");

                    const isSelectedRow = selectedIds.has(colab.id);

                    return (
                      <tr
                        key={colab.id}
                        className={`transition-colors group ${
                          isSelectedRow
                            ? "bg-rose-500/[0.05] hover:bg-rose-500/[0.08]"
                            : "hover:bg-white/[0.03]"
                        }`}
                      >
                        {!readOnly && (
                          <td className="py-4 pl-5 pr-2 w-10">
                            <input
                              type="checkbox"
                              checked={isSelectedRow}
                              onChange={() => toggleSelectOne(colab.id)}
                              aria-label={`Selecionar ${colab.nome}`}
                              className="w-4 h-4 rounded border-white/20 bg-[#080D1A] accent-cyan-500 cursor-pointer"
                            />
                          </td>
                        )}
                        {/* 1. Colaborador + Registro + CPF (no modo compacto) */}
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setFichaItem(colab);
                                setFichaModalOpen(true);
                              }}
                              className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold text-xs shrink-0 cursor-pointer transition-transform hover:scale-105 ${getAvatarColor(
                                idx
                              )}`}
                              title="Ver ficha cadastral completa (Gestor)"
                            >
                              {getInitials(colab.nome)}
                            </button>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFichaItem(colab);
                                    setFichaModalOpen(true);
                                  }}
                                  className="text-sm font-bold text-white hover:text-cyan-300 transition-colors text-left cursor-pointer"
                                  title="Clique para abrir a ficha cadastral do Gestor"
                                >
                                  {colab.nome}
                                </button>
                                {dg?.registro != null && (
                                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                                    <Hash className="w-2.5 h-2.5" />
                                    {dg.registro}
                                  </span>
                                )}
                                {dg?.origemManual && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                                    Manual
                                  </span>
                                )}
                              </div>

                              {!detalhadoGestor && (
                                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 font-mono">
                                  {displayCpf ? (
                                    <>
                                      <span>CPF {displayCpf}</span>
                                      {canRevealCpf && dg?.temCpfCadastrado && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleInlineCpf(colab);
                                          }}
                                          disabled={revealingCpfId === colab.id}
                                          className="text-cyan-400 hover:text-cyan-300 cursor-pointer inline-flex items-center"
                                          title={
                                            isCpfRevealed
                                              ? "Ocultar CPF"
                                              : "Revelar CPF completo (auditado LGPD)"
                                          }
                                        >
                                          {revealingCpfId === colab.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : isCpfRevealed ? (
                                            <EyeOff className="w-3 h-3" />
                                          ) : (
                                            <Eye className="w-3 h-3" />
                                          )}
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <span className="font-sans text-slate-500">
                                      {colab.cargo || "Cadastro base FIORIX"}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Colunas Pessoais Gestor: Compacto vs Detalhado */}
                        {detalhadoGestor ? (
                          <>
                            {/* CPF */}
                            <td className="py-4 px-4 font-mono text-xs text-slate-200 whitespace-nowrap">
                              {displayCpf ? (
                                <div className="inline-flex items-center gap-1.5">
                                  <span>{displayCpf}</span>
                                  {canRevealCpf && dg?.temCpfCadastrado && (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleInlineCpf(colab)}
                                      disabled={revealingCpfId === colab.id}
                                      className="text-cyan-400 hover:text-cyan-300 cursor-pointer"
                                      title={
                                        isCpfRevealed
                                          ? "Ocultar CPF"
                                          : "Revelar CPF completo (auditado LGPD)"
                                      }
                                    >
                                      {revealingCpfId === colab.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : isCpfRevealed ? (
                                        <EyeOff className="w-3.5 h-3.5" />
                                      ) : (
                                        <Eye className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500 italic font-sans">—</span>
                              )}
                            </td>

                            {/* Data Nasc. */}
                            <td className="py-4 px-4 font-mono text-xs text-slate-200 whitespace-nowrap">
                              {dataNascBr || <span className="text-slate-500">—</span>}
                            </td>

                            {/* Idade Atual Exata */}
                            <td className="py-4 px-4 text-xs whitespace-nowrap">
                              {idade ? (
                                <span
                                  className="inline-flex items-center px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/25 text-cyan-200 font-medium text-[11px]"
                                  title="Calculada em tempo real a partir da Data de Nascimento"
                                >
                                  {idade.extenso}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>

                            {/* Sexo */}
                            <td className="py-4 px-4 text-xs text-slate-300 whitespace-nowrap">
                              {dg?.sexo || <span className="text-slate-500">—</span>}
                            </td>

                            {/* Estado Civil */}
                            <td className="py-4 px-4 text-xs text-slate-300 whitespace-nowrap">
                              {dg?.estadoCivil || <span className="text-slate-500">—</span>}
                            </td>

                            {/* Naturalidade / UF */}
                            <td className="py-4 px-4 text-xs text-slate-300 whitespace-nowrap">
                              {natUf || <span className="text-slate-500">—</span>}
                            </td>

                            {/* Nacionalidade */}
                            <td className="py-4 px-4 text-xs text-slate-300 whitespace-nowrap">
                              {dg?.nacionalidade || <span className="text-slate-500">—</span>}
                            </td>
                          </>
                        ) : (
                          <td className="py-4 px-5">
                            {dataNascBr || resumoDemografico ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {dataNascBr && (
                                    <span className="font-mono text-xs font-semibold text-slate-200">
                                      Nasc. {dataNascBr}
                                    </span>
                                  )}
                                  {idade && (
                                    <span
                                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
                                      title={`Idade exata hoje: ${idade.extenso}`}
                                    >
                                      {idade.compacto}
                                    </span>
                                  )}
                                </div>
                                {resumoDemografico && (
                                  <div className="text-[11px] text-slate-400 leading-snug">
                                    {resumoDemografico}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setFichaItem(colab);
                                  setFichaModalOpen(true);
                                }}
                                className="text-[11px] text-slate-500 hover:text-slate-300 italic cursor-pointer"
                              >
                                Aguardando sync GESTOR
                              </button>
                            )}
                          </td>
                        )}

                        {/* 3. Setor + Admissão */}
                        <td className="py-4 px-5 text-xs">
                          <span className="font-semibold text-slate-200 block">
                            {colab.setor}
                          </span>
                          {dataAdmBr ? (
                            <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                              Adm. {dataAdmBr}
                            </span>
                          ) : colab.cargo ? (
                            <span className="text-[11px] text-slate-500 block mt-0.5">
                              {colab.cargo}
                            </span>
                          ) : null}
                        </td>

                        {/* 4. Período de Férias */}
                        <td className="py-4 px-5 font-mono text-xs text-slate-200">
                          {colab.p1Inicio && colab.p1Fim ? (
                            <div>
                              <span>{formatPeriodo(colab.p1Inicio, colab.p1Fim)}</span>
                              {colab.p2Inicio && colab.p2Fim && (
                                <span className="text-[11px] text-slate-400 block mt-0.5">
                                  + {formatPeriodo(colab.p2Inicio, colab.p2Fim)}
                                </span>
                              )}
                              {colab.p3Inicio && colab.p3Fim && (
                                <span className="text-[11px] text-slate-400 block mt-0.5">
                                  + {formatPeriodo(colab.p3Inicio, colab.p3Fim)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-500 italic font-sans">
                              Não programado
                            </span>
                          )}
                        </td>

                        {/* 5. Dias */}
                        <td className="py-4 px-4 text-center font-mono font-bold text-xs text-white">
                          {colab.totalDias > 0 ? `${colab.totalDias}d` : "—"}
                        </td>

                        {/* 6. Status */}
                        <td className="py-4 px-5">
                          {colab.status === "programado" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-300 font-bold text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Programado
                            </span>
                          )}
                          {colab.status === "conflito" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-300 font-bold text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Conflito a revisar
                            </span>
                          )}
                          {colab.status === "pendente" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-500/30 bg-slate-500/15 text-slate-300 font-bold text-[11px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Pendente
                            </span>
                          )}
                        </td>

                        {/* 7. Ações */}
                        {!readOnly && (
                          <td className="py-4 px-5 text-right relative">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalRemoverColaboradores([colab]);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Remover colaborador da tela do FIORIX (ex-colaborador)"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(isMenuOpen ? null : colab.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
                                title="Mais opções"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </div>

                            {isMenuOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-5 top-12 z-30 w-60 rounded-2xl border border-white/15 bg-[#0B1020] p-1.5 shadow-2xl space-y-1 text-left"
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setFichaItem(colab);
                                    setFichaModalOpen(true);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-200 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
                                >
                                  <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Ver ficha completa (Gestor)</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setEditingItem(colab);
                                    setLancamentoModalOpen(true);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-200 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>Editar período de férias</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    setHistoricoItem(colab);
                                    setHistoricoModalOpen(true);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-slate-200 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
                                >
                                  <History className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>Visualizar histórico</span>
                                </button>

                                {colab.p1Inicio && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenMenuId(null);
                                      handleDeleteLancamento(colab);
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                                    <span>Limpar período ({ano})</span>
                                  </button>
                                )}

                                <div className="my-1 border-t border-white/10" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    abrirModalRemoverColaboradores([colab]);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                >
                                  <UserMinus className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Remover colaborador do FIORIX</span>
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAIS
      ───────────────────────────────────────────────────────────── */}
      <FichaColaboradorFeriasModal
        open={fichaModalOpen}
        onClose={() => {
          setFichaModalOpen(false);
          setFichaItem(null);
        }}
        colaborador={fichaItem}
        ano={ano}
        canRevealCpf={canRevealCpf}
        readOnly={readOnly}
        revealedCpfValue={fichaItem ? revealedCpfs[fichaItem.id] || null : null}
        onCpfRevealed={(colabId, cpfCompleto) => {
          setRevealedCpfs((prev) => ({ ...prev, [colabId]: cpfCompleto }));
        }}
        onEditFerias={(colab) => {
          setEditingItem(colab);
          setLancamentoModalOpen(true);
        }}
        onOpenHistorico={(colab) => {
          setHistoricoItem(colab);
          setHistoricoModalOpen(true);
        }}
        onRemoveColaborador={
          !readOnly ? (colab) => abrirModalRemoverColaboradores([colab]) : undefined
        }
      />

      <NovoColaboradorFeriasModal
        open={novoColabModalOpen}
        onClose={() => setNovoColabModalOpen(false)}
        anoSelecionado={ano}
        setoresExistentes={setoresDisponiveis}
        onCreated={async () => {
          await Promise.all([carregarEscala(ano), recarregarColaboradoresDisponiveis()]);
        }}
      />

      <LancamentoFeriasModal
        open={lancamentoModalOpen}
        onClose={() => {
          setLancamentoModalOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveLancamento}
        itemParaEditar={editingItem}
        anoSelecionado={ano}
        colaboradoresDisponiveis={colaboradoresDisponiveis}
      />

      <HistoricoFeriasModal
        open={historicoModalOpen}
        onClose={() => {
          setHistoricoModalOpen(false);
          setHistoricoItem(null);
        }}
        colaborador={historicoItem}
      />

      {/* Modal Executivo de Confirmação — Remoção Definitiva de Ex-Colaborador do FIORIX */}
      {removeModalItems.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => !removingColabs && setRemoveModalItems([])}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-[24px] border border-white/15 bg-[#0B1020] p-6 shadow-2xl text-white space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                  <UserMinus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {removeModalItems.length === 1
                      ? "Remover Colaborador do FIORIX?"
                      : `Remover ${removeModalItems.length} Colaboradores do FIORIX?`}
                  </h3>
                  <span className="text-xs text-slate-400">
                    Exclusão definitiva da escala • Protegida contra reimportação do GESTOR
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={removingColabs}
                onClick={() => setRemoveModalItems([])}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-40 overflow-y-auto rounded-2xl border border-white/10 bg-[#080D1A] p-3 space-y-1.5">
              {removeModalItems.map((it) => (
                <div
                  key={it.id}
                  className="flex items-center justify-between gap-2 text-xs py-1 px-2 rounded-lg bg-white/[0.02]"
                >
                  <span className="font-bold text-white truncate">
                    {it.nome}
                    {it.dadosGestor?.registro != null && (
                      <span className="ml-1.5 font-mono text-[11px] text-indigo-300">
                        #{it.dadosGestor.registro}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0">{it.setor}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Esta ação remove o colaborador da tela de Férias do <strong>FIORIX</strong> e grava
              bloqueio permanente para que ele <strong>não retorne</strong> nas próximas
              sincronizações automáticas do <strong>GESTOR</strong>. O banco original no servidor
              SQL da Serventia permanece intacto.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Motivo para registro em auditoria (Opcional)
              </label>
              <Input
                type="text"
                value={removeMotivo}
                onChange={(e) => setRemoveMotivo(e.target.value)}
                placeholder="Ex: Não trabalha mais nesta Serventia"
                className="h-9 bg-[#080D1A] border-white/15 text-xs text-white rounded-xl"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
              <Button
                type="button"
                variant="outline"
                disabled={removingColabs}
                onClick={() => setRemoveModalItems([])}
                className="h-9 px-4 rounded-xl bg-[#080D1A] border-white/15 text-slate-300 hover:bg-white/10 text-xs cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={removingColabs}
                onClick={handleConfirmarRemocaoColaboradores}
                className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm shadow-rose-500/20 gap-1.5 cursor-pointer"
              >
                {removingColabs ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removendo...</span>
                  </>
                ) : (
                  <>
                    <UserMinus className="w-3.5 h-3.5" />
                    <span>Confirmar Remoção do FIORIX</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Publicação da Escala (Acessível via badge de status pelo RH) */}
      {pubModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-white/12 bg-[#0c101c] p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-2xl border ${
                  publicacao.status === "RASCUNHO"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                }`}
              >
                {publicacao.status === "RASCUNHO" ? (
                  <Send className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {publicacao.status === "RASCUNHO"
                    ? `Publicar Escala ${ano}?`
                    : `Retirar Escala ${ano} do Ar?`}
                </h3>
                <span className="text-xs text-slate-400">Governança RH • 7º RI SP</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {publicacao.status === "RASCUNHO"
                ? `Ao publicar a escala ${ano}, os colaboradores poderão visualizar somente as próprias férias programadas. Todas as edições do RH são registradas com integridade na trilha de auditoria WORM.`
                : `Ao retirar do ar, a escala ${ano} volta ao modo rascunho e não será mais visível aos colaboradores. Todos os lançamentos e históricos continuam preservados.`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/8">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPubModalOpen(false)}
                className="rounded-xl border-white/10 text-slate-300 hover:bg-white/10 text-xs"
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={pubLoading}
                onClick={handleTogglePublicacao}
                className={`rounded-xl text-white font-bold text-xs ${
                  publicacao.status === "RASCUNHO"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {pubLoading
                  ? "Processando..."
                  : publicacao.status === "RASCUNHO"
                  ? "Confirmar Publicação"
                  : "Confirmar Retirada"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
