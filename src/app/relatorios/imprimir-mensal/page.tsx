import React from 'react';
import { formatDate, percentOf } from '@/lib/format';
import { getRatingDistribution } from '@/lib/review-stats';
import { getTenantIdOrDefault } from '@/lib/tenant';

export const dynamic = 'force-dynamic';

export default async function ImprimirMensalPage() {
  const tenantId = await getTenantIdOrDefault();
  const { total, responded, byRating } = await getRatingDistribution(
    tenantId,
    'Error in ImprimirMensalPage:'
  );

  const calcPct = (count: number) => percentOf(count, total);

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#0f172a', maxWidth: '800px', margin: '0 auto', background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: '#1e293b' }}>7º Cartório de Registro de Imóveis de SP</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Relatório Consolidado de Reputação & Avaliações - Google Meu Negócio</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6', background: '#eff6ff', padding: '6px 12px', borderRadius: '6px' }}>FIORIX ANALYTICS</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Data: {formatDate(new Date())}</div>
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
          { label: '5 Estrelas', count: byRating[5], pct: calcPct(byRating[5]) },
          { label: '4 Estrelas', count: byRating[4], pct: calcPct(byRating[4]) },
          { label: '3 Estrelas', count: byRating[3], pct: calcPct(byRating[3]) },
          { label: '2 Estrelas', count: byRating[2], pct: calcPct(byRating[2]) },
          { label: '1 Estrela', count: byRating[1], pct: calcPct(byRating[1]) },
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
