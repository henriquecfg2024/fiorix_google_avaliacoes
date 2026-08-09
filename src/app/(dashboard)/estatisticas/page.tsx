import React from 'react';
import { percentOf } from '@/lib/format';
import {
  INDICADORES_REPUTACAO,
  IndicadorTone,
  SAUDE_REPUTACAO,
  SOMA_SCORE_REPUTACAO,
} from '@/lib/reputacao';
import { getRatingDistribution } from '@/lib/review-stats';
import { getTenantIdOrDefault } from '@/lib/tenant';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const CORES_INDICADOR: Record<IndicadorTone, string> = {
  green: '#10b981',
  blue: '#3b82f6',
  amber: '#f59e0b',
  red: '#ef4444',
};

export default async function EstatisticasPage() {
  const tenantId = await getTenantIdOrDefault();
  const { total: totalReviews, byRating } = await getRatingDistribution(
    tenantId,
    'Error loading estatisticas:'
  );

  const getPercent = (count: number) => percentOf(count, totalReviews);

  return (
    <div className="layout" style={{ gridTemplateColumns: '1fr', gap: '24px' }}>
      
      {/* 📊 SEÇÃO SUPERIOR: DISTRIBUIÇÃO E ANÁLISE QUALITATIVA */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        {/* Distribuição de Notas */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Distribuição de Notas</div>
              <div className="chart-sub">Volume de avaliações separadas por número de estrelas</div>
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { label: '5 Estrelas', count: byRating[5], color: '#22c55e' },
              { label: '4 Estrelas', count: byRating[4], color: '#3b82f6' },
              { label: '3 Estrelas', count: byRating[3], color: '#f59e0b' },
              { label: '2 Estrelas', count: byRating[2], color: '#fb923c' },
              { label: '1 Estrela', count: byRating[1], color: '#ef4444' },
            ].map((item, idx) => (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '85px 1fr 100px', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{item.label}</span>
                <div style={{ background: '#f1f5f9', borderRadius: '6px', height: '10px', overflow: 'hidden' }}>
                  <div style={{ background: item.color, height: '100%', width: `${getPercent(item.count)}%`, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#1e293b', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {item.count} ({getPercent(item.count)}%)
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Análise Qualitativa por IA */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Análise Qualitativa por IA</div>
              <div className="chart-sub">Fatores operacionais mais citados nas resenhas</div>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[
              { topic: 'Horário de Atendimento e Cortesia', score: '96%', sentiment: 'Excelente', color: '#22c55e' },
              { topic: 'Formas de Pagamento e PIX', score: '93%', sentiment: 'Excelente', color: '#22c55e' },
              { topic: 'Tempo de Espera na Fila', score: '18%', sentiment: 'Crítico', color: '#ef4444' },

            ].map((topic, idx) => (
              <div key={idx} style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', borderLeft: `4px solid ${topic.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>{topic.topic}</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: topic.color }}>{topic.sentiment} ({topic.score})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ CONTAINER DETALHADO DA METODOLOGIA (10 INDICADORES) ═══ */}
      <div id="metodologia-reputacao" className="chart-card" style={{ padding: '32px' }}>
        <div className="chart-header" style={{ marginBottom: '20px' }}>
          <div>
            <div className="chart-title" style={{ fontSize: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>🎯</span> Metodologia da Saúde da Reputação (10 Indicadores)
            </div>
            <div className="chart-sub" style={{ fontSize: '14px', marginTop: '4px' }}>
              Composição detalhada do Score da Saúde da Reputação, abrangendo Saúde Operacional e Qualidade Percebida.
            </div>
          </div>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '10px 18px', borderRadius: '10px', textAlign: 'right' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#3b82f6', fontWeight: '700', letterSpacing: '0.5px' }}>Saúde Global Calculada</span>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#1d4ed8' }}>{SAUDE_REPUTACAO} <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>pts</span></div>
          </div>
        </div>

        {/* Banner com Fórmula Explicativa */}
        <div style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)', border: '1px solid #cbd5e1', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <h4 style={{ margin: '0 0 8px 0', fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>
            📐 Como é Calculado o Score Final da Saúde da Reputação?
          </h4>
          <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', color: '#334155', lineHeight: '1.6' }}>
            O score global é a <strong>média exata da soma dos 10 indicadores avaliados</strong> (incluindo os 6 pilares de Saúde Operacional):
          </p>
          <div style={{ background: 'white', padding: '12px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', fontFamily: 'monospace', fontSize: '13.5px', color: '#1e293b', display: 'inline-block' }}>
            Saúde da Reputação = ({SOMA_SCORE_REPUTACAO}) ÷ 10 = <strong>{SAUDE_REPUTACAO} Pontos</strong>
          </div>
        </div>

        {/* Grid com os 10 Indicadores */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {INDICADORES_REPUTACAO.map((ind, idx) => {
            const cor = CORES_INDICADOR[ind.tone];

            return (
            <div 
              key={idx} 
              style={{ 
                background: 'white', 
                border: '1px solid #e2e8f0', 
                borderRadius: '12px', 
                padding: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontSize: '14.5px', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{ind.icon}</span> {ind.nome}
                  </span>
                  <span style={{ 
                    fontSize: '13.5px', 
                    fontWeight: '800', 
                    color: cor,
                    background: `${cor}15`,
                    padding: '2px 10px',
                    borderRadius: '6px'
                  }}>
                    {ind.score}%
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: '#64748b', margin: 0, lineHeight: '1.4' }}>
                  {ind.desc}
                </p>
              </div>

              <div style={{ marginTop: '12px' }}>
                <div style={{ background: '#f1f5f9', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                  <div style={{ background: cor, height: '100%', width: `${ind.score}%` }} />
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {/* Esclarecimento sobre Taxa de Resposta */}
        <div style={{ padding: '16px 20px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '10px', color: '#722ed1', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '20px' }}>💡</span>
          <div style={{ fontSize: '13px', lineHeight: '1.5', color: '#531dab' }}>
            <strong>Por que a "Taxa de Resposta" NÃO entra no cálculo de Saúde da Reputação?</strong><br />
            A <em>Taxa de Resposta</em> é um indicador de SLA administrativo interno (produtividade em dar retorno). A <strong>Saúde da Reputação</strong> mede exclusivamente os 10 fatores que impactam a experiência real do cidadão no cartório.
          </div>
        </div>

      </div>

    </div>
  );
}
