"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Users,
  Award,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Eye,
  Pencil,
  Trash2,
  FileCheck,
  Send,
  Lock,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Copy,
  Check,
  X,
  GraduationCap,
  Layers,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteConfirmModal } from "@/components/rh/DeleteConfirmModal";
import {
  ITItem,
  ColaboradorItem,
  MatrizEntry,
  SolicitacaoItem,
  TrilhaItem,
  AceiteStatus,
  registrarAceiteMensal,
  salvarOuAtualizarIt,
  excluirItWorm,
  solicitarAcessoCross,
  responderSolicitacaoCross,
  atualizarNivelMatriz,
  toggleColaboradorTutor,
} from "@/app/actions/its";

interface ModuloItsClientProps {
  initialData: {
    currentUser: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      departamento: string;
    };
    its: ITItem[];
    aceiteStatus: AceiteStatus;
    colaboradores: ColaboradorItem[];
    matriz: MatrizEntry[];
    solicitacoes: SolicitacaoItem[];
    trilhas: TrilhaItem[];
  };
}

const NIVEL_CORES: Record<number, { bg: string; text: string; label: string; desc: string }> = {
  0: { bg: "bg-slate-800/60", text: "text-slate-400", label: "0", desc: "Sem Conhecimento" },
  1: { bg: "bg-blue-600/30 text-blue-300 border border-blue-500/40", text: "text-blue-300", label: "1", desc: "Teórico / Leitura Concluída" },
  2: { bg: "bg-amber-600/30 text-amber-300 border border-amber-500/40", text: "text-amber-300", label: "2", desc: "Executa com Supervisão" },
  3: { bg: "bg-emerald-600/30 text-emerald-300 border border-emerald-500/40", text: "text-emerald-300", label: "3", desc: "Autônomo / Opera Sozinho" },
  4: { bg: "bg-purple-600/40 text-purple-200 border border-purple-400/50 shadow-sm shadow-purple-500/30", text: "text-purple-200", label: "4", desc: "Multiplicador / Tutor Habilitado" },
};

export function ModuloItsClient({ initialData }: ModuloItsClientProps) {
  const { currentUser } = initialData;
  const isGestao = ["ADMIN", "RH", "MASTER"].includes(currentUser.role);

  // Tabs principais
  const [activeTab, setActiveTab] = useState<"its" | "colaboradores" | "matriz" | "gestao">("its");

  // Estado das ITs
  const [itsList, setItsList] = useState<ITItem[]>(initialData.its);
  const [searchIt, setSearchIt] = useState("");
  const [filterDeptoIt, setFilterDeptoIt] = useState<string>("TODOS");

  // Estado do Aceite
  const [aceite, setAceite] = useState<AceiteStatus>(initialData.aceiteStatus);
  const [assinando, setAssinando] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  // Modais de IT
  const [viewItModal, setViewItModal] = useState<ITItem | null>(null);
  const [editItModal, setEditItModal] = useState<ITItem | null>(null);
  const [createItModalOpen, setCreateItModalOpen] = useState(false);
  const [deleteItModalOpen, setDeleteItModalOpen] = useState(false);
  const [itToDelete, setItToDelete] = useState<ITItem | null>(null);

  // Form states para criação/edição de IT
  const [formCodigo, setFormCodigo] = useState("");
  const [formTitulo, setFormTitulo] = useState("");
  const [formDepto, setFormDepto] = useState("Atendimento");
  const [formTempo, setFormTempo] = useState(10);
  const [formObjetivo, setFormObjetivo] = useState("");
  const [formQuandoUsar, setFormQuandoUsar] = useState("");
  const [formPassos, setFormPassos] = useState<Array<{ ordem: number; titulo: string; desc: string }>>([
    { ordem: 1, titulo: "Etapa 1", desc: "Descrição do procedimento operacional." },
  ]);
  const [salvandoIt, setSalvandoIt] = useState(false);

  // Estado de Colaboradores
  const [colabsList, setColabsList] = useState<ColaboradorItem[]>(initialData.colaboradores);
  const [searchColab, setSearchColab] = useState("");
  const [filterDeptoColab, setFilterDeptoColab] = useState("TODOS");

  // Estado da Matriz de Polivalência
  const [matrizList, setMatrizList] = useState<MatrizEntry[]>(initialData.matriz);
  const [filterDeptoMatriz, setFilterDeptoMatriz] = useState("TODOS");
  const [selectedCell, setSelectedCell] = useState<{ userId: string; userName: string; itId: string; itCodigo: string; nivelAtual: number } | null>(null);

  // Estado de Solicitações Cross
  const [solicitacoesList, setSolicitacoesList] = useState<SolicitacaoItem[]>(initialData.solicitacoes);
  const [crossModalOpen, setCrossModalOpen] = useState(false);
  const [crossDepto, setCrossDepto] = useState("Registro");
  const [crossItId, setCrossItId] = useState("");
  const [crossMotivo, setCrossMotivo] = useState("");
  const [crossUrgencia, setCrossUrgencia] = useState("normal");
  const [enviandoCross, setEnviandoCross] = useState(false);

  // Handlers

  // 1. Assinar Termo de Responsabilidade Mensal
  const handleAssinarTermo = async () => {
    setAssinando(true);
    try {
      const myDeptoIts = itsList.filter((it) => it.departamento === currentUser.departamento).map((i) => i.id);
      const res = await registrarAceiteMensal({
        departamento: currentUser.departamento,
        itsRevisadas: myDeptoIts,
      });
      setAceite({
        assinado: true,
        hash: res.hash,
        dataAssinatura: new Date().toLocaleString("pt-BR"),
        declaracao: "Declaro que revisei e minhas ITs estão atualizadas conforme o padrão interno",
      });
      alert(`Termo de Responsabilidade Operacional assinado com sucesso!\n\nHash SHA-256 Imutável:\n${res.hash}\n\nCustódia digital WORM registrada.`);
    } catch (err: any) {
      alert("Erro ao registrar aceite: " + (err.message || "Erro desconhecido"));
    } finally {
      setAssinando(false);
    }
  };

  const copyHashToClipboard = () => {
    if (!aceite.hash) return;
    navigator.clipboard.writeText(aceite.hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  // 2. Salvar / Editar IT
  const handleSaveIt = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoIt(true);
    try {
      await salvarOuAtualizarIt({
        id: editItModal?.id,
        codigo: formCodigo,
        titulo: formTitulo,
        departamento: formDepto,
        tempo: Number(formTempo),
        objetivo: formObjetivo,
        quandoUsar: formQuandoUsar,
        passos: formPassos,
      });

      if (editItModal) {
        setItsList((prev) =>
          prev.map((item) =>
            item.id === editItModal.id
              ? {
                  ...item,
                  codigo: formCodigo,
                  titulo: formTitulo,
                  departamento: formDepto,
                  tempoLeituraMin: Number(formTempo),
                  objetivo: formObjetivo,
                  quandoUsar: formQuandoUsar,
                  passoAPasso: formPassos,
                  diasSemRevisao: 0,
                }
              : item
          )
        );
        alert("IT atualizada com nova versão e hash gravado!");
        setEditItModal(null);
      } else {
        const novaIt: ITItem = {
          id: `it-${Date.now()}`,
          codigo: formCodigo,
          titulo: formTitulo,
          departamento: formDepto,
          versao: "1.0",
          vigencia: new Date().toISOString().split("T")[0],
          status: "ativa",
          objetivo: formObjetivo,
          quandoUsar: formQuandoUsar,
          tempoLeituraMin: Number(formTempo),
          passoAPasso: formPassos,
          updatedAt: new Date().toISOString(),
          diasSemRevisao: 0,
        };
        setItsList((prev) => [...prev, novaIt]);
        alert("Nova Instrução de Trabalho cadastrada e snapshot registrado!");
        setCreateItModalOpen(false);
      }
    } catch (err: any) {
      alert("Erro ao salvar IT: " + (err.message || "Erro desconhecido"));
    } finally {
      setSalvandoIt(false);
    }
  };

  // 3. Excluir IT WORM
  const handleConfirmDeleteIt = async (motivo: string, senhaAdmin: string) => {
    if (!itToDelete) return;
    await excluirItWorm(itToDelete.id, motivo, senhaAdmin);
    setItsList((prev) => prev.filter((i) => i.id !== itToDelete.id));
    alert(`IT ${itToDelete.codigo} arquivada via soft-delete WORM imutável com sucesso!`);
  };

  // 4. Solicitação Cross
  const handleEnviarSolicitacaoCross = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crossItId || !crossMotivo) {
      alert("Por favor selecione a IT e forneça a justificativa.");
      return;
    }
    setEnviandoCross(true);
    try {
      await solicitarAcessoCross({
        departamentoDestino: crossDepto,
        itId: crossItId,
        motivo: crossMotivo,
        urgencia: crossUrgencia,
      });

      const itObj = itsList.find((i) => i.id === crossItId);
      const novaSol: SolicitacaoItem = {
        id: `sol-${Date.now()}`,
        solicitanteId: currentUser.id,
        solicitanteNome: currentUser.name || "Colaborador",
        solicitanteDepto: currentUser.departamento,
        departamentoDestino: crossDepto,
        itId: crossItId,
        itCodigo: itObj?.codigo || "",
        itTitulo: itObj?.titulo || "",
        motivo: crossMotivo,
        urgencia: crossUrgencia,
        status: "pendente",
        diasLiberacao: 7,
        createdAt: new Date().toLocaleDateString("pt-BR"),
      };

      setSolicitacoesList([novaSol, ...solicitacoesList]);
      alert("Solicitação de capacitação cross enviada à Gestão com sucesso!");
      setCrossModalOpen(false);
      setCrossMotivo("");
    } catch (err: any) {
      alert("Erro ao solicitar acesso: " + (err.message || "Erro desconhecido"));
    } finally {
      setEnviandoCross(false);
    }
  };

  // 5. Responder Solicitação Cross
  const handleResponderCross = async (solId: string, acao: "aprovar" | "rejeitar") => {
    try {
      await responderSolicitacaoCross(solId, acao, 7);
      setSolicitacoesList((prev) =>
        prev.map((s) => (s.id === solId ? { ...s, status: acao === "aprovar" ? "aprovado" : "reprovado" } : s))
      );
      alert(`Solicitação ${acao === "aprovar" ? "aprovada por 7 dias" : "recusada"} com sucesso!`);
    } catch (err: any) {
      alert("Erro ao processar solicitação: " + (err.message || "Erro"));
    }
  };

  // 6. Atualizar Nível na Matriz
  const handleAtualizarNivel = async (nivel: number) => {
    if (!selectedCell) return;
    try {
      await atualizarNivelMatriz(selectedCell.userId, selectedCell.itId, nivel);
      setMatrizList((prev) => {
        const exists = prev.find((m) => m.usuarioId === selectedCell.userId && m.itId === selectedCell.itId);
        if (exists) {
          return prev.map((m) =>
            m.usuarioId === selectedCell.userId && m.itId === selectedCell.itId ? { ...m, nivel } : m
          );
        }
        return [
          ...prev,
          {
            id: `mat-${Date.now()}`,
            usuarioId: selectedCell.userId,
            itId: selectedCell.itId,
            nivel,
            dataAvaliacao: new Date().toISOString().split("T")[0],
          },
        ];
      });
      setSelectedCell(null);
    } catch (err: any) {
      alert("Erro ao atualizar nível: " + (err.message || "Erro"));
    }
  };

  // 7. Toggle Tutor
  const handleToggleTutor = async (user: ColaboradorItem) => {
    try {
      const novoStatus = !user.podeSerTutor;
      await toggleColaboradorTutor(user.id, novoStatus);
      setColabsList((prev) =>
        prev.map((c) => (c.id === user.id ? { ...c, podeSerTutor: novoStatus } : c))
      );
    } catch (err: any) {
      alert("Erro ao alterar permissão de tutor: " + (err.message || "Erro"));
    }
  };

  // Filtros
  const filteredIts = itsList.filter((i) => {
    const matchSearch =
      i.codigo.toLowerCase().includes(searchIt.toLowerCase()) ||
      i.titulo.toLowerCase().includes(searchIt.toLowerCase()) ||
      i.departamento.toLowerCase().includes(searchIt.toLowerCase());
    const matchDepto = filterDeptoIt === "TODOS" || i.departamento === filterDeptoIt;
    return matchSearch && matchDepto;
  });

  const filteredColabs = colabsList.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(searchColab.toLowerCase()) ||
      c.email.toLowerCase().includes(searchColab.toLowerCase()) ||
      c.cargo.toLowerCase().includes(searchColab.toLowerCase());
    const matchDepto = filterDeptoColab === "TODOS" || c.departamento === filterDeptoColab;
    return matchSearch && matchDepto;
  });

  const deptosList = ["Atendimento", "Registro", "Administração", "Impressão/Arquivo", "TI", "RH"];

  return (
    <div className="space-y-6">
      {/* Header com Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl border border-white/10 bg-[#10101a] shadow-2xl">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                INSTRUÇÕES DE TRABALHO & MATRIZ DE POLIVALÊNCIA
                <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  MÓDULO 4
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Padronização operacional, governança técnica e plano contínuo de aprendizagem — 7º RI SP
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-[#05050a] border border-white/15 rounded-xl p-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab("its")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === "its"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Minhas ITs + Aceite</span>
          </button>

          <button
            onClick={() => setActiveTab("colaboradores")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === "colaboradores"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Colaboradores ({colabsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("matriz")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
              activeTab === "matriz"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Plano & Matriz</span>
          </button>

          {isGestao && (
            <button
              onClick={() => setActiveTab("gestao")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === "gestao"
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Gerenciamento RH</span>
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: MINHAS ITS + RESPONSABILIDADE                                 */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "its" && (
        <div className="space-y-6">
          {/* Banner de Termo de Responsabilidade Mensal (SHA-256) */}
          <div
            className={`p-6 rounded-2xl border transition-all ${
              aceite.assinado
                ? "border-emerald-500/30 bg-gradient-to-r from-[#0d1a14] to-[#0a1410]"
                : "border-amber-500/40 bg-gradient-to-r from-[#1a140d] to-[#14100a]"
            }`}
          >
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileCheck
                    className={`w-5 h-5 ${aceite.assinado ? "text-emerald-400" : "text-amber-400"}`}
                  />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Termo de Responsabilidade Operacional — Setembro / 2026
                  </h3>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                      aceite.assinado
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {aceite.assinado ? "CIÊNCIA HOMOLOGADA" : "PENDENTE DE CIÊNCIA"}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  {aceite.assinado
                    ? "Sua ciência periódica foi registrada e assinada criptograficamente. Custódia WORM ativa."
                    : "«Declaro que revisei e minhas ITs estão atualizadas conforme o padrão interno.»"}
                </p>

                {aceite.assinado && aceite.hash && (
                  <div className="flex items-center gap-2 pt-2">
                    <span className="text-[11px] font-mono text-slate-400">Hash SHA-256:</span>
                    <code className="text-[11px] font-mono text-emerald-300 bg-black/40 px-2.5 py-1 rounded-lg border border-emerald-500/20 truncate max-w-md">
                      {aceite.hash}
                    </code>
                    <button
                      onClick={copyHashToClipboard}
                      className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors"
                      title="Copiar Hash"
                    >
                      {copiedHash ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono ml-2">
                      Registrado em: {aceite.dataAssinatura}
                    </span>
                  </div>
                )}
              </div>

              {!aceite.assinado && (
                <Button
                  onClick={handleAssinarTermo}
                  disabled={assinando}
                  className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-bold text-xs rounded-xl px-5 py-2.5 shadow-lg shadow-amber-900/40 gap-2 shrink-0"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{assinando ? "Gerando Hash..." : "Assinar Termo com Hash SHA-256"}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-white/10 bg-[#10101a]">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchIt}
                  onChange={(e) => setSearchIt(e.target.value)}
                  placeholder="Buscar por código ou título..."
                  className="bg-[#05050a] border-white/15 pl-9 text-xs h-9 rounded-xl text-white placeholder:text-slate-500"
                />
              </div>

              <select
                value={filterDeptoIt}
                onChange={(e) => setFilterDeptoIt(e.target.value)}
                className="bg-[#05050a] border border-white/15 text-white text-xs rounded-xl px-3 py-2 outline-none font-medium"
              >
                <option value="TODOS">Todos os Departamentos ({itsList.length})</option>
                {deptosList.map((d) => (
                  <option key={d} value={d}>
                    {d} ({itsList.filter((i) => i.departamento === d).length})
                  </option>
                ))}
              </select>
            </div>

            {isGestao && (
              <Button
                onClick={() => {
                  setFormCodigo(`IT-${formDepto.slice(0, 3).toUpperCase()}-00${itsList.length + 1}`);
                  setFormTitulo("");
                  setFormObjetivo("");
                  setFormQuandoUsar("");
                  setFormTempo(10);
                  setCreateItModalOpen(true);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl gap-2 shadow-lg shadow-indigo-600/30"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar Nova IT</span>
              </Button>
            )}
          </div>

          {/* Grid de Cards das ITs */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredIts.map((it) => (
              <div
                key={it.id}
                className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#10101a] p-5 shadow-xl hover:border-indigo-500/40 transition-all group"
              >
                <div className="space-y-3">
                  {/* Card Header: Código + Departamento + Versão */}
                  <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-black text-cyan-300 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                        {it.codigo}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-300 bg-white/5 px-2 py-1 rounded-md">
                        {it.departamento}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                      <Clock className="w-3 h-3 text-indigo-400" />
                      <span>{it.tempoLeituraMin} min</span>
                    </div>
                  </div>

                  {/* Título & Objetivo */}
                  <div>
                    <h3 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2">
                      {it.titulo}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {it.objetivo || "Instrução padronizada de conformidade técnica para execução no cartório."}
                    </p>
                  </div>

                  {/* Matriz RACI Resumida */}
                  {it.raci && Object.keys(it.raci).length > 0 && (
                    <div className="flex items-center gap-2 pt-1">
                      {it.raci.R && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">
                          R: {it.raci.R}
                        </span>
                      )}
                      {it.raci.A && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/20">
                          A: {it.raci.A}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer: Ações */}
                <div className="flex items-center justify-between border-t border-white/5 pt-4 mt-4">
                  <div className="flex items-center gap-2">
                    <Link href={`/instrucoes-trabalho/${it.id}`}>
                      <Button
                        size="sm"
                        className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs rounded-xl gap-1.5 border border-emerald-500/30 font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Abrir Folha A4</span>
                      </Button>
                    </Link>

                    <Button
                      size="sm"
                      onClick={() => setViewItModal(it)}
                      className="bg-white/5 hover:bg-white/10 text-slate-300 text-xs rounded-xl gap-1.5 border border-white/10"
                    >
                      <span>Passos</span>
                    </Button>
                  </div>

                  {isGestao && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditItModal(it);
                          setFormCodigo(it.codigo);
                          setFormTitulo(it.titulo);
                          setFormDepto(it.departamento);
                          setFormTempo(it.tempoLeituraMin);
                          setFormObjetivo(it.objetivo || "");
                          setFormQuandoUsar(it.quandoUsar || "");
                          setFormPassos(it.passoAPasso || []);
                        }}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                        title="Editar IT"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setItToDelete(it);
                          setDeleteItModalOpen(true);
                        }}
                        className="p-1.5 text-rose-400/70 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors"
                        title="Arquivar (WORM)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: COLABORADORES (63 REAIS)                                     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "colaboradores" && (
        <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Quadro de Colaboradores & Qualificação — 7º RI SP
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                63 colaboradores oficiais ativos, lotação departamental e habilitação de tutoria técnica
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchColab}
                  onChange={(e) => setSearchColab(e.target.value)}
                  placeholder="Buscar colaborador..."
                  className="bg-[#05050a] border-white/15 pl-9 text-xs h-9 rounded-xl text-white placeholder:text-slate-500"
                />
              </div>

              <select
                value={filterDeptoColab}
                onChange={(e) => setFilterDeptoColab(e.target.value)}
                className="bg-[#05050a] border border-white/15 text-white text-xs rounded-xl px-3 py-2 outline-none"
              >
                <option value="TODOS">Todos os Setores ({colabsList.length})</option>
                {deptosList.map((d) => (
                  <option key={d} value={d}>
                    {d} ({colabsList.filter((c) => c.departamento === d).length})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-y border-white/5">
                <tr>
                  <th className="py-3 px-4">Colaborador</th>
                  <th className="py-3 px-4">Departamento</th>
                  <th className="py-3 px-4">Cargo</th>
                  <th className="py-3 px-4">Função / Papel</th>
                  <th className="py-3 px-4">Tutor Habilitado</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium">
                {filteredColabs.map((c) => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-xs flex items-center justify-center border border-indigo-500/30 shrink-0">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-white font-bold">{c.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{c.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-slate-300 border border-white/10">
                        {c.departamento}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-300">{c.cargo}</td>

                    <td className="py-3 px-4">
                      {c.role === "MASTER" ? (
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          MASTER
                        </span>
                      ) : c.role === "ADMIN" ? (
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                          ADMIN
                        </span>
                      ) : c.role === "RH" ? (
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                          RH
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          COLABORADOR
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      {isGestao ? (
                        <button
                          onClick={() => handleToggleTutor(c)}
                          className={`text-[10px] font-mono px-2.5 py-1 rounded-full border transition-all ${
                            c.podeSerTutor
                              ? "bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30"
                              : "bg-slate-800 text-slate-400 border-white/5 hover:bg-white/10"
                          }`}
                        >
                          {c.podeSerTutor ? "★ Tutor Apto" : "Em Formação"}
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-400">
                          {c.podeSerTutor ? "★ Tutor Apto" : "Em Formação"}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: PLANO DE APRENDIZAGEM + MATRIZ DE POLIVALÊNCIA (0 A 4)       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "matriz" && (
        <div className="space-y-6">
          {/* Banner de Capacitação Cross-Setor */}
          <div className="p-6 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-[#101025] to-[#0c0c18] shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Capacitação Cross-Setor & Treinamento em Sombra
                </h3>
              </div>
              <p className="text-xs text-slate-300">
                Solicite liberação para estudar ITs de outros departamentos e evoluir seus níveis de polivalência.
              </p>
            </div>

            <Button
              onClick={() => setCrossModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl px-4 py-2 gap-2 shadow-lg shadow-indigo-600/30 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Solicitar Acesso Cross</span>
            </Button>
          </div>

          {/* Legenda de Níveis 0 a 4 */}
          <div className="p-4 rounded-2xl border border-white/10 bg-[#10101a] space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
              Escala de Polivalência Operacional (Níveis 0 a 4):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[0, 1, 2, 3, 4].map((lvl) => {
                const conf = NIVEL_CORES[lvl];
                return (
                  <div key={lvl} className={`p-2.5 rounded-xl border flex flex-col gap-1 ${conf.bg}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black font-mono">Nível {lvl}</span>
                      <span className="text-[9px] font-mono opacity-80 uppercase">Escala</span>
                    </div>
                    <span className="text-[11px] font-medium leading-tight">{conf.desc}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Matriz Heatmap Interativa */}
          <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Matriz de Competências & Polivalência (Mapa de Calor)
                </h3>
                <p className="text-xs text-slate-400">
                  Clique na célula para visualizar ou alterar o nível de qualificação do colaborador
                </p>
              </div>

              <select
                value={filterDeptoMatriz}
                onChange={(e) => setFilterDeptoMatriz(e.target.value)}
                className="bg-[#05050a] border border-white/15 text-white text-xs rounded-xl px-3 py-1.5 outline-none font-medium"
              >
                <option value="TODOS">Todos os Departamentos ({colabsList.length})</option>
                {deptosList.map((d) => (
                  <option key={d} value={d}>
                    {d} ({colabsList.filter((c) => c.departamento === d).length})
                  </option>
                ))}
              </select>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-y border-white/5">
                  <tr>
                    <th className="py-3 px-3 min-w-[200px] sticky left-0 bg-[#080811] z-10 border-r border-white/5">
                      Colaborador
                    </th>
                    {itsList.map((it) => (
                      <th key={it.id} className="py-3 px-2 text-center min-w-[75px]" title={it.titulo}>
                        <div className="font-bold text-cyan-300">{it.codigo.replace("IT-", "")}</div>
                        <div className="text-[9px] text-slate-500 truncate max-w-[70px]">{it.departamento}</div>
                      </th>
                    ))}
                    <th className="py-3 px-3 text-center min-w-[80px]">Média</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {colabsList
                    .filter((c) => filterDeptoMatriz === "TODOS" || c.departamento === filterDeptoMatriz)
                    .map((colab) => {
                      const userRatings = itsList.map((it) => {
                        const entry = matrizList.find((m) => m.usuarioId === colab.id && m.itId === it.id);
                        return entry ? entry.nivel : 0;
                      });
                      const media = (userRatings.reduce((a, b) => a + b, 0) / (itsList.length || 1)).toFixed(1);

                      return (
                        <tr key={colab.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-2.5 px-3 font-medium text-white sticky left-0 bg-[#10101a] z-10 border-r border-white/5">
                            <div className="truncate max-w-[190px]">{colab.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{colab.cargo}</div>
                          </td>

                          {itsList.map((it) => {
                            const entry = matrizList.find((m) => m.usuarioId === colab.id && m.itId === it.id);
                            const nivel = entry ? entry.nivel : 0;
                            const conf = NIVEL_CORES[nivel];

                            return (
                              <td key={it.id} className="py-1 px-1 text-center">
                                <button
                                  onClick={() =>
                                    setSelectedCell({
                                      userId: colab.id,
                                      userName: colab.name,
                                      itId: it.id,
                                      itCodigo: it.codigo,
                                      nivelAtual: nivel,
                                    })
                                  }
                                  className={`w-9 h-8 rounded-lg font-mono font-bold text-xs transition-transform hover:scale-110 flex items-center justify-center mx-auto ${conf.bg}`}
                                  title={`${colab.name} — ${it.codigo}: Nível ${nivel} (${conf.desc})`}
                                >
                                  {nivel}
                                </button>
                              </td>
                            );
                          })}

                          <td className="py-2 px-3 text-center font-mono font-bold text-cyan-400">
                            {media}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: GERENCIAMENTO RH                                             */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "gestao" && isGestao && (
        <div className="space-y-6">
          {/* KPIs Gerenciais */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-white/10 bg-[#10101a]">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ITs Ativas</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-white">{itsList.length}</span>
                <span className="text-xs text-slate-400">padronizadas</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">100% sob governança</p>
            </div>

            <div className="p-4 rounded-2xl border border-white/10 bg-[#10101a]">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Colaboradores</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-cyan-400">{colabsList.length}</span>
                <span className="text-xs text-cyan-400/80 font-bold">7º RI SP</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Base oficial sem fictícios</p>
            </div>

            <div className="p-4 rounded-2xl border border-white/10 bg-[#10101a]">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Solicitações Cross</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-400">
                  {solicitacoesList.filter((s) => s.status === "pendente").length}
                </span>
                <span className="text-xs text-amber-400/80 font-semibold">pendentes</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Aguardam liberação RH</p>
            </div>

            <div className="p-4 rounded-2xl border border-white/10 bg-[#10101a]">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Revisão &gt;90 Dias</span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-400">
                  {itsList.filter((i) => i.diasSemRevisao > 90).length}
                </span>
                <span className="text-xs text-emerald-400/80 font-semibold">em dia</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Ciclo de melhoria contínua</p>
            </div>
          </div>

          {/* Fila de Solicitações Cross-Setor Pendentes */}
          <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Solicitações de Acesso Cross-Setor Aguardando Aprovação
            </h3>

            {solicitacoesList.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Nenhuma solicitação pendente no momento.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {solicitacoesList.map((sol) => (
                  <div key={sol.id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{sol.solicitanteNome}</span>
                        <span className="text-[10px] font-mono text-slate-400">({sol.solicitanteDepto})</span>
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                        <span className="text-xs font-mono font-bold text-cyan-300">{sol.itCodigo}</span>
                        <span className="text-xs text-slate-300">— {sol.itTitulo}</span>
                      </div>
                      <p className="text-xs text-slate-400 italic">«{sol.motivo}»</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {sol.status === "pendente" ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleResponderCross(sol.id, "aprovar")}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl"
                          >
                            Aprovar (7 Dias)
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleResponderCross(sol.id, "rejeitar")}
                            className="text-rose-400 hover:bg-rose-500/10 text-xs rounded-xl"
                          >
                            Recusar
                          </Button>
                        </>
                      ) : (
                        <span
                          className={`text-[10px] font-mono px-2 py-1 rounded-full font-bold uppercase ${
                            sol.status === "aprovado"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {sol.status}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tabela de Monitoramento de Atualização das ITs (>90 dias) */}
          <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Relatório de Revisão Periódica das ITs (Melhoria Contínua)
            </h3>
            <p className="text-xs text-slate-400">
              ITs que ultrapassam 90 dias sem revisão interna são sinalizadas para atualização mandatória pelos líderes de setor.
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#080811] text-[11px] font-mono uppercase text-slate-400 border-y border-white/5">
                  <tr>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Título da IT</th>
                    <th className="py-3 px-4">Departamento</th>
                    <th className="py-3 px-4">Versão</th>
                    <th className="py-3 px-4">Dias sem Revisão</th>
                    <th className="py-3 px-4">Status de Governança</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-medium">
                  {itsList.map((it) => {
                    const statusRevisao =
                      it.diasSemRevisao > 90
                        ? { label: "Revisão Mandatória", bg: "bg-rose-500/20 text-rose-300 border-rose-500/30" }
                        : it.diasSemRevisao > 60
                        ? { label: "Atenção Próxima", bg: "bg-amber-500/20 text-amber-300 border-amber-500/30" }
                        : { label: "Em Dia", bg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" };

                    return (
                      <tr key={it.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-4 font-mono font-bold text-cyan-300">{it.codigo}</td>
                        <td className="py-3 px-4 text-white font-bold">{it.titulo}</td>
                        <td className="py-3 px-4 text-slate-300">{it.departamento}</td>
                        <td className="py-3 px-4 font-mono">{it.versao}</td>
                        <td className="py-3 px-4 font-mono">{it.diasSemRevisao} dias</td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold uppercase ${statusRevisao.bg}`}
                          >
                            {statusRevisao.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: VISUALIZAR PASSO A PASSO DA IT                                */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {viewItModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-3xl max-h-[90vh] bg-[#0d0d18] border border-white/15 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121422]">
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono font-black text-cyan-300 bg-cyan-500/15 px-3 py-1 rounded-lg border border-cyan-500/30">
                  {viewItModal.codigo}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">{viewItModal.titulo}</h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Departamento: {viewItModal.departamento} • Versão {viewItModal.versao} • Tempo de Leitura: {viewItModal.tempoLeituraMin} min
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewItModal(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Objetivo & Quando Usar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Objetivo:</span>
                  <p className="text-xs text-slate-300 leading-relaxed">{viewItModal.objetivo || "Não informado."}</p>
                </div>
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-1">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Quando Usar:</span>
                  <p className="text-xs text-slate-300 leading-relaxed">{viewItModal.quandoUsar || "Rotina operacional diária."}</p>
                </div>
              </div>

              {/* Matriz RACI */}
              {viewItModal.raci && (
                <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl space-y-2">
                  <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">Matriz RACI de Responsabilidades:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                      <strong className="text-blue-300 block">R - Responsável:</strong>
                      <span className="text-slate-300">{viewItModal.raci.R || "Equipe"}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs">
                      <strong className="text-purple-300 block">A - Aprovador:</strong>
                      <span className="text-slate-300">{viewItModal.raci.A || "Oficial Substituto"}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                      <strong className="text-amber-300 block">C - Consultado:</strong>
                      <span className="text-slate-300">{viewItModal.raci.C || "Setor"}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                      <strong className="text-emerald-300 block">I - Informado:</strong>
                      <span className="text-slate-300">{viewItModal.raci.I || "Interessados"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Passo a Passo Interativo */}
              <div className="space-y-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider block">
                  Roteiro Operacional Passo a Passo:
                </span>
                <div className="space-y-2.5">
                  {viewItModal.passoAPasso && viewItModal.passoAPasso.length > 0 ? (
                    viewItModal.passoAPasso.map((p, idx) => (
                      <div key={idx} className="flex gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/5 items-start">
                        <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {p.ordem || idx + 1}
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-white">{p.titulo}</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">Etapas padronizadas detalhadas na versão digital.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-[#121422] border-t border-white/10 flex justify-end">
              <Button size="sm" onClick={() => setViewItModal(null)} className="bg-white/10 hover:bg-white/20 text-xs">
                Fechar Visualização
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: CRIAR / EDITAR IT                                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {(createItModalOpen || editItModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#0d0d18] border border-white/15 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121422]">
              <h3 className="text-sm font-bold text-white">
                {editItModal ? `Editar IT — ${editItModal.codigo}` : "Cadastrar Nova Instrução de Trabalho"}
              </h3>
              <button
                onClick={() => {
                  setCreateItModalOpen(false);
                  setEditItModal(null);
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveIt} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Código da IT *</label>
                  <Input
                    value={formCodigo}
                    onChange={(e) => setFormCodigo(e.target.value)}
                    required
                    className="bg-[#05050a] border-white/15 text-white font-mono text-xs rounded-xl"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs text-slate-300 block mb-1">Título da IT *</label>
                  <Input
                    value={formTitulo}
                    onChange={(e) => setFormTitulo(e.target.value)}
                    required
                    placeholder="Ex: Recepção e Exame de Prenotação..."
                    className="bg-[#05050a] border-white/15 text-white text-xs rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Departamento *</label>
                  <select
                    value={formDepto}
                    onChange={(e) => setFormDepto(e.target.value)}
                    className="w-full bg-[#05050a] border border-white/15 text-white text-xs rounded-xl p-2.5"
                  >
                    {deptosList.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1">Tempo de Leitura (min) *</label>
                  <Input
                    type="number"
                    value={formTempo}
                    onChange={(e) => setFormTempo(Number(e.target.value))}
                    min={1}
                    max={120}
                    className="bg-[#05050a] border-white/15 text-white text-xs rounded-xl font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Objetivo da IT *</label>
                <textarea
                  value={formObjetivo}
                  onChange={(e) => setFormObjetivo(e.target.value)}
                  rows={2}
                  required
                  placeholder="Defina o objetivo técnico da instrução..."
                  className="w-full bg-[#05050a] border border-white/15 text-white text-xs rounded-xl p-3 outline-none"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Quando Usar *</label>
                <textarea
                  value={formQuandoUsar}
                  onChange={(e) => setFormQuandoUsar(e.target.value)}
                  rows={2}
                  required
                  placeholder="Circunstâncias operacionais em que esta IT deve ser executada..."
                  className="w-full bg-[#05050a] border border-white/15 text-white text-xs rounded-xl p-3 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setCreateItModalOpen(false);
                    setEditItModal(null);
                  }}
                  className="text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={salvandoIt}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
                >
                  {salvandoIt ? "Gravando Snapshot..." : "Salvar Instrução de Trabalho"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: SELETOR RÁPIDO DE NÍVEL DE POLIVALÊNCIA (0 A 4)              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-md bg-[#0d0d18] border border-white/15 rounded-2xl flex flex-col shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Avaliação de Polivalência</h3>
                <p className="text-xs text-cyan-300 font-mono">
                  {selectedCell.userName} • {selectedCell.itCodigo}
                </p>
              </div>
              <button onClick={() => setSelectedCell(null)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Selecione o nível de proficiência técnica para este colaborador nesta IT:
            </p>

            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((lvl) => {
                const conf = NIVEL_CORES[lvl];
                const isCurrent = selectedCell.nivelAtual === lvl;
                return (
                  <button
                    key={lvl}
                    onClick={() => handleAtualizarNivel(lvl)}
                    className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                      isCurrent
                        ? "border-cyan-400 bg-cyan-500/20 text-white"
                        : "border-white/5 hover:border-white/20 bg-white/[0.02] text-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center ${conf.bg}`}>
                        {lvl}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-white">Nível {lvl}</div>
                        <div className="text-[11px] text-slate-400">{conf.desc}</div>
                      </div>
                    </div>
                    {isCurrent && <Check className="w-4 h-4 text-cyan-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: SOLICITAR ACESSO CROSS-SETOR                                  */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {crossModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg bg-[#0d0d18] border border-white/15 rounded-2xl flex flex-col shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white">Solicitar Capacitação Cross-Setor</h3>
              <button onClick={() => setCrossModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEnviarSolicitacaoCross} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Departamento de Destino *</label>
                <select
                  value={crossDepto}
                  onChange={(e) => {
                    setCrossDepto(e.target.value);
                    setCrossItId("");
                  }}
                  className="w-full bg-[#05050a] border border-white/15 text-white text-xs rounded-xl p-2.5"
                >
                  {deptosList
                    .filter((d) => d !== currentUser.departamento)
                    .map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Instrução de Trabalho Desejada *</label>
                <select
                  value={crossItId}
                  onChange={(e) => setCrossItId(e.target.value)}
                  required
                  className="w-full bg-[#05050a] border border-white/15 text-white text-xs rounded-xl p-2.5"
                >
                  <option value="">Selecione a IT...</option>
                  {itsList
                    .filter((i) => i.departamento === crossDepto)
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.codigo} — {i.titulo}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Motivo / Justificativa de Aprendizagem *</label>
                <textarea
                  value={crossMotivo}
                  onChange={(e) => setCrossMotivo(e.target.value)}
                  rows={3}
                  required
                  placeholder="Explique o interesse em aprender o procedimento deste setor..."
                  className="w-full bg-[#05050a] border border-white/15 text-white text-xs rounded-xl p-3 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-white/10">
                <Button type="button" variant="ghost" onClick={() => setCrossModalOpen(false)} className="text-xs">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={enviandoCross}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl"
                >
                  {enviandoCross ? "Enviando..." : "Enviar Solicitação ao RH"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* MODAL: EXCLUSÃO WORM IMUTÁVEL                                       */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <DeleteConfirmModal
        isOpen={deleteItModalOpen}
        onClose={() => {
          setDeleteItModalOpen(false);
          setItToDelete(null);
        }}
        onConfirm={handleConfirmDeleteIt}
        title="Arquivamento de IT (WORM)"
        itemDescription={itToDelete ? `${itToDelete.codigo} — ${itToDelete.titulo}` : ""}
      />
    </div>
  );
}
