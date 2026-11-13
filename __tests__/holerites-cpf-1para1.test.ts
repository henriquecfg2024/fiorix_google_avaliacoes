import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as uploadHoleritesPost } from '@/app/api/rh/upload-holerites/route';
import { revelarCpfHoleriteAction } from '@/app/actions/holerites';
import { auth } from '@/auth';
import { requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit';

vi.mock('@/auth', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  recordAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/audit/log', () => ({
  logAuditEvent: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      listBuckets: vi.fn().mockResolvedValue({ data: [{ name: 'fiorix-holerites' }] }),
      createBucket: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      upsert: vi.fn(),
    },
    fiorixHolerite: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'hol_real_1' }),
      update: vi.fn().mockResolvedValue({ id: 'hol_real_1' }),
    },
    fiorixAcessoLog: {
      create: vi.fn().mockResolvedValue({ id: 'log_cpf_1' }),
    },
  },
}));

describe('Holerites — Validação Estrita 1-para-1 de CPF (11 dígitos) e Revelação LGPD', () => {
  const tenantId = 'cms3xd0wm00002pw9j2k0ahan';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('bloqueia holerites fictícios mesmo quando os 2 últimos dígitos coincidem com colaboradores reais', async () => {
    const rhUser = {
      id: 'user_rh_1',
      name: 'Nadia Najjar',
      email: 'rh@7ri.com.br',
      role: 'RH',
      tenantId,
    };
    vi.mocked(auth).mockResolvedValue({ user: rhUser } as any);
    vi.mocked(requireRole).mockResolvedValue(rhUser as any);

    // Nenhum User nem GESTOR possui exatamente esses 4 CPFs fictícios
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([]);

    const formData = new FormData();
    const ficticios = [
      '48382777848_10-2026.pdf',
      '52029451813_10-2026.pdf',
      '54603114806_10-2026.pdf',
      '59147606834_10-2026.pdf',
    ];
    for (const nome of ficticios) {
      formData.append(
        'files',
        new File([new Uint8Array([37, 80, 68, 70])], nome, { type: 'application/pdf' })
      );
    }

    const req = {
      formData: async () => formData,
      headers: new Headers({ 'user-agent': 'vitest' }),
    } as any;

    const res = await uploadHoleritesPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.aprovados).toBe(0);
    expect(json.rejeitados).toBe(4);
    expect(prisma.fiorixHolerite.create).not.toHaveBeenCalled();

    for (const item of json.resultados) {
      expect(item.status).toBe('CPF NÃO CADASTRADO NA SERVENTIA');
    }
  });

  it('aceita holerite somente quando os 11 dígitos coincidem exatamente com colaborador ativo da Serventia', async () => {
    const rhUser = {
      id: 'user_rh_1',
      name: 'Nadia Najjar',
      email: 'rh@7ri.com.br',
      role: 'RH',
      tenantId,
    };
    vi.mocked(auth).mockResolvedValue({ user: rhUser } as any);
    vi.mocked(requireRole).mockResolvedValue(rhUser as any);

    // CPF matematicamente válido de 11 dígitos pertencente exatamente ao colaborador ativo
    const cpfColaborador = '52998224725';
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user_colab_ativo',
      name: 'Bruno Alves Santos',
    } as any);
    vi.mocked(prisma.$queryRawUnsafe).mockResolvedValue([]);

    const formData = new FormData();
    formData.append(
      'files',
      new File([new Uint8Array([37, 80, 68, 70])], `${cpfColaborador}_10-2026.pdf`, {
        type: 'application/pdf',
      })
    );

    const req = {
      formData: async () => formData,
      headers: new Headers({ 'user-agent': 'vitest' }),
    } as any;

    const res = await uploadHoleritesPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.aprovados).toBe(1);
    expect(json.rejeitados).toBe(0);
    expect(json.resultados[0]).toMatchObject({
      arquivo: `${cpfColaborador}_10-2026.pdf`,
      colaborador: 'Bruno Alves Santos',
      competencia: '10/2026',
      status: 'MATCH',
    });
    expect(prisma.fiorixHolerite.create).toHaveBeenCalledTimes(1);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        modulo: 'HOLERITES',
        acao: 'INCLUSAO',
      })
    );
  });

  it('revela CPF completo em Holerites para RH com auditoria LGPD e compatibilidade sem acento (GESTOR)', async () => {
    vi.mocked(requireRole).mockResolvedValue({
      id: 'user_rh_1',
      name: 'Nadia Najjar',
      email: 'rh@7ri.com.br',
      role: 'RH',
      tenantId,
    } as any);

    // Simula busca no GESTOR: nome sem acento ("Joao Pedro Santana Silva") para usuário "João Pedro Santana Silva"
    (prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string) => {
      if (sql.includes('LOWER(nome) = LOWER($2)')) {
        return [];
      }
      if (sql.includes('FROM public.fiorix_rh_colaboradores_gestor') && sql.includes('cpf IS NOT NULL')) {
        return [{ nome: 'Joao Pedro Santana Silva', cpf: '52998224725' }];
      }
      return [];
    });

    const result = await revelarCpfHoleriteAction({
      holeriteId: 'hol_jp_1',
      colaboradorNome: 'João Pedro Santana Silva',
    });

    expect(result).toEqual({
      success: true,
      cpf: '529.982.247-25',
    });
    expect(prisma.fiorixAcessoLog.create).toHaveBeenCalledTimes(1);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        modulo: 'HOLERITES',
        acao: 'CONSULTA_LGPD',
      })
    );
  });
});
