"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  RefreshCw,
  Scale,
  Printer,
  MessageSquarePlus,
  Loader2,
} from "lucide-react";
import {
  concluirAtualizacaoMatriculaAction,
  criarAnotacaoTarefaAction,
  registrarComparacaoPilotoAction,
} from "@/app/actions/cartorio-virtual";
import type { PedidoCertidaoDetalheDTO } from "@/lib/cartorio-virtual/types";

export function PedidoDetalheInterativo({
  pedido,
  podeSolicitarAtualizacao,
}: {
  pedido: PedidoCertidaoDetalheDTO;
  podeSolicitarAtualizacao: boolean;
}) {
  const router = useRouter();
  const [evidencia, setEvidencia] = useState("");
  const [procedimentoEquipe, setProcedimentoEquipe] = useState(
    pedido.procedimentoRealEquipe || "APTO_EMISSAO"
  );
  const [notaTitulo, setNotaTitulo] = useState("");
  const [notaConteudo, setNotaConteudo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const handleConcluirAtualizacao = async () => {
    setBusy("atualizacao");
    try {
      await concluirAtualizacaoMatriculaAction({
        pedidoId: pedido.id,
        evidenciaConclusao: evidencia,
      });
      toast.success(
        "Atualização registrada e nova conferência executada automaticamente (Regras 6.3 / 6.4)."
      );
      setEvidencia("");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao concluir atualização.");
    } finally {
      setBusy(null);
    }
  };

  const handleSalvarComparacao = async () => {
    setBusy("comparacao");
    try {
      await registrarComparacaoPilotoAction({
        pedidoId: pedido.id,
        procedimentoRealEquipe: procedimentoEquipe,
      });
      toast.success("Procedimento real da equipe registrado no Modo de Comparação.");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar comparação.");
    } finally {
      setBusy(null);
    }
  };

  const handleNovaAnotacao = async () => {
    setBusy("nota");
    try {
      await criarAnotacaoTarefaAction({
        pedidoId: pedido.id,
        numeroMatricula: pedido.itens[0]?.numeroMatricula ?? null,
        tipoRegistro: "ANOTACAO",
        categoria: "CONFERENCIA",
        prioridade: "NORMAL",
        titulo: notaTitulo,
        conteudo: notaConteudo,
      });
      toast.success("Apontamento vinculado ao pedido com sucesso.");
      setNotaTitulo("");
      setNotaConteudo("");
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar apontamento.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      {/* Ação 1: Tratamento de Atualização da Matrícula (Regras 6.3 e 6.4) */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-rose-400" />
            Atualização & Reconferência
          </h3>
          <a
            href={`/api/cartorio-virtual/pedidos/${pedido.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold"
          >
            <Printer className="w-3.5 h-3.5" />
            Espelho PDF
          </a>
        </div>
        <p className="text-xs text-slate-400">
          Concluído o ato registral e digitalizada a ficha no Livro 2, registre a evidência para disparar nova conferência obrigatória.
        </p>
        <textarea
          rows={3}
          value={evidencia}
          onChange={(e) => setEvidencia(e.target.value)}
          placeholder="Ex: Av.12 lançada na matrícula e PDF atualizado no Livro 2."
          className="w-full rounded-xl bg-[#080D1A] border border-white/15 p-3 text-xs text-white"
        />
        <button
          type="button"
          disabled={busy === "atualizacao" || !podeSolicitarAtualizacao}
          onClick={handleConcluirAtualizacao}
          title={
            !podeSolicitarAtualizacao
              ? "Requer atribuição registral com capacidade de atualização"
              : undefined
          }
          className="w-full h-9 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-45 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          {busy === "atualizacao" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          Concluir Atualização + Reconferir
        </button>
      </div>

      {/* Ação 2: Modo de Comparação do Piloto (Shadow Mode — Seção 17) */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 space-y-3">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Scale className="w-4 h-4 text-emerald-400" />
          Modo de Comparação (FIORIX × Equipe)
        </h3>
        <div className="text-xs text-slate-300 space-y-1">
          <div>
            Proposto pelo FIORIX:{" "}
            <span className="font-mono font-bold text-cyan-300">
              {pedido.resultadoPropostoFiorix || "—"}
            </span>
          </div>
          {pedido.divergenciaClassificacao && (
            <div className="text-[11px] text-amber-300">{pedido.divergenciaClassificacao}</div>
          )}
        </div>
        <select
          value={procedimentoEquipe}
          onChange={(e) => setProcedimentoEquipe(e.target.value)}
          className="w-full h-9 px-3 rounded-xl bg-[#080D1A] border border-white/15 text-xs text-white"
        >
          <option value="APTO_EMISSAO">Equipe liberou emissão simples (Apto)</option>
          <option value="APTO_COM_CERTIFICACAO_PRENOTACAO">
            Equipe emitiu certificando prenotação em tramitação
          </option>
          <option value="PAUSAR_POR_ATO_EM_PROCESSAMENTO">
            Equipe pausou por ato registral em processamento
          </option>
          <option value="AGUARDAR_ATUALIZACAO_MATRICULA">
            Equipe encaminhou para atualização/digitalização
          </option>
          <option value="ENCAMINHAR_REVISAO_HUMANA">
            Equipe realizou pesquisa manual / revisão assistida
          </option>
        </select>
        <button
          type="button"
          disabled={busy === "comparacao"}
          onClick={handleSalvarComparacao}
          className="w-full h-9 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          {busy === "comparacao" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Scale className="w-3.5 h-3.5" />
          )}
          Registrar Procedimento da Equipe
        </button>
      </div>

      {/* Ação 3: Novo Apontamento Rápido no Pedido */}
      <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-5 space-y-2.5">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <MessageSquarePlus className="w-4 h-4 text-cyan-400" />
          Registrar Anotação neste Pedido
        </h3>
        <input
          type="text"
          value={notaTitulo}
          onChange={(e) => setNotaTitulo(e.target.value)}
          placeholder="Assunto do apontamento..."
          className="w-full h-9 px-3 rounded-xl bg-[#080D1A] border border-white/15 text-xs text-white"
        />
        <textarea
          rows={2}
          value={notaConteudo}
          onChange={(e) => setNotaConteudo(e.target.value)}
          placeholder="Observação técnica de conferência..."
          className="w-full rounded-xl bg-[#080D1A] border border-white/15 p-2.5 text-xs text-white"
        />
        <button
          type="button"
          disabled={busy === "nota"}
          onClick={handleNovaAnotacao}
          className="w-full h-9 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          Salvar Apontamento
        </button>
      </div>
    </div>
  );
}

