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
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
          <h3 className="text-base font-bold text-slate-900">Últimas Avaliações</h3>
        </div>
        <div className="text-center py-8 text-slate-500 text-xs">
          Nenhuma avaliação registrada ainda.
        </div>
      </div>
    );
  }

  const renderStars = (rating: number) => {
    const full = '★'.repeat(rating);
    const empty = '☆'.repeat(5 - rating);
    return `${full}${empty}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all space-y-4">
      {/* HEADER */}
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <h3 className="text-base font-bold text-slate-900">Últimas Avaliações</h3>
        <Link
          href="/avaliacoes"
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          Ver todas →
        </Link>
      </div>

      {/* FEED ITEMS */}
      <div className="space-y-3">
        {reviews.map((rev) => {
          const cleanedText = cleanReviewComment(rev.comment) || 'Sem comentário';
          const isLong = cleanedText.length > 100;
          const isExpanded = !!expandedIds[rev.id];
          const isLowRating = rev.rating <= 2;

          return (
            <div
              key={rev.id}
              className={`p-3.5 rounded-xl border transition-all ${
                isLowRating
                  ? 'bg-amber-50/40 border-amber-200 border-l-4 border-l-amber-400'
                  : 'bg-slate-50/60 border-slate-100 hover:bg-slate-50'
              }`}
            >
              {/* TOP ROW: AUTHOR + STARS */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0">
                    {rev.reviewerName ? rev.reviewerName[0].toUpperCase() : 'A'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">
                      {rev.reviewerName}
                    </h4>
                    <span className="text-[11px] text-slate-400">
                      {new Date(rev.publishedAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                <div
                  className={`text-xs font-bold tracking-tight ${
                    rev.rating >= 4 ? 'text-emerald-600' : 'text-amber-500'
                  }`}
                >
                  {renderStars(rev.rating)}
                </div>
              </div>

              {/* COMMENT TEXT */}
              <div className="mt-2 text-xs text-slate-600 leading-relaxed">
                <p className={!isExpanded && isLong ? 'line-clamp-2' : ''}>
                  "{cleanedText}"
                </p>
                {isLong && (
                  <button
                    onClick={() => toggleExpand(rev.id)}
                    className="mt-1 text-[11px] font-bold text-blue-600 hover:underline inline-block cursor-pointer"
                  >
                    {isExpanded ? 'Ver menos ↑' : 'Ver mais →'}
                  </button>
                )}
              </div>

              {/* BOTTOM BADGE */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/50 flex items-center justify-between">
                {rev.status === 'RESPONDED' ? (
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <span>✓</span> Respondida
                  </span>
                ) : (
                  <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
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

