"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, AlertTriangle, CheckCircle2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EscalaItem } from "@/lib/ferias/ferias-repository";
import { validarRegrasCLTFerias } from "@/lib/ferias/clt-validator";

interface LancamentoFeriasModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (dados: any) => Promise<void>;
  itemParaEditar?: EscalaItem | null;
  anoSelecionado: number;
  colaboradoresDisponiveis: Array<{ id: string; name: string; email: string }>;
}

export function LancamentoFeriasModal({
  open,
  onClose,
  onSave,
  itemParaEditar,
  anoSelecionado,
  colaboradoresDisponiveis,
}: LancamentoFeriasModalProps) {
  const [usuarioId, setUsuarioId] = useState("");
  const [nome, setNome] = useState("");
  const [setor, setSetor] = useState("Atendimento");
  const [status, setStatus] = useState<"programado" | "conflito" | "pendente">("programado");
  const [observacao, setObservacao] = useState("");

  const [p1Inicio, setP1Inicio] = useState("");
  const [p1Fim, setP1Fim] = useState("");
  const [p1Dias, setP1Dias] = useState(15);

  const [temP2, setTemP2] = useState(false);
  const [p2Inicio, setP2Inicio] = useState("");
  const [p2Fim, setP2Fim] = useState("");
  const [p2Dias, setP2Dias] = useState(0);

  const [temP3, setTemP3] = useState(false);
  const [p3Inicio, setP3Inicio] = useState("");
  const [p3Fim, setP3Fim] = useState("");
  const [p3Dias, setP3Dias] = useState(0);

  const [saving, setSaving] = useState(false);

  // Calcula dias automaticamente a partir das datas
  const calcDias = (ini: string, fim: string) => {
    if (!ini || !fim) return 0;
    const d1 = new Date(ini);
    const d2 = new Date(fim);
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  };

  useEffect(() => {
    if (p1Inicio && p1Fim) setP1Dias(calcDias(p1Inicio, p1Fim));
  }, [p1Inicio, p1Fim]);

  useEffect(() => {
    if (p2Inicio && p2Fim) setP2Dias(calcDias(p2Inicio, p2Fim));
  }, [p2Inicio, p2Fim]);

  useEffect(() => {
    if (p3Inicio && p3Fim) setP3Dias(calcDias(p3Inicio, p3Fim));
  }, [p3Inicio, p3Fim]);

  useEffect(() => {
    if (itemParaEditar) {
      setUsuarioId(itemParaEditar.usuarioId);
      setNome(itemParaEditar.nome);
      setSetor(itemParaEditar.setor || "Atendimento");
      setStatus(itemParaEditar.status);
      setObservacao(itemParaEditar.observacao || "");

      setP1Inicio(itemParaEditar.p1Inicio || "");
      setP1Fim(itemParaEditar.p1Fim || "");
      setP1Dias(itemParaEditar.p1Dias || 15);

      if (itemParaEditar.p2Inicio) {
        setTemP2(true);
        setP2Inicio(itemParaEditar.p2Inicio);
        setP2Fim(itemParaEditar.p2Fim || "");
        setP2Dias(itemParaEditar.p2Dias || 0);
      } else {
        setTemP2(false);
        setP2Inicio("");
        setP2Fim("");
        setP2Dias(0);
      }

      if (itemParaEditar.p3Inicio) {
        setTemP3(true);
        setP3Inicio(itemParaEditar.p3Inicio);
        setP3Fim(itemParaEditar.p3Fim || "");
        setP3Dias(itemParaEditar.p3Dias || 0);
      } else {
        setTemP3(false);
        setP3Inicio("");
        setP3Fim("");
        setP3Dias(0);
      }
    } else {
      setUsuarioId(colaboradoresDisponiveis[0]?.id || "");
      setNome(colaboradoresDisponiveis[0]?.name || "");
      setSetor("Atendimento");
      setStatus("programado");
      setObservacao("");
      setP1Inicio(`${anoSelecionado}-01-10`);
      setP1Fim(`${anoSelecionado}-01-24`);
      setP1Dias(15);
      setTemP2(false);
      setP2Inicio("");
      setP2Fim("");
      setP2Dias(0);
      setTemP3(false);
      setP3Inicio("");
      setP3Fim("");
      setP3Dias(0);
    }
  }, [itemParaEditar, open, anoSelecionado, colaboradoresDisponiveis]);

  if (!open) return null;

  const periodosParaValidar = [
    { inicio: p1Inicio, fim: p1Fim, dias: p1Dias },
    temP2 ? { inicio: p2Inicio, fim: p2Fim, dias: p2Dias } : null,
    temP3 ? { inicio: p3Inicio, fim: p3Fim, dias: p3Dias } : null,
  ].filter(Boolean) as any[];

  const clt = validarRegrasCLTFerias(periodosParaValidar);
  const totalDias = p1Dias + (temP2 ? p2Dias : 0) + (temP3 ? p3Dias : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioId || !nome) {
      alert("Selecione um colaborador.");
      return;
    }
    if (!clt.valido) {
      alert(`Inconsistência legal na programação:\n\n${clt.erros.join("\n")}`);
      return;
    }

    setSaving(true);
    try {
      await onSave({
        usuarioId,
        ano: anoSelecionado,
        nome,
        setor,
        p1Inicio,
        p1Fim,
        p1Dias,
        p2Inicio: temP2 ? p2Inicio : undefined,
        p2Fim: temP2 ? p2Fim : undefined,
        p2Dias: temP2 ? p2Dias : 0,
        p3Inicio: temP3 ? p3Inicio : undefined,
        p3Fim: temP3 ? p3Fim : undefined,
        p3Dias: temP3 ? p3Dias : 0,
        status,
        observacao,
      });
      onClose();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar programação de férias");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/12 bg-[#0c101c] p-6 shadow-2xl text-white space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                {itemParaEditar ? "Editar Período de Férias" : "Adicionar Colaborador à Escala"}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Escala Anual {anoSelecionado} • Validação silenciosa de regras CLT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Colaborador */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Colaborador</label>
            {itemParaEditar ? (
              <Input
                disabled
                value={nome}
                className="bg-white/[0.04] border-white/10 text-white text-xs h-10 rounded-xl"
              />
            ) : (
              <select
                value={usuarioId}
                onChange={(e) => {
                  const selId = e.target.value;
                  setUsuarioId(selId);
                  const found = colaboradoresDisponiveis.find((c) => c.id === selId);
                  if (found) setNome(found.name);
                }}
                className="w-full h-10 px-3 rounded-xl bg-[#070A12] border border-white/12 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                {colaboradoresDisponiveis.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Setor & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Setor</label>
              <select
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-[#070A12] border border-white/12 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="Atendimento">Atendimento / Balcão</option>
                <option value="Registro">Registro de Imóveis</option>
                <option value="Prenotação">Prenotação / Protocolo</option>
                <option value="Certidões">Certidões</option>
                <option value="Financeiro">Financeiro / Contabilidade</option>
                <option value="Recursos Humanos">Recursos Humanos</option>
                <option value="Administração">Administração</option>
                <option value="TI">Tecnologia da Informação</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl bg-[#070A12] border border-white/12 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="programado">Programado</option>
                <option value="conflito">Conflito a revisar</option>
                <option value="pendente">Pendente de definição</option>
              </select>
            </div>
          </div>

          {/* 1º Período */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                1º Período {temP2 ? "(Principal)" : ""}
              </span>
              <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-lg border border-cyan-500/20">
                {p1Dias} dias
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Início</label>
                <Input
                  type="date"
                  value={p1Inicio}
                  onChange={(e) => setP1Inicio(e.target.value)}
                  className="bg-[#070A12] border-white/12 text-xs text-white h-9 rounded-xl"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Fim</label>
                <Input
                  type="date"
                  value={p1Fim}
                  onChange={(e) => setP1Fim(e.target.value)}
                  className="bg-[#070A12] border-white/12 text-xs text-white h-9 rounded-xl"
                  required
                />
              </div>
            </div>
          </div>

          {/* Fracionamento: Período 2 */}
          {!temP2 ? (
            <button
              type="button"
              onClick={() => {
                setTemP2(true);
                setP1Dias(15);
                setP2Dias(15);
                setP2Inicio(`${anoSelecionado}-07-10`);
                setP2Fim(`${anoSelecionado}-07-24`);
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1.5 transition-colors"
            >
              + Adicionar 2º período de fracionamento (CLT Art. 134 §1)
            </button>
          ) : (
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/8 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white uppercase tracking-wider">2º Período</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                    {p2Dias} dias
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setTemP2(false);
                      setTemP3(false);
                      setP2Inicio("");
                      setP2Fim("");
                      setP2Dias(0);
                    }}
                    className="text-[11px] text-rose-400 hover:text-rose-300"
                  >
                    Remover
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Início</label>
                  <Input
                    type="date"
                    value={p2Inicio}
                    onChange={(e) => setP2Inicio(e.target.value)}
                    className="bg-[#070A12] border-white/12 text-xs text-white h-9 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Fim</label>
                  <Input
                    type="date"
                    value={p2Fim}
                    onChange={(e) => setP2Fim(e.target.value)}
                    className="bg-[#070A12] border-white/12 text-xs text-white h-9 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Alertas Contextuais CLT */}
          {!clt.valido && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-rose-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Inconsistência Legal (CLT)</span>
              </div>
              {clt.erros.map((err, idx) => (
                <p key={idx} className="text-[11px] pl-6">{err}</p>
              ))}
            </div>
          )}

          {clt.alertas.length > 0 && clt.valido && (
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Atenção Operacional</span>
              </div>
              {clt.alertas.map((alt, idx) => (
                <p key={idx} className="text-[11px] pl-6">{alt}</p>
              ))}
            </div>
          )}

          {/* Observação interna */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Observação Interna (Opcional)</label>
            <textarea
              rows={2}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Acordo prévio com gestor para cobertura de licença..."
              className="w-full p-2.5 rounded-xl bg-[#070A12] border border-white/12 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-white/8">
            <span className="text-xs font-mono text-slate-400">
              Total: <strong className="text-white">{totalDias}</strong> / 30 dias
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="h-9 px-4 rounded-xl border-white/10 text-slate-300 hover:bg-white/10 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving || !clt.valido}
                className="h-9 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/20"
              >
                {saving ? "Salvando..." : "Salvar Programação"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
