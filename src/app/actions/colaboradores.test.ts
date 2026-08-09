import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, authMock, revalidatePath } = vi.hoisted(() => ({
  prismaMock: {
    colaborador: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  },
  authMock: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { addColaborador, deleteColaborador, getColaboradores, toggleColaboradorActive } from './colaboradores';

function formData(entries: Record<string, string>) {
  const data = new FormData();
  Object.entries(entries).forEach(([key, value]) => data.append(key, value));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { tenantId: 't1' } });
});

describe('getColaboradores', () => {
  it('returns an empty list for sessions without a tenant', async () => {
    authMock.mockResolvedValue({ user: {} });
    await expect(getColaboradores()).resolves.toEqual([]);
    expect(prismaMock.colaborador.findMany).not.toHaveBeenCalled();
  });

  it('scopes the query to the session tenant', async () => {
    prismaMock.colaborador.findMany.mockResolvedValue([{ id: 'c1' }]);
    await expect(getColaboradores()).resolves.toEqual([{ id: 'c1' }]);
    expect(prismaMock.colaborador.findMany).toHaveBeenCalledWith({
      where: { tenantId: 't1' },
      orderBy: { createdAt: 'desc' },
    });
  });
});

describe('addColaborador', () => {
  it('requires a tenant scoped session', async () => {
    authMock.mockResolvedValue(null);
    await expect(addColaborador(formData({ name: 'Ana' }))).rejects.toThrow('Não autorizado');
  });

  it('rejects a blank name', async () => {
    await expect(addColaborador(formData({ name: '   ' }))).rejects.toThrow('Nome é obrigatório');
  });

  it('splits, trims and drops empty aliases', async () => {
    await addColaborador(formData({ name: 'Ana', aliases: ' ana ,, Ana Maria ,' }));

    expect(prismaMock.colaborador.create).toHaveBeenCalledWith({
      data: { name: 'Ana', aliases: ['ana', 'Ana Maria'], tenantId: 't1' },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/configuracoes/colaboradores');
  });

  it('stores an empty alias list when the field is missing', async () => {
    await addColaborador(formData({ name: 'Ana' }));
    expect(prismaMock.colaborador.create).toHaveBeenCalledWith({
      data: { name: 'Ana', aliases: [], tenantId: 't1' },
    });
  });
});

describe('toggleColaboradorActive', () => {
  it('flips the current status', async () => {
    await toggleColaboradorActive('c1', true);
    expect(prismaMock.colaborador.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { active: false } });
  });

  it('requires an authorized session', async () => {
    authMock.mockResolvedValue({ user: {} });
    await expect(toggleColaboradorActive('c1', false)).rejects.toThrow('Não autorizado');
  });
});

describe('deleteColaborador', () => {
  it('deletes and revalidates', async () => {
    await deleteColaborador('c1');
    expect(prismaMock.colaborador.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    expect(revalidatePath).toHaveBeenCalledWith('/configuracoes/colaboradores');
  });

  it('requires an authorized session', async () => {
    authMock.mockResolvedValue({ user: {} });
    await expect(deleteColaborador('c1')).rejects.toThrow('Não autorizado');
    expect(prismaMock.colaborador.delete).not.toHaveBeenCalled();
  });
});
