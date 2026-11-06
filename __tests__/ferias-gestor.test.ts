import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calcularIdadeCompleta,
  formatarDataGestorBr,
  limparCpfReal,
  formatarCpfCompleto,
  mascararCpfLgpd,
} from '@/lib/ferias/idade-calculator';
import { getEscalaAnual, nomesColaboradorCompativeis } from '@/lib/ferias/ferias-repository';
import {
  revelarCpfColaboradorFeriasAction,
  removerColaboradoresDaTelaFeriasAction,
  criarColaboradorManualFeriasAction,
} from '@/app/actions/ferias';
import { requireRole } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit';
import { prisma } from '@/lib/prisma';

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

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn(),
    user: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    fiorixAcessoLog: {
      create: vi.fn().mockResolvedValue({ id: 'log_1' }),
    },
    fiorixFeriasPrevista: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

describe('Integração GESTOR -> Escala de Férias FIORIX', () => {
  const tenantId = 'cms3xd0wm00002pw9j2k0ahan';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Calculadora de Idade em Tempo Real & Formatação (Padrão Gestor)', () => {
    it('reproduz exatamente o cálculo do Gestor (26/12/2000 em 06/11/2026 => 25 anos, 10 meses e 11 dias)', () => {
      const ref = new Date('2026-11-06T12:00:00-03:00');
      const res = calcularIdadeCompleta('2000-12-26', ref);
      expect(res).not.toBeNull();
      expect(res?.anos).toBe(25);
      expect(res?.meses).toBe(10);
      expect(res?.dias).toBe(11);
      expect(res?.compacto).toBe('25 anos');
      expect(res?.extenso).toBe('25 anos, 10 meses e 11 dias');
    });

    it('calcula aniversário exato e anos bissextos com precisão', () => {
      const niver = calcularIdadeCompleta('2000-12-26', new Date('2026-12-26T12:00:00-03:00'));
      expect(niver?.anos).toBe(26);
      expect(niver?.meses).toBe(0);
      expect(niver?.dias).toBe(0);
      expect(niver?.compacto).toBe('26 anos');
      expect(niver?.extenso).toBe('26 anos, 0 meses e 0 dias');

      const bissexto = calcularIdadeCompleta('2000-02-29', new Date('2025-03-01T12:00:00-03:00'));
      expect(bissexto?.anos).toBe(25);
    });

    it('retorna null para data futura ou inválida e formata data DD/MM/AAAA', () => {
      expect(calcularIdadeCompleta('2099-01-01', new Date('2026-11-06T12:00:00-03:00'))).toBeNull();
      expect(calcularIdadeCompleta(null)).toBeNull();
      expect(formatarDataGestorBr('2000-12-26')).toBe('26/12/2000');
      expect(formatarDataGestorBr('26/12/2000')).toBe('26/12/2000');
    });
  });

  describe('Proteção LGPD de CPF & Rejeição de CPFs Sintéticos de Seed', () => {
    it('rejeita CPFs sintéticos de seed (100.000.000-XX) e sequências inválidas', () => {
      expect(limparCpfReal('100.000.000-03')).toBeNull();
      expect(limparCpfReal('10000000045')).toBeNull();
      expect(limparCpfReal('000.000.000-00')).toBeNull();
      expect(limparCpfReal('111.111.111-11')).toBeNull();
    });

    it('aceita, mascara (***.XXX.XXX-**) e formata CPF real do Gestor', () => {
      const limpo = limparCpfReal('503.588.298-52');
      expect(limpo).toBe('50358829852');
      expect(mascararCpfLgpd(limpo)).toBe('***.588.298-**');
      expect(formatarCpfCompleto(limpo)).toBe('503.588.298-52');
    });
  });

  describe('Enriquecimento da Escala Anual sem Vazamento de CPF Completo', () => {
    it('enriquece o colaborador com dados cadastrais do Gestor mascarando o CPF na listagem', async () => {
      vi.mocked(prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string) => {
        if (sql.includes('fiorix_ferias_publicacao')) {
          return [{ ano: 2027, status: 'PUBLICADA', publicado_por: 'rh' }];
        }
        if (sql.includes('fiorix_ferias_escala')) {
          return [
            {
              id: 'esc_1',
              usuario_id: 'c7ri_u_003',
              ano: 2027,
              nome: 'Alisson Azevedo de Lima',
              setor: 'Atendimento',
              cargo: 'Auxiliar de Registro',
              p1_inicio: '2027-03-10',
              p1_fim: '2027-03-24',
              p1_dias: 15,
              total_dias: 15,
              status: 'programado',
              historico: '[]',
            },
          ];
        }
        if (sql.includes('fiorix_rh_colaboradores_gestor')) {
          return [
            {
              id: 'gestor_127',
              registro_gestor: 127,
              usuario_id: 'c7ri_u_003',
              nome: 'Alisson Azevedo de Lima',
              apelido: null,
              cpf: '50358829852',
              data_nascimento: '2000-12-26',
              sexo: 'Masculino',
              estado_civil: 'Solteiro',
              naturalidade: 'São Paulo',
              uf: 'SP',
              nacionalidade: 'Brasileiro',
              data_admissao: '2025-09-09',
              ativo: true,
              synced_at: '2026-11-06T18:00:00Z',
            },
          ];
        }
        return [];
      });

      const res = await getEscalaAnual(tenantId, 2027, 'rh_user', 'RH');
      expect(res.colaboradores).toHaveLength(1);
      const colab = res.colaboradores[0];
      expect(colab.dadosGestor?.registro).toBe(127);
      expect(colab.dadosGestor?.cpfMascarado).toBe('***.588.298-**');
      expect(JSON.stringify(colab)).not.toContain('50358829852');
      expect(JSON.stringify(colab)).not.toContain('503.588.298-52');
      expect(colab.dadosGestor?.dataNascimento).toBe('2000-12-26');
      expect(colab.dadosGestor?.sexo).toBe('Masculino');
      expect(colab.dadosGestor?.estadoCivil).toBe('Solteiro');
      expect(colab.dadosGestor?.naturalidade).toBe('São Paulo');
      expect(colab.dadosGestor?.uf).toBe('SP');
      expect(colab.dadosGestor?.nacionalidade).toBe('Brasileiro');
      expect(colab.dadosGestor?.dataAdmissao).toBe('2025-09-09');
    });
  });

  describe('Revelação Individual Auditada de CPF (LGPD / Prov. 213/2026)', () => {
    it('exige perfil RH/ADMIN/MASTER e registra FiorixAcessoLog + trilha WORM ao revelar CPF', async () => {
      vi.mocked(requireRole).mockResolvedValue({
        id: 'rh_nadia',
        tenantId,
        role: 'RH',
        name: 'Nadia Najjar',
        email: 'nadia@7ri.com.br',
      } as any);

      vi.mocked(prisma.$queryRawUnsafe as any).mockResolvedValue([
        { cpf: '50358829852' },
      ]);

      const res = await revelarCpfColaboradorFeriasAction({
        usuarioId: 'c7ri_u_003',
        registroGestor: 127,
        nome: 'Alisson Azevedo de Lima',
      });

      expect(requireRole).toHaveBeenCalledWith('ADMIN', 'RH', 'MASTER');
      expect(res.success).toBe(true);
      expect(res.cpf).toBe('503.588.298-52');
      expect(prisma.fiorixAcessoLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId,
            usuarioId: 'rh_nadia',
            alvoUsuarioId: 'c7ri_u_003',
            tipo: 'ferias_cpf_reveal',
          }),
        })
      );
      expect(recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'FERIAS',
          acao: 'CONSULTA_LGPD',
        })
      );
    });
  });

  describe('Reconciliação Inteligente de Nomes GESTOR <-> User FIORIX', () => {
    it('vincula variações reais de abreviação e grafia sem gerar duplicidade', () => {
      expect(nomesColaboradorCompativeis('Ander Gleiber de O Ribeiro', 'Ander Gleiber de Oliveira Ribeiro')).toBe(true);
      expect(nomesColaboradorCompativeis('Claudio Donizetti Ferreira da Silva', 'Claudio Donizetti')).toBe(true);
      expect(nomesColaboradorCompativeis('Francisco Caniinde Martins', 'Francisco Caninde Martins')).toBe(true);
      expect(nomesColaboradorCompativeis('Guilherme Mancio da Silva', 'Guilherme Mancio')).toBe(true);
      expect(nomesColaboradorCompativeis('Cristiano Neves Caldeiras', 'Cristiano Vesentini Neves Caldeiras')).toBe(true);
      expect(nomesColaboradorCompativeis('Alisson Azevedo de Lima', 'Mariana Oliveira')).toBe(false);
    });
  });

  describe('Remoção Definitiva de Ex-Colaboradores & Cadastro Manual no FIORIX', () => {
    it('remove colaborador desligado com bloqueio persistente e auditoria WORM (DESATIVACAO)', async () => {
      vi.mocked(requireRole).mockResolvedValue({
        id: 'admin_henrique',
        tenantId,
        role: 'MASTER',
        name: 'Henrique Gama',
        email: 'henrique@7ri.com.br',
      } as any);

      const resRemove = await removerColaboradoresDaTelaFeriasAction({
        itens: [
          {
            usuarioId: 'user_ex_1',
            nome: 'Amanda Aparecida Gil',
            registroGestor: 44,
            setor: 'Registro',
          },
        ],
        motivo: 'Não trabalha mais nesta Serventia',
      });

      expect(resRemove.success).toBe(true);
      expect(resRemove.removidos).toBe(1);
      expect(recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'FERIAS',
          acao: 'DESATIVACAO',
        })
      );

      // Verifica que getEscalaAnual oculta colaboradores presentes em fiorix_ferias_colaboradores_excluidos
      vi.mocked(prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string) => {
        if (sql.includes('fiorix_ferias_publicacao')) {
          return [{ ano: 2027, status: 'PUBLICADA' }];
        }
        if (sql.includes('fiorix_ferias_escala')) {
          return [
            {
              id: 'esc_1',
              usuario_id: 'user_ex_1',
              ano: 2027,
              nome: 'Amanda Aparecida Gil',
              setor: 'Registro',
              p1_dias: 15,
              total_dias: 15,
              status: 'programado',
              historico: '[]',
            },
            {
              id: 'esc_2',
              usuario_id: 'c7ri_u_003',
              ano: 2027,
              nome: 'Alisson Azevedo de Lima',
              setor: 'Atendimento',
              p1_dias: 15,
              total_dias: 15,
              status: 'programado',
              historico: '[]',
            },
          ];
        }
        if (sql.includes('fiorix_ferias_colaboradores_excluidos')) {
          return [
            {
              usuario_id: 'user_ex_1',
              registro_gestor: 44,
              nome_normalizado: 'amanda aparecida gil',
            },
          ];
        }
        return [];
      });

      const escala = await getEscalaAnual(tenantId, 2027, 'admin_henrique', 'MASTER');
      expect(escala.colaboradores).toHaveLength(1);
      expect(escala.colaboradores[0].nome).toBe('Alisson Azevedo de Lima');
    });

    it('cadastra manualmente novo colaborador com validação de CPF e auditoria WORM (INCLUSAO)', async () => {
      vi.mocked(requireRole).mockResolvedValue({
        id: 'rh_nadia',
        tenantId,
        role: 'RH',
        name: 'Nadia Najjar',
        email: 'nadia@7ri.com.br',
      } as any);

      // CPF inválido deve ser bloqueado antes de gravar
      const invalido = await criarColaboradorManualFeriasAction({
        nome: 'Colaborador Teste CPF Inválido',
        cpf: '111.111.111-11',
        setor: 'Atendimento',
        ano: 2027,
      });
      expect(invalido.success).toBe(false);

      // Cadastro manual válido (pendente de férias)
      vi.mocked(prisma.$queryRawUnsafe as any).mockResolvedValue([]);
      const valido = await criarColaboradorManualFeriasAction({
        nome: 'Beatriz Helena Prado',
        registro: 140,
        cpf: '503.588.298-52',
        dataNascimento: '1998-04-15',
        sexo: 'Feminino',
        estadoCivil: 'Solteiro(a)',
        naturalidade: 'São Paulo',
        uf: 'SP',
        nacionalidade: 'Brasileiro(a)',
        dataAdmissao: '2026-10-01',
        setor: 'Atendimento',
        cargo: 'Escrevente',
        ano: 2027,
      });

      expect(valido.success).toBe(true);
      expect(valido.item?.nome).toBe('Beatriz Helena Prado');
      expect(valido.item?.status).toBe('pendente');
      expect(valido.item?.dadosGestor?.origemManual).toBe(true);
      expect(valido.item?.dadosGestor?.cpfMascarado).toBe('***.588.298-**');
      expect(recordAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          modulo: 'FERIAS',
          acao: 'INCLUSAO',
        })
      );
    });
  });
});
