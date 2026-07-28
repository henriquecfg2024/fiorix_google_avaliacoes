import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export default async function ImprimirColaboradoresPage() {
  const session = await auth();
  const tenantId = (session?.user?.tenantId as string) || 'cartorio-7ri-sp';

  const colaboradores = [
    { nome: 'Lucas Escrevente', elogios: 142, mencoes: 156, notaMedia: 4.9 },
    { nome: 'Mariana Silva', elogios: 98, mencoes: 104, notaMedia: 4.8 },
    { nome: 'Roberto Almeida', elogios: 76, mencoes: 82, notaMedia: 4.7 },
    { nome: 'Beatriz Costa', elogios: 45, mencoes: 49, notaMedia: 4.9 },
  ];

  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif', color: '#0f172a', maxWidth: '800px', margin: '0 auto', background: 'white' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '20px', marginBottom: '30px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: '#1e293b' }}>7º Cartório de Registro de Imóveis de SP</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0' }}>Relatório de Desempenho & Elogios por Colaborador</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#3b82f6', background: '#eff6ff', padding: '6px 12px', borderRadius: '6px' }}>FIORIX ANALYTICS</div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Data: {new Date().toLocaleDateString('pt-BR')}</div>
        </div>
      </div>

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
          {colaboradores.map((col, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '12px', fontSize: '14px', fontWeight: '600' }}>{col.nome}</td>
              <td style={{ padding: '12px', fontSize: '14px', textAlign: 'center', color: '#16a34a', fontWeight: '700' }}>{col.elogios} 👏</td>
              <td style={{ padding: '12px', fontSize: '14px', textAlign: 'center' }}>{col.mencoes}</td>
              <td style={{ padding: '12px', fontSize: '14px', textAlign: 'right', fontWeight: '700' }}>{col.notaMedia} ★</td>
            </tr>
          ))}
        </tbody>
      </table>

      <script dangerouslySetInnerHTML={{ __html: `window.onload = function() { window.print(); }` }} />
    </div>
  );
}
