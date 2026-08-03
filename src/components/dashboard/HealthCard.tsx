import React from 'react';
import Link from 'next/link';
import { GaugeChart } from './GaugeChart';

export function HealthCard() {
  // Os 10 indicadores (incluindo os 6 pilares de Saúde Operacional + 4 pilares de Satisfação)
  const indicadores = [
    { nome: 'Horário de Atendimento', pct: 96, color: 'var(--green)' },
    { nome: 'Pagamento', pct: 93, color: 'var(--green)' },
    { nome: 'Qualidade de Atendimento', pct: 91, color: 'var(--green)' },
    { nome: 'Clareza de Informações', pct: 88, color: 'var(--green)' },
    { nome: 'Índice de Recomendação (NPS)', pct: 85, color: 'var(--blue)' },
    { nome: 'Resolução no 1º Contato', pct: 82, color: 'var(--blue)' },
    { nome: 'Documentação', pct: 59, color: 'var(--blue)' },
    { nome: 'Site / Agendamento', pct: 42, color: 'var(--amber)' },
    { nome: 'Prazo de Entrega', pct: 22, color: 'var(--red)' },
    { nome: 'Fila / Espera', pct: 18, color: 'var(--red)' },
  ];

  const soma = indicadores.reduce((acc, curr) => acc + curr.pct, 0);
  const saudeReputacao = Math.round(soma / indicadores.length); // 68

  const getClassification = (score: number) => {
    if (score >= 90) return 'Excelente';
    if (score >= 80) return 'Muito Bom';
    if (score >= 65) return 'Bom';
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
      <div className="health-score-label">
        pontos de 100 — {getClassification(saudeReputacao)}
      </div>

      <div style={{ textAlign: 'center', marginTop: '6px' }}>
        <Link 
          href="/estatisticas#metodologia-reputacao" 
          style={{ 
            fontSize: '12px', 
            color: '#2563eb', 
            fontWeight: '600', 
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          ℹ️ Ver a Metodologia dos 10 Indicadores ({saudeReputacao} pts) →
        </Link>
      </div>

      <div className="mini-metrics" style={{ marginTop: 16 }}>
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
      </div>
    </div>
  );
}
