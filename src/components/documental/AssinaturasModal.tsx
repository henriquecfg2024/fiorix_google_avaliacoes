'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ShieldCheck, ShieldAlert, FileSignature, Copy, CheckCircle2, AlertTriangle, FileText, Maximize2, Minimize2, ArrowLeft, X, Printer } from 'lucide-react';

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
  const [mounted, setMounted] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    setMounted(true);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  const copiarNota = () => {
    navigator.clipboard.writeText(analise.texto_nota_devolucao);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const isValida = analise.status_validade === 'VALIDA_ICP_OU_HOMOLOGADA';
  const isSemCripto = analise.status_validade === 'SEM_CRIPTOGRAFIA_IMAGENS_OU_IMPRESSO';
  // Assinatura qualificada/homologada não gera exigência: a minuta só existe para os casos não conformes
  const exibirNota = !isValida && !!analise.texto_nota_devolucao;

  const imprimirRelatorio = () => {
    const dataHora = new Date().toLocaleString('pt-BR');
    const statusTexto = isValida
      ? 'CONFORME — Assinatura Eletrônica Qualificada / Homologada Detectada'
      : isSemCripto
      ? 'NÃO CONFORME — Arquivo sem Assinatura Digital'
      : 'NÃO CONFORME — Assinatura Inválida ou Não Homologada';

    const statusCor = isValida ? '#065f46' : '#991b1b';
    const signatariosHtml = analise.signatarios_detectados && analise.signatarios_detectados.length > 0
      ? analise.signatarios_detectados.map(s => `<li>• ${s}</li>`).join('')
      : '<li>Nenhum certificado digital embutido detectado no arquivo.</li>';

    const minutaHtml = exibirNota
      ? `<div style="margin-top:16px;border:1px solid #cbd5e1;border-radius:6px;padding:12px;background:#f8fafc;">
          <h3 style="margin:0 0 8px 0;font-size:12px;text-transform:uppercase;color:#334155;letter-spacing:0.5px;">Minuta Registral Sugerida para Nota de Devolução (CNJ / ITI)</h3>
          <pre style="margin:0;font-family:monospace;font-size:11px;line-height:1.5;white-space:pre-wrap;color:#0f172a;">${analise.texto_nota_devolucao.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
        </div>`
      : '';

    const htmlImpressao = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Auditoria PAdES — ${nomeArquivo}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 12px; line-height: 1.45; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
    .cartorio { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #0f172a; }
    .subtitulo { font-size: 11px; color: #475569; margin-top: 2px; }
    .titulo { font-size: 16px; font-weight: bold; margin: 12px 0 4px 0; color: #0f172a; }
    .meta-box { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; font-size: 11px; }
    .status-box { border-left: 4px solid ${statusCor}; background: #fafafa; border: 1px solid #e2e8f0; border-left-width: 4px; border-left-color: ${statusCor}; border-radius: 6px; padding: 12px; margin-bottom: 14px; }
    .status-titulo { font-size: 13px; font-weight: bold; color: ${statusCor}; margin: 0 0 4px 0; }
    .status-padrao { font-size: 11px; color: #334155; margin: 0; }
    .secao { margin-top: 14px; }
    .secao-titulo { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; }
    ul { margin: 0; padding-left: 14px; font-size: 11px; color: #1e293b; list-style: none; }
    li { margin-bottom: 4px; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="cartorio">7º Oficial de Registro de Imóveis de São Paulo</div>
    <div class="subtitulo">FIORIX — Sistema de Gestão da Qualidade e Qualificação Registral</div>
  </div>

  <div class="titulo">Relatório de Auditoria de Assinaturas Eletrônicas e Criptografia (PAdES)</div>

  <div class="meta-box">
    <strong>Arquivo auditado:</strong> ${nomeArquivo}<br />
    <strong>Emissão do laudo:</strong> ${dataHora}<br />
    <strong>Motor de conformidade:</strong> CLI PAdES / Lei Federal nº 14.063/2020 e Provimento CNJ nº 149/2023
  </div>

  <div class="status-box">
    <div class="status-titulo">${statusTexto}</div>
    <div class="status-padrao">${analise.padrao_detectado || 'Padrão criptográfico auditado pelo motor documental.'}</div>
  </div>

  <div class="secao">
    <div class="secao-titulo">Signatários / Certificados Detectados</div>
    <ul>${signatariosHtml}</ul>
  </div>

  ${minutaHtml}

  <div class="footer">
    <span>Documento gerado para instrução do procedimento de qualificação registral.</span>
    <span>Página 1 de 1</span>
  </div>

  <script>
    window.addEventListener('load', () => {
      window.print();
    });
  </script>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlImpressao);
      printWin.document.close();
    } else {
      window.print();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2 sm:p-4 md:p-6 backdrop-blur-md overflow-y-auto">
      <div className={`relative my-auto flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden transition-all duration-200 ${
        isMaximized
          ? 'fixed inset-2 sm:inset-3 w-[calc(100vw-1rem)] sm:w-[calc(100vw-1.5rem)] h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] max-w-none max-h-none z-[110]'
          : 'max-h-[92vh] w-full max-w-3xl xl:max-w-4xl 2xl:max-w-5xl'
      }`}>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-950 px-4 sm:px-6 py-3.5 sm:py-4 gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border shrink-0 ${
                isValida
                  ? 'bg-emerald-950 text-emerald-400 border-emerald-800/60'
                  : 'bg-rose-950 text-rose-400 border-rose-800/60'
              }`}
            >
              {isValida ? <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" /> : <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs sm:text-sm text-slate-400 truncate max-w-sm">
                  {nomeArquivo}
                </span>
              </div>
              <h3 className="text-base sm:text-lg xl:text-xl font-semibold text-slate-100">
                Auditoria de Assinaturas Eletrônicas e Criptografia (PAdES)
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Restaurar tamanho' : 'Maximizar tela'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              {isMaximized ? (
                <>
                  <Minimize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Restaurar</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Maximizar</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              title="Voltar para a tela anterior"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition shadow-sm active:scale-95 shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-cyan-400" />
              <span>Voltar</span>
            </button>

            <button
              onClick={onClose}
              className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
              title="Fechar (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5">
          {/* Status Banner */}
          <div
            className={`rounded-xl border p-4 sm:p-5 ${
              isValida
                ? 'border-emerald-800/60 bg-emerald-950/40 text-emerald-200'
                : 'border-rose-800/60 bg-rose-950/40 text-rose-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {isValida ? (
                <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-rose-400 mt-0.5 shrink-0" />
              )}
              <div>
                <h4 className="text-sm sm:text-base font-semibold">
                  {isValida
                    ? 'Assinatura Eletrônica Qualificada / Homologada Detectada'
                    : isSemCripto
                    ? 'Arquivo sem Assinatura Digital'
                    : 'Assinatura Inválida ou Não Homologada'}
                </h4>
                <p className="mt-1 text-xs sm:text-sm opacity-90">
                  {analise.padrao_detectado || 'Padrão criptográfico auditado pelo motor documental.'}
                </p>
                {isValida && (
                  <p className="mt-2 text-[11px] sm:text-xs text-emerald-300/80">
                    Sem nota de exigência para este item. Triagem automática: para confirmação oficial, valide o PDF em validar.iti.gov.br.
                  </p>
                )}
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
          {exibirNota && (
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

        {/* Footer com Botão Voltar */}
        <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-4 sm:px-6 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-4 py-2 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition shadow active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 text-cyan-400" />
            <span>Voltar para tela anterior</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={imprimirRelatorio}
              title="Imprimir relatório de auditoria (A4)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition shadow"
            >
              <Printer className="h-4 w-4 text-cyan-400" />
              <span>Imprimir</span>
            </button>
            {exibirNota && (
              <button
                type="button"
                onClick={copiarNota}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
              >
                <Copy className="h-4 w-4" />
                <span>Copiar Nota de Exigência</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
