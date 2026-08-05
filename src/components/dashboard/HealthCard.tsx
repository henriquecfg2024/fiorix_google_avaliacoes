import React from 'react';
import Link from 'next/link';
import { GaugeChart } from './GaugeChart';

export function HealthCard() {
  // Os 10 Indicadores da Saúde da Reputação (ordenados por pontuação)
  const indicadores = [
    { icon: '🕘', nome: 'Horário de Atendimento', pct: 96, color: '#10b981', gradient: 'linear-gradient(90deg,#10b981,#3b82f6)' },
    { icon: '💳', nome: 'Pagamento', pct: 93, color: '#10b981' },
    { icon: '🤝', nome: 'Qualidade de Atendimento', pct: 91, color: '#10b981' },
    { icon: '💡', nome: 'Clareza de Informações', pct: 88, color: '#10b981' },
    { icon: '🌟', nome: 'Índice de Recomendação', pct: 85, color: '#2563eb' },
    { icon: '🎯', nome: 'Resolução no 1º Contato', pct: 82, color: '#2563eb' },
    { icon: '📄', nome: 'Documentação', pct: 59, color: '#2563eb' },
    { icon: '🌐', nome: 'Site / Agendamento', pct: 42, color: '#d97706' },
    { icon: '⏱️', nome: 'Prazo de Entrega', pct: 22, color: '#dc2626' },
    { icon: '🕐', nome: 'Fila / Espera', pct: 18, color: '#dc2626' },
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
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>10 Indicadores</span>
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

      {/* ═══ LISTA PERFEITAMENTE ALINHADA DOS 10 INDICADORES ═══ */}
      <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {indicadores.map((ind, idx) => {
          const isBiLink = ind.nome === 'Prazo de Entrega';
          const cardContent = (
            <div 
              key={idx} 
              style={{ 
                background: isBiLink ? '#fef2f2' : '#f8fafc', 
                border: isBiLink ? '1px solid #fca5a5' : '1px solid #e2e8f0', 
                borderRadius: '10px', 
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                transition: 'all 0.2s ease',
                cursor: isBiLink ? 'pointer' : 'default',
              }}
            >
              {/* Linha de Texto: Nome do Indicador na esquerda ... % com destaque na direita */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{ind.icon}</span>
                  <span>{ind.nome} {isBiLink && <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 800, background: '#fee2e2', padding: '1px 5px', borderRadius: '4px' }}>VER BI →</span>}</span>
                </span>
                <span style={{ 
                  fontSize: '12.5px', 
                  fontWeight: '800', 
                  color: ind.color,
                  background: `${ind.color}15`,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap'
                }}>
                  {ind.pct}%
                </span>
              </div>

              {/* Barra de Progresso */}
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden', width: '100%' }}>
                <div 
                  style={{ 
                    width: `${ind.pct}%`, 
                    background: ind.gradient || ind.color,
                    height: '100%',
                    borderRadius: '99px'
                  }}
                />
              </div>
            </div>
          );

          if (isBiLink) {
            return (
              <Link key={idx} href="/admin/bi" style={{ textDecoration: 'none' }}>
                {cardContent}
              </Link>
            );
          }

          return cardContent;
        })}
      </div>
    </div>
  );
}
