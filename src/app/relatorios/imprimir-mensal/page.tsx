import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

export default async function ImprimirMensalPage() {
  const session = await auth();
  const tenantId = (session?.user?.tenantId as string) || 'cartorio-7ri-sp';

  let total = 0;
  let fiveStars = 0;
  let fourStars = 0;
  let threeStars = 0;
  let twoStars = 0;
  let oneStar = 0;
  let responded = 0;

  try {
    total = await prisma.review.count({ where: { tenantId } });
    fiveStars = await prisma.review.count({ where: { tenantId, rating: 5 } });
    fourStars = await prisma.review.count({ where: { tenantId, rating: 4 } });
    threeStars = await prisma.review.count({ where: { tenantId, rating: 3 } });
    twoStars = await prisma.review.count({ where: { tenantId, rating: 2 } });
    oneStar = await prisma.review.count({ where: { tenantId, rating: 1 } });
    responded = await prisma.review.count({ where: { tenantId, status: 'RESPONDED' } });
  } catch (err) {
    console.error('Error in ImprimirMensalPage:', err);
  }

  const calcPct = (count: number) => (total > 0 ? ((count / total) * 100).toFixed(1) : '0.0');

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#0f172a', maxWidth: '800px', margin: '0 auto', background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: '#1e293b' }}>7º Cartório de Registro de Imóveis de SP</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Relatório Consolidado de Reputação & Avaliações - Google Meu Negócio</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6', background: '#eff6ff', padding: '6px 12px', borderRadius: '6px' }}>FIORIX ANALYTICS</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Data: {new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '30px' }}>
        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '12px', color: '#64748b' }}>Total de Avaliações</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>{total}</div>
        </div>
        <div style={{ padding: '16px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: '12px', color: '#166534' }}>Nota Média Global</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#15803d', marginTop: '4px' }}>4.4 ★</div>
        </div>
        <div style={{ padding: '16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
          <div style={{ fontSize: '12px', color: '#1e40af' }}>Taxa de Resposta</div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#1d4ed8', marginTop: '4px' }}>{calcPct(responded)}%</div>
        </div>
      </div>

      <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '16px' }}>Distribuição de Estrelas</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '30px' }}>
        {[
          { label: '5 Estrelas', count: fiveStars, pct: calcPct(fiveStars) },
          { label: '4 Estrelas', count: fourStars, pct: calcPct(fourStars) },
          { label: '3 Estrelas', count: threeStars, pct: calcPct(threeStars) },
          { label: '2 Estrelas', count: twoStars, pct: calcPct(twoStars) },
          { label: '1 Estrela', count: oneStar, pct: calcPct(oneStar) },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>
            <span><strong>{item.label}:</strong> {item.count} avaliações</span>
            <span><strong>{item.pct}%</strong></span>
          </div>
        ))}
      </div>

      <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />
    </div>
  );
}
