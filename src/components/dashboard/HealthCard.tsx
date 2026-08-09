import React from 'react';
import Link from 'next/link';
import {
  classificarSaude,
  INDICADORES_REPUTACAO,
  IndicadorTone,
  SAUDE_REPUTACAO,
} from '@/lib/reputacao';
import { GaugeChart } from './GaugeChart';

const CORES_INDICADOR: Record<IndicadorTone, string> = {
  green: '#10b981',
  blue: '#2563eb',
  amber: '#d97706',
  red: '#dc2626',
};

const GRADIENTE_TOPO = 'linear-gradient(90deg,#10b981,#3b82f6)';

export function HealthCard() {
  const saudeReputacao = SAUDE_REPUTACAO;

  return (
    <div className="health-card" style={{ padding: '24px 20px' }}>
      <div className="health-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Saúde da Reputação</span>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', background: '#f1f5f9', padding: '2px 8px', borderRadius: '12px' }}>10 Indicadores</span>
      </div>
      
      <GaugeChart score={saudeReputacao} />
      
      <div className="health-score-display">{saudeReputacao}</div>
      <div className="health-score-label">
        pontos de 100 — {classificarSaude(saudeReputacao)}
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
        {INDICADORES_REPUTACAO.map((ind, idx) => {
          const isBiLink = ind.nome === 'Prazo de Entrega';
          const cor = CORES_INDICADOR[ind.tone];
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
                  <span>{ind.nomeCurto} {isBiLink && <span style={{ fontSize: '10px', color: '#dc2626', fontWeight: 800, background: '#fee2e2', padding: '1px 5px', borderRadius: '4px' }}>VER BI →</span>}</span>
                </span>
                <span style={{ 
                  fontSize: '12.5px', 
                  fontWeight: '800', 
                  color: cor,
                  background: `${cor}15`,
                  padding: '2px 8px',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap'
                }}>
                  {ind.score}%
                </span>
              </div>

              {/* Barra de Progresso */}
              <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '99px', overflow: 'hidden', width: '100%' }}>
                <div 
                  style={{ 
                    width: `${ind.score}%`, 
                    background: idx === 0 ? GRADIENTE_TOPO : cor,
                    height: '100%',
                    borderRadius: '99px'
                  }}
                />
              </div>
            </div>
          );

          if (isBiLink) {
            return (
              <Link key={idx} href="/bi" style={{ textDecoration: 'none' }}>
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
