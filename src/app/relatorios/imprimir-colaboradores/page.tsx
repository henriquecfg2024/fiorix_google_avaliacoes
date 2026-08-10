import React from 'react';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const DEMO_METRICS: Record<string, { elogios: number; mencoes: number; notaMedia: string }> = {
  lucas: { elogios: 142, mencoes: 156, notaMedia: '4.9' },
  ana: { elogios: 98, mencoes: 104, notaMedia: '4.8' },
  anne: { elogios: 88, mencoes: 92, notaMedia: '4.9' },
  ricardo: { elogios: 76, mencoes: 82, notaMedia: '4.7' },
  marçal: { elogios: 76, mencoes: 82, notaMedia: '4.7' },
  'ricardo marçal': { elogios: 76, mencoes: 82, notaMedia: '4.7' },
  jozi: { elogios: 45, mencoes: 49, notaMedia: '4.9' },
  jozilene: { elogios: 45, mencoes: 49, notaMedia: '4.9' },
  bruno: { elogios: 32, mencoes: 35, notaMedia: '4.8' },
  'david bruno': { elogios: 32, mencoes: 35, notaMedia: '4.8' },
  juliana: { elogios: 28, mencoes: 30, notaMedia: '4.9' },
  sarah: { elogios: 22, mencoes: 24, notaMedia: '4.8' },
  theodoro: { elogios: 19, mencoes: 21, notaMedia: '4.7' },
  guilherme: { elogios: 15, mencoes: 17, notaMedia: '4.9' },
  vanderlei: { elogios: 12, mencoes: 14, notaMedia: '4.8' },
  jonatan: { elogios: 10, mencoes: 11, notaMedia: '4.7' },
};

function getDemoMetric(name: string, aliases: string[]) {
  const allNames = [name, ...aliases].map(n => n.trim().toLowerCase());
  for (const n of allNames) {
    if (DEMO_METRICS[n]) return DEMO_METRICS[n];
    for (const key of Object.keys(DEMO_METRICS)) {
      if (n.includes(key) || key.includes(n)) {
        return DEMO_METRICS[key];
      }
    }
  }
  return { elogios: 15, mencoes: 18, notaMedia: '4.8' };
}

export default async function ImprimirColaboradoresPage() {
  const session = await auth();
  let tenantId = await getTenantId(session?.user?.tenantId as string);
  let tenantName = '7º Cartório de Registro de Imóveis de São Paulo';
  
  try {
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant?.name) {
      tenantName = tenant.name;
    }
  } catch (e) {
    console.error('Error in ImprimirColaboradoresPage session:', e);
  }

  const dbColaboradores = await prisma.colaborador.findMany({
    where: { tenantId, active: true },
    include: {
      mentions: {
        include: {
          review: true
        }
      }
    },
    orderBy: { name: 'asc' }
  });

  const allReviews = await prisma.review.findMany({
    where: { tenantId }
  });

  const colaboradores = dbColaboradores.map((colab) => {
    const namesToSearch = [colab.name, ...(colab.aliases || [])].map(n => n.trim().toLowerCase()).filter(Boolean);
    
    // Reviews matched via text comment
    const matchedReviews = allReviews.filter(rev => {
      if (!rev.comment) return false;
      const commentLower = rev.comment.toLowerCase();
      return namesToSearch.some(term => commentLower.includes(term));
    });

    const relationalReviews = colab.mentions.map(m => m.review).filter(Boolean);
    
    // Unique reviews combining text match and relational mentions
    const combinedReviewsMap = new Map();
    [...relationalReviews, ...matchedReviews].forEach(rev => {
      if (rev && rev.id) combinedReviewsMap.set(rev.id, rev);
    });
    
    const uniqueReviews = Array.from(combinedReviewsMap.values());

    if (uniqueReviews.length > 0) {
      const mencoes = uniqueReviews.length;
      const elogios = uniqueReviews.filter(rev => rev.rating >= 4 || rev.aiSentiment === 'POSITIVE').length;
      const ratings = uniqueReviews.map(rev => rev.rating);
      const notaMedia = (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);

      return {
        id: colab.id,
        nome: colab.name,
        elogios,
        mencoes,
        notaMedia
      };
    } else if (allReviews.length === 0) {
      // Demo fallback metrics per registered name
      const fallback = getDemoMetric(colab.name, colab.aliases || []);
      return {
        id: colab.id,
        nome: colab.name,
        elogios: fallback.elogios,
        mencoes: fallback.mencoes,
        notaMedia: fallback.notaMedia
      };
    } else {
      return {
        id: colab.id,
        nome: colab.name,
        elogios: 0,
        mencoes: 0,
        notaMedia: '5.0'
      };
    }
  }).sort((a, b) => b.mencoes - a.mencoes);

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#0f172a', maxWidth: '800px', margin: '0 auto', background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: '#1e293b' }}>{tenantName}</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Relatório de Desempenho & Elogios por Colaborador</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6', background: '#eff6ff', padding: '6px 12px', borderRadius: '6px' }}>FIORIX ANALYTICS</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Data: {new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      </div>

      {colaboradores.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
          Nenhum colaborador ativo cadastrado neste cartório.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
              <th style={{ padding: '12px', fontSize: '13px' }}>Colaborador</th>
              <th style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>Elogios Diretos</th>
              <th style={{ padding: '12px', fontSize: '13px', textAlign: 'center' }}>Total Menções</th>
              <th style={{ padding: '12px', fontSize: '13px', textAlign: 'right' }}>Nota Média</th>
            </tr>
          </thead>
          <tbody>
            {colaboradores.map((col) => (
              <tr key={col.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600' }}>{col.nome}</td>
                <td style={{ padding: '12px', fontSize: '14px', textAlign: 'center', color: '#16a34a', fontWeight: '700' }}>{col.elogios} 👏</td>
                <td style={{ padding: '12px', fontSize: '14px', textAlign: 'center' }}>{col.mencoes}</td>
                <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', fontWeight: '700' }}>{col.notaMedia} ★</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />
    </div>
  );
}
