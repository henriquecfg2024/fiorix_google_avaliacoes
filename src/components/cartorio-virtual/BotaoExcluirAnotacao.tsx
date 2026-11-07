"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { excluirAnotacaoTarefaAction } from "@/app/actions/cartorio-virtual";

export function BotaoExcluirAnotacao({ anotacaoId }: { anotacaoId: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const handleExcluir = async () => {
    setExcluindo(true);
    try {
      await excluirAnotacaoTarefaAction({ anotacaoId });
      toast.success("Anotação excluída do Pedido e removida da Ficha de Impressão.");
      setConfirmando(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao excluir anotação.");
    } finally {
      setExcluindo(false);
    }
  };

  if (confirmando) {
    return (
      <div className="inline-flex items-center gap-1.5 text-[11px]">
        <button
          type="button"
          disabled={excluindo}
          onClick={handleExcluir}
          className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
        >
          {excluindo && <Loader2 className="w-3 h-3 animate-spin" />}
          Confirmar
        </button>
        <button
          type="button"
          disabled={excluindo}
          onClick={() => setConfirmando(false)}
          className="px-2 py-0.5 rounded border border-white/15 text-slate-300 hover:bg-white/5 cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      className="inline-flex items-center gap-1 text-[11px] text-rose-400 hover:text-rose-300 hover:underline cursor-pointer"
      title="Excluir esta anotação do Escrevente"
    >
      <Trash2 className="w-3 h-3" />
      Excluir
    </button>
  );
}

