import React from 'react';
import { GaugeChart } from './GaugeChart';

export function HealthCard() {
  return (
    <div className="health-card">
      <div className="health-label">Saúde da Reputação</div>
      <GaugeChart />
      <div className="health-score-display">82</div>
      <div className="health-score-label">pontos de 100 — Muito Bom</div>

      <div className="mini-metrics" style={{ marginTop: 18 }}>
        <div className="mini-metric">
          <div className="mini-metric-left">
            <span className="mini-metric-name">Qualidade de Atendimento</span>
            <div className="progress-bar-wrap">
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: '91%', background: 'linear-gradient(90deg,#10d9a0,#3b82f6)' }}></div>
              </div>
            </div>
          </div>
          <div className="mini-metric-right">
            <span className="mini-score" style={{ color: 'var(--green)' }}>91</span>
            <span className="trend" style={{ color: 'var(--green)' }}>↑</span>
          </div>
        </div>
        
        <div className="mini-metric">
          <div className="mini-metric-left">
            <span className="mini-metric-name">Eficiência Operacional</span>
            <div className="progress-bar-wrap">
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: '63%', background: 'linear-gradient(90deg,#f59e0b,#ef4444)' }}></div>
              </div>
            </div>
          </div>
          <div className="mini-metric-right">
            <span className="mini-score" style={{ color: 'var(--amber)' }}>63</span>
            <span className="trend" style={{ color: 'var(--red)' }}>↓</span>
          </div>
        </div>

        <div className="mini-metric">
          <div className="mini-metric-left">
            <span className="mini-metric-name">Taxa de Resposta</span>
            <div className="progress-bar-wrap">
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: '100%', background: 'linear-gradient(90deg,#8b5cf6,#3b82f6)' }}></div>
              </div>
            </div>
          </div>
          <div className="mini-metric-right">
            <span className="mini-score" style={{ color: 'var(--blue)' }}>100</span>
            <span className="trend" style={{ color: 'var(--green)' }}>↑</span>
          </div>
        </div>
      </div>
    </div>
  );
}
