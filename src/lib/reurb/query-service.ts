import { prisma } from '@/lib/prisma';
import { getDemoReurbRegularizacoes } from './demo-fixtures';
import { validarRegularizacaoParaOnr } from './onr-exporter';
import { isReurbDemoModeActive } from './permissions';
import type {
  ReurbAtoVinculado,
  ReurbConsultaFiltros,
  ReurbDerivadaDestaqueItem,
  ReurbFonteCampo,
  ReurbModalidade,
  ReurbPainelDTO,
  ReurbRegularizacaoDTO,
  ReurbRegularizacaoResumo,
  ReurbRelatorioDTO,
  ReurbRelatorioEvolucaoMesItem,
  ReurbRelatorioModalidadeItem,
  ReurbSeveridade,
  ReurbStatusImportacaoOnr,
} from './types';

const MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function isMissingRelationError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    code === 'P2021' ||
    code === '42P01' ||
    msg.includes('does not exist') ||
    msg.includes('fiorix_reurb_')
  );
}

export function dateToIsoOnly(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function resolverStatusImportacaoOnr(
  ultimaExportacaoEm: Date | string | null | undefined,
  ultimaImportacaoConfirmadaEm: Date | string | null | undefined
): ReurbStatusImportacaoOnr {
  if (ultimaImportacaoConfirmadaEm) return 'IMPORTADA_ONR';
  if (ultimaExportacaoEm) return 'EXPORTADA_AGUARDANDO_CONFIRMACAO';
  return 'NAO_EXPORTADA';
}

export function correspondePeriodo(
  dataIso: string | null | undefined,
  filtros: {
    ano?: number | null;
    mes?: number | 'todos' | null;
    dataDe?: string | null;
    dataAte?: string | null;
  }
): boolean {
  if (!dataIso || !/^\d{4}-\d{2}-\d{2}/.test(dataIso)) return false;
  const clean = dataIso.slice(0, 10);

  if (filtros.dataDe || filtros.dataAte) {
    if (filtros.dataDe && clean < filtros.dataDe.slice(0, 10)) return false;
    if (filtros.dataAte && clean > filtros.dataAte.slice(0, 10)) return false;
    return true;
  }

  if (filtros.ano) {
    const yearPrefix = `${String(filtros.ano).padStart(4, '0')}-`;
    if (!clean.startsWith(yearPrefix)) return false;
    if (filtros.mes && filtros.mes !== 'todos') {
      const monthNum = Number(filtros.mes);
      if (monthNum >= 1 && monthNum <= 12) {
        const expectedMonth = `${yearPrefix}${String(monthNum).padStart(2, '0')}-`;
        return clean.startsWith(expectedMonth);
      }
    }
    return true;
  }

  return true;
}

function periodoPrefixos(ano: number, mes: number | 'todos'): {
  samePeriod: (dateIso: string | null | undefined) => boolean;
} {
  return {
    samePeriod: (dateIso) => correspondePeriodo(dateIso, { ano, mes }),
  };
}

export function contarDerivadasAbertasNoPeriodo(
  registros: ReurbRegularizacaoDTO[],
  ano: number,
  mes: number | 'todos'
): {
  totalDerivadas: number;
  derivadasDeOutroMes: number;
  itens: ReurbDerivadaDestaqueItem[];
} {
  const { samePeriod } = periodoPrefixos(ano, mes);
  const seen = new Set<string>();
  const itens: ReurbDerivadaDestaqueItem[] = [];

  for (const reg of registros) {
    const matrizNoPeriodo = samePeriod(reg.dataRegistro);
    for (const d of reg.derivadas || []) {
      if (!d.incluirNoJson || d.ehAreaPublica || d.ehCondominioIntermediario) continue;
      if (!samePeriod(d.dataAbertura)) continue;
      const dedupKey = `${reg.id}:${d.matriculaDerivada}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      itens.push({
        matriculaDerivada: d.matriculaDerivada,
        dataAbertura: d.dataAbertura,
        dataRegistro: d.dataRegistro,
        regularizacaoId: reg.id,
        matriculaMatriz: reg.matricula,
        protocolo: reg.protocolo,
        empreendimento: reg.empreendimento,
        dataRegistroMatriz: reg.dataRegistro,
        deOutroMes: !matrizNoPeriodo,
        categoriaArea: d.categoriaArea,
      });
    }
  }

  const derivadasDeOutroMes = itens.filter((i) => i.deOutroMes).length;
  return {
    totalDerivadas: itens.length,
    derivadasDeOutroMes,
    itens,
  };
}

export function isRegularizacaoAptaAtual(
  reg: ReurbRegularizacaoDTO,
  incluirArt69 = false
): boolean {
  return reg.situacaoValidacao === 'APTO' && validarRegularizacaoParaOnr(reg, { incluirArt69 }).apto;
}

export function calcularPainelReurb(
  registros: ReurbRegularizacaoDTO[],
  ano: number,
  mes: number | 'todos',
  demoMode = false
): ReurbPainelDTO {
  const { samePeriod } = periodoPrefixos(ano, mes);

  // Regularizações distintas pela data de registro da regularização
  const registradasNoPeriodo = registros
    .filter((r) => samePeriod(r.dataRegistro))
    .sort((a, b) => String(b.dataRegistro || '').localeCompare(String(a.dataRegistro || '')));

  // Derivadas distintas pela data de abertura de cada derivada (inclusive de matrizes de outro mês)
  const derivadasResumo = contarDerivadasAbertasNoPeriodo(registros, ano, mes);

  // Aptas vs pendências calculadas sobre a situação atual das regularizações registradas no período
  let aptasExportacao = 0;
  let comPendencias = 0;
  for (const reg of registradasNoPeriodo) {
    if (isRegularizacaoAptaAtual(reg, false)) {
      aptasExportacao += 1;
    } else {
      comPendencias += 1;
    }
  }

  return {
    ano,
    mes,
    kpis: {
      registradas: registradasNoPeriodo.length,
      derivadasAbertas: derivadasResumo.totalDerivadas,
      aptasExportacao,
      comPendencias,
    },
    derivadasPeriodoResumo: derivadasResumo,
    processosPeriodo: registradasNoPeriodo,
    demoMode,
  };
}

export function filtrarProcessosReurb(
  registros: ReurbRegularizacaoDTO[],
  filtros: ReurbConsultaFiltros
): {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  itens: ReurbRegularizacaoResumo[];
} {
  const tipoData = filtros.tipoData || 'registro';
  const busca = String(filtros.busca || '').trim().toLowerCase();
  const hasDateFilter = Boolean(filtros.dataDe || filtros.dataAte || filtros.ano);

  const matched: ReurbRegularizacaoResumo[] = [];

  for (const reg of registros) {
    if (filtros.modalidade && filtros.modalidade !== 'TODAS') {
      if (reg.modalidade !== filtros.modalidade) continue;
    }

    if (filtros.situacao && filtros.situacao !== 'TODAS') {
      const apta = isRegularizacaoAptaAtual(reg, Boolean(filtros.incluirArt69));
      if (filtros.situacao === 'APTO' && !apta) continue;
      if (filtros.situacao === 'PENDENTE' && apta) continue;
    }

    if (busca) {
      const hitMatriz = String(reg.matricula).includes(busca);
      const hitPren = String(reg.prenotacao).includes(busca);
      const hitProto = reg.protocolo.toLowerCase().includes(busca);
      const hitEmp = String(reg.empreendimento || '').toLowerCase().includes(busca);
      const hitDer = (reg.derivadas || []).some((d) =>
        String(d.matriculaDerivada).includes(busca)
      );
      if (!hitMatriz && !hitPren && !hitProto && !hitEmp && !hitDer) continue;
    }

    let derivadasNoPeriodo: ReurbDerivadaDestaqueItem[] | undefined;

    if (hasDateFilter) {
      if (tipoData === 'registro') {
        if (!correspondePeriodo(reg.dataRegistro, filtros)) continue;
      } else if (tipoData === 'prenotacao') {
        if (!correspondePeriodo(reg.dataPrenotacao, filtros)) continue;
      } else if (tipoData === 'abertura_derivada') {
        const matchingDerivs = (reg.derivadas || []).filter(
          (d) =>
            d.incluirNoJson &&
            !d.ehAreaPublica &&
            !d.ehCondominioIntermediario &&
            correspondePeriodo(d.dataAbertura, filtros)
        );
        if (matchingDerivs.length === 0) continue;

        const matrizNoPeriodo = correspondePeriodo(reg.dataRegistro, filtros);
        derivadasNoPeriodo = matchingDerivs.map((d) => ({
          matriculaDerivada: d.matriculaDerivada,
          dataAbertura: d.dataAbertura,
          dataRegistro: d.dataRegistro,
          regularizacaoId: reg.id,
          matriculaMatriz: reg.matricula,
          protocolo: reg.protocolo,
          empreendimento: reg.empreendimento,
          dataRegistroMatriz: reg.dataRegistro,
          deOutroMes: !matrizNoPeriodo,
          categoriaArea: d.categoriaArea,
        }));
      }
    }

    matched.push({
      ...reg,
      qtdDerivadasAbertasNoPeriodo: derivadasNoPeriodo?.length,
      derivadasNoPeriodo,
    });
  }

  matched.sort((a, b) => {
    const da = tipoData === 'prenotacao' ? a.dataPrenotacao || '' : a.dataRegistro || '';
    const db = tipoData === 'prenotacao' ? b.dataPrenotacao || '' : b.dataRegistro || '';
    if (db !== da) return db.localeCompare(da);
    return b.prenotacao - a.prenotacao;
  });

  const pageSize = Math.max(1, Math.min(100, Number(filtros.pageSize || 20)));
  const total = matched.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(totalPages, Number(filtros.page || 1)));
  const start = (page - 1) * pageSize;

  return {
    total,
    page,
    pageSize,
    totalPages,
    itens: matched.slice(start, start + pageSize),
  };
}

export function montarRelatoriosReurb(
  registros: ReurbRegularizacaoDTO[],
  ano: number,
  mes: number | 'todos',
  demoMode = false
): ReurbRelatorioDTO {
  const painel = calcularPainelReurb(registros, ano, mes, demoMode);
  const modalidades: Array<{ key: ReurbModalidade; label: string }> = [
    { key: 'REURB_S', label: 'REURB-S (Interesse Social)' },
    { key: 'REURB_E', label: 'REURB-E (Interesse Específico)' },
    { key: 'ART_69', label: 'Art. 69 (Parcelamento anterior à Lei 6.766/79)' },
  ];

  const porModalidade: ReurbRelatorioModalidadeItem[] = modalidades.map(({ key, label }) => {
    const subset = registros.filter((r) => r.modalidade === key);
    const subPainel = calcularPainelReurb(subset, ano, mes, demoMode);
    return {
      modalidade: key,
      label,
      registradas: subPainel.kpis.registradas,
      derivadasAbertas: subPainel.kpis.derivadasAbertas,
      aptas: subPainel.kpis.aptasExportacao,
      comPendencias: subPainel.kpis.comPendencias,
    };
  });

  const evolucaoMensal: ReurbRelatorioEvolucaoMesItem[] = Array.from({ length: 12 }, (_, idx) => {
    const m = idx + 1;
    const mPainel = calcularPainelReurb(registros, ano, m, demoMode);
    return {
      mes: m,
      mesLabel: MESES_CURTOS[idx]!,
      registradas: mPainel.kpis.registradas,
      derivadasAbertas: mPainel.kpis.derivadasAbertas,
      aptas: mPainel.kpis.aptasExportacao,
      comPendencias: mPainel.kpis.comPendencias,
    };
  });

  const pendenciasPeriodo = painel.processosPeriodo
    .filter((r) => !isRegularizacaoAptaAtual(r, false) || r.qtdAlertas > 0)
    .map((r) => {
      const prio =
        r.pendencias.find((p) => p.severidade === 'BLOQUEIA') ||
        r.pendencias[0] ||
        null;
      return {
        id: r.id,
        matricula: r.matricula,
        protocolo: r.protocolo,
        empreendimento: r.empreendimento,
        modalidade: r.modalidade,
        dataRegistro: r.dataRegistro,
        qtdBloqueios: r.qtdBloqueios,
        qtdAlertas: r.qtdAlertas,
        motivoPrincipal: prio ? `${prio.campo}: ${prio.motivo}` : 'Conferência documental recomendada',
      };
    });

  return {
    ano,
    mes,
    totais: {
      registradas: painel.kpis.registradas,
      derivadasAbertas: painel.kpis.derivadasAbertas,
      aptas: painel.kpis.aptasExportacao,
      comPendencias: painel.kpis.comPendencias,
    },
    porModalidade,
    evolucaoMensal,
    pendenciasPeriodo,
    demoMode,
  };
}

function mapDbRowToDto(row: {
  id: string;
  recordKey: string;
  prenotacao: number;
  matricula: number;
  complMatricula: string | null;
  protocolo: string;
  empreendimento: string | null;
  empreendimentoFonte: string | null;
  empreendimentoTrechoOcr: string | null;
  negId: number;
  classificacaoFinal: string;
  modalidade: string;
  tipoInteresse: number;
  dataRegistro: Date | null;
  dataPrenotacao: Date | null;
  municipio: string | null;
  distrito: string | null;
  subdistrito: string | null;
  bairro: string | null;
  bairroSugerido: string | null;
  tipoLocalizacao: string;
  quantidadeUnidades: number;
  qtdDerivadasLista: number;
  qtdAreasPublicasExcluidas: number;
  tipoAgente: number | null;
  agente: string | null;
  situacaoValidacao: string;
  qtdBloqueios: number;
  qtdAlertas: number;
  ehArt69: boolean;
  fontesJson: unknown;
  atosVinculadosJson: unknown;
  ultimaExportacaoEm: Date | null;
  ultimaImportacaoConfirmadaEm: Date | null;
  syncedAt: Date;
  derivadas: Array<{
    id: string;
    matriculaDerivada: number;
    complMatricula: string | null;
    dataAbertura: Date | null;
    dataRegistro: Date | null;
    tipoInteresse: number;
    incluirNoJson: boolean;
    ehAreaPublica: boolean;
    ehCondominioIntermediario: boolean;
    categoriaArea: string;
    vinculoMetodo: string | null;
    motivoExclusao: string | null;
    fonteOcr: string | null;
  }>;
  pendencias: Array<{
    id: string;
    matriculaDerivada: number | null;
    campo: string;
    severidade: string;
    motivo: string;
    fonte: string;
    acaoNecessaria: string | null;
    exigeConferencia: boolean;
  }>;
}): ReurbRegularizacaoDTO {
  return {
    id: row.id,
    recordKey: row.recordKey,
    prenotacao: row.prenotacao,
    matricula: row.matricula,
    complMatricula: row.complMatricula,
    protocolo: row.protocolo,
    empreendimento: row.empreendimento,
    empreendimentoFonte: row.empreendimentoFonte,
    empreendimentoTrechoOcr: row.empreendimentoTrechoOcr,
    negId: row.negId,
    classificacaoFinal: row.classificacaoFinal,
    modalidade: (row.modalidade as ReurbModalidade) || 'REURB_S',
    tipoInteresse: row.tipoInteresse,
    dataRegistro: dateToIsoOnly(row.dataRegistro),
    dataPrenotacao: dateToIsoOnly(row.dataPrenotacao),
    municipio: row.municipio,
    distrito: row.distrito,
    subdistrito: row.subdistrito,
    bairro: row.bairro,
    bairroSugerido: row.bairroSugerido,
    tipoLocalizacao: row.tipoLocalizacao || 'U',
    quantidadeUnidades: row.quantidadeUnidades,
    qtdDerivadasLista: row.qtdDerivadasLista,
    qtdAreasPublicasExcluidas: row.qtdAreasPublicasExcluidas,
    tipoAgente: row.tipoAgente,
    agente: row.agente,
    situacaoValidacao: row.situacaoValidacao === 'APTO' ? 'APTO' : 'PENDENTE',
    qtdBloqueios: row.qtdBloqueios,
    qtdAlertas: row.qtdAlertas,
    ehArt69: row.ehArt69,
    fontes: Array.isArray(row.fontesJson) ? (row.fontesJson as ReurbFonteCampo[]) : [],
    atosVinculados: Array.isArray(row.atosVinculadosJson)
      ? (row.atosVinculadosJson as ReurbAtoVinculado[])
      : [],
    derivadas: row.derivadas.map((d) => ({
      id: d.id,
      matriculaDerivada: d.matriculaDerivada,
      complMatricula: d.complMatricula,
      dataAbertura: dateToIsoOnly(d.dataAbertura),
      dataRegistro: dateToIsoOnly(d.dataRegistro),
      tipoInteresse: d.tipoInteresse,
      incluirNoJson: d.incluirNoJson,
      ehAreaPublica: d.ehAreaPublica,
      ehCondominioIntermediario: d.ehCondominioIntermediario,
      categoriaArea: d.categoriaArea,
      vinculoMetodo: d.vinculoMetodo,
      motivoExclusao: d.motivoExclusao,
      fonteOcr: d.fonteOcr,
    })),
    pendencias: row.pendencias.map((p) => ({
      id: p.id,
      matriculaDerivada: p.matriculaDerivada,
      campo: p.campo,
      severidade: (p.severidade === 'BLOQUEIA' || p.severidade === 'MEDIA'
        ? p.severidade
        : 'INFO') as ReurbSeveridade,
      motivo: p.motivo,
      fonte: p.fonte,
      acaoNecessaria: p.acaoNecessaria,
      exigeConferencia: p.exigeConferencia,
    })),
    ultimaExportacaoEm: row.ultimaExportacaoEm ? row.ultimaExportacaoEm.toISOString() : null,
    ultimaImportacaoConfirmadaEm: row.ultimaImportacaoConfirmadaEm
      ? row.ultimaImportacaoConfirmadaEm.toISOString()
      : null,
    statusImportacaoOnr: resolverStatusImportacaoOnr(
      row.ultimaExportacaoEm,
      row.ultimaImportacaoConfirmadaEm
    ),
    syncedAt: row.syncedAt ? row.syncedAt.toISOString() : null,
  };
}

export async function carregarRegularizacoesReurb(tenantId: string): Promise<{
  registros: ReurbRegularizacaoDTO[];
  demoMode: boolean;
}> {
  try {
    const rows = await prisma.fiorixReurbRegularizacao.findMany({
      where: { tenantId },
      include: {
        derivadas: {
          orderBy: { matriculaDerivada: 'asc' },
        },
        pendencias: true,
      },
      orderBy: [{ dataRegistro: 'desc' }, { prenotacao: 'desc' }],
    });

    if (rows.length > 0) {
      return {
        registros: rows.map(mapDbRowToDto),
        demoMode: false,
      };
    }

    if (isReurbDemoModeActive()) {
      return {
        registros: getDemoReurbRegularizacoes(),
        demoMode: true,
      };
    }

    return {
      registros: [],
      demoMode: false,
    };
  } catch (err) {
    if (isMissingRelationError(err)) {
      if (isReurbDemoModeActive()) {
        return {
          registros: getDemoReurbRegularizacoes(),
          demoMode: true,
        };
      }
      return {
        registros: [],
        demoMode: false,
      };
    }
    throw err;
  }
}

export async function carregarRegularizacaoPorId(
  tenantId: string,
  id: string
): Promise<{
  registro: ReurbRegularizacaoDTO | null;
  demoMode: boolean;
}> {
  const { registros, demoMode } = await carregarRegularizacoesReurb(tenantId);
  const found =
    registros.find((r) => r.id === id) ||
    registros.find((r) => r.recordKey === id) ||
    null;
  return { registro: found, demoMode };
}

export async function carregarRegularizacoesPorIds(
  tenantId: string,
  ids: string[]
): Promise<{
  registros: ReurbRegularizacaoDTO[];
  demoMode: boolean;
}> {
  const wanted = new Set(ids);
  const { registros, demoMode } = await carregarRegularizacoesReurb(tenantId);
  return {
    registros: registros.filter((r) => wanted.has(r.id) || wanted.has(r.recordKey)),
    demoMode,
  };
}

/**
 * Remove campos e evidências estritamente técnicas (OCR SiplanIA, atos WEBRI, vínculo interno e avisos INFO)
 * quando a visualização do detalhe não pertence ao perfil MASTER.
 */
export function sanitizarDetalheRegularizacaoParaPerfil(
  registro: ReurbRegularizacaoDTO,
  isMaster: boolean
): ReurbRegularizacaoDTO {
  if (isMaster) return registro;

  return {
    ...registro,
    empreendimentoFonte: null,
    empreendimentoTrechoOcr: null,
    fontes: [],
    atosVinculados: [],
    pendencias: registro.pendencias
      .filter((p) => p.severidade === 'BLOQUEIA' || p.severidade === 'MEDIA')
      .map((p) => ({
        ...p,
        fonte: '',
      })),
    derivadas: registro.derivadas.map((d) => ({
      ...d,
      vinculoMetodo: null,
      fonteOcr: null,
    })),
  };
}
