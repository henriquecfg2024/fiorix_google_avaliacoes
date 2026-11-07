"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MessageSquarePlus,
  History,
  Reply,
  Edit3,
  CheckCircle2,
  Clock,
  Search,
  Loader2,
  UserCheck,
  Building2,
} from "lucide-react";
import {
  criarAnotacaoTarefaAction,
  editarAnotacaoTarefaAction,
} from "@/app/actions/cartorio-virtual";
import type { AnotacaoTarefaDTO } from "@/lib/cartorio-virtual/repository";
import {
  correspondeFiltroTipoCertidao,
  OPCOES_FILTRO_TIPO_CERTIDAO,
  type FiltroTipoCertidaoValor,
  type PedidoCertidaoDetalheDTO,
} from "@/lib/cartorio-virtual/types";

interface CentralAnotacoesProps {
  anotacoesIniciais: AnotacaoTarefaDTO[];
  pedidosDisponiveis: PedidoCertidaoDetalheDTO[];
}

export function CentralAnotacoesClient({
  anotacoesIniciais,
  pedidosDisponiveis,
}: CentralAnotacoesProps) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtroNumeroPedido, setFiltroNumeroPedido] = useState("");
  const [filtroTipoPedido, setFiltroTipoPedido] = useState<FiltroTipoCertidaoValor>("TODOS");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");

  // Novo registro
  const [mostrarNovoForm, setMostrarNovoForm] = useState(false);
  const [tipoRegistro, setTipoRegistro] = useState<
    "ANOTACAO" | "TAREFA" | "DIVERGENCIA" | "ORIENTACAO"
  >("TAREFA");
  const [prioridade, setPrioridade] = useState<"BAIXA" | "NORMAL" | "ALTA" | "URGENTE">("NORMAL");
  const [visibilidade, setVisibilidade] = useState<"EQUIPE_INTERNA" | "REVISORES" | "GESTAO">(
    "EQUIPE_INTERNA"
  );
  const [categoria, setCategoria] = useState("CONFERENCIA");
  const [pedidoId, setPedidoId] = useState("");
  const [numeroMatricula, setNumeroMatricula] = useState("");
  const [titulo, setTitulo] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [atribuidoParaNome, setAtribuidoParaNome] = useState("");
  const [setorDestino, setSetorDestino] = useState("");
  const [prazoIso, setPrazoIso] = useState("");
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  // Edição não-destrutiva (preserva versões anteriores)
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novoConteudoEdicao, setNovoConteudoEdicao] = useState("");
  const [motivoEdicao, setMotivoEdicao] = useState("");
  const [novoStatusEdicao, setNovoStatusEdicao] = useState<
    "ABERTA" | "EM_ANDAMENTO" | "AGUARDANDO_RETORNO" | "RESOLVIDA" | "ARQUIVADA"
  >("EM_ANDAMENTO");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Resposta encadeada
  const [respondendoId, setRespondendoId] = useState<string | null>(null);
  const [textoResposta, setTextoResposta] = useState("");
  const [salvandoResposta, setSalvandoResposta] = useState(false);

  // Gaveta de histórico de versões
  const [versoesAbertasIds, setVersoesAbertasIds] = useState<Record<string, boolean>>({});

  const pedidoPorIdMap = useMemo(() => {
    const m = new Map<string, PedidoCertidaoDetalheDTO>();
    for (const p of pedidosDisponiveis) m.set(p.id, p);
    return m;
  }, [pedidosDisponiveis]);

  const anotacoesFiltradas = useMemo(() => {
    return anotacoesIniciais.filter((item) => {
      if (filtroTipo !== "TODOS" && item.tipoRegistro !== filtroTipo) return false;
      if (filtroStatus !== "TODOS" && item.status !== filtroStatus) return false;
      if (filtroNumeroPedido.trim()) {
        const qNum = filtroNumeroPedido.trim().toLowerCase().replace(/^#/, "");
        if (!(item.numeroPedido || "").toLowerCase().includes(qNum)) return false;
      }
      if (filtroTipoPedido !== "TODOS") {
        const ped = item.pedidoId ? pedidoPorIdMap.get(item.pedidoId) : null;
        if (!ped || !correspondeFiltroTipoCertidao(ped, filtroTipoPedido)) return false;
      }
      if (busca.trim()) {
        const q = busca.trim().toLowerCase();
        const match =
          item.titulo.toLowerCase().includes(q) ||
          item.conteudoAtual.toLowerCase().includes(q) ||
          item.autorNome.toLowerCase().includes(q) ||
          (item.numeroPedido || "").toLowerCase().includes(q) ||
          String(item.numeroMatricula || "").includes(q) ||
          (item.atribuidoParaNome || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [
    anotacoesIniciais,
    filtroTipo,
    filtroStatus,
    filtroNumeroPedido,
    filtroTipoPedido,
    pedidoPorIdMap,
    busca,
  ]);

  const handleCriarNovo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !conteudo.trim()) {
      toast.error("Preencha o título e a descrição da anotação/tarefa.");
      return;
    }
    setSalvandoNovo(true);
    try {
      const matNum = numeroMatricula.replace(/\D/g, "");
      await criarAnotacaoTarefaAction({
        pedidoId: pedidoId || null,
        numeroMatricula: matNum ? Number(matNum) : null,
        tipoRegistro,
        categoria,
        prioridade,
        visibilidade,
        titulo,
        conteudo,
        atribuidoParaNome: atribuidoParaNome || null,
        setorDestino: setorDestino || null,
        prazoIso: prazoIso || null,
      });
      toast.success("Registro criado com versão inicial v1 preservada.");
      setTitulo("");
      setConteudo("");
      setPedidoId("");
      setNumeroMatricula("");
      setAtribuidoParaNome("");
      setSetorDestino("");
      setPrazoIso("");
      setMostrarNovoForm(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao registrar anotação/tarefa.");
    } finally {
      setSalvandoNovo(false);
    }
  };

  const iniciarEdicao = (item: AnotacaoTarefaDTO) => {
    setEditandoId(item.id);
    setNovoConteudoEdicao(item.conteudoAtual);
    setMotivoEdicao("");
    setNovoStatusEdicao(item.status);
  };

  const handleSalvarEdicao = async (anotacaoId: string) => {
    if (!novoConteudoEdicao.trim() || !motivoEdicao.trim()) {
      toast.error("Informe o conteúdo atualizado e o motivo da edição para auditoria.");
      return;
    }
    setSalvandoEdicao(true);
    try {
      await editarAnotacaoTarefaAction({
        anotacaoId,
        novoConteudo: novoConteudoEdicao,
        motivoEdicao,
        novoStatus: novoStatusEdicao,
      });
      toast.success("Edição salva preservando integralmente o histórico de versões anteriores.");
      setEditandoId(null);
      setMotivoEdicao("");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao editar anotação.");
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const handleEnviarResposta = async (pai: AnotacaoTarefaDTO) => {
    if (!textoResposta.trim()) {
      toast.error("Digite o texto da resposta ou acompanhamento.");
      return;
    }
    setSalvandoResposta(true);
    try {
      await criarAnotacaoTarefaAction({
        pedidoId: pai.pedidoId,
        numeroMatricula: pai.numeroMatricula,
        parentId: pai.id,
        tipoRegistro: "ANOTACAO",
        categoria: pai.categoria,
        prioridade: pai.prioridade,
        visibilidade: pai.visibilidade,
        titulo: `Resposta: ${pai.titulo}`,
        conteudo: textoResposta,
      });
      toast.success("Resposta vinculada ao apontamento.");
      setRespondendoId(null);
      setTextoResposta("");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao enviar resposta.");
    } finally {
      setSalvandoResposta(false);
    }
  };

  const badgePrioridade = (p: AnotacaoTarefaDTO["prioridade"]) => {
    if (p === "URGENTE") return "bg-rose-500/15 text-rose-300 border-rose-500/30";
    if (p === "ALTA") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    if (p === "NORMAL") return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
    return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  };

  const badgeStatus = (s: AnotacaoTarefaDTO["status"]) => {
    if (s === "RESOLVIDA") return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    if (s === "AGUARDANDO_RETORNO") return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    if (s === "EM_ANDAMENTO") return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
    return "bg-white/10 text-slate-200 border-white/15";
  };

  return (
    <div className="space-y-6">
      {/* Barra de controles e botão de novo apontamento */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">
              Central Permanente de Anotações do Escrevente e Tarefas
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Retenção por tempo indeterminado: todas as anotações, versões (v1..vN), autores e motivos ficam salvos permanentemente para consulta futura.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMostrarNovoForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs px-4 py-2.5 transition"
          >
            <MessageSquarePlus className="w-4 h-4" />
            {mostrarNovoForm ? "Fechar Formulário" : "Nova Anotação / Tarefa"}
          </button>
        </div>

        {/* Consulta Histórica por Número do Pedido, Tipo de Pedido e Conteúdo */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-white/10">
          <div className="md:col-span-3 relative">
            <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={filtroNumeroPedido}
              onChange={(e) => setFiltroNumeroPedido(e.target.value)}
              placeholder="Nº do Pedido (ex: 9901002)..."
              className="w-full rounded-xl bg-[#0F1629] border border-cyan-500/30 pl-10 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <select
            aria-label="Consulta por Tipo de Pedido"
            value={filtroTipoPedido}
            onChange={(e) => setFiltroTipoPedido(e.target.value)}
            className="md:col-span-3 rounded-xl bg-[#0F1629] border border-cyan-500/30 px-3 py-2 text-xs text-slate-200"
          >
            {OPCOES_FILTRO_TIPO_CERTIDAO.map((op) => (
              <option key={op.valor} value={op.valor}>
                {op.rotulo}
              </option>
            ))}
          </select>
          <div className="md:col-span-2 relative">
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Texto, matrícula ou autor..."
              className="w-full rounded-xl bg-white/[0.04] border border-white/15 px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="md:col-span-2 rounded-xl bg-[#0F1629] border border-white/15 px-3 py-2 text-xs text-slate-200"
          >
            <option value="TODOS">Todos os registros</option>
            <option value="ANOTACAO">Anotações do Escrevente</option>
            <option value="TAREFA">Tarefas operacionais</option>
            <option value="DIVERGENCIA">Divergências apontadas</option>
            <option value="ORIENTACAO">Orientações técnicas</option>
          </select>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="md:col-span-2 rounded-xl bg-[#0F1629] border border-white/15 px-3 py-2 text-xs text-slate-200"
          >
            <option value="TODOS">Todas as situações</option>
            <option value="ABERTA">Aberta</option>
            <option value="EM_ANDAMENTO">Em andamento</option>
            <option value="AGUARDANDO_RETORNO">Aguardando retorno</option>
            <option value="RESOLVIDA">Resolvida</option>
            <option value="ARQUIVADA">Arquivada</option>
          </select>
        </div>
      </div>

      {/* Formulário de criação */}
      {mostrarNovoForm && (
        <form
          onSubmit={handleCriarNovo}
          className="rounded-[24px] border border-cyan-500/30 bg-[#0B1224]/95 p-6 space-y-4"
        >
          <h3 className="text-sm font-bold text-cyan-300">
            Registrar Novo Apontamento ou Tarefa Interna
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Tipo</label>
              <select
                value={tipoRegistro}
                onChange={(e) => setTipoRegistro(e.target.value as any)}
                className="w-full rounded-xl bg-[#0F1629] border border-white/15 px-3 py-2 text-xs text-white"
              >
                <option value="TAREFA">Tarefa</option>
                <option value="ANOTACAO">Anotação</option>
                <option value="DIVERGENCIA">Divergência</option>
                <option value="ORIENTACAO">Orientação</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Prioridade</label>
              <select
                value={prioridade}
                onChange={(e) => setPrioridade(e.target.value as any)}
                className="w-full rounded-xl bg-[#0F1629] border border-white/15 px-3 py-2 text-xs text-white"
              >
                <option value="BAIXA">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Visibilidade</label>
              <select
                value={visibilidade}
                onChange={(e) => setVisibilidade(e.target.value as any)}
                className="w-full rounded-xl bg-[#0F1629] border border-white/15 px-3 py-2 text-xs text-white"
              >
                <option value="EQUIPE_INTERNA">Equipe Interna</option>
                <option value="REVISORES">Revisores Autorizados</option>
                <option value="GESTAO">Gestão / Oficial</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Categoria</label>
              <input
                type="text"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full rounded-xl bg-white/[0.04] border border-white/15 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Vincular a Pedido (opcional)
              </label>
              <select
                value={pedidoId}
                onChange={(e) => setPedidoId(e.target.value)}
                className="w-full rounded-xl bg-[#0F1629] border border-white/15 px-3 py-2 text-xs text-white"
              >
                <option value="">Sem vínculo direto</option>
                {pedidosDisponiveis.map((p) => (
                  <option key={p.id} value={p.id}>
                    Pedido nº {p.numeroPedido} ({p.origem})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Nº Matrícula (opcional)
              </label>
              <input
                type="text"
                value={numeroMatricula}
                onChange={(e) => setNumeroMatricula(e.target.value)}
                placeholder="Ex: 145820"
                className="w-full rounded-xl bg-white/[0.04] border border-white/15 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Atribuir para</label>
              <input
                type="text"
                value={atribuidoParaNome}
                onChange={(e) => setAtribuidoParaNome(e.target.value)}
                placeholder="Colaborador responsável"
                className="w-full rounded-xl bg-white/[0.04] border border-white/15 px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">Setor / Prazo</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={setorDestino}
                  onChange={(e) => setSetorDestino(e.target.value)}
                  placeholder="Ex: Digitalização"
                  className="w-1/2 rounded-xl bg-white/[0.04] border border-white/15 px-2.5 py-2 text-xs text-white"
                />
                <input
                  type="date"
                  value={prazoIso}
                  onChange={(e) => setPrazoIso(e.target.value)}
                  className="w-1/2 rounded-xl bg-white/[0.04] border border-white/15 px-2.5 py-2 text-xs text-white"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título objetivo da anotação ou tarefa..."
              className="w-full rounded-xl bg-white/[0.04] border border-white/15 px-3.5 py-2 text-xs text-white"
            />
            <textarea
              rows={3}
              value={conteudo}
              onChange={(e) => setConteudo(e.target.value)}
              placeholder="Detalhe a conferência, pendência de livro/imagem ou instrução para a equipe..."
              className="w-full rounded-xl bg-white/[0.04] border border-white/15 p-3.5 text-xs text-white"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrarNovoForm(false)}
              className="rounded-xl border border-white/15 px-4 py-2 text-xs text-slate-300 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvandoNovo}
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs px-4 py-2"
            >
              {salvandoNovo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Registrar v1
            </button>
          </div>
        </form>
      )}

      {/* Lista de anotações e tarefas */}
      {anotacoesFiltradas.length === 0 ? (
        <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-200">
            Nenhuma anotação ou tarefa encontrada para os filtros atuais.
          </p>
          <p className="text-xs text-slate-400">
            Em ambiente de produção sem migração ou sem registros cadastrados, o estado vazio real é
            apresentado sem dados sintéticos.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {anotacoesFiltradas.map((item) => {
            const mostrarVersoes = Boolean(versoesAbertasIds[item.id]);
            const estaEditando = editandoId === item.id;
            const estaRespondendo = respondendoId === item.id;

            return (
              <div
                key={item.id}
                className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 space-y-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badgePrioridade(
                          item.prioridade
                        )}`}
                      >
                        {item.tipoRegistro} • {item.prioridade}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${badgeStatus(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono text-cyan-300">
                        v{item.versaoAtual}
                      </span>
                      {item.pedidoId && item.numeroPedido && (
                        <Link
                          href={`/cartorio-virtual/certidoes/${item.pedidoId}`}
                          className="text-xs font-semibold text-cyan-400 hover:underline"
                        >
                          Pedido nº {item.numeroPedido}
                        </Link>
                      )}
                      {item.numeroMatricula && (
                        <span className="text-xs font-mono text-slate-300">
                          Matrícula {item.numeroMatricula}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white">{item.titulo}</h3>
                    <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed">
                      {item.conteudoAtual}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={() => iniciarEdicao(item)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 text-xs text-slate-200"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                      Editar (Nova Versão)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRespondendoId(estaRespondendo ? null : item.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 text-xs text-slate-200"
                    >
                      <Reply className="w-3.5 h-3.5 text-indigo-400" />
                      Responder ({item.respostas.length})
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setVersoesAbertasIds((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }))
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] px-3 py-1.5 text-xs text-slate-200"
                    >
                      <History className="w-3.5 h-3.5 text-amber-400" />
                      Versões ({item.versoes.length})
                    </button>
                  </div>
                </div>

                {/* Metadados de atribuição, setor e prazo */}
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-2 border-t border-white/10">
                  <span>
                    Autor: <strong className="text-slate-200">{item.autorNome}</strong> (
                    {item.autorPapel}) • {item.criadoEmBr}
                  </span>
                  {item.atribuidoParaNome && (
                    <span className="inline-flex items-center gap-1 text-cyan-300">
                      <UserCheck className="w-3.5 h-3.5" />
                      Atribuído: {item.atribuidoParaNome}
                    </span>
                  )}
                  {item.setorDestino && (
                    <span className="inline-flex items-center gap-1 text-indigo-300">
                      <Building2 className="w-3.5 h-3.5" />
                      Setor: {item.setorDestino}
                    </span>
                  )}
                  {item.prazoEmBr && (
                    <span className="inline-flex items-center gap-1 text-amber-300">
                      <Clock className="w-3.5 h-3.5" />
                      Prazo: {item.prazoEmBr}
                    </span>
                  )}
                  {item.concluidaEmBr && (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Concluída por {item.concluidaPorNome} em {item.concluidaEmBr}
                    </span>
                  )}
                </div>

                {/* Painel de Edição Não-Destrutiva */}
                {estaEditando && (
                  <div className="rounded-2xl border border-cyan-500/30 bg-[#0F172A] p-4 space-y-3">
                    <div className="text-xs font-bold text-cyan-300">
                      Atualizar Conteúdo / Status (gera versão v{item.versaoAtual + 1} sem apagar v
                      {item.versaoAtual})
                    </div>
                    <textarea
                      rows={3}
                      value={novoConteudoEdicao}
                      onChange={(e) => setNovoConteudoEdicao(e.target.value)}
                      className="w-full rounded-xl bg-white/[0.04] border border-white/15 p-3 text-xs text-white"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <input
                          type="text"
                          value={motivoEdicao}
                          onChange={(e) => setMotivoEdicao(e.target.value)}
                          placeholder="Motivo obrigatório da edição (ex: Retorno do setor de microfilme)..."
                          className="w-full rounded-xl bg-white/[0.04] border border-white/15 px-3 py-2 text-xs text-white"
                        />
                      </div>
                      <select
                        value={novoStatusEdicao}
                        onChange={(e) => setNovoStatusEdicao(e.target.value as any)}
                        className="rounded-xl bg-[#0B1020] border border-white/15 px-3 py-2 text-xs text-white"
                      >
                        <option value="ABERTA">Aberta</option>
                        <option value="EM_ANDAMENTO">Em andamento</option>
                        <option value="AGUARDANDO_RETORNO">Aguardando retorno</option>
                        <option value="RESOLVIDA">Resolvida</option>
                        <option value="ARQUIVADA">Arquivada</option>
                      </select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditandoId(null)}
                        className="rounded-xl border border-white/15 px-3 py-1.5 text-xs text-slate-300"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={salvandoEdicao}
                        onClick={() => handleSalvarEdicao(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3.5 py-1.5 text-xs"
                      >
                        {salvandoEdicao && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Salvar Nova Versão
                      </button>
                    </div>
                  </div>
                )}

                {/* Caixa de resposta encadeada */}
                {estaRespondendo && (
                  <div className="rounded-2xl border border-indigo-500/30 bg-[#0F172A] p-4 space-y-3">
                    <textarea
                      rows={2}
                      value={textoResposta}
                      onChange={(e) => setTextoResposta(e.target.value)}
                      placeholder="Escreva a resposta ou retorno operacional..."
                      className="w-full rounded-xl bg-white/[0.04] border border-white/15 p-3 text-xs text-white"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRespondendoId(null)}
                        className="rounded-xl border border-white/15 px-3 py-1.5 text-xs text-slate-300"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={salvandoResposta}
                        onClick={() => handleEnviarResposta(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold px-3.5 py-1.5 text-xs"
                      >
                        {salvandoResposta && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Publicar Resposta
                      </button>
                    </div>
                  </div>
                )}

                {/* Fio de respostas */}
                {item.respostas.length > 0 && (
                  <div className="pl-4 border-l-2 border-indigo-500/30 space-y-2.5">
                    {item.respostas.map((resp) => (
                      <div
                        key={resp.id}
                        className="rounded-xl bg-white/[0.03] border border-white/10 p-3 space-y-1"
                      >
                        <div className="text-[11px] text-slate-400">
                          <strong className="text-slate-200">{resp.autorNome}</strong> (
                          {resp.autorPapel}) • {resp.criadoEmBr}
                        </div>
                        <p className="text-xs text-slate-300">{resp.conteudoAtual}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Histórico integral de edições (v1..vN) */}
                {mostrarVersoes && (
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.04] p-4 space-y-2.5">
                    <div className="text-xs font-bold text-amber-300">
                      Histórico Imutável de Versões ({item.versoes.length} registro(s))
                    </div>
                    {item.versoes.map((v) => (
                      <div
                        key={v.id}
                        className="rounded-xl bg-[#070A12]/80 border border-white/10 p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-mono text-amber-300 font-bold">
                            Versão v{v.versao} — {v.editadoPorNome}
                          </span>
                          <span>{v.criadoEmBr}</span>
                        </div>
                        {v.motivoEdicao && (
                          <div className="text-[11px] text-cyan-300">
                            Motivo: {v.motivoEdicao}
                          </div>
                        )}
                        <p className="text-xs text-slate-300 whitespace-pre-line">{v.conteudo}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

