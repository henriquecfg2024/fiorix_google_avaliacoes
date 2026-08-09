import React from 'react';
import { prisma } from '@/lib/prisma';
import { loadColaboradorRanking } from '@/lib/colaboradores-data';
import { getTenantIdOrDefault } from '@/lib/tenant';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RelatoriosPage() {
  const tenantId = await getTenantIdOrDefault();

  const totalReviews = await prisma.review.count({ where: { tenantId } });
  const colaboradores = await loadColaboradorRanking(tenantId);

  return (
    <div className="layout" style={{ gridTemplateColumns: '1fr' }}>
      <div className="center-col" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* ═══ CARTÕES DE EXPORTAÇÃO RÁPIDA ═══ */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Relatórios Avançados de Desempenho</div>
              <div className="chart-sub">Exporte relatórios completos em PDF/Excel com dados agregados de reputação do cartório.</div>
            </div>
          </div>
          
          <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {/* Relatório Mensal */}
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
                🖨️ Gerar PDF Mensal
              </a>
            </div>

            {/* Exportação CSV e JSON */}
            <div style={{ padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>📥</div>
              <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' }}>
                Exportação de Dados Brutos
              </h4>
              <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
                Exporte todas as {totalReviews} avaliações para planilha Excel (CSV) ou arquivo JSON.
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

        {/* ═══ CONTAINER DINÂMICO INTERATIVO DE COLABORADORES ═══ */}
        <div className="chart-card" style={{ padding: '28px' }}>
          <div className="chart-header" style={{ marginBottom: '16px' }}>
            <div>
              <div className="chart-title" style={{ fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>👥</span> Desempenho & Elogios por Colaborador
              </div>
              <div className="chart-sub">
                Clique nos elogios ou no nome de qualquer colaborador para ir direto às avaliações correspondentes no painel.
              </div>
            </div>
            <a 
              href="/relatorios/imprimir-colaboradores" 
              target="_blank" 
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '8px 16px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', textDecoration: 'none' }}
            >
              🖨️ Imprimir / Versão PDF
            </a>
          </div>

          {colaboradores.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '12px' }}>
              Nenhum colaborador ativo cadastrado neste cartório.
            </div>
          ) : (
            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: 'white' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    <th style={{ padding: '14px 18px', width: '60px' }}>Rank</th>
                    <th style={{ padding: '14px 18px' }}>Colaborador</th>
                    <th style={{ padding: '14px 18px', textAlign: 'center' }}>Elogios Diretos</th>
                    <th style={{ padding: '14px 18px', textAlign: 'center' }}>Total Menções</th>
                    <th style={{ padding: '14px 18px', textAlign: 'center' }}>Nota Média</th>
                    <th style={{ padding: '14px 18px', textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {colaboradores.map((col, idx) => {
                    const rankMedal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                    const searchUrl = `/avaliacoes?search=${encodeURIComponent(col.nome)}`;

                    return (
                      <tr 
                        key={col.id} 
                        style={{ 
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.2s ease',
                          cursor: 'pointer'
                        }}
                        className="hover-row"
                      >
                        {/* Rank */}
                        <td style={{ padding: '14px 18px', fontSize: '15px', fontWeight: '700' }}>
                          {rankMedal}
                        </td>

                        {/* Nome */}
                        <td style={{ padding: '14px 18px' }}>
                          <Link 
                            href={searchUrl} 
                            style={{ 
                              fontSize: '14px', 
                              fontWeight: '600', 
                              color: '#0f172a', 
                              textDecoration: 'none'
                            }}
                          >
                            {col.nome}
                          </Link>
                        </td>

                        {/* Elogios Diretos (Clique para ir para avaliações) */}
                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <Link 
                            href={searchUrl}
                            title={`Ver ${col.elogios} elogios de ${col.nome}`}
                            style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 14px',
                              borderRadius: '20px',
                              background: '#dcfce7',
                              color: '#15803d',
                              fontWeight: '700',
                              fontSize: '13.5px',
                              textDecoration: 'none',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              transition: 'transform 0.15s ease'
                            }}
                          >
                            <span>{col.elogios}</span>
                            <span>👏</span>
                          </Link>
                        </td>

                        {/* Total Menções */}
                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <Link 
                            href={searchUrl}
                            style={{ 
                              fontSize: '14px', 
                              color: '#475569', 
                              fontWeight: '500',
                              textDecoration: 'none'
                            }}
                          >
                            {col.mencoes}
                          </Link>
                        </td>

                        {/* Nota Média */}
                        <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                          <span style={{ 
                            fontSize: '13.5px', 
                            fontWeight: '700', 
                            color: '#eab308',
                            background: '#fefce8',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            border: '1px solid #fef08a'
                          }}>
                            {col.notaMedia} ★
                          </span>
                        </td>

                        {/* Botão Ver Avaliações */}
                        <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                          <Link 
                            href={searchUrl}
                            style={{ 
                              display: 'inline-block',
                              padding: '6px 12px',
                              borderRadius: '6px',
                              background: '#f1f5f9',
                              color: '#2563eb',
                              fontSize: '12px',
                              fontWeight: '600',
                              textDecoration: 'none'
                            }}
                          >
                            Ver Avaliações →
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
