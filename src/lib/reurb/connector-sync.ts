import { createHash, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  ReurbAtoVinculado,
  ReurbDerivadaDTO,
  ReurbFonteCampo,
  ReurbModalidade,
  ReurbPendenciaDTO,
  ReurbSituacaoValidacao,
} from './types';

export interface ReurbIncomingRecord {
  record_key?: string;
  prenotacao: number;
  matricula: number;
  complMatricula?: string | null;
  protocolo?: string | null;
  empreendimento?: string | null;
  empreendimentoFonte?: string | null;
  empreendimentoTrechoOcr?: string | null;
  negId?: number;
  classificacaoFinal?: string;
  modalidade?: ReurbModalidade | string;
  tipoInteresse?: number;
  dataRegistro?: string | null;
  dataPrenotacao?: string | null;
  municipio?: string | null;
  distrito?: string | null;
  subdistrito?: string | null;
  bairro?: string | null;
  bairroSugerido?: string | null;
  tipoLocalizacao?: string | null;
  quantidadeUnidades?: number;
  qtdDerivadasLista?: number;
  qtdAreasPublicasExcluidas?: number;
  tipoAgente?: number | null;
  agente?: string | null;
  situacaoValidacao?: ReurbSituacaoValidacao | string;
  qtdBloqueios?: number;
  qtdAlertas?: number;
  ehArt69?: boolean;
  fontes?: ReurbFonteCampo[];
  atosVinculados?: ReurbAtoVinculado[];
  derivadas?: ReurbDerivadaDTO[];
  pendencias?: ReurbPendenciaDTO[];
}

function parseSqlDateOnly(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const iso = String(raw).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildReurbRecordKey(prenotacao: number, matricula: number): string {
  return createHash('sha256')
    .update(`reurb:${prenotacao}:${matricula}`)
    .digest('hex');
}

function normalizeModalidade(
  modalidadeRaw: unknown,
  tipoInteresse: number,
  ehArt69: boolean
): ReurbModalidade {
  if (ehArt69 || tipoInteresse === 3 || modalidadeRaw === 'ART_69') return 'ART_69';
  if (tipoInteresse === 2 || modalidadeRaw === 'REURB_E') return 'REURB_E';
  return 'REURB_S';
}

export async function sincronizarReurbBatch(
  tenantId: string,
  records: unknown[]
): Promise<{
  inseridos: number;
  atualizados: number;
  inalterados: number;
}> {
  let inseridos = 0;
  let atualizados = 0;
  let inalterados = 0;

  for (const rawItem of records) {
    if (!rawItem || typeof rawItem !== 'object') {
      inalterados += 1;
      continue;
    }
    const r = rawItem as ReurbIncomingRecord;
    const prenotacao = Number(r.prenotacao);
    const matricula = Number(r.matricula);
    if (!Number.isInteger(prenotacao) || prenotacao <= 0 || !Number.isInteger(matricula) || matricula <= 0) {
      inalterados += 1;
      continue;
    }

    const recordKey = r.record_key?.trim() || buildReurbRecordKey(prenotacao, matricula);
    const tipoInteresse = Number(r.tipoInteresse || 1);
    const ehArt69 = Boolean(r.ehArt69) || tipoInteresse === 3;
    const modalidade = normalizeModalidade(r.modalidade, tipoInteresse, ehArt69);
    const pendencias = Array.isArray(r.pendencias) ? r.pendencias : [];
    const derivadas = Array.isArray(r.derivadas) ? r.derivadas : [];
    const qtdBloqueios =
      typeof r.qtdBloqueios === 'number'
        ? r.qtdBloqueios
        : pendencias.filter((p) => p.severidade === 'BLOQUEIA').length;
    const qtdAlertas =
      typeof r.qtdAlertas === 'number'
        ? r.qtdAlertas
        : pendencias.filter((p) => ['MEDIA', 'ALTA'].includes(String(p.severidade))).length;
    const situacaoValidacao: ReurbSituacaoValidacao =
      r.situacaoValidacao === 'APTO' && qtdBloqueios === 0 ? 'APTO' : 'PENDENTE';

    const existente = await prisma.fiorixReurbRegularizacao.findUnique({
      where: {
        tenantId_recordKey: {
          tenantId,
          recordKey,
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      const saved = await tx.fiorixReurbRegularizacao.upsert({
        where: {
          tenantId_recordKey: {
            tenantId,
            recordKey,
          },
        },
        create: {
          id: randomUUID(),
          tenantId,
          recordKey,
          prenotacao,
          matricula,
          complMatricula: r.complMatricula?.trim() || null,
          protocolo: r.protocolo?.trim() || String(prenotacao),
          empreendimento: r.empreendimento?.trim() || null,
          empreendimentoFonte: r.empreendimentoFonte?.trim() || null,
          empreendimentoTrechoOcr: r.empreendimentoTrechoOcr?.trim() || null,
          negId: Number(r.negId || 947),
          classificacaoFinal: r.classificacaoFinal?.trim() || 'MATRIZ_947',
          modalidade,
          tipoInteresse,
          dataRegistro: parseSqlDateOnly(r.dataRegistro),
          dataPrenotacao: parseSqlDateOnly(r.dataPrenotacao),
          municipio: r.municipio?.trim().toUpperCase() || null,
          distrito: r.distrito?.trim() || null,
          subdistrito: r.subdistrito?.trim() || null,
          bairro: r.bairro?.trim() || null,
          bairroSugerido: r.bairroSugerido?.trim() || null,
          tipoLocalizacao: r.tipoLocalizacao === 'R' ? 'R' : 'U',
          quantidadeUnidades: Number(r.quantidadeUnidades || 0),
          qtdDerivadasLista:
            typeof r.qtdDerivadasLista === 'number'
              ? r.qtdDerivadasLista
              : derivadas.filter((d) => d.incluirNoJson).length,
          qtdAreasPublicasExcluidas:
            typeof r.qtdAreasPublicasExcluidas === 'number'
              ? r.qtdAreasPublicasExcluidas
              : derivadas.filter((d) => d.ehAreaPublica).length,
          tipoAgente: r.tipoAgente === 1 || r.tipoAgente === 2 ? r.tipoAgente : null,
          agente: r.agente?.trim() || null,
          situacaoValidacao,
          qtdBloqueios,
          qtdAlertas,
          ehArt69,
          fontesJson: (r.fontes ?? []) as unknown as Prisma.InputJsonValue,
          atosVinculadosJson: (r.atosVinculados ?? []) as unknown as Prisma.InputJsonValue,
          syncedAt: new Date(),
        },
        update: {
          complMatricula: r.complMatricula?.trim() || null,
          protocolo: r.protocolo?.trim() || String(prenotacao),
          empreendimento: r.empreendimento?.trim() || null,
          empreendimentoFonte: r.empreendimentoFonte?.trim() || null,
          empreendimentoTrechoOcr: r.empreendimentoTrechoOcr?.trim() || null,
          negId: Number(r.negId || 947),
          classificacaoFinal: r.classificacaoFinal?.trim() || 'MATRIZ_947',
          modalidade,
          tipoInteresse,
          dataRegistro: parseSqlDateOnly(r.dataRegistro),
          dataPrenotacao: parseSqlDateOnly(r.dataPrenotacao),
          municipio: r.municipio?.trim().toUpperCase() || null,
          distrito: r.distrito?.trim() || null,
          subdistrito: r.subdistrito?.trim() || null,
          bairro: r.bairro?.trim() || null,
          bairroSugerido: r.bairroSugerido?.trim() || null,
          tipoLocalizacao: r.tipoLocalizacao === 'R' ? 'R' : 'U',
          quantidadeUnidades: Number(r.quantidadeUnidades || 0),
          qtdDerivadasLista:
            typeof r.qtdDerivadasLista === 'number'
              ? r.qtdDerivadasLista
              : derivadas.filter((d) => d.incluirNoJson).length,
          qtdAreasPublicasExcluidas:
            typeof r.qtdAreasPublicasExcluidas === 'number'
              ? r.qtdAreasPublicasExcluidas
              : derivadas.filter((d) => d.ehAreaPublica).length,
          tipoAgente: r.tipoAgente === 1 || r.tipoAgente === 2 ? r.tipoAgente : null,
          agente: r.agente?.trim() || null,
          situacaoValidacao,
          qtdBloqueios,
          qtdAlertas,
          ehArt69,
          fontesJson: (r.fontes ?? []) as unknown as Prisma.InputJsonValue,
          atosVinculadosJson: (r.atosVinculados ?? []) as unknown as Prisma.InputJsonValue,
          syncedAt: new Date(),
        },
      });

      await tx.fiorixReurbDerivada.deleteMany({
        where: { regularizacaoId: saved.id },
      });
      await tx.fiorixReurbPendencia.deleteMany({
        where: { regularizacaoId: saved.id },
      });

      if (derivadas.length > 0) {
        const dedupDer = new Map<number, ReurbDerivadaDTO>();
        for (const d of derivadas) {
          const mDer = Number(d.matriculaDerivada);
          if (Number.isInteger(mDer) && mDer > 0) {
            dedupDer.set(mDer, d);
          }
        }
        if (dedupDer.size > 0) {
          await tx.fiorixReurbDerivada.createMany({
            data: Array.from(dedupDer.values()).map((d) => ({
              id: randomUUID(),
              tenantId,
              regularizacaoId: saved.id,
              matriculaDerivada: Number(d.matriculaDerivada),
              complMatricula: d.complMatricula?.trim() || null,
              dataAbertura: parseSqlDateOnly(d.dataAbertura),
              dataRegistro: parseSqlDateOnly(d.dataRegistro),
              tipoInteresse: Number(d.tipoInteresse || tipoInteresse),
              incluirNoJson: Boolean(d.incluirNoJson),
              ehAreaPublica: Boolean(d.ehAreaPublica),
              ehCondominioIntermediario: Boolean(d.ehCondominioIntermediario),
              categoriaArea: d.categoriaArea?.trim() || 'UNIDADE_AUTONOMA',
              vinculoMetodo: d.vinculoMetodo?.trim() || null,
              motivoExclusao: d.motivoExclusao?.trim() || null,
              fonteOcr: d.fonteOcr?.trim() || null,
            })),
          });
        }
      }

      if (pendencias.length > 0) {
        await tx.fiorixReurbPendencia.createMany({
          data: pendencias.map((p) => ({
            id: randomUUID(),
            tenantId,
            regularizacaoId: saved.id,
            matriculaDerivada:
              p.matriculaDerivada != null && Number.isInteger(Number(p.matriculaDerivada))
                ? Number(p.matriculaDerivada)
                : null,
            campo: String(p.campo || 'geral'),
            severidade: String(p.severidade || 'INFO'),
            motivo: String(p.motivo || ''),
            fonte: String(p.fonte || 'WEBRI'),
            acaoNecessaria: p.acaoNecessaria ? String(p.acaoNecessaria) : null,
            exigeConferencia: Boolean(p.exigeConferencia),
          })),
        });
      }
    });

    if (existente) {
      atualizados += 1;
    } else {
      inseridos += 1;
    }
  }

  return { inseridos, atualizados, inalterados };
}
