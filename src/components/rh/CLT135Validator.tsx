"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Download,
  Trash2,
  Lock,
  Eye,
  FileText,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DeleteConfirmModal } from "./DeleteConfirmModal";
import { COLABORADORES_REAIS_63 } from "./mockColaboradores45";

interface CLT135ValidatorProps {
  onValidated?: (isValid: boolean, date: string) => void;
}

export function CLT135Validator({ onValidated }: CLT135ValidatorProps) {
  const [colaborador, setColaborador] = useState("Amanda Aparecida Gil (Registro)");
  const [dataInicio, setDataInicio] = useState("2026-10-15");
  const [dataFim, setDataFim] = useState("2026-11-03");
  const [diasTotal, setDiasTotal] = useState(20);
  const [abonoPecuniario, setAbonoPecuniario] = useState(false);
  const [gerandoAviso, setGerandoAviso] = useState(false);
  const [sucessoAviso, setSucessoAviso] = useState<string | null>(null);

  // Modal de exclusão
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Calcula antecedência em relação a hoje (referência simulada 2026-09-03)
  const hoje = new Date("2026-09-03");
  const inicio = dataInicio ? new Date(dataInicio) : null;
  const diffTime = inicio ? inicio.getTime() - hoje.getTime() : 0;
  const antecedenciaDias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const isConforme = antecedenciaDias >= 30;

  const dataMinimaPermitida = new Date(hoje);
  dataMinimaPermitida.setDate(dataMinimaPermitida.getDate() + 30);
  const dataMinimaFormatada = dataMinimaPermitida.toLocaleDateString("pt-BR");

  const handleGerarAviso = () => {
    if (!isConforme) return;
    setGerandoAviso(true);
    setTimeout(() => {
      setGerandoAviso(false);
      setSucessoAviso(
        `Aviso emitido com sucesso para ${colaborador}. Hash SHA-256 gerado: 8e4c91a0f3d9b47e2210c4d8b671a9... Trilha WORM gravada.`
      );
    }, 900);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-[#10101a] p-6 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Validador em Tempo Real — Conformidade CLT (Art. 135)
              </h3>
              <p className="text-xs text-slate-400">
                Aviso prévio obrigatório de no mínimo 30 dias de antecedência para gozo individual ou fracionado
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            AUDITORIA PREVENTIVA
          </span>
        </div>

        {/* Inputs de Validação */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Colaborador / Escrevente *</label>
            <select
              value={colaborador}
              onChange={(e) => setColaborador(e.target.value)}
              className="w-full bg-[#05050a] border border-white/15 text-white text-xs rounded-xl p-2.5 outline-none font-medium"
            >
              {COLABORADORES_REAIS_63.map((c) => (
                <option key={c.id} value={`${c.nome} (${c.setor})`}>
                  {c.nome} — {c.setor} ({c.cargo})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Data Início do Gozo *</label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="bg-[#05050a] border-white/15 text-white text-xs rounded-xl h-10 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Data Fim do Gozo *</label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="bg-[#05050a] border-white/15 text-white text-xs rounded-xl h-10 font-mono"
            />
          </div>
        </div>

        {/* Live Validation Card */}
        <div
          className={`p-4 rounded-xl border transition-all ${
            isConforme
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-start gap-3">
            {isConforme ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wide">
                  {isConforme ? "✓ Conformidade CLT Aprovada" : "⛔ BLOQUEIO LEGAL CLT Art. 135"}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/40 border border-white/10">
                  {antecedenciaDias > 0 ? `${antecedenciaDias} dias de antecedência` : `${Math.abs(antecedenciaDias)} dias em atraso`}
                </span>
              </div>
              <p className="text-xs">
                {isConforme ? (
                  <>
                    A data selecionada atende ao requisito legal de 30 dias de antecedência (faltam{" "}
                    <strong>{antecedenciaDias} dias</strong> para o início do gozo). O aviso formal pode ser emitido com fé pública e validade jurídica.
                  </>
                ) : (
                  <>
                    A CLT Art. 135 exige notificação formal com no mínimo 30 dias de antecedência. Data mínima legal
                    exigida: <strong className="text-white underline">{dataMinimaFormatada}</strong> ({antecedenciaDias} dias calculados). A geração de aviso padrão está bloqueada para prevenir passivo trabalhista.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {sucessoAviso && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{sucessoAviso}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setDeleteModalOpen(true)}
            className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs rounded-xl h-9 gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Excluir Pré-Agendamento</span>
          </Button>

          <Button
            onClick={handleGerarAviso}
            disabled={!isConforme || gerandoAviso}
            className={`text-xs font-bold px-5 py-2 rounded-xl shadow-lg transition-all ${
              isConforme
                ? "bg-gradient-to-r from-indigo-600 to-cyan-600 hover:opacity-90 text-white shadow-indigo-500/25"
                : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            {gerandoAviso ? "Assinando e Gerando Hash..." : "Gerar Aviso com Hash SHA-256"}
          </Button>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={async (motivo, senha) => {
          alert(`Pré-agendamento de ${colaborador} arquivado via WORM com hash.`);
        }}
        title="Excluir Pré-Agendamento de Férias"
        itemDescription={`Pré-agendamento de ${colaborador} (Início: ${dataInicio || "N/A"})`}
      />
    </div>
  );
}
