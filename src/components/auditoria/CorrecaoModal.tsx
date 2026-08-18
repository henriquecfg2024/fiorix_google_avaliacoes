"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  protocolo: {
    numero: number;
    cliente: string;
    fase: string;
    falta: string | number;
    dias: string | number;
    setor: string;
  };
  onSuccess?: () => void;
}

export function CorrecaoModal({ open, onOpenChange, protocolo, onSuccess }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/fiorix/corrigir", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          protocolo: protocolo.numero,
          tipo: Number(protocolo.falta),
          setor: protocolo.setor,
          dryRun: false, // Apply actual correction
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`✅ Protocolo ${protocolo.numero} corrigido com sucesso!`, {
          description: `ID ${protocolo.falta} lançado via usuário FIORIX.CORRETOR no banco SQL Server.`,
        });
        onOpenChange(false);
        if (onSuccess) {
          onSuccess();
        } else {
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } else {
        toast.error("Erro ao aplicar correção", {
          description: data.error || "Ocorreu um erro inesperado.",
        });
      }
    } catch (err: any) {
      toast.error("Erro de rede", {
        description: "Não foi possível conectar ao servidor de compliance.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#12141F] border-white/10 text-white max-w-2xl shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-amber-400 text-lg font-bold flex items-center gap-2">
            🛡️ Correção Inteligente FIORIX - Protocolo {protocolo.numero}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {/* Card Antes */}
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl space-y-1.5">
            <h4 className="text-red-400 text-xs font-bold uppercase tracking-wider">ANTES FIORIX</h4>
            <div className="space-y-1 mt-2">
              <p className="text-sm font-bold text-white">
                Inconsistência: Sem Andamento {protocolo.falta}
              </p>
              <p className="text-xs text-white/60">Cliente: {protocolo.cliente}</p>
              <p className="text-xs text-white/60">Fase atual: {protocolo.fase}</p>
              <p className="text-amber-400 text-xs font-semibold mt-3 flex items-center gap-1">
                ⚠️ {protocolo.dias} dias parado • Risco: Atraso Falso
              </p>
            </div>
          </div>

          {/* Card Depois */}
          <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl space-y-1.5">
            <h4 className="text-emerald-400 text-xs font-bold uppercase tracking-wider">DEPOIS FIORIX</h4>
            <div className="space-y-1 mt-2">
              <p className="text-sm font-bold text-white">
                Lançar ID {protocolo.falta} - BALCÃO REGISTRADO
              </p>
              <p className="text-xs text-white/60">
                Data: {new Date().toLocaleString("pt-BR")}
              </p>
              <p className="text-xs text-white/60">Usuário: FIORIX.CORRETOR</p>
              <p className="text-xs text-white/50 italic mt-2">
                Obs: CORREÇÃO FIORIX - Auditoria {new Date().toLocaleDateString("pt-BR")} - Sem andamento {protocolo.falta} há {protocolo.dias} dias
              </p>
              <Badge className="bg-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mt-2 block w-fit text-[9px] font-extrabold">
                ✓ Vai zerar atraso falso
              </Badge>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-white/[0.03] border border-white/5 p-3 rounded-lg text-[10px] text-white/50 leading-relaxed">
          Esta intervenção será registrada de forma idempotente em <code className="text-white/80">fiorix_intervencoes</code>.
          Setor: {protocolo.setor} • Motivo: Sem baixa há {protocolo.dias} dias • Risco: ATRASO_FALSO.
        </div>

        {/* Botões */}
        <div className="flex flex-wrap gap-2 justify-end mt-4">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-white/70 hover:text-white hover:bg-white/5 border border-white/10"
            disabled={isSubmitting}
          >
            Cancelar
          </Button>

          <Button
            variant="secondary"
            onClick={() => window.open(`/api/fiorix/relatorio-pdf?protocolo=${protocolo.numero}`, "_blank")}
            className="bg-white/5 hover:bg-white/10 text-white border border-white/10"
            disabled={isSubmitting}
          >
            📄 Visualizar Relatório
          </Button>

          <Button
            onClick={handleConfirm}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Corrigindo...
              </>
            ) : (
              "✅ Confirmar Correção"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
