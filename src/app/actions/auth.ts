'use server';

import { signIn, signOut, auth } from '@/auth';
import { AuthError } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import {
  generateTotpSecret,
  generateTotpUri,
  generateQRCodeDataUrl,
  verifyTotpTokenAsync,
  userRequires2FA,
  encryptTotpSecret,
  decryptTotpSecret,
  isEncryptedTotpSecret,
} from '@/lib/totp';
import { getFirstAllowedRouteForUser } from '@/lib/nav-permissions/service';
import { getHomeRouteForRole } from '@/lib/permissions';
import { revokeAllUserSessions } from '@/lib/auth-helpers';
import {
  checkLoginLockout,
  recordFailedLogin,
  clearLoginAttempts,
  DUMMY_BCRYPT_HASH,
} from '@/lib/security/login-lockout';

export { checkLoginLockout, recordFailedLogin, clearLoginAttempts };

export async function authenticate(
  prevState: string | undefined,
  formData: FormData
) {
  try {
    const email = String(formData.get('email') || '').trim();
    const password = String(formData.get('password') || '');
    const totpCode = formData.get('totpCode') ? String(formData.get('totpCode')) : undefined;
    await signIn('credentials', {
      email,
      password,
      ...(totpCode ? { totpCode } : {}),
      redirect: false,
    });
    return undefined;
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Credenciais inválidas.';
        default:
          return 'Algo deu errado.';
      }
    }
    // Captura erros especiais do 2FA lançados no authorize
    if (error instanceof Error) {
      if (error.message?.includes('REQUIRES_2FA')) {
        return 'REQUIRES_2FA';
      }
      if (error.message?.includes('INVALID_2FA_CODE')) {
        return 'INVALID_2FA_CODE';
      }
    }
    throw error;
  }
}

/**
 * Verifica se o email/senha são válidos e se precisa de 2FA
 * (chamada antes do signIn para determinar se deve mostrar o input TOTP)
 */
export async function checkCredentials(email: string, password: string): Promise<{
  valid: boolean;
  requires2FA: boolean;
  isSetup2FA?: boolean;
  qrCodeDataUrl?: string;
  secret?: string;
  error?: string;
  role?: string;
  redirectTo?: string;
}> {
  const normalizedEmail = (email || '').trim().toLowerCase();
  if (!normalizedEmail || !password) {
    return { valid: false, requires2FA: false, error: 'Credenciais inválidas.' };
  }

  // Checa bloqueio por força bruta
  const lockout = await checkLoginLockout(normalizedEmail);
  if (lockout.isLocked) {
    return {
      valid: false,
      requires2FA: false,
      error: `Conta temporariamente bloqueada por excesso de tentativas incorretas. Tente novamente em ${lockout.remainingMinutes} minuto(s).`,
    };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        tenantId: true,
        departamento: true,
        totpRequired: true,
        totpEnabled: true,
        totpSecret: true,
      },
    });

    // Mitigação de timing attack: sempre executa bcrypt.compare mesmo se usuário não existir
    if (!user) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      await recordFailedLogin(normalizedEmail);
      return { valid: false, requires2FA: false, error: 'Credenciais inválidas.' };
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      await recordFailedLogin(normalizedEmail);
      return { valid: false, requires2FA: false, error: 'Credenciais inválidas.' };
    }

    // Bloqueia contas marcadas como inativas pela administração
    try {
      const statusRows = await prisma.$queryRawUnsafe<Array<{ status: string }>>(
        `SELECT COALESCE(status, 'ativo') as status FROM public."User" WHERE id = $1 LIMIT 1`,
        user.id
      );
      if (statusRows[0]?.status?.trim().toLowerCase() === 'inativo') {
        return {
          valid: false,
          requires2FA: false,
          error: 'Sua conta está desativada. Contate a administração do cartório.',
        };
      }
    } catch {
      // Ignora em ambientes sem coluna status
    }

    // Nota: quando o usuário exige 2FA, NÃO limpamos tentativas falhas de TOTP apenas acertando a senha!
    const mustUse2FA = userRequires2FA(user);
    if (!mustUse2FA) {
      await clearLoginAttempts(normalizedEmail);
    }

    const userRole = user.role || 'USER';
    let redirectTo = getHomeRouteForRole(userRole);
    if (user.tenantId) {
      try {
        redirectTo = await getFirstAllowedRouteForUser({
          id: user.id,
          role: userRole,
          tenantId: user.tenantId,
          departamento: user.departamento,
        });
      } catch {
        redirectTo = getHomeRouteForRole(userRole);
      }
    }

    if (mustUse2FA) {
      if (user.totpEnabled && user.totpSecret) {
        return { valid: true, requires2FA: true, isSetup2FA: false, role: userRole, redirectTo };
      }

      // Primeiro acesso com 2FA exigido: gera segredo e QR code para ativação imediata (persistindo criptografado em repouso)
      const existingPlainSecret = user.totpSecret ? decryptTotpSecret(user.totpSecret) : '';
      const secret = existingPlainSecret || generateTotpSecret();
      const otpauthUrl = generateTotpUri(user.email, secret);
      const qrCodeDataUrl = await generateQRCodeDataUrl(otpauthUrl);

      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: encryptTotpSecret(secret), totpEnabled: false },
      });

      return {
        valid: true,
        requires2FA: true,
        isSetup2FA: true,
        qrCodeDataUrl,
        secret,
        role: userRole,
        redirectTo,
      };
    }

    return { valid: true, requires2FA: false, role: userRole, redirectTo };
  } catch (err) {
    console.error('Erro em checkCredentials:', err);
    return { valid: false, requires2FA: false, error: 'Erro ao verificar credenciais.' };
  }
}

export async function handleSignOut() {
  const session = await auth();
  if (session?.user?.id) {
    // Desativa inscrições push ativas do usuário ao encerrar explicitamente via action
    try {
      await prisma.pushSubscription.updateMany({
        where: { usuarioId: session.user.id, isActive: true },
        data: { isActive: false, revokedAt: new Date() },
      });
    } catch {
      // Best-effort
    }
  }
  await signOut({ redirectTo: '/login' });
}

export async function updatePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.tenantId) {
    return { error: 'Não autorizado' };
  }

  const lockKey = `pwd:${session.user.id}`;
  const lockout = await checkLoginLockout(lockKey);
  if (lockout.isLocked) {
    return {
      error: `Muitas tentativas incorretas. Aguarde ${lockout.remainingMinutes} minuto(s).`,
    };
  }

  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;

  if (!currentPassword || !newPassword) {
    return { error: 'Preencha todos os campos.' };
  }

  if (newPassword.length < 6) {
    return { error: 'A nova senha deve ter no mínimo 6 caracteres.' };
  }

  // Busca por id E tenantId para garantir isolamento multi-tenant
  const user = await prisma.user.findFirst({
    where: { id: session.user.id, tenantId: session.user.tenantId },
  });

  if (!user) {
    return { error: 'Usuário não encontrado.' };
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    await recordFailedLogin(lockKey);
    return { error: 'Senha atual incorreta.' };
  }

  await clearLoginAttempts(lockKey);

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  const currentAuthAt = (session.user as any).authAt as number | undefined;
  if (!userRequires2FA(user)) {
    const revokedAt = new Date();
    await revokeAllUserSessions(user.id, {
      revokedBefore: revokedAt,
      reason: 'password_changed',
    });
    try {
      await signIn('credentials', {
        email: user.email,
        password: newPassword,
        redirect: false,
      });
    } catch {
      // Caso signIn falhe em contexto de teste, mantém sucesso
    }
  } else if (typeof currentAuthAt === 'number') {
    // Invalida todas as sessões anteriores à sessão atual sem derrubar a aba autenticada com 2FA
    await revokeAllUserSessions(user.id, {
      revokedBefore: new Date(currentAuthAt),
      reason: 'password_changed_2fa',
    });
  }

  return { success: true };
}

// ── 2FA Setup Actions ──────────────────────────────────────────────────

/**
 * Gera segredo TOTP + QR Code para configuração do Google Authenticator
 */
export async function setup2FA(): Promise<{
  secret: string;
  qrCodeDataUrl: string;
  error?: string;
}> {
  const session = await auth();
  if (!session?.user?.id) return { secret: '', qrCodeDataUrl: '', error: 'Não autorizado' };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, role: true, totpEnabled: true },
  });

  if (!user) return { secret: '', qrCodeDataUrl: '', error: 'Usuário não encontrado' };
  if (user.totpEnabled) return { secret: '', qrCodeDataUrl: '', error: '2FA já está ativado' };

  const secret = generateTotpSecret();
  const otpauthUrl = generateTotpUri(user.email, secret);
  const qrCodeDataUrl = await generateQRCodeDataUrl(otpauthUrl);

  // Salva o segredo temporariamente criptografado com AES-256-GCM (não ativado ainda)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: encryptTotpSecret(secret), totpEnabled: false },
  });

  return { secret, qrCodeDataUrl };
}

/**
 * Confirma ativação do 2FA validando o primeiro código (com proteção contra força bruta e replay)
 */
export async function confirm2FA(code: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Não autorizado' };

  const lockKey = `2fa-confirm:${session.user.id}`;
  const lockout = await checkLoginLockout(lockKey);
  if (lockout.isLocked) {
    return {
      success: false,
      error: `Muitas tentativas inválidas de código 2FA. Aguarde ${lockout.remainingMinutes} minuto(s).`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!user?.totpSecret) return { success: false, error: 'Configure o 2FA primeiro' };
  if (user.totpEnabled) return { success: false, error: '2FA já está ativado' };

  const isValid = await verifyTotpTokenAsync(code, user.totpSecret, `confirm2fa:${session.user.id}`);
  if (!isValid) {
    await recordFailedLogin(lockKey);
    return { success: false, error: 'Código inválido. Tente novamente.' };
  }

  await clearLoginAttempts(lockKey);

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      totpRequired: true,
      totpEnabled: true,
      totpVerifiedAt: new Date(),
      ...(isEncryptedTotpSecret(user.totpSecret)
        ? {}
        : { totpSecret: encryptTotpSecret(user.totpSecret) }),
    },
  });

  return { success: true };
}

/**
 * Desativa o 2FA (com proteção contra força bruta de senha)
 */
export async function disable2FA(password: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Não autorizado' };

  const lockKey = `2fa-disable:${session.user.id}`;
  const lockout = await checkLoginLockout(lockKey);
  if (lockout.isLocked) {
    return {
      success: false,
      error: `Muitas tentativas incorretas. Aguarde ${lockout.remainingMinutes} minuto(s).`,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) return { success: false, error: 'Usuário não encontrado' };
  if (user.role === 'MASTER' || user.totpRequired) {
    return {
      success: false,
      error: 'O duplo fator (2FA) está definido como obrigatório pela administração do cartório.',
    };
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    await recordFailedLogin(lockKey);
    return { success: false, error: 'Senha incorreta' };
  }

  await clearLoginAttempts(lockKey);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpRequired: false, totpSecret: null, totpEnabled: false, totpVerifiedAt: null },
  });

  return { success: true };
}

/**
 * Verifica se o usuário atual tem 2FA ativado
 */
export async function get2FAStatus(): Promise<{ enabled: boolean; required: boolean; verifiedAt?: Date | null }> {
  const session = await auth();
  if (!session?.user?.id) return { enabled: false, required: false };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, totpRequired: true, totpEnabled: true, totpVerifiedAt: true },
  });

  if (!user) return { enabled: false, required: false };

  return {
    enabled: user.totpEnabled,
    required: userRequires2FA(user),
    verifiedAt: user.totpVerifiedAt,
  };
}

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user) return null;

  if (session.user.id) {
    try {
      const rows = await prisma.$queryRawUnsafe<
        Array<{ name: string | null; email: string; role: string; tenantId: string; status: string }>
      >(
        `SELECT name, email, role::text as role, "tenantId", COALESCE(status, 'ativo') as status FROM public."User" WHERE id = $1 LIMIT 1`,
        session.user.id
      );
      if (rows.length === 0) {
        return null;
      }
      const dbUser = rows[0];
      if (dbUser.status?.trim().toLowerCase() === 'inativo') {
        return null;
      }
      const effectiveRole = dbUser.role || session.user.role || 'USER';
      const effectiveTenantId =
        effectiveRole === 'MASTER'
          ? (session.user as any).tenantId || dbUser.tenantId || ''
          : dbUser.tenantId || '';
      return {
        id: session.user.id,
        name: dbUser.name || session.user.name || '',
        email: dbUser.email || session.user.email || '',
        role: effectiveRole,
        tenantId: effectiveTenantId,
      };
    } catch {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { name: true, email: true, role: true, tenantId: true },
        });
        if (!dbUser) return null;
        const effectiveRole = dbUser.role || session.user.role || 'USER';
        return {
          id: session.user.id,
          name: dbUser.name || session.user.name || '',
          email: dbUser.email || session.user.email || '',
          role: effectiveRole,
          tenantId:
            effectiveRole === 'MASTER'
              ? (session.user as any).tenantId || dbUser.tenantId || ''
              : dbUser.tenantId || '',
        };
      } catch {
        // Fallback em indisponibilidade transitória de banco
      }
    }
  }

  return {
    id: session.user.id || '',
    name: session.user.name || '',
    email: session.user.email || '',
    role: session.user.role || 'USER',
    tenantId: (session.user as any).tenantId || '',
  };
}
