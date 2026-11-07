import { createHash } from 'crypto';

export type TipoFolhaHolerite = 'MENSAL' | 'DECIMO_1' | 'DECIMO_2';

export interface PrazoLegalCltInfo {
  ano: number;
  mes: number; // 1..12 = Mensal, 13 = 13º 1ª Parcela, 14 = 13º 2ª Parcela
  tipoFolha: TipoFolhaHolerite;
  competenciaCodigo: string; // ex: "10/2026", "13-1/2026", "13-2/2026"
  competenciaTitulo: string; // ex: "Outubro/2026", "13º Salário (1ª Parcela)/2026"
  dataLimiteIso: string; // YYYY-MM-DD
  dataLimiteBr: string; // DD/MM/AAAA
  caiNoSabado: boolean;
  sextaBancariaRecomendadaIso: string | null;
  sextaBancariaRecomendadaBr: string | null;
  fundamentoLegal: string;
}

export type StatusPrazoCompetencia =
  | 'HOMOLOGADA'
  | 'COMPLETA_NO_PRAZO'
  | 'COMPLETA_COM_ATRASO'
  | 'EM_ANDAMENTO_NO_PRAZO'
  | 'PRAZO_PROXIMO'
  | 'PENDENTE_ATRASO'
  | 'FUTURA';

const MESES_NOMES = [
  '',
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const MESES_CURTOS = [
  '',
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function isoToBrDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const clean = iso.slice(0, 10);
  const [y, m, d] = clean.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/**
 * Algoritmo de Meeus/Jones/Butcher para Domingo de Páscoa (calendário gregoriano).
 */
function calcularDomingoPascoaUtc(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=Março, 4=Abril
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function addDaysUtc(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toIsoUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/**
 * Retorna conjunto de feriados oficiais (Nacionais + Estado de SP + Município de São Paulo)
 * no formato YYYY-MM-DD para apuração precisa dos dias úteis trabalhistas do 7º RI de SP.
 */
export function obterFeriadosOficiaisSp(ano: number): Set<string> {
  const feriados = new Set<string>([
    `${ano}-01-01`, // Confraternização Universal (Nacional)
    `${ano}-01-25`, // Aniversário da Cidade de São Paulo (Municipal SP - Lei 7.008/1967)
    `${ano}-04-21`, // Tiradentes (Nacional)
    `${ano}-05-01`, // Dia Mundial do Trabalho (Nacional)
    `${ano}-07-09`, // Revolução Constitucionalista de 1932 (Estadual SP - Lei 9.497/1997)
    `${ano}-09-07`, // Independência do Brasil (Nacional)
    `${ano}-10-12`, // Nossa Senhora Aparecida (Nacional)
    `${ano}-11-02`, // Finados (Nacional)
    `${ano}-11-15`, // Proclamação da República (Nacional)
    `${ano}-11-20`, // Dia Nacional de Zumbi e da Consciência Negra (Nacional - Lei 14.759/2023)
    `${ano}-12-25`, // Natal (Nacional)
  ]);

  const pascoa = calcularDomingoPascoaUtc(ano);
  // Terça-feira de Carnaval (-47 dias) e Segunda de Carnaval (-48 dias: expediente bancário/forense suspenso)
  feriados.add(toIsoUtc(addDaysUtc(pascoa, -47)));
  // Sexta-feira Santa / Paixão de Cristo (-2 dias)
  feriados.add(toIsoUtc(addDaysUtc(pascoa, -2)));
  // Corpus Christi (+60 dias — Feriado Municipal em São Paulo - Lei 14.485/2007)
  feriados.add(toIsoUtc(addDaysUtc(pascoa, 60)));

  return feriados;
}

/**
 * Para fins do Art. 459, § 1º da CLT (IN SRT/MTE nº 1/1989 e Súmula 381 do TST),
 * segunda-feira a sábado são considerados dias úteis para pagamento mensal de salários,
 * excluindo-se domingos (getUTCDay() === 0) e feriados oficiais.
 */
export function isDiaUtilSalarialClt(dataUtc: Date, feriadosAno?: Set<string>): boolean {
  const dow = dataUtc.getUTCDay(); // 0 = Domingo, 6 = Sábado
  if (dow === 0) return false;
  const feriados = feriadosAno || obterFeriadosOficiaisSp(dataUtc.getUTCFullYear());
  return !feriados.has(toIsoUtc(dataUtc));
}

export function obterTipoFolhaPorMes(mes: number): TipoFolhaHolerite {
  if (mes === 13) return 'DECIMO_1';
  if (mes === 14) return 'DECIMO_2';
  return 'MENSAL';
}

export function formatarCompetenciaCurta(mes: number, ano: number): string {
  if (mes === 13) return `13º (1ª)/${ano}`;
  if (mes === 14) return `13º (2ª)/${ano}`;
  return `${pad2(mes)}/${ano}`;
}

export function formatarCompetenciaTitulo(mes: number, ano: number): string {
  if (mes === 13) return `13º Salário — 1ª Parcela / ${ano}`;
  if (mes === 14) return `13º Salário — 2ª Parcela / ${ano}`;
  const nome = MESES_NOMES[mes] || `Mês ${mes}`;
  return `${nome} / ${ano}`;
}

export function formatarSiglaCardMes(mes: number): string {
  if (mes === 13) return '13º 1ªP';
  if (mes === 14) return '13º 2ªP';
  return MESES_CURTOS[mes] || `M${mes}`;
}

/**
 * Calcula o prazo máximo legal trabalhista para disponibilização do pagamento e holerite:
 * - Competências 01..12: 5º dia útil do mês subsequente (CLT, Art. 459, § 1º + Art. 464).
 * - Competência 13 (13º - 1ª Parcela): até 30 de novembro do ano (Lei 4.749/1965, Art. 2º), antecipado se domingo/feriado.
 * - Competência 14 (13º - 2ª Parcela): até 20 de dezembro do ano (Lei 4.749/1965, Art. 1º), antecipado se domingo/feriado.
 */
export function calcularPrazoLegalClt(ano: number, mes: number): PrazoLegalCltInfo {
  const tipoFolha = obterTipoFolhaPorMes(mes);

  if (mes === 13 || mes === 14) {
    const mesAlvoZero = mes === 13 ? 10 : 11; // Nov=10, Dez=11
    const diaFixo = mes === 13 ? 30 : 20;
    const feriados = obterFeriadosOficiaisSp(ano);
    let cursor = new Date(Date.UTC(ano, mesAlvoZero, diaFixo));

    // Se cair em domingo ou feriado, antecipa para o dia útil imediatamente anterior
    while (!isDiaUtilSalarialClt(cursor, feriados)) {
      cursor = addDaysUtc(cursor, -1);
    }

    const dataLimiteIso = toIsoUtc(cursor);
    const caiNoSabado = cursor.getUTCDay() === 6;
    const sextaIso = caiNoSabado ? toIsoUtc(addDaysUtc(cursor, -1)) : null;

    return {
      ano,
      mes,
      tipoFolha,
      competenciaCodigo: formatarCompetenciaCurta(mes, ano),
      competenciaTitulo: formatarCompetenciaTitulo(mes, ano),
      dataLimiteIso,
      dataLimiteBr: isoToBrDate(dataLimiteIso),
      caiNoSabado,
      sextaBancariaRecomendadaIso: sextaIso,
      sextaBancariaRecomendadaBr: sextaIso ? isoToBrDate(sextaIso) : null,
      fundamentoLegal:
        mes === 13
          ? 'Lei nº 4.749/1965, Art. 2º (1ª parcela do 13º salário até 30/11)'
          : 'Lei nº 4.749/1965, Art. 1º (2ª parcela do 13º salário até 20/12)',
    };
  }

  // Competência mensal (1..12): 5º dia útil do mês subsequente
  const anoSubsequente = mes === 12 ? ano + 1 : ano;
  const mesSubsequenteZero = mes === 12 ? 0 : mes; // 0-indexed (ex: mes=10 Outubro -> mesSubsequenteZero=10 Novembro)
  const feriados = obterFeriadosOficiaisSp(anoSubsequente);

  let diasUteisContados = 0;
  let dia = 1;
  let quintoDiaUtil = new Date(Date.UTC(anoSubsequente, mesSubsequenteZero, 1));

  while (diasUteisContados < 5 && dia <= 31) {
    const candidato = new Date(Date.UTC(anoSubsequente, mesSubsequenteZero, dia));
    if (isDiaUtilSalarialClt(candidato, feriados)) {
      diasUteisContados++;
      quintoDiaUtil = candidato;
    }
    dia++;
  }

  const dataLimiteIso = toIsoUtc(quintoDiaUtil);
  const caiNoSabado = quintoDiaUtil.getUTCDay() === 6;
  const sextaIso = caiNoSabado ? toIsoUtc(addDaysUtc(quintoDiaUtil, -1)) : null;

  return {
    ano,
    mes,
    tipoFolha,
    competenciaCodigo: formatarCompetenciaCurta(mes, ano),
    competenciaTitulo: formatarCompetenciaTitulo(mes, ano),
    dataLimiteIso,
    dataLimiteBr: isoToBrDate(dataLimiteIso),
    caiNoSabado,
    sextaBancariaRecomendadaIso: sextaIso,
    sextaBancariaRecomendadaBr: sextaIso ? isoToBrDate(sextaIso) : null,
    fundamentoLegal: 'CLT, Art. 459, § 1º, Art. 464 e Súmula 381 TST (5º dia útil)',
  };
}

/**
 * Converte uma data/hora para YYYY-MM-DD no fuso oficial de Brasília/São Paulo.
 */
export function obterDataIsoSaoPaulo(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const day = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${day}`;
}

function diffDaysIso(isoA: string, isoB: string): number {
  const tA = new Date(`${isoA.slice(0, 10)}T00:00:00Z`).getTime();
  const tB = new Date(`${isoB.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((tA - tB) / 86_400_000);
}

/**
 * Avalia se um upload individual ocorreu dentro da data-limite legal CLT.
 */
export function avaliarTempestividadeUpload(
  dataUpload: Date | string,
  dataLimiteIso: string
): { noPrazo: boolean; diasAtraso: number; dataUploadSpIso: string } {
  const uploadIso = obterDataIsoSaoPaulo(dataUpload);
  const diff = diffDaysIso(uploadIso, dataLimiteIso);
  return {
    noPrazo: diff <= 0,
    diasAtraso: diff > 0 ? diff : 0,
    dataUploadSpIso: uploadIso,
  };
}

/**
 * Retorna o último dia civil (YYYY-MM-DD) da competência para filtrar elegibilidade por Data de Admissão.
 */
export function obterUltimoDiaCompetenciaIso(ano: number, mes: number): string {
  if (mes === 13) return `${ano}-11-30`;
  if (mes === 14) return `${ano}-12-31`;
  const lastDay = new Date(Date.UTC(ano, mes, 0)); // dia 0 do mês seguinte = último dia de `mes`
  return toIsoUtc(lastDay);
}

/**
 * Avalia o status executivo consolidado da competência para exibição nos cards mensais e checklist CLT.
 */
export function avaliarStatusPrazoCompetencia(params: {
  ano: number;
  mes: number;
  dataLimiteIso: string;
  elegiveis: number;
  arquivados: number;
  dispensados: number;
  noPrazoCount: number;
  homologada: boolean;
  hojeIso?: string;
}): {
  status: StatusPrazoCompetencia;
  diasRestantesOuAtraso: number;
  coberturaCompleta: boolean;
  todosNoPrazo: boolean;
} {
  const hoje = params.hojeIso || obterDataIsoSaoPaulo(new Date());
  const atendidosTotal = params.arquivados + params.dispensados;
  const coberturaCompleta = params.elegiveis > 0 && atendidosTotal >= params.elegiveis;
  const todosNoPrazo = params.arquivados === 0 ? true : params.noPrazoCount >= params.arquivados;
  const diasAteLimite = diffDaysIso(params.dataLimiteIso, hoje); // >0 faltam dias, <0 já venceu

  if (params.homologada) {
    return {
      status: 'HOMOLOGADA',
      diasRestantesOuAtraso: diasAteLimite,
      coberturaCompleta,
      todosNoPrazo,
    };
  }

  if (coberturaCompleta) {
    return {
      status: todosNoPrazo ? 'COMPLETA_NO_PRAZO' : 'COMPLETA_COM_ATRASO',
      diasRestantesOuAtraso: diasAteLimite,
      coberturaCompleta: true,
      todosNoPrazo,
    };
  }

  // Ainda faltam holerites na competência:
  // Verifica se a competência ainda nem iniciou (mês futuro sem arquivos lançados)
  const mesRef = params.mes === 13 ? 11 : params.mes === 14 ? 12 : params.mes;
  const inicioCompIso = `${params.ano}-${pad2(mesRef)}-01`;
  if (params.arquivados === 0 && params.dispensados === 0 && hoje < inicioCompIso) {
    return {
      status: 'FUTURA',
      diasRestantesOuAtraso: diasAteLimite,
      coberturaCompleta: false,
      todosNoPrazo: true,
    };
  }

  if (diasAteLimite < 0) {
    return {
      status: 'PENDENTE_ATRASO',
      diasRestantesOuAtraso: diasAteLimite,
      coberturaCompleta: false,
      todosNoPrazo,
    };
  }

  if (diasAteLimite <= 3) {
    return {
      status: 'PRAZO_PROXIMO',
      diasRestantesOuAtraso: diasAteLimite,
      coberturaCompleta: false,
      todosNoPrazo,
    };
  }

  return {
    status: 'EM_ANDAMENTO_NO_PRAZO',
    diasRestantesOuAtraso: diasAteLimite,
    coberturaCompleta: false,
    todosNoPrazo,
  };
}

/**
 * Gera hash SHA-256 canônico e determinístico consolidando todos os hashes individuais da competência
 * para homologação imutável na trilha WORM e verificação da Corregedoria.
 */
export function gerarManifestHashCompetencia(
  tenantId: string,
  ano: number,
  mes: number,
  hashesArquivos: string[]
): string {
  const ordenados = [...hashesArquivos].filter(Boolean).sort();
  const payload = `FIORIX_COMPETENCIA_V1|${tenantId}|${ano}|${pad2(mes)}|${ordenados.join(',')}`;
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Extrai CPF (ou token bruto), mês (1..14) e ano a partir do nome do arquivo PDF:
 * Aceita:
 *  - CPF_MM-AAAA.pdf (01..12, ou 13, 14)
 *  - CPF_13-1-AAAA.pdf / CPF_13_1_AAAA.pdf (13º 1ª Parcela -> mes=13)
 *  - CPF_13-2-AAAA.pdf / CPF_13_2_AAAA.pdf (13º 2ª Parcela -> mes=14)
 */
export function extrairMetadadosNomeArquivoHolerite(fileName: string): {
  rawCpfToken: string;
  mes: number;
  ano: number;
} | null {
  const clean = (fileName || '').trim();

  // Padrão 13º explícito: CPF_13-1-2026.pdf ou CPF_13-2-2026.pdf
  const matchDecimo = clean.match(/^([\d.\-]{11,14})_13[-_]([12])[-_](\d{4})\.pdf$/i);
  if (matchDecimo) {
    const [, rawCpfToken, parcela, anoStr] = matchDecimo;
    return {
      rawCpfToken,
      mes: parcela === '1' ? 13 : 14,
      ano: parseInt(anoStr, 10),
    };
  }

  // Padrão clássico: CPF_MM-AAAA.pdf
  const matchPadrao = clean.match(/^([\d.\-]{11,14})_(\d{2})-(\d{4})\.pdf$/i);
  if (matchPadrao) {
    const [, rawCpfToken, mesStr, anoStr] = matchPadrao;
    return {
      rawCpfToken,
      mes: parseInt(mesStr, 10),
      ano: parseInt(anoStr, 10),
    };
  }

  return null;
}


export type StatusCienciaHolerite = 'Ativo' | 'Visualizado' | 'Ciente';

/**
 * Gera o protocolo criptográfico SHA-256 do Comprovante Eletrônico de Recebimento e Ciência
 * pelo colaborador titular (CLT Art. 464 + MP nº 2.200-2/2001, Art. 10, § 2º).
 */
export function gerarComprovanteCienciaHoleriteHash(params: {
  tenantId: string;
  holeriteId: string;
  usuarioId: string;
  ano: number;
  mes: number;
  arquivoHash: string;
  cienciaConfirmadaEmIso: string;
  ip: string;
}): string {
  const payload = [
    'FIORIX_CIENCIA_HOLERITE_V1',
    params.tenantId,
    params.holeriteId,
    params.usuarioId,
    String(params.ano),
    pad2(params.mes),
    params.arquivoHash,
    params.cienciaConfirmadaEmIso,
    params.ip || 'unknown',
  ].join('|');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Classifica de forma determinística e auditável os eventos de acesso a um holerite,
 * separando estritamente os acessos pessoais do colaborador titular das inspeções técnicas do RH/Admin.
 * Garante que a conferência do RH jamais contamine o contador de ciência do colaborador.
 */
export function classificarAcessosHolerite(params: {
  titularUsuarioId: string;
  primeiraVisualizacaoColuna?: Date | string | null;
  cienciaConfirmadaEmColuna?: Date | string | null;
  cienciaComprovanteHashColuna?: string | null;
  logs: Array<{
    usuarioId: string;
    tipo: string;
    dataAcesso: Date | string;
    ip?: string | null;
  }>;
}): {
  acessosTitular: number;
  inspecoesRh: number;
  primeiraVisualizacaoTitularEm: Date | null;
  cienciaConfirmadaEm: Date | null;
  status: StatusCienciaHolerite;
} {
  let acessosTitular = 0;
  let inspecoesRh = 0;
  let primeiraVisLog: Date | null = null;
  let cienciaLogDate: Date | null = null;

  const sorted = [...(params.logs || [])].sort(
    (a, b) => new Date(a.dataAcesso).getTime() - new Date(b.dataAcesso).getTime()
  );

  for (const lg of sorted) {
    const dt = new Date(lg.dataAcesso);
    const isTitular = lg.usuarioId === params.titularUsuarioId;

    if (lg.tipo === 'holerite_ciencia_confirmada' && isTitular) {
      if (!cienciaLogDate && !isNaN(dt.getTime())) {
        cienciaLogDate = dt;
      }
      if (!primeiraVisLog && !isNaN(dt.getTime())) {
        primeiraVisLog = dt;
      }
      continue;
    }

    if (
      lg.tipo === 'holerite_download_authorized' ||
      lg.tipo === 'holerite_view' ||
      lg.tipo === 'holerite_rh_inspecao'
    ) {
      if (isTitular && lg.tipo !== 'holerite_rh_inspecao') {
        acessosTitular++;
        if (!primeiraVisLog && !isNaN(dt.getTime())) {
          primeiraVisLog = dt;
        }
      } else {
        inspecoesRh++;
      }
    }
  }

  const colVis = params.primeiraVisualizacaoColuna
    ? new Date(params.primeiraVisualizacaoColuna)
    : null;
  const validColVis = colVis && !isNaN(colVis.getTime()) ? colVis : null;

  const colCiencia = params.cienciaConfirmadaEmColuna
    ? new Date(params.cienciaConfirmadaEmColuna)
    : null;
  const validColCiencia = colCiencia && !isNaN(colCiencia.getTime()) ? colCiencia : null;

  const cienciaConfirmadaEm = validColCiencia || cienciaLogDate;
  const primeiraVisualizacaoTitularEm =
    validColVis || primeiraVisLog || cienciaConfirmadaEm || null;

  if (acessosTitular === 0 && validColVis) {
    acessosTitular = 1;
  }

  let status: StatusCienciaHolerite = 'Ativo';
  if (cienciaConfirmadaEm || params.cienciaComprovanteHashColuna) {
    status = 'Ciente';
  } else if (acessosTitular > 0 || primeiraVisualizacaoTitularEm) {
    status = 'Visualizado';
  }

  return {
    acessosTitular,
    inspecoesRh,
    primeiraVisualizacaoTitularEm,
    cienciaConfirmadaEm,
    status,
  };
}
