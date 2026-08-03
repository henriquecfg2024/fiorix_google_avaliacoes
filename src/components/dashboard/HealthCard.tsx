import React from 'react';
import { GaugeChart } from './GaugeChart';

export function HealthCard() {
  const qualidade = 91;
  const eficiencia = 63;
  const taxaResposta = 100;

  // Calculo dinamico e transparente da media dos pilares
  const saudeReputacao = Math.round((qualidade + eficiencia + taxaResposta) / 3);

  const getClassification = (score: number) => {
    if (score >= 90) return 'Excelente';
    if (score >= 80) return 'Muito Bom';
    if (score >= 70) return 'Bom';
    if (score >= 50) return 'Regular';
    return 'Atenção Necessária';
  };

  return (
    <div className="health-card">
      <div className="health-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Saúde da Reputação</span>
      </div>
      
      <GaugeChart score={saudeReputacao} />
      
      <div className="health-score-display">{saudeReputacao}</div>
      <div className="health-score-label" title={`Média dos pilares: (${qualidade} + ${eficiencia} + ${taxaResposta}) ÷ 3 = ${saudeReputacao}`}>
        pontos de 100 — {getClassification(saudeReputacao)}
      </div>

      <div className="mini-metrics" style={{ marginTop: 18 }}>
        <div className="mini-metric">
          <div className="mini-metric-left">
            <span className="mini-metric-name">Qualidade de Atendimento</span>
            <div className="progress-bar-wrap">
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${qualidade}%`, background: 'linear-gradient(90deg,#10d9a0,#3b82f6)' }}></div>
              </div>
            </div>
          </div>
          <div className="mini-metric-right">
            <span className="mini-score" style={{ color: 'var(--green)' }}>{qualidade}</span>
            <span className="trend" style={{ color: 'var(--green)' }}>↑</span>
          </div>
        </div>
        
        <div className="mini-metric">
          <div className="mini-metric-left">
            <span className="mini-metric-name">Eficiência Operacional</span>
            <div className="progress-bar-wrap">
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${eficiencia}%`, background: 'linear-gradient(90deg,#f59e0b,#ef4444)' }}></div>
              </div>
            </div>
          </div>
          <div className="mini-metric-right">
            <span className="mini-score" style={{ color: 'var(--amber)' }}>{eficiencia}</span>
            <span className="trend" style={{ color: 'var(--red)' }}>↓</span>
          </div>
        </div>

        <div className="mini-metric">
          <div className="mini-metric-left">
            <span className="mini-metric-name">Taxa de Resposta</span>
            <div className="progress-bar-wrap">
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${taxaResposta}%`, background: 'linear-gradient(90deg,#8b5cf6,#3b82f6)' }}></div>
              </div>
            </div>
          </div>
          <div className="mini-metric-right">
            <span className="mini-score" style={{ color: 'var(--blue)' }}>{taxaResposta}</span>
            <span className="trend" style={{ color: 'var(--green)' }}>↑</span>
          </div>
        </div>
      </div>
    </div>
  );
}
