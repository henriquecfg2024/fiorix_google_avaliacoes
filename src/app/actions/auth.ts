'use server';

import { signIn, signOut, auth } from '@/auth';
import { AuthError } from 'next-auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

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
    throw error;
  }
}

export async function handleSignOut() {
  await signOut({ redirectTo: '/login' });
}

export async function updatePassword(formData: FormData) {
  const session = await auth();
  if (!session?.user?.email) {
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

  const user = await prisma.user.findUnique({
    where: { email: session.user.email }
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
