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
import { Loader2, AlertTriangle } from "lucide-react";

interface ProtocoloItem {
  id: string;
  cliente: string;
  fase: string;
  falta: number | string;
  dias: number | string;
  setor: string;
  responsavel: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  protocolos: ProtocoloItem[];
  onSuccess: (ids: string[]) => void;
}

export function CorrecaoLoteModal({ open, onOpenChange, protocolos, onSuccess }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      // Simulate bulk correction requests in parallel
      const promises = cleanProtocolos.map((p) =>
        fetch("/api/fiorix/corrigir", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            protocolo: Number(p.id),
            tipo: Number(p.falta),
            setor: p.setor,
            dryRun: false,
          }),
        }).then((res) => res.json())
      );

      const results = await Promise.all(promises);
      const errors = results.filter((r) => !r.success);

      if (errors.length === 0) {
        toast.success(`✅ ${cleanProtocolos.length} protocolos corrigidos com sucesso!`, {
          description: "Andamentos registrados no banco de dados e normalizados.",
        });
        onOpenChange(false);
        onSuccess(cleanProtocolos.map((p) => p.id));
      } else {
        toast.error(`Erro ao corrigir lote`, {
          description: `Falha em ${errors.length} de ${cleanProtocolos.length} protocolos.`,
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

  const cleanProtocolos = protocols.filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#12141F] border-white/10 text-white max-w-3xl shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-amber-400 text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
            Confirmação de Correção em Lote — {cleanProtocolos.length} Protocolos
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-xs text-white/60 leading-relaxed">
            Você está prestes a aplicar correções automatizadas em lote via usuário <code className="text-white/80 font-semibold">FIORIX.CORRETOR</code>. Isso irá lançar o andamento de baixa de balcão correspondente para cada um dos itens abaixo:
          </p>

          {/* Table list */}
          <div className="border border-white/5 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-white/[0.02] border-b border-white/5 text-white/50 font-bold">
                  <th className="p-3">Protocolo</th>
                  <th className="p-3">Cliente</th>
                  <th className="p-3">Inconformidade</th>
                  <th className="p-3">Parado</th>
                  <th className="p-3">Destino</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cleanProtocolos.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.01]">
                    <td className="p-3 font-bold text-white">#{p.id}</td>
                    <td className="p-3 text-white/70 max-w-[150px] truncate">{p.cliente}</td>
                    <td className="p-3">
                      <Badge className="bg-red-500/15 text-red-400 border border-red-500/20 text-[9px] font-black">
                        SEM ID {p.falta}
                      </Badge>
                    </td>
                    <td className="p-3 text-amber-400 font-semibold">{p.dias} dias</td>
                    <td className="p-3">
                      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 text-[9px] font-black">
                        Lançar ID {p.falta}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white/[0.03] border border-white/5 p-3 rounded-lg text-[10px] text-white/50 leading-relaxed">
            ⚠️ <strong>Atenção:</strong> Esta ação alterará registros reais no banco de dados e registrará logs individuais na tabela de intervenções de conformidade.
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-wrap gap-2 justify-end mt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-white/70 hover:text-white hover:bg-white/5 border border-white/10"
            disabled={isSubmitting}
          >
            Cancelar
          </Button>

          <Button
            onClick={handleConfirm}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold flex items-center gap-1.5 shadow-lg shadow-amber-500/10"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Corrigindo Lote...
              </>
            ) : (
              `Corrigir ${cleanProtocolos.length} Protocolos`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
