import React from 'react';

export function ReviewCard() {
  return (
    <div className="review-card">
      <div className="review-header">
        <span className="review-title">Últimas Avaliações</span>
        <a className="view-all">Ver todas →</a>
      </div>

      <div className="review-item">
        <div className="review-top">
          <div className="review-author">
            <div className="review-avatar" style={{ background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)' }}>W</div>
            <div>
              <div className="review-name">Walquiron Alves</div>
              <div className="review-time">Há 4 dias · 2 avaliações</div>
            </div>
          </div>
          <div className="stars five">★★★★★</div>
        </div>
        <div className="review-text">"Excelente atendimento, Sr. Lucas, esclareceu as dúvidas, só tenho a agradecer!!!"</div>
        <div className="review-bottom">
          <span className="review-badge badge-auto">✓ Respondida automaticamente</span>
          <span className="review-badge badge-mention">👤 Lucas</span>
        </div>
      </div>

      <div className="review-item">
        <div className="review-top">
          <div className="review-author">
            <div className="review-avatar" style={{ background: 'linear-gradient(135deg,#10d9a0,#3b82f6)' }}>G</div>
            <div>
              <div className="review-name">Glória Gomes</div>
              <div className="review-time">Há 4 dias · Local Guide</div>
            </div>
          </div>
          <div className="stars five">★★★★★</div>
        </div>
        <div className="review-text">"Gostaria de registrar meu agradecimento pelo excelente atendimento prestado pelo Lucas."</div>
        <div className="review-bottom">
          <span className="review-badge badge-auto">✓ Respondida automaticamente</span>
          <span className="review-badge badge-mention">👤 Lucas</span>
        </div>
      </div>

      <div className="review-item">
        <div className="review-top">
          <div className="review-author">
            <div className="review-avatar" style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>M</div>
            <div>
              <div className="review-name">Maria Santos</div>
              <div className="review-time">Há 6 dias · 8 avaliações</div>
            </div>
          </div>
          <div className="stars three" style={{ color: 'var(--amber)' }}>★★★☆☆</div>
        </div>
        <div className="review-text">"Atendimento ok mas a fila estava absurda. Esperei 1h20min para ser chamado."</div>
        <div className="review-bottom">
          <span className="review-badge badge-pending">⏳ Aguardando resposta</span>
          <span className="review-badge" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--red)' }}>⚠️ Fila</span>
        </div>
      </div>
    </div>
  );
}
