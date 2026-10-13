import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/audit', () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

const mockExecuteRawUnsafe = vi.fn();
const mockQueryRawUnsafe = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: (...args: any[]) => mockExecuteRawUnsafe(...args),
    $queryRawUnsafe: (...args: any[]) => mockQueryRawUnsafe(...args),
    tenant: {
      findUnique: vi.fn().mockResolvedValue({ name: 'Cartório Teste', cidade: 'São Paulo', estado: 'SP' }),
    },
  },
}));

let mockUserSession = {
  id: 'substituto-user-id',
  role: 'SUBSTITUTO',
  tenantId: 'tenant-123',
  name: 'Oficial Substituto',
  email: 'substituto@cartorio.com.br',
  departamento: 'Substituto',
};

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(async () => mockUserSession),
  requireRole: vi.fn(async () => mockUserSession),
}));

import {
  adicionarParticipanteIt,
  removerParticipanteIt,
  getParticipantesIt,
  buscarColaboradoresParaVincular,
} from '@/app/actions/its';
import { getMinhaItData } from '@/app/actions/minha-it';

describe('Gestão de ITs — Concessão e Retirada de Acesso à Leitura pelo Substituto', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserSession = {
      id: 'substituto-user-id',
      role: 'SUBSTITUTO',
      tenantId: 'tenant-123',
      name: 'Oficial Substituto',
      email: 'substituto@cartorio.com.br',
      departamento: 'Substituto',
    };
  });

  it('permite que o Oficial Substituto conceda acesso de leitura (LEITOR) a qualquer colaborador', async () => {
    // 1. Mock IT encontrada
    mockQueryRawUnsafe.mockImplementation(async (query: string) => {
      if (query.includes('FROM public.fiorix_its_participants')) {
        // Colaborador ainda não é participante
        return [];
      }
      if (query.includes('FROM public.fiorix_its ') || query.includes('FROM public.fiorix_its\n')) {
        return [{ id: '11111111-1111-1111-1111-111111111111', codigo: 'IT-ATD-001', titulo: 'Atendimento', departamento: 'Atendimento', status: 'vigente' }];
      }
      if (query.includes('FROM public."User"')) {
        // Colaborador de outro setor (Financeiro)
        return [{ id: 'colab-1', name: 'Maria Silva', email: 'maria@cartorio.com.br', departamento: 'Financeiro' }];
      }
      return [];
    });

    mockExecuteRawUnsafe.mockResolvedValue(1);

    const res = await adicionarParticipanteIt({
      itId: '11111111-1111-1111-1111-111111111111',
      usuarioId: 'colab-1',
      papel: 'LEITOR',
    });

    expect(res.success).toBe(true);
    expect(res.pendente).toBeFalsy();
    // Verifica que executou o INSERT em fiorix_its_participants
    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO public.fiorix_its_participants'),
      'tenant-123',
      '11111111-1111-1111-1111-111111111111',
      'colab-1',
      'LEITOR',
      'substituto-user-id',
      false
    );
  });

  it('permite que o Oficial Substituto retire acesso de leitura de um colaborador', async () => {
    mockQueryRawUnsafe.mockImplementation(async (query: string) => {
      if (query.includes('FROM public.fiorix_its_participants') && query.includes('SELECT p.id::text')) {
        return [{
          id: 'part-uuid',
          papel: 'LEITOR',
          name: 'João Santos',
          departamento: 'Registro',
        }];
      }
      return [];
    });

    mockExecuteRawUnsafe.mockResolvedValue(1);

    const res = await removerParticipanteIt(
      '11111111-1111-1111-1111-111111111111',
      'colab-joao',
      'Acesso revogado pelo Oficial Substituto'
    );

    expect(res.success).toBe(true);
    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("SET status = 'inativo'"),
      'Acesso revogado pelo Oficial Substituto',
      '11111111-1111-1111-1111-111111111111',
      'colab-joao',
      'tenant-123'
    );
  });

  it('permite que colaborador com papel LEITOR leia a IT em Minha IT mesmo sem ter custódia', async () => {
    // Muda a sessão para o colaborador comum
    mockUserSession = {
      id: 'colab-leitor-id',
      role: 'COLABORADOR',
      tenantId: 'tenant-123',
      name: 'Colaborador Leitor',
      email: 'leitor@cartorio.com.br',
      departamento: 'Registro',
    };

    mockQueryRawUnsafe.mockImplementation(async (query: string) => {
      // 1. Departamentos
      if (query.includes('FROM public.fiorix_departamentos')) {
        return [{ nome: 'Registro' }];
      }
      // 2. itsCustodia: colaborador não tem custódia técnica de nenhuma IT
      if (query.includes('FROM public.fiorix_its') && query.includes('responsavel_tecnico_id = $2')) {
        return [];
      }
      // 3. itsByParticipation: colaborador tem papel LEITOR concedido pelo Substituto
      if (query.includes('FROM public.fiorix_its_participants p')) {
        return [{
          id: '11111111-1111-1111-1111-111111111111',
          codigo: 'IT-REG-001',
          titulo: 'Registro Operacional',
          versao: '1.2',
          departamento: 'Registro',
          status: 'vigente',
          papel: 'LEITOR',
        }];
      }
      // 4. Detalhes completos da IT para leitura
      if (query.includes('SELECT \n      f.id, f.codigo') || query.includes('FROM public.fiorix_its f')) {
        return [{
          id: '11111111-1111-1111-1111-111111111111',
          codigo: 'IT-REG-001',
          titulo: 'Registro Operacional',
          versao: '1.2',
          departamento: 'Registro',
          status: 'vigente',
          objetivo: 'Padronizar o registro',
          quando_usar: 'Diariamente',
          passo_a_passo: JSON.stringify([{ ordem: 1, titulo: 'Conferir', desc: 'Conferir títulos' }]),
          checklist: JSON.stringify(['Certidão válida']),
          erros_comuns: JSON.stringify([]),
          hash_versao: 'hash123',
          pdf_path: null,
          pdf_original_url: null,
          updated_at: new Date().toISOString(),
          resp_id: 'outro-resp',
          resp_nome: 'Responsável Técnico',
          resp_email: 'resp@cartorio.com.br',
          resp_cargo: 'Escrevente',
        }];
      }
      // 5. Ciências
      if (query.includes('FROM public.fiorix_its_ciencias')) {
        return [];
      }
      // 6. Colaboradores da equipe
      if (query.includes('FROM public."User"') && query.includes('"tenantId" = $1')) {
        return [{ id: 'colab-leitor-id', name: 'Colaborador Leitor', cargo: 'Auxiliar' }];
      }
      return [];
    });

    const data = await getMinhaItData();

    // Colaborador consegue ler a IT com todos os detalhes
    expect(data.currentIt).not.toBeNull();
    expect(data.currentIt?.codigo).toBe('IT-REG-001');
    expect(data.currentIt?.titulo).toBe('Registro Operacional');
    expect(data.itsByParticipation.length).toBe(1);
    expect(data.itsByParticipation[0].papelNaIt).toBe('LEITOR');
  });
});
