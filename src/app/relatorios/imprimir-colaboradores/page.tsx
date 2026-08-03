import React from 'react';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ImprimirColaboradoresPage() {
  let tenantId = 'cartorio-7ri-sp';
  let tenantName = '7º Cartório de Registro de Imóveis de SP';
  
  try {
    const session = await auth();
    if (session?.user?.tenantId) {
      tenantId = session.user.tenantId;
    }
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

  const colaboradores = dbColaboradores.map((colab) => {
    const totalMencoes = colab.mentions.length;
    const elogios = colab.mentions.filter(m => m.sentiment === 'POSITIVE' || (m.review && m.review.rating >= 4)).length;
    const ratings = colab.mentions.map(m => m.review?.rating).filter((r): r is number => typeof r === 'number');
    const notaMedia = ratings.length > 0 
      ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
      : '5.0';

    return {
      id: colab.id,
      nome: colab.name,
      elogios,
      mencoes: totalMencoes,
      notaMedia
    };
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
