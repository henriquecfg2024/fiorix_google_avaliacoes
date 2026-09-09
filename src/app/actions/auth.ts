'use server';

import { signIn, signOut, auth } from '@/auth';
import { AuthError } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { generateTotpSecret, generateTotpUri, generateQRCodeDataUrl, verifyTotpToken, roleRequires2FA } from '@/lib/totp';

export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', formData);
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
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, role: true, totpEnabled: true, totpSecret: true },
    });

    if (!user) return { valid: false, requires2FA: false, error: 'Credenciais inválidas.' };

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return { valid: false, requires2FA: false, error: 'Credenciais inválidas.' };

    const mustUse2FA = roleRequires2FA(user.role);
    if (mustUse2FA) {
      if (user.totpEnabled && user.totpSecret) {
        return { valid: true, requires2FA: true, isSetup2FA: false };
      }

      // Primeiro acesso do ADMIN ou MASTER: gera segredo e QR code para ativação imediata
      const secret = user.totpSecret || generateTotpSecret();
      const otpauthUrl = generateTotpUri(user.email, secret);
      const qrCodeDataUrl = await generateQRCodeDataUrl(otpauthUrl);

      await prisma.user.update({
        where: { id: user.id },
        data: { totpSecret: secret, totpEnabled: false },
      });

      return {
        valid: true,
        requires2FA: true,
        isSetup2FA: true,
        qrCodeDataUrl,
        secret,
      };
    }

    return { valid: true, requires2FA: false };
  } catch (err) {
    console.error('Erro em checkCredentials:', err);
    return { valid: false, requires2FA: false, error: 'Erro ao verificar credenciais.' };
  }
}

export async function handleSignOut() {
  await signOut({ redirectTo: '/login' });
}

export async function updatePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.tenantId) {
    return { error: 'Não autorizado' };
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
    where: { id: session.user.id, tenantId: session.user.tenantId }
  });

  if (!user) {
    return { error: 'Usuário não encontrado.' };
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    return { error: 'Senha atual incorreta.' };
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash }
  });

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
  if (!roleRequires2FA(user.role)) return { secret: '', qrCodeDataUrl: '', error: 'Seu perfil não requer 2FA' };
  if (user.totpEnabled) return { secret: '', qrCodeDataUrl: '', error: '2FA já está ativado' };

  const secret = generateTotpSecret();
  const otpauthUrl = generateTotpUri(user.email, secret);
  const qrCodeDataUrl = await generateQRCodeDataUrl(otpauthUrl);

  // Salva o segredo temporariamente (não ativado ainda)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: secret, totpEnabled: false },
  });

  return { secret, qrCodeDataUrl };
}

/**
 * Confirma ativação do 2FA validando o primeiro código
 */
export async function confirm2FA(code: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Não autorizado' };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!user?.totpSecret) return { success: false, error: 'Configure o 2FA primeiro' };
  if (user.totpEnabled) return { success: false, error: '2FA já está ativado' };

  const isValid = verifyTotpToken(code, user.totpSecret);
  if (!isValid) return { success: false, error: 'Código inválido. Tente novamente.' };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpEnabled: true, totpVerifiedAt: new Date() },
  });

  return { success: true };
}

/**
 * Desativa o 2FA
 */
export async function disable2FA(password: string): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: 'Não autorizado' };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) return { success: false, error: 'Usuário não encontrado' };

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return { success: false, error: 'Senha incorreta' };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: null, totpEnabled: false, totpVerifiedAt: null },
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
    select: { role: true, totpEnabled: true, totpVerifiedAt: true },
  });

  if (!user) return { enabled: false, required: false };

  return {
    enabled: user.totpEnabled,
    required: roleRequires2FA(user.role),
    verifiedAt: user.totpVerifiedAt,
  };
}

// Nota: React.cache() não pode ser usado em arquivos 'use server' (Server Actions).
// A memoização por request é feita automaticamente pelo Next.js via auth().
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user) return null;
  return {
    id: session.user.id || '',
    name: session.user.name || '',
    email: session.user.email || '',
    role: session.user.role || 'USER',
  };
}
