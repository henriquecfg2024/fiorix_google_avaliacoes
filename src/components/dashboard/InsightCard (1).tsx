import React from 'react';

export function InsightCard() {
  return (
    <div className="insight-card">
      <div className="insight-header">
        <span className="insight-icon">🤖</span>
        <span className="insight-label">Insight da IA</span>
      </div>
      <div className="insight-text">
        Menções negativas sobre <strong style={{ color: '#e2e8f0' }}>fila de espera</strong> aumentaram <strong style={{ color: 'var(--red)' }}>+40%</strong> este mês. Considere revisar o processo de agendamento.
      </div>
      <div className="insight-list">
        <div className="insight-item"><div className="dot"></div>Lucas foi citado positivamente em 47 avaliações este mês</div>
        <div className="insight-item"><div className="dot"></div>Avaliações de segunda-feira têm nota média 0,4 menor</div>
        <div className="insight-item"><div className="dot"></div>Site/agendamento mencionado em 70% das avaliações de 3⭐</div>
      </div>
    </div>
  );
}
