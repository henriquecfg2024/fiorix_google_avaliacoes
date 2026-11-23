import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as XLSX from 'xlsx';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  isRouteAllowedForUser: vi.fn(),
  getAllowedNavItemsForUser: vi.fn(),
  isNavPermissionsFeatureEnabled: vi.fn(() => true),
  isSameOriginRequest: vi.fn(() => true),
  resolveEffectiveDocumentConnector: vi.fn(),
  createJob: vi.fn(),
  readSearch: vi.fn(),
  recordAuditLog: vi.fn(),
  prisma: {
    fiorixReurbRegularizacao: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
    },
    fiorixReurbDerivada: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    fiorixReurbPendencia: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    fiorixReurbExportacao: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: mocks.requireAuth,
}));

vi.mock('@/lib/nav-permissions/service', () => ({
  isRouteAllowedForUser: mocks.isRouteAllowedForUser,
  getAllowedNavItemsForUser: mocks.getAllowedNavItemsForUser,
  isNavPermissionsFeatureEnabled: mocks.isNavPermissionsFeatureEnabled,
}));

vi.mock('@/lib/documental/origin', () => ({
  isSameOriginRequest: mocks.isSameOriginRequest,
}));

vi.mock('@/lib/connector/ha-manager', () => ({
  resolveEffectiveDocumentConnector: mocks.resolveEffectiveDocumentConnector,
}));

vi.mock('@/lib/documental/store', () => ({
  createJob: mocks.createJob,
  readSearch: mocks.readSearch,
}));

vi.mock('@/lib/audit', () => ({
  recordAuditLog: mocks.recordAuditLog,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { getDemoReurbRegularizacoes } from '@/lib/reurb/demo-fixtures';
import {
  construirJsonImportacaoOnr,
  validarRegularizacaoParaOnr,
} from '@/lib/reurb/onr-exporter';
import {
  calcularPainelReurb,
  filtrarProcessosReurb,
  isRegularizacaoAptaAtual,
  montarRelatoriosReurb,
} from '@/lib/reurb/query-service';
import { gerarBufferExcelReurb, sanitizeSpreadsheetCell } from '@/lib/reurb/excel-export';
import {
  ReurbAccessError,
  requireReurbAccess,
  requireReurbConfirmImportAccess,
  requireReurbExportAccess,
} from '@/lib/reurb/permissions';
import {
  confirmarImportacaoOnrReurb,
  executarGeracaoJsonReurb,
} from '@/lib/reurb/export-service';
import {
  escapePrintHtml,
  filtrarProcessosPainel,
  gerarHtmlImpressaoPainel,
  hasActivePainelFilters,
  INITIAL_PAINEL_COLUMN_FILTERS,
} from '@/components/reurb/reurb-ui-helpers';

function makeDbRowFromDto(reg: ReturnType<typeof getDemoReurbRegularizacoes>[number], idOverride?: string) {
  return {
    id: idOverride || reg.id.replace('demo-reurb-', 'db-reurb-'),
    tenantId: 'tenant-1',
    recordKey: reg.recordKey,
    prenotacao: reg.prenotacao,
    matricula: reg.matricula,
    complMatricula: reg.complMatricula,
    protocolo: reg.protocolo,
    empreendimento: reg.empreendimento,
    empreendimentoFonte: reg.empreendimentoFonte,
    empreendimentoTrechoOcr: reg.empreendimentoTrechoOcr,
    negId: reg.negId,
    classificacaoFinal: reg.classificacaoFinal,
    modalidade: reg.modalidade,
    tipoInteresse: reg.tipoInteresse,
    dataRegistro: reg.dataRegistro ? new Date(`${reg.dataRegistro}T00:00:00Z`) : null,
    dataPrenotacao: reg.dataPrenotacao ? new Date(`${reg.dataPrenotacao}T00:00:00Z`) : null,
    municipio: reg.municipio,
    distrito: reg.distrito,
    subdistrito: reg.subdistrito,
    bairro: reg.bairro,
    bairroSugerido: reg.bairroSugerido,
    tipoLocalizacao: reg.tipoLocalizacao,
    quantidadeUnidades: reg.quantidadeUnidades,
    qtdDerivadasLista: reg.qtdDerivadasLista,
    qtdAreasPublicasExcluidas: reg.qtdAreasPublicasExcluidas,
    tipoAgente: reg.tipoAgente,
    agente: reg.agente,
    situacaoValidacao: reg.situacaoValidacao,
    qtdBloqueios: reg.qtdBloqueios,
    qtdAlertas: reg.qtdAlertas,
    ehArt69: reg.ehArt69,
    fontesJson: reg.fontes,
    atosVinculadosJson: reg.atosVinculados,
    ultimaExportacaoEm: reg.ultimaExportacaoEm ? new Date(reg.ultimaExportacaoEm) : null,
    ultimaImportacaoConfirmadaEm: reg.ultimaImportacaoConfirmadaEm
      ? new Date(reg.ultimaImportacaoConfirmadaEm)
      : null,
    syncedAt: new Date('2026-11-19T12:00:00Z'),
    derivadas: reg.derivadas.map((d, idx) => ({
      id: `der-${idx}`,
      matriculaDerivada: d.matriculaDerivada,
      complMatricula: d.complMatricula,
      dataAbertura: d.dataAbertura ? new Date(`${d.dataAbertura}T00:00:00Z`) : null,
      dataRegistro: d.dataRegistro ? new Date(`${d.dataRegistro}T00:00:00Z`) : null,
      tipoInteresse: d.tipoInteresse,
      incluirNoJson: d.incluirNoJson,
      ehAreaPublica: d.ehAreaPublica,
      ehCondominioIntermediario: d.ehCondominioIntermediario,
      categoriaArea: d.categoriaArea,
      vinculoMetodo: d.vinculoMetodo,
      motivoExclusao: d.motivoExclusao,
      fonteOcr: d.fonteOcr,
    })),
    pendencias: reg.pendencias.map((p, idx) => ({
      id: `pend-${idx}`,
      matriculaDerivada: p.matriculaDerivada,
      campo: p.campo,
      severidade: p.severidade,
      motivo: p.motivo,
      fonte: p.fonte,
      acaoNecessaria: p.acaoNecessaria,
      exigeConferencia: p.exigeConferencia,
    })),
  };
}

describe('Central REURB — Validador & Construtor ONR v1.4', () => {
  it('gera JSON ONR v1.4 válido excluindo APMs/vias públicas e mantendo U/R como string', () => {
    const demo = getDemoReurbRegularizacoes();
    const reg900101 = demo[0]!; // 24 unidades + 2 APMs
    const val = validarRegularizacaoParaOnr(reg900101);

    expect(val.apto).toBe(true);
    expect(val.registroOnr).not.toBeNull();
    expect(val.registroOnr!.tipoLocalizacao).toBe('U');
    expect(val.registroOnr!.quantidadeUnidades).toBe(24);
    expect(val.registroOnr!.derivadas).toHaveLength(24);
    expect(val.registroOnr!.derivadas.some((d) => d.matricula === 950025 || d.matricula === 950026)).toBe(false);
  });

  it('preenche subdistrito GUAIANASES automaticamente no distrito de Guaianases, exige subdistrito nos demais distritos e aceita dataRegistro null', () => {
    const demo = getDemoReurbRegularizacoes();
    const reg900102 = demo[1]!; // distrito GUAIANASES e subdistrito null no WEBRI
    const val = validarRegularizacaoParaOnr(reg900102);

    expect(val.apto).toBe(true);
    expect(val.registroOnr!.subdistrito).toBe('GUAIANASES');

    const guaianazesZ = { ...reg900102, distrito: 'GUAIANAZES', subdistrito: null };
    const valZ = validarRegularizacaoParaOnr(guaianazesZ);
    expect(valZ.apto).toBe(true);
    expect(valZ.registroOnr!.subdistrito).toBe('GUAIANASES');

    const outroSemSub = { ...demo[4]!, distrito: 'ITAQUERA', subdistrito: null };
    const valSemSub = validarRegularizacaoParaOnr(outroSemSub);
    expect(valSemSub.apto).toBe(false);
    expect(valSemSub.bloqueios.some((b) => b.campo === 'subdistrito')).toBe(true);

    const agenteLongo = { ...reg900102, agente: 'A'.repeat(101) };
    const valAgLongo = validarRegularizacaoParaOnr(agenteLongo);
    expect(valAgLongo.apto).toBe(false);
    expect(valAgLongo.bloqueios.some((b) => b.campo === 'agente')).toBe(true);

    const untitledDer = val.registroOnr!.derivadas.find((d) => d.matricula === 951012);
    expect(untitledDer).toBeDefined();
    expect(untitledDer!.dataRegistro).toBeNull();

    const reg900105 = demo[4]!; // Oct/2026 REURB-E com 1 derivada sem dataAbertura
    const valOct = validarRegularizacaoParaOnr(reg900105);
    expect(valOct.apto).toBe(true);
    expect(valOct.avisos.some((a) => a.campo === 'derivadas.dataAbertura' && a.severidade === 'MEDIA')).toBe(true);
    const noAberturaDer = valOct.registroOnr!.derivadas.find((d) => d.matricula === 954008);
    expect(noAberturaDer).toBeDefined();
    expect('dataAbertura' in noAberturaDer!).toBe(false);
  });

  it('permite divergência entre quantidadeUnidades e total de derivadas como alerta MEDIA (Manual pág. 25)', () => {
    const demo = getDemoReurbRegularizacoes();
    const cloned = { ...demo[0]!, quantidadeUnidades: 30 };
    const val = validarRegularizacaoParaOnr(cloned);

    expect(val.apto).toBe(true);
    expect(val.avisos.some((a) => a.campo === 'quantidadeUnidades' && a.severidade === 'MEDIA')).toBe(true);
  });

  it('bloqueia bairro ausente com sugestão sem preencher automaticamente e bloqueia bairro > 30 chars sem abreviar', () => {
    const demo = getDemoReurbRegularizacoes();
    const pendenteBairro = demo[2]!;
    expect(validarRegularizacaoParaOnr(pendenteBairro).apto).toBe(false);

    const bairroLongo = {
      ...demo[0]!,
      bairro: 'PARQUE RESIDENCIAL NOME MUITO LONGO QUE EXCEDE TRINTA',
    };
    const resLongo = validarRegularizacaoParaOnr(bairroLongo);
    expect(resLongo.apto).toBe(false);
    expect(resLongo.bloqueios.some((b) => b.campo === 'bairro')).toBe(true);
  });

  it('bloqueia dataRegistro anterior a 2009-03-25 (MP 459/2009) e parametriza art. 69', () => {
    const demo = getDemoReurbRegularizacoes();
    const antiga = { ...demo[0]!, dataRegistro: '2008-12-10' };
    const resAntiga = validarRegularizacaoParaOnr(antiga);
    expect(resAntiga.apto).toBe(false);

    const art69 = demo[6]!;
    expect(validarRegularizacaoParaOnr(art69, { incluirArt69: false }).apto).toBe(false);

    const art69Liberada = {
      ...art69,
      pendencias: [],
    };
    const resArt69 = validarRegularizacaoParaOnr(art69Liberada, { incluirArt69: true });
    expect(resArt69.apto).toBe(true);
    expect(resArt69.registroOnr!.tipoInteresse).toBe(3);
    expect(resArt69.registroOnr!.derivadas.every((d) => d.tipoInteresse === 3)).toBe(true);
  });

  it('permite reexportação de regularização já exportada anteriormente', () => {
    const demo = getDemoReurbRegularizacoes();
    const jaExportada = demo[3]!; // statusImportacaoOnr = IMPORTADA_ONR
    const built = construirJsonImportacaoOnr([jaExportada]);
    expect(built.aptas).toHaveLength(1);
    expect(built.payload.regularizacoes[0]!.matricula).toBe(900104);
  });
});

describe('Central REURB — Engine Compartilhada (Painel, Consulta, Relatórios e Excel)', () => {
  it('calcula exatamente Nov/2026 (3 registradas, 84 derivadas com cross-month, 2 aptas, 1 pendência) com consistência Painel <-> Consulta <-> Relatórios', () => {
    const demo = getDemoReurbRegularizacoes();
    const painel = calcularPainelReurb(demo, 2026, 11, true);

    expect(painel.kpis.registradas).toBe(3);
    expect(painel.kpis.derivadasAbertas).toBe(84);
    expect(painel.kpis.aptasExportacao).toBe(2);
    expect(painel.kpis.comPendencias).toBe(1);
    expect(painel.derivadasPeriodoResumo.derivadasDeOutroMes).toBe(30);

    const consultaReg = filtrarProcessosReurb(demo, { ano: 2026, mes: 11, tipoData: 'registro' });
    const consultaAptas = filtrarProcessosReurb(demo, {
      ano: 2026,
      mes: 11,
      tipoData: 'registro',
      situacao: 'APTO',
    });
    const consultaPend = filtrarProcessosReurb(demo, {
      ano: 2026,
      mes: 11,
      tipoData: 'registro',
      situacao: 'PENDENTE',
    });
    const consultaDeriv = filtrarProcessosReurb(demo, {
      ano: 2026,
      mes: 11,
      tipoData: 'abertura_derivada',
    });

    expect(consultaReg.total).toBe(painel.kpis.registradas);
    expect(consultaAptas.total).toBe(painel.kpis.aptasExportacao);
    expect(consultaPend.total).toBe(painel.kpis.comPendencias);
    expect(consultaDeriv.itens.some((i) => i.matricula === 900106)).toBe(true);

    const rel = montarRelatoriosReurb(demo, 2026, 11, true);
    expect(rel.totais.registradas).toBe(painel.kpis.registradas);
    expect(rel.totais.derivadasAbertas).toBe(painel.kpis.derivadasAbertas);
    expect(rel.totais.aptas).toBe(painel.kpis.aptasExportacao);
    expect(rel.totais.comPendencias).toBe(painel.kpis.comPendencias);
    expect(rel.evolucaoMensal[10]!.derivadasAbertas).toBe(84);

    // Busca por derivada de matriz antiga
    const buscaDer = filtrarProcessosReurb(demo, { busca: '955016' });
    expect(buscaDer.total).toBe(1);
    expect(buscaDer.itens[0]!.matricula).toBe(900106);
  });

  it('gera Excel (.xlsx) válido e neutraliza formula injection nas células', () => {
    expect(sanitizeSpreadsheetCell('=SUM(A1:A5)')).toBe("'=SUM(A1:A5)");
    expect(sanitizeSpreadsheetCell('+cmd|calc')).toBe("'+cmd|calc");
    expect(sanitizeSpreadsheetCell('-1+1')).toBe("'-1+1");
    expect(sanitizeSpreadsheetCell('@HYPERLINK')).toBe("'@HYPERLINK");
    expect(sanitizeSpreadsheetCell('Jardim Aurora')).toBe('Jardim Aurora');

    const demo = getDemoReurbRegularizacoes();
    const poisoned = [{ ...demo[0]!, empreendimento: '=HYPERLINK("http://x","clic")' }];
    const painel = calcularPainelReurb(poisoned, 2026, 11, false);
    const rel = montarRelatoriosReurb(poisoned, 2026, 11, false);
    const buf = gerarBufferExcelReurb({ relatorio: rel, painel, processos: poisoned });

    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
    const wb = XLSX.read(buf, { type: 'buffer' });
    expect(wb.SheetNames).toContain('Resumo por Modalidade');
    expect(wb.SheetNames).toContain('Processos e Pendencias');
    const procSheet = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets['Processos e Pendencias']!
    );
    expect(String(procSheet[0]!.Empreendimento)).toMatch(/^'=HYPERLINK/);
  });
});

describe('Central REURB — RBAC, Exportação e Revalidação Fail-Closed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNavPermissionsFeatureEnabled.mockReturnValue(true);
    mocks.isSameOriginRequest.mockReturnValue(true);
    mocks.isRouteAllowedForUser.mockResolvedValue(true);
  });

  it('garante VISITANTE estritamente somente leitura e rejeita 401/403 nas mutações', async () => {
    mocks.requireAuth.mockRejectedValueOnce(new Error('Não autorizado'));
    await expect(requireReurbAccess()).rejects.toMatchObject({ status: 401 });

    mocks.requireAuth.mockResolvedValue({
      id: 'u-vis',
      tenantId: 'tenant-1',
      role: 'VISITANTE',
      name: 'Visitante',
      email: 'v@cartorio.br',
    });
    const ctxVis = await requireReurbAccess();
    expect(ctxVis.isReadOnly).toBe(true);
    expect(ctxVis.canExportJson).toBe(false);
    expect(ctxVis.canConfirmImport).toBe(false);

    await expect(requireReurbExportAccess()).rejects.toBeInstanceOf(ReurbAccessError);
    await expect(requireReurbConfirmImportAccess()).rejects.toMatchObject({ status: 403 });

    mocks.requireAuth.mockResolvedValue({
      id: 'u-col',
      tenantId: 'tenant-1',
      role: 'COLABORADOR',
      name: 'Escrevente',
      email: 'e@cartorio.br',
    });
    mocks.isRouteAllowedForUser.mockResolvedValueOnce(false);
    await expect(requireReurbAccess()).rejects.toMatchObject({ status: 403 });

    mocks.isRouteAllowedForUser.mockResolvedValue(true);
    mocks.getAllowedNavItemsForUser.mockResolvedValue({
      enabled: true,
      allowedItemIds: ['reurb_central', 'reurb_exportar_json'],
    });
    const ctxCol = await requireReurbAccess();
    expect(ctxCol.canExportJson).toBe(true);
    expect(ctxCol.canConfirmImport).toBe(false);
    expect(isRegularizacaoAptaAtual(getDemoReurbRegularizacoes()[0]!)).toBe(true);
  });

  it('bloqueia geração (fail-closed 503) e persiste FALHA quando Connector está offline', async () => {
    const dbRow = makeDbRowFromDto(getDemoReurbRegularizacoes()[0]!, 'db-900101');
    mocks.prisma.fiorixReurbRegularizacao.findMany.mockResolvedValue([dbRow]);
    mocks.resolveEffectiveDocumentConnector.mockResolvedValue(null);
    mocks.prisma.fiorixReurbExportacao.create.mockResolvedValue({ id: 'exp-fail-1' });

    const res = await executarGeracaoJsonReurb({
      ctx: {
        user: { id: 'u-1', tenantId: 'tenant-1', role: 'ADMIN', name: 'Admin' },
        canView: true,
        canExportJson: true,
        canConfirmImport: true,
        isReadOnly: false,
      },
      ids: ['db-900101'],
      tipo: 'UNITARIA',
    });

    expect(res.ok).toBe(false);
    expect(res.statusHttp).toBe(503);
    expect(mocks.prisma.fiorixReurbExportacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statusGeracao: 'FALHA',
          statusImportacaoOnr: 'NAO_GERADO',
        }),
      })
    );
  });

  it('executa lote misto (409 antes da confirmação, 200 após confirmarMisto), zero apto (422) e confirmação ONR separada', async () => {
    const demo = getDemoReurbRegularizacoes();
    const rowApta = makeDbRowFromDto(demo[0]!, 'db-900101');
    const rowPend = makeDbRowFromDto(demo[2]!, 'db-900103');

    mocks.prisma.fiorixReurbRegularizacao.findMany.mockResolvedValue([rowApta, rowPend]);
    mocks.resolveEffectiveDocumentConnector.mockResolvedValue({
      connectorId: 'conn-1',
      lastSeenAt: new Date(),
      version: 'v2.6.24',
    });
    // Retorna string jobId conforme comportamento real do createJob()
    mocks.createJob.mockResolvedValue('job-reval-uuid-1');
    mocks.readSearch.mockResolvedValue({
      id: 'job-reval-uuid-1',
      type: 'reurb_revalidar',
      query: '{}',
      status: 'complete',
      result: {
        sucesso: true,
        ocrConsultado: true,
        revalidadoEm: '2026-11-19T19:00:00.000Z',
        registros: [demo[0]!, demo[2]!],
      },
      expiresAt: new Date(Date.now() + 60_000),
    });

    mocks.prisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mocks.prisma) => Promise<unknown>) => fn(mocks.prisma)
    );
    mocks.prisma.fiorixReurbRegularizacao.findUnique.mockResolvedValue({ id: 'db-900101' });
    mocks.prisma.fiorixReurbRegularizacao.upsert.mockResolvedValue({ id: 'db-900101' });
    mocks.prisma.fiorixReurbExportacao.create.mockImplementation(
      async ({
        data,
      }: {
        data: Record<string, unknown> & { itens: { create: Array<Record<string, unknown>> } };
      }) => ({
        ...data,
        createdAt: new Date('2026-11-19T19:00:00Z'),
        itens: data.itens.create.map((it) => ({ ...it })),
      })
    );

    const ctx = {
      user: { id: 'u-1', tenantId: 'tenant-1', role: 'ADMIN', name: 'Admin' },
      canView: true,
      canExportJson: true,
      canConfirmImport: true,
      isReadOnly: false,
    };

    // 1) Somente pendente -> 422 sem gerar JSON
    const resZero = await executarGeracaoJsonReurb({
      ctx,
      ids: ['db-900103'],
      tipo: 'LOTE',
    });
    expect(resZero.ok).toBe(false);
    expect(resZero.statusHttp).toBe(422);

    // 2) Misto sem confirmarMisto -> 409
    const resMisto409 = await executarGeracaoJsonReurb({
      ctx,
      ids: ['db-900101', 'db-900103'],
      tipo: 'LOTE',
      confirmarMisto: false,
    });
    expect(resMisto409.ok).toBe(false);
    expect(resMisto409.statusHttp).toBe(409);

    // 3) Misto com confirmarMisto=true -> 200 apenas com os aptos e status ONR pendente de confirmação
    const resMisto200 = await executarGeracaoJsonReurb({
      ctx,
      ids: ['db-900101', 'db-900103'],
      tipo: 'LOTE',
      confirmarMisto: true,
    });
    expect(resMisto200.ok).toBe(true);
    if (resMisto200.ok) {
      expect(resMisto200.payload.regularizacoes).toHaveLength(1);
      expect(resMisto200.exportacao.statusImportacaoOnr).toBe('PENDENTE_CONFIRMACAO');
      expect(resMisto200.exportacao.ocrConsultado).toBe(true);
    }

    // 4) Confirmação manual no ONR registrada separadamente
    mocks.prisma.fiorixReurbExportacao.findFirst.mockResolvedValue({
      id: 'exp-1',
      statusGeracao: 'GERADO',
      nomeArquivoJson: 'reurb.json',
      qtdAptasGeradas: 1,
      itens: [{ incluidaNoJson: true, regularizacaoId: 'db-900101' }],
    });
    mocks.prisma.fiorixReurbExportacao.update.mockResolvedValue({
      id: 'exp-1',
      tipo: 'LOTE',
      statusGeracao: 'GERADO',
      statusImportacaoOnr: 'CONFIRMADA_ONR',
      nomeArquivoJson: 'reurb.json',
      nomeArquivoPendencias: null,
      qtdSolicitadas: 1,
      qtdAptasGeradas: 1,
      qtdBarradas: 0,
      qtdDerivadasIncluidas: 24,
      jsonSha256: 'abc',
      erroDetalhe: null,
      revalidacaoConnectorId: 'conn-1',
      revalidadoEm: new Date(),
      ocrConsultado: true,
      geradoPorNome: 'Admin',
      confirmadoImportacaoEm: new Date(),
      confirmadoPorNome: 'Admin',
      protocoloOnrExterno: 'ONR-999',
      observacaoConfirmacao: 'Protocolado',
      createdAt: new Date(),
      itens: [],
    });

    const conf = await confirmarImportacaoOnrReurb({
      ctx,
      exportacaoId: 'exp-1',
      protocoloOnrExterno: 'ONR-999',
      observacao: 'Protocolado',
    });
    expect(conf.ok).toBe(true);
    if (conf.ok) {
      expect(conf.exportacao.statusImportacaoOnr).toBe('CONFIRMADA_ONR');
    }
  });

  it('bloqueia revalidação fail-closed (503) e preserva o banco quando ocrConsultado retorna false', async () => {
    const dbRow = makeDbRowFromDto(getDemoReurbRegularizacoes()[0]!, 'db-900101');
    mocks.prisma.fiorixReurbRegularizacao.findMany.mockResolvedValue([dbRow]);
    mocks.resolveEffectiveDocumentConnector.mockResolvedValue({
      connectorId: 'conn-1',
      lastSeenAt: new Date(),
      version: 'v2.6.27',
    });
    mocks.createJob.mockResolvedValue('job-no-ocr-1');
    mocks.readSearch.mockResolvedValue({
      id: 'job-no-ocr-1',
      type: 'reurb_revalidar',
      query: '{}',
      status: 'complete',
      result: {
        sucesso: true,
        ocrConsultado: false,
        ocrErro: 'ECONNREFUSED 10.0.0.6:5432',
        revalidadoEm: '2026-11-23T13:30:00.000Z',
        registros: [],
      },
      expiresAt: new Date(Date.now() + 60_000),
    });
    mocks.prisma.fiorixReurbExportacao.create.mockResolvedValue({ id: 'exp-no-ocr-1' });

    const res = await executarGeracaoJsonReurb({
      ctx: {
        user: { id: 'u-1', tenantId: 'tenant-1', role: 'ADMIN', name: 'Admin' },
        canView: true,
        canExportJson: true,
        canConfirmImport: true,
        isReadOnly: false,
      },
      ids: ['db-900101'],
      tipo: 'UNITARIA',
    });

    expect(res.ok).toBe(false);
    expect(res.statusHttp).toBe(503);
    expect(res.error).toContain('SRVSIPLANIA');
    expect(mocks.prisma.fiorixReurbRegularizacao.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.fiorixReurbExportacao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statusGeracao: 'FALHA',
          ocrConsultado: false,
        }),
      })
    );
  });
});

describe('Central REURB — Filtros de Coluna e Impressão do Painel', () => {
  it('filtra simultaneamente por todas as colunas da tabela de regularizações do período', () => {
    const demo = getDemoReurbRegularizacoes();
    const semNome = { ...demo[2]!, empreendimento: null };
    const lista = [demo[0]!, demo[1]!, semNome, demo[4]!];

    expect(hasActivePainelFilters(INITIAL_PAINEL_COLUMN_FILTERS)).toBe(false);

    // 1) Matrícula / Protocolo
    const byMat = filtrarProcessosPainel(lista, {
      ...INITIAL_PAINEL_COLUMN_FILTERS,
      matriculaProtocolo: String(demo[1]!.matricula),
    });
    expect(byMat.map((r) => r.matricula)).toEqual([demo[1]!.matricula]);

    const byProt = filtrarProcessosPainel(lista, {
      ...INITIAL_PAINEL_COLUMN_FILTERS,
      matriculaProtocolo: demo[0]!.protocolo.slice(-4),
    });
    expect(byProt.some((r) => r.matricula === demo[0]!.matricula)).toBe(true);

    // 2) Empreendimento (sem acento, fallback "Não informado" e modalidade)
    const byEmpSemAcento = filtrarProcessosPainel(lista, {
      ...INITIAL_PAINEL_COLUMN_FILTERS,
      empreendimento: 'nao informado',
    });
    expect(byEmpSemAcento.map((r) => r.matricula)).toEqual([semNome.matricula]);

    const byModalidade = filtrarProcessosPainel(lista, {
      ...INITIAL_PAINEL_COLUMN_FILTERS,
      empreendimento: 'reurb-e',
    });
    expect(byModalidade.every((r) => r.modalidade === 'REURB_E')).toBe(true);
    expect(byModalidade.length).toBeGreaterThan(0);

    // 3) Registro (data formatada dd/mm/aaaa e parcial mm/aaaa)
    const regAlvo = demo[4]!;
    const [yyyy, mm, dd] = String(regAlvo.dataRegistro).slice(0, 10).split('-');
    const byRegistro = filtrarProcessosPainel(lista, {
      ...INITIAL_PAINEL_COLUMN_FILTERS,
      registro: `${dd}/${mm}/${yyyy}`,
    });
    expect(byRegistro.some((r) => r.matricula === regAlvo.matricula)).toBe(true);

    // 4) Derivadas JSON (exato, operadores e faixa min-max)
    const exactQtd = demo[0]!.qtdDerivadasLista;
    const byDerExact = filtrarProcessosPainel(lista, {
      ...INITIAL_PAINEL_COLUMN_FILTERS,
      derivadasJson: String(exactQtd),
    });
    expect(byDerExact.every((r) => r.qtdDerivadasLista === exactQtd)).toBe(true);

    const byDerGte = filtrarProcessosPainel(lista, {
      ...INITIAL_PAINEL_COLUMN_FILTERS,
      derivadasJson: '>= 10',
    });
    expect(byDerGte.every((r) => r.qtdDerivadasLista >= 10)).toBe(true);

    const byDerRange = filtrarProcessosPainel(lista, {
      ...INITIAL_PAINEL_COLUMN_FILTERS,
      derivadasJson: '1-30',
    });
    expect(byDerRange.every((r) => r.qtdDerivadasLista >= 1 && r.qtdDerivadasLista <= 30)).toBe(
      true
    );

    // Operador incompleto enquanto digita não zera resultados
    const byDerTyping = filtrarProcessosPainel(lista, {
      ...INITIAL_PAINEL_COLUMN_FILTERS,
      derivadasJson: '>=',
    });
    expect(byDerTyping).toHaveLength(lista.length);

    // 5) Situação + combinação multi-coluna
    const combinado = filtrarProcessosPainel(lista, {
      matriculaProtocolo: '',
      empreendimento: demo[0]!.empreendimento || '',
      registro: `${mm}/${yyyy}`,
      derivadasJson: '>=1',
      situacao: 'APTO',
    });
    expect(hasActivePainelFilters({
      ...INITIAL_PAINEL_COLUMN_FILTERS,
      situacao: 'APTO',
    })).toBe(true);
    expect(combinado.every((r) => r.situacaoValidacao === 'APTO')).toBe(true);
  });

  it('gera HTML de impressão somente com os registros filtrados, sem coluna Ação e com escape XSS', () => {
    const demo = getDemoReurbRegularizacoes();
    const registroXss = {
      ...demo[0]!,
      protocolo: '644354<script>alert(1)</script>',
      empreendimento: 'Vila "Teste" & <img src=x onerror=alert(2)>',
      qtdDerivadasLista: 17,
      situacaoValidacao: 'APTO' as const,
    };
    const registroFora = {
      ...demo[1]!,
      matricula: 999888,
      protocolo: '999888-EXCLUIDO',
      qtdDerivadasLista: 42,
      situacaoValidacao: 'PENDENTE' as const,
    };

    const filters = {
      ...INITIAL_PAINEL_COLUMN_FILTERS,
      empreendimento: 'Vila',
      situacao: 'APTO' as const,
    };
    const totalLista = [registroXss, registroFora];
    const filtrados = filtrarProcessosPainel(totalLista, filters);
    expect(filtrados).toHaveLength(1);
    const html = gerarHtmlImpressaoPainel({
      ano: 2026,
      mes: 10,
      processos: filtrados,
      totalPeriodo: totalLista.length,
      filters,
      emitidoEm: new Date('2026-11-23T14:00:00Z'),
    });

    expect(escapePrintHtml('<a&"b">')).toBe('&lt;a&amp;&quot;b&quot;&gt;');
    expect(html).toContain('Outubro / 2026');
    expect(html).toContain('1 de 2');
    expect(html).toContain('17 (1 apta(s) · 0 pend.)');
    expect(html).toContain('Empreendimento: &quot;Vila&quot;');
    expect(html).toContain('Situação: Apto');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('999888-EXCLUIDO');
    expect(html).not.toContain('>Ação<');
    expect(html).not.toContain('>Detalhes<');
  });
});
