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
      <div className="rounded-[28px] border border-white/10 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-base font-bold text-white">Últimas Avaliações</h3>
        </div>
        <div className="py-8 text-center text-xs text-slate-400">Nenhuma avaliação registrada ainda.</div>
      </div>
    );
  }

  const renderStars = (rating: number) => {
    const full = '★'.repeat(rating);
    const empty = '☆'.repeat(5 - rating);
    return `${full}${empty}`;
  };

  return (
    <div className="space-y-4 rounded-[28px] border border-white/10 bg-[#0B1020]/72 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <h3 className="text-base font-bold text-white">Últimas Avaliações</h3>
        <Link href="/avaliacoes" className="text-xs font-semibold text-cyan-300 transition-colors hover:text-cyan-200 hover:underline">
          Ver todas →
        </Link>
      </div>

      <div className="space-y-3">
        {reviews.map((rev) => {
          const cleanedText = cleanReviewComment(rev.comment) || 'Sem comentário';
          const isLong = cleanedText.length > 100;
          const isExpanded = !!expandedIds[rev.id];
          const isLowRating = rev.rating <= 2;

          return (
            <div
              key={rev.id}
              className={`rounded-xl border p-3.5 transition-all ${
                isLowRating
                  ? 'border-l-4 border-l-amber-400 border-amber-400/35 bg-amber-500/[0.05]'
                  : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-xs font-bold text-white">
                    {rev.reviewerName ? rev.reviewerName[0].toUpperCase() : 'A'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold leading-tight text-white">{rev.reviewerName}</h4>
                    <span className="text-[11px] text-slate-400">
                      {new Date(rev.publishedAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div className={`text-xs font-bold tracking-tight ${rev.rating >= 4 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {renderStars(rev.rating)}
                </div>
              </div>

              <div className="mt-2 text-xs leading-relaxed text-slate-300">
                <p className={!isExpanded && isLong ? 'line-clamp-2' : ''}>&quot;{cleanedText}&quot;</p>
                {isLong && (
                  <button onClick={() => toggleExpand(rev.id)} className="mt-1 inline-block cursor-pointer text-[11px] font-bold text-cyan-300 hover:underline">
                    {isExpanded ? 'Ver menos ↑' : 'Ver mais →'}
                  </button>
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-between border-t border-white/10 pt-2">
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
