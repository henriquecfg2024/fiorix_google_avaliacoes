import Link from 'next/link';
import { SyncButton } from '@/components/configuracoes/SyncButton';
import { GoogleAuthButton } from '@/components/configuracoes/GoogleAuthButton';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { PasswordForm } from '@/components/configuracoes/PasswordForm';
import { redirect } from 'next/navigation';
import { ensureSyncLogTable } from '@/lib/sync-log-db';
import { DataLoadError } from '@/components/common/DataLoadError';
import { describeError } from '@/lib/errors';

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await auth();
  const tenantId = session?.user?.tenantId as string | undefined;
  const userRole = session?.user?.role as string | undefined;

  if (!userRole || userRole === 'USER') {
    redirect('/dashboard');
  }

  let connection = null;
  let syncLogs: Array<any> = [];
  let loadError: string | null = null;
  if (tenantId) {
    try {
      await ensureSyncLogTable();
      connection = await prisma.googleConnection.findFirst({
        where: { tenantId }
      });
      syncLogs = await prisma.syncLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    } catch (e) {
      loadError = describeError('configuracoes:fetchConnection', e, 'Falha ao consultar a integração do Google no banco de dados.');
    }
  }

  const isConnected = !!connection;
  const rawErrorMsg = searchParams?.error;
  const errorMsg = Array.isArray(rawErrorMsg) ? rawErrorMsg[0] : rawErrorMsg;

  const rawDetails = searchParams?.details;
  const errorDetails = Array.isArray(rawDetails) ? rawDetails[0] : rawDetails;

  const rawWarning = searchParams?.warning;
  const warningMsg = Array.isArray(rawWarning) ? rawWarning[0] : rawWarning;

  return (
    <div className="layout" style={{ gridTemplateColumns: '1fr' }}>
      <div className="center-col">
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <div className="chart-title">Configurações Gerais</div>
              <div className="chart-sub">Integrações, Usuários, Cartórios e Preferências do Sistema</div>
            </div>
          </div>

          {loadError && (
            <DataLoadError title="Não foi possível carregar os dados de configuração." message={loadError} />
          )}

          {warningMsg && (
            <div style={{ marginTop: '20px', padding: '12px 16px', background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e', borderRadius: '8px', fontSize: '13px' }}>
              <strong>Atenção:</strong> {warningMsg}
            </div>
          )}

          <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px', color: '#1e293b' }}>Histórico de sincronizações</h3>
            <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>Acompanhe as últimas consultas feitas ao Google.</p>
            {syncLogs.length === 0 ? <div style={{ fontSize: '13px', color: '#64748b' }}>Nenhuma sincronização registrada ainda.</div> : (
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead><tr style={{ textAlign: 'left', color: '#64748b' }}><th style={{ padding: '8px' }}>Data</th><th style={{ padding: '8px' }}>Status</th><th style={{ padding: '8px' }}>Encontradas</th><th style={{ padding: '8px' }}>Importadas</th><th style={{ padding: '8px' }}>Duração</th><th style={{ padding: '8px' }}>Detalhe</th></tr></thead>
                <tbody>{syncLogs.map((log) => { const statusLabel = { COMPLETED: 'Concluída', FAILED: 'Erro', TIMEOUT: 'Timeout', RUNNING: 'Em andamento' }[log.status as string] || log.status; const statusColor = log.status === 'COMPLETED' ? '#166534' : log.status === 'RUNNING' ? '#92400e' : '#991b1b'; return <tr key={log.id} style={{ borderTop: '1px solid #e2e8f0' }}><td style={{ padding: '9px 8px', whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString('pt-BR')}</td><td style={{ padding: '9px 8px', color: statusColor, fontWeight: '600' }}>{statusLabel}</td><td style={{ padding: '9px 8px' }}>{log.reviewsFetched}</td><td style={{ padding: '9px 8px' }}>{log.reviewsImported}</td><td style={{ padding: '9px 8px' }}>{log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '—'}</td><td style={{ padding: '9px 8px', maxWidth: '260px', color: '#64748b' }}>{log.errorMessage || '—'}</td></tr>; })}</tbody>
              </table></div>
            )}
          </div>

          {/* GOOGLE INTEGRATION */}
          <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
              🌐 Integração com Google Meu Negócio
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
              Conecte sua conta do Google para buscar avaliações automaticamente e permitir respostas diretas pelo painel do FIORIX.
            </p>

            {errorMsg && (
              <div style={{ marginBottom: '15px', padding: '10px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', fontSize: '14px' }}>
                <strong>Erro na Autenticação:</strong> {typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)}
                {errorDetails && <div style={{ marginTop: '5px', fontSize: '12px', opacity: 0.8 }}>{typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails)}</div>}
              </div>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ 
                padding: '8px 12px', 
                borderRadius: '8px', 
                fontSize: '14px', 
                fontWeight: '600',
                background: isConnected ? '#dcfce7' : '#f1f5f9',
                color: isConnected ? '#166534' : '#475569'
              }}>
                Status: {isConnected ? '✅ Conectado' : '❌ Não conectado'}
              </div>

              {isConnected ? (
                <>
                  <SyncButton />

                  {userRole === 'MASTER' ? (
                    <GoogleAuthButton label="Reconectar Conta Google" />
                  ) : (
                    <span style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', background: '#e2e8f0', padding: '6px 12px', borderRadius: '8px' }}>
                      🔒 Conexão gerenciada pelo MASTER
                    </span>
                  )}
                </>
              ) : (
                userRole === 'MASTER' ? (
                  <GoogleAuthButton label="Conectar Conta Google" />
                ) : (
                  <span style={{ fontSize: '13px', color: '#64748b', fontStyle: 'italic', background: '#e2e8f0', padding: '6px 12px', borderRadius: '8px' }}>
                    🔒 Conexão gerenciada pelo MASTER
                  </span>
                )
              )}
            </div>
          </div>

          {/* GESTÃO DE COLABORADORES */}
          <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
              👥 Gestão de Colaboradores
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
              Cadastre os colaboradores do cartório e seus respectivos apelidos/variações de nome para monitoramento e análise de menções em resenhas.
            </p>

            <Link href="/configuracoes/colaboradores" style={{ 
              display: 'inline-block',
              background: '#0f172a', 
              color: 'white', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              fontSize: '14px', 
              fontWeight: '600', 
              textDecoration: 'none'
            }}>
              Gerenciar Colaboradores →
            </Link>
          </div>

          {/* GESTÃO DE USUÁRIOS */}
          <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
              👤 Gestão de Usuários do Cartório
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
              Cadastre novos usuários (funcionários/equipe) para acessar o painel do FIORIX neste cartório.
            </p>

            <Link href="/configuracoes/usuarios" style={{ 
              display: 'inline-block',
              background: '#0f172a', 
              color: 'white', 
              padding: '8px 16px', 
              borderRadius: '8px', 
              fontSize: '14px', 
              fontWeight: '600', 
              textDecoration: 'none'
            }}>
              Gerenciar Usuários →
            </Link>
          </div>

          {/* GESTÃO DE CARTÓRIOS (MULTI-TENANT / MASTER ONLY) */}
          {userRole === 'MASTER' && (
            <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #dcfce7', borderRadius: '12px', background: '#f0fdf4' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#166534' }}>
                🏢 Gestão de Cartórios Clientes (Exclusivo Master)
              </h3>
              <p style={{ fontSize: '14px', color: '#15803d', marginBottom: '20px' }}>
                Cadastre novos Cartórios (Tenants) no sistema SaaS e defina a conta de usuário Administrador de cada um.
              </p>

              <Link href="/configuracoes/cartorios" style={{ 
                display: 'inline-block',
                background: '#16a34a', 
                color: 'white', 
                padding: '8px 16px', 
                borderRadius: '8px', 
                fontSize: '14px', 
                fontWeight: '600', 
                textDecoration: 'none'
              }}>
                Cadastrar Novos Cartórios →
              </Link>
            </div>
          )}

          {/* ALTERAÇÃO DE SENHA */}
          <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
              🔑 Segurança e Alteração de Senha
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>
              Atualize a sua senha de acesso ao painel do FIORIX a qualquer momento.
            </p>

            <PasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
