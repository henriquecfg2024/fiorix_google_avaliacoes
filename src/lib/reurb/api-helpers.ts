import { NextResponse } from 'next/server';
import { ReurbAccessError } from './permissions';
import type {
  ReurbConsultaFiltros,
  ReurbDataReferencia,
  ReurbModalidade,
  ReurbSituacaoValidacao,
} from './types';

export function reurbJsonReply(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}

export function handleReurbApiError(error: unknown): NextResponse {
  if (error instanceof ReurbAccessError) {
    return reurbJsonReply({ error: error.message }, error.status);
  }
  const msg = error instanceof Error ? error.message : 'Erro interno na Central REURB.';
  return reurbJsonReply({ error: msg }, 500);
}

export function getDefaultSpAnoMes(): { ano: number; mes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year')?.value || new Date().getFullYear());
  const m = Number(parts.find((p) => p.type === 'month')?.value || new Date().getMonth() + 1);
  return { ano: y, mes: m };
}

export function parseAnoMesFromUrl(reqUrl: string): { ano: number; mes: number | 'todos' } {
  const sp = new URL(reqUrl).searchParams;
  const def = getDefaultSpAnoMes();
  const anoRaw = sp.get('ano');
  const mesRaw = sp.get('mes');

  const anoParsed = anoRaw ? Number(anoRaw) : def.ano;
  const ano =
    Number.isInteger(anoParsed) && anoParsed >= 2009 && anoParsed <= 2100 ? anoParsed : def.ano;

  if (mesRaw === 'todos' || mesRaw === 'ALL') {
    return { ano, mes: 'todos' };
  }
  if (!mesRaw) {
    return { ano, mes: def.mes };
  }
  const mesNum = Number(mesRaw);
  const mes = Number.isInteger(mesNum) && mesNum >= 1 && mesNum <= 12 ? mesNum : def.mes;
  return { ano, mes };
}

export function parseFiltrosFromUrl(reqUrl: string): ReurbConsultaFiltros {
  const sp = new URL(reqUrl).searchParams;
  const dataDe = sp.get('dataDe')?.trim() || null;
  const dataAte = sp.get('dataAte')?.trim() || null;
  const anoRaw = sp.get('ano');
  const mesRaw = sp.get('mes');

  let ano: number | null = null;
  if (anoRaw && anoRaw !== 'todos') {
    const n = Number(anoRaw);
    if (Number.isInteger(n) && n >= 2009 && n <= 2100) ano = n;
  } else if (!anoRaw && !dataDe && !dataAte) {
    ano = getDefaultSpAnoMes().ano;
  }

  let mes: number | 'todos' | null = null;
  if (mesRaw === 'todos') {
    mes = 'todos';
  } else if (mesRaw) {
    const n = Number(mesRaw);
    if (Number.isInteger(n) && n >= 1 && n <= 12) mes = n;
  } else if (!anoRaw && !dataDe && !dataAte) {
    mes = getDefaultSpAnoMes().mes;
  }

  const tipoDataRaw = sp.get('tipoData');
  const tipoData: ReurbDataReferencia =
    tipoDataRaw === 'prenotacao' || tipoDataRaw === 'abertura_derivada'
      ? tipoDataRaw
      : 'registro';

  const modalidadeRaw = sp.get('modalidade');
  const modalidade: 'TODAS' | ReurbModalidade =
    modalidadeRaw === 'REURB_S' || modalidadeRaw === 'REURB_E' || modalidadeRaw === 'ART_69'
      ? modalidadeRaw
      : 'TODAS';

  const situacaoRaw = sp.get('situacao');
  const situacao: 'TODAS' | ReurbSituacaoValidacao =
    situacaoRaw === 'APTO' || situacaoRaw === 'PENDENTE' ? situacaoRaw : 'TODAS';

  const page = Math.max(1, Number(sp.get('page') || 1) || 1);
  const pageSize = Math.max(1, Math.min(100, Number(sp.get('pageSize') || 20) || 20));
  const busca = sp.get('busca')?.trim() || null;

  return {
    ano,
    mes,
    dataDe,
    dataAte,
    tipoData,
    busca,
    modalidade,
    situacao,
    page,
    pageSize,
    incluirArt69: sp.get('incluirArt69') === 'true',
  };
}
