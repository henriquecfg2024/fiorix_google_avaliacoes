'use client';

import React, { useState } from 'react';
import { generateAiResponse, sendReviewResponse } from '@/app/actions/reviews';
import { invalidateNavigationStats } from '@/lib/navigation/client-data';
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
  staffNames?: string[];
}

function cleanReviewComment(comment: string | null | undefined): string {
  if (!comment) return '';
  return comment
    .replace(/\s*\((?:Translated by Google|Traduzido pelo Google|Translated by tripadvisor|Traduzido pelo Tripadvisor)[\s\S]*/i, '')
    .trim();
}

const defaultStaffList = [
  'Lucas',
  'Ana',
  'Edvan',
  'Juliana',
  'Sarah',
  'Ricardo',
  'Anne',
  'Jozilene',
  'Theodoro',
  'Guilherme',
  'Vanderlei',
  'Jonatan',
  'Bruno',
];

function renderCommentWithPills(text: string, customStaff?: string[]) {
  const staffNames = customStaff && customStaff.length > 0 ? customStaff : defaultStaffList;
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

export function ReviewItemCard({ review, staffNames }: ReviewItemProps) {
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
      invalidateNavigationStats();
      toast.success('Resposta enviada com sucesso ao Google!');
      setIsOpen(false);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao enviar resposta ao Google.';
      toast.error(msg);
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
        className={`space-y-3.5 rounded-[20px] border p-5 shadow-sm backdrop-blur-xl transition-all ${
          isLowRating
            ? 'border-red-500/40 border-l-4 border-l-red-500 bg-[#0B1020]/90 shadow-[0_4px_20px_rgba(239,68,68,0.08)]'
            : isMidRating
              ? 'border-amber-500/40 border-l-4 border-l-amber-500 bg-[#0B1020]/90 shadow-[0_4px_20px_rgba(245,158,11,0.08)]'
              : 'border-white/20 bg-[#0B1020]/90 hover:border-white/35'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-amber-400 text-sm font-extrabold text-white shadow-xs">
              {review.reviewerName ? review.reviewerName[0].toUpperCase() : 'A'}
            </div>
            <div>
              <h4 className="text-base font-bold leading-tight text-white">{review.reviewerName}</h4>
              <span className="text-xs sm:text-sm text-white/60 font-medium">{formatDate(review.publishedAt)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`text-base font-bold tracking-wider ${
                review.rating >= 4 ? 'text-emerald-400' : review.rating === 3 ? 'text-amber-400' : 'text-red-400'
              }`}
            >
              {renderStars(review.rating)}
            </span>

            {review.status === 'RESPONDED' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/12 px-3 py-1 text-xs sm:text-sm font-semibold text-emerald-300">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                Respondida
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/12 px-3 py-1 text-xs sm:text-sm font-semibold text-amber-300">
                <Clock className="h-3.5 w-3.5 text-amber-400" />
                Aguardando resposta
              </span>
            )}

            {isLowRating && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/12 px-3 py-1 text-xs sm:text-sm font-bold text-red-300">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                Crítica • Requer atenção
              </span>
            )}
          </div>
        </div>

        {topicTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {topicTags.map((t, idx) => (
              <span key={idx} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${t.color}`}>
                {t.label}
              </span>
            ))}
          </div>
        )}

        <div className="rounded-xl border border-white/20 bg-[#080D1A] p-4 text-sm sm:text-base leading-relaxed text-white">
          {!cleanedComment ? (
            <p className="italic text-white/40">Sem comentário por extenso.</p>
          ) : (
            <div>
              <p className={!isExpanded && isLong ? 'line-clamp-3' : ''}>"{renderCommentWithPills(cleanedComment, staffNames)}"</p>
              {isLong && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1.5 inline-block cursor-pointer text-xs sm:text-sm font-bold text-amber-300 hover:underline"
                >
                  {isExpanded ? 'Ver menos ↑' : 'Ler completo →'}
                </button>
              )}
            </div>
          )}
        </div>

        {review.status === 'RESPONDED' && review.response?.content && (
          <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 text-white">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-emerald-300">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                Resposta enviada ✓ IA
              </span>
              <button
                onClick={handleCopyResponse}
                className="flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs sm:text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
              >
                {copiedResponse ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedResponse ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <p className="text-sm sm:text-base leading-relaxed text-white/90">{review.response.content}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleOpenModal}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all ${
                review.status === 'RESPONDED'
                  ? 'border border-white/20 bg-[#080D1A] text-white hover:bg-white/[0.08]'
                  : 'bg-gradient-to-r from-indigo-500 to-amber-400 text-white shadow-xs hover:brightness-105'
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
              className="inline-flex items-center gap-1 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <ExternalLink className="h-3.5 w-3.5 text-white/50" />
              <span>Ver no Google</span>
            </a>
          </div>

          <button
            onClick={() => setShowTechDetails(!showTechDetails)}
            className="inline-flex cursor-pointer items-center gap-1 py-1 text-xs sm:text-sm font-semibold text-white/60 transition-colors hover:text-white"
          >
            <span>Detalhes técnicos</span>
            {showTechDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {showTechDetails && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-white/20 bg-[#080D1A] p-3 text-xs text-white">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="shrink-0 font-semibold text-white/60">ID Google:</span>
              <code className="truncate rounded bg-[#0B1020] border border-white/10 px-2 py-0.5 font-mono text-[11px] text-white/90">
                {review.googleId || review.id}
              </code>
            </div>
            <button
              onClick={handleCopyGoogleId}
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-white/20 bg-[#0B1020] px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-white/[0.08]"
            >
              {copiedId ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>{copiedId ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl animate-in zoom-in-95 space-y-4 rounded-[24px] border border-white/20 bg-[#0B1020] p-6 shadow-2xl duration-200 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Resposta com Inteligência Artificial</h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="cursor-pointer rounded-lg p-1 text-white/60 hover:bg-white/[0.08] hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1 rounded-xl border border-white/20 bg-[#080D1A] p-3.5 text-xs text-white">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">
                  {review.reviewerName} ({review.rating}★)
                </span>
                <span className="font-bold text-amber-400">{renderStars(review.rating)}</span>
              </div>
              <p className="italic text-white/80">"{cleanedComment || 'Sem comentário'}"</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-white/80">Selecione o tom de voz da IA:</label>
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
                        ? 'border-cyan-500/50 bg-cyan-500/15 font-bold text-cyan-300'
                        : 'border-white/20 bg-[#080D1A] text-white/80 hover:bg-white/[0.08] hover:text-white'
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
                  <label className="text-xs font-bold text-white/80">Sugestão de Resposta Rascunhada:</label>
                  <button
                    type="button"
                    onClick={() => handleGenerate(selectedTone)}
                    disabled={isGenerating}
                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:underline"
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
                  className="w-full rounded-xl border border-white/20 bg-[#080D1A] p-3 text-sm leading-relaxed text-white outline-none placeholder:text-white/40 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 disabled:bg-[#060A14] disabled:text-white/40"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="cursor-pointer rounded-xl border border-white/20 bg-[#080D1A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-white/[0.08]"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSending || isGenerating}
                  className="cursor-pointer rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-5 py-2 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50"
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

