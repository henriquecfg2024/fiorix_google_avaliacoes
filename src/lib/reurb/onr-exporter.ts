import { createHash } from 'node:crypto';
import type {
  OnrJsonDerivada,
  OnrJsonPayload,
  OnrJsonRegularizacao,
  OnrValidationIssue,
  OnrValidationResult,
  ReurbRegularizacaoDTO,
} from './types';

export const ONR_LEIAUTE_VERSAO = '1.4';
export const ONR_DATA_MINIMA_REURB = '2009-03-25';

export interface OnrBuildOptions {
  incluirArt69?: boolean;
  tipo?: 'UNITARIA' | 'LOTE';
}

export interface OnrLoteBuildOutput {
  payload: OnrJsonPayload;
  jsonString: string;
  jsonSha256: string;
  nomeArquivoJson: string;
  nomeArquivoPendencias: string;
  aptas: Array<{
    regularizacao: ReurbRegularizacaoDTO;
    registroOnr: OnrJsonRegularizacao;
    avisos: OnrValidationIssue[];
  }>;
  barradas: Array<{
    regularizacao: ReurbRegularizacaoDTO;
    bloqueios: OnrValidationIssue[];
    avisos: OnrValidationIssue[];
  }>;
  relatorioPendencias: {
    leiaute: string;
    geradoEm: string;
    qtdBarradas: number;
    itens: Array<{
      prenotacao: number;
      matricula: number;
      protocolo: string;
      empreendimento: string | null;
      modalidade: string;
      bloqueios: OnrValidationIssue[];
      avisos: OnrValidationIssue[];
    }>;
  };
}

function isIsoDateValid(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toISOString().slice(0, 10) === value;
}

function cleanStr(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function validarRegularizacaoParaOnr(
  reg: ReurbRegularizacaoDTO,
  options: OnrBuildOptions = {}
): OnrValidationResult {
  const issues: OnrValidationIssue[] = [];
  const addIssue = (
    campo: string,
    severidade: 'BLOQUEIA' | 'MEDIA' | 'INFO',
    motivo: string,
    matriculaDerivada: number | null = null
  ) => {
    issues.push({
      matricula: matriculaDerivada ?? reg.matricula,
      prenotacao: reg.prenotacao,
      campo,
      severidade,
      motivo,
    });
  };

  if ((reg.ehArt69 || reg.tipoInteresse === 3) && !options.incluirArt69) {
    addIssue(
      'tipoInteresse',
      'BLOQUEIA',
      'Parcelamento anterior à Lei 6.766/79 (art. 69, Lei 13.465/17) parametrizado para retenção até confirmação de escopo e documentação municipal.'
    );
  }

  for (const pend of reg.pendencias || []) {
    addIssue(pend.campo, pend.severidade, pend.motivo, pend.matriculaDerivada ?? reg.matricula);
  }

  if (!Number.isInteger(reg.matricula) || reg.matricula <= 0) {
    addIssue('matricula', 'BLOQUEIA', 'Número de matrícula matriz inválido.');
  }

  const municipio = cleanStr(reg.municipio).toUpperCase();
  if (!municipio) {
    addIssue('municipio', 'BLOQUEIA', 'Município não informado (obrigatório no Manual ONR v1.4).');
  } else if (municipio.length > 100) {
    addIssue('municipio', 'BLOQUEIA', `Município excede o limite de 100 caracteres (${municipio.length}).`);
  }

  const distrito = cleanStr(reg.distrito);
  if (!distrito) {
    addIssue('distrito', 'BLOQUEIA', 'Distrito não informado (obrigatório no Manual ONR v1.4).');
  } else if (distrito.length > 30) {
    addIssue(
      'distrito',
      'BLOQUEIA',
      `Distrito "${distrito}" excede 30 caracteres (${distrito.length}). Abreviação automática não autorizada.`
    );
  }

  let subdistrito = cleanStr(reg.subdistrito);
  if (!subdistrito && /^GUAIANA[SZ]ES$/i.test(distrito)) {
    subdistrito = 'GUAIANASES';
    addIssue(
      'subdistrito',
      'INFO',
      'Subdistrito preenchido automaticamente como "GUAIANASES" para imóvel do distrito de Guaianases (exigência do validador do Ofício Eletrônico ONR).'
    );
  }
  if (!subdistrito) {
    addIssue(
      'subdistrito',
      'BLOQUEIA',
      'Subdistrito deve ser informado (obrigatório no validador do Ofício Eletrônico ONR).'
    );
  } else if (subdistrito.length > 30) {
    addIssue(
      'subdistrito',
      'BLOQUEIA',
      `Subdistrito "${subdistrito}" excede 30 caracteres (${subdistrito.length}).`
    );
  }

  const bairro = cleanStr(reg.bairro);
  if (!bairro) {
    const sug = cleanStr(reg.bairroSugerido);
    addIssue(
      'bairro',
      'BLOQUEIA',
      sug
        ? `Bairro não comprovado automaticamente. Sugestão nos logradouros: "${sug}" (exige conferência manual).`
        : 'Bairro não comprovado no WEBRI/OCR (obrigatório no Manual ONR v1.4).'
    );
  } else if (bairro.length > 30) {
    addIssue(
      'bairro',
      'BLOQUEIA',
      `Bairro "${bairro}" excede 30 caracteres (${bairro.length}). Abreviação automática desativada conforme regra vigente.`
    );
  }

  const tipoLocalizacaoRaw = cleanStr(reg.tipoLocalizacao).toUpperCase();
  if (tipoLocalizacaoRaw !== 'U' && tipoLocalizacaoRaw !== 'R') {
    addIssue(
      'tipoLocalizacao',
      'BLOQUEIA',
      `tipoLocalizacao "${reg.tipoLocalizacao}" inválido para o Manual ONR v1.4 (esperado "U" ou "R").`
    );
  }

  if (!Number.isInteger(reg.quantidadeUnidades) || reg.quantidadeUnidades < 1) {
    addIssue(
      'quantidadeUnidades',
      'BLOQUEIA',
      'quantidadeUnidades deve ser um inteiro maior ou igual a 1.'
    );
  }

  if (!isIsoDateValid(reg.dataRegistro)) {
    addIssue('dataRegistro', 'BLOQUEIA', 'dataRegistro da regularização ausente ou inválida.');
  } else if (reg.dataRegistro < ONR_DATA_MINIMA_REURB) {
    addIssue(
      'dataRegistro',
      'BLOQUEIA',
      `dataRegistro (${reg.dataRegistro}) anterior ao marco inicial da REURB no ONR (${ONR_DATA_MINIMA_REURB}, MP 459/2009).`
    );
  }

  if (!isIsoDateValid(reg.dataPrenotacao)) {
    addIssue('dataPrenotacao', 'BLOQUEIA', 'dataPrenotacao ausente ou inválida.');
  } else if (reg.dataPrenotacao < ONR_DATA_MINIMA_REURB) {
    addIssue(
      'dataPrenotacao',
      'BLOQUEIA',
      `dataPrenotacao (${reg.dataPrenotacao}) anterior ao marco inicial (${ONR_DATA_MINIMA_REURB}).`
    );
  }

  const validInterest = reg.tipoInteresse === 1 || reg.tipoInteresse === 2 || reg.tipoInteresse === 3;
  if (!validInterest) {
    addIssue('tipoInteresse', 'BLOQUEIA', `tipoInteresse "${reg.tipoInteresse}" inválido (esperado 1, 2 ou 3).`);
  }

  if (reg.tipoAgente !== 1 && reg.tipoAgente !== 2) {
    addIssue(
      'tipoAgente',
      'BLOQUEIA',
      'tipoAgente não comprovado como Poder Público (1) ou Particular/Beneficiário (2).'
    );
  }

  const agente = cleanStr(reg.agente);
  if (!agente) {
    addIssue('agente', 'BLOQUEIA', 'Nome do agente legitimado não informado.');
  } else if (agente.length > 100) {
    addIssue(
      'agente',
      'BLOQUEIA',
      `Nome do agente excede o limite de 100 caracteres (${agente.length}) do Manual ONR v1.4.`
    );
  }

  const derivadasValidas = (reg.derivadas || []).filter(
    (d) => d.incluirNoJson && !d.ehAreaPublica && !d.ehCondominioIntermediario
  );

  if (derivadasValidas.length < 1) {
    addIssue(
      'derivadas',
      'BLOQUEIA',
      'Ao menos 1 matrícula derivada autônoma deve compor o array derivadas[] (Manual ONR v1.4, pág. 10).'
    );
  }

  if (reg.quantidadeUnidades > 0 && derivadasValidas.length !== reg.quantidadeUnidades) {
    const alreadyWarned = issues.some((i) => i.campo === 'quantidadeUnidades' && i.severidade === 'MEDIA');
    if (!alreadyWarned) {
      addIssue(
        'quantidadeUnidades',
        'MEDIA',
        `quantidadeUnidades (${reg.quantidadeUnidades}) difere do total de derivadas válidas (${derivadasValidas.length}). Manual v1.4 (pág. 25) permite o envio quando áreas públicas ou unidades excluídas justificam a diferença.`
      );
    }
  }

  const derivadasJson: OnrJsonDerivada[] = [];
  for (const d of derivadasValidas) {
    if (!Number.isInteger(d.matriculaDerivada) || d.matriculaDerivada <= 0) {
      addIssue('derivadas.matricula', 'BLOQUEIA', 'Matrícula derivada inválida.', d.matriculaDerivada);
      continue;
    }

    if (d.dataAbertura && !isIsoDateValid(d.dataAbertura)) {
      addIssue(
        'derivadas.dataAbertura',
        'BLOQUEIA',
        `dataAbertura inválida na derivada ${d.matriculaDerivada}.`,
        d.matriculaDerivada
      );
      continue;
    }

    if (!d.dataAbertura) {
      const hasAberturaWarn = issues.some(
        (i) => i.campo === 'derivadas.dataAbertura' && i.matricula === d.matriculaDerivada
      );
      if (!hasAberturaWarn) {
        addIssue(
          'derivadas.dataAbertura',
          'MEDIA',
          `dataAbertura ausente na derivada ${d.matriculaDerivada}; campo será omitido no JSON (opcional na pág. 24 do Manual ONR v1.4).`,
          d.matriculaDerivada
        );
      }
    }

    let dataRegistroDerivada: string | null = null;
    if (d.dataRegistro) {
      if (!isIsoDateValid(d.dataRegistro)) {
        addIssue(
          'derivadas.dataRegistro',
          'BLOQUEIA',
          `dataRegistro inválida na derivada ${d.matriculaDerivada}.`,
          d.matriculaDerivada
        );
        continue;
      }
      dataRegistroDerivada = d.dataRegistro;
    }

    const interesseDer = (d.tipoInteresse === 1 || d.tipoInteresse === 2 || d.tipoInteresse === 3
      ? d.tipoInteresse
      : reg.tipoInteresse) as 1 | 2 | 3;

    const itemDer: OnrJsonDerivada = {
      matricula: d.matriculaDerivada,
      ...(d.dataAbertura ? { dataAbertura: d.dataAbertura } : {}),
      dataRegistro: dataRegistroDerivada,
      tipoInteresse: interesseDer,
    };
    derivadasJson.push(itemDer);
  }

  const dedupIssues: OnrValidationIssue[] = [];
  const seenIssue = new Set<string>();
  for (const issue of issues) {
    const key = `${issue.matricula ?? ''}|${issue.campo}|${issue.severidade}|${issue.motivo}`;
    if (!seenIssue.has(key)) {
      seenIssue.add(key);
      dedupIssues.push(issue);
    }
  }

  const bloqueios = dedupIssues.filter((i) => i.severidade === 'BLOQUEIA');
  const avisos = dedupIssues.filter((i) => i.severidade !== 'BLOQUEIA');

  if (bloqueios.length > 0) {
    return {
      apto: false,
      registroOnr: null,
      issues: dedupIssues,
      bloqueios,
      avisos,
    };
  }

  const registroOnr: OnrJsonRegularizacao = {
    matricula: reg.matricula,
    municipio,
    distrito,
    subdistrito,
    bairro,
    tipoLocalizacao: tipoLocalizacaoRaw as 'U' | 'R',
    quantidadeUnidades: reg.quantidadeUnidades,
    dataRegistro: reg.dataRegistro!,
    dataPrenotacao: reg.dataPrenotacao!,
    tipoInteresse: reg.tipoInteresse as 1 | 2 | 3,
    tipoAgente: reg.tipoAgente as 1 | 2,
    agente,
    derivadas: derivadasJson,
  };

  return {
    apto: true,
    registroOnr,
    issues: dedupIssues,
    bloqueios,
    avisos,
  };
}

export function construirJsonImportacaoOnr(
  registros: ReurbRegularizacaoDTO[],
  options: OnrBuildOptions = {}
): OnrLoteBuildOutput {
  const aptas: OnrLoteBuildOutput['aptas'] = [];
  const barradas: OnrLoteBuildOutput['barradas'] = [];

  for (const reg of registros) {
    const res = validarRegularizacaoParaOnr(reg, options);
    if (res.apto && res.registroOnr) {
      aptas.push({
        regularizacao: reg,
        registroOnr: res.registroOnr,
        avisos: res.avisos,
      });
    } else {
      barradas.push({
        regularizacao: reg,
        bloqueios: res.bloqueios,
        avisos: res.avisos,
      });
    }
  }

  const payload: OnrJsonPayload = {
    regularizacoes: aptas.map((a) => a.registroOnr),
  };

  const jsonString = JSON.stringify(payload, null, 2);
  const jsonSha256 = createHash('sha256').update(jsonString).digest('hex');

  const stamp = new Date()
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
  const singleMat = options.tipo === 'UNITARIA' && aptas.length === 1 ? aptas[0]!.registroOnr.matricula : null;
  const nomeArquivoJson = singleMat
    ? `reurb_onr_mat_${singleMat}_${stamp}.json`
    : `reurb_onr_lote_${stamp}.json`;
  const nomeArquivoPendencias = `reurb_onr_pendencias_${stamp}.json`;

  return {
    payload,
    jsonString,
    jsonSha256,
    nomeArquivoJson,
    nomeArquivoPendencias,
    aptas,
    barradas,
    relatorioPendencias: {
      leiaute: ONR_LEIAUTE_VERSAO,
      geradoEm: new Date().toISOString(),
      qtdBarradas: barradas.length,
      itens: barradas.map((b) => ({
        prenotacao: b.regularizacao.prenotacao,
        matricula: b.regularizacao.matricula,
        protocolo: b.regularizacao.protocolo,
        empreendimento: b.regularizacao.empreendimento,
        modalidade: b.regularizacao.modalidade,
        bloqueios: b.bloqueios,
        avisos: b.avisos,
      })),
    },
  };
}
