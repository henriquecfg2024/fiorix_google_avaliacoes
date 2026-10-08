"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Printer,
  FileText,
  Calendar,
  User,
  Building2,
  ArrowRight,
  ExternalLink,
  Shield,
  Lock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VerificaHashClientProps {
  data: {
    valido: boolean;
    comprovanteHash: string;
    comunicadoTitulo?: string;
    comunicadoVersao?: number;
    comunicadoHash?: string;
    colaboradorNome?: string;
    colaboradorEmail?: string;
    dataCiencia?: string;
    ipMascarado?: string;
    scrollPercent?: number;
    tenantNome?: string;
  };
}

export function VerificaHashClient({ data }: VerificaHashClientProps) {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedConteudoHash, setCopiedConteudoHash] = useState(false);

  const copyToClipboard = (text: string, type: "comprovante" | "conteudo") => {
    try {
      navigator.clipboard.writeText(text);
      if (type === "comprovante") {
        setCopiedHash(true);
        setTimeout(() => setCopiedHash(false), 2000);
      } else {
        setCopiedConteudoHash(true);
        setTimeout(() => setCopiedConteudoHash(false), 2000);
      }
    } catch {}
  };

  let dataFormatada = "";
  if (data.dataCiencia) {
    try {
      const d = new Date(data.dataCiencia);
      if (!isNaN(d.getTime())) {
        dataFormatada = format(d, "dd 'de' MMMM 'de' yyyy 'às' HH:mm:ss", { locale: ptBR });
      }
    } catch {
      dataFormatada = data.dataCiencia;
    }
  }

  return (
    <div className="min-h-screen bg-[#070A12] text-white flex flex-col justify-between relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white print:bg-white print:text-black">
      {/* Ambient Glow (Oculto na impressão) */}
      <div className="pointer-events-none absolute inset-0 print:hidden">
        <div className="absolute -top-32 left-1/2 h-80 w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-indigo-500/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Top Header */}
      <header className="relative border-b border-white/10 bg-[#070A12]/80 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10 print:border-b-2 print:border-black print:bg-white print:py-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-black text-white text-base shadow-lg shadow-indigo-500/20 print:border print:border-black print:shadow-none">
            F
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white print:text-black">
              FIORIX — Validador Oficial de Ciência
            </div>
            <div className="text-[11px] text-white/50 print:text-gray-600">
              {data.tenantNome || "7º Oficial de Registro de Imóveis de São Paulo"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-xs text-white/80 hover:text-white transition-all cursor-pointer"
            title="Imprimir relatório de validação"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-sm"
          >
            <span>Acessar Fiorix</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative flex-1 flex items-center justify-center p-4 sm:p-8 z-10">
        <div className="w-full max-w-2xl bg-[#0B1020] border border-white/10 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8 print:border print:border-black print:bg-white print:p-6 print:shadow-none">
          {data.valido ? (
            <>
              {/* Badge de Validação com Sucesso */}
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)] print:border-2 print:border-emerald-600 print:text-emerald-700">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-bold uppercase tracking-wider print:text-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Comprovante Autêntico e Válido</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight print:text-black">
                  Ciência Criptográfica Confirmada
                </h1>
                <p className="text-xs text-white/60 max-w-md print:text-gray-600">
                  Este registro de ciência foi validado com integridade matemática SHA-256 e carimbo de tempo na trilha de auditoria do cartório.
                </p>
              </div>

              {/* Tabela de Detalhes da Prova de Integridade */}
              <div className="rounded-2xl border border-white/10 bg-[#101424] divide-y divide-white/5 text-xs print:border print:border-gray-300 print:bg-white print:divide-gray-200">
                {/* Cartório */}
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-white/50 print:text-gray-600 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400 print:text-black" />
                    <span>Cartório Emissor:</span>
                  </span>
                  <span className="font-semibold text-white print:text-black text-right sm:text-left">
                    {data.tenantNome}
                  </span>
                </div>

                {/* Comunicado */}
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-white/50 print:text-gray-600 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-indigo-400 print:text-black" />
                    <span>Comunicado Oficial:</span>
                  </span>
                  <span className="font-semibold text-white print:text-black text-right sm:text-left">
                    {data.comunicadoTitulo} (v{data.comunicadoVersao})
                  </span>
                </div>

                {/* Colaborador */}
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-white/50 print:text-gray-600 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-indigo-400 print:text-black" />
                    <span>Colaborador / Titular:</span>
                  </span>
                  <span className="font-semibold text-white print:text-black text-right sm:text-left">
                    {data.colaboradorNome}
                  </span>
                </div>

                {/* Data e Hora */}
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-white/50 print:text-gray-600 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400 print:text-black" />
                    <span>Data e Hora do Registro:</span>
                  </span>
                  <span className="font-mono text-emerald-400 print:text-emerald-700 font-semibold text-right sm:text-left">
                    {dataFormatada}
                  </span>
                </div>

                {/* IP Mascarado & Leitura */}
                <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <span className="text-white/50 print:text-gray-600 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-400 print:text-black" />
                    <span>IP do Cliente & Leitura:</span>
                  </span>
                  <span className="font-mono text-white/80 print:text-gray-800 text-right sm:text-left">
                    {data.ipMascarado} · {data.scrollPercent}% leitura completa
                  </span>
                </div>

                {/* Hash do Conteúdo */}
                {data.comunicadoHash && (
                  <div className="p-3.5 sm:p-4 space-y-1.5">
                    <div className="flex items-center justify-between text-white/50 print:text-gray-600">
                      <span>Hash do Conteúdo do Comunicado (SHA-256):</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(data.comunicadoHash!, "conteudo")}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 print:hidden cursor-pointer"
                      >
                        {copiedConteudoHash ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="font-mono text-[11px] break-all bg-black/40 p-2.5 rounded-lg border border-white/5 text-white/70 print:bg-gray-100 print:text-black print:border-gray-300">
                      {data.comunicadoHash}
                    </div>
                  </div>
                )}

                {/* Hash do Comprovante */}
                <div className="p-3.5 sm:p-4 space-y-1.5">
                  <div className="flex items-center justify-between text-white/50 print:text-gray-600">
                    <span className="font-bold text-white print:text-black">
                      Hash Único do Comprovante (SHA-256):
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(data.comprovanteHash, "comprovante")}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 print:hidden cursor-pointer"
                    >
                      {copiedHash ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar Hash</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="font-mono text-xs break-all bg-cyan-950/30 p-2.5 rounded-lg border border-cyan-500/30 text-cyan-300 print:bg-gray-100 print:text-black print:border-gray-300">
                    {data.comprovanteHash}
                  </div>
                </div>
              </div>

              {/* Rodapé Informativo */}
              <div className="text-center text-[11px] text-white/40 leading-relaxed print:text-gray-500">
                <p>
                  Atestado de integridade gerado em conformidade com o Provimento CNJ nº 149/2023 e diretrizes da LGPD (Lei nº 13.709/2018).
                </p>
                <p className="mt-1">
                  7º Oficial de Registro de Imóveis da Capital de São Paulo — Sistema Corporativo FIORIX.
                </p>
              </div>
            </>
          ) : (
            /* Comprovante Não Encontrado */
            <div className="flex flex-col items-center text-center space-y-4 py-6">
              <div className="w-16 h-16 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shadow-[0_0_30px_rgba(244,63,94,0.3)]">
                <AlertTriangle className="w-9 h-9" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Comprovante Não Encontrado
              </h1>
              <p className="text-xs text-white/60 max-w-md">
                O código hash informado não corresponde a nenhum registro de ciência ativo na base de dados de auditoria do cartório.
              </p>
              {data.comprovanteHash && (
                <div className="w-full font-mono text-[11px] break-all bg-black/40 p-3 rounded-lg border border-white/10 text-white/50 text-center">
                  Hash consultado: {data.comprovanteHash}
                </div>
              )}
              <Link
                href="/dashboard"
                className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all"
              >
                <span>Voltar ao Início</span>
              </Link>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative border-t border-white/5 py-4 text-center text-xs text-white/30 print:hidden">
        FIORIX © {new Date().getFullYear()} — Plataforma de Gestão Cartorária & Compliance Imutável.
      </footer>
    </div>
  );
}
