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
    <div className="layout user-management-page" style={{ gridTemplateColumns: '1fr' }}>
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

          <form className="user-create-form" action={createUser} style={{ marginTop: '20px', padding: '20px', borderRadius: '12px' }}>
            <h4 className="user-create-title" style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px' }}>
              👤 Cadastrar Novo Usuário
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 150px auto', gap: '12px', alignItems: 'end' }}>
              <div>
                <label className="user-field-label" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                  Nome *
                </label>
                <input 
                  type="text" 
                  name="name" 
                  required
                  placeholder="Nome do usuário"
                  className="user-field-input"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>

              <div>
                <label className="user-field-label" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                  E-mail de Acesso *
                </label>
                <input 
                  type="email" 
                  name="email" 
                  required
                  placeholder="usuario@cartorio.com.br"
                  className="user-field-input"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>

              <div>
                <label className="user-field-label" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                  Senha Inicial *
                </label>
                <input 
                  type="password" 
                  name="password" 
                  required
                  placeholder="••••••••"
                  className="user-field-input"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '14px' }}
                />
              </div>

              <div>
                <label className="user-field-label" style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                  Função *
                </label>
                <select
                  name="role"
                  defaultValue="USER"
                  className="user-field-input"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', fontSize: '14px' }}
                >
                  <option value="USER">Usuário (USER)</option>
                  <option value="ADMIN">Admin (ADMIN)</option>
                </select>
              </div>

              <button 
                type="submit"
                className="user-create-button"
                style={{
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
