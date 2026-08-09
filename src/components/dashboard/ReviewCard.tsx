import React from 'react';
import { formatDate } from '@/lib/format';

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
  if (!reviews || reviews.length === 0) {
    return (
      <div className="review-card">
        <div className="review-header">
          <span className="review-title">Últimas Avaliações</span>
        </div>
        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
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
    <div className="review-card">
      <div className="review-header">
        <span className="review-title">Últimas Avaliações</span>
        <a className="view-all" href="/avaliacoes">Ver todas →</a>
      </div>

      {reviews.map((rev) => (
        <div className="review-item" key={rev.id}>
          <div className="review-top">
            <div className="review-author">
              <div className="review-avatar" style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>
                {rev.reviewerName ? rev.reviewerName[0].toUpperCase() : 'A'}
              </div>
              <div>
                <div className="review-name">{rev.reviewerName}</div>
                <div className="review-time">
                  {formatDate(rev.publishedAt)}
                </div>
              </div>
            </div>
            <div className={`stars ${rev.rating >= 4 ? 'five' : 'three'}`} style={{ color: rev.rating >= 4 ? '#22c55e' : '#f59e0b' }}>
              {renderStars(rev.rating)}
            </div>
          </div>
          <div className="review-text">"{cleanReviewComment(rev.comment) || 'Sem comentário'}"</div>
          <div className="review-bottom">
            {rev.status === 'RESPONDED' ? (
              <span className="review-badge badge-auto">✓ Respondida</span>
            ) : (
              <span className="review-badge badge-pending">⏳ Aguardando resposta</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
