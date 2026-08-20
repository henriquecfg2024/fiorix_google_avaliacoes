import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ensureSyncLogTable } from '@/lib/sync-log-db';
import { GoogleAuthButton } from '@/components/configuracoes/GoogleAuthButton';
import { PasswordForm } from '@/components/configuracoes/PasswordForm';
import { SyncButton } from '@/components/configuracoes/SyncButton';

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await auth();
  const tenantId = session?.user?.tenantId as string | undefined;
  const userRole = session?.user?.role as string | undefined;

  if (!userRole) {
    redirect('/dashboard');
  }

  const isUserOnly = userRole === 'USER';

  let connection = null;
  let syncLogs: Array<any> = [];
  if (tenantId && !isUserOnly) {
    try {
      await ensureSyncLogTable();
      connection = await prisma.googleConnection.findFirst({
        where: { tenantId },
      });
      syncLogs = await prisma.syncLog.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    } catch (e) {
      console.error('Error fetching google connection:', e);
    }
  }

  const isConnected = !!connection;
  const rawErrorMsg = searchParams?.error;
  const errorMsg = Array.isArray(rawErrorMsg) ? rawErrorMsg[0] : rawErrorMsg;

  const rawDetails = searchParams?.details;
  const errorDetails = Array.isArray(rawDetails) ? rawDetails[0] : rawDetails;

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        <div className="rounded-[28px] border border-white/8 bg-[#0B1020]/72 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-white/42">
            <span>Dashboard</span>
            <span className="text-white/20">/</span>
            <span>Sistema</span>
            <span className="text-white/20">/</span>
            <span className="text-amber-300">Configurações</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-[2.15rem] font-black tracking-[0.01em] text-transparent bg-clip-text bg-gradient-to-r from-slate-50 via-white to-amber-300">
              Configurações Gerais
            </h1>
            <span className="rounded-full border border-amber-500/20 bg-amber-500/10 font-mono text-xs text-amber-300">
              PREFERÊNCIAS & INTEGRAÇÕES
            </span>
          </div>

          <p className="max-w-4xl text-sm leading-relaxed text-white/58">
            Gerencie integrações com o Google Meu Negócio, acompanhe sincronizações e altere credenciais do sistema.
          </p>
        </div>

        {isUserOnly ? (
          <section className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl space-y-4">
            <h2 className="text-lg font-semibold text-white">🔑 Segurança e Alteração de Senha</h2>
            <p className="mt-1 text-sm text-white/55">
              Atualize a sua senha de acesso ao painel do FIORIX a qualquer momento.
            </p>

            <div className="mt-5">
              <PasswordForm />
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl space-y-4">
              <h2 className="text-lg font-semibold text-white">Histórico de sincronizações</h2>
              <p className="mt-1 text-sm text-white/55">
                Acompanhe as últimas consultas feitas ao Google.
              </p>

              {syncLogs.length === 0 ? (
                <div className="mt-4 text-sm text-white/55">Nenhuma sincronização registrada ainda.</div>
              ) : (
                <div className="mt-4 overflow-x-auto rounded-2xl border border-white/12">
                  <table className="w-full min-w-[780px] text-sm">
                    <thead className="bg-[#0B1020] text-xs uppercase tracking-wider text-white/58 border-b border-white/12">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium">Data</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Encontradas</th>
                        <th className="px-4 py-3 text-left font-medium">Importadas</th>
                        <th className="px-4 py-3 text-left font-medium">Duração</th>
                        <th className="px-4 py-3 text-left font-medium">Detalhe</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/8 font-medium text-white/80">
                      {syncLogs.map((log) => {
                        const statusLabel =
                          {
                            COMPLETED: 'Concluída',
                            FAILED: 'Erro',
                            TIMEOUT: 'Timeout',
                            RUNNING: 'Em andamento',
                          }[log.status as string] || log.status;

                        const statusClass =
                          log.status === 'COMPLETED'
                            ? 'text-[#10d9a0]'
                            : log.status === 'RUNNING'
                              ? 'text-amber-300'
                              : 'text-red-300';

                        return (
                          <tr key={log.id} className="text-white/80 hover:bg-white/[0.03] transition-colors">
                            <td className="px-4 py-3 whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString('pt-BR')}
                            </td>
                            <td className={`px-4 py-3 font-semibold ${statusClass}`}>{statusLabel}</td>
                            <td className="px-4 py-3">{log.reviewsFetched}</td>
                            <td className="px-4 py-3">{log.reviewsImported}</td>
                            <td className="px-4 py-3">
                              {log.durationMs ? `${(log.durationMs / 1000).toFixed(1)}s` : '—'}
                            </td>
                            <td className="px-4 py-3 max-w-[260px] text-white/55">
                              {log.errorMessage || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl space-y-4">
              <h2 className="text-lg font-semibold text-white">🌐 Integração com Google Meu Negócio</h2>
              <p className="mt-1 text-sm text-white/55">
                Conecte sua conta do Google para buscar avaliações automaticamente e permitir respostas diretas pelo painel do FIORIX.
              </p>

              {errorMsg && (
                <div className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">
                  <strong>Erro na autenticação:</strong> {typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg)}
                  {errorDetails && (
                    <div className="mt-1 text-xs text-red-200/80">
                      {typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails)}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                    isConnected
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-[#10d9a0]'
                      : 'border-white/12 bg-white/[0.04] text-white/70'
                  }`}
                >
                  Status: {isConnected ? '✅ Conectado' : '❌ Não conectado'}
                </div>

                {isConnected ? (
                  <>
                    <SyncButton />
                    {userRole === 'MASTER' ? (
                      <GoogleAuthButton label="Reconectar Conta Google" />
                    ) : (
                      <span className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-sm italic text-white/55">
                        🔒 Conexão gerenciada pelo MASTER
                      </span>
                    )}
                  </>
                ) : userRole === 'MASTER' ? (
                  <GoogleAuthButton label="Conectar Conta Google" />
                ) : (
                  <span className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-sm italic text-white/55">
                    🔒 Conexão gerenciada pelo MASTER
                  </span>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl space-y-4">
              <h2 className="text-lg font-semibold text-white">👥 Gestão de Colaboradores</h2>
              <p className="mt-1 text-sm text-white/55">
                Cadastre os colaboradores do cartório e seus respectivos apelidos/variações de nome para monitoramento e análise de menções em resenhas.
              </p>

              <Link
                href="/configuracoes/colaboradores"
                className="mt-5 inline-flex rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Gerenciar Colaboradores →
              </Link>
            </section>

            <section className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl space-y-4">
              <h2 className="text-lg font-semibold text-white">👤 Gestão de Usuários do Cartório</h2>
              <p className="mt-1 text-sm text-white/55">
                Cadastre novos usuários (funcionários/equipe) para acessar o painel do FIORIX neste cartório.
              </p>

              <Link
                href="/configuracoes/usuarios"
                className="mt-5 inline-flex rounded-xl border border-white/12 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
              >
                Gerenciar Usuários →
              </Link>
            </section>

            {userRole === 'MASTER' && (
              <section className="rounded-[28px] border border-emerald-500/25 bg-emerald-500/10 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl space-y-4">
                <h2 className="text-lg font-semibold text-[#10d9a0]">
                  🏢 Gestão de Cartórios Clientes (Exclusivo Master)
                </h2>
                <p className="mt-1 text-sm text-emerald-100/80">
                  Cadastre novos cartórios (tenants) no sistema SaaS e defina a conta de usuário administrador de cada um.
                </p>

                <Link
                  href="/configuracoes/cartorios"
                  className="mt-5 inline-flex rounded-xl bg-[#00C950] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00A844]"
                >
                  Cadastrar Novos Cartórios →
                </Link>
              </section>
            )}

            <section className="rounded-[28px] border border-white/12 bg-[#0B1020]/72 p-6 shadow-[0_18px_50px_rgba(0,0,0,0.16)] backdrop-blur-xl space-y-4">
              <h2 className="text-lg font-semibold text-white">🔑 Segurança e Alteração de Senha</h2>
              <p className="mt-1 text-sm text-white/55">
                Atualize a sua senha de acesso ao painel do FIORIX a qualquer momento.
              </p>

              <div className="mt-5">
                <PasswordForm />
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
