"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  UserCheck,
  Calendar,
  Eye,
  EyeOff,
  ShieldCheck,
  Pencil,
  History,
  Loader2,
  Hash,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EscalaItem } from "@/lib/ferias/ferias-repository";
import {
  calcularIdadeCompleta,
  formatarDataGestorBr,
} from "@/lib/ferias/idade-calculator";
import { revelarCpfColaboradorFeriasAction } from "@/app/actions/ferias";
import { toast } from "sonner";

interface FichaColaboradorFeriasModalProps {
  open: boolean;
  onClose: () => void;
  colaborador: EscalaItem | null;
  ano: number;
  canRevealCpf: boolean;
  readOnly?: boolean;
  revealedCpfValue?: string | null;
  onCpfRevealed?: (colabId: string, cpfCompleto: string) => void;
  onEditFerias?: (colab: EscalaItem) => void;
  onOpenHistorico?: (colab: EscalaItem) => void;
}

export function FichaColaboradorFeriasModal({
  open,
  onClose,
  colaborador,
  ano,
  canRevealCpf,
  readOnly = false,
  revealedCpfValue,
  onCpfRevealed,
  onEditFerias,
  onOpenHistorico,
}: FichaColaboradorFeriasModalProps) {
  const [showFullCpf, setShowFullCpf] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [localFullCpf, setLocalFullCpf] = useState<string | null>(null);

  useEffect(() => {
    setShowFullCpf(false);
    setLocalFullCpf(revealedCpfValue || null);
  }, [colaborador?.id, open, revealedCpfValue]);

  if (!open || !colaborador) return null;

  const dg = colaborador.dadosGestor;
  const hasGestorSync = Boolean(
    dg &&
      (dg.registro != null ||
        dg.dataNascimento ||
        dg.cpfMascarado ||
        dg.sexo ||
        dg.estadoCivil ||
        dg.naturalidade ||
        dg.nacionalidade)
  );

  const idade = calcularIdadeCompleta(dg?.dataNascimento);
  const dataNascBr = formatarDataGestorBr(dg?.dataNascimento);
  const dataAdmBr = formatarDataGestorBr(dg?.dataAdmissao);
  const naturalidadeCompleta = dg?.naturalidade
    ? dg.uf
      ? `${dg.naturalidade} / ${dg.uf}`
      : dg.naturalidade
    : null;

  const effectiveFullCpf = localFullCpf || revealedCpfValue || null;

  const handleToggleRevealCpf = async () => {
    if (showFullCpf) {
      setShowFullCpf(false);
      return;
    }
    if (effectiveFullCpf) {
      setShowFullCpf(true);
      return;
    }
    setRevealing(true);
    try {
      const res = await revelarCpfColaboradorFeriasAction({
        usuarioId: colaborador.usuarioId,
        registroGestor: dg?.registro ?? null,
        nome: colaborador.nome,
      });
      if (res.success && res.cpf) {
        setLocalFullCpf(res.cpf);
        setShowFullCpf(true);
        onCpfRevealed?.(colaborador.id, res.cpf);
      } else {
        toast.error(res.erro || "CPF ainda não sincronizado do GESTOR.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Sem permissão para revelar CPF completo.");
    } finally {
      setRevealing(false);
    }
  };

  const formatPeriodo = (ini?: string, fim?: string) => {
    if (!ini || !fim) return null;
    const d1 = formatarDataGestorBr(ini) || ini;
    const d2 = formatarDataGestorBr(fim) || fim;
    return `${d1} a ${d2}`;
  };

  const p1Str = formatPeriodo(colaborador.p1Inicio, colaborador.p1Fim);
  const p2Str = formatPeriodo(colaborador.p2Inicio, colaborador.p2Fim);
  const p3Str = formatPeriodo(colaborador.p3Inicio, colaborador.p3Fim);

  const initials = (() => {
    const parts = colaborador.nome.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-[24px] border border-white/15 bg-[#0B1020] shadow-2xl text-white"
      >
        {/* Cabeçalho Padrão Executivo FIORIX */}
        <div className="flex items-start sm:items-center justify-between gap-4 px-6 py-5 border-b border-white/10 bg-[#0B1020]/95 sticky top-0 z-10 backdrop-blur-xl">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-black text-sm flex items-center justify-center shrink-0 shadow-inner">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                  {colaborador.nome}
                </h3>
                {dg?.registro != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                    <Hash className="w-2.5 h-2.5" />
                    Reg. {dg.registro}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                    hasGestorSync
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  }`}
                >
                  {hasGestorSync ? "Sincronizado GESTOR" : "Sync GESTOR Pendente"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {colaborador.setor}
                {colaborador.cargo ? ` • ${colaborador.cargo}` : ""}
                {dg?.apelido ? ` • Conhecido como: ${dg.apelido}` : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors cursor-pointer shrink-0"
            title="Fechar ficha"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* SEÇÃO 1: DADOS PESSOAIS (ESPELHO GESTOR DE COLABORADORES) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Dados Pessoais · Cadastro Oficial (Gestor)
                </h4>
              </div>
              {dataAdmBr && (
                <span className="text-[11px] font-mono text-slate-400">
                  Admissão: <strong className="text-slate-200">{dataAdmBr}</strong>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* 1. Nome Completo */}
              <div className="p-3.5 rounded-2xl border border-white/10 bg-[#080D1A] sm:col-span-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Nome Completo
                </span>
                <span className="text-sm font-bold text-white mt-1 block">
                  {colaborador.nome}
                </span>
              </div>

              {/* 2. CPF (com proteção LGPD e auditoria) */}
              <div className="p-3.5 rounded-2xl border border-white/10 bg-[#080D1A]">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    CPF
                  </span>
                  {canRevealCpf && dg?.temCpfCadastrado && (
                    <button
                      type="button"
                      onClick={handleToggleRevealCpf}
                      disabled={revealing}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 cursor-pointer"
                      title={
                        showFullCpf
                          ? "Ocultar CPF"
                          : "Revelar CPF completo (acesso registrado em auditoria LGPD)"
                      }
                    >
                      {revealing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : showFullCpf ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                      <span>{showFullCpf ? "Ocultar" : "Revelar"}</span>
                    </button>
                  )}
                </div>
                <span className="text-sm font-mono font-bold text-white mt-1 block">
                  {showFullCpf && effectiveFullCpf
                    ? effectiveFullCpf
                    : dg?.cpfMascarado || (
                        <span className="text-xs font-sans font-normal text-slate-500 italic">
                          Aguardando sync GESTOR
                        </span>
                      )}
                </span>
              </div>

              {/* 3. Data de Nascimento */}
              <div className="p-3.5 rounded-2xl border border-white/10 bg-[#080D1A]">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Data de Nascimento
                </span>
                <span className="text-sm font-mono font-bold text-white mt-1 block">
                  {dataNascBr || (
                    <span className="text-xs font-sans font-normal text-slate-500 italic">
                      Aguardando sync GESTOR
                    </span>
                  )}
                </span>
              </div>

              {/* 4. Idade Atual (Exata: anos, meses e dias — padrão Gestor) */}
              <div className="p-3.5 rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] sm:col-span-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300/90 block">
                  Idade Atual (Cálculo em Tempo Real)
                </span>
                <span className="text-sm font-bold text-white mt-1 block">
                  {idade ? (
                    idade.extenso
                  ) : (
                    <span className="text-xs font-normal text-slate-400 italic">
                      Calculada automaticamente após sincronização da data de nascimento
                    </span>
                  )}
                </span>
              </div>

              {/* 5. Sexo */}
              <div className="p-3.5 rounded-2xl border border-white/10 bg-[#080D1A]">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Sexo
                </span>
                <span className="text-sm font-semibold text-slate-200 mt-1 block">
                  {dg?.sexo || (
                    <span className="text-xs font-normal text-slate-500 italic">
                      Aguardando sync GESTOR
                    </span>
                  )}
                </span>
              </div>

              {/* 6. Estado Civil */}
              <div className="p-3.5 rounded-2xl border border-white/10 bg-[#080D1A]">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Estado Civil
                </span>
                <span className="text-sm font-semibold text-slate-200 mt-1 block">
                  {dg?.estadoCivil || (
                    <span className="text-xs font-normal text-slate-500 italic">
                      Aguardando sync GESTOR
                    </span>
                  )}
                </span>
              </div>

              {/* 7. Nacionalidade */}
              <div className="p-3.5 rounded-2xl border border-white/10 bg-[#080D1A]">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Nacionalidade
                </span>
                <span className="text-sm font-semibold text-slate-200 mt-1 block">
                  {dg?.nacionalidade || (
                    <span className="text-xs font-normal text-slate-500 italic">
                      Aguardando sync GESTOR
                    </span>
                  )}
                </span>
              </div>

              {/* 8. Naturalidade / UF */}
              <div className="p-3.5 rounded-2xl border border-white/10 bg-[#080D1A] sm:col-span-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Naturalidade / UF
                </span>
                <span className="text-sm font-semibold text-slate-200 mt-1 block">
                  {naturalidadeCompleta || (
                    <span className="text-xs font-normal text-slate-500 italic">
                      Aguardando sync GESTOR
                    </span>
                  )}
                </span>
              </div>

              {/* 9. Registro & Admissão */}
              <div className="p-3.5 rounded-2xl border border-white/10 bg-[#080D1A]">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block">
                  Registro / Admissão
                </span>
                <span className="text-sm font-mono font-semibold text-slate-200 mt-1 block">
                  {dg?.registro != null ? `#${dg.registro}` : "—"}
                  {dataAdmBr ? ` • ${dataAdmBr}` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* SEÇÃO 2: PROGRAMAÇÃO DE FÉRIAS DO ANO */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Escala Anual de Férias · {ano}
                </h4>
              </div>

              <div className="flex items-center gap-2">
                {onOpenHistorico && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onClose();
                      onOpenHistorico(colaborador);
                    }}
                    className="h-8 px-3 rounded-xl bg-[#080D1A] border-white/15 hover:bg-[#0E1528] text-slate-200 text-xs font-semibold gap-1.5 cursor-pointer"
                  >
                    <History className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Histórico</span>
                  </Button>
                )}
                {!readOnly && onEditFerias && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onEditFerias(colaborador);
                    }}
                    className="h-8 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold gap-1.5 cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>Editar Período</span>
                  </Button>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-white/10 bg-[#080D1A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                {p1Str ? (
                  <>
                    <div className="text-sm font-mono font-bold text-white">
                      1º Período: {p1Str}{" "}
                      <span className="text-cyan-300">({colaborador.p1Dias}d)</span>
                    </div>
                    {p2Str && (
                      <div className="text-xs font-mono text-slate-300">
                        2º Período: {p2Str} ({colaborador.p2Dias}d)
                      </div>
                    )}
                    {p3Str && (
                      <div className="text-xs font-mono text-slate-300">
                        3º Período: {p3Str} ({colaborador.p3Dias}d)
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-slate-400 italic">
                    Nenhum período de férias programado para {ano}.
                  </span>
                )}
                {colaborador.observacao && (
                  <p className="text-xs text-slate-400 pt-1">
                    Obs.: {colaborador.observacao}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase text-slate-400 block">
                    Total Programado
                  </span>
                  <span className="text-base font-black text-white font-mono">
                    {colaborador.totalDias > 0 ? `${colaborador.totalDias} dias` : "0 dias"}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                    colaborador.status === "programado"
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : colaborador.status === "conflito"
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      : "bg-slate-500/15 text-slate-300 border-slate-500/30"
                  }`}
                >
                  {colaborador.status === "programado"
                    ? "Programado"
                    : colaborador.status === "conflito"
                    ? "Conflito"
                    : "Pendente"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé de Governança */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-white/10 bg-[#080D1A]">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Fonte cadastral oficial: <strong className="text-slate-300">GESTOR (SRVSQL)</strong> •
              Somente leitura • Protegido por LGPD & Prov. 213/2026
            </span>
          </div>
          <Button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold cursor-pointer"
          >
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
