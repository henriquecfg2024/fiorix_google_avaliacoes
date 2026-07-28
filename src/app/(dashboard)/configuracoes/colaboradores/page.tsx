import React from 'react';
import { getColaboradores, addColaborador, toggleColaboradorActive, deleteColaborador } from '@/app/actions/colaboradores';
import Link from 'next/link';

export default async function ColaboradoresConfigPage() {
  const colaboradores = await getColaboradores();

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
              <div className="chart-title">Gestão de Colaboradores</div>
              <div className="chart-sub">Cadastre e gerencie todos os colaboradores ativos e inativos avaliados nas resenhas do Google.</div>
            </div>
          </div>

          <form action={addColaborador} style={{ marginTop: '20px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '14px', color: '#1e293b' }}>
              ➕ Cadastrar Novo Colaborador
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#475569' }}>
                  Nome Completo / Exibição *
                </label>
                <input 
                  type="text" 
                  name="name" 
                  required
                  placeholder="Ex: Carlos Eduardo ou Maria Silva"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px', color: '#475569' }}>
                  Apelidos / Variações de Nome (separados por vírgula)
                </label>
                <input 
                  type="text" 
                  name="aliases" 
                  placeholder="Ex: Carlinhos, Cadu"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
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
                Cadastrar Colaborador
              </button>
            </div>
          </form>
        </div>

        <div className="chart-card">
          <div className="chart-header" style={{ marginBottom: '16px' }}>
            <div className="chart-title">Colaboradores Cadastrados ({colaboradores.length})</div>
          </div>

          {colaboradores.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '14px', background: '#f8fafc', borderRadius: '8px' }}>
              Nenhum colaborador cadastrado ainda. Preencha o formulário acima para adicionar o primeiro.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b', fontSize: '12px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>Nome</th>
                    <th style={{ padding: '12px 16px' }}>Apelidos / Variações</th>
                    <th style={{ padding: '12px 16px' }}>Status</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {colaboradores.map((colab) => (
                    <tr key={colab.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '14px 16px', fontWeight: '600', color: '#1e293b' }}>
                        {colab.name}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#64748b' }}>
                        {colab.aliases && colab.aliases.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {colab.aliases.map((alias, i) => (
                              <span key={i} style={{ background: '#e2e8f0', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                                {alias}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Sem apelidos</span>
                        )}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: '600',
                          background: colab.active ? '#dcfce7' : '#fee2e2',
                          color: colab.active ? '#166534' : '#991b1b',
                        }}>
                          {colab.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <form action={toggleColaboradorActive.bind(null, colab.id, colab.active)}>
                            <button
                              type="submit"
                              style={{
                                border: '1px solid #cbd5e1',
                                background: 'white',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                color: '#475569'
                              }}
                            >
                              {colab.active ? 'Desativar' : 'Ativar'}
                            </button>
                          </form>

                          <form action={deleteColaborador.bind(null, colab.id)}>
                            <button
                              type="submit"
                              style={{
                                border: '1px solid #fca5a5',
                                background: '#fef2f2',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                color: '#dc2626'
                              }}
                            >
                              Excluir
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
