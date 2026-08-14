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
        ? 'border-blue-400/30 bg-blue-400/10 text-blue-200'
        : 'border-slate-300/20 bg-slate-300/10 text-slate-200';

  return (
    <div className="fiorix-dark-page px-4 py-6 md:px-7">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-white">Minha conta</h1>
          <p className="text-sm text-white/55">
            Gerencie seus dados de acesso e atualize sua senha com segurança.
          </p>
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
      </div>
    </div>
  );
}
