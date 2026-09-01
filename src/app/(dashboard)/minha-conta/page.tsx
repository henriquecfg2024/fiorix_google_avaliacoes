import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { PasswordForm } from '@/components/configuracoes/PasswordForm';

export default async function MinhaContaPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect('/login');
  }

  const user = {
    name: session.user.name || 'Usuário',
    email: session.user.email,
    role: session.user.role || 'USER',
  };

  const roleBadgeClass =
    user.role === 'MASTER'
      ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
      : user.role === 'ADMIN'
      ? 'border-indigo-400/30 bg-indigo-400/10 text-indigo-200'
      : user.role === 'RH'
      ? 'border-purple-400/30 bg-purple-400/10 text-purple-200'
      : user.role === 'COLABORADOR'
      ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
      : 'border-blue-400/30 bg-blue-400/10 text-blue-200';

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-amber-500/30 transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-600">/</span>
              <span className="text-amber-300">Minha Conta</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                Minha Conta & Perfil
              </h1>
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
                SEGURANÇA & ACESSO
              </span>
            </div>
          </div>
        </div>

        <section className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] md:p-6">
          <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
            <div className="rounded-2xl border border-white/10 bg-[#151C2F] p-5">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/35">Perfil do usuário</p>
                  <h2 className="mt-2 text-xl font-semibold text-white">{user.name}</h2>
                  <p className="mt-1 text-sm text-white/55">{user.email}</p>
                </div>

                <span className={`rounded-lg border px-3 py-1 text-xs font-bold ${roleBadgeClass}`}>
                  {user.role}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/35">Acesso</p>
                  <p className="mt-2 text-sm font-medium text-white">Login por e-mail e senha</p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/35">Segurança</p>
                  <p className="mt-2 text-sm font-medium text-white">Atualização manual da senha</p>
                </div>
              </div>

              {user.role !== 'USER' && (
                <div className="mt-5">
                  <Link
                    href="/configuracoes"
                    className="inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Ir para Configurações
                  </Link>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-200/80">Boas práticas</p>
              <ul className="mt-3 space-y-2 text-sm text-emerald-50/90">
                <li>• Use ao menos 6 caracteres</li>
                <li>• Prefira combinar letras, números e símbolo</li>
                <li>• Não compartilhe sua senha com outros usuários</li>
                <li>• Troque a senha sempre que houver dúvida de segurança</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] md:p-6">
          <div className="mb-5 space-y-1">
            <h2 className="text-lg font-semibold text-white">Alterar senha</h2>
            <p className="text-sm text-white/55">
              Informe sua senha atual e defina uma nova senha para acessar o FIORIX.
            </p>
          </div>

          <PasswordForm />
        </section>
      </main>
    </div>
  );
}
