'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  ShieldCheck,
  ShieldAlert,
  FileSignature,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Maximize2,
  Minimize2,
  ArrowLeft,
  X,
  Printer,
  ExternalLink,
  RefreshCw,
  Building2,
  Clock,
  Info,
  FileWarning,
  ClipboardCheck,
  Check,
  Lock,
} from 'lucide-react';
import {
  normalizeSignatureAuditResult,
  applyExternalConferenceToAudit,
  AVISO_JURIDICO_ASSINATURA,
  type AnaliseAssinaturaPdf,
  type DetalheAssinaturaPdf,
  type CertificadoAuditado,
  type ConferenciaExternaAssinatura,
  type StatusAuditoriaAssinatura,
} from '@/lib/documental/signatureAuditClient';

export type {
  AnaliseAssinaturaPdf,
  DetalheAssinaturaPdf,
  CertificadoAuditado,
  ConferenciaExternaAssinatura,
  StatusAuditoriaAssinatura,
};

const LOCAL_CONF_PREFIX = 'fiorix_sig_conf_sha256_';

function loadLocalConferenceByHash(hashSha256: string | null | undefined): ConferenciaExternaAssinatura | null {
  if (!hashSha256 || typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_CONF_PREFIX + hashSha256.toLowerCase());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.hash_sha256 === 'string' &&
      parsed.hash_sha256.toLowerCase() === hashSha256.toLowerCase()
    ) {
      return parsed as ConferenciaExternaAssinatura;
    }
  } catch {
    // Ignora falha de leitura no storage local
  }
  return null;
}

function saveLocalConferenceByHash(conf: ConferenciaExternaAssinatura) {
  if (!conf.hash_sha256 || typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_CONF_PREFIX + conf.hash_sha256.toLowerCase(), JSON.stringify(conf));
  } catch {
    // Ignora quota
  }
}

function obterConfiguracaoVisualStatus(
  status: StatusAuditoriaAssinatura,
  indicioVisual: boolean,
): {
  titulo: string;
  subtituloBadge: string;
  corBanner: string;
  corIconeBox: string;
  corTextoTitulo: string;
  corBadge: string;
  corImpressao: string;
  icone: 'valida' | 'pendente' | 'invalida' | 'falha';
} {
  switch (status) {
    case 'ASSINATURA_VALIDA':
      return {
        titulo: 'Assinatura válida',
        subtituloBadge: 'Verificação Técnica Comprovada',
        corBanner: 'border-emerald-700/70 bg-emerald-950/35 text-emerald-100',
        corIconeBox: 'bg-emerald-950 text-emerald-400 border-emerald-700/60',
        corTextoTitulo: 'text-emerald-300',
        corBadge: 'border-emerald-600/50 bg-emerald-900/50 text-emerald-200',
        corImpressao: '#065f46',
        icone: 'valida',
      };
    case 'ASSINATURA_DETECTADA_VALIDACAO_PENDENTE':
      return {
        titulo: 'Assinatura detectada — validação pendente',
        subtituloBadge: 'Pendente de Confirmação Externa (ITI)',
        corBanner: 'border-amber-700/70 bg-amber-950/30 text-amber-100',
        corIconeBox: 'bg-amber-950 text-amber-400 border-amber-700/60',
        corTextoTitulo: 'text-amber-300',
        corBadge: 'border-amber-600/50 bg-amber-900/50 text-amber-200',
        corImpressao: '#b45309',
        icone: 'pendente',
      };
    case 'VALIDACAO_INCONCLUSIVA':
      return {
        titulo: 'Validação inconclusiva',
        subtituloBadge: 'Análise Criptográfica Inconclusiva',
        corBanner: 'border-amber-700/70 bg-slate-900/90 text-amber-100',
        corIconeBox: 'bg-slate-800 text-amber-400 border-amber-700/50',
        corTextoTitulo: 'text-amber-300',
        corBadge: 'border-amber-600/50 bg-amber-950/60 text-amber-200',
        corImpressao: '#92400e',
        icone: 'pendente',
      };
    case 'ASSINATURA_INVALIDA':
      return {
        titulo: 'Assinatura inválida',
        subtituloBadge: 'Evidência Técnica de Invalidade',
        corBanner: 'border-rose-700/70 bg-rose-950/35 text-rose-100',
        corIconeBox: 'bg-rose-950 text-rose-400 border-rose-700/60',
        corTextoTitulo: 'text-rose-300',
        corBadge: 'border-rose-600/50 bg-rose-900/50 text-rose-200',
        corImpressao: '#991b1b',
        icone: 'invalida',
      };
    case 'FALHA_ANALISE_ARQUIVO':
      return {
        titulo: 'Falha na análise do arquivo',
        subtituloBadge: 'Arquivo Não Pôde Ser Analisado',
        corBanner: 'border-rose-800/70 bg-slate-950 text-rose-200',
        corIconeBox: 'bg-rose-950/80 text-rose-400 border-rose-800/60',
        corTextoTitulo: 'text-rose-300',
        corBadge: 'border-rose-700/50 bg-rose-950/70 text-rose-200',
        corImpressao: '#991b1b',
        icone: 'falha',
      };
    case 'NENHUMA_ASSINATURA_DETECTADA':
    default:
      return {
        titulo: 'Nenhuma assinatura digital detectada',
        subtituloBadge: indicioVisual
          ? 'Apenas Indício Visual / Sem Criptografia'
          : 'Documento Sem Assinatura Criptográfica',
        corBanner: indicioVisual
          ? 'border-amber-700/60 bg-slate-900/90 text-amber-100'
          : 'border-slate-700 bg-slate-900/90 text-slate-200',
        corIconeBox: indicioVisual
          ? 'bg-amber-950/60 text-amber-400 border-amber-700/50'
          : 'bg-slate-800 text-slate-300 border-slate-700',
        corTextoTitulo: indicioVisual ? 'text-amber-300' : 'text-slate-100',
        corBadge: indicioVisual
          ? 'border-amber-600/50 bg-amber-950/50 text-amber-200'
          : 'border-slate-600 bg-slate-800 text-slate-300',
        corImpressao: '#334155',
        icone: 'pendente',
      };
  }
}

export function AssinaturasModal({
  nomeArquivo,
  analise,
  rootId,
  relativePath,
  reauditando = false,
  onReauditar,
  onAtualizarAnalise,
  onClose,
}: {
  nomeArquivo: string;
  analise: AnaliseAssinaturaPdf;
  rootId?: string;
  relativePath?: string;
  reauditando?: boolean;
  onReauditar?: () => void | Promise<void>;
  onAtualizarAnalise?: (novaAnalise: AnaliseAssinaturaPdf) => void;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [hashCopiado, setHashCopiado] = useState(false);
  const [reauditandoInterno, setReauditandoInterno] = useState(false);

  // Estado da conferência externa vinculada ao hash SHA-256
  const [conferenciaLocal, setConferenciaLocal] = useState<ConferenciaExternaAssinatura | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [formResultado, setFormResultado] = useState<'VALIDA' | 'INVALIDA' | 'INCONCLUSIVA'>('VALIDA');
  const [formResponsavel, setFormResponsavel] = useState('');
  const [formDataHora, setFormDataHora] = useState('');
  const [formRelatorio, setFormRelatorio] = useState('');
  const [salvandoConferencia, setSalvandoConferencia] = useState(false);
  const [erroConferencia, setErroConferencia] = useState('');
  const [sucessoConferencia, setSucessoConferencia] = useState('');

  const audit = useMemo(() => {
    const base = normalizeSignatureAuditResult(analise);
    const confEfetiva = conferenciaLocal ?? base.conferencia_externa ?? loadLocalConferenceByHash(base.hash_sha256);
    if (confEfetiva) {
      return applyExternalConferenceToAudit(base, confEfetiva, base.conferencia_externa_invalidada_por_alteracao);
    }
    return base;
  }, [analise, conferenciaLocal]);

  useEffect(() => {
    setMounted(true);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  // Sincroniza conferência externa quando o arquivo ou seu hash SHA-256 muda
  useEffect(() => {
    setConferenciaLocal(null);
    setErroConferencia('');
    setSucessoConferencia('');
    const agoraStr = new Date().toLocaleString('pt-BR');
    setFormDataHora(agoraStr);

    const hash = audit.hash_sha256;
    if (!hash && !relativePath) return;

    const params = new URLSearchParams();
    if (hash) params.set('hashSha256', hash);
    if (rootId) params.set('rootId', rootId);
    if (relativePath) params.set('relativePath', relativePath);

    fetch(`/api/gestao-documental/assinaturas-conferencia?${params.toString()}`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) return;
        const body = await res.json();
        if (body.usuarioAtualNome && !formResponsavel) {
          setFormResponsavel(body.usuarioAtualNome);
        }
        if (body.conferencia) {
          setConferenciaLocal(body.conferencia);
        }
      })
      .catch(() => {
        // Fallback silencioso para conferência local
      });
  }, [audit.hash_sha256, rootId, relativePath]);

  const visual = obterConfiguracaoVisualStatus(
    audit.status_auditoria,
    audit.possui_indicio_visual_sem_criptografia,
  );

  const copiarHash = () => {
    if (!audit.hash_sha256) return;
    navigator.clipboard.writeText(audit.hash_sha256);
    setHashCopiado(true);
    setTimeout(() => setHashCopiado(false), 2500);
  };

  const executarReauditoria = async () => {
    setErroConferencia('');
    setSucessoConferencia('');
    if (onReauditar) {
      await onReauditar();
      return;
    }
    if (!rootId || !relativePath) return;
    setReauditandoInterno(true);
    try {
      const res = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'analyze_signatures',
          rootId,
          relativePath,
          forceFresh: true,
        }),
      });
      const body = await res.json();
      if (res.ok && body.status === 'complete' && body.result) {
        onAtualizarAnalise?.(body.result);
      }
    } catch {
      // Erro tratado pelo componente pai
    } finally {
      setReauditandoInterno(false);
    }
  };

  const salvarConferenciaExterna = async (e: React.FormEvent) => {
    e.preventDefault();
    setErroConferencia('');
    setSucessoConferencia('');

    if (!audit.hash_sha256) {
      setErroConferencia(
        'Não é possível vincular a conferência externa sem o hash SHA-256 do arquivo. Clique em "Reauditar assinaturas" primeiro.',
      );
      return;
    }
    if (!formRelatorio.trim() || formRelatorio.trim().length < 3) {
      setErroConferencia(
        'Informe o resumo do relatório, código ou observação da verificação realizada no ITI.',
      );
      return;
    }

    setSalvandoConferencia(true);
    try {
      const payload = {
        rootId: rootId || 'local',
        relativePath: relativePath || nomeArquivo,
        nomeArquivo,
        hashSha256: audit.hash_sha256,
        resultado: formResultado,
        responsavelNome: formResponsavel.trim() || 'Colaborador Autenticado',
        dataConferencia: formDataHora.trim() || new Date().toLocaleString('pt-BR'),
        orgaoVerificador: 'ITI — Verificador de Conformidade (validar.iti.gov.br)',
        relatorioConformidade: formRelatorio.trim(),
      };

      let confSalva: ConferenciaExternaAssinatura | null = null;
      try {
        const res = await fetch('/api/gestao-documental/assinaturas-conferencia', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const body = await res.json();
        if (res.ok && body.conferencia) {
          confSalva = body.conferencia;
        }
      } catch {
        // Continua com armazenamento local vinculado ao SHA-256 caso offline
      }

      if (!confSalva) {
        confSalva = {
          id: `local-${Date.now()}`,
          hash_sha256: audit.hash_sha256.toLowerCase(),
          resultado: formResultado,
          responsavel_nome: payload.responsavelNome,
          data_conferencia: payload.dataConferencia,
          orgao_verificador: payload.orgaoVerificador,
          relatorio_conformidade: payload.relatorioConformidade,
          origem_registro: 'MANUAL_EXTERNO',
          hash_compativel_com_arquivo_atual: true,
        };
      }

      saveLocalConferenceByHash(confSalva);
      setConferenciaLocal(confSalva);
      const novaAnalise = applyExternalConferenceToAudit(audit, confSalva, false);
      onAtualizarAnalise?.(novaAnalise);
      setFormAberto(false);
      setSucessoConferencia(
        'Conferência externa registrada e vinculada ao hash SHA-256 deste arquivo.',
      );
    } catch (err: any) {
      setErroConferencia(err?.message || 'Não foi possível salvar a conferência externa.');
    } finally {
      setSalvandoConferencia(false);
    }
  };

  const imprimirRelatorio = () => {
    const dataHora = new Date().toLocaleString('pt-BR');
    const signatariosHtml =
      audit.certificados_signatarios.length > 0
        ? audit.certificados_signatarios
            .map(
              (c) =>
                `<li>• <strong>${c.nome_exibicao}</strong> ${c.documento_mascarado ? `(Doc.: ${c.documento_mascarado})` : ''} — Emissor: ${c.emissor_ac} — Série: ${c.numero_serie}</li>`,
            )
            .join('')
        : '<li>Nenhum certificado de signatário (end-entity) identificado no arquivo.</li>';

    const acsHtml =
      audit.autoridades_certificadoras.length > 0
        ? audit.autoridades_certificadoras
            .map((ac) => `<li>• ${ac.nome_exibicao} (${ac.organizacao})</li>`)
            .join('')
        : '<li>Nenhuma autoridade certificadora identificada na cadeia.</li>';

    const confHtml = audit.conferencia_externa
      ? `<div style="margin-top:14px;border:1px solid #cbd5e1;border-radius:6px;padding:10px 12px;background:#f8fafc;font-size:11px;">
          <strong>Conferência Externa Registrada Manualmente (${audit.conferencia_externa.orgao_verificador}):</strong><br/>
          Resultado: <strong>${audit.conferencia_externa.resultado}</strong> | Responsável: ${audit.conferencia_externa.responsavel_nome} | Data: ${audit.conferencia_externa.data_conferencia}<br/>
          Hash SHA-256 vinculado: <code>${audit.conferencia_externa.hash_sha256}</code><br/>
          Relatório/Observações: ${audit.conferencia_externa.relatorio_conformidade.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </div>`
      : '';

    const htmlImpressao = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Auditoria Técnica de Assinaturas — ${nomeArquivo}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 0; font-size: 12px; line-height: 1.45; }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
    .cartorio { font-size: 14px; font-weight: bold; text-transform: uppercase; color: #0f172a; }
    .subtitulo { font-size: 11px; color: #475569; margin-top: 2px; }
    .titulo { font-size: 15px; font-weight: bold; margin: 12px 0 6px 0; color: #0f172a; }
    .meta-box { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; margin-bottom: 14px; font-size: 11px; }
    .status-box { border: 1px solid #e2e8f0; border-left: 4px solid ${visual.corImpressao}; background: #fafafa; border-radius: 6px; padding: 12px; margin-bottom: 14px; }
    .status-titulo { font-size: 13px; font-weight: bold; color: ${visual.corImpressao}; margin: 0 0 4px 0; }
    .status-padrao { font-size: 11px; color: #334155; margin: 0 0 6px 0; }
    .secao { margin-top: 14px; }
    .secao-titulo { font-size: 11px; font-weight: bold; text-transform: uppercase; color: #475569; letter-spacing: 0.5px; margin-bottom: 6px; }
    ul { margin: 0; padding-left: 14px; font-size: 11px; color: #1e293b; list-style: none; }
    li { margin-bottom: 4px; }
    .aviso { margin-top: 16px; border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; padding: 10px; font-size: 10.5px; color: #334155; }
    .footer { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #64748b; display: flex; justify-content: space-between; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="cartorio">7º Oficial de Registro de Imóveis de São Paulo</div>
    <div class="subtitulo">FIORIX — Auditoria Técnica de Assinaturas Digitais e Estrutura Criptográfica (PAdES/CMS)</div>
  </div>

  <div class="titulo">Relatório Técnico de Verificação de Assinaturas Digitais</div>

  <div class="meta-box">
    <strong>Arquivo analisado:</strong> ${nomeArquivo}<br />
    <strong>Hash SHA-256 do arquivo:</strong> <code>${audit.hash_sha256 || 'Não calculado'}</code><br />
    <strong>Data/hora da emissão:</strong> ${dataHora}<br />
    <strong>Origem do resultado:</strong> ${
      audit.origem_resultado === 'CONFERENCIA_EXTERNA_MANUAL'
        ? 'Conferência externa registrada manualmente'
        : 'Inspeção técnica automática local'
    }
  </div>

  <div class="status-box">
    <div class="status-titulo">${visual.titulo}</div>
    <div class="status-padrao"><strong>Padrão / Estrutura:</strong> ${audit.padrao_detectado}</div>
    <div class="status-padrao"><strong>Síntese técnica:</strong> ${audit.motivo_status}</div>
    <div class="status-padrao"><strong>Origem e alcance:</strong> ${audit.origem_validacao} — ${audit.alcance_validacao}</div>
  </div>

  <div class="secao">
    <div class="secao-titulo">Signatários Identificados (Certificados de Assinante)</div>
    <ul>${signatariosHtml}</ul>
  </div>

  <div class="secao">
    <div class="secao-titulo">Autoridades Certificadoras (Cadeia / Emissores — Não são signatários)</div>
    <ul>${acsHtml}</ul>
  </div>

  ${confHtml}

  <div class="aviso">
    <strong>Nota Técnica e Jurídica:</strong> ${AVISO_JURIDICO_ASSINATURA}
  </div>

  <div class="footer">
    <span>Relatório técnico de auditoria documental FIORIX.</span>
    <span>Página 1 de 1</span>
  </div>

  <script>
    window.addEventListener('load', () => {
      window.print();
    });
  </script>
</body>
</html>`;

    const printWin = window.open('', '_blank', 'width=840,height=900');
    if (printWin) {
      printWin.document.open();
      printWin.document.write(htmlImpressao);
      printWin.document.close();
    } else {
      window.print();
    }
  };

  if (!mounted) return null;

  const emReauditoria = reauditando || reauditandoInterno;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2 sm:p-4 md:p-6 backdrop-blur-md overflow-y-auto">
      <div
        className={`relative my-auto flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden transition-all duration-200 ${
          isMaximized
            ? 'fixed inset-2 sm:inset-3 w-[calc(100vw-1rem)] sm:w-[calc(100vw-1.5rem)] h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] max-w-none max-h-none z-[110]'
            : 'max-h-[92vh] w-full max-w-4xl xl:max-w-5xl'
        }`}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-950 px-4 sm:px-6 py-3.5 sm:py-4 gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border shrink-0 ${visual.corIconeBox}`}
            >
              {visual.icone === 'valida' ? (
                <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : visual.icone === 'pendente' ? (
                <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : visual.icone === 'falha' ? (
                <FileWarning className="h-5 w-5 sm:h-6 sm:w-6" />
              ) : (
                <ShieldAlert className="h-5 w-5 sm:h-6 sm:w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs sm:text-sm text-slate-300 break-all sm:truncate sm:max-w-md">
                  {nomeArquivo}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                    audit.origem_resultado === 'CONFERENCIA_EXTERNA_MANUAL'
                      ? 'border-cyan-600/50 bg-cyan-950/60 text-cyan-200'
                      : 'border-slate-700 bg-slate-800/90 text-slate-300'
                  }`}
                >
                  {audit.origem_resultado === 'CONFERENCIA_EXTERNA_MANUAL'
                    ? 'Resultado registrado manualmente (Conferência Externa)'
                    : 'Verificação técnica automática local'}
                </span>
              </div>
              <h3 className="text-sm sm:text-lg font-semibold text-slate-100 leading-snug mt-0.5">
                Auditoria de Assinaturas Eletrônicas e Criptografia (PAdES)
              </h3>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(onReauditar || (rootId && relativePath)) && (
              <button
                type="button"
                onClick={executarReauditoria}
                disabled={emReauditoria}
                title="Executar novamente as verificações criptográficas sobre os bytes atuais do arquivo"
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-700/60 bg-cyan-950/50 hover:bg-cyan-900/60 disabled:opacity-50 px-3 py-1.5 text-xs sm:text-sm font-medium text-cyan-200 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${emReauditoria ? 'animate-spin' : ''}`} />
                <span>{emReauditoria ? 'Reauditando...' : 'Reauditar assinaturas'}</span>
              </button>
            )}

            <button
              type="button"
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
              type="button"
              onClick={onClose}
              title="Voltar para a tela anterior"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition shadow-sm active:scale-95 shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-cyan-400" />
              <span>Voltar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
              title="Fechar (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Alerta se o arquivo foi modificado invalidando conferência anterior */}
          {audit.conferencia_externa_invalidada_por_alteracao && (
            <div className="rounded-xl border border-amber-600/70 bg-amber-950/40 p-3.5 text-xs text-amber-200 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-amber-100">
                  Alteração de arquivo detectada (Hash SHA-256 divergente):
                </strong>{' '}
                Os bytes deste arquivo foram modificados desde a última conferência externa registrada. A auditoria e eventual conferência anterior foram invalidadas automaticamente.
              </div>
            </div>
          )}

          {/* Status Principal */}
          <div className={`rounded-xl border p-4 sm:p-5 ${visual.corBanner}`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                {visual.icone === 'valida' ? (
                  <ShieldCheck className="h-6 w-6 text-emerald-400 mt-0.5 shrink-0" />
                ) : visual.icone === 'pendente' ? (
                  <AlertTriangle className="h-6 w-6 text-amber-400 mt-0.5 shrink-0" />
                ) : (
                  <ShieldAlert className="h-6 w-6 text-rose-400 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className={`text-base sm:text-lg font-bold ${visual.corTextoTitulo}`}>
                      {visual.titulo}
                    </h4>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${visual.corBadge}`}
                    >
                      {visual.subtituloBadge}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm font-medium text-slate-200">
                    {audit.padrao_detectado}
                  </p>

                  <p className="text-xs text-slate-300 leading-relaxed">{audit.motivo_status}</p>

                  <div className="mt-2.5 pt-2.5 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-300">
                    <div>
                      <span className="font-semibold text-slate-200">Origem da verificação: </span>
                      <span>{audit.origem_validacao}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-200">Alcance técnico: </span>
                      <span>{audit.alcance_validacao}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Aviso de separação entre verificação técnica e decisão jurídica/documental */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/90 px-4 py-3 text-xs text-slate-300 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-200">Escopo da verificação técnica:</strong>{' '}
              {audit.aviso_juridico || AVISO_JURIDICO_ASSINATURA}
            </div>
          </div>

          {/* Barra de Validação Oficial no ITI + Hash SHA-256 do Arquivo */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="space-y-1">
                <h5 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-cyan-400" />
                  Validação Oficial Externa (ITI / ICP-Brasil) e Identificação Criptográfica do Arquivo
                </h5>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Para validar a cadeia completa ICP-Brasil, listas de revogação (LCR/OCSP) e conformidade normativa, abra o portal oficial do ITI e{' '}
                  <strong className="text-slate-200">
                    envie manualmente o arquivo PDF original
                  </strong>
                  . O FIORIX não envia documentos automaticamente a serviços externos.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  href="https://validar.iti.gov.br/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-600/70 bg-cyan-950/70 hover:bg-cyan-900 px-3.5 py-2 text-xs font-semibold text-cyan-100 transition shadow-sm"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-cyan-300" />
                  <span>Validar no ITI</span>
                </a>

                <button
                  type="button"
                  onClick={() => setFormAberto((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition"
                >
                  <ClipboardCheck className="h-3.5 w-3.5 text-amber-400" />
                  <span>
                    {audit.conferencia_externa
                      ? 'Atualizar Conferência Externa'
                      : 'Registrar Conferência Externa'}
                  </span>
                </button>
              </div>
            </div>

            {/* Hash SHA-256 do arquivo efetivamente auditado */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="font-semibold text-slate-400">Hash SHA-256 do arquivo:</span>
                {audit.hash_sha256 ? (
                  <code className="font-mono text-[11px] text-cyan-300 break-all">
                    {audit.hash_sha256}
                  </code>
                ) : (
                  <span className="text-slate-500 italic">
                    Não disponível (clique em &ldquo;Reauditar assinaturas&rdquo; para calcular sobre os bytes atuais)
                  </span>
                )}
                {typeof audit.tamanho_bytes === 'number' && audit.tamanho_bytes > 0 && (
                  <span className="text-[11px] text-slate-500">
                    ({(audit.tamanho_bytes / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>

              {audit.hash_sha256 && (
                <button
                  type="button"
                  onClick={copiarHash}
                  className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-700 transition shrink-0"
                >
                  {hashCopiado ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copiar SHA-256</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {sucessoConferencia && (
              <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{sucessoConferencia}</span>
              </div>
            )}

            {/* Exibição da Conferência Externa vinculada ao SHA-256 */}
            {audit.conferencia_externa && (
              <div className="rounded-lg border border-cyan-800/60 bg-cyan-950/25 p-3.5 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4 text-cyan-400" />
                    <span className="font-semibold text-cyan-200">
                      Conferência Externa Registrada ({audit.conferencia_externa.orgao_verificador})
                    </span>
                  </div>
                  <span className="rounded border border-cyan-700/60 bg-cyan-900/40 px-2 py-0.5 text-[11px] font-medium text-cyan-200">
                    {audit.conferencia_externa.origem_registro === 'INTEGRACAO_VERIFICAVEL'
                      ? 'Resultado obtido por integração verificável'
                      : 'Resultado registrado manualmente'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-300 pt-1">
                  <div>
                    <span className="text-slate-400">Resultado: </span>
                    <strong
                      className={
                        audit.conferencia_externa.resultado === 'VALIDA'
                          ? 'text-emerald-300'
                          : audit.conferencia_externa.resultado === 'INVALIDA'
                            ? 'text-rose-300'
                            : 'text-amber-300'
                      }
                    >
                      {audit.conferencia_externa.resultado === 'VALIDA'
                        ? 'Assinatura Válida'
                        : audit.conferencia_externa.resultado === 'INVALIDA'
                          ? 'Assinatura Inválida'
                          : 'Validação Inconclusiva'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Responsável: </span>
                    <strong className="text-slate-200">
                      {audit.conferencia_externa.responsavel_nome}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400">Data/Hora: </span>
                    <strong className="text-slate-200">
                      {audit.conferencia_externa.data_conferencia}
                    </strong>
                  </div>
                </div>

                <div className="text-slate-300 pt-1">
                  <span className="text-slate-400">Relatório / Observações: </span>
                  <span className="whitespace-pre-wrap">
                    {audit.conferencia_externa.relatorio_conformidade}
                  </span>
                </div>
              </div>
            )}

            {/* Formulário de Registro Manual de Conferência Externa */}
            {formAberto && (
              <form
                onSubmit={salvarConferenciaExterna}
                className="rounded-xl border border-slate-700 bg-slate-900/95 p-4 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <h6 className="font-semibold text-slate-200 uppercase tracking-wider">
                    Registrar Conferência Externa (Vinculada ao Hash SHA-256)
                  </h6>
                  <span className="text-[11px] text-slate-400">
                    Origem: Registro Manual pelo Usuário
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Resultado no Verificador Oficial
                    </label>
                    <select
                      value={formResultado}
                      onChange={(e) =>
                        setFormResultado(
                          e.target.value as 'VALIDA' | 'INVALIDA' | 'INCONCLUSIVA',
                        )
                      }
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100"
                    >
                      <option value="VALIDA">Assinatura Válida (Aprovada no ITI)</option>
                      <option value="INVALIDA">Assinatura Inválida (Reprovada no ITI)</option>
                      <option value="INCONCLUSIVA">Validação Inconclusiva</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Responsável pela Conferência
                    </label>
                    <input
                      type="text"
                      value={formResponsavel}
                      onChange={(e) => setFormResponsavel(e.target.value)}
                      placeholder="Nome do responsável"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Data e Hora da Conferência
                    </label>
                    <input
                      type="text"
                      value={formDataHora}
                      onChange={(e) => setFormDataHora(e.target.value)}
                      placeholder="DD/MM/AAAA HH:mm"
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Relatório de Conformidade / Código / Observações do ITI
                  </label>
                  <textarea
                    rows={3}
                    value={formRelatorio}
                    onChange={(e) => setFormRelatorio(e.target.value)}
                    placeholder="Informe o resumo do resultado emitido pelo Verificador do ITI (validar.iti.gov.br), número de série ou observações técnicas..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 p-2.5 text-xs text-slate-100"
                  />
                </div>

                {erroConferencia && (
                  <p className="text-xs text-rose-400 font-medium">{erroConferencia}</p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFormAberto(false)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoConferencia}
                    className="rounded-lg border border-cyan-600 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 px-3.5 py-1.5 text-xs font-semibold text-white"
                  >
                    {salvandoConferencia ? 'Salvando...' : 'Salvar Conferência Vinculada ao SHA-256'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* 1. Signatários Identificados (Certificados de Assinante / End-Entity) */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h5 className="text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <FileSignature className="h-4 w-4 text-cyan-400" />
                  Signatários Identificados (Certificados de Assinante)
                </h5>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Titulares dos certificados finais (end-entity) vinculados às assinaturas do documento. Autoridades Certificadoras são listadas separadamente abaixo.
                </p>
              </div>
              <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-0.5 text-[11px] text-slate-300">
                {audit.certificados_signatarios.length} signatário(s)
              </span>
            </div>

            {audit.certificados_signatarios.length > 0 ? (
              <div className="space-y-2.5">
                {audit.certificados_signatarios.map((cert, idx) => {
                  const det = audit.detalhes_assinaturas.find(
                    (d) =>
                      d.signatario === cert.nome_exibicao ||
                      (cert.numero_serie &&
                        d.numero_serie === cert.numero_serie),
                  ) || audit.detalhes_assinaturas[idx];

                  return (
                    <div
                      key={`${cert.numero_serie}-${idx}`}
                      className="rounded-lg border border-slate-800 bg-slate-900/80 p-3.5 space-y-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <FileSignature className="h-4 w-4 text-cyan-400 shrink-0" />
                          <span className="font-semibold text-slate-100 text-sm">
                            {cert.nome_exibicao}
                          </span>
                          {cert.documento_mascarado && (
                            <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                              Doc.: {cert.documento_mascarado}
                            </span>
                          )}
                        </div>

                        {det?.status_tecnico && (
                          <span
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                              det.status_tecnico === 'VALIDA_CRIPTOGRAFICAMENTE'
                                ? 'border-emerald-700/60 bg-emerald-950/60 text-emerald-300'
                                : det.status_tecnico === 'INVALIDA'
                                  ? 'border-rose-700/60 bg-rose-950/60 text-rose-300'
                                  : 'border-amber-700/60 bg-amber-950/50 text-amber-200'
                            }`}
                          >
                            {det.status_tecnico === 'VALIDA_CRIPTOGRAFICAMENTE'
                              ? 'Integridade Criptográfica Verificada'
                              : det.status_tecnico === 'INVALIDA'
                                ? 'Assinatura Inválida'
                                : det.status_tecnico === 'ASSINATURA_CMS_INTEGRA_BYTERANGE_PARCIAL'
                                  ? 'CMS Íntegro • ByteRange Parcial (PDF Mesclado)'
                                  : 'Validação Externa Pendente'}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px] text-slate-300 pt-1">
                        <div>
                          <span className="text-slate-400">AC Emissora: </span>
                          <span className="font-medium text-slate-200">{cert.emissor_ac}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Data da assinatura: </span>
                          <span className="font-medium text-slate-200">
                            {det?.data_assinatura || 'Não informada no pacote CMS'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Nº de Série: </span>
                          <span className="font-mono text-slate-200 break-all">
                            {cert.numero_serie}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Validade do certificado: </span>
                          <span className="text-slate-200">
                            {cert.validade_inicio !== 'Não informada no certificado'
                              ? `${cert.validade_inicio} a ${cert.validade_fim}`
                              : 'Não informada no certificado'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Padrão / SubFilter: </span>
                          <span className="font-mono text-slate-200">
                            {det?.subfilter || 'Não informado'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Algoritmo de Hash: </span>
                          <span className="font-mono text-slate-200">
                            {det?.algoritmo_hash || 'Não identificado'}
                          </span>
                        </div>
                      </div>

                      {det?.integridade && (
                        <div className="text-[11px] text-slate-300 pt-1 border-t border-slate-800/80">
                          <span className="text-slate-400">Diagnóstico técnico da assinatura: </span>
                          <span>{det.integridade}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                {audit.status_auditoria === 'FALHA_ANALISE_ARQUIVO'
                  ? 'Não foi possível inspecionar certificados porque a leitura do arquivo falhou.'
                  : 'Nenhum certificado digital de signatário (pessoa física ou jurídica assinante) foi identificado neste arquivo.'}
              </p>
            )}
          </div>

          {/* 2. Autoridades Certificadoras e Cadeia de Confiança */}
          {audit.autoridades_certificadoras.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2.5">
              <div>
                <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  Autoridades Certificadoras (Emissores e Cadeia — Não são signatários)
                </h5>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Entidades certificadoras que emitiram os certificados dos signatários ou compõem a cadeia hierárquica. Não devem ser confundidas com as pessoas que assinaram o documento.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {audit.autoridades_certificadoras.map((ac, idx) => (
                  <div
                    key={`${ac.nome_exibicao}-${idx}`}
                    className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs flex items-start gap-2.5"
                  >
                    <Building2 className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-200 break-words">
                        {ac.nome_exibicao}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Organização: {ac.organizacao} • Papel: Autoridade Certificadora
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Outros Componentes da Cadeia / Carimbo do Tempo (TSA) */}
          {audit.outros_componentes_cadeia.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2.5">
              <div>
                <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Carimbo do Tempo (TSA) e Outros Componentes da Cadeia
                </h5>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Autoridades de Carimbo do Tempo (ACT/TSA) ou referências de infraestrutura criptográfica presentes no pacote CMS.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {audit.outros_componentes_cadeia.map((comp, idx) => (
                  <div
                    key={`${comp.nome_exibicao}-${idx}`}
                    className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs flex items-start gap-2.5"
                  >
                    <Clock className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-200 break-words">
                        {comp.nome_exibicao}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Tipo:{' '}
                        {comp.papel === 'CARIMBO_TEMPO_TSA'
                          ? 'Servidor de Carimbo do Tempo (TSA)'
                          : 'Infraestrutura de Chaves Públicas'}{' '}
                        • Emissor: {comp.emissor_ac}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Verificações Técnicas Efetivamente Executadas */}
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2.5">
            <h5 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Escopo das Verificações Técnicas Executadas pelo FIORIX
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                {
                  label: 'Leitura e validação do cabeçalho PDF (%PDF-)',
                  done: audit.verificacoes_executadas.leitura_estrutura_pdf,
                },
                {
                  label: 'Cálculo do hash criptográfico SHA-256 dos bytes do arquivo',
                  done: audit.verificacoes_executadas.calculo_hash_sha256_arquivo,
                },
                {
                  label: 'Extração dos dicionários /ByteRange e /Contents',
                  done: audit.verificacoes_executadas.extracao_dicionarios_byterange_contents,
                },
                {
                  label: 'Decodificação ASN.1 DER da estrutura CMS/PKCS#7',
                  done: audit.verificacoes_executadas.decodificacao_asn1_cms_pkcs7,
                },
                {
                  label: 'Leitura e separação de certificados X.509 (Signatários vs. ACs)',
                  done: audit.verificacoes_executadas.leitura_certificados_x509,
                },
                {
                  label: 'Verificação de alinhamento e cobertura do /ByteRange',
                  done: audit.verificacoes_executadas.verificacao_alinhamento_byterange,
                },
                {
                  label: 'Verificação do hash messageDigest sobre os bytes assinados',
                  done: audit.verificacoes_executadas.verificacao_hash_message_digest,
                },
                {
                  label: 'Verificação matemática da assinatura com a chave pública X.509',
                  done: audit.verificacoes_executadas.verificacao_assinatura_chave_publica_x509,
                },
                {
                  label: 'Consulta online de LCR / OCSP e homologação normativa ITI',
                  done: audit.verificacoes_executadas.validacao_cadeia_iti_online,
                  externalNote: 'Depende do Verificador do ITI (validar.iti.gov.br)',
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/90 bg-slate-900/50 px-3 py-1.5"
                >
                  <span className="text-slate-300 text-[11px]">{item.label}</span>
                  <span
                    className={`text-[11px] font-medium shrink-0 ${
                      item.done
                        ? 'text-emerald-400'
                        : item.externalNote
                          ? 'text-amber-300'
                          : 'text-slate-500'
                    }`}
                  >
                    {item.done
                      ? 'Executada'
                      : item.externalNote
                        ? 'Validação externa (ITI)'
                        : 'Não aplicável'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950 px-4 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition shadow active:scale-95"
          >
            <ArrowLeft className="h-4 w-4 text-cyan-400" />
            <span>Voltar</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://validar.iti.gov.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-700/70 bg-cyan-950/60 hover:bg-cyan-900/70 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium text-cyan-200 hover:text-white transition shadow"
            >
              <ExternalLink className="h-4 w-4 text-cyan-400" />
              <span>Validar no ITI</span>
            </a>

            <button
              type="button"
              onClick={imprimirRelatorio}
              title="Imprimir relatório técnico de auditoria (A4)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 sm:px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-200 hover:text-white transition shadow"
            >
              <Printer className="h-4 w-4 text-cyan-400" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
