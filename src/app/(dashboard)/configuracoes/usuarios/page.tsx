import React from 'react';
import { getUsers, createUser } from '@/app/actions/admin';
import Link from 'next/link';
import { UserListTable } from '@/components/configuracoes/UserListTable';
import { auth } from '@/auth';

export default async function UsuariosConfigPage() {
  const session = await auth();
  const currentUserRole = session?.user?.role || 'USER';
  const usuarios = await getUsers();

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
              <div className="chart-title">Gestão de Usuários do Cartório</div>
              <div className="chart-sub">Cadastre novos usuários para acessar e operar o sistema FIORIX neste cartório.</div>
            </div>
          </div>

          <form action={createUser} style={{ marginTop: '20px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', color: '#1e293b' }}>
              👤 Cadastrar Novo Usuário
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 150px auto', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#475569' }}>
                  Nome *
                </label>
                <input 
                  type="text" 
                  name="name" 
                  required
                  placeholder="Nome do usuário"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#475569' }}>
                  E-mail de Acesso *
                </label>
                <input 
                  type="email" 
                  name="email" 
                  required
                  placeholder="usuario@cartorio.com.br"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#475569' }}>
                  Senha Inicial *
                </label>
                <input 
                  type="password" 
                  name="password" 
                  required
                  placeholder="••••••••"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#475569' }}>
                  Função *
                </label>
                <select
                  name="role"
                  defaultValue="USER"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: 'white' }}
                >
                  <option value="USER">Usuário (USER)</option>
                  <option value="ADMIN">Admin (ADMIN)</option>
                </select>
              </div>

              <button 
                type="submit"
                style={{
                  background: '#3b82f6',
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
                Cadastrar Usuário
              </button>
            </div>
          </form>
        </div>

        <div className="chart-card">
          <div className="chart-header" style={{ marginBottom: '16px' }}>
            <div className="chart-title">Usuários Ativos ({usuarios.length})</div>
          </div>

          <UserListTable usuarios={usuarios} currentUserRole={currentUserRole} />
        </div>
      </div>
    </div>
  );
}

