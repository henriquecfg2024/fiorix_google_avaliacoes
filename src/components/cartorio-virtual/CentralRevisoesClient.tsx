"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { decidirRevisaoHumanaAction } from "@/app/actions/cartorio-virtual";
import type { RevisaoHumanaDTO } from "@/lib/cartorio-virtual/repository";
import { PAPEIS_REGISTRAIS_LABELS, type PapelRegistral } from "@/lib/cartorio-virtual/types";

interface CentralRevisoesProps {
  revisoesIniciais: RevisaoHumanaDTO[];
  podeAprovarRevisao: boolean;
  papelSistema: string;
  papelRegistral: PapelRegistral;
}

export function CentralRevisoesClient({
  revisoesIniciais,
  podeAprovarRevisao,
  papelSistema,
  papelRegistral,
}: CentralRevisoesProps) {
  const router = useRouter();
  const [aba, setAba] = useState<"PENDENTES" | "HISTORICO">("PENDENTES");
  const [justificativas, setJustificativas] = useState<Record<string, string>>({});
  const [decidindoId, setDecidindoId] = useState<string | null>(null);

  const listaExibida = revisoesIniciais.filter((r) =>
    aba === "PENDENTES" ? r.statusRevisao === "PENDENTE" : r.statusRevisao !== "PENDENTE"
  );

  const handleDecidir = async (
    rev: RevisaoHumanaDTO,
    decisao: "APROVADA" | "REPROVADA" | "DEVOLVIDA_ATUALIZACAO"
  ) => {
    const just = (justificativas[rev.id] || "").trim();
    if (!just) {
      toast.error("Informe a fundamentação/justificativa da decisão registral.");
      return;
    }
    setDecidindoId(rev.id);
    try {
      await decidirRevisaoHumanaAction({
        revisaoId: rev.id,
        decisao,
        justificativa: just,
        versaoDadosConfirmadaHash: rev.versaoDadosFonteHash,
      });
      toast.success(`Revisão do pedido nº ${rev.numeroPedido} registrada como ${decisao}.`);
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível registrar a decisão.");
    } finally {
      setDecidindoId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Aviso de Governança de Competência Registral (Seção 14) */}
      <div
        className={`rounded-[24px] border p-5 flex items-start gap-3.5 ${
          podeAprovarRevisao
            ? "border-emerald-500/30 bg-emerald-500/[0.06]"
            : "border-amber-500/35 bg-amber-500/[0.07]"
        }`}
      >
        {podeAprovarRevisao ? (
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        )}
        <div className="space-y-1 text-xs">
          <div className="font-bold text-white">
            {podeAprovarRevisao
              ? `Competência Registral Ativa: ${PAPEIS_REGISTRAIS_LABELS[papelRegistral]}`
              : `Modo Somente Consulta Registral (${papelSistema} • ${PAPEIS_REGISTRAIS_LABELS[papelRegistral]})`}
          </div>
          <p className="text-slate-300 leading-relaxed">
            {podeAprovarRevisao
              ? "Sua conta possui autorização formal nesta serventia para aprovar revisões assistidas, devolver para atualização de matrícula ou reprovar encaminhamentos. Caso a matrícula ou o Contraditório mude após a conferência, o hash de versão bloqueará aprovações obsoletas automaticamente."
              : "Conforme a governança da Seção 14, perfil técnico de sistema (incluindo ADMIN/MASTER) ou agente de software não confere fé pública nem competência registral automática. Apenas Oficial, Oficial Substituto ou Escrevente Autorizado formalmente habilitado pode decidir revisões."}
          </p>
        </div>
      </div>

      {/* Seletor de abas */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAba("PENDENTES")}
          className={`rounded-xl px-4 py-2 text-xs font-bold border transition ${
            aba === "PENDENTES"
              ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300"
              : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
          }`}
        >
          Pendentes de Pessoa Autorizada (
          {revisoesIniciais.filter((r) => r.statusRevisao === "PENDENTE").length})
        </button>
        <button
          type="button"
          onClick={() => setAba("HISTORICO")}
          className={`rounded-xl px-4 py-2 text-xs font-bold border transition ${
            aba === "HISTORICO"
              ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300"
              : "bg-white/[0.03] border-white/10 text-slate-400 hover:text-white"
          }`}
        >
          Decididas / Invalidadas (
          {revisoesIniciais.filter((r) => r.statusRevisao !== "PENDENTE").length})
        </button>
      </div>

      {listaExibida.length === 0 ? (
        <div className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-10 text-center space-y-2">
          <p className="text-sm font-semibold text-slate-200">
            Nenhum caso nesta fila de revisão no momento.
          </p>
          <p className="text-xs text-slate-400">
            Pedidos com prenotação em tramitação, pesquisa por endereço, transcrição/loteamento ou
            espécie não confirmada aparecem aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {listaExibida.map((rev) => (
            <div
              key={rev.id}
              className="rounded-[24px] border border-white/15 bg-[#0B1020]/90 p-6 space-y-4"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-sm font-black text-white">
                      Pedido nº {rev.numeroPedido}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                      {rev.origem}
                    </span>
                    <span className="text-xs text-slate-300">{rev.especieSolicitada}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {rev.statusRevisao}
                    </span>
                  </div>
                  <p className="text-xs text-amber-200 font-medium">{rev.motivoRevisao}</p>
                </div>

                <Link
                  href={`/cartorio-virtual/certidoes/${rev.pedidoId}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] px-3.5 py-2 text-xs font-semibold text-cyan-300"
                >
                  Abrir Pedido Completo
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Evidências e limites da aprovação */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Evidências Verificadas
                  </div>
                  <pre className="text-[11px] text-slate-300 whitespace-pre-wrap font-mono overflow-x-auto">
                    {JSON.stringify(rev.evidencias, null, 2)}
                  </pre>
                </div>

                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-4 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Limites da Aprovação & Versão dos Dados-Fonte
                  </div>
                  <p className="text-slate-300">
                    {rev.limitesAprovacao ||
                      "A aprovação restringe-se exclusivamente à versão atual verificada da matrícula e do Contraditório. Não dispara emissão ou assinatura automática no piloto."}
                  </p>
                  <div className="pt-1 font-mono text-[11px] text-cyan-300 break-all">
                    Hash SHA-256: {rev.versaoDadosFonteHash}
                  </div>
                </div>
              </div>

              {rev.statusRevisao === "PENDENTE" ? (
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <textarea
                    rows={2}
                    disabled={!podeAprovarRevisao || decidindoId === rev.id}
                    value={justificativas[rev.id] || ""}
                    onChange={(e) =>
                      setJustificativas((prev) => ({ ...prev, [rev.id]: e.target.value }))
                    }
                    placeholder={
                      podeAprovarRevisao
                        ? "Registre a fundamentação da decisão humana (ex: Conferido Livro 1 - prenotação em tramitação relatada conforme texto padrão homologado)..."
                        : "Decisão bloqueada: requer atribuição formal de Oficial, Oficial Substituto ou Escrevente Autorizado."
                    }
                    className="w-full rounded-xl bg-white/[0.04] border border-white/15 p-3 text-xs text-white disabled:opacity-50"
                  />
                  <div className="flex flex-wrap items-center justify-end gap-2.5">
                    <button
                      type="button"
                      disabled={!podeAprovarRevisao || decidindoId === rev.id}
                      onClick={() => handleDecidir(rev, "DEVOLVIDA_ATUALIZACAO")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-40 px-3.5 py-2 text-xs font-bold text-amber-200"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Devolver p/ Atualização de Matrícula
                    </button>
                    <button
                      type="button"
                      disabled={!podeAprovarRevisao || decidindoId === rev.id}
                      onClick={() => handleDecidir(rev, "REPROVADA")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-40 px-3.5 py-2 text-xs font-bold text-rose-200"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reprovar / Reter c/ Pendência
                    </button>
                    <button
                      type="button"
                      disabled={!podeAprovarRevisao || decidindoId === rev.id}
                      onClick={() => handleDecidir(rev, "APROVADA")}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 px-4 py-2 text-xs font-bold text-slate-950"
                    >
                      {decidindoId === rev.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Aprovar p/ Apto à Emissão Manual
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl bg-white/[0.03] border border-white/10 p-3.5 text-xs space-y-1">
                  <div className="text-slate-300">
                    Decisão: <strong className="text-white">{rev.decisaoHumana}</strong> • Por{" "}
                    <strong className="text-cyan-300">{rev.decididoPorNome}</strong> (
                    {rev.papelRegistralNoAto}) em {rev.decididoEmBr}
                  </div>
                  {rev.justificativa && (
                    <div className="text-slate-400">Fundamentação: {rev.justificativa}</div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

