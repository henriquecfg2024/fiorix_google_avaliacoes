import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getEscalaAnual, EscalaItem, PublicacaoStatus } from '@/lib/ferias/ferias-repository';
import { prisma } from '@/lib/prisma';

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
      vi.mocked(prisma.$queryRawUnsafe).mockImplementation(async (sql: string) => {
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

      vi.mocked(prisma.$queryRawUnsafe).mockImplementation(async (sql: string, ...params: any[]) => {
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

      vi.mocked(prisma.$queryRawUnsafe).mockImplementation(async (sql: string) => {
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

      vi.mocked(prisma.$queryRawUnsafe).mockImplementation(async (sql: string) => {
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

      vi.mocked(prisma.$queryRawUnsafe).mockImplementation(async (sql: string) => {
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

      vi.mocked(prisma.$queryRawUnsafe).mockImplementation(async (sql: string) => {
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
});
