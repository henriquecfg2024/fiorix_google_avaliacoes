import React from 'react';

interface OpHealthItem {
  id: string;
  name: string;
  pct: number;
  color: string;
  gradient?: string;
}

export function OpHealthCard() {
  const items: OpHealthItem[] = [
    { id: '1', name: '🕐 Fila / Espera', pct: 18, color: 'var(--red)' },
    { id: '2', name: '🌐 Site / Agendamento', pct: 42, color: 'var(--amber)' },
    { id: '3', name: '💳 Pagamento', pct: 93, color: 'var(--green)' },
    { id: '4', name: '🕘 Horário de Atendimento', pct: 96, color: 'var(--green)', gradient: 'linear-gradient(90deg,var(--green),var(--blue))' },
    { id: '5', name: '📄 Documentação', pct: 59, color: 'var(--blue)' },
    { id: '6', name: '⏱️ Prazo de Entrega', pct: 22, color: 'var(--red)' },
  ];

  // Sort descending by percentage (highest health to lowest)
  const sortedItems = [...items].sort((a, b) => b.pct - a.pct);

  return (
    <div className="op-card">
      <div className="op-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Saúde Operacional</span>
        <span style={{ fontSize: '11px', fontWeight: '500', color: '#94a3b8' }}>Ordenado por %</span>
      </div>

      {sortedItems.map((item) => (
        <div className="op-item" key={item.id}>
          <div className="op-row">
            <span className="op-name">{item.name}</span>
            <span className="op-pct" style={{ color: item.color }}>{item.pct}%</span>
          </div>
          <div className="progress-bar-bg">
            <div 
              className="progress-bar-fill" 
              style={{ 
                width: `${item.pct}%`, 
                background: item.gradient || item.color 
              }}
            ></div>
          </div>
        </div>
      ))}
    </div>
  );
}
