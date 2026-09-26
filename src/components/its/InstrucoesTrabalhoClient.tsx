'use client';

import React, { useState, useTransition, useCallback } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronDown,
  X,
  Users,
  FileText,
  Eye,
  RotateCcw,
  Send,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Loader2,
  Archive,
  History,
  Trash2,
  MoreVertical,
  ShieldAlert,
  GitBranch,
  Hash,
} from 'lucide-react';
import { ITItem } from '@/app/actions/its';
import {
  analisarItColaborador,
  aprovarItColaborador,
  publicarItColaborador,
  solicitarCorrecaoIt,
  rejeitarItColaborador,
  arquivarItPublicada,
  excluirPermanenteIt,
  getHistoricoVersoes,
  ItPendenteAprovacaoDetalhe,
  HistoricoVersoesData,
} from '@/app/actions/its';

// ═══════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════

interface ConformidadeItem {
  id: string;
  codigo: string;
  titulo: string;
  departamento: string;
  versao: string;
  guardiaoNome: string;
  diasSemRevisao: number;
  totalEquipe: number;
  cientesCount: number;
  pendentesCount: number;
  pendentesNomes: string[];
}

interface ItPendenteResumo {
  id: string;
  codigo: string;
  titulo: string;
  departamento: string;
  versao: string;
  status: string;
  objetivo: string;
  pdfUrl: string | null;
  pdfPath: string | null;
  autorNome: string;
  autorEmail: string;
  criadoEm: string;
  itSimilar: { codigo: string; titulo: string } | null;
}

interface InstrucoesTrabalhoData {
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    departamento: string;
  };
  its: ITItem[];
  kpis: {
    totalIts: number;
    itsAtualizadas7d: number;
    itsAtualizadas30d: number;
    taxaConformidade: number;
    totalPendentes: number;
    itsVencidas: number;
  };
  conformidadePorIt: ConformidadeItem[];
  itsPendentesAprovacao: ItPendenteResumo[];
}

interface InstrucoesTrabalhoClientProps {
  initialData: InstrucoesTrabalhoData;
  initialTab?: 'catalogo' | 'fiscalizacao';
}

// ═══════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════

const STATUS_FLUXO_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  enviada_para_analise: { label: 'Aguardando análise', color: 'text-indigo-300', bg: 'bg-indigo-500/20 border-indigo-500/30' },
  correcao_solicitada: { label: 'Correção solicitada', color: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-500/30' },
  aprovada: { label: 'Aguardando publicação', color: 'text-teal-300', bg: 'bg-teal-500/20 border-teal-500/30' },
  rejeitada: { label: 'Rejeitada', color: 'text-red-300', bg: 'bg-red-500/20 border-red-500/30' },
};

/** Badge de revisão — só para ITs efetivamente publicadas */
function getStatusRevisao(diasSemRevisao: number): {
  label: string;
  color: string;
  bg: string;
  urgente: boolean;
} {
  if (diasSemRevisao >= 120) {
    return { label: 'Revisão vencida', color: 'text-red-300', bg: 'bg-red-500/20 border-red-500/30', urgente: true };
  }
  if (diasSemRevisao >= 90) {
    const diasRestantes = 120 - diasSemRevisao;
    return { label: `Revisar em ${diasRestantes}d`, color: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-500/30', urgente: true };
  }
  return { label: 'Atualizada', color: 'text-emerald-300', bg: 'bg-emerald-500/15 border-emerald-500/25', urgente: false };
}

// ═══════════════════════════════════════════════
// MODAL — DETALHES DA IT PUBLICADA
// ═══════════════════════════════════════════════

function ItDetailModal({
  it,
  onClose,
  canManage,
}: {
  it: ITItem;
  onClose: () => void;
  canManage: boolean;
}) {
  const revisao = getStatusRevisao(it.diasSemRevisao);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0D1424] shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-white/8 gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{it.codigo} • v{it.versao}</p>
            <h2 className="font-bold text-slate-900 dark:text-white text-base leading-tight">{it.titulo}</h2>
            <p className="text-xs text-slate-400 mt-1">{it.departamento}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${revisao.bg} ${revisao.color}`}>
              {revisao.label}
            </span>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-3 max-h-72 overflow-y-auto">
          {it.objetivo && (
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">Objetivo</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{it.objetivo}</p>
            </div>
          )}
          {it.pdfOriginalUrl && (
            <a
              href={it.pdfOriginalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Visualizar PDF
            </a>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-white/8 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/8 dark:hover:bg-white/12 dark:text-white text-xs font-semibold transition-colors border border-white/10"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MODAL — PESSOAS PENDENTES DE CIÊNCIA
// ═══════════════════════════════════════════════

function PessoasPendentesModal({
  item,
  onClose,
}: {
  item: ConformidadeItem;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0D1424] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-white/8">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">{item.titulo}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {item.pendentesCount} colaborador{item.pendentesCount !== 1 ? 'es' : ''} com ciência pendente
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 max-h-72 overflow-y-auto">
          {item.pendentesNomes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Nenhum pendente no momento.</p>
          ) : (
            <ul className="space-y-2">
              {item.pendentesNomes.map((nome, i) => (
                <li key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/4 border border-white/6">
                  <div className="w-7 h-7 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-rose-300">{nome.charAt(0).toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-slate-200">{nome}</span>
                  <span className="ml-auto text-xs text-rose-400 font-medium">Pendente</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-white/8">
          <button onClick={onClose} className="w-full px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/8 dark:hover:bg-white/12 dark:text-white text-xs font-semibold transition-colors border border-white/10">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MODAL — ANALISAR IT (Aprovar / Corrigir / Rejeitar)
// ═══════════════════════════════════════════════

type AnalisarStep = 'view' | 'confirmar_aprovacao' | 'solicitar_correcao' | 'rejeitar' | 'publicar' | 'done';

function AnalisarItModal({
  itResumo,
  onClose,
  onActioned,
}: {
  itResumo: ItPendenteResumo;
  onClose: () => void;
  onActioned: () => void;
}) {
  const [step, setStep] = useState<AnalisarStep>('view');
  const [detalhe, setDetalhe] = useState<ItPendenteAprovacaoDetalhe | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [motivo, setMotivo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Carrega detalhes ao abrir
  React.useEffect(() => {
    let cancelled = false;
    analisarItColaborador(itResumo.id).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setDetalhe(res.data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [itResumo.id]);

  async function handleAprovar() {
    setErrorMsg('');
    startTransition(async () => {
      const res = await aprovarItColaborador(itResumo.id);
      if (res.success) {
        setSuccessMsg('IT aprovada! Agora você pode publicá-la.');
        setStep('publicar');
      } else {
        setErrorMsg(res.error || 'Erro ao aprovar.');
      }
    });
  }

  async function handlePublicar() {
    setErrorMsg('');
    startTransition(async () => {
      const res = await publicarItColaborador(itResumo.id);
      if (res.success) {
        setSuccessMsg('IT publicada com sucesso! Ela agora aparece no Catálogo.');
        setStep('done');
        setTimeout(() => { onActioned(); onClose(); }, 1500);
      } else {
        setErrorMsg(res.error || 'Erro ao publicar.');
      }
    });
  }

  async function handleCorrecao() {
    if (!motivo.trim()) { setErrorMsg('Informe o motivo da correção.'); return; }
    setErrorMsg('');
    startTransition(async () => {
      const res = await solicitarCorrecaoIt(itResumo.id, motivo.trim());
      if (res.success) {
        setSuccessMsg('Correção solicitada. O colaborador será notificado.');
        setStep('done');
        setTimeout(() => { onActioned(); onClose(); }, 1500);
      } else {
        setErrorMsg(res.error || 'Erro ao solicitar correção.');
      }
    });
  }

  async function handleRejeitar() {
    if (!motivo.trim()) { setErrorMsg('Informe o motivo da rejeição.'); return; }
    setErrorMsg('');
    startTransition(async () => {
      const res = await rejeitarItColaborador(itResumo.id, motivo.trim());
      if (res.success) {
        setSuccessMsg('IT rejeitada e arquivada.');
        setStep('done');
        setTimeout(() => { onActioned(); onClose(); }, 1500);
      } else {
        setErrorMsg(res.error || 'Erro ao rejeitar.');
      }
    });
  }

  const statusInfo = STATUS_FLUXO_LABELS[itResumo.status] || { label: itResumo.status, color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-500/20 border-slate-500/30' };
  const isAprovada = itResumo.status === 'aprovada';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !pending && onClose()} />
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0D1424] shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-white/8 gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              {step === 'publicar' ? 'Publicar IT' : step === 'solicitar_correcao' ? 'Solicitar Correção' : step === 'rejeitar' ? 'Rejeitar IT' : 'Analisar IT'}
            </p>
            <h2 className="font-bold text-slate-900 dark:text-white text-base leading-tight">{itResumo.titulo}</h2>
            <p className="text-xs text-slate-400 mt-1">{itResumo.codigo} • {itResumo.departamento}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusInfo.bg} ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            <button onClick={() => !pending && onClose()} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          )}

          {!loading && detalhe && (step === 'view' || step === 'confirmar_aprovacao' || step === 'publicar') && (
            <>
              {/* IT Similar Warning */}
              {detalhe.itSimilar && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 p-4">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-amber-300 mb-0.5">IT similar já publicada</p>
                    <p className="text-amber-200/70">
                      Já existe uma IT publicada com título semelhante: <span className="font-mono font-bold">{detalhe.itSimilar.codigo}</span> — {detalhe.itSimilar.titulo}.
                      O aprovador decide se esta substituirá a existente, é independente, ou deve ser devolvida/rejeitada.
                    </p>
                  </div>
                </div>
              )}

              {/* Dados */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-white/4 rounded-xl p-3">
                  <p className="text-slate-500 mb-0.5">Autor</p>
                  <p className="text-slate-200 font-medium">{detalhe.autorNome}</p>
                </div>
                <div className="bg-white/4 rounded-xl p-3">
                  <p className="text-slate-500 mb-0.5">Setor</p>
                  <p className="text-slate-200 font-medium">{detalhe.departamento}</p>
                </div>
                <div className="bg-white/4 rounded-xl p-3">
                  <p className="text-slate-500 mb-0.5">Enviado em</p>
                  <p className="text-slate-200 font-medium">{detalhe.criadoEm}</p>
                </div>
                <div className="bg-white/4 rounded-xl p-3">
                  <p className="text-slate-500 mb-0.5">Versão</p>
                  <p className="text-slate-200 font-medium">{detalhe.versao}</p>
                </div>
              </div>

              {detalhe.objetivo && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">Objetivo / Descrição</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{detalhe.objetivo}</p>
                </div>
              )}

              {detalhe.pdfUrl && (
                <a
                  href={detalhe.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 text-sm font-semibold transition-colors"
                >
                  <Eye className="w-4 h-4" /> Visualizar PDF enviado
                  <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-60" />
                </a>
              )}

              {step === 'publicar' && (
                <div className="rounded-xl border border-teal-500/25 bg-teal-500/8 p-4">
                  <p className="text-sm font-semibold text-teal-300 mb-1">IT aprovada — pronta para publicação</p>
                  <p className="text-xs text-teal-200/70">
                    Após publicar, esta IT aparecerá no Catálogo e será contabilizada nos indicadores.
                    Apenas usuários autorizados podem publicar.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Solicitar Correção */}
          {step === 'solicitar_correcao' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">Descreva o que precisa ser corrigido. O colaborador receberá este motivo.</p>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: O PDF está ilegível nas páginas 3 e 4. Solicito que reenvie com qualidade maior."
                rows={4}
                disabled={pending}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition-all resize-none disabled:opacity-50"
              />
            </div>
          )}

          {/* Rejeitar */}
          {step === 'rejeitar' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">Esta IT será arquivada como rejeitada. Informe o motivo obrigatoriamente.</p>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: Duplicata da IT-ATE-001. O documento submetido é idêntico ao já publicado."
                rows={4}
                disabled={pending}
                className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/60 transition-all resize-none disabled:opacity-50"
              />
            </div>
          )}

          {errorMsg && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />{successMsg}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3 p-6 border-t border-slate-200 dark:border-white/8 flex-wrap">
          {step === 'view' && !isAprovada && (
            <>
              <button onClick={() => { setMotivo(''); setStep('rejeitar'); }} disabled={pending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20 text-xs font-semibold transition-colors disabled:opacity-50">
                <ThumbsDown className="w-3.5 h-3.5" /> Rejeitar
              </button>
              <button onClick={() => { setMotivo(''); setStep('solicitar_correcao'); }} disabled={pending}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-xs font-semibold transition-colors disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5" /> Solicitar correção
              </button>
              <button onClick={() => setStep('confirmar_aprovacao')} disabled={pending || loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors disabled:opacity-50 ml-auto">
                <ThumbsUp className="w-3.5 h-3.5" /> Aprovar
              </button>
            </>
          )}

          {step === 'confirmar_aprovacao' && (
            <>
              <button onClick={() => setStep('view')} disabled={pending}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                Voltar
              </button>
              <button onClick={handleAprovar} disabled={pending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                Confirmar aprovação
              </button>
            </>
          )}

          {step === 'publicar' && (
            <>
              <button onClick={onClose} disabled={pending}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                Publicar depois
              </button>
              <button onClick={handlePublicar} disabled={pending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Publicar agora
              </button>
            </>
          )}

          {step === 'solicitar_correcao' && (
            <>
              <button onClick={() => setStep('view')} disabled={pending}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                Voltar
              </button>
              <button onClick={handleCorrecao} disabled={pending || !motivo.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Enviar devolução
              </button>
            </>
          )}

          {step === 'rejeitar' && (
            <>
              <button onClick={() => setStep('view')} disabled={pending}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                Voltar
              </button>
              <button onClick={handleRejeitar} disabled={pending || !motivo.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ThumbsDown className="w-4 h-4" />}
                Confirmar rejeição
              </button>
            </>
          )}

          {/* Publicar IT já aprovada */}
          {step === 'view' && isAprovada && (
            <>
              <button onClick={onClose} disabled={pending}
                className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-semibold transition-colors disabled:opacity-50">
                Fechar
              </button>
              <button onClick={handlePublicar} disabled={pending || loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition-colors disabled:opacity-50">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Publicar IT
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════

export function InstrucoesTrabalhoClient({
  initialData,
  initialTab = 'catalogo',
}: InstrucoesTrabalhoClientProps) {
  const { its, kpis, conformidadePorIt, currentUser } = initialData;
  const itsPendentesAprovacao: ItPendenteResumo[] = initialData.itsPendentesAprovacao ?? [];
  const isGestao = ['ADMIN', 'SUBSTITUTO', 'MASTER'].includes(currentUser.role);

  const [activeTab, setActiveTab] = useState<'catalogo' | 'fiscalizacao'>(initialTab);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSetor, setFilterSetor] = useState('TODOS');
  const [viewItModal, setViewItModal] = useState<ITItem | null>(null);
  const [pessoasModal, setPessoasModal] = useState<ConformidadeItem | null>(null);
  const [analisarModal, setAnalisarModal] = useState<ItPendenteResumo | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Estados dos novos modais de ciclo de vida
  const [arquivarModal, setArquivarModal] = useState<ITItem | null>(null);
  const [historicoModal, setHistoricoModal] = useState<ITItem | null>(null);
  const [excluirPermanenteModal, setExcluirPermanenteModal] = useState<ITItem | null>(null);
  const [menuAberto, setMenuAberto] = useState<string | null>(null); // id da IT com menu aberto

  const handleActioned = useCallback(() => {
    setRefreshKey((k) => k + 1);
    // Recarregar página para refletir mudanças de status
    if (typeof window !== 'undefined') window.location.reload();
  }, []);

  // Setores únicos (catálogo = ITs publicadas)
  const setores = ['TODOS', ...Array.from(new Set(its.map((it) => it.departamento).filter(Boolean))).sort()];

  // ITs filtradas do catálogo
  const itsFiltradas = its.filter((it) => {
    const termLower = searchTerm.toLowerCase();
    const matchSearch =
      !searchTerm ||
      it.titulo.toLowerCase().includes(termLower) ||
      it.codigo.toLowerCase().includes(termLower);
    const matchSetor = filterSetor === 'TODOS' || it.departamento === filterSetor;
    return matchSearch && matchSetor;
  });

  // ── Pendências da Fiscalização ──────────────────────────

  type TipoPendencia =
    | 'aguardando_analise'
    | 'correcao_solicitada'
    | 'aguardando_publicacao'
    | 'revisao_vencida'
    | 'revisao_proxima'
    | 'ciencia_pendente';

  type Pendencia =
    | { tipo: 'aguardando_analise' | 'correcao_solicitada' | 'aguardando_publicacao'; itPendente: ItPendenteResumo }
    | { tipo: 'revisao_vencida' | 'revisao_proxima' | 'ciencia_pendente'; item: ConformidadeItem };

  const pendencias: Pendencia[] = [];

  // 1. ITs aguardando análise / correção / publicação
  for (const p of itsPendentesAprovacao) {
    if (p.status === 'enviada_para_analise') {
      pendencias.push({ tipo: 'aguardando_analise', itPendente: p });
    } else if (p.status === 'correcao_solicitada') {
      pendencias.push({ tipo: 'correcao_solicitada', itPendente: p });
    } else if (p.status === 'aprovada') {
      pendencias.push({ tipo: 'aguardando_publicacao', itPendente: p });
    }
  }

  // 2. Revisão e ciência das ITs publicadas
  for (const item of conformidadePorIt) {
    if (item.diasSemRevisao >= 120) {
      pendencias.push({ tipo: 'revisao_vencida', item });
    } else if (item.diasSemRevisao >= 90) {
      pendencias.push({ tipo: 'revisao_proxima', item });
    }
    if (item.pendentesCount > 0) {
      pendencias.push({ tipo: 'ciencia_pendente', item });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#070A12] dark:text-white pb-16 font-sans relative overflow-hidden transition-colors">
      {/* Background glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[52rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/8 to-cyan-500/6 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/8" />
      </div>

      <div className="relative mx-auto max-w-[1100px] px-4 sm:px-6 pt-6">

        {/* ── Header ─────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-bold tracking-widest text-teal-400 uppercase mb-1">
              Gestão de ITs
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Gestão de Instruções de Trabalho
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Acompanhe, revise e aprove novas Instruções de Trabalho.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 self-start sm:self-auto dark:border-white/10 dark:bg-white/4">
            <button
              onClick={() => setActiveTab('catalogo')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'catalogo'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Catálogo
            </button>
            <button
              onClick={() => setActiveTab('fiscalizacao')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === 'fiscalizacao'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/40'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Aprovações
              {pendencias.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  activeTab === 'fiscalizacao'
                    ? 'bg-white/20 text-white'
                    : 'bg-rose-500/80 text-white'
                }`}>
                  {pendencias.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── Banner de alerta para SUBSTITUTOS ─────────────────── */}
        {currentUser.role === 'SUBSTITUTO' && itsPendentesAprovacao.filter(p => p.status === 'enviada_para_analise').length > 0 && (
          <div className="mb-6 relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-orange-500/8 to-amber-500/10 backdrop-blur-sm">
            {/* Glow de fundo */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-gradient-to-b from-amber-400 via-orange-400 to-amber-500" />
              <div className="absolute -top-8 left-1/2 h-24 w-96 -translate-x-1/2 rounded-full bg-amber-500/8 blur-2xl" />
            </div>

            <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4">
              {/* Ícone + texto */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="shrink-0 mt-0.5 flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-amber-300 leading-tight">
                    {itsPendentesAprovacao.filter(p => p.status === 'enviada_para_analise').length === 1
                      ? '1 Instrução de Trabalho aguarda sua aprovação'
                      : `${itsPendentesAprovacao.filter(p => p.status === 'enviada_para_analise').length} Instruções de Trabalho aguardam sua aprovação`}
                  </p>
                  <p className="text-xs text-amber-200/60 mt-0.5 leading-snug">
                    Como Oficial Substituto, você é responsável por revisar e aprovar as novas ITs submetidas.
                  </p>
                  {/* Lista das ITs pendentes */}
                  <ul className="mt-2 space-y-0.5">
                    {itsPendentesAprovacao
                      .filter(p => p.status === 'enviada_para_analise')
                      .slice(0, 3)
                      .map((p) => (
                        <li key={p.id} className="flex items-center gap-1.5 text-xs text-amber-100/70">
                          <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                          <span className="truncate">{p.titulo}</span>
                        </li>
                      ))}
                    {itsPendentesAprovacao.filter(p => p.status === 'enviada_para_analise').length > 3 && (
                      <li className="text-xs text-amber-200/40 pl-2.5">
                        + {itsPendentesAprovacao.filter(p => p.status === 'enviada_para_analise').length - 3} mais...
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Botão de ação */}
              <button
                onClick={() => setActiveTab('fiscalizacao')}
                className="shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-[#1a0a00] text-xs font-bold transition-all duration-150 shadow-lg shadow-amber-900/30 sm:self-auto self-start"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Revisar agora
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            ABA CATÁLOGO — somente ITs publicadas/vigentes
        ════════════════════════════════════════════════ */}
        {activeTab === 'catalogo' && (
          <div className="space-y-4">
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar IT por nome ou código"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-white/10 bg-white/4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 focus:bg-white/6 transition-all"
                />
              </div>

              <div className="relative">
                <select
                  value={filterSetor}
                  onChange={(e) => setFilterSetor(e.target.value)}
                  className="appearance-none w-full sm:w-48 pl-4 pr-8 py-2.5 rounded-xl border border-white/10 bg-white/4 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500/60 transition-all cursor-pointer"
                >
                  {setores.map((s) => (
                    <option key={s} value={s} className="bg-[#0D1424]">
                      {s === 'TODOS' ? 'Todos os setores' : s}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>

              {isGestao && (
                <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors shadow-lg shadow-indigo-900/30 shrink-0">
                  <Plus className="w-4 h-4" />
                  Nova IT
                </button>
              )}
            </div>

            {/* Contador */}
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {itsFiltradas.length} {itsFiltradas.length === 1 ? 'instrução de trabalho' : 'instruções de trabalho'}
            </p>

            {/* Lista — apenas ITs publicadas */}
            {itsFiltradas.length === 0 ? (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] py-16 text-center">
                <FileText className="mx-auto w-10 h-10 text-slate-600 mb-3" />
                <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Nenhuma IT encontrada</p>
                <p className="text-sm text-slate-500 mt-1">Tente outro termo ou setor.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-[#0B1020]/60 divide-y divide-white/6">
                {itsFiltradas.map((it) => {
                  const revisao = getStatusRevisao(it.diasSemRevisao);
                  return (
                    <div
                      key={it.id}
                      className="relative flex items-center gap-4 px-5 py-4 hover:bg-white/[0.025] transition-colors group first:rounded-t-2xl last:rounded-b-2xl"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm group-hover:text-indigo-300 transition-colors truncate">
                          {it.titulo}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {it.codigo} • versão {it.versao}
                        </p>
                      </div>

                      <span className="hidden sm:inline-flex shrink-0 text-xs text-slate-400 bg-white/5 border border-white/8 px-2.5 py-1 rounded-lg">
                        {it.departamento}
                      </span>

                      {/* Badge de revisão — só aparece para ITs publicadas */}
                      <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${revisao.bg} ${revisao.color}`}>
                        {revisao.label}
                      </span>

                      <button
                        onClick={() => setViewItModal(it)}
                        className="shrink-0 px-4 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors"
                      >
                        Abrir
                      </button>

                      {/* Menu de ações (apenas gestão) */}
                      {isGestao && (
                        <div className="relative shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); setMenuAberto(menuAberto === it.id ? null : it.id); }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/8 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuAberto === it.id && (
                            <div
                              className="absolute right-0 top-8 z-20 w-48 rounded-xl border border-white/10 bg-[#0D1424] shadow-xl py-1 overflow-hidden"
                              onMouseLeave={() => setMenuAberto(null)}
                            >
                              <button
                                onClick={() => { setMenuAberto(null); setHistoricoModal(it); }}
                                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-white/6 hover:text-white transition-colors"
                              >
                                <History className="w-3.5 h-3.5" /> Ver histórico
                              </button>
                              <button
                                onClick={() => { setMenuAberto(null); setArquivarModal(it); }}
                                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-white/6 hover:text-white transition-colors"
                              >
                                <Archive className="w-3.5 h-3.5" /> Arquivar IT
                              </button>
                              {currentUser.role === 'MASTER' && (
                                <>
                                  <div className="h-px bg-white/6 mx-3 my-1" />
                                  <button
                                    onClick={() => { setMenuAberto(null); setExcluirPermanenteModal(it); }}
                                    className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                                  >
                                    <ShieldAlert className="w-3.5 h-3.5" /> Excluir permanentemente
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════
            ABA FISCALIZAÇÃO
        ════════════════════════════════════════════════ */}
        {activeTab === 'fiscalizacao' && (
          <div className="space-y-5">
            {/* 3 Indicadores */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/8 bg-[#0B1020]/60 p-5">
                <p className={`text-3xl font-bold ${pendencias.length > 0 ? 'text-rose-400' : 'text-white'}`}>
                  {pendencias.length}
                </p>
                <p className="text-sm text-slate-400 mt-1">itens precisam de atenção</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#0B1020]/60 p-5">
                <p className="text-3xl font-bold text-emerald-400">{kpis.taxaConformidade}%</p>
                <p className="text-sm text-slate-400 mt-1">leituras concluídas</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-[#0B1020]/60 p-5">
                {/* totalIts agora só conta ITs publicadas */}
                <p className="text-3xl font-bold text-white">{kpis.totalIts}</p>
                <p className="text-sm text-slate-400 mt-1">ITs publicadas</p>
              </div>
            </div>

            {/* Pendências */}
            <div className="rounded-2xl border border-white/8 bg-[#0B1020]/60 overflow-hidden">
              <div className="px-5 py-4 border-b border-white/6">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Pendências — resolva uma de cada vez
                </p>
              </div>

              {pendencias.length === 0 ? (
                <div className="py-16 text-center">
                  <CheckCircle2 className="mx-auto w-10 h-10 text-emerald-500/50 mb-3" />
                  <p className="text-base font-semibold text-slate-700 dark:text-slate-300">Tudo em dia</p>
                  <p className="text-sm text-slate-500 mt-1">Nenhuma pendência no momento.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/6">
                  {pendencias.map((pendencia, idx) => {
                    // ── Pendências de aprovação ──
                    if (
                      pendencia.tipo === 'aguardando_analise' ||
                      pendencia.tipo === 'correcao_solicitada' ||
                      pendencia.tipo === 'aguardando_publicacao'
                    ) {
                      const p = pendencia.itPendente;
                      const isAnalise = pendencia.tipo === 'aguardando_analise';
                      const isCorrecao = pendencia.tipo === 'correcao_solicitada';
                      const isPublicacao = pendencia.tipo === 'aguardando_publicacao';

                      let motivo = '';
                      let badgeText = '';
                      let badgeColor = '';
                      let iconColor = '';
                      let acaoLabel = '';

                      if (isAnalise) {
                        motivo = 'Nova IT aguardando análise';
                        badgeText = 'Aguardando análise';
                        badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
                        iconColor = 'bg-indigo-500/15';
                        acaoLabel = 'Analisar';
                      } else if (isCorrecao) {
                        motivo = 'Correção solicitada — aguardando reenvio';
                        badgeText = 'Correção solicitada';
                        badgeColor = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                        iconColor = 'bg-amber-500/15';
                        acaoLabel = 'Ver IT';
                      } else {
                        motivo = 'IT aprovada — aguardando publicação';
                        badgeText = 'Aguardando publicação';
                        badgeColor = 'bg-teal-500/20 text-teal-300 border-teal-500/30';
                        iconColor = 'bg-teal-500/15';
                        acaoLabel = 'Publicar';
                      }

                      return (
                        <div
                          key={`${p.id}-${pendencia.tipo}`}
                          className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                        >
                          <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${iconColor}`}>
                            <FileText className={`w-4 h-4 ${isAnalise ? 'text-indigo-400' : isCorrecao ? 'text-amber-400' : 'text-teal-400'}`} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{p.titulo}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{p.codigo} • {motivo}</p>
                          </div>

                          <span className="hidden sm:inline-flex shrink-0 text-xs text-slate-400 bg-white/5 border border-white/8 px-2.5 py-1 rounded-lg">
                            {p.departamento}
                          </span>

                          <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${badgeColor}`}>
                            {badgeText}
                          </span>

                          <button
                            onClick={() => setAnalisarModal(p)}
                            className="shrink-0 px-4 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors"
                          >
                            {acaoLabel}
                          </button>
                        </div>
                      );
                    }

                    // ── Pendências de revisão e ciência ──
                    const item = (pendencia as { tipo: string; item: ConformidadeItem }).item;
                    const isVencida = pendencia.tipo === 'revisao_vencida';
                    const isProxima = pendencia.tipo === 'revisao_proxima';
                    const isCiencia = pendencia.tipo === 'ciencia_pendente';

                    let motivo2 = '';
                    let badgeText2 = '';
                    let badgeColor2 = '';
                    let acaoLabel2 = '';

                    if (isVencida) {
                      motivo2 = 'Revisão vencida';
                      badgeText2 = `${item.diasSemRevisao - 120}d em atraso`;
                      badgeColor2 = 'bg-red-500/20 text-red-300 border-red-500/30';
                      acaoLabel2 = 'Revisar';
                    } else if (isProxima) {
                      const diasRestantes = 120 - item.diasSemRevisao;
                      motivo2 = 'Revisão próxima do vencimento';
                      badgeText2 = `${diasRestantes}d`;
                      badgeColor2 = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                      acaoLabel2 = 'Revisar';
                    } else {
                      motivo2 = `${item.pendentesCount} colaborador${item.pendentesCount !== 1 ? 'es' : ''} ainda não confirmaram a leitura`;
                      badgeText2 = `${item.pendentesCount} pendente${item.pendentesCount !== 1 ? 's' : ''}`;
                      badgeColor2 = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
                      acaoLabel2 = 'Ver pessoas';
                    }

                    return (
                      <div
                        key={`${item.id}-${pendencia.tipo}`}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className={`shrink-0 w-8 h-8 rounded-xl flex items-center justify-center ${
                          isVencida ? 'bg-red-500/15' : isProxima ? 'bg-amber-500/15' : 'bg-rose-500/15'
                        }`}>
                          {(isVencida || isProxima)
                            ? <RotateCcw className={`w-4 h-4 ${isVencida ? 'text-red-400' : 'text-amber-400'}`} />
                            : <Users className="w-4 h-4 text-rose-400" />
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{item.titulo}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{motivo2}</p>
                        </div>

                        <span className="hidden sm:inline-flex shrink-0 text-xs text-slate-400 bg-white/5 border border-white/8 px-2.5 py-1 rounded-lg">
                          {item.departamento}
                        </span>

                        <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-full border ${badgeColor2}`}>
                          {badgeText2}
                        </span>

                        <button
                          onClick={() => { if (isCiencia) setPessoasModal(item); }}
                          className="shrink-0 px-4 py-1.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition-colors"
                        >
                          {acaoLabel2}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modais */}
      {viewItModal && (
        <ItDetailModal
          it={viewItModal}
          onClose={() => setViewItModal(null)}
          canManage={isGestao}
        />
      )}
      {pessoasModal && (
        <PessoasPendentesModal
          item={pessoasModal}
          onClose={() => setPessoasModal(null)}
        />
      )}
      {analisarModal && (
        <AnalisarItModal
          itResumo={analisarModal}
          onClose={() => setAnalisarModal(null)}
          onActioned={handleActioned}
        />
      )}
      {arquivarModal && (
        <ArquivarItModal
          it={arquivarModal}
          onClose={() => setArquivarModal(null)}
          onActioned={handleActioned}
        />
      )}
      {historicoModal && (
        <HistoricoVersoesModal
          it={historicoModal}
          onClose={() => setHistoricoModal(null)}
        />
      )}
      {excluirPermanenteModal && (
        <ExclusaoPermanenteModal
          it={excluirPermanenteModal}
          onClose={() => setExcluirPermanenteModal(null)}
          onActioned={handleActioned}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// MODAL — ARQUIVAR IT
// ═══════════════════════════════════════════════

function ArquivarItModal({
  it,
  onClose,
  onActioned,
}: {
  it: ITItem;
  onClose: () => void;
  onActioned: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleArquivar() {
    if (!motivo.trim()) { setError('O motivo é obrigatório.'); return; }
    setError('');
    startTransition(async () => {
      const res = await arquivarItPublicada(it.id, motivo.trim());
      if (res.success) {
        setSuccess(true);
        setTimeout(() => { onActioned(); onClose(); }, 1200);
      } else {
        setError(res.error || 'Erro ao arquivar.');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !pending && onClose()} />
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0D1424] shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-white/8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Archive className="w-4 h-4 text-slate-400" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Arquivar IT</p>
            </div>
            <h2 className="font-bold text-white">{it.titulo}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{it.codigo} • v{it.versao}</p>
          </div>
          <button onClick={() => !pending && onClose()} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-4 text-sm text-amber-200/80">
            <p className="font-semibold text-amber-300 mb-1">A IT será arquivada</p>
            <ul className="space-y-1 text-xs list-disc list-inside">
              <li>Deixa de aparecer no Catálogo principal</li>
              <li>Mantém histórico, versões, PDFs e registros de leitura</li>
              <li>Não pode ser editada diretamente após arquivamento</li>
              <li>Pode ser consultada no histórico de auditoria</li>
            </ul>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Motivo do arquivamento *</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: Substituída pela versão 2.0. Procedimento revisado e publicado como nova IT."
              rows={3}
              disabled={pending}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 transition-all resize-none disabled:opacity-50"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />IT arquivada com sucesso.
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 p-6 border-t border-slate-200 dark:border-white/8">
          <button onClick={() => !pending && onClose()} disabled={pending || success}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleArquivar} disabled={pending || success || !motivo.trim()}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold transition-colors disabled:opacity-50">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
            Arquivar IT
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MODAL — HISTÓRICO DE VERSÕES
// ═══════════════════════════════════════════════

function HistoricoVersoesModal({
  it,
  onClose,
}: {
  it: ITItem;
  onClose: () => void;
}) {
  const [data, setData] = useState<HistoricoVersoesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<'versoes' | 'audit'>('audit');

  React.useEffect(() => {
    let cancelled = false;
    getHistoricoVersoes(it.id).then((res) => {
      if (cancelled) return;
      if (res.success && res.data) setData(res.data);
      else setError(res.error || 'Erro ao carregar histórico.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [it.id]);

  const auditColorMap: Record<string, string> = {
    EXCLUÍDO: 'text-red-400 bg-red-500/10 border-red-500/25',
    ARQUIVADA: 'text-amber-400 bg-amber-500/10 border-amber-500/25',
    'EXCLUÍDA PERMANENTEMENTE': 'text-red-500 bg-red-500/15 border-red-500/30',
    'EXCLUÍDO PERMANENTEMENTE': 'text-red-500 bg-red-500/15 border-red-500/30',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-[#0D1424] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-white/8 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <History className="w-4 h-4 text-slate-400" />
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Histórico</p>
            </div>
            <h2 className="font-bold text-white">{it.titulo}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{it.codigo} • v{it.versao} atual</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 px-6 pt-4 pb-0 shrink-0">
          <button
            onClick={() => setActiveSection('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSection === 'audit' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Audit Log
          </button>
          <button
            onClick={() => setActiveSection('versoes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeSection === 'versoes' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            Versões
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Audit Log */}
          {!loading && data && activeSection === 'audit' && (
            <div className="space-y-3">
              {data.auditLog.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Nenhum registro de auditoria encontrado.</p>
              ) : (
                data.auditLog.map((entry) => {
                  const isFinal = entry.versaoNova.includes('EXCLUÍD') || entry.versaoNova === 'ARQUIVADA';
                  const colorClass = auditColorMap[entry.versaoNova] || 'text-slate-700 dark:text-slate-300 bg-white/4 border-white/8';
                  return (
                    <div key={entry.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{entry.motivo}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{entry.autorNome} • {entry.criadoEm}</p>
                        </div>
                        <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border ${colorClass}`}>
                          {entry.versaoAnterior || '—'} → {entry.versaoNova}
                        </span>
                      </div>
                      {entry.hashSha256 && (
                        <div className="flex items-center gap-1.5 mt-2">
                          <Hash className="w-3 h-3 text-slate-600" />
                          <p className="text-[10px] font-mono text-slate-600 truncate">{entry.hashSha256.substring(0, 48)}…</p>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Versões */}
          {!loading && data && activeSection === 'versoes' && (
            <div className="space-y-3">
              {data.versoes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">Nenhuma versão registrada.</p>
              ) : (
                data.versoes.map((v) => (
                  <div key={v.id} className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-xs font-bold text-indigo-300">v{v.versao}</span>
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{v.alteracoes}</p>
                        <p className="text-xs text-slate-500 mt-1">{v.autorNome} • {v.criadoEm}</p>
                      </div>
                    </div>
                    {v.hashVersao && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <Hash className="w-3 h-3 text-slate-600" />
                        <p className="text-[10px] font-mono text-slate-600 truncate">{v.hashVersao.substring(0, 48)}…</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-white/8 shrink-0">
          <button onClick={onClose}
            className="w-full px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/8 dark:hover:bg-white/12 dark:text-white text-xs font-semibold transition-colors border border-white/10">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// MODAL — EXCLUSÃO PERMANENTE (MASTER only)
// ═══════════════════════════════════════════════

function ExclusaoPermanenteModal({
  it,
  onClose,
  onActioned,
}: {
  it: ITItem;
  onClose: () => void;
  onActioned: () => void;
}) {
  const [codigoInput, setCodigoInput] = useState('');
  const [motivo, setMotivo] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  const codigoOk = codigoInput.trim().toUpperCase() === it.codigo.toUpperCase();
  const motivoOk = motivo.trim().length >= 20;
  const podeContinuar = codigoOk && motivoOk && senha.trim().length >= 4;

  function handleExcluir() {
    if (!podeContinuar) return;
    setError('');
    startTransition(async () => {
      const res = await excluirPermanenteIt({
        itId: it.id,
        codigoConfirmacao: codigoInput.trim(),
        motivo: motivo.trim(),
        senha: senha,
      });
      if (res.success) {
        setSuccess(true);
        setTimeout(() => { onActioned(); onClose(); }, 1500);
      } else {
        setError(res.error || 'Erro na exclusão permanente.');
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !pending && onClose()} />
      <div className="relative w-full max-w-md rounded-2xl border border-red-500/30 bg-[#0D1424] shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between p-6 border-b border-red-500/20">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Exclusão Permanente — MASTER</p>
            </div>
            <h2 className="font-bold text-white">{it.titulo}</h2>
            <p className="text-xs text-slate-400 mt-0.5">{it.codigo}</p>
          </div>
          <button onClick={() => !pending && onClose()} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/8 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Aviso de consequências */}
          <div className="rounded-xl border border-red-500/30 bg-red-500/8 p-4">
            <p className="text-sm font-bold text-red-300 mb-2">⚠ Esta ação é irreversível</p>
            <ul className="space-y-1 text-xs text-red-200/70 list-disc list-inside">
              <li>O registro receberá soft-delete definitivo com flag</li>
              <li>A ação será registrada no audit log WORM imutável</li>
              <li>Histórico, versões, ciências e PDFs são preservados</li>
              <li>Não é possível desfazer — apenas um MASTER pode fazer isso</li>
            </ul>
          </div>

          {/* Código de confirmação */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
              Digite o código da IT para confirmar: <span className="font-mono text-red-400">{it.codigo}</span>
            </label>
            <input
              type="text"
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value)}
              placeholder={it.codigo}
              disabled={pending}
              className={`w-full px-4 py-2.5 rounded-xl border bg-white/5 text-sm text-white placeholder-slate-600 focus:outline-none transition-all disabled:opacity-50 font-mono ${
                codigoOk ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-white/10 focus:border-red-500/60'
              }`}
            />
          </div>

          {/* Motivo */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">
              Motivo detalhado * <span className="text-slate-600">(mín. 20 chars — {motivo.length}/20)</span>
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva detalhadamente o motivo desta exclusão permanente..."
              rows={3}
              disabled={pending}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50 transition-all resize-none disabled:opacity-50"
            />
          </div>

          {/* Senha */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Sua senha *</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              disabled={pending}
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-red-500/50 transition-all disabled:opacity-50"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />IT excluída permanentemente. Registro no audit log gravado.
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 p-6 border-t border-red-500/20">
          <button onClick={() => !pending && onClose()} disabled={pending || success}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white text-sm font-semibold transition-colors disabled:opacity-50">
            Cancelar
          </button>
          <button onClick={handleExcluir} disabled={pending || success || !podeContinuar}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-600 text-white text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Excluir permanentemente
          </button>
        </div>
      </div>
    </div>
  );
}
