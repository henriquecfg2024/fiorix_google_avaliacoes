'use client';

import React, { useState } from 'react';
import { generateAiResponse, sendReviewResponse } from '@/app/actions/reviews';
import {
  Star,
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
  Tag,
  UserCheck,
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
          className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full text-xs border border-blue-100 mx-0.5"
        >
          <UserCheck className="w-3 h-3 text-blue-600" />
          @{formattedName}
        </span>
      );
    }
    return part;
  });
}

function detectTopicTags(comment: string | null | undefined, rating: number) {
  if (!comment) return [];
  const text = comment.toLowerCase();
  const tags: Array<{ label: string; color: string }> = [];

  if (text.includes('fila') || text.includes('espera') || text.includes('demora')) {
    tags.push({ label: '🏷️ Tempo de Espera', color: 'bg-amber-50 text-amber-700 border-amber-200' });
  }
  if (text.includes('prazo') || text.includes('atraso') || text.includes('corregedoria') || text.includes('protocolo')) {
    tags.push({ label: '🏷️ SLA / Prazos', color: 'bg-red-50 text-red-700 border-red-200' });
  }
  if (text.includes('lucas') || text.includes('ana') || text.includes('edvan') || text.includes('juliana') || text.includes('sarah') || text.includes('atendimento') || text.includes('equipe')) {
    tags.push({ label: '🏷️ Atendimento', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' });
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
  const topicTags = detectTopicTags(cleanedComment, review.rating);

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
      return `Publicado em ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return 'Data recente';
    }
  };

  return (
    <>
      <div
        className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all space-y-3.5 ${
          isLowRating
            ? 'border-red-200 border-l-4 border-l-red-500 bg-red-50/20'
            : isMidRating
            ? 'border-amber-200 border-l-4 border-l-amber-400 bg-amber-50/15'
            : 'border-gray-100 hover:border-gray-200'
        }`}
      >
        {/* TOP ROW: AUTHOR + STARS + STATUS */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-xs shrink-0">
              {review.reviewerName ? review.reviewerName[0].toUpperCase() : 'A'}
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                {review.reviewerName}
              </h4>
              <span className="text-xs text-slate-500">
                {formatDate(review.publishedAt)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm font-bold tracking-tight ${
                review.rating >= 4
                  ? 'text-emerald-600'
                  : review.rating === 3
                  ? 'text-amber-500'
                  : 'text-red-500'
              }`}
            >
              {renderStars(review.rating)}
            </span>

            {review.status === 'RESPONDED' ? (
              <span className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-100 inline-flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                Respondida
              </span>
            ) : (
              <span className="bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-100 inline-flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                Aguardando resposta
              </span>
            )}

            {isLowRating && (
              <span className="bg-red-50 text-red-700 text-xs font-bold px-2.5 py-1 rounded-full border border-red-200 inline-flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                Crítica • Requer atenção
              </span>
            )}
          </div>
        </div>

        {/* TOPIC TAGS */}
        {topicTags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            {topicTags.map((t, idx) => (
              <span
                key={idx}
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${t.color}`}
              >
                {t.label}
              </span>
            ))}
          </div>
        )}

        {/* COMMENT BOX */}
        <div className="bg-slate-50/80 border border-slate-100 rounded-xl p-3.5 text-sm leading-relaxed text-slate-800">
          {!cleanedComment ? (
            <p className="italic text-slate-400">Sem comentário por extenso.</p>
          ) : (
            <div>
              <p className={!isExpanded && isLong ? 'line-clamp-3' : ''}>
                "{renderCommentWithPills(cleanedComment)}"
              </p>
              {isLong && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="mt-1 text-xs font-bold text-blue-600 hover:underline inline-block cursor-pointer"
                >
                  {isExpanded ? 'Ver menos ↑' : 'Ler completo →'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* RESPONDED BOX */}
        {review.status === 'RESPONDED' && review.response?.content && (
          <div className="bg-emerald-50/70 border border-emerald-100 border-l-4 border-l-emerald-500 rounded-xl p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Resposta Enviada ✓ IA
              </span>
              <button
                onClick={handleCopyResponse}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-emerald-100/70 hover:bg-emerald-200/80 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                {copiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedResponse ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {review.response.content}
            </p>
          </div>
        )}

        {/* FOOTER ACTIONS */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            {/* PRIMARY BUTTON */}
            <button
              onClick={handleOpenModal}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                review.status === 'RESPONDED'
                  ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-100'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              }`}
            >
              {review.status === 'RESPONDED' ? (
                <>
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Editar Resposta</span>
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5" />
                  <span>Responder com IA</span>
                </>
              )}
            </button>

            {/* GOOGLE EXTERNAL LINK */}
            <a
              href="https://business.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span>Ver no Google</span>
            </a>
          </div>

          {/* TECH DETAILS COLLAPSIBLE TRIGGER */}
          <button
            onClick={() => setShowTechDetails(!showTechDetails)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700 py-1 transition-colors cursor-pointer"
          >
            <span>Detalhes técnicos</span>
            {showTechDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* COLLAPSIBLE TECH DETAILS */}
        {showTechDetails && (
          <div className="mt-2 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="font-semibold text-slate-500 shrink-0">ID Google:</span>
              <code className="bg-slate-200/70 text-slate-800 px-2 py-0.5 rounded font-mono text-[11px] truncate">
                {review.googleId || review.id}
              </code>
            </div>
            <button
              onClick={handleCopyGoogleId}
              className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-2 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copiedId ? 'Copiado!' : 'Copiar ID'}</span>
            </button>
          </div>
        )}
      </div>

      {/* MODAL IA RESPONDER */}
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Resposta com Inteligência Artificial
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* AVALIAÇÃO PREVIEW */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{review.reviewerName} ({review.rating}★)</span>
                <span className="text-amber-500 font-bold">{renderStars(review.rating)}</span>
              </div>
              <p className="text-slate-600 italic">
                "{cleanedComment || 'Sem comentário'}"
              </p>
            </div>

            {/* SELETOR DE TOM DE VOZ */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Selecione o tom de voz da IA:
              </label>
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTone('formal');
                    handleGenerate('formal');
                  }}
                  className={`p-2 rounded-xl border transition-all text-center cursor-pointer ${
                    selectedTone === 'formal'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Formal 👔
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTone('empathic');
                    handleGenerate('empathic');
                  }}
                  className={`p-2 rounded-xl border transition-all text-center cursor-pointer ${
                    selectedTone === 'empathic'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Empático 🤝
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTone('short');
                    handleGenerate('short');
                  }}
                  className={`p-2 rounded-xl border transition-all text-center cursor-pointer ${
                    selectedTone === 'short'
                      ? 'bg-blue-50 border-blue-600 text-blue-700 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Direto ⚡
                </button>
              </div>
            </div>

            {/* TEXTAREA FORM */}
            <form onSubmit={handleSubmitResponse} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Sugestão de Resposta Rascunhada:
                  </label>
                  <button
                    type="button"
                    onClick={() => handleGenerate(selectedTone)}
                    disabled={isGenerating}
                    className="text-[11px] font-bold text-blue-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>Regerar Rascunho</span>
                  </button>
                </div>

                <textarea
                  rows={5}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  disabled={isGenerating}
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none leading-relaxed text-slate-800 disabled:bg-slate-100"
                />
              </div>

              {/* MODAL ACTIONS */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSending || isGenerating}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2 rounded-xl text-xs transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
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

