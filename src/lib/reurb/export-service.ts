import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { recordAuditLog } from '@/lib/audit';
import { revalidarRegistrosNoConnector } from './connector-revalidation';
import { construirJsonImportacaoOnr, validarRegularizacaoParaOnr } from './onr-exporter';
import type { ReurbAccessContext } from './permissions';
import { carregarRegularizacoesPorIds } from './query-service';
import type { OnrJsonPayload, ReurbExportacaoDTO, ReurbRegularizacaoDTO } from './types';

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

async function safeAudit(params: {
  ctx: ReurbAccessContext;
  acao: 'EXPORTACAO_JSON' | 'EXPORTACAO_EXCEL' | 'CONFIRMACAO_IMPORTACAO_ONR';
  registroId?: string;
  registroDescricao: string;
  detalhes: Record<string, unknown>;
}) {
  try {
    await recordAuditLog({
      modulo: 'REURB',
      acao: params.acao,
      registroId: params.registroId,
      registroDescricao: params.registroDescricao,
      detalhes: params.detalhes,
      userOverride: {
        id: params.ctx.user.id,
        name: params.ctx.user.name,
        email: params.ctx.user.email,
        role: String(params.ctx.user.role),
        tenantId: params.ctx.user.tenantId,
      },
    });
  } catch {
    // Nunca interrompe operação por falha de tabela de auditoria em ambiente parcial
  }
}

function formatDateOnlyIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const clean = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : null;
}

export function resolveCompetenciaFromItens(
  itens: Array<{ dataRegistro?: string | null; incluidaNoJson: boolean }>
): {
  competenciaAno: number | null;
  competenciaMes: number | null;
  competenciaMista: boolean;
} {
  const selecionados = itens.filter((it) => it.incluidaNoJson);
  const base = selecionados.length > 0 ? selecionados : itens;
  const counts = new Map<string, { ano: number; mes: number; count: number }>();

  for (const item of base) {
    const iso = formatDateOnlyIso(item.dataRegistro);
    if (!iso) continue;
    const ano = Number.parseInt(iso.slice(0, 4), 10);
    const mes = Number.parseInt(iso.slice(5, 7), 10);
    if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) continue;
    const key = `${ano}-${String(mes).padStart(2, '0')}`;
    const current = counts.get(key);
    if (current) {
      current.count += 1;
    } else {
      counts.set(key, { ano, mes, count: 1 });
    }
  }

  if (counts.size === 0) {
    return { competenciaAno: null, competenciaMes: null, competenciaMista: false };
  }

  const ordered = [...counts.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (b.ano !== a.ano) return b.ano - a.ano;
    return b.mes - a.mes;
  });

  return {
    competenciaAno: ordered[0].ano,
    competenciaMes: ordered[0].mes,
    competenciaMista: counts.size > 1,
  };
}

function mapExportacaoRowToDto(row: {
  id: string;
  tipo: string;
  statusGeracao: string;
  statusImportacaoOnr: string;
  nomeArquivoJson: string | null;
  nomeArquivoPendencias: string | null;
  qtdSolicitadas: number;
  qtdAptasGeradas: number;
  qtdBarradas: number;
  qtdDerivadasIncluidas: number;
  jsonSha256: string | null;
  erroDetalhe: string | null;
  revalidacaoConnectorId: string | null;
  revalidadoEm: Date | null;
  ocrConsultado: boolean;
  geradoPorNome: string | null;
  confirmadoImportacaoEm: Date | null;
  confirmadoPorNome: string | null;
  protocoloOnrExterno: string | null;
  observacaoConfirmacao: string | null;
  createdAt: Date;
  itens: Array<{
    id: string;
    regularizacaoId: string | null;
    prenotacao: number;
    matricula: number;
    protocolo: string;
    empreendimento: string | null;
    modalidade: string;
    incluidaNoJson: boolean;
    situacaoNoMomento: string;
    qtdDerivadasIncluidas: number;
    motivosBloqueioJson: unknown;
    regularizacao?: { dataRegistro: Date | null } | null;
  }>;
}): ReurbExportacaoDTO {
  const itensDto = row.itens.map((it) => ({
    id: it.id,
    regularizacaoId: it.regularizacaoId,
    prenotacao: it.prenotacao,
    matricula: it.matricula,
    protocolo: it.protocolo,
    empreendimento: it.empreendimento,
    modalidade: it.modalidade,
    dataRegistro: formatDateOnlyIso(it.regularizacao?.dataRegistro),
    incluidaNoJson: it.incluidaNoJson,
    situacaoNoMomento: it.situacaoNoMomento,
    qtdDerivadasIncluidas: it.qtdDerivadasIncluidas,
    motivosBloqueio: Array.isArray(it.motivosBloqueioJson)
      ? (it.motivosBloqueioJson as Array<{
          campo: string;
          severidade?: string;
          motivo: string;
          fonte?: string;
        }>)
      : [],
  }));
  const competencia = resolveCompetenciaFromItens(itensDto);

  return {
    id: row.id,
    tipo: row.tipo === 'UNITARIA' ? 'UNITARIA' : 'LOTE',
    statusGeracao: row.statusGeracao === 'GERADO' ? 'GERADO' : 'FALHA',
    statusImportacaoOnr:
      row.statusImportacaoOnr === 'CONFIRMADA_ONR'
        ? 'CONFIRMADA_ONR'
        : row.statusImportacaoOnr === 'PENDENTE_CONFIRMACAO'
          ? 'PENDENTE_CONFIRMACAO'
          : 'NAO_GERADO',
    nomeArquivoJson: row.nomeArquivoJson,
    nomeArquivoPendencias: row.nomeArquivoPendencias,
    qtdSolicitadas: row.qtdSolicitadas,
    qtdAptasGeradas: row.qtdAptasGeradas,
    qtdBarradas: row.qtdBarradas,
    qtdDerivadasIncluidas: row.qtdDerivadasIncluidas,
    jsonSha256: row.jsonSha256,
    erroDetalhe: row.erroDetalhe,
    revalidacaoConnectorId: row.revalidacaoConnectorId,
    revalidadoEm: row.revalidadoEm ? row.revalidadoEm.toISOString() : null,
    ocrConsultado: row.ocrConsultado,
    geradoPorNome: row.geradoPorNome,
    confirmadoImportacaoEm: row.confirmadoImportacaoEm
      ? row.confirmadoImportacaoEm.toISOString()
      : null,
    confirmadoPorNome: row.confirmadoPorNome,
    protocoloOnrExterno: row.protocoloOnrExterno,
    observacaoConfirmacao: row.observacaoConfirmacao,
    competenciaAno: competencia.competenciaAno,
    competenciaMes: competencia.competenciaMes,
    competenciaMista: competencia.competenciaMista,
    createdAt: row.createdAt.toISOString(),
    itens: itensDto,
  };
}

export async function executarPreviaExportacao(params: {
  tenantId: string;
  ids: string[];
  incluirArt69?: boolean;
}) {
  const { registros, demoMode } = await carregarRegularizacoesPorIds(params.tenantId, params.ids);
  const aptas: Array<{
    id: string;
    matricula: number;
    protocolo: string;
    empreendimento: string | null;
    modalidade: string;
    qtdDerivadasJson: number;
    avisosCount: number;
    avisos: Array<{ campo: string; motivo: string }>;
  }> = [];
  const barradas: Array<{
    id: string;
    matricula: number;
    protocolo: string;
    empreendimento: string | null;
    modalidade: string;
    bloqueios: Array<{ campo: string; motivo: string }>;
  }> = [];

  for (const reg of registros) {
    const val = validarRegularizacaoParaOnr(reg, { incluirArt69: params.incluirArt69 });
    if (val.apto && val.registroOnr) {
      aptas.push({
        id: reg.id,
        matricula: reg.matricula,
        protocolo: reg.protocolo,
        empreendimento: reg.empreendimento,
        modalidade: reg.modalidade,
        qtdDerivadasJson: val.registroOnr.derivadas.length,
        avisosCount: val.avisos.length,
        avisos: val.avisos.map((a) => ({ campo: a.campo, motivo: a.motivo })),
      });
    } else {
      barradas.push({
        id: reg.id,
        matricula: reg.matricula,
        protocolo: reg.protocolo,
        empreendimento: reg.empreendimento,
        modalidade: reg.modalidade,
        bloqueios: val.bloqueios.map((b) => ({ campo: b.campo, motivo: b.motivo })),
      });
    }
  }

  return {
    totalSolicitadas: registros.length,
    naoEncontradas: Math.max(0, params.ids.length - registros.length),
    aptas,
    barradas,
    requerConfirmacaoMista: aptas.length > 0 && barradas.length > 0,
    zeroAptas: aptas.length === 0,
    demoMode,
  };
}

async function persistirFalhaExportacao(params: {
  ctx: ReurbAccessContext;
  tipo: 'UNITARIA' | 'LOTE';
  registrosSolicitados: ReurbRegularizacaoDTO[];
  erroDetalhe: string;
  connectorId: string | null;
  ocrConsultado: boolean;
  qtdAptasGeradas?: number;
  qtdBarradas?: number;
  relatorioPendencias?: unknown;
  itensCustom?: Array<{
    regularizacaoId: string | null;
    prenotacao: number;
    matricula: number;
    protocolo: string;
    empreendimento: string | null;
    modalidade: string;
    incluidaNoJson: boolean;
    situacaoNoMomento: string;
    qtdDerivadasIncluidas: number;
    motivosBloqueioJson: unknown;
  }>;
}): Promise<string | null> {
  const id = randomUUID();
  const isDemoRecord = (regId: string | null) => !regId || regId.startsWith('demo-reurb-');
  try {
    await prisma.fiorixReurbExportacao.create({
      data: {
        id,
        tenantId: params.ctx.user.tenantId,
        tipo: params.tipo,
        statusGeracao: 'FALHA',
        statusImportacaoOnr: 'NAO_GERADO',
        qtdSolicitadas: params.registrosSolicitados.length,
        qtdAptasGeradas: params.qtdAptasGeradas ?? 0,
        qtdBarradas: params.qtdBarradas ?? params.registrosSolicitados.length,
        qtdDerivadasIncluidas: 0,
        relatorioPendenciasJson: (params.relatorioPendencias ?? null) as unknown as Prisma.InputJsonValue,
        erroDetalhe: params.erroDetalhe,
        revalidacaoConnectorId: params.connectorId,
        ocrConsultado: params.ocrConsultado,
        geradoPorUserId: params.ctx.user.id,
        geradoPorNome: params.ctx.user.name || params.ctx.user.email || params.ctx.user.id,
        itens: {
          create:
            params.itensCustom?.map((it) => ({
              id: randomUUID(),
              regularizacaoId: isDemoRecord(it.regularizacaoId) ? null : it.regularizacaoId,
              prenotacao: it.prenotacao,
              matricula: it.matricula,
              protocolo: it.protocolo,
              empreendimento: it.empreendimento,
              modalidade: it.modalidade,
              incluidaNoJson: it.incluidaNoJson,
              situacaoNoMomento: it.situacaoNoMomento,
              qtdDerivadasIncluidas: it.qtdDerivadasIncluidas,
              motivosBloqueioJson: it.motivosBloqueioJson as Prisma.InputJsonValue,
            })) ??
            params.registrosSolicitados.map((r) => ({
              id: randomUUID(),
              regularizacaoId: isDemoRecord(r.id) ? null : r.id,
              prenotacao: r.prenotacao,
              matricula: r.matricula,
              protocolo: r.protocolo,
              empreendimento: r.empreendimento,
              modalidade: r.modalidade,
              incluidaNoJson: false,
              situacaoNoMomento: 'FALHA_REVALIDACAO',
              qtdDerivadasIncluidas: 0,
              motivosBloqueioJson: [
                { campo: 'connector', severidade: 'BLOQUEIA', motivo: params.erroDetalhe },
              ] as Prisma.InputJsonValue,
            })),
        },
      },
    });
    return id;
  } catch (err) {
    if (isMissingRelationError(err)) return null;
    throw err;
  }
}

export async function executarGeracaoJsonReurb(params: {
  ctx: ReurbAccessContext;
  ids: string[];
  tipo: 'UNITARIA' | 'LOTE';
  confirmarMisto?: boolean;
  incluirArt69?: boolean;
  individuais?: boolean;
}) {
  const uniqueIds = [...new Set(params.ids.filter(Boolean))];
  if (params.tipo === 'UNITARIA' && uniqueIds.length !== 1) {
    return {
      ok: false as const,
      statusHttp: 400,
      error: 'A exportação unitária exige exatamente 1 regularização.',
    };
  }
  if (uniqueIds.length === 0) {
    return {
      ok: false as const,
      statusHttp: 400,
      error: 'Selecione ao menos 1 regularização para gerar o JSON ONR.',
    };
  }

  const { registros: initialRegs, demoMode } = await carregarRegularizacoesPorIds(
    params.ctx.user.tenantId,
    uniqueIds
  );
  if (initialRegs.length === 0) {
    return {
      ok: false as const,
      statusHttp: 404,
      error: 'Regularização(ões) não encontrada(s) para esta organização.',
    };
  }

  // Revalidação obrigatória fail-closed no SRVSQL\WEBRI + SRVSIPLANIA antes de gerar o JSON
  const reval = await revalidarRegistrosNoConnector({
    tenantId: params.ctx.user.tenantId,
    userId: params.ctx.user.id,
    registros: initialRegs,
    demoMode,
  });

  if (!reval.ok) {
    const falhaId = await persistirFalhaExportacao({
      ctx: params.ctx,
      tipo: params.tipo,
      registrosSolicitados: initialRegs,
      erroDetalhe: reval.error || 'Connector offline durante geração do JSON.',
      connectorId: reval.connectorId,
      ocrConsultado: reval.ocrConsultado,
    });
    await safeAudit({
      ctx: params.ctx,
      acao: 'EXPORTACAO_JSON',
      registroId: falhaId ?? undefined,
      registroDescricao: `Exportação REURB ${params.tipo} falhou (revalidação Connector)`,
      detalhes: {
        status: 'FALHA',
        erro: reval.error,
        qtdSolicitadas: initialRegs.length,
      },
    });
    return {
      ok: false as const,
      statusHttp: reval.statusHttp,
      error: reval.error || 'Connector indisponível para revalidação obrigatória.',
      exportacaoId: falhaId,
    };
  }

  const built = construirJsonImportacaoOnr(reval.registros, {
    incluirArt69: Boolean(params.incluirArt69),
    tipo: params.tipo,
  });

  if (built.aptas.length === 0) {
    const erro =
      'Nenhuma regularização está apta para o leiaute ONR v1.4 após revalidação. O JSON não foi gerado.';
    const falhaId = await persistirFalhaExportacao({
      ctx: params.ctx,
      tipo: params.tipo,
      registrosSolicitados: reval.registros,
      erroDetalhe: erro,
      connectorId: reval.connectorId,
      ocrConsultado: reval.ocrConsultado,
      qtdAptasGeradas: 0,
      qtdBarradas: built.barradas.length,
      relatorioPendencias: built.relatorioPendencias,
      itensCustom: built.barradas.map((b) => ({
        regularizacaoId: b.regularizacao.id,
        prenotacao: b.regularizacao.prenotacao,
        matricula: b.regularizacao.matricula,
        protocolo: b.regularizacao.protocolo,
        empreendimento: b.regularizacao.empreendimento,
        modalidade: b.regularizacao.modalidade,
        incluidaNoJson: false,
        situacaoNoMomento: 'PENDENTE',
        qtdDerivadasIncluidas: 0,
        motivosBloqueioJson: b.bloqueios,
      })),
    });

    await safeAudit({
      ctx: params.ctx,
      acao: 'EXPORTACAO_JSON',
      registroId: falhaId ?? undefined,
      registroDescricao: `Exportação REURB ${params.tipo} bloqueada (0 aptas)`,
      detalhes: {
        status: 'FALHA',
        motivo: 'ZERO_APTAS',
        qtdSolicitadas: reval.registros.length,
        qtdBarradas: built.barradas.length,
      },
    });

    return {
      ok: false as const,
      statusHttp: 422,
      error: erro,
      zeroAptas: true,
      exportacaoId: falhaId,
      relatorioPendencias: built.relatorioPendencias,
      barradas: built.relatorioPendencias.itens,
    };
  }

  if (params.tipo === 'LOTE' && built.barradas.length > 0 && !params.confirmarMisto) {
    return {
      ok: false as const,
      statusHttp: 409,
      requerConfirmacaoMista: true,
      error:
        'O lote selecionado contém regularizações aptas e regularizações com pendências. Confirme se deseja gerar o JSON apenas com os processos aptos e emitir relatório para os barrados.',
      aptasCount: built.aptas.length,
      barradasCount: built.barradas.length,
      aptas: built.aptas.map((a) => ({
        id: a.regularizacao.id,
        matricula: a.regularizacao.matricula,
        protocolo: a.regularizacao.protocolo,
        empreendimento: a.regularizacao.empreendimento,
      })),
      barradas: built.relatorioPendencias.itens,
    };
  }

  const isDemoId = (regId: string) => regId.startsWith('demo-reurb-');
  const now = new Date();

  if (params.tipo === 'LOTE' && params.individuais) {
    const usedNames = new Set<string>();
    const prepared = built.aptas.map((apta, index) => {
      const ind = construirJsonImportacaoOnr([apta.regularizacao], {
        incluirArt69: Boolean(params.incluirArt69),
        tipo: 'UNITARIA',
      });
      let nomeArquivoJson = ind.nomeArquivoJson;
      if (usedNames.has(nomeArquivoJson)) {
        nomeArquivoJson = nomeArquivoJson.replace(/\.json$/i, `_${index + 1}.json`);
      }
      usedNames.add(nomeArquivoJson);
      return {
        expId: randomUUID(),
        apta,
        ind,
        nomeArquivoJson,
      };
    });

    const arquivos: Array<{
      exportacao: ReurbExportacaoDTO;
      jsonString: string;
      payload: OnrJsonPayload;
    }> = [];

    try {
      const createdRows = await prisma.$transaction(async (tx) => {
        const savedRows = [];
        for (const item of prepared) {
          const saved = await tx.fiorixReurbExportacao.create({
            data: {
              id: item.expId,
              tenantId: params.ctx.user.tenantId,
              tipo: 'UNITARIA',
              statusGeracao: 'GERADO',
              statusImportacaoOnr: 'PENDENTE_CONFIRMACAO',
              nomeArquivoJson: item.nomeArquivoJson,
              nomeArquivoPendencias: null,
              qtdSolicitadas: 1,
              qtdAptasGeradas: 1,
              qtdBarradas: 0,
              qtdDerivadasIncluidas: item.apta.registroOnr.derivadas.length,
              jsonPayload: item.ind.jsonString,
              jsonSha256: item.ind.jsonSha256,
              relatorioPendenciasJson: null as unknown as Prisma.InputJsonValue,
              revalidacaoConnectorId: reval.connectorId,
              revalidadoEm: reval.revalidadoEm ? new Date(reval.revalidadoEm) : now,
              ocrConsultado: reval.ocrConsultado,
              geradoPorUserId: params.ctx.user.id,
              geradoPorNome:
                params.ctx.user.name || params.ctx.user.email || params.ctx.user.id,
              itens: {
                create: [
                  {
                    id: randomUUID(),
                    regularizacaoId: isDemoId(item.apta.regularizacao.id)
                      ? null
                      : item.apta.regularizacao.id,
                    prenotacao: item.apta.regularizacao.prenotacao,
                    matricula: item.apta.regularizacao.matricula,
                    protocolo: item.apta.regularizacao.protocolo,
                    empreendimento: item.apta.regularizacao.empreendimento,
                    modalidade: item.apta.regularizacao.modalidade,
                    incluidaNoJson: true,
                    situacaoNoMomento: 'APTO',
                    qtdDerivadasIncluidas: item.apta.registroOnr.derivadas.length,
                    motivosBloqueioJson: item.apta.avisos as unknown as Prisma.InputJsonValue,
                  },
                ],
              },
            },
            include: {
              itens: {
                include: {
                  regularizacao: { select: { dataRegistro: true } },
                },
              },
            },
          });
          savedRows.push(saved);
        }

        const includedDbIds = built.aptas
          .map((a) => a.regularizacao.id)
          .filter((rid) => !isDemoId(rid));
        if (includedDbIds.length > 0) {
          await tx.fiorixReurbRegularizacao.updateMany({
            where: {
              tenantId: params.ctx.user.tenantId,
              id: { in: includedDbIds },
            },
            data: {
              ultimaExportacaoEm: now,
            },
          });
        }

        return savedRows;
      });

      createdRows.forEach((row, index) => {
        const item = prepared[index]!;
        arquivos.push({
          exportacao: mapExportacaoRowToDto(row),
          jsonString: item.ind.jsonString,
          payload: item.ind.payload,
        });
      });
    } catch (err) {
      if (!isMissingRelationError(err)) throw err;
      for (const item of prepared) {
        const fallbackItens = [
          {
            id: `${item.expId}-a-0`,
            regularizacaoId: item.apta.regularizacao.id,
            prenotacao: item.apta.regularizacao.prenotacao,
            matricula: item.apta.regularizacao.matricula,
            protocolo: item.apta.regularizacao.protocolo,
            empreendimento: item.apta.regularizacao.empreendimento,
            modalidade: item.apta.regularizacao.modalidade,
            dataRegistro: formatDateOnlyIso(item.apta.regularizacao.dataRegistro),
            incluidaNoJson: true,
            situacaoNoMomento: 'APTO',
            qtdDerivadasIncluidas: item.apta.registroOnr.derivadas.length,
            motivosBloqueio: item.apta.avisos,
          },
        ];
        const comp = resolveCompetenciaFromItens(fallbackItens);
        arquivos.push({
          exportacao: {
            id: item.expId,
            tipo: 'UNITARIA',
            statusGeracao: 'GERADO',
            statusImportacaoOnr: 'PENDENTE_CONFIRMACAO',
            nomeArquivoJson: item.nomeArquivoJson,
            nomeArquivoPendencias: null,
            qtdSolicitadas: 1,
            qtdAptasGeradas: 1,
            qtdBarradas: 0,
            qtdDerivadasIncluidas: item.apta.registroOnr.derivadas.length,
            jsonSha256: item.ind.jsonSha256,
            erroDetalhe: null,
            revalidacaoConnectorId: reval.connectorId,
            revalidadoEm: reval.revalidadoEm,
            ocrConsultado: reval.ocrConsultado,
            geradoPorNome:
              params.ctx.user.name || params.ctx.user.email || params.ctx.user.id,
            confirmadoImportacaoEm: null,
            confirmadoPorNome: null,
            protocoloOnrExterno: null,
            observacaoConfirmacao: null,
            competenciaAno: comp.competenciaAno,
            competenciaMes: comp.competenciaMes,
            competenciaMista: comp.competenciaMista,
            createdAt: now.toISOString(),
            itens: fallbackItens,
          },
          jsonString: item.ind.jsonString,
          payload: item.ind.payload,
        });
      }
    }

    const totalDerivadasIndividuais = built.aptas.reduce(
      (acc, a) => acc + a.registroOnr.derivadas.length,
      0
    );
    await safeAudit({
      ctx: params.ctx,
      acao: 'EXPORTACAO_JSON',
      registroId: arquivos[0]?.exportacao.id,
      registroDescricao: `Exportação REURB LOTE_INDIVIDUAL (${arquivos.length} arquivo(s), ${built.barradas.length} barradas)`,
      detalhes: {
        status: 'GERADO',
        modo: 'INDIVIDUAIS',
        qtdArquivos: arquivos.length,
        arquivos: arquivos.map((a) => a.exportacao.nomeArquivoJson),
        qtdBarradas: built.barradas.length,
        qtdDerivadasIncluidas: totalDerivadasIndividuais,
        ocrConsultado: reval.ocrConsultado,
      },
    });

    return {
      ok: true as const,
      statusHttp: 200,
      individuais: true as const,
      arquivos,
      exportacao: arquivos[0]!.exportacao,
      payload: built.payload,
      jsonString: arquivos[0]!.jsonString,
      relatorioPendencias: built.barradas.length > 0 ? built.relatorioPendencias : null,
      nomeArquivoPendencias: built.barradas.length > 0 ? built.nomeArquivoPendencias : null,
    };
  }

  const totalDerivadasIncluidas = built.aptas.reduce(
    (acc, a) => acc + a.registroOnr.derivadas.length,
    0
  );
  const expId = randomUUID();
  let dto: ReurbExportacaoDTO;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const saved = await tx.fiorixReurbExportacao.create({
        data: {
          id: expId,
          tenantId: params.ctx.user.tenantId,
          tipo: params.tipo,
          statusGeracao: 'GERADO',
          statusImportacaoOnr: 'PENDENTE_CONFIRMACAO',
          nomeArquivoJson: built.nomeArquivoJson,
          nomeArquivoPendencias: built.barradas.length > 0 ? built.nomeArquivoPendencias : null,
          qtdSolicitadas: reval.registros.length,
          qtdAptasGeradas: built.aptas.length,
          qtdBarradas: built.barradas.length,
          qtdDerivadasIncluidas: totalDerivadasIncluidas,
          jsonPayload: built.jsonString,
          jsonSha256: built.jsonSha256,
          relatorioPendenciasJson: (built.barradas.length > 0
            ? built.relatorioPendencias
            : null) as unknown as Prisma.InputJsonValue,
          revalidacaoConnectorId: reval.connectorId,
          revalidadoEm: reval.revalidadoEm ? new Date(reval.revalidadoEm) : now,
          ocrConsultado: reval.ocrConsultado,
          geradoPorUserId: params.ctx.user.id,
          geradoPorNome: params.ctx.user.name || params.ctx.user.email || params.ctx.user.id,
          itens: {
            create: [
              ...built.aptas.map((a) => ({
                id: randomUUID(),
                regularizacaoId: isDemoId(a.regularizacao.id) ? null : a.regularizacao.id,
                prenotacao: a.regularizacao.prenotacao,
                matricula: a.regularizacao.matricula,
                protocolo: a.regularizacao.protocolo,
                empreendimento: a.regularizacao.empreendimento,
                modalidade: a.regularizacao.modalidade,
                incluidaNoJson: true,
                situacaoNoMomento: 'APTO',
                qtdDerivadasIncluidas: a.registroOnr.derivadas.length,
                motivosBloqueioJson: a.avisos as unknown as Prisma.InputJsonValue,
              })),
              ...built.barradas.map((b) => ({
                id: randomUUID(),
                regularizacaoId: isDemoId(b.regularizacao.id) ? null : b.regularizacao.id,
                prenotacao: b.regularizacao.prenotacao,
                matricula: b.regularizacao.matricula,
                protocolo: b.regularizacao.protocolo,
                empreendimento: b.regularizacao.empreendimento,
                modalidade: b.regularizacao.modalidade,
                incluidaNoJson: false,
                situacaoNoMomento: 'PENDENTE',
                qtdDerivadasIncluidas: 0,
                motivosBloqueioJson: b.bloqueios as unknown as Prisma.InputJsonValue,
              })),
            ],
          },
        },
        include: {
          itens: {
            include: {
              regularizacao: { select: { dataRegistro: true } },
            },
          },
        },
      });

      const includedDbIds = built.aptas
        .map((a) => a.regularizacao.id)
        .filter((rid) => !isDemoId(rid));
      if (includedDbIds.length > 0) {
        await tx.fiorixReurbRegularizacao.updateMany({
          where: {
            tenantId: params.ctx.user.tenantId,
            id: { in: includedDbIds },
          },
          data: {
            ultimaExportacaoEm: now,
          },
        });
      }

      return saved;
    });

    dto = mapExportacaoRowToDto(created);
  } catch (err) {
    if (!isMissingRelationError(err)) throw err;
    const fallbackItens = [
      ...built.aptas.map((a, idx) => ({
        id: `${expId}-a-${idx}`,
        regularizacaoId: a.regularizacao.id,
        prenotacao: a.regularizacao.prenotacao,
        matricula: a.regularizacao.matricula,
        protocolo: a.regularizacao.protocolo,
        empreendimento: a.regularizacao.empreendimento,
        modalidade: a.regularizacao.modalidade,
        dataRegistro: formatDateOnlyIso(a.regularizacao.dataRegistro),
        incluidaNoJson: true,
        situacaoNoMomento: 'APTO',
        qtdDerivadasIncluidas: a.registroOnr.derivadas.length,
        motivosBloqueio: a.avisos,
      })),
      ...built.barradas.map((b, idx) => ({
        id: `${expId}-b-${idx}`,
        regularizacaoId: b.regularizacao.id,
        prenotacao: b.regularizacao.prenotacao,
        matricula: b.regularizacao.matricula,
        protocolo: b.regularizacao.protocolo,
        empreendimento: b.regularizacao.empreendimento,
        modalidade: b.regularizacao.modalidade,
        dataRegistro: formatDateOnlyIso(b.regularizacao.dataRegistro),
        incluidaNoJson: false,
        situacaoNoMomento: 'PENDENTE',
        qtdDerivadasIncluidas: 0,
        motivosBloqueio: b.bloqueios,
      })),
    ];
    const fallbackCompetencia = resolveCompetenciaFromItens(fallbackItens);
    dto = {
      id: expId,
      tipo: params.tipo,
      statusGeracao: 'GERADO',
      statusImportacaoOnr: 'PENDENTE_CONFIRMACAO',
      nomeArquivoJson: built.nomeArquivoJson,
      nomeArquivoPendencias: built.barradas.length > 0 ? built.nomeArquivoPendencias : null,
      qtdSolicitadas: reval.registros.length,
      qtdAptasGeradas: built.aptas.length,
      qtdBarradas: built.barradas.length,
      qtdDerivadasIncluidas: totalDerivadasIncluidas,
      jsonSha256: built.jsonSha256,
      erroDetalhe: null,
      revalidacaoConnectorId: reval.connectorId,
      revalidadoEm: reval.revalidadoEm,
      ocrConsultado: reval.ocrConsultado,
      geradoPorNome: params.ctx.user.name || params.ctx.user.email || params.ctx.user.id,
      confirmadoImportacaoEm: null,
      confirmadoPorNome: null,
      protocoloOnrExterno: null,
      observacaoConfirmacao: null,
      competenciaAno: fallbackCompetencia.competenciaAno,
      competenciaMes: fallbackCompetencia.competenciaMes,
      competenciaMista: fallbackCompetencia.competenciaMista,
      createdAt: now.toISOString(),
      itens: fallbackItens,
    };
  }

  await safeAudit({
    ctx: params.ctx,
    acao: 'EXPORTACAO_JSON',
    registroId: dto.id,
    registroDescricao: `Exportação REURB ${params.tipo} (${built.aptas.length} aptas, ${built.barradas.length} barradas)`,
    detalhes: {
      status: 'GERADO',
      nomeArquivoJson: built.nomeArquivoJson,
      jsonSha256: built.jsonSha256,
      qtdAptasGeradas: built.aptas.length,
      qtdBarradas: built.barradas.length,
      qtdDerivadasIncluidas: totalDerivadasIncluidas,
      ocrConsultado: reval.ocrConsultado,
    },
  });

  return {
    ok: true as const,
    statusHttp: 200,
    exportacao: dto,
    payload: built.payload,
    jsonString: built.jsonString,
    relatorioPendencias: built.barradas.length > 0 ? built.relatorioPendencias : null,
  };
}

export interface ListarExportacoesReurbFiltro {
  ano?: number | null;
  mes?: number | null;
  limit?: number;
}

export async function listarExportacoesReurb(
  tenantId: string,
  filtros?: ListarExportacoesReurbFiltro
): Promise<ReurbExportacaoDTO[]> {
  try {
    const ano = filtros?.ano ?? null;
    const mes = filtros?.mes ?? null;
    const limit = Math.min(Math.max(filtros?.limit ?? 200, 1), 500);

    const where: Prisma.FiorixReurbExportacaoWhereInput = { tenantId };
    if (ano !== null) {
      const start =
        mes !== null ? new Date(Date.UTC(ano, mes - 1, 1)) : new Date(Date.UTC(ano, 0, 1));
      const end =
        mes !== null ? new Date(Date.UTC(ano, mes, 1)) : new Date(Date.UTC(ano + 1, 0, 1));
      where.itens = {
        some: {
          regularizacao: {
            dataRegistro: {
              gte: start,
              lt: end,
            },
          },
        },
      };
    }

    const rows = await prisma.fiorixReurbExportacao.findMany({
      where,
      include: {
        itens: {
          include: {
            regularizacao: { select: { dataRegistro: true } },
          },
          orderBy: [{ incluidaNoJson: 'desc' }, { matricula: 'asc' }],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const dtos = rows.map(mapExportacaoRowToDto);
    if (ano === null && mes !== null) {
      return dtos.filter(
        (dto) =>
          dto.competenciaMes === mes ||
          dto.itens.some((it) => {
            if (!it.dataRegistro) return false;
            return Number.parseInt(it.dataRegistro.slice(5, 7), 10) === mes;
          })
      );
    }
    return dtos;
  } catch (err) {
    if (isMissingRelationError(err)) return [];
    throw err;
  }
}

export async function obterArquivoExportacaoReurb(params: {
  tenantId: string;
  exportacaoId: string;
  tipoDownload: 'json' | 'pendencias';
}) {
  const row = await prisma.fiorixReurbExportacao.findFirst({
    where: {
      id: params.exportacaoId,
      tenantId: params.tenantId,
    },
  });
  if (!row) return null;

  if (params.tipoDownload === 'pendencias') {
    if (!row.relatorioPendenciasJson) return null;
    return {
      fileName: row.nomeArquivoPendencias || `reurb_pendencias_${row.id.slice(0, 8)}.json`,
      content: JSON.stringify(row.relatorioPendenciasJson, null, 2),
    };
  }

  if (!row.jsonPayload) return null;
  return {
    fileName: row.nomeArquivoJson || `reurb_onr_${row.id.slice(0, 8)}.json`,
    content: row.jsonPayload,
  };
}

export async function confirmarImportacaoOnrReurb(params: {
  ctx: ReurbAccessContext;
  exportacaoId: string;
  protocoloOnrExterno?: string | null;
  observacao?: string | null;
}) {
  const existing = await prisma.fiorixReurbExportacao.findFirst({
    where: {
      id: params.exportacaoId,
      tenantId: params.ctx.user.tenantId,
    },
    include: { itens: true },
  });

  if (!existing) {
    return {
      ok: false as const,
      statusHttp: 404,
      error: 'Registro de exportação não encontrado.',
    };
  }

  if (existing.statusGeracao !== 'GERADO') {
    return {
      ok: false as const,
      statusHttp: 422,
      error: 'Apenas arquivos efetivamente gerados podem ter importação confirmada no ONR.',
    };
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.fiorixReurbExportacao.update({
      where: { id: existing.id },
      data: {
        statusImportacaoOnr: 'CONFIRMADA_ONR',
        confirmadoImportacaoEm: now,
        confirmadoPorUserId: params.ctx.user.id,
        confirmadoPorNome:
          params.ctx.user.name || params.ctx.user.email || params.ctx.user.id,
        protocoloOnrExterno: params.protocoloOnrExterno?.trim() || null,
        observacaoConfirmacao: params.observacao?.trim() || null,
      },
      include: {
        itens: {
          include: {
            regularizacao: { select: { dataRegistro: true } },
          },
        },
      },
    });

    const regIds = existing.itens
      .filter((i) => i.incluidaNoJson && i.regularizacaoId)
      .map((i) => i.regularizacaoId!) ;
    if (regIds.length > 0) {
      await tx.fiorixReurbRegularizacao.updateMany({
        where: {
          tenantId: params.ctx.user.tenantId,
          id: { in: regIds },
        },
        data: {
          ultimaImportacaoConfirmadaEm: now,
        },
      });
    }
    return saved;
  });

  await safeAudit({
    ctx: params.ctx,
    acao: 'CONFIRMACAO_IMPORTACAO_ONR',
    registroId: existing.id,
    registroDescricao: `Confirmação manual de importação no ONR (${existing.nomeArquivoJson || existing.id})`,
    detalhes: {
      protocoloOnrExterno: params.protocoloOnrExterno || null,
      observacao: params.observacao || null,
      qtdAptasGeradas: existing.qtdAptasGeradas,
    },
  });

  return {
    ok: true as const,
    statusHttp: 200,
    exportacao: mapExportacaoRowToDto(updated),
  };
}

export async function registrarAuditExcelReurb(params: {
  ctx: ReurbAccessContext;
  ano: number;
  mes: number | 'todos';
  totalRegistros: number;
}) {
  await safeAudit({
    ctx: params.ctx,
    acao: 'EXPORTACAO_EXCEL',
    registroDescricao: `Exportação Excel REURB (${params.mes === 'todos' ? 'Ano inteiro' : `Mês ${params.mes}`}/${params.ano})`,
    detalhes: {
      ano: params.ano,
      mes: params.mes,
      totalRegistros: params.totalRegistros,
    },
  });
}
