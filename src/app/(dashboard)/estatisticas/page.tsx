import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export default async function EstatisticasPage() {
  const session = await auth();
  const tenantId = session?.user?.tenantId as string;

  const totalReviews = await prisma.review.count({ where: { tenantId } });
  
  // Rating breakdown
  const fiveStars = await prisma.review.count({ where: { tenantId, rating: 5 } });
  const fourStars = await prisma.review.count({ where: { tenantId, rating: 4 } });
  const threeStars = await prisma.review.count({ where: { tenantId, rating: 3 } });
  const twoStars = await prisma.review.count({ where: { tenantId, rating: 2 } });
  const oneStar = await prisma.review.count({ where: { tenantId, rating: 1 } });

  const getPercent = (count: number) => (totalReviews > 0 ? ((count / totalReviews) * 100).toFixed(1) : '0.0');

  return (
    <div className="layout" style={{ gridTemplateColumns: '1fr 1fr' }}>
      {/* 📊 Distribuição de Notas */}
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <div className="chart-title">Distribuição de Notas</div>
            <div className="chart-sub">Volume de avaliações separadas por número de estrelas</div>
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { label: '5 Estrelas', count: fiveStars, color: '#22c55e' },
            { label: '4 Estrelas', count: fourStars, color: '#3b82f6' },
            { label: '3 Estrelas', count: threeStars, color: '#f59e0b' },
            { label: '2 Estrelas', count: twoStars, color: '#fb923c' },
            { label: '1 Estrela', count: oneStar, color: '#ef4444' },
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

      {/* 🤖 Análise Sentimental com Inteligência Artificial */}
      <div className="chart-card">
        <div className="chart-header">
          <div>
            <div className="chart-title">Análise Qualitativa por IA</div>
            <div className="chart-sub">Fatores operacionais mais citados nas resenhas</div>
          </div>
        </div>

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            { topic: 'Agilidade e Atendimento', score: '94%', sentiment: 'Positivo', color: '#22c55e' },
            { topic: 'Esclarecimento de Dúvidas', score: '88%', sentiment: 'Positivo', color: '#22c55e' },
            { topic: 'Tempo de Espera na Fila', score: '42%', sentiment: 'Atenção', color: '#f59e0b' },
            { topic: 'Sistema e Agendamento', score: '35%', sentiment: 'Crítico', color: '#ef4444' },
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
  );
}
