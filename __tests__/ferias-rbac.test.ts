import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEscalaAnual, EscalaItem, PublicacaoStatus } from '@/lib/ferias/ferias-repository';
import { getMinhasFeriasAction } from '@/app/actions/ferias';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

// Mock de autenticação e cache
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/audit', () => ({
  recordAuditLog: vi.fn(),
}));

// Mock do prisma para testes unitários isolados
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn(),
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    fiorixFeriasPrevista: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

describe('Controle de Acesso (RBAC) - Escala Anual de Férias', () => {
  const tenantId = 'tenant-test-123';
  const ano = 2027;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Perfil: COLABORADOR / USER (Isolamento Estrito)', () => {
    it('deve retornar lista VAZIA se a escala estiver em RASCUNHO', async () => {
      // Mock da tabela de publicação retornando RASCUNHO
      vi.mocked(prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string) => {
        if (sql.includes('fiorix_ferias_publicacao')) {
          return [{ ano, status: 'RASCUNHO', publicado_por: null, publicado_em: null, retirado_em: null }];
        }
        return [];
      });

      const res = await getEscalaAnual(tenantId, ano, 'user-colab-1', 'USER');

      expect(res.publicacao.status).toBe('RASCUNHO');
      expect(res.colaboradores).toEqual([]);
      // Garante que nem sequer consultou a lista completa de colaboradores
      const queries = vi.mocked(prisma.$queryRawUnsafe).mock.calls.map((c) => c[0] as string);
      expect(queries.some((q) => q.includes('fiorix_ferias_escala'))).toBe(false);
    });

    it('deve retornar APENAS o próprio registro quando a escala estiver PUBLICADA (sem vazamento de terceiros)', async () => {
      const userId = 'user-colab-1';

      vi.mocked(prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string, ...params: any[]) => {
        if (sql.includes('fiorix_ferias_publicacao')) {
          return [{ ano, status: 'PUBLICADA', publicado_por: 'admin', publicado_em: '2026-09-01T00:00:00Z', retirado_em: null }];
        }
        if (sql.includes('fiorix_ferias_escala')) {
          // Verifica se a query SQL impõe filtro AND usuario_id = $3
          expect(sql).toContain('AND usuario_id = $3');
          expect(params).toContain(userId);

          // Simula retorno do banco apenas com o registro do próprio usuário
          return [
            {
              id: `esc_${tenantId}_${userId}_${ano}`,
              usuario_id: userId,
              ano,
              nome: 'João Silva',
              email: 'joao@cartorio.com.br',
              setor: 'Balcão',
              cargo: 'Atendente',
              p1_inicio: '2027-02-01',
              p1_fim: '2027-02-20',
              p1_dias: 20,
              total_dias: 20,
              status: 'programado',
              observacao: null,
              historico: '[]',
            },
          ];
        }
        return [];
      });

      const res = await getEscalaAnual(tenantId, ano, userId, 'COLABORADOR');

      expect(res.publicacao.status).toBe('PUBLICADA');
      expect(res.colaboradores).toHaveLength(1);
      expect(res.colaboradores[0].usuarioId).toBe(userId);
      expect(res.colaboradores[0].nome).toBe('João Silva');
    });

    it('defesa em profundidade: deve descartar dados de terceiros mesmo se o SQL retornar registros extras', async () => {
      const userId = 'user-colab-1';

      vi.mocked(prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string) => {
        if (sql.includes('fiorix_ferias_publicacao')) {
          return [{ ano, status: 'PUBLICADA', publicado_por: 'admin', publicado_em: '2026-09-01T00:00:00Z' }];
        }
        if (sql.includes('fiorix_ferias_escala')) {
          // Simula anomalia onde banco retornaria dois usuários
          return [
            { id: '1', usuario_id: userId, nome: 'João Silva', ano, total_dias: 15, status: 'programado' },
            { id: '2', usuario_id: 'user-outro', nome: 'Mariana Oliveira', ano, total_dias: 30, status: 'programado' },
          ];
        }
        return [];
      });

      const res = await getEscalaAnual(tenantId, ano, userId, 'USER');

      expect(res.colaboradores).toHaveLength(1);
      expect(res.colaboradores[0].usuarioId).toBe(userId);
      expect(res.colaboradores.some((c) => c.usuarioId === 'user-outro')).toBe(false);
    });
  });

  describe('Perfil: SUBSTITUTO (Modo Consulta Operacional)', () => {
    it('deve ter acesso à visualização consolidada de todos os colaboradores', async () => {
      const substitutoId = 'sub-1';

      vi.mocked(prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string) => {
        if (sql.includes('fiorix_ferias_publicacao')) {
          return [{ ano, status: 'PUBLICADA', publicado_por: 'rh', publicado_em: '2026-09-01T00:00:00Z' }];
        }
        if (sql.includes('fiorix_ferias_escala')) {
          // Garante que a query NÃO restringe usuario_id para o substituto
          expect(sql).not.toContain('AND usuario_id = $3');

          return [
            { id: '1', usuario_id: 'u1', nome: 'Mariana Oliveira', setor: 'Notas', ano, total_dias: 20, status: 'programado' },
            { id: '2', usuario_id: 'u2', nome: 'Carlos Eduardo', setor: 'Protesto', ano, total_dias: 30, status: 'programado' },
            { id: '3', usuario_id: substitutoId, nome: 'Substituto Oficial', setor: 'Diretoria', ano, total_dias: 15, status: 'programado' },
          ];
        }
        return [];
      });

      const res = await getEscalaAnual(tenantId, ano, substitutoId, 'SUBSTITUTO');

      expect(res.colaboradores).toHaveLength(3);
      expect(res.colaboradores.map((c) => c.nome)).toEqual([
        'Mariana Oliveira',
        'Carlos Eduardo',
        'Substituto Oficial',
      ]);
    });
  });

  describe('Perfil: RH, ADMIN e MASTER (Gestão Completa)', () => {
    it('RH deve visualizar todos os colaboradores mesmo se a escala estiver em RASCUNHO', async () => {
      const rhUserId = 'rh-user-1';

      vi.mocked(prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string) => {
        if (sql.includes('fiorix_ferias_publicacao')) {
          return [{ ano, status: 'RASCUNHO', publicado_por: null, publicado_em: null }];
        }
        if (sql.includes('fiorix_ferias_escala')) {
          return [
            { id: '1', usuario_id: 'u1', nome: 'Mariana Oliveira', setor: 'Notas', ano, total_dias: 20, status: 'programado' },
            { id: '2', usuario_id: 'u2', nome: 'Carlos Eduardo', setor: 'Protesto', ano, total_dias: 30, status: 'conflito' },
          ];
        }
        return [];
      });

      const res = await getEscalaAnual(tenantId, ano, rhUserId, 'RH');

      expect(res.publicacao.status).toBe('RASCUNHO');
      expect(res.colaboradores).toHaveLength(2);
      expect(res.colaboradores[1].status).toBe('conflito');
    });

    it('ADMIN deve visualizar todos os colaboradores da escala anual', async () => {
      const adminId = 'admin-user-1';

      vi.mocked(prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string) => {
        if (sql.includes('fiorix_ferias_publicacao')) {
          return [{ ano, status: 'PUBLICADA', publicado_por: 'admin', publicado_em: '2026-09-01T00:00:00Z' }];
        }
        if (sql.includes('fiorix_ferias_escala')) {
          return [
            { id: '1', usuario_id: 'u1', nome: 'Mariana Oliveira', setor: 'Notas', ano, total_dias: 20, status: 'programado' },
          ];
        }
        return [];
      });

      const res = await getEscalaAnual(tenantId, ano, adminId, 'ADMIN');
      expect(res.colaboradores).toHaveLength(1);
    });
  });

  describe('Server Action: getMinhasFeriasAction (Zero IDOR & Defesa em Profundidade)', () => {
    it('deve rejeitar ano inválido fora da whitelist permitida [2026, 2027, 2028]', async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'u-colab',
        tenantId,
        role: 'USER',
        name: 'Colaborador Teste',
      } as any);

      await expect(getMinhasFeriasAction({ ano: 2024 })).rejects.toThrow('Ano inválido para consulta de férias');
      await expect(getMinhasFeriasAction({ ano: 2030 })).rejects.toThrow('Ano inválido para consulta de férias');
    });

    it('colaborador comum deve receber ferias: null se a escala estiver em RASCUNHO', async () => {
      vi.mocked(requireAuth).mockResolvedValue({
        id: 'u-colab',
        tenantId,
        role: 'USER',
        name: 'Colaborador Teste',
      } as any);

      vi.mocked(prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string) => {
        if (sql.includes('fiorix_ferias_publicacao')) {
          return [{ ano, status: 'RASCUNHO' }];
        }
        return [];
      });

      const res = await getMinhasFeriasAction({ ano });

      expect(res.publicacao.status).toBe('RASCUNHO');
      expect(res.ferias).toBeNull();
    });

    it('colaborador comum recebe suas férias com consulta restrita a usuario_id = $3 quando PUBLICADA', async () => {
      const userId = 'u-colab';
      vi.mocked(requireAuth).mockResolvedValue({
        id: userId,
        tenantId,
        role: 'USER',
        name: 'Colaborador Teste',
      } as any);

      vi.mocked(prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string, ...params: any[]) => {
        if (sql.includes('fiorix_ferias_publicacao')) {
          return [{ ano, status: 'PUBLICADA', publicado_por: 'rh', publicado_em: '2026-09-01T00:00:00Z' }];
        }
        if (sql.includes('fiorix_ferias_escala')) {
          expect(sql).toContain('WHERE tenant_id = $1 AND ano = $2 AND usuario_id = $3');
          expect(params).toContain(userId);

          return [
            {
              id: 'esc-1',
              usuario_id: userId,
              ano,
              nome: 'Colaborador Teste',
              setor: 'Balcão',
              cargo: 'Atendente',
              p1_inicio: '2027-03-10',
              p1_fim: '2027-03-24',
              p1_dias: 15,
              total_dias: 15,
              status: 'programado',
              observacao: 'Aprovado',
              historico: JSON.stringify([
                { data: '2026-09-10', de: 'Sem agendamento', para: '2027-03-10 a 2027-03-24 (15d)', por: 'RH Oficial', motivo: 'Escala 2027' }
              ]),
            },
          ];
        }
        return [];
      });

      const res = await getMinhasFeriasAction({ ano });

      expect(res.publicacao.status).toBe('PUBLICADA');
      expect(res.ferias).not.toBeNull();
      expect(res.ferias?.usuarioId).toBe(userId);
      expect(res.ferias?.p1Inicio).toBe('2027-03-10');
      expect(res.ferias?.p1Fim).toBe('2027-03-24');
      expect(res.ferias?.p1Dias).toBe(15);
      // Sanitização do histórico
      expect(res.ferias?.historico).toHaveLength(1);
      expect(res.ferias?.historico?.[0]?.por).toBe('Atualizado por RH');
      expect(res.ferias?.historico?.[0]?.motivo).toBe('Escala 2027');
    });

    it('defesa em profundidade: recupera p1_inicio do historico caso p1_inicio esteja nulo no registro', async () => {
      const userId = 'u-colab';
      vi.mocked(requireAuth).mockResolvedValue({
        id: userId,
        tenantId,
        role: 'USER',
        name: 'Colaborador Teste',
      } as any);

      vi.mocked(prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string) => {
        if (sql.includes('fiorix_ferias_publicacao')) {
          return [{ ano, status: 'PUBLICADA' }];
        }
        if (sql.includes('fiorix_ferias_escala')) {
          return [
            {
              id: 'esc-1',
              usuario_id: userId,
              ano,
              nome: 'Colaborador Teste',
              p1_inicio: null,
              p1_fim: null,
              p1_dias: 0,
              total_dias: 0,
              status: 'pendente',
              historico: JSON.stringify([
                { data: '2026-09-10', de: 'Sem agendamento', para: '2027-03-10 a 2027-03-24 (15d)', por: 'RH Oficial', motivo: 'Recuperação' }
              ]),
            },
          ];
        }
        return [];
      });

      const res = await getMinhasFeriasAction({ ano });

      expect(res.ferias).not.toBeNull();
      expect(res.ferias?.p1Inicio).toBe('2027-03-10');
      expect(res.ferias?.p1Fim).toBe('2027-03-24');
      expect(res.ferias?.p1Dias).toBe(15);
      expect(res.ferias?.status).toBe('programado');
    });
  });
});
