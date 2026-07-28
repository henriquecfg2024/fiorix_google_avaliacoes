import React from 'react';

export function OpHealthCard() {
  return (
    <div className="op-card">
      <div className="op-title">Saúde Operacional</div>

      <div className="op-item">
        <div className="op-row">
          <span className="op-name">🕐 Fila / Espera</span>
          <span className="op-pct" style={{ color: 'var(--red)' }}>18%</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: '18%', background: 'var(--red)' }}></div>
        </div>
      </div>
      <div className="op-item">
        <div className="op-row">
          <span className="op-name">🌐 Site / Agendamento</span>
          <span className="op-pct" style={{ color: 'var(--amber)' }}>42%</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: '42%', background: 'var(--amber)' }}></div>
        </div>
      </div>
      <div className="op-item">
        <div className="op-row">
          <span className="op-name">💳 Pagamento</span>
          <span className="op-pct" style={{ color: 'var(--green)' }}>93%</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: '93%', background: 'var(--green)' }}></div>
        </div>
      </div>
      <div className="op-item">
        <div className="op-row">
          <span className="op-name">🕘 Horário de Atendimento</span>
          <span className="op-pct" style={{ color: 'var(--green)' }}>96%</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: '96%', background: 'linear-gradient(90deg,var(--green),var(--blue))' }}></div>
        </div>
      </div>
      <div className="op-item">
        <div className="op-row">
          <span className="op-name">📄 Documentação</span>
          <span className="op-pct" style={{ color: 'var(--blue)' }}>59%</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: '59%', background: 'var(--blue)' }}></div>
        </div>
      </div>
      <div className="op-item">
        <div className="op-row">
          <span className="op-name">⏱️ Prazo de Entrega</span>
          <span className="op-pct" style={{ color: 'var(--red)' }}>22%</span>
        </div>
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{ width: '22%', background: 'var(--red)' }}></div>
        </div>
      </div>
    </div>
  );
}
