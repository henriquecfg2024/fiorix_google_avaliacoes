import React from 'react';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export default async function RelatoriosPage() {
  const session = await auth();
  const tenantId = (session?.user?.tenantId as string) || 'cartorio-7ri-sp';

  const totalReviews = await prisma.review.count({ where: { tenantId } });

  return (
    <div className="layout" style={{ gridTemplateColumns: '1fr' }}>
      <div className="center-col">
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Relatórios Avançados de Desempenho</div>
              <div className="chart-sub">Exporte relatórios completos em PDF/Excel com dados agregados de reputação do cartório.</div>
            </div>
          </div>
          
          <div style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* 1. Relatório Mensal */}
            <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📊</div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Relatório Mensal de Reputação
              </h4>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                Resumo consolidado do volume de notas, nota média e evolução mensal do cartório.
              </p>
              <a 
                href="/relatorios/imprimir-mensal" 
                target="_blank" 
                rel="noreferrer"
                style={{ display: 'inline-block', background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', textDecoration: 'none' }}
              >
                🖨️ Gerar PDF
              </a>
            </div>

            {/* 2. Desempenho por Colaborador */}
            <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>👤</div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Desempenho por Colaborador
              </h4>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                Detalhamento das menções e elogios extraídos das avaliações por colaborador.
              </p>
              <a 
                href="/relatorios/imprimir-colaboradores" 
                target="_blank" 
                rel="noreferrer"
                style={{ display: 'inline-block', background: '#3b82f6', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', textDecoration: 'none' }}
              >
                🖨️ Gerar PDF
              </a>
            </div>

            {/* 3. Exportação CSV e JSON */}
            <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📥</div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Exportação de Dados Brutos
              </h4>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                Exporte todas as {totalReviews} avaliações e comentários para planilha Excel, CSV ou JSON.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <a 
                  href="/api/export?format=csv" 
                  download 
                  style={{ display: 'inline-block', background: '#0f172a', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', textDecoration: 'none' }}
                >
                  📄 Exportar CSV
                </a>
                <a 
                  href="/api/export?format=json" 
                  download 
                  style={{ display: 'inline-block', background: '#475569', color: 'white', border: 'none', padding: '8px 14px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', textDecoration: 'none' }}
                >
                  {'{ }'} Exportar JSON
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
