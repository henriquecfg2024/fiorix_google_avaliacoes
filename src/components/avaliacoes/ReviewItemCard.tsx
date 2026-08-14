'use client';

import React, { useState } from 'react';
import { generateAiResponse, sendReviewResponse } from '@/app/actions/reviews';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Pencil,
  Bot,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  RefreshCw,
  UserCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface ReviewItemProps {
  review: {
    id: string;
    googleId?: string | null;
    reviewerName: string;
    rating: number;
    comment?: string | null;
    publishedAt: Date;
    status: string;
    response?: { content: string } | null;
  };
}

function cleanReviewComment(comment: string | null | undefined): string {
  if (!comment) return '';
  return comment
    .replace(/\s*\((?:Translated by Google|Traduzido pelo Google|Translated by tripadvisor|Traduzido pelo Tripadvisor)[\s\S]*/i, '')
    .trim();
}

function renderCommentWithPills(text: string) {
  const staffNames = ['Lucas', 'Ana', 'Edvan', 'Juliana', 'Sarah'];
  const regex = new RegExp(`\\b(${staffNames.join('|')})\\b`, 'gi');

  const parts = text.split(regex);
  return parts.map((part, idx) => {
    const isStaff = staffNames.some((s) => s.toLowerCase() === part.toLowerCase());
    if (isStaff) {
      const formattedName = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      return (
        <span
          key={idx}
          className="mx-0.5 inline-flex items-center gap-0.5 rounded-full border border-blue-500/25 bg-blue-500/12 px-2 py-0.5 text-xs font-bold text-blue-300"
        >
          <UserCheck className="h-3 w-3 text-blue-400" />
          @{formattedName}
        </span>
      );
    }
    return part;
  });
}

function detectTopicTags(comment: string | null | undefined) {
  if (!comment) return [];
  const text = comment.toLowerCase();
  const tags: Array<{ label: string; color: string }> = [];

  if (text.includes('fila') || text.includes('espera') || text.includes('demora')) {
    tags.push({ label: 'Tempo de Espera', color: 'border-amber-500/20 bg-amber-500/12 text-amber-300' });
  }
  if (text.includes('prazo') || text.includes('atraso') || text.includes('corregedoria') || text.includes('protocolo')) {
    tags.push({ label: 'SLA / Prazos', color: 'border-red-500/20 bg-red-500/12 text-red-300' });
  }
  if (
    text.includes('lucas') ||
    text.includes('ana') ||
    text.includes('edvan') ||
    text.includes('juliana') ||
    text.includes('sarah') ||
    text.includes('atendimento') ||
    text.includes('equipe')
  ) {
    tags.push({ label: 'Atendimento', color: 'border-emerald-500/20 bg-emerald-500/12 text-emerald-300' });
  }

  return tags;
}

export function ReviewItemCard({ review }: ReviewItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showTechDetails, setShowTechDetails] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [selectedTone, setSelectedTone] = useState<'formal' | 'empathic' | 'short'>('formal');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const cleanedComment = cleanReviewComment(review.comment);
  const isLong = cleanedComment.length > 180;
  const isLowRating = review.rating <= 2;
  const isMidRating = review.rating === 3;
  const topicTags = detectTopicTags(cleanedComment);

  const renderStars = (rating: number) => {
    const full = '★'.repeat(rating);
    const empty = '☆'.repeat(5 - rating);
    return `${full}${empty}`;
  };

  const handleGenerate = async (tone: 'formal' | 'empathic' | 'short') => {
    setIsGenerating(true);
    try {
      const aiDraft = await generateAiResponse(review.reviewerName, review.rating, cleanedComment, tone);
      setResponseText(aiDraft);
    } catch {
      setResponseText(`Prezado(a) ${review.reviewerName}, agradecemos sua avaliação!`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleOpenModal = async () => {
    setIsOpen(true);
    if (review.status === 'RESPONDED' && review.response?.content) {
      setResponseText(review.response.content);
    } else {
      await handleGenerate(selectedTone);
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    try {
      await sendReviewResponse(review.id, responseText);
      toast.success('Resposta enviada com sucesso ao Google!');
      setIsOpen(false);
    } catch {
      toast.error('Erro ao enviar resposta ao Google.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyResponse = () => {
    if (review.response?.content) {
      navigator.clipboard.writeText(review.response.content);
      setCopiedResponse(true);
      toast.success('Resposta copiada para a área de transferência!');
      setTimeout(() => setCopiedResponse(false), 2000);
    }
  };

  const handleCopyGoogleId = () => {
    const googleIdStr = review.googleId || review.id;
    navigator.clipboard.writeText(googleIdStr);
    setCopiedId(true);
    toast.success('ID do Google copiado!');
    setTimeout(() => setCopiedId(false), 2000);
  };

  const formatDate = (dateInput: any) => {
    if (!dateInput) return 'Data recente';
    try {
      const d = new Date(dateInput);
      if (isNaN(d.getTime())) return 'Data recente';
      return `Publicado em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;
    } catch {
      return 'Data recente';
    }
  };

  return (
    <>
      <div
        className={`space-y-3.5 rounded-2xl border p-5 shadow-[0_12px_30px_rgba(2,6,23,0.18)] transition-all ${
          isLowRating
            ? 'border-red-500/35 border-l-4 border-l-red-500 bg-red-500/[0.04]'
            : isMidRating
              ? 'border-amber-500/30 border-l-4 border-l-amber-400 bg-amber-500/[0.035]'
              : 'border-white/10 bg-slate-900/78 hover:border-white/15'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-xs">
              {review.reviewerName ? review.reviewerName[0].toUpperCase() : 'A'}
            </div>
            <div>
              <h4 className="text-sm font-semibold leading-tight text-white">{review.reviewerName}</h4>
              <span className="text-xs text-slate-400">{formatDate(review.publishedAt)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-sm font-bold tracking-tight ${
                review.rating >= 4 ? 'text-emerald-400' : review.rating === 3 ? 'text-amber-400' : 'text-red-400'
              }`}
            >
              {renderStars(review.rating)}
            </span>

            {review.status === 'RESPONDED' ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                Respondida
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/12 px-2.5 py-1 text-xs font-semibold text-amber-300">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                Aguardando resposta
              </span>
            )}

            {isLowRating && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/12 px-2.5 py-1 text-xs font-bold text-red-300">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                Crítica • Requer atenção
              </span>
            )}
          </div>
        </div>

        {topicTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {topicTags.map((t, idx) => (
              <span key={idx} className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${t.color}`}>
                {t.label}
              </span>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-sm leading-relaxed text-slate-200">
          {!cleanedComment ? (
            <p className="italic text-slate-400">Sem comentário por extenso.</p>
          ) : (
            <div>
              <p className={!isExpanded && isLong ? 'line-clamp-3' : ''}>"{renderCommentWithPills(cleanedComment)}"</p>
              {isLong && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1 inline-block cursor-pointer text-xs font-bold text-blue-400 hover:underline"
                >
                  {isExpanded ? 'Ver menos ↑' : 'Ler completo →'}
                </button>
              )}
            </div>
          )}
        </div>

        {review.status === 'RESPONDED' && review.response?.content && (
          <div className="space-y-1.5 rounded-xl border border-emerald-500/15 bg-[linear-gradient(135deg,rgba(16,185,129,0.11),rgba(59,130,246,0.08))] p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-300">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                Resposta enviada ✓ IA
              </span>
              <button
                onClick={handleCopyResponse}
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/18"
              >
                {copiedResponse ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedResponse ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <p className="text-sm leading-relaxed text-slate-200">{review.response.content}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenModal}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                review.status === 'RESPONDED'
                  ? 'border border-blue-500/20 bg-blue-500/12 text-blue-300 hover:bg-blue-500/20'
                  : 'bg-blue-600 text-white shadow-sm hover:bg-blue-500'
              }`}
            >
              {review.status === 'RESPONDED' ? (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Editar Resposta</span>
                </>
              ) : (
                <>
                  <Bot className="h-3.5 w-3.5" />
                  <span>Responder com IA</span>
                </>
              )}
            </button>

            <a
              href="https://business.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.04] hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              <span>Ver no Google</span>
            </a>
          </div>

          <button
            onClick={() => setShowTechDetails(!showTechDetails)}
            className="inline-flex cursor-pointer items-center gap-1 py-1 text-xs font-semibold text-slate-400 transition-colors hover:text-slate-200"
          >
            <span>Detalhes técnicos</span>
            {showTechDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {showTechDetails && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="shrink-0 font-semibold text-slate-400">ID Google:</span>
              <code className="truncate rounded bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-slate-200">
                {review.googleId || review.id}
              </code>
            </div>
            <button
              onClick={handleCopyGoogleId}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-slate-800/80 px-2 py-1 text-[11px] font-bold text-slate-200 transition-colors hover:bg-slate-700"
            >
              {copiedId ? <Check className="h-3 w-3 text-emerald-300" /> : <Copy className="h-3 w-3" />}
              <span>{copiedId ? 'Copiado!' : 'Copiar ID'}</span>
            </button>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl animate-in zoom-in-95 space-y-4 rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">Resposta com Inteligência Artificial</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-white/[0.04] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">
                  {review.reviewerName} ({review.rating}★)
                </span>
                <span className="font-bold text-amber-400">{renderStars(review.rating)}</span>
              </div>
              <p className="italic text-slate-300">"{cleanedComment || 'Sem comentário'}"</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-300">Selecione o tom de voz da IA:</label>
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                {[
                  { key: 'formal', label: 'Formal 👔' },
                  { key: 'empathic', label: 'Empático 🤝' },
                  { key: 'short', label: 'Direto ⚡' },
                ].map((tone) => (
                  <button
                    key={tone.key}
                    type="button"
                    onClick={() => {
                      const selected = tone.key as 'formal' | 'empathic' | 'short';
                      setSelectedTone(selected);
                      handleGenerate(selected);
                    }}
                    className={`cursor-pointer rounded-xl border p-2 text-center transition-all ${
                      selectedTone === tone.key
                        ? 'border-blue-500/30 bg-blue-500/12 font-bold text-blue-300'
                        : 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    {tone.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmitResponse} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-300">Sugestão de Resposta Rascunhada:</label>
                  <button
                    type="button"
                    onClick={() => handleGenerate(selectedTone)}
                    disabled={isGenerating}
                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-blue-400 hover:underline"
                  >
                    <RefreshCw className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>Regerar Rascunho</span>
                  </button>
                </div>

                <textarea
                  rows={5}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  disabled={isGenerating}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm leading-relaxed text-slate-100 outline-none focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/30 disabled:bg-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.08]"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSending || isGenerating}
                  className="cursor-pointer rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-blue-500 disabled:opacity-50"
                >
                  {isSending ? 'Enviando ao Google...' : '🚀 Enviar Resposta ao Google'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
