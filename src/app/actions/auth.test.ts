import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, authMock, signInMock, signOutMock, bcryptMock, revalidatePath, FakeAuthError } = vi.hoisted(
  () => {
    class AuthErrorStub extends Error {
      type: string;

      constructor(type: string) {
        super(type);
        this.type = type;
      }
    }

    return {
      prismaMock: { user: { findUnique: vi.fn(), update: vi.fn() } },
      authMock: vi.fn(),
      signInMock: vi.fn(),
      signOutMock: vi.fn(),
      bcryptMock: { compare: vi.fn(), hash: vi.fn() },
      revalidatePath: vi.fn(),
      FakeAuthError: AuthErrorStub,
    };
  },
);

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/auth', () => ({ auth: authMock, signIn: signInMock, signOut: signOutMock }));
vi.mock('next-auth', () => ({ AuthError: FakeAuthError }));
vi.mock('bcryptjs', () => ({ default: bcryptMock }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { authenticate, getCurrentUser, handleSignOut, updatePassword } from './auth';

function formData(entries: Record<string, string>) {
  const data = new FormData();
  Object.entries(entries).forEach(([key, value]) => data.append(key, value));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('authenticate', () => {
  it('returns nothing when the credentials are accepted', async () => {
    await expect(authenticate(undefined, formData({ email: 'a@b.c', password: 'x' }))).resolves.toBeUndefined();
    expect(signInMock).toHaveBeenCalledWith('credentials', expect.any(FormData));
  });

  it('translates a rejected sign in into a user facing message', async () => {
    signInMock.mockRejectedValue(new FakeAuthError('CredentialsSignin'));
    await expect(authenticate(undefined, formData({}))).resolves.toBe('Credenciais inválidas.');
  });

  it('falls back to a generic message for other auth errors', async () => {
    signInMock.mockRejectedValue(new FakeAuthError('SessionTokenError'));
    await expect(authenticate(undefined, formData({}))).resolves.toBe('Algo deu errado.');
  });

  it('rethrows non auth errors, including the Next.js redirect', async () => {
    signInMock.mockRejectedValue(new Error('NEXT_REDIRECT'));
    await expect(authenticate(undefined, formData({}))).rejects.toThrow('NEXT_REDIRECT');
  });
});

describe('handleSignOut', () => {
  it('sends the user back to the login page', async () => {
    await handleSignOut();
    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: '/login' });
  });
});

describe('updatePassword', () => {
  it('requires an authenticated session', async () => {
    authMock.mockResolvedValue(null);
    await expect(updatePassword(formData({}))).resolves.toEqual({ error: 'Não autorizado' });
  });

  it('requires both password fields', async () => {
    authMock.mockResolvedValue({ user: { email: 'a@b.c' } });
    await expect(updatePassword(formData({ currentPassword: 'old' }))).resolves.toEqual({
      error: 'Preencha todos os campos.',
    });
  });

  it('enforces the minimum length of the new password', async () => {
    authMock.mockResolvedValue({ user: { email: 'a@b.c' } });
    await expect(updatePassword(formData({ currentPassword: 'old', newPassword: '12345' }))).resolves.toEqual({
      error: 'A nova senha deve ter no mínimo 6 caracteres.',
    });
  });

  it('fails when the session user no longer exists', async () => {
    authMock.mockResolvedValue({ user: { email: 'a@b.c' } });
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(updatePassword(formData({ currentPassword: 'old', newPassword: 'newpass' }))).resolves.toEqual({
      error: 'Usuário não encontrado.',
    });
  });

  it('rejects a wrong current password without touching the database', async () => {
    authMock.mockResolvedValue({ user: { email: 'a@b.c' } });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
    bcryptMock.compare.mockResolvedValue(false);

    await expect(updatePassword(formData({ currentPassword: 'wrong', newPassword: 'newpass' }))).resolves.toEqual({
      error: 'Senha atual incorreta.',
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('stores the new hash when the current password matches', async () => {
    authMock.mockResolvedValue({ user: { email: 'a@b.c' } });
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
    bcryptMock.compare.mockResolvedValue(true);
    bcryptMock.hash.mockResolvedValue('new-hash');

    await expect(updatePassword(formData({ currentPassword: 'old', newPassword: 'newpass' }))).resolves.toEqual({
      success: true,
    });
    expect(bcryptMock.hash).toHaveBeenCalledWith('newpass', 10);
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: 'new-hash' },
    });
  });
});

describe('getCurrentUser', () => {
  it('returns null without a session', async () => {
    authMock.mockResolvedValue({});
    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('defaults missing profile fields', async () => {
    authMock.mockResolvedValue({ user: { email: 'a@b.c' } });
    await expect(getCurrentUser()).resolves.toEqual({ id: '', name: '', email: 'a@b.c', role: 'USER' });
  });

  it('maps the session user', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1', name: 'Ana', email: 'a@b.c', role: 'MASTER' } });
    await expect(getCurrentUser()).resolves.toEqual({ id: 'u1', name: 'Ana', email: 'a@b.c', role: 'MASTER' });
  });
});
