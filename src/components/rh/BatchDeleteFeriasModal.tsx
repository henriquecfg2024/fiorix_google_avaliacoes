"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, ShieldAlert, Trash2, X, Users, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BatchDeleteFeriasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (options: { mode: "selected" | "all"; motivo: string }) => Promise<void> | void;
  ano: number;
  selectedCount: number;
  totalCount: number;
  selectedNames: string[];
  loading?: boolean;
}

export function BatchDeleteFeriasModal({
  isOpen,
  onClose,
  onConfirm,
  ano,
  selectedCount,
  totalCount,
  selectedNames,
  loading = false,
}: BatchDeleteFeriasModalProps) {
  const [mode, setMode] = useState<"selected" | "all">(selectedCount > 0 ? "selected" : "all");
  const [motivo, setMotivo] = useState("");
  const [confirmedCheck, setConfirmedCheck] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (selectedCount > 0) {
      setMode("selected");
    } else {
      setMode("all");
    }
    setConfirmedCheck(false);
    setErrorMsg("");
  }, [selectedCount, isOpen]);

  if (!isOpen) return null;

  const countToDelete = mode === "selected" ? selectedCount : totalCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedCheck) {
      setErrorMsg("Por favor, marque a caixa de confirmação de segurança.");
      return;
    }
    if (mode === "selected" && selectedCount === 0) {
      setErrorMsg("Nenhum colaborador foi selecionado na tabela.");
      return;
    }

    const finalMotivo =
      motivo.trim() ||
      (mode === "all"
        ? `Limpeza e cancelamento de toda a escala anual ${ano} pelo RH`
        : `Exclusão em lote de ${selectedCount} escalas de férias do ano ${ano}`);

    setErrorMsg("");
    setIsSubmitting(true);
    try {
      await onConfirm({ mode, motivo: finalMotivo });
      setMotivo("");
      setConfirmedCheck(false);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao processar exclusão em lote.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-[#0d0d18] border border-rose-500/30 rounded-2xl flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-rose-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Excluir Férias em Lote
              </h3>
              <p className="text-xs text-rose-300/80 font-mono">
                PLANEJAMENTO ANUAL {ano} — TRILHA WORM
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting || loading}
            className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Seletor de Escopo */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              Selecione o escopo da exclusão:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Opção 1: Selecionados */}
              <div
                onClick={() => selectedCount > 0 && setMode("selected")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  selectedCount === 0
                    ? "opacity-50 border-white/5 bg-white/[0.01] cursor-not-allowed"
                    : mode === "selected"
                    ? "border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/10"
                    : "border-white/10 bg-[#12141F] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Colaboradores Marcados</span>
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={mode === "selected"}
                    onChange={() => setMode("selected")}
                    disabled={selectedCount === 0}
                    className="accent-rose-500"
                  />
                </div>
                <div className="mt-2 text-2xl font-black text-rose-400 font-mono">
                  {selectedCount} <span className="text-xs font-normal text-slate-400">selecionados</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Exclui apenas os colaboradores marcados com checkbox na tabela.
                </p>
              </div>

              {/* Opção 2: Toda a escala */}
              <div
                onClick={() => setMode("all")}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  mode === "all"
                    ? "border-rose-500 bg-rose-500/10 shadow-lg shadow-rose-500/10"
                    : "border-white/10 bg-[#12141F] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Limpar Escala Inteira</span>
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={mode === "all"}
                    onChange={() => setMode("all")}
                    className="accent-rose-500"
                  />
                </div>
                <div className="mt-2 text-2xl font-black text-rose-400 font-mono">
                  {totalCount} <span className="text-xs font-normal text-slate-400">do ano {ano}</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Zera todo o planejamento de férias cadastrado para o ano {ano}.
                </p>
              </div>
            </div>
          </div>

          {/* Amostra dos colaboradores afetados */}
          {mode === "selected" && selectedNames.length > 0 && (
            <div className="p-3 bg-white/[0.03] border border-white/10 rounded-xl space-y-2">
              <span className="text-[10px] font-mono uppercase text-slate-400 block">
                Colaboradores que serão excluídos ({selectedNames.length}):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {selectedNames.slice(0, 12).map((nome, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md text-[11px] bg-rose-500/15 border border-rose-500/30 text-rose-200 font-medium"
                  >
                    {nome}
                  </span>
                ))}
                {selectedNames.length > 12 && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] bg-white/5 border border-white/10 text-slate-400">
                    +{selectedNames.length - 12} outros
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Alerta de Conformidade e Trilha WORM */}
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-rose-300 text-xs flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-rose-200">
                Atenção: Registro em Trilha WORM (CLT Art. 134 e Prov. 213/2026)
              </p>
              <p className="text-[11px] text-rose-300/90 leading-relaxed">
                A exclusão em lote cancela os períodos de gozo planejados. Esta ação será gravada no
                registro imutável de auditoria com seu usuário, horário e justificativa.
              </p>
            </div>
          </div>

          {/* Motivo Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Motivo / Justificativa da Exclusão em Lote <span className="text-slate-400 font-normal">(Opcional)</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                mode === "all"
                  ? `Ex: Replanejamento anual das férias de ${ano} em virtude de nova política de escalas da serventia...`
                  : `Ex: Cancelamento em lote das férias para readequação de turnos pelo RH...`
              }
              rows={2}
              className="w-full bg-[#05050a] border border-white/15 focus:border-rose-500 text-white text-xs rounded-xl p-3 outline-none transition-colors"
            />
          </div>

          {/* Checkbox de Confirmação Obrigatório */}
          <div className="pt-2">
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmedCheck}
                onChange={(e) => {
                  setConfirmedCheck(e.target.checked);
                  if (e.target.checked) setErrorMsg("");
                }}
                className="mt-0.5 h-4 w-4 rounded accent-rose-500 cursor-pointer"
              />
              <span className="text-xs text-slate-200 select-none">
                Estou ciente e confirmo a exclusão em lote de{" "}
                <strong className="text-rose-400 font-mono">{countToDelete}</strong> escalas de férias do ano{" "}
                <strong className="text-white font-mono">{ano}</strong> na trilha WORM.
              </span>
            </label>
          </div>

          {/* Mensagem de Erro */}
          {errorMsg && (
            <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold animate-in fade-in">
              {errorMsg}
            </div>
          )}

          {/* Footer / Ações */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting || loading}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || loading || !confirmedCheck || countToDelete === 0}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl gap-2 shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
            >
              {isSubmitting || loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Excluindo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  <span>
                    Excluir {countToDelete} {countToDelete === 1 ? "Registro" : "Registros"} em Lote
                  </span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
