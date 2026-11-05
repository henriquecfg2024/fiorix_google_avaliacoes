import { isRouteAllowedForUser } from '@/lib/nav-permissions/service';

export interface MinhaContaVisibility {
  showConfiguracoesLink: boolean;
  showNotificacoesPrivacidade: boolean;
  showSegurancaDispositivos: boolean;
}

/**
 * Resolve quais seções complementares devem ser exibidas em /minha-conta:
 * - "Segurança & Dispositivos Conectados (Web Push / PWA)": exclusivo para MASTER e ADMIN.
 * - "Notificações & Privacidade": para MASTER, ADMIN ou usuários com o menu Mensagens (/mensagens) ativo.
 * - Botão "Ir para Configurações": para MASTER, ADMIN ou usuários com /configuracoes ativo.
 */
export async function resolveMinhaContaVisibility(user: {
  id?: string | null;
  role: string;
  tenantId?: string | null;
  departamento?: string | null;
}): Promise<MinhaContaVisibility> {
  const normalizedRole = String(user.role || 'USER').toUpperCase();
  const isAdminOrMaster = normalizedRole === 'MASTER' || normalizedRole === 'ADMIN';

  if (isAdminOrMaster) {
    return {
      showConfiguracoesLink: true,
      showNotificacoesPrivacidade: true,
      showSegurancaDispositivos: true,
    };
  }

  if (!user.id || !user.tenantId) {
    return {
      showConfiguracoesLink: false,
      showNotificacoesPrivacidade: false,
      showSegurancaDispositivos: false,
    };
  }

  const navUser = {
    id: user.id,
    role: normalizedRole,
    tenantId: user.tenantId,
    departamento: user.departamento ?? null,
  };

  const [mensagensAllowed, configuracoesAllowed] = await Promise.all([
    isRouteAllowedForUser('/mensagens', navUser),
    isRouteAllowedForUser('/configuracoes', navUser),
  ]);

  return {
    showConfiguracoesLink: configuracoesAllowed,
    showNotificacoesPrivacidade: mensagensAllowed,
    showSegurancaDispositivos: false,
  };
}
