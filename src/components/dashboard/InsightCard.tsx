import React from 'react';

export function InsightCard() {
  return (
    <div className="insight-card">
      <div className="insight-header">
        <span className="insight-icon">🤖</span>
        <span className="insight-label">INSIGHT DA IA</span>
      </div>
      
      <div className="insight-text" style={{ fontSize: '13.5px', lineHeight: '1.6', marginBottom: '14px' }}>
        Menções sobre <strong style={{ color: 'var(--purple)', fontWeight: '700' }}>"tempo de espera na fila"</strong> registraram atenção de <strong style={{ color: '#ef4444', fontWeight: '700' }}>+40%</strong> este mês. Recomendamos otimizar a triagem inicial de atendimento.
      </div>
      
      <div className="insight-list" style={{ gap: '10px' }}>
        <div className="insight-item">
          <div className="dot"></div>
          <span><strong>Elogio em Destaque:</strong> Escrevente <strong>Lucas</strong> foi citado positivamente em <strong>47 avaliações</strong> este mês.</span>
        </div>
        <div className="insight-item">
          <div className="dot"></div>
          <span><strong>Padrão Semanal:</strong> Avaliações de segunda-feira têm nota média <strong>0,4★ menor</strong> que outros dias.</span>
        </div>
        <div className="insight-item">
          <div className="dot"></div>
          <span><strong>Fator Crítico:</strong> Sistema de agendamento online citado em <strong>70% das avaliações de 3★</strong>.</span>
        </div>
      </div>
    </div>
  );
}
