import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  avaliarTempestividadeUpload,
  calcularPrazoLegalClt,
  classificarAcessosHolerite,
  extrairMetadadosNomeArquivoHolerite,
  gerarComprovanteCienciaHoleriteHash,
  gerarManifestHashCompetencia,
} from '@/lib/holerites/clt-prazo-calculator';
import { obterPainelGovernancaHolerites } from '@/lib/holerites/holerites-governance-repository';
import { homologarCompetenciaHoleritesAction } from '@/app/actions/holerites';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit';

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

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    storage: {
      from: vi.fn(() => ({
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.example' }, error: null }),
      })),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
    user: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    fiorixHolerite: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    fiorixAcessoLog: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    fiorixFeriasPrevista: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

describe('Governança Trabalhista CLT, Assistente de Faltantes e Dossiê Corregedoria', () => {
  const tenantId = 'cms3xd0wm00002pw9j2k0ahan';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calcula o 5º dia útil salarial CLT (Art. 459 § 1º + Súmula 381 TST) descontando domingos e feriados de SP', () => {
    // Competência Outubro/2026 -> Novembro/2026:
    // 01/11/2026 = Domingo, 02/11/2026 = Finados -> dias úteis: 03, 04, 05, 06, 07/11 (Sábado)
    const out2026 = calcularPrazoLegalClt(2026, 10);
    expect(out2026.dataLimiteIso).toBe('2026-11-07');
    expect(out2026.dataLimiteBr).toBe('07/11/2026');
    expect(out2026.caiNoSabado).toBe(true);
    expect(out2026.sextaBancariaRecomendadaBr).toBe('06/11/2026');

    // Competência Abril/2026 -> Maio/2026:
    // 01/05/2026 = Dia do Trabalho (feriado), 02/05 Sáb (1º), 03/05 Dom, 04 (2º), 05 (3º), 06 (4º), 07/05 (5º)
    const abr2026 = calcularPrazoLegalClt(2026, 4);
    expect(abr2026.dataLimiteIso).toBe('2026-05-07');

    // 13º Salário 1ª Parcela (até 30/11/2026 - Segunda-feira)
    const dec1 = calcularPrazoLegalClt(2026, 13);
    expect(dec1.dataLimiteIso).toBe('2026-11-30');

    // 13º Salário 2ª Parcela (20/12/2026 cai no Domingo -> antecipa para Sábado 19/12/2026)
    const dec2 = calcularPrazoLegalClt(2026, 14);
    expect(dec2.dataLimiteIso).toBe('2026-12-19');
    expect(dec2.caiNoSabado).toBe(true);
    expect(dec2.sextaBancariaRecomendadaBr).toBe('18/12/2026');
  });

  it('avalia tempestividade de upload no fuso de São Paulo e extrai metadados mensais e de 13º salário', () => {
    const tempOk = avaliarTempestividadeUpload('2026-11-07T09:44:54.000Z', '2026-11-07');
    expect(tempOk.noPrazo).toBe(true);
    expect(tempOk.diasAtraso).toBe(0);

    const tempAtraso = avaliarTempestividadeUpload('2026-11-10T14:00:00.000Z', '2026-11-07');
    expect(tempAtraso.noPrazo).toBe(false);
    expect(tempAtraso.diasAtraso).toBe(3);

    expect(extrairMetadadosNomeArquivoHolerite('52998224725_10-2026.pdf')).toEqual({
      rawCpfToken: '52998224725',
      mes: 10,
      ano: 2026,
    });
    expect(extrairMetadadosNomeArquivoHolerite('52998224725_13-1-2026.pdf')).toEqual({
      rawCpfToken: '52998224725',
      mes: 13,
      ano: 2026,
    });
    expect(extrairMetadadosNomeArquivoHolerite('52998224725_13-2-2026.pdf')).toEqual({
      rawCpfToken: '52998224725',
      mes: 14,
      ano: 2026,
    });
  });

  it('apurou faltantes respeitando Data de Admissão, desligados e dispensas legais justificadas', async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u_antigo', name: 'Antonio Carlos Belato Câmara', cpf: '52998224725', departamento: 'Administrativo', cargo: 'Escrevente' },
      { id: 'u_novo', name: 'Willian Araujo dos Santos', cpf: null, departamento: 'Administrativo', cargo: 'Auxiliar' },
    ] as any);

    (prisma.$queryRawUnsafe as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM public.fiorix_rh_colaboradores_gestor')) {
        return [
          {
            id: 'g1',
            registro_gestor: 2,
            usuario_id: 'u_antigo',
            nome: 'Antonio Carlos Belato Câmara',
            cpf: '52998224725',
            data_admissao: '1999-01-04',
            cargo: 'Escrevente',
            setor: 'Administrativo',
            ativo: true,
            excluido_fiorix: false,
          },
          {
            id: 'g2',
            registro_gestor: 134,
            usuario_id: 'u_novo',
            nome: 'Willian Araujo dos Santos',
            cpf: null,
            data_admissao: '2026-09-11',
            cargo: 'Auxiliar',
            setor: 'Administrativo',
            ativo: true,
            excluido_fiorix: false,
          },
          {
            id: 'g3',
            registro_gestor: 999,
            usuario_id: null,
            nome: 'Ex Colaborador Desligado',
            cpf: null,
            data_admissao: '2020-01-10',
            cargo: 'Auxiliar',
            setor: 'Balcao',
            ativo: false,
            excluido_fiorix: true,
          },
        ];
      }
      if (sql.includes('FROM public.fiorix_holerites_dispensas')) {
        return [
          {
            id: 'disp_1',
            usuario_id: 'u_novo',
            registro_gestor: 134,
            nome_normalizado: 'willian araujo dos santos',
            colaborador_nome: 'Willian Araujo dos Santos',
            ano: 2026,
            mes: 10,
            motivo_codigo: 'AFASTAMENTO_INSS',
            descricao: 'Auxílio-doença',
            registrado_por_nome: 'Nadia Najjar',
            created_at: new Date('2026-11-05T12:00:00Z'),
          },
        ];
      }
      return [];
    });

    vi.mocked(prisma.fiorixHolerite.findMany).mockImplementation((async (args: any) => {
      if (args?.distinct) return [{ ano: 2026 }];
      return [
        {
          id: 'hol_1',
          tenantId,
          usuarioId: 'u_antigo',
          mes: 10,
          ano: 2026,
          arquivoNome: '52998224725_10-2026.pdf',
          arquivoHash: 'a'.repeat(64),
          dataUpload: new Date('2026-11-07T09:44:54Z'),
          usuario: { id: 'u_antigo', name: 'Antonio Carlos Belato Câmara' },
        },
      ];
    }) as any);
    vi.mocked(prisma.fiorixHolerite.count).mockResolvedValue(1);

    const painel = await obterPainelGovernancaHolerites(tenantId, 2026);
    expect(painel.totalColaboradoresAtivos).toBe(2); // Ex-colaborador desligado não entra

    // Em Maio/2026, Willian (admitido em 11/09/2026) não era admitido -> apenas 1 elegível!
    const maio = painel.competencias.find((c) => c.mes === 5)!;
    expect(maio.elegiveisCount).toBe(1);
    expect(maio.faltantesCount).toBe(1);
    expect(maio.faltantes[0].nome).toBe('Antonio Carlos Belato Câmara');

    // Em Outubro/2026, ambos são elegíveis (2): Antonio tem PDF arquivado e Willian tem dispensa INSS -> 0 faltantes!
    const outubro = painel.competencias.find((c) => c.mes === 10)!;
    expect(outubro.elegiveisCount).toBe(2);
    expect(outubro.arquivadosCount).toBe(1);
    expect(outubro.dispensadosCount).toBe(1);
    expect(outubro.faltantesCount).toBe(0);
    expect(outubro.percentualCobertura).toBe(100);
  });

  it('homologa competência gerando manifesto SHA-256 determinístico e gravando auditoria WORM', async () => {
    vi.mocked(requireRole).mockResolvedValue({
      id: 'user_rh_1',
      name: 'Nadia Najjar',
      email: 'rh@7ri.com.br',
      role: 'RH',
      tenantId,
    } as any);

    const h1 = '1'.repeat(64);
    const h2 = '2'.repeat(64);
    expect(gerarManifestHashCompetencia(tenantId, 2026, 10, [h2, h1])).toBe(
      gerarManifestHashCompetencia(tenantId, 2026, 10, [h1, h2])
    );

    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: 'u_1', name: 'Bruno Alves Santos', cpf: '52998224725', departamento: 'Atendimento', cargo: 'Auxiliar' },
    ] as any);
    vi.mocked(prisma.fiorixHolerite.findMany).mockResolvedValue([
      {
        id: 'hol_b1',
        tenantId,
        usuarioId: 'u_1',
        mes: 10,
        ano: 2026,
        arquivoNome: '52998224725_10-2026.pdf',
        arquivoHash: h1,
        dataUpload: new Date('2026-11-06T12:00:00Z'),
        usuario: { id: 'u_1', name: 'Bruno Alves Santos' },
      },
    ] as any);

    const res = await homologarCompetenciaHoleritesAction({
      ano: 2026,
      mes: 10,
      observacoes: 'Fechamento integral dentro do 5º dia útil CLT',
    });

    expect(res.success).toBe(true);
    expect(res.manifestHashSha256).toHaveLength(64);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        modulo: 'HOLERITES',
        acao: 'HOMOLOGACAO',
      })
    );
  });

  it('separa estritamente inspeções técnicas do RH dos acessos e ciência do colaborador titular (Art. 464 CLT)', () => {
    // 1. Apenas RH visualizou (2 vezes): status do colaborador DEVE permanecer 'Ativo' e acessosTitular = 0
    const apenasRh = classificarAcessosHolerite({
      titularUsuarioId: 'colab_anne',
      logs: [
        {
          usuarioId: 'rh_nadia',
          tipo: 'holerite_download_authorized',
          dataAcesso: '2026-11-07T09:45:10Z',
        },
        {
          usuarioId: 'rh_nadia',
          tipo: 'holerite_rh_inspecao',
          dataAcesso: '2026-11-07T09:46:00Z',
        },
      ],
    });
    expect(apenasRh.acessosTitular).toBe(0);
    expect(apenasRh.inspecoesRh).toBe(2);
    expect(apenasRh.status).toBe('Ativo');
    expect(apenasRh.primeiraVisualizacaoTitularEm).toBeNull();

    // 2. Titular abriu o PDF: status avança para 'Visualizado'
    const titularAbriu = classificarAcessosHolerite({
      titularUsuarioId: 'colab_anne',
      logs: [
        {
          usuarioId: 'rh_nadia',
          tipo: 'holerite_rh_inspecao',
          dataAcesso: '2026-11-07T09:45:10Z',
        },
        {
          usuarioId: 'colab_anne',
          tipo: 'holerite_download_authorized',
          dataAcesso: '2026-11-07T11:30:00Z',
        },
      ],
    });
    expect(titularAbriu.acessosTitular).toBe(1);
    expect(titularAbriu.inspecoesRh).toBe(1);
    expect(titularAbriu.status).toBe('Visualizado');
    expect(titularAbriu.primeiraVisualizacaoTitularEm?.toISOString()).toBe('2026-11-07T11:30:00.000Z');

    // 3. Titular clicou em "Confirmar Recebimento" (Ciência expressa MP 2.200-2/2001): status 'Ciente' + recibo SHA-256
    const reciboSha256 = gerarComprovanteCienciaHoleriteHash({
      tenantId,
      holeriteId: 'hol_anne_10_2026',
      usuarioId: 'colab_anne',
      ano: 2026,
      mes: 10,
      arquivoHash: 'f'.repeat(64),
      cienciaConfirmadaEmIso: '2026-11-07T11:32:00.000Z',
      ip: '189.40.10.20',
    });
    expect(reciboSha256).toMatch(/^[a-f0-9]{64}$/);

    const titularCiente = classificarAcessosHolerite({
      titularUsuarioId: 'colab_anne',
      cienciaConfirmadaEmColuna: '2026-11-07T11:32:00.000Z',
      cienciaComprovanteHashColuna: reciboSha256,
      logs: [
        {
          usuarioId: 'colab_anne',
          tipo: 'holerite_download_authorized',
          dataAcesso: '2026-11-07T11:30:00Z',
        },
        {
          usuarioId: 'colab_anne',
          tipo: 'holerite_ciencia_confirmada',
          dataAcesso: '2026-11-07T11:32:00Z',
        },
      ],
    });
    expect(titularCiente.status).toBe('Ciente');
    expect(titularCiente.acessosTitular).toBe(1);
  });
});
