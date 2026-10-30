import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn(),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

let mockUser = {
  id: 'user-admin-1',
  role: 'ADMIN',
  tenantId: 'tenant-test-1',
};

vi.mock('@/lib/auth-helpers', () => ({
  requireRole: vi.fn(async (...roles: string[]) => {
    if (!roles.includes(mockUser.role)) {
      throw new Error('Acesso negado: Permissão insuficiente.');
    }
    return mockUser;
  }),
}));

import { prisma } from '@/lib/prisma';
import { getSessoesConfig, salvarSessao, excluirSessao } from '@/app/actions/sessoes';

describe('Cadastro de Sessões — Configurações (RBAC e Operações)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser = {
      id: 'user-admin-1',
      role: 'ADMIN',
      tenantId: 'tenant-test-1',
    };
  });

  it('permite acesso a usuários com perfil ADMIN', async () => {
    (prisma.$queryRawUnsafe as any).mockResolvedValueOnce([
      {
        id: 'lv2',
        nome: 'LV2',
        grupo: 'Sessões sem Grupo',
        descricao: 'LV2',
        sequencia: 10,
        padraoLocalizacao: 'milhar',
        caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\LV2',
        pastaLocal: 'K:\\IMAGENS\\LV2',
        confidencial: false,
        alias: ['MATRICULAS'],
      },
    ]);

    const sessoes = await getSessoesConfig();
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0].nome).toBe('LV2');
  });

  it('permite acesso a usuários com perfil MASTER', async () => {
    mockUser.role = 'MASTER';

    (prisma.$queryRawUnsafe as any).mockResolvedValueOnce([]);

    const sessoes = await getSessoesConfig();
    // Como a query retornou vazio, ele inicializa com o catálogo padrão
    expect(sessoes.length).toBeGreaterThan(0);
  });

  it('bloqueia acesso a usuários com perfil USER comum', async () => {
    mockUser.role = 'USER';

    await expect(getSessoesConfig()).rejects.toThrow('Acesso negado');
  });

  it('salva uma nova sessão com sucesso e calcula pastaLocal transparente', async () => {
    const res = await salvarSessao({
      nome: 'TESTE_NOVA_SESSAO',
      grupo: 'Sessões sem Grupo',
      descricao: 'Pasta de teste para novos documentos',
      sequencia: 99,
      padraoLocalizacao: 'milhar',
      caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\TESTE_NOVA_SESSAO',
    });

    expect(res.success).toBe(true);
    expect(res.id).toBe('teste_nova_sessao');
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.fiorix_documental_sessoes'),
      'teste_nova_sessao',
      'tenant-test-1',
      'TESTE_NOVA_SESSAO',
      'Sessões sem Grupo',
      'Pasta de teste para novos documentos',
      99,
      'milhar',
      '\\\\SRVFILES\\imagens\\IMAGENS\\TESTE_NOVA_SESSAO',
      'K:\\IMAGENS\\TESTE_NOVA_SESSAO',
      false,
      []
    );
  });

  it('exclui uma sessão existente com validação de tenant', async () => {
    const res = await excluirSessao('teste_nova_sessao');
    expect(res.success).toBe(true);
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM public.fiorix_documental_sessoes'),
      'tenant-test-1',
      'teste_nova_sessao'
    );
  });
});
