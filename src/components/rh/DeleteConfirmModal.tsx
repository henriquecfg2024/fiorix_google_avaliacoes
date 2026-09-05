"use client";

import React, { useState } from "react";
import { AlertTriangle, Lock, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string, senhaAdmin: string) => Promise<void> | void;
  title: string;
  itemDescription: string;
  wormWarning?: string;
  loading?: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemDescription,
  wormWarning = "Por Diretriz Operacional Interna e LGPD Art. 5 II, a exclusão não apaga a trilha de auditoria; os registros são arquivados com custódia WORM de 5 anos com hash criptográfico imutável.",
  loading = false,
}: DeleteConfirmModalProps) {
  const [motivo, setMotivo] = useState("");
  const [senhaAdmin, setSenhaAdmin] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) {
      setErrorMsg("O preenchimento da justificativa/motivo é obrigatório.");
      return;
    }
    if (!senhaAdmin.trim()) {
      setErrorMsg("A senha de autorização ADMIN é obrigatória.");
      return;
    }
    setErrorMsg("");
    setIsSubmitting(true);
    try {
      await onConfirm(motivo, senhaAdmin);
      setMotivo("");
      setSenhaAdmin("");
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao processar exclusão.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-[#0d0d18] border border-rose-500/30 rounded-2xl flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-rose-500/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
              <p className="text-xs text-rose-300/80 font-mono">CONFIRMAÇÃO DE SOFT-DELETE COM HASH</p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Target Item Detail */}
          <div className="p-3 bg-white/[0.03] border border-white/8 rounded-xl">
            <span className="text-[10px] font-mono uppercase text-slate-400 block mb-1">Registro Selecionado:</span>
            <p className="text-xs font-semibold text-white break-words">{itemDescription}</p>
          </div>

          {/* Legal / WORM Notice */}
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex gap-2.5 items-start">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <p className="text-[11px] leading-relaxed">{wormWarning}</p>
          </div>

          {/* Motivo Textarea */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">
              Motivo / Justificativa da Exclusão <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Documento substituído pela portaria nº 45/2026..."
              rows={3}
              required
              className="w-full bg-[#05050a] border border-white/15 focus:border-rose-500 text-white text-xs rounded-xl p-3 outline-none transition-colors"
            />
          </div>

          {/* Senha Admin Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Senha de Autorização ADMIN <span className="text-rose-400">*</span>
            </label>
            <Input
              type="password"
              value={senhaAdmin}
              onChange={(e) => setSenhaAdmin(e.target.value)}
              placeholder="••••••••"
              required
              className="bg-[#05050a] border-white/15 focus:border-rose-500 text-white text-xs rounded-xl h-10"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
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
              disabled={isSubmitting || loading}
              className="bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-lg shadow-rose-900/40"
            >
              {isSubmitting || loading ? "Gravando Trilha WORM..." : "Excluir e Arquivar com Hash"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
