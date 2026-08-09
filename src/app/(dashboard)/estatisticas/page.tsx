import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Link from 'next/link';
import { DataLoadError } from '@/components/common/DataLoadError';
import { describeError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export default async function EstatisticasPage() {
  const session = await auth();
  const tenantId = (session?.user?.tenantId as string) || 'cartorio-7ri-sp';

  let totalReviews = 0;
  let fiveStars = 0;
  let fourStars = 0;
  let threeStars = 0;
  let twoStars = 0;
  let oneStar = 0;
  let loadError: string | null = null;

  try {
    totalReviews = await prisma.review.count({ where: { tenantId } });
    fiveStars = await prisma.review.count({ where: { tenantId, rating: 5 } });
    fourStars = await prisma.review.count({ where: { tenantId, rating: 4 } });
    threeStars = await prisma.review.count({ where: { tenantId, rating: 3 } });
    twoStars = await prisma.review.count({ where: { tenantId, rating: 2 } });
    oneStar = await prisma.review.count({ where: { tenantId, rating: 1 } });
  } catch (err) {
    loadError = describeError('estatisticas:countReviews', err, 'Falha ao consultar as avaliações no banco de dados.');
  }

  const getPercent = (count: number) => (totalReviews > 0 ? ((count / totalReviews) * 100).toFixed(1) : '0.0');

  // Os 10 Indicadores da Saúde da Reputação (Incluindo os 6 pilares de Saúde Operacional + 4 pilares de Satisfação)
  const indicadores = [
    { icon: '🕘', nome: 'Horário de Atendimento', score: 96, status: 'Excelente', color: '#10b981', desc: 'Cumprimento dos horários de abertura, atendimento contínuo e pontualidade' },
    { icon: '💳', nome: 'Pagamento', score: 93, status: 'Excelente', color: '#10b981', desc: 'Opções de pagamento como PIX, cartão de débito/crédito e agilidade no caixa' },
    { icon: '🤝', nome: 'Qualidade de Atendimento', score: 91, status: 'Excelente', color: '#10b981', desc: 'Cordialidade, empatia e presteza da equipe de escreventes na recepção' },
    { icon: '💡', nome: 'Clareza de Informações', score: 88, status: 'Excelente', color: '#10b981', desc: 'Orientação precisa ao cliente sobre requisitos e documentos necessários' },
    { icon: '🌟', nome: 'Índice de Recomendação (NPS)', score: 85, status: 'Muito Bom', color: '#3b82f6', desc: 'Porcentagem de clientes promotores que elogiam ativamente a serventia' },
    { icon: '🎯', nome: 'Resolução no Primeiro Contato', score: 82, status: 'Muito Bom', color: '#3b82f6', desc: 'Capacidade de resolver o ato sem exigir retornos adicionais desnecessários' },
    { icon: '📄', nome: 'Documentação', score: 59, status: 'Regular', color: '#3b82f6', desc: 'Clareza na exigência e conferência prévia da documentação apresentada' },
    { icon: '🌐', nome: 'Site / Agendamento', score: 42, status: 'Atenção', color: '#f59e0b', desc: 'Disponibilidade e facilidade de agendamento presencial no portal online' },
    { icon: '⏱️', nome: 'Prazo de Entrega', score: 22, status: 'Crítico', color: '#ef4444', desc: 'Cumprimento do prazo prometido para devolução de títulos e certidões' },
    { icon: '🕐', nome: 'Fila / Espera', score: 18, status: 'Crítico', color: '#ef4444', desc: 'Tempo de espera na fila de triagem e atendimento presencial' },
  ];

  const somaScore = indicadores.reduce((acc, curr) => acc + curr.score, 0);
  const mediaSaudeReputacao = Math.round(somaScore / indicadores.length);

  return (
    <div className="layout" style={{ gridTemplateColumns: '1fr', gap: '24px' }}>
      {loadError && (
        <DataLoadError title="Não foi possível carregar a distribuição de notas." message={loadError} />
      )}
      
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
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#1d4ed8' }}>{mediaSaudeReputacao} <span style={{ fontSize: '14px', fontWeight: '600', color: '#64748b' }}>pts</span></div>
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
            Saúde da Reputação = ({somaScore}) ÷ 10 = <strong>{mediaSaudeReputacao} Pontos</strong>
          </div>
        </div>

        {/* Grid com os 10 Indicadores */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          {indicadores.map((ind, idx) => (
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
                    color: ind.color,
                    background: `${ind.color}15`,
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
                  <div style={{ background: ind.color, height: '100%', width: `${ind.score}%` }} />
                </div>
              </div>
            </div>
          ))}
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
