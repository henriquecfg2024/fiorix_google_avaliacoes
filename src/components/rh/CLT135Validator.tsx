"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldAlert, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CLT135ValidatorProps {
  onValidated?: (isValid: boolean, date: string) => void;
}

export function CLT135Validator({ onValidated }: CLT135ValidatorProps) {
  const [dataInicio, setDataInicio] = useState("");
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState<{
    valido: boolean;
    mensagem?: string;
    aviso?: string;
  } | null>(null);

  const handleValidar = async (override = false) => {
    if (!dataInicio) return;
    setValidando(true);
    try {
      const res = await fetch("/api/ferias/validar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataInicio, isOverride: override }),
      });
      const data = await res.json();
      setResultado(data);
      if (onValidated) {
        onValidated(data.valido, dataInicio);
      }
    } catch (err) {
      setResultado({ valido: false, mensagem: "Erro ao comunicar com o validador CLT." });
    } finally {
      setValidando(false);
    }
  };

  return (
    <div className="p-5 bg-[#0d0d16] border border-white/10 rounded-2xl space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-wide">Validador de Conformidade CLT (Art. 135)</h4>
          <p className="text-[11px] text-white/50">Verifica a antecedência mínima legal de 30 dias para aviso formal</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="bg-[#12141F] border-white/10 text-white text-xs"
        />
        <Button
          onClick={() => handleValidar(false)}
          disabled={!dataInicio || validando}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shrink-0"
        >
          {validando ? "Validando..." : "Checar Prazos"}
        </Button>
      </div>

      {resultado && (
        <div
          className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
            resultado.valido
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-red-500/10 border-red-500/30 text-red-300"
          }`}
        >
          <div className="flex items-start gap-2">
            {resultado.valido ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-2 flex-1">
              <p className="font-semibold">{resultado.mensagem || resultado.aviso}</p>
              {!resultado.valido && (
                <div className="pt-2 border-t border-red-500/20 flex items-center justify-between">
                  <span className="text-[11px] text-red-400/80">Necessita autorização administrativa para prosseguir</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleValidar(true)}
                    className="text-[10px] h-7 px-2 font-bold"
                  >
                    Aplicar Override Administrativo
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
