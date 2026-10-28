'use client';

import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, FileSignature, Copy, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';

export interface DetalheAssinaturaPdf {
  signatario: string;
  emissor: string;
  data_assinatura: string;
  subfilter: string;
  integridade: string;
  numero_serie?: string;
  cpf_cnpj?: string;
  email?: string;
}

export interface AnaliseAssinaturaPdf {
  possui_assinatura_criptografica: boolean;
  status_validade:
    | 'VALIDA_ICP_OU_HOMOLOGADA'
    | 'INVALIDA_NAO_HOMOLOGADA'
    | 'SEM_CRIPTOGRAFIA_IMAGENS_OU_IMPRESSO'
    | 'ESPELHO_INFORMATIVO_ONR'
    | 'DOCUMENTO_FISCAL_INFORMATIVO'
    | 'DOCUMENTO_ENOTARIADO_CONFERENCIA'
    | string;
  padrao_detectado: string;
  signatarios_detectados: string[];
  possui_indicio_visual_sem_criptografia: boolean;
  titulo_exigencia: string;
  texto_nota_devolucao: string;
  detalhes_assinaturas?: DetalheAssinaturaPdf[];
}

export function AssinaturasModal({
  nomeArquivo,
  analise,
  onClose,
}: {
  nomeArquivo: string;
  analise: AnaliseAssinaturaPdf;
  onClose: () => void;
}) {
  const [copiado, setCopiado] = useState(false);

  const copiarNota = () => {
    navigator.clipboard.writeText(analise.texto_nota_devolucao);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const isValida = analise.status_validade === 'VALIDA_ICP_OU_HOMOLOGADA';
  const isSemCripto = analise.status_validade === 'SEM_CRIPTOGRAFIA_IMAGENS_OU_IMPRESSO';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative my-8 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                isValida
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                  : 'bg-rose-950 text-rose-400 border-rose-800/60'
              }`}
            >
              {isValida ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-400 truncate max-w-sm">
                  {nomeArquivo}
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                Auditoria de Assinaturas Eletrônicas e Criptografia (PAdES)
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Status Banner */}
          <div
            className={`rounded-xl border p-4 ${
              isValida
                ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-200'
                : 'border-rose-800/60 bg-rose-950/40 text-rose-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {isValida ? (
                <ShieldCheck className="h-5 w-5 text-emerald-400 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-rose-400 mt-0.5" />
              )}
              <div>
                <h4 className="text-sm font-semibold">
                  {isValida
                    ? 'Assinatura Eletrônica Qualificada / Homologada Detectada'
                    : isSemCripto
                    ? 'Arquivo Sem Estrutura Criptográfica Ativa (Impresso em PDF)'
                    : 'Assinatura Inválida ou Não Homologada'}
                </h4>
                <p className="mt-1 text-xs opacity-90">
                  {analise.padrao_detectado || 'Padrão criptográfico auditado pelo motor documental.'}
                </p>
              </div>
            </div>
          </div>

          {/* Signatários */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Signatários / Certificados Detectados
            </h5>
            {analise.signatarios_detectados && analise.signatarios_detectados.length > 0 ? (
              <ul className="space-y-1.5 text-xs text-slate-300">
                {analise.signatarios_detectados.map((sig, idx) => (
                  <li key={idx} className="flex items-center gap-2">
                    <FileSignature className="h-4 w-4 text-cyan-400" />
                    <span>{sig}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">Nenhum signatário detectado no arquivo.</p>
            )}
          </div>

          {/* Nota de Devolução Registral Sugerida */}
          {analise.texto_nota_devolucao && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex items-center justify-between mb-2">
                <h5 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="h-4 w-4" />
                  Minuta Registral Sugerida para Nota de Devolução (CNJ / ITI)
                </h5>

                <button
                  type="button"
                  onClick={copiarNota}
                  className="inline-flex items-center gap-1.5 rounded bg-slate-800 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700 transition"
                >
                  {copiado ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copiar Nota
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-lg bg-slate-900 border border-slate-800 p-3 text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto">
                {analise.texto_nota_devolucao}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
