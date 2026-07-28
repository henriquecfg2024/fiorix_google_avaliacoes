import React from 'react';
import { getTenants, createTenant } from '@/app/actions/admin';
import Link from 'next/link';

export default async function CartoriosConfigPage() {
  const cartorios = await getTenants();

  return (
    <div className="layout" style={{ gridTemplateColumns: '1fr' }}>
      <div className="center-col">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Link href="/configuracoes" style={{ fontSize: '14px', color: '#3b82f6', textDecoration: 'none', fontWeight: '500' }}>
            ← Voltar para Configurações
          </Link>
        </div>

        <div className="chart-card" style={{ marginBottom: '24px' }}>
          <div className="chart-header">
            <div>
              <div className="chart-title">Gestão de Cartórios (Multi-Tenant)</div>
              <div className="chart-sub">Cadastre novos Cartórios clientes no sistema FIORIX e crie o usuário Administrador de cada um.</div>
            </div>
          </div>

          <form action={createTenant} style={{ marginTop: '20px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', color: '#1e293b' }}>
              🏢 Cadastrar Novo Cartório
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#475569' }}>
                  Nome do Cartório *
                </label>
                <input 
                  type="text" 
                  name="tenantName" 
                  required
                  placeholder="Ex: 8º Cartório de Notas de SP"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#475569' }}>
                  E-mail do Administrador *
                </label>
                <input 
                  type="email" 
                  name="adminEmail" 
                  required
                  placeholder="admin@8cartorio.com.br"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#475569' }}>
                  Senha Inicial *
                </label>
                <input 
                  type="password" 
                  name="adminPassword" 
                  required
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <button 
                type="submit"
                style={{
                  background: '#16a34a',
                  color: 'white',
                  border: 'none',
                  padding: '9px 18px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >
                Cadastrar Cartório
              </button>
            </div>
          </form>
        </div>

        <div className="chart-card">
          <div className="chart-header" style={{ marginBottom: '16px' }}>
            <div className="chart-title">Cartórios Cadastrados ({cartorios.length})</div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 16px' }}>Cartório</th>
                  <th style={{ padding: '12px 16px' }}>Usuários</th>
                  <th style={{ padding: '12px 16px' }}>Avaliações</th>
                  <th style={{ padding: '12px 16px' }}>Colaboradores</th>
                  <th style={{ padding: '12px 16px' }}>Data de Criação</th>
                </tr>
              </thead>
              <tbody>
                {cartorios.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '14px 16px', fontWeight: '600', color: '#1e293b' }}>{c.name}</td>
                    <td style={{ padding: '14px 16px' }}>{c._count.users}</td>
                    <td style={{ padding: '14px 16px' }}>{c._count.reviews}</td>
                    <td style={{ padding: '14px 16px' }}>{c._count.colaboradores}</td>
                    <td style={{ padding: '14px 16px', color: '#64748b' }}>
                      {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
