'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface ReviewItem {
  id: string;
  reviewerName: string;
  rating: number;
  comment: string | null;
  status: string;
  publishedAt: Date;
}

interface ReviewCardProps {
  reviews?: ReviewItem[];
}

function cleanReviewComment(comment: string | null | undefined): string {
  if (!comment) return '';
  return comment
    .replace(/\s*\((?:Translated by Google|Traduzido pelo Google|Translated by tripadvisor|Traduzido pelo Tripadvisor)[\s\S]*/i, '')
    .trim();
}

export function ReviewCard({ reviews }: ReviewCardProps) {
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!reviews || reviews.length === 0) {
    return (
      <div className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-4">
          <h3 className="text-base font-bold text-white">Últimas Avaliações</h3>
        </div>
        <div className="py-8 text-center text-xs text-white/40">Nenhuma avaliação registrada ainda.</div>
      </div>
    );
  }

  const renderStars = (rating: number) => {
    const full = '★'.repeat(rating);
    const empty = '☆'.repeat(5 - rating);
    return `${full}${empty}`;
  };

  return (
    <div className="space-y-4 rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all">
      <div className="flex items-center justify-between border-b border-white/8 pb-4">
        <h3 className="text-base font-bold text-white">Últimas Avaliações</h3>
        <Link href="/avaliacoes" className="text-xs font-semibold text-amber-300 transition-colors hover:text-amber-200 hover:underline">
          Ver todas →
        </Link>
      </div>

      <div className="space-y-3">
        {reviews.map((rev) => {
          const cleanedText = cleanReviewComment(rev.comment) || 'Sem comentário';
          const isLong = cleanedText.length > 100;
          const isExpanded = !!expandedIds[rev.id];
          const isLowRating = rev.rating <= 2;
          const isMidRating = rev.rating === 3;

          return (
            <div
              key={rev.id}
              className={`rounded-xl border p-3.5 transition-all ${
                isLowRating
                  ? 'border-l-4 border-l-red-500 border-red-500/35 bg-red-500/[0.04]'
                  : isMidRating
                    ? 'border-l-4 border-l-amber-400 border-amber-500/30 bg-amber-500/[0.035]'
                    : 'border-white/8 bg-white/[0.03] hover:border-white/18'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-amber-400 text-xs font-bold text-white shadow-xs">
                    {rev.reviewerName ? rev.reviewerName[0].toUpperCase() : 'A'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-tight text-white">{rev.reviewerName}</h4>
                    <span className="text-[11px] text-white/40">
                      {new Date(rev.publishedAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className={`text-xs font-bold tracking-tight ${rev.rating >= 4 ? 'text-emerald-400' : rev.rating === 3 ? 'text-amber-400' : 'text-red-400'}`}>
                  {renderStars(rev.rating)}
                </div>
              </div>

              <div className="mt-2 text-xs leading-relaxed text-white/80">
                <p className={!isExpanded && isLong ? 'line-clamp-2' : ''}>&quot;{cleanedText}&quot;</p>
                {isLong && (
                  <button onClick={() => toggleExpand(rev.id)} className="mt-1 inline-block cursor-pointer text-[11px] font-bold text-amber-300 hover:underline">
                    {isExpanded ? 'Ver menos ↑' : 'Ver mais →'}
                  </button>
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-white/8 pt-2">
                {rev.status === 'RESPONDED' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <span>✓</span> Respondida
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    <span>⏳</span> Aguardando resposta
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
