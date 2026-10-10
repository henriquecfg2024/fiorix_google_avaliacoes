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
  if (tenantId && !isUserOnly) {
    try {
      await ensureSyncLogTable();
      connection = await prisma.googleConnection.findFirst({
        where: { tenantId },
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
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-amber-500/30 dark:bg-[#070A12] dark:text-white transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* BARRA DE NAVEGAÇÃO COMPACTA EM LINHA ÚNICA (PADRÃO FIORIX) */}
        <div className="flex items-center justify-between gap-2 px-1 pt-1 pb-2 border-b border-slate-200 dark:border-white/6">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">SISTEMA & TECNOLOGIA</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-extrabold tracking-wider">CONFIGURAÇÕES</span>
            <h1 className="sr-only">Configurações Gerais</h1>
          </div>
        </div>

        {isUserOnly ? (
          <section className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-sm text-white space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">🔑 Segurança e Alteração de Senha</h2>
            <p className="mt-1 text-sm text-white/60">
              Atualize a sua senha de acesso ao painel do FIORIX a qualquer momento.
            </p>

            <div className="mt-5">
              <PasswordForm />
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-sm text-white space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">🌐 Integração com Google Meu Negócio</h2>
              <p className="mt-1 text-sm text-white/60">
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
                  className={`rounded-xl border px-3.5 py-2 text-sm font-semibold ${
                    isConnected
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border-white/15 bg-white/[0.05] text-white/70'
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
                      <span className="rounded-xl border border-white/15 bg-white/[0.05] px-3.5 py-2 text-sm italic text-white/60">
                        🔒 Conexão gerenciada pelo MASTER
                      </span>
                    )}
                  </>
                ) : userRole === 'MASTER' ? (
                  <GoogleAuthButton label="Conectar Conta Google" />
                ) : (
                  <span className="rounded-xl border border-white/15 bg-white/[0.05] px-3.5 py-2 text-sm italic text-white/60">
                    🔒 Conexão gerenciada pelo MASTER
                  </span>
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-sm text-white space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">⚙️ Parâmetros</h2>
              <p className="mt-1 text-sm text-white/60">
                Gerencie integrações, credenciais e parâmetros operacionais da sua organização.
              </p>

              <div>
                <Link
                  href="/configuracoes/parametros"
                  className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] hover:border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition-all"
                >
                  Gerenciar Parâmetros →
                </Link>
              </div>
            </section>

            <section className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-sm text-white space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">👥 Gestão de Colaboradores</h2>
              <p className="mt-1 text-sm text-white/60">
                Cadastre os colaboradores do cartório e seus respectivos apelidos/variações de nome para monitoramento e análise de menções em resenhas.
              </p>

              <div>
                <Link
                  href="/configuracoes/colaboradores"
                  className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] hover:border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition-all"
                >
                  Gerenciar Colaboradores →
                </Link>
              </div>
            </section>

            <section className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-sm text-white space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">🏢 Gestão de Departamentos</h2>
              <p className="mt-1 text-sm text-white/60">
                Cadastre, edite e organize os departamentos da sua organização. Os departamentos são utilizados para lotação de colaboradores e vinculação de Instruções de Trabalho.
              </p>

              <div>
                <Link
                  href="/configuracoes/departamentos"
                  className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] hover:border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition-all"
                >
                  Gerenciar Departamentos →
                </Link>
              </div>
            </section>

            <section className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-sm text-white space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">👤 Gestão de Usuários do Cartório</h2>
              <p className="mt-1 text-sm text-white/60">
                Cadastre novos usuários (funcionários/equipe) para acessar o painel do FIORIX neste cartório.
              </p>

              <div>
                <Link
                  href="/configuracoes/usuarios"
                  className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] hover:border-white/25 px-4 py-2.5 text-sm font-semibold text-white transition-all"
                >
                  Gerenciar Usuários →
                </Link>
              </div>
            </section>

            {userRole === 'MASTER' && (
              <>
                <section className="rounded-[24px] border border-amber-500/30 bg-amber-950/20 backdrop-blur-xl p-6 shadow-sm text-white space-y-4">
                  <h2 className="text-lg font-semibold text-amber-300 flex items-center gap-2">
                    🛡️ Permissões de Menu
                  </h2>
                  <p className="mt-1 text-sm text-amber-100/80">
                    Gerencie o acesso aos menus e submenus por colaborador ou perfil.
                  </p>

                  <div>
                    <Link
                      href="/configuracoes/permissoes-menu"
                      className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white transition-all shadow-md shadow-amber-600/20"
                    >
                      Gerenciar Permissões →
                    </Link>
                  </div>
                </section>

                <section className="rounded-[24px] border border-emerald-500/30 bg-emerald-950/20 backdrop-blur-xl p-6 shadow-sm text-white space-y-4">
                  <h2 className="text-lg font-semibold text-[#10d9a0] flex items-center gap-2">
                    🏢 Gestão de Cartórios Clientes (Exclusivo Master)
                  </h2>
                  <p className="mt-1 text-sm text-emerald-100/80">
                    Cadastre novos cartórios (tenants) no sistema SaaS e defina a conta de usuário administrador de cada um.
                  </p>

                  <div>
                    <Link
                      href="/configuracoes/cartorios"
                      className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-all shadow-md shadow-emerald-600/20"
                    >
                      Cadastrar Novos Cartórios →
                    </Link>
                  </div>
                </section>
              </>
            )}

            <section className="rounded-[24px] border border-white/20 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-sm text-white space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">🔑 Segurança e Alteração de Senha</h2>
              <p className="mt-1 text-sm text-white/60">
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
