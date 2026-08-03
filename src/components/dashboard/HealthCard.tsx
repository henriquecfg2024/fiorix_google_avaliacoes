import React from 'react';
import Link from 'next/link';
import { GaugeChart } from './GaugeChart';

export function HealthCard() {
  // Os 10 Indicadores da Saúde da Reputação (ordenados por pontuação)
  const indicadores = [
    { icon: '🕘', nome: 'Horário de Atendimento', pct: 96, color: 'var(--green)', gradient: 'linear-gradient(90deg,var(--green),var(--blue))' },
    { icon: '💳', nome: 'Pagamento', pct: 93, color: 'var(--green)' },
    { icon: '🤝', nome: 'Qualidade de Atendimento', pct: 91, color: 'var(--green)' },
    { icon: '💡', nome: 'Clareza de Informações', pct: 88, color: 'var(--green)' },
    { icon: '🌟', nome: 'Índice de Recomendação', pct: 85, color: 'var(--blue)' },
    { icon: '🎯', nome: 'Resolução no 1º Contato', pct: 82, color: 'var(--blue)' },
    { icon: '📄', nome: 'Documentação', pct: 59, color: 'var(--blue)' },
    { icon: '🌐', nome: 'Site / Agendamento', pct: 42, color: 'var(--amber)' },
    { icon: '⏱️', nome: 'Prazo de Entrega', pct: 22, color: 'var(--red)' },
    { icon: '🕐', nome: 'Fila / Espera', pct: 18, color: 'var(--red)' },
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
    <div className="health-card" style={{ padding: '24px 20px' }}>
      <div className="health-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Saúde da Reputação</span>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500' }}>10 Indicadores</span>
      </div>
      
      <GaugeChart score={saudeReputacao} />
      
      <div className="health-score-display">{saudeReputacao}</div>
      <div className="health-score-label">
        pontos de 100 — {getClassification(saudeReputacao)}
      </div>

      <div style={{ textAlign: 'center', marginTop: '8px', marginBottom: '20px' }}>
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
          ℹ️ Metodologia e Detalhes ({saudeReputacao} pts) →
        </Link>
      </div>

      {/* ═══ LISTA EXPANDIDA DOS 10 INDICADORES NA HOME ═══ */}
      <div className="mini-metrics" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {indicadores.map((ind, idx) => (
          <div className="mini-metric" key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>{ind.icon}</span> {ind.nome}
              </span>
              <span style={{ fontSize: '12.5px', fontWeight: '700', color: ind.color }}>
                {ind.pct}%
              </span>
            </div>
            <div className="progress-bar-bg" style={{ height: '7px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div 
                className="progress-bar-fill" 
                style={{ 
                  width: `${ind.pct}%`, 
                  background: ind.gradient || ind.color,
                  height: '100%',
                  borderRadius: '4px'
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
