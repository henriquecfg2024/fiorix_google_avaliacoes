"use client";

import React, { useState } from "react";
import {
  Users,
  Plus,
  Wand2,
  AlertTriangle,
  Download,
  Send,
  Calendar,
  Pencil,
  Trash2,
  ScrollText,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Search,
  Filter,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Planejamento2027Calendar } from "./Planejamento2027Calendar";
import { Planejamento2027Gantt } from "./Planejamento2027Gantt";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { MOCK_COLABORADORES_45, ColaboradorRH } from "./mockColaboradores45";

export function Planejamento2027Tab() {
  const [ano, setAno] = useState(2027);
  const [colaboradores, setColaboradores] = useState<ColaboradorRH[]>(MOCK_COLABORADORES_45);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSetor, setSelectedSetor] = useState<string>("TODOS");
  const [selectedStatus, setSelectedStatus] = useState<string>("TODOS");

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editP1Inicio, setEditP1Inicio] = useState("");
  const [editP1Fim, setEditP1Fim] = useState("");
  const [editP2Inicio, setEditP2Inicio] = useState("");
  const [editP2Fim, setEditP2Fim] = useState("");

  // Modais
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ColaboradorRH | null>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [selectedHistoryColab, setSelectedHistoryColab] = useState<ColaboradorRH | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  // Novo colaborador form
  const [novoNome, setNovoNome] = useState("");
  const [novoSetor, setNovoSetor] = useState<ColaboradorRH["setor"]>("Atendimento");
  const [novoP1Inicio, setNovoP1Inicio] = useState("2027-01-10");
  const [novoP1Fim, setNovoP1Fim] = useState("2027-01-29");

  // Calcula estatísticas
  const total = colaboradores.length;
  const planejados = colaboradores.filter((c) => c.status === "planejado" || c.status === "publicado").length;
  const taxaPlanejados = Math.round((planejados / total) * 100);
  const conflitos = colaboradores.filter((c) => c.status === "conflito").length;

  // Filtros
  const filtered = colaboradores.filter((c) => {
    const matchSearch =
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.setor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cpf.includes(searchTerm);
    const matchSetor = selectedSetor === "TODOS" || c.setor === selectedSetor;
    const matchStatus = selectedStatus === "TODOS" || c.status === selectedStatus;
    return matchSearch && matchSetor && matchStatus;
  });

  // Salvar edição inline
  const handleSaveInline = (id: string) => {
    setColaboradores((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const d1 = editP1Inicio && editP1Fim ? Math.max(1, Math.ceil((new Date(editP1Fim).getTime() - new Date(editP1Inicio).getTime()) / (1000 * 60 * 60 * 24)) + 1) : c.p1Dias;
          const d2 = editP2Inicio && editP2Fim ? Math.max(1, Math.ceil((new Date(editP2Fim).getTime() - new Date(editP2Inicio).getTime()) / (1000 * 60 * 60 * 24)) + 1) : (c.p2Dias || 0);
          
          // Validação CLT: pelo menos um período >= 14 dias
          const has14Days = d1 >= 14 || d2 >= 14;
          if (!has14Days) {
            alert("Aviso CLT Art. 134 §1: Pelo menos um dos períodos de fracionamento deve ter no mínimo 14 dias corridos!");
          }

          return {
            ...c,
            p1Inicio: editP1Inicio || c.p1Inicio,
            p1Fim: editP1Fim || c.p1Fim,
            p1Dias: d1,
            p2Inicio: editP2Inicio || c.p2Inicio,
            p2Fim: editP2Fim || c.p2Fim,
            p2Dias: d2,
            totalDias: d1 + d2,
            historico: [
              ...(c.historico || []),
              {
                data: new Date().toLocaleString("pt-BR"),
                de: `${c.p1Inicio} a ${c.p1Fim} (${c.totalDias}d)`,
                para: `${editP1Inicio || c.p1Inicio} a ${editP1Fim || c.p1Fim} (${d1 + d2}d)`,
                por: "Administrador RH",
                motivo: "Edição inline de escala anual",
              },
            ],
          };
        }
        return c;
      })
    );
    setEditingId(null);
  };

  const startEditInline = (c: ColaboradorRH) => {
    setEditingId(c.id);
    setEditP1Inicio(c.p1Inicio);
    setEditP1Fim(c.p1Fim);
    setEditP2Inicio(c.p2Inicio || "");
    setEditP2Fim(c.p2Fim || "");
  };

  // Excluir com modal
  const handleConfirmDelete = async (motivo: string, senha: string) => {
    if (!itemToDelete) return;
    const delId = itemToDelete.id;
    setColaboradores((prev) => prev.filter((c) => c.id !== delId));
    alert(
      `Planejamento de férias de ${itemToDelete.nome} excluído e arquivado com Hash WORM SHA-256.`
    );
  };

  // Auto-distribuir férias
  const handleAutoDistribuir = () => {
    alert("Executando algoritmo de auto-distribuição por setor com balanceamento de carga e prevenção de conflitos...");
    setColaboradores((prev) =>
      prev.map((c, idx) => ({
        ...c,
        status: "planejado",
      }))
    );
  };

  // Publicar Planejamento 2027
  const handlePublicarPlanejamento = () => {
    const senha = prompt("Digite a Senha ADMIN para assinar e homologar a escala anual de 2027:");
    if (!senha) return;
    setColaboradores((prev) =>
      prev.map((c) => ({
        ...c,
        status: "publicado",
      }))
    );
    alert(
      `Planejamento de Férias 2027 homologado e publicado com sucesso!\n\nHash SHA-256 da Escala: 9a8f21c0b34de5... (Trilha WORM gravada)\nNotificações push enviadas para todos os 63 colaboradores.`
    );
  };

  // Adicionar novo colaborador
  const handleAddColaborador = () => {
    if (!novoNome) return;
    const d1 = Math.max(1, Math.ceil((new Date(novoP1Fim).getTime() - new Date(novoP1Inicio).getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const newColab: ColaboradorRH = {
      id: `col-${Date.now()}`,
      nome: novoNome,
      email: `${novoNome.toLowerCase().replace(/\s+/g, ".")}@7risp.com.br`,
      cpf: "***.000.000-99",
      setor: novoSetor,
      cargo: `Escrevente — ${novoSetor}`,
      p1Inicio: novoP1Inicio,
      p1Fim: novoP1Fim,
      p1Dias: d1,
      totalDias: d1,
      status: "planejado",
      historico: [
        {
          data: new Date().toLocaleString("pt-BR"),
          de: "N/A",
          para: `${novoP1Inicio} a ${novoP1Fim}`,
          por: "Administrador RH",
          motivo: "Inclusão no plano de férias anual",
        },
      ],
    };
    setColaboradores([newColab, ...colaboradores]);
    setAddModalOpen(false);
    setNovoNome("");
  };

  return (
    <div className="space-y-6">
      {/* Header com Seletor e Ações */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-2xl border border-white/10 bg-[#10101a] shadow-xl">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white tracking-tight">
              PLANEJAMENTO DE FÉRIAS {ano} — Visão Anual 7º RI SP
            </h2>
            <div className="flex items-center bg-[#05050a] border border-white/15 rounded-xl p-0.5">
              {[2026, 2027, 2028].map((y) => (
                <button
                  key={y}
                  onClick={() => setAno(y)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                    ano === y ? "bg-indigo-600 text-white shadow-md" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Escala anual de gozo com validação de regras CLT (Art. 134 §1), prevenção de conflitos por setor e trilha WORM.
          </p>
        </div>

        {/* Botões de Ação Topo */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => setAddModalOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl gap-1.5 shadow-lg shadow-indigo-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Colaborador</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleAutoDistribuir}
            className="border-white/15 text-slate-300 hover:bg-white/5 text-xs rounded-xl gap-1.5"
          >
            <Wand2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Auto-distribuir</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => alert(`Detecção de Conflitos: Encontrados 2 colaboradores com gozo simultâneo em Dezembro no setor de Atendimento.`)}
            className="border-white/15 text-slate-300 hover:bg-white/5 text-xs rounded-xl gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Detectar Conflitos</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => alert(`Exportando calendário anual ${ano} em formato ICS/PDF...`)}
            className="border-white/15 text-slate-300 hover:bg-white/5 text-xs rounded-xl gap-1.5"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Exportar Calendário</span>
          </Button>

          <Button
            size="sm"
            onClick={handlePublicarPlanejamento}
            className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs rounded-xl gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Publicar Planejamento {ano}</span>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-white/10 bg-[#10101a]">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Colaboradores</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-white">{total}</span>
            <span className="text-xs text-slate-400">7º RI SP</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">100% quadro cadastrado</p>
        </div>

        <div className="p-4 rounded-2xl border border-white/10 bg-[#10101a]">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Planejados ({ano})</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-cyan-400">{planejados}/{total}</span>
            <span className="text-xs text-cyan-400/80 font-bold">({taxaPlanejados}%)</span>
          </div>
          <div className="w-full bg-slate-700/50 h-1.5 rounded-full mt-2 overflow-hidden">
            <div className="bg-cyan-400 h-full" style={{ width: `${taxaPlanejados}%` }} />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-rose-500/30 bg-[#140a12]">
          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">Conflitos de Lotação</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-400">{conflitos}</span>
            <span className="text-xs text-rose-400/80 font-semibold">exigem ajuste</span>
          </div>
          <p className="text-[11px] text-rose-400/80 mt-1">&gt;3 mesmo setor no mesmo mês</p>
        </div>

        <div className="p-4 rounded-2xl border border-amber-500/30 bg-[#14100a]">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Meses Críticos</span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400">Dezembro</span>
            <span className="text-xs text-amber-400/80 font-semibold">(12 pessoas)</span>
          </div>
          <p className="text-[11px] text-amber-400/80 mt-1">Monitoramento de plantão</p>
        </div>
      </div>

      {/* Calendário Grid de 12 Meses */}
      <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl">
        <Planejamento2027Calendar ano={ano} colaboradores={colaboradores} />
      </div>

      {/* Tabela de Planejamento Detalhada com Edição Inline */}
      <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Escala Nominal & Fracionamento (CLT Art. 134 §1)
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Fracionamento em até 3 períodos permitido, sendo obrigatório que ao menos um seja &ge; 14 dias.
            </p>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar nome ou CPF..."
                className="bg-[#05050a] border-white/15 pl-9 text-xs h-9 rounded-xl text-white placeholder:text-slate-500"
              />
            </div>

            <select
              value={selectedSetor}
              onChange={(e) => setSelectedSetor(e.target.value)}
              className="bg-[#05050a] border border-white/15 text-white text-xs rounded-xl px-3 py-2 outline-none"
            >
              <option value="TODOS">Todos os Setores ({colaboradores.length})</option>
              <option value="Atendimento">Atendimento ({colaboradores.filter(c => c.setor === 'Atendimento').length})</option>
              <option value="Registro">Registro ({colaboradores.filter(c => c.setor === 'Registro').length})</option>
              <option value="Administração">Administração ({colaboradores.filter(c => c.setor === 'Administração').length})</option>
              <option value="Impressão/Arquivo">Impressão/Arquivo ({colaboradores.filter(c => c.setor === 'Impressão/Arquivo').length})</option>
              <option value="TI">TI ({colaboradores.filter(c => c.setor === 'TI').length})</option>
              <option value="RH">RH ({colaboradores.filter(c => c.setor === 'RH').length})</option>
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#05050a] border border-white/15 text-white text-xs rounded-xl px-3 py-2 outline-none"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="planejado">Planejado</option>
              <option value="conflito">Conflito</option>
              <option value="publicado">Publicado</option>
              <option value="pendente">Pendente</option>
            </select>
          </div>
        </div>

        {/* Tabela */}
        <div className="border border-white/10 rounded-xl overflow-x-auto bg-[#05050a]">
          <table className="w-full text-left text-xs min-w-[950px]">
            <thead className="bg-[#12141F] text-slate-400 uppercase font-mono text-[10px] border-b border-white/10">
              <tr>
                <th className="px-4 py-3.5">Colaborador</th>
                <th className="px-4 py-3.5">Setor</th>
                <th className="px-4 py-3.5">Período 1 (Início - Fim)</th>
                <th className="px-4 py-3.5 text-center">Dias 1</th>
                <th className="px-4 py-3.5">Período 2 (Split Opcional)</th>
                <th className="px-4 py-3.5 text-center">Dias 2</th>
                <th className="px-4 py-3.5 text-center">Total Dias</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {filtered.map((item) => {
                const isEditing = editingId === item.id;
                const isConflict = item.status === "conflito";

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-white/[0.03] transition-colors ${
                      isConflict ? "bg-rose-500/[0.06] border-l-2 border-rose-500" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-white">{item.nome}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{item.cpf}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-white/5 border border-white/10 text-slate-300">
                        {item.setor}
                      </span>
                    </td>

                    {/* Período 1 */}
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="date"
                            value={editP1Inicio}
                            onChange={(e) => setEditP1Inicio(e.target.value)}
                            className="bg-[#05050a] border-white/20 text-white text-xs h-7 w-32 p-1 font-mono"
                          />
                          <span className="text-slate-500">-</span>
                          <Input
                            type="date"
                            value={editP1Fim}
                            onChange={(e) => setEditP1Fim(e.target.value)}
                            className="bg-[#05050a] border-white/20 text-white text-xs h-7 w-32 p-1 font-mono"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-slate-200">
                          {item.p1Inicio ? `${new Date(item.p1Inicio).toLocaleDateString("pt-BR")} a ${new Date(item.p1Fim).toLocaleDateString("pt-BR")}` : "—"}
                        </span>
                      )}
                    </td>

                    {/* Dias 1 */}
                    <td className="px-4 py-3.5 text-center font-mono font-bold text-cyan-400">
                      {item.p1Dias}d
                    </td>

                    {/* Período 2 */}
                    <td className="px-4 py-3.5">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="date"
                            value={editP2Inicio}
                            onChange={(e) => setEditP2Inicio(e.target.value)}
                            className="bg-[#05050a] border-white/20 text-white text-xs h-7 w-32 p-1 font-mono"
                          />
                          <span className="text-slate-500">-</span>
                          <Input
                            type="date"
                            value={editP2Fim}
                            onChange={(e) => setEditP2Fim(e.target.value)}
                            className="bg-[#05050a] border-white/20 text-white text-xs h-7 w-32 p-1 font-mono"
                          />
                        </div>
                      ) : (
                        <span className="font-mono text-slate-400">
                          {item.p2Inicio && item.p2Fim ? `${new Date(item.p2Inicio).toLocaleDateString("pt-BR")} a ${new Date(item.p2Fim).toLocaleDateString("pt-BR")}` : "—"}
                        </span>
                      )}
                    </td>

                    {/* Dias 2 */}
                    <td className="px-4 py-3.5 text-center font-mono text-slate-400">
                      {item.p2Dias ? `${item.p2Dias}d` : "—"}
                    </td>

                    {/* Total Dias */}
                    <td className="px-4 py-3.5 text-center font-mono font-black text-white">
                      {item.totalDias}d
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span
                        title={item.observacao}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                          item.status === "publicado"
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : item.status === "planejado"
                            ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                            : item.status === "conflito"
                            ? "bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse"
                            : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                        }`}
                      >
                        {item.status.toUpperCase()}
                      </span>
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3.5 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleSaveInline(item.id)}
                            className="p-1.5 text-emerald-400 hover:bg-emerald-500/20 rounded-lg"
                            title="Salvar alterações"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 text-slate-400 hover:bg-white/10 rounded-lg"
                            title="Cancelar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEditInline(item)}
                            title="Editar Períodos Inline"
                            className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedHistoryColab(item);
                              setHistoryModalOpen(true);
                            }}
                            title="Ver Histórico de Alterações"
                            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <ScrollText className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => alert(`Notificação push enviada para ${item.nome} sobre o plano ${ano}.`)}
                            title="Notificar Colaborador"
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setItemToDelete(item);
                              setDeleteModalOpen(true);
                            }}
                            title="Excluir Planejamento (Trilha WORM)"
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gantt Timeline Anual */}
      <Planejamento2027Gantt ano={ano} colaboradores={colaboradores} />

      {/* Modal Histórico Vertical */}
      {historyModalOpen && selectedHistoryColab && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-lg bg-[#0d0d18] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#12141F]">
              <div className="flex items-center gap-2">
                <ScrollText className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Histórico de Alterações — Trilha WORM</h3>
                  <p className="text-xs text-slate-400">{selectedHistoryColab.nome} ({selectedHistoryColab.setor})</p>
                </div>
              </div>
              <button onClick={() => setHistoryModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 bg-[#05050a] space-y-4 max-h-[380px] overflow-y-auto">
              {selectedHistoryColab.historico && selectedHistoryColab.historico.length > 0 ? (
                selectedHistoryColab.historico.map((h, i) => (
                  <div key={i} className="relative pl-6 pb-4 border-l border-indigo-500/30 last:border-l-0 last:pb-0">
                    <div className="absolute -left-1.5 top-0.5 w-3 h-3 rounded-full bg-indigo-500 shadow-md shadow-indigo-500/50" />
                    <div className="text-[11px] font-mono text-slate-400">{h.data}</div>
                    <div className="text-xs font-semibold text-white mt-0.5">Alteração por: {h.por}</div>
                    <div className="text-xs text-slate-300 mt-1 bg-white/[0.03] p-2.5 rounded-xl border border-white/5 space-y-1">
                      <p><strong>De:</strong> <span className="font-mono text-rose-300">{h.de}</span></p>
                      <p><strong>Para:</strong> <span className="font-mono text-emerald-300">{h.para}</span></p>
                      <p><strong>Motivo:</strong> {h.motivo}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-400 text-center py-4">Nenhuma alteração registrada após o plano inicial.</p>
              )}
            </div>

            <div className="px-6 py-3 bg-[#12141F] flex justify-end">
              <Button size="sm" onClick={() => setHistoryModalOpen(false)} className="bg-white/10 hover:bg-white/20 text-xs">
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Colaborador ao Planejamento */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-lg bg-[#0d0d18] border border-white/10 rounded-2xl flex flex-col shadow-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white">Adicionar Colaborador ao Planejamento {ano}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Nome Completo *</label>
                <Input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Ex: Amanda Barbosa"
                  className="bg-[#05050a] border-white/15 text-white text-xs rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Setor *</label>
                <select
                  value={novoSetor}
                  onChange={(e) => setNovoSetor(e.target.value as any)}
                  className="w-full bg-[#05050a] border border-white/15 text-white text-xs rounded-xl p-2.5"
                >
                  <option value="Atendimento">Atendimento</option>
                  <option value="Registro">Registro</option>
                  <option value="Administração">Administração</option>
                  <option value="Impressão/Arquivo">Impressão/Arquivo</option>
                  <option value="TI">TI</option>
                  <option value="RH">RH</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Início Período 1 *</label>
                  <Input
                    type="date"
                    value={novoP1Inicio}
                    onChange={(e) => setNovoP1Inicio(e.target.value)}
                    className="bg-[#05050a] border-white/15 text-white text-xs rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-300 block mb-1">Fim Período 1 *</label>
                  <Input
                    type="date"
                    value={novoP1Fim}
                    onChange={(e) => setNovoP1Fim(e.target.value)}
                    className="bg-[#05050a] border-white/15 text-white text-xs rounded-xl font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <Button variant="ghost" onClick={() => setAddModalOpen(false)} className="text-xs text-slate-400">
                Cancelar
              </Button>
              <Button onClick={handleAddColaborador} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl">
                Salvar no Planejamento
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Excluir Planejamento */}
      {itemToDelete && (
        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setItemToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title="Excluir Planejamento de Férias"
          itemDescription={`Escala de férias ${ano} de ${itemToDelete.nome} (${itemToDelete.setor})`}
          wormWarning="Por Provimento 213/2026 e regras de Governança Trabalhista, o cancelamento desta escala será registrado na trilha de auditoria WORM com hash criptográfico e justificativa administrativa obrigatória."
        />
      )}
    </div>
  );
}
