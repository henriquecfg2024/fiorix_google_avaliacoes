'use client';

import React, { useState } from 'react';
import { generateAiResponse, sendReviewResponse } from '@/app/actions/reviews';

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

export function ReviewItemCard({ review }: ReviewItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const renderStars = (rating: number) => {
    const full = '★'.repeat(rating);
    const empty = '☆'.repeat(5 - rating);
    return `${full}${empty}`;
  };

  const handleOpenModal = async () => {
    setIsOpen(true);
    if (review.status === 'RESPONDED' && review.response?.content) {
      setResponseText(review.response.content);
    } else {
      setIsGenerating(true);
      try {
        const cleanedComment = cleanReviewComment(review.comment);
        const aiDraft = await generateAiResponse(review.reviewerName, review.rating, cleanedComment);
        setResponseText(aiDraft);
      } catch (err) {
        setResponseText(`Prezado(a) ${review.reviewerName}, agradecemos sua avaliação!`);
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    try {
      await sendReviewResponse(review.id, responseText);
      setIsOpen(false);
    } catch (err) {
      alert('Erro ao enviar resposta.');
    } finally {
      setIsSending(false);
    }
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
      <div style={{
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '20px',
        background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 'bold',
              fontSize: '16px',
              flexShrink: 0
            }}>
              {review.reviewerName ? review.reviewerName[0].toUpperCase() : 'A'}
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '15px', color: '#1e293b' }}>{review.reviewerName}</div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                {formatDate(review.publishedAt)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{
              color: review.rating >= 4 ? '#16a34a' : review.rating === 3 ? '#d97706' : '#dc2626',
              fontSize: '16px',
              letterSpacing: '2px'
            }}>
              {renderStars(review.rating)}
            </span>
            <span style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: '600',
              background: review.status === 'RESPONDED' ? '#dcfce7' : '#fef3c7',
              color: review.status === 'RESPONDED' ? '#166534' : '#92400e',
            }}>
              {review.status === 'RESPONDED' ? '✓ Respondida' : '⏳ Aguardando resposta'}
            </span>
          </div>
        </div>

        <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.5', margin: '12px 0 16px 0', background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          "{cleanReviewComment(review.comment) || 'Sem comentário por extenso.'}"
        </p>

        {review.status === 'RESPONDED' && review.response?.content && (
          <div style={{ margin: '12px 0', padding: '12px 16px', background: '#f0fdf4', borderRadius: '8px', borderLeft: '4px solid #16a34a', fontSize: '13px', color: '#166534', wordBreak: 'break-word' }}>
            <strong>Resposta Enviada:</strong> {review.response.content}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', wordBreak: 'break-all', maxWidth: '100%' }}>
            ID Google: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', wordBreak: 'break-all', display: 'inline-block', maxWidth: '100%' }}>{review.googleId || review.id}</code>
          </div>

          <button 
            onClick={handleOpenModal}
            style={{
              background: review.status === 'RESPONDED' ? '#f1f5f9' : '#3b82f6',
              color: review.status === 'RESPONDED' ? '#475569' : 'white',
              border: review.status === 'RESPONDED' ? '1px solid #cbd5e1' : 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {review.status === 'RESPONDED' ? '✏️ Ver / Editar Resposta' : '💬 Responder com IA'}
          </button>
        </div>
      </div>

      {/* MODAL OVERLAY */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                🤖 Resposta com Inteligência Artificial
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: '#475569' }}>
              <strong>Avaliação de {review.reviewerName} ({review.rating}★):</strong> "{review.comment || 'Sem comentário'}"
            </div>

            <form onSubmit={handleSubmitResponse}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#1e293b' }}>
                  Sugestão de Resposta Gerada por IA:
                </label>
                <textarea
                  rows={5}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  disabled={isGenerating}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical',
                    lineHeight: '1.5',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  style={{
                    background: '#f1f5f9',
                    color: '#475569',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSending || isGenerating}
                  style={{
                    background: '#2563eb',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: (isSending || isGenerating) ? 'not-allowed' : 'pointer',
                    opacity: (isSending || isGenerating) ? 0.7 : 1
                  }}
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
