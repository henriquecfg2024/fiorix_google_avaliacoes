import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, authMock, bcryptMock, revalidatePath } = vi.hoisted(() => ({
  prismaMock: {
    user: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    tenant: { findMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
  authMock: vi.fn(),
  bcryptMock: { hash: vi.fn() },
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('bcryptjs', () => ({ default: bcryptMock }));
vi.mock('next/cache', () => ({ revalidatePath }));

import {
  createTenant,
  createUser,
  getTenants,
  getUsers,
  resetUserPassword,
  updateUserName,
  updateUserRole,
} from './admin';

function formData(entries: Record<string, string>) {
  const data = new FormData();
  Object.entries(entries).forEach(([key, value]) => data.append(key, value));
  return data;
}

function signedInAs(role: string, tenantId: string | null = 't1') {
  authMock.mockResolvedValue({ user: { role, tenantId: tenantId ?? undefined } });
}

beforeEach(() => {
  vi.clearAllMocks();
  bcryptMock.hash.mockResolvedValue('hashed');
  prismaMock.$transaction.mockImplementation(async (callback: any) => callback(prismaMock));
  prismaMock.tenant.create.mockResolvedValue({ id: 'new-tenant' });
  signedInAs('ADMIN');
});

describe('read actions', () => {
  it('lists only the users of the session tenant', async () => {
    prismaMock.user.findMany.mockResolvedValue([{ id: 'u1' }]);
    await expect(getUsers()).resolves.toEqual([{ id: 'u1' }]);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1' } }));
  });

  it('returns no users without a tenant', async () => {
    signedInAs('ADMIN', null);
    await expect(getUsers()).resolves.toEqual([]);
  });

  it('exposes the tenant list to MASTER users only', async () => {
    await expect(getTenants()).resolves.toEqual([]);
    expect(prismaMock.tenant.findMany).not.toHaveBeenCalled();

    signedInAs('MASTER');
    prismaMock.tenant.findMany.mockResolvedValue([{ id: 't1' }]);
    await expect(getTenants()).resolves.toEqual([{ id: 't1' }]);
  });
});

describe('createUser', () => {
  it('requires a tenant scoped session', async () => {
    signedInAs('ADMIN', null);
    await expect(createUser(formData({ email: 'a@b.c', password: 'x' }))).rejects.toThrow('Não autorizado');
  });

  it('requires an e-mail and a password', async () => {
    await expect(createUser(formData({ name: 'Ana' }))).rejects.toThrow('E-mail e senha são obrigatórios.');
  });

  it('rejects a duplicated e-mail', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    await expect(createUser(formData({ email: 'a@b.c', password: 'x' }))).rejects.toThrow(
      'Já existe um usuário cadastrado com este e-mail.',
    );
  });

  it('hashes the password and defaults the role to USER', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await createUser(formData({ name: 'Ana', email: 'a@b.c', password: 'secret' }));

    expect(bcryptMock.hash).toHaveBeenCalledWith('secret', 10);
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: { name: 'Ana', email: 'a@b.c', passwordHash: 'hashed', role: 'USER', tenantId: 't1' },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/configuracoes');
  });
});

describe('createTenant', () => {
  it('is restricted to MASTER users', async () => {
    await expect(createTenant(formData({}))).rejects.toThrow(
      'Apenas usuários Master podem cadastrar novos Cartórios.',
    );
  });

  it('validates the required fields', async () => {
    signedInAs('MASTER');
    await expect(createTenant(formData({ tenantName: 'Cartório' }))).rejects.toThrow(
      'Preencha o nome do cartório, e-mail e senha do administrador.',
    );
  });

  it('rejects an admin e-mail that is already taken', async () => {
    signedInAs('MASTER');
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1' });
    await expect(
      createTenant(formData({ tenantName: 'C', adminEmail: 'a@b.c', adminPassword: 'secret' })),
    ).rejects.toThrow('E-mail do administrador já está em uso.');
  });

  it('creates the tenant and its default administrator in one transaction', async () => {
    signedInAs('MASTER');
    prismaMock.user.findUnique.mockResolvedValue(null);

    await createTenant(formData({ tenantName: 'Cartório', adminEmail: 'a@b.c', adminPassword: 'secret' }));

    expect(prismaMock.tenant.create).toHaveBeenCalledWith({ data: { name: 'Cartório' } });
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        name: 'Administrador',
        email: 'a@b.c',
        passwordHash: 'hashed',
        role: 'ADMIN',
        tenantId: 'new-tenant',
      },
    });
  });
});

describe('resetUserPassword', () => {
  it('is refused for plain users', async () => {
    signedInAs('USER');
    await expect(resetUserPassword('u2', 'newpass')).resolves.toEqual({
      error: 'Apenas administradores podem resetar senhas.',
    });
  });

  it('enforces the minimum password length', async () => {
    await expect(resetUserPassword('u2', '  12  ')).resolves.toEqual({
      error: 'A nova senha deve ter no mínimo 6 caracteres.',
    });
  });

  it('fails when the target user does not exist', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(resetUserPassword('u2', 'newpass')).resolves.toEqual({ error: 'Usuário não encontrado.' });
  });

  it('prevents an ADMIN from resetting a MASTER password', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u2', role: 'MASTER', tenantId: 't1' });
    await expect(resetUserPassword('u2', 'newpass')).resolves.toEqual({
      error: 'Apenas usuários MASTER podem resetar a senha de contas MASTER.',
    });
  });

  it('prevents cross tenant resets', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u2', role: 'USER', tenantId: 'other' });
    await expect(resetUserPassword('u2', 'newpass')).resolves.toEqual({
      error: 'Não autorizado a alterar este usuário.',
    });
  });

  it('lets a MASTER reset a user from another tenant', async () => {
    signedInAs('MASTER');
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u2', role: 'ADMIN', tenantId: 'other' });

    await expect(resetUserPassword('u2', 'newpass')).resolves.toEqual({ success: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'u2' }, data: { passwordHash: 'hashed' } });
    expect(revalidatePath).toHaveBeenCalledWith('/configuracoes/usuarios');
  });
});

describe('updateUserRole', () => {
  it('is refused for plain users', async () => {
    signedInAs('USER');
    await expect(updateUserRole('u2', 'ADMIN')).resolves.toEqual({
      error: 'Apenas administradores podem alterar funções.',
    });
  });

  it('protects MASTER accounts from non MASTER admins', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u2', role: 'MASTER', tenantId: 't1' });
    await expect(updateUserRole('u2', 'USER')).resolves.toEqual({
      error: 'Não é possível alterar a função de um usuário MASTER.',
    });
  });

  it('updates the role of a user in the same tenant', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u2', role: 'USER', tenantId: 't1' });
    await expect(updateUserRole('u2', 'ADMIN')).resolves.toEqual({ success: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'u2' }, data: { role: 'ADMIN' } });
  });
});

describe('updateUserName', () => {
  it('requires an authenticated tenant session', async () => {
    signedInAs('ADMIN', null);
    await expect(updateUserName('u2', 'Ana')).resolves.toEqual({ error: 'Não autorizado' });
  });

  it('protects MASTER accounts from non MASTER admins', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u2', role: 'MASTER', tenantId: 't1' });
    await expect(updateUserName('u2', 'Ana')).resolves.toEqual({
      error: 'Apenas usuários MASTER podem alterar o nome de uma conta MASTER.',
    });
  });

  it('trims the new name', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u2', role: 'USER', tenantId: 't1' });
    await expect(updateUserName('u2', '  Ana Maria  ')).resolves.toEqual({ success: true });
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'u2' }, data: { name: 'Ana Maria' } });
  });
});
