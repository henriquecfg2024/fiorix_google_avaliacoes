import React from 'react';
import { INDICADORES_OPERACIONAIS, IndicadorTone } from '@/lib/reputacao';

const CORES_INDICADOR: Record<IndicadorTone, string> = {
  green: 'var(--green)',
  blue: 'var(--blue)',
  amber: 'var(--amber)',
  red: 'var(--red)',
};

const GRADIENTE_TOPO = 'linear-gradient(90deg,var(--green),var(--blue))';

export function OpHealthCard() {
  // Ordenado da maior para a menor saúde operacional
  const items = [...INDICADORES_OPERACIONAIS].sort((a, b) => b.score - a.score);

  return (
    <div className="op-card">
      <div className="op-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Saúde Operacional</span>
        <span style={{ fontSize: '11px', fontWeight: '500', color: '#94a3b8' }}>Ordenado por %</span>
      </div>

      {items.map((item, idx) => {
        const cor = CORES_INDICADOR[item.tone];

        return (
          <div className="op-item" key={item.nome}>
            <div className="op-row">
              <span className="op-name">{item.icon} {item.nomeCurto}</span>
              <span className="op-pct" style={{ color: cor }}>{item.score}%</span>
            </div>
            <div className="progress-bar-bg">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${item.score}%`,
                  background: idx === 0 ? GRADIENTE_TOPO : cor,
                }}
              ></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
