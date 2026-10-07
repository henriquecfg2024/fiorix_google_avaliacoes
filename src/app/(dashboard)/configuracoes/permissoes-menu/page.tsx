import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth-helpers';
import { getNavTenantsAction } from '@/app/actions/nav-permissions';
import { isNavPermissionsFeatureEnabled } from '@/lib/nav-permissions/service';
import { PermissoesMenuClient } from '@/components/configuracoes/PermissoesMenuClient';

export const metadata = {
  title: 'Permissões de Menu | FIORIX',
  description: 'Gerenciamento avançado de permissões de navegação por perfil e colaborador.',
};

export default async function PermissoesMenuPage() {
  // Exclusividade do MASTER: validação estrita no servidor
  try {
    await requireRole('MASTER');
  } catch (error) {
    redirect('/dashboard');
  }

  const tenants = await getNavTenantsAction();
  const featureEnabled = isNavPermissionsFeatureEnabled();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-amber-500/30 dark:bg-[#070A12] dark:text-white transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500/12 via-indigo-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        <PermissoesMenuClient
          initialTenants={tenants}
          featureEnabled={featureEnabled}
        />
      </main>
    </div>
  );
}
