import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { canUserConferirManifestacao } from '@/lib/documental/access';
import { recordAuditLog } from '@/lib/audit';
import { sanitizarMatriculaTranscricao } from '@/lib/confrontacoes';

/**
 * Fila "Formulários em Conferência com o Oficial" (status = conferencia) e
 * ARQUIVO de Manifestações finalizadas após a Etapa 2 (status = finalizada, imutável no banco).
 * Tabela criada por prisma/migrations/document_manifestacoes.sql.
 */

export type StatusManifestacao = 'conferencia' | 'finalizada';

export interface UsuarioManifestacao {
  id: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface EventoHistoricoManifestacao {
  tipo:
  | 'SALVO_EM_CONFERENCIA'
  | 'CONFERENCIA_CONCLUIDA'
  | 'CONFERENCIA_REABERTA'
  | 'ETAPA2_FINALIZADA_E_ARQUIVADA';
  dataHora: string;
  usuarioId?: string | null;
  usuarioNome?: string | null;
  confirmouImpressao?: boolean;
  descricao: string;
}

export interface ManifestacaoResumo {
  id: string;
  fichaId: string;
  status: StatusManifestacao;
  versao: number;
  versaoAnteriorId: string | null;
  numeroProcesso: string | null;
  requerente: string | null;
  matricula: string | null;
  subdistrito: string | null;
  escrevente: string | null;
  imovel: string | null;
  natureza?: string | null;
  cartorioOrigem?: string | null;
  conferidoPorNome?: string | null;
  conferidoEm?: string | null;
  impressaoConfirmadaEm?: string | null;
  criadoPorNome: string | null;
  atualizadoPorNome: string | null;
  finalizadoPorNome: string | null;
  hashSha256: string | null;
  createdAt: Date;
  updatedAt: Date;
  finalizadoEm: Date | null;
}

export interface ManifestacaoCompleta extends ManifestacaoResumo {
  dados: Prisma.JsonValue;
  arquivoOrigem: Prisma.JsonValue | null;
  minuta: Prisma.JsonValue | null;
  textoFinal: string | null;
}

export interface EntradaFicha {
  fichaId: string;
  dados: Record<string, unknown>;
  arquivoOrigem?: Record<string, unknown> | null;
}

export interface EntradaFinalizacao extends EntradaFicha {
  minuta: Record<string, unknown>;
  textoFinal: string;
  confirmouImpressao?: boolean;
  versaoAnteriorId?: string | null;
}

export interface FiltrosManifestacao {
  status: StatusManifestacao | 'todas';
  busca?: string;
  escrevente?: string;
  de?: string; // AAAA-MM-DD
  ate?: string; // AAAA-MM-DD
  limite?: number;
  deslocamento?: number;
}

export class ManifestacaoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const COLUNAS_RESUMO = Prisma.sql`"id", "fichaId", "status", "versao", "versaoAnteriorId", "numeroProcesso", "requerente",
  "matricula", "subdistrito", "escrevente",
  "dados"->>'imovel' AS "imovel",
  "dados"->>'processo_tipo' AS "natureza",
  "dados"->>'cartorio_origem' AS "cartorioOrigem",
  "dados"->>'conferido_por_nome' AS "conferidoPorNome",
  "dados"->>'conferido_em' AS "conferidoEm",
  "dados"->>'impressao_confirmada_em' AS "impressaoConfirmadaEm",
  "criadoPorNome", "atualizadoPorNome",
  "finalizadoPorNome", "hashSha256", "createdAt", "updatedAt", "finalizadoEm"`;

const texto = (v: unknown, max = 500): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const nomeUsuario = (u: UsuarioManifestacao) => (u.name || u.email || 'Usuário').slice(0, 200);

const removerAcentos = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Campos indexados extraídos do formulário (para listagem e pesquisa). */
function camposIndexados(dados: Record<string, unknown>) {
  const matRaw = texto(dados.matricula_transcricao, 120);
  return {
    numeroProcesso: texto(dados.numero_processo, 60),
    requerente: texto(dados.requerente),
    matricula: matRaw ? sanitizarMatriculaTranscricao(matRaw) : null,
    subdistrito: texto(dados.subdistrito, 120),
    escrevente: texto(dados.escrevente_pasta, 120),
  };
}

export function calcularHashManifestacao(textoFinal: string): string {
  return createHash('sha256').update(textoFinal, 'utf8').digest('hex');
}

type Tx = Prisma.TransactionClient;

interface LinhaEmConferencia {
  id: string;
  dados: Prisma.JsonValue;
}

/** Ficha em conferência do mesmo formulário ou, na falta, do mesmo processo (uma por processo, como no app original). */
async function localizarRegistroEmConferencia(
  tx: Tx,
  tenantId: string,
  fichaId: string,
  numeroProcesso: string | null,
): Promise<LinhaEmConferencia | null> {
  const porFicha = await tx.$queryRaw<LinhaEmConferencia[]>`
    SELECT "id", "dados" FROM "DocumentManifestacao"
    WHERE "tenantId" = ${tenantId} AND "status" = 'conferencia' AND "fichaId" = ${fichaId}
    LIMIT 1 FOR UPDATE`;
  if (porFicha.length) return porFicha[0];
  if (!numeroProcesso) return null;
  const porProcesso = await tx.$queryRaw<LinhaEmConferencia[]>`
    SELECT "id", "dados" FROM "DocumentManifestacao"
    WHERE "tenantId" = ${tenantId} AND "status" = 'conferencia' AND "numeroProcesso" = ${numeroProcesso}
    ORDER BY "updatedAt" DESC LIMIT 1 FOR UPDATE`;
  return porProcesso[0] ?? null;
}

async function bloquear(tx: Tx, tenantId: string, chave: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'manifestacao:' + tenantId + ':' + chave}))`;
}

async function lerResumo(tx: Tx | typeof prisma, tenantId: string, id: string): Promise<ManifestacaoResumo> {
  const rows = await tx.$queryRaw<ManifestacaoResumo[]>`
    SELECT ${COLUNAS_RESUMO} FROM "DocumentManifestacao" WHERE "tenantId" = ${tenantId} AND "id" = ${id}`;
  if (!rows.length) throw new ManifestacaoError(404, 'Manifestação não encontrada.');
  return rows[0];
}

export async function salvarFichaEmConferencia(
  tenantId: string,
  usuario: UsuarioManifestacao,
  entrada: EntradaFicha,
): Promise<ManifestacaoResumo> {
  const campos = camposIndexados(entrada.dados);
  const podeConferir = canUserConferirManifestacao(usuario.role);
  const origemJson = entrada.arquivoOrigem ? JSON.stringify(entrada.arquivoOrigem) : null;

  return prisma.$transaction(async tx => {
    await bloquear(tx, tenantId, campos.numeroProcesso || entrada.fichaId);
    const existente = await localizarRegistroEmConferencia(tx, tenantId, entrada.fichaId, campos.numeroProcesso);
    const dadosBanco =
      existente?.dados && typeof existente.dados === 'object'
        ? (existente.dados as Record<string, unknown>)
        : null;

    const jaEstavaConferido = dadosBanco?.status_conferencia === 'CONFERIDO';
    const solicitouConferido = entrada.dados.status_conferencia === 'CONFERIDO';
    const statusConferencia =
      jaEstavaConferido || (solicitouConferido && podeConferir)
        ? 'CONFERIDO'
        : 'AGUARDANDO_CONFERENCIA';

    const conferidoPorNome =
      statusConferencia === 'CONFERIDO'
        ? texto(dadosBanco?.conferido_por_nome, 200) ??
        (podeConferir ? texto(entrada.dados.conferido_por_nome, 200) ?? nomeUsuario(usuario) : null)
        : null;
    const conferidoEm =
      statusConferencia === 'CONFERIDO'
        ? texto(dadosBanco?.conferido_em, 60) ??
        (podeConferir ? texto(entrada.dados.conferido_em, 60) ?? new Date().toISOString() : null)
        : null;

    const historicoAnterior = Array.isArray(dadosBanco?.historico_eventos)
      ? (dadosBanco.historico_eventos as EventoHistoricoManifestacao[])
      : [];

    const dadosEnriquecidos: Record<string, unknown> = {
      ...(dadosBanco || {}),
      ...entrada.dados,
      status_conferencia: statusConferencia,
      conferido_por_nome: conferidoPorNome,
      conferido_em: conferidoEm,
      historico_eventos: historicoAnterior,
    };
    const dadosJson = JSON.stringify(dadosEnriquecidos);

    if (existente) {
      await tx.$executeRaw`
        UPDATE "DocumentManifestacao" SET
          "dados" = ${dadosJson}::jsonb, "arquivoOrigem" = ${origemJson}::jsonb,
          "numeroProcesso" = ${campos.numeroProcesso}, "requerente" = ${campos.requerente}, "matricula" = ${campos.matricula},
          "subdistrito" = ${campos.subdistrito}, "escrevente" = ${campos.escrevente},
          "atualizadoPorId" = ${usuario.id}, "atualizadoPorNome" = ${nomeUsuario(usuario)}, "updatedAt" = NOW()
        WHERE "id" = ${existente.id} AND "tenantId" = ${tenantId} AND "status" = 'conferencia'`;
      void recordAuditLog({
        modulo: 'GESTAO_DOCUMENTAL',
        acao: 'ALTERACAO',
        registroId: existente.id,
        registroDescricao: campos.numeroProcesso || 'Rascunho em conferência',
        detalhes: {
          fichaId: entrada.fichaId,
          matricula: campos.matricula,
          requerente: campos.requerente,
          statusConferencia,
        },
      });
      return lerResumo(tx, tenantId, existente.id);
    }

    const id = randomUUID();
    await tx.$executeRaw`
      INSERT INTO "DocumentManifestacao" ("id", "tenantId", "fichaId", "status", "numeroProcesso", "requerente", "matricula",
        "subdistrito", "escrevente", "dados", "arquivoOrigem", "criadoPorId", "criadoPorNome", "atualizadoPorId", "atualizadoPorNome")
      VALUES (${id}, ${tenantId}, ${entrada.fichaId}, 'conferencia', ${campos.numeroProcesso}, ${campos.requerente}, ${campos.matricula},
        ${campos.subdistrito}, ${campos.escrevente}, ${dadosJson}::jsonb, ${origemJson}::jsonb, ${usuario.id}, ${nomeUsuario(usuario)},
        ${usuario.id}, ${nomeUsuario(usuario)})`;
    void recordAuditLog({
      modulo: 'GESTAO_DOCUMENTAL',
      acao: 'INCLUSAO',
      registroId: id,
      registroDescricao: campos.numeroProcesso || 'Novo rascunho em conferência',
      detalhes: {
        fichaId: entrada.fichaId,
        matricula: campos.matricula,
        requerente: campos.requerente,
        statusConferencia,
      },
    });
    return lerResumo(tx, tenantId, id);
  });
}

export async function conferirFichaManifestacao(
  tenantId: string,
  usuario: UsuarioManifestacao,
  registroId: string,
  statusConferencia: 'AGUARDANDO_CONFERENCIA' | 'CONFERIDO',
): Promise<ManifestacaoCompleta> {
  if (!canUserConferirManifestacao(usuario.role)) {
    throw new ManifestacaoError(
      403,
      'Apenas o Oficial, Substituto ou Administrador podem realizar ou alterar a conferência.',
    );
  }

  const rows = await prisma.$queryRaw<Array<{ id: string; status: StatusManifestacao; dados: Prisma.JsonValue }>>`
    SELECT "id", "status", "dados" FROM "DocumentManifestacao"
    WHERE "tenantId" = ${tenantId} AND "id" = ${registroId}
    LIMIT 1`;
  if (!rows.length) {
    throw new ManifestacaoError(404, 'Formulário não encontrado para conferência.');
  }
  if (rows[0].status === 'finalizada') {
    throw new ManifestacaoError(
      409,
      'Este procedimento já foi finalizado e arquivado e não pode ter a conferência alterada.',
    );
  }

  const dadosAtuais =
    rows[0].dados && typeof rows[0].dados === 'object'
      ? (rows[0].dados as Record<string, unknown>)
      : {};
  const agoraIso = new Date().toISOString();
  const nomeConf = nomeUsuario(usuario);
  const historicoAnterior = Array.isArray(dadosAtuais.historico_eventos)
    ? (dadosAtuais.historico_eventos as EventoHistoricoManifestacao[])
    : [];
  const novoEvento: EventoHistoricoManifestacao = {
    tipo: statusConferencia === 'CONFERIDO' ? 'CONFERENCIA_CONCLUIDA' : 'CONFERENCIA_REABERTA',
    dataHora: agoraIso,
    usuarioId: usuario.id,
    usuarioNome: nomeConf,
    descricao:
      statusConferencia === 'CONFERIDO'
        ? 'Procedimento marcado como CONFERIDO na conferência oficial.'
        : 'Procedimento retornado para Aguardando Conferência.',
  };

  const novosDados: Record<string, unknown> = {
    ...dadosAtuais,
    status_conferencia: statusConferencia,
    conferido_por_id: statusConferencia === 'CONFERIDO' ? usuario.id : null,
    conferido_por_nome: statusConferencia === 'CONFERIDO' ? nomeConf : null,
    conferido_em: statusConferencia === 'CONFERIDO' ? agoraIso : null,
    historico_eventos: [...historicoAnterior, novoEvento],
  };
  const dadosJson = JSON.stringify(novosDados);

  await prisma.$executeRaw`
    UPDATE "DocumentManifestacao" SET
      "dados" = ${dadosJson}::jsonb,
      "atualizadoPorId" = ${usuario.id},
      "atualizadoPorNome" = ${nomeConf},
      "updatedAt" = NOW()
    WHERE "id" = ${registroId} AND "tenantId" = ${tenantId} AND "status" = 'conferencia'`;

  await recordAuditLog({
    modulo: 'GESTAO_DOCUMENTAL',
    acao: 'CONFERENCIA',
    registroId,
    registroDescricao: texto(dadosAtuais.numero_processo, 80) || 'Manifestação sem número',
    detalhes: { statusConferencia, conferidoPor: nomeConf, conferidoEm: agoraIso },
  });

  return obterManifestacao(tenantId, registroId);
}

export async function finalizarManifestacao(
  tenantId: string,
  usuario: UsuarioManifestacao,
  entrada: EntradaFinalizacao,
): Promise<ManifestacaoCompleta> {
  if (entrada.confirmouImpressao !== true) {
    throw new ManifestacaoError(
      400,
      'Confirme que a manifestação foi impressa antes de finalizar e arquivar.',
    );
  }
  if (!entrada.textoFinal || entrada.textoFinal.trim().length < 50) {
    throw new ManifestacaoError(
      400,
      'O texto final da manifestação é obrigatório para finalizar a Etapa 2.',
    );
  }

  const campos = camposIndexados(entrada.dados);
  const nomeFinalizador = nomeUsuario(usuario);
  const agoraIso = new Date().toISOString();
  const origemJson = entrada.arquivoOrigem ? JSON.stringify(entrada.arquivoOrigem) : null;
  const minutaJson = JSON.stringify(entrada.minuta);
  const hash = calcularHashManifestacao(entrada.textoFinal);
  const podeConferirDireto = canUserConferirManifestacao(usuario.role);

  const id = await prisma.$transaction(async tx => {
    await bloquear(tx, tenantId, campos.numeroProcesso || entrada.fichaId);

    // Proteção contra cliques repetidos / requisições concorrentes para a mesma ficha (quando não é nova versão)
    if (!entrada.versaoAnteriorId) {
      const jaArquivada = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "DocumentManifestacao"
        WHERE "tenantId" = ${tenantId} AND "fichaId" = ${entrada.fichaId} AND "status" = 'finalizada'
        ORDER BY "finalizadoEm" DESC NULLS LAST, "id" DESC LIMIT 1`;
      if (jaArquivada.length) {
        return jaArquivada[0].id;
      }
    }

    let versao = 1;
    let versaoAnteriorId: string | null = null;
    if (entrada.versaoAnteriorId) {
      const anterior = await tx.$queryRaw<Array<{ id: string; versao: number }>>`
        SELECT "id", "versao" FROM "DocumentManifestacao"
        WHERE "tenantId" = ${tenantId} AND "id" = ${entrada.versaoAnteriorId} AND "status" = 'finalizada'`;
      if (!anterior.length) {
        throw new ManifestacaoError(404, 'A versão anterior desta manifestação não foi encontrada.');
      }
      const ultima = await tx.$queryRaw<Array<{ max: number | null }>>`
        WITH RECURSIVE cadeia AS (
          SELECT "id", "versao" FROM "DocumentManifestacao" WHERE "id" = ${anterior[0].id}
          UNION ALL
          SELECT d."id", d."versao" FROM "DocumentManifestacao" d JOIN cadeia c ON d."versaoAnteriorId" = c."id"
        ) SELECT MAX("versao")::int AS max FROM cadeia`;
      versaoAnteriorId = anterior[0].id;
      versao = (ultima[0]?.max ?? anterior[0].versao) + 1;
    }

    const existente = await localizarRegistroEmConferencia(tx, tenantId, entrada.fichaId, campos.numeroProcesso);
    const dadosBanco =
      existente?.dados && typeof existente.dados === 'object'
        ? (existente.dados as Record<string, unknown>)
        : null;

    const conferidoNoBanco = dadosBanco?.status_conferencia === 'CONFERIDO';
    const conferidoNaEntrada = entrada.dados.status_conferencia === 'CONFERIDO';
    const conferenciaValida =
      conferidoNoBanco ||
      Boolean(entrada.versaoAnteriorId && conferidoNaEntrada) ||
      (!existente && conferidoNaEntrada) ||
      (podeConferirDireto && conferidoNaEntrada);

    if (!conferenciaValida) {
      throw new ManifestacaoError(
        409,
        'A manifestação só pode ser finalizada e arquivada após a conclusão da conferência pelo Oficial ou Substituto (status CONFERIDO).',
      );
    }

    // Preserva autor e data da conferência exatamente como registrados, sem fabricar valores ausentes
    const conferidoPorNome =
      texto(dadosBanco?.conferido_por_nome, 200) ??
      texto(entrada.dados.conferido_por_nome, 200) ??
      null;
    const conferidoEm =
      texto(dadosBanco?.conferido_em, 60) ??
      texto(entrada.dados.conferido_em, 60) ??
      null;

    const historicoAnterior = Array.isArray(dadosBanco?.historico_eventos)
      ? (dadosBanco.historico_eventos as EventoHistoricoManifestacao[])
      : Array.isArray(entrada.dados.historico_eventos)
        ? (entrada.dados.historico_eventos as EventoHistoricoManifestacao[])
        : [];

    const eventoArquivamento: EventoHistoricoManifestacao = {
      tipo: 'ETAPA2_FINALIZADA_E_ARQUIVADA',
      dataHora: agoraIso,
      usuarioId: usuario.id,
      usuarioNome: nomeFinalizador,
      confirmouImpressao: true,
      descricao: 'Etapa 2 finalizada com confirmação de impressão pelo usuário e arquivamento concluído.',
    };

    const dadosComSelo: Record<string, unknown> = {
      ...(dadosBanco || {}),
      ...entrada.dados,
      status_conferencia: 'CONFERIDO',
      conferido_por_nome: conferidoPorNome,
      conferido_em: conferidoEm,
      impressao_confirmada: true,
      impressao_confirmada_em: agoraIso,
      impressao_confirmada_por_id: usuario.id,
      impressao_confirmada_por_nome: nomeFinalizador,
      arquivado_em: agoraIso,
      arquivado_por_id: usuario.id,
      arquivado_por_nome: nomeFinalizador,
      historico_eventos: [...historicoAnterior, eventoArquivamento],
    };
    const dadosJson = JSON.stringify(dadosComSelo);

    if (existente) {
      await tx.$executeRaw`
        UPDATE "DocumentManifestacao" SET
          "status" = 'finalizada', "versao" = ${versao}, "versaoAnteriorId" = ${versaoAnteriorId},
          "dados" = ${dadosJson}::jsonb, "arquivoOrigem" = ${origemJson}::jsonb,
          "numeroProcesso" = ${campos.numeroProcesso}, "requerente" = ${campos.requerente}, "matricula" = ${campos.matricula},
          "subdistrito" = ${campos.subdistrito}, "escrevente" = ${campos.escrevente},
          "minuta" = ${minutaJson}::jsonb, "textoFinal" = ${entrada.textoFinal}, "hashSha256" = ${hash},
          "atualizadoPorId" = ${usuario.id}, "atualizadoPorNome" = ${nomeFinalizador},
          "finalizadoPorId" = ${usuario.id}, "finalizadoPorNome" = ${nomeFinalizador},
          "updatedAt" = NOW(), "finalizadoEm" = NOW()
        WHERE "id" = ${existente.id} AND "tenantId" = ${tenantId} AND "status" = 'conferencia'`;
      return existente.id;
    }

    const novoId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO "DocumentManifestacao" ("id", "tenantId", "fichaId", "status", "versao", "versaoAnteriorId", "numeroProcesso",
        "requerente", "matricula", "subdistrito", "escrevente", "dados", "arquivoOrigem", "minuta", "textoFinal", "hashSha256",
        "criadoPorId", "criadoPorNome", "atualizadoPorId", "atualizadoPorNome", "finalizadoPorId", "finalizadoPorNome", "finalizadoEm")
      VALUES (${novoId}, ${tenantId}, ${entrada.fichaId}, 'finalizada', ${versao}, ${versaoAnteriorId}, ${campos.numeroProcesso},
        ${campos.requerente}, ${campos.matricula}, ${campos.subdistrito}, ${campos.escrevente}, ${dadosJson}::jsonb, ${origemJson}::jsonb,
        ${minutaJson}::jsonb, ${entrada.textoFinal}, ${hash}, ${usuario.id}, ${nomeFinalizador}, ${usuario.id}, ${nomeFinalizador},
        ${usuario.id}, ${nomeFinalizador}, NOW())`;
    return novoId;
  });

  await recordAuditLog({
    modulo: 'GESTAO_DOCUMENTAL',
    acao: 'ARQUIVAMENTO',
    registroId: id,
    registroDescricao: campos.numeroProcesso || 'Manifestação sem número',
    detalhes: {
      fichaId: entrada.fichaId,
      confirmouImpressao: true,
      finalizadoPor: nomeFinalizador,
      hashSha256: hash,
    },
  });

  return obterManifestacao(tenantId, id);
}

export async function obterManifestacao(tenantId: string, id: string): Promise<ManifestacaoCompleta> {
  const rows = await prisma.$queryRaw<ManifestacaoCompleta[]>`
    SELECT ${COLUNAS_RESUMO}, "dados", "arquivoOrigem", "minuta", "textoFinal"
    FROM "DocumentManifestacao" WHERE "tenantId" = ${tenantId} AND "id" = ${id}`;
  if (!rows.length) throw new ManifestacaoError(404, 'Manifestação não encontrada.');
  return rows[0];
}

export async function listarManifestacoes(
  tenantId: string,
  filtros: FiltrosManifestacao,
): Promise<{ itens: ManifestacaoResumo[]; total: number }> {
  const condicoes: Prisma.Sql[] = [Prisma.sql`"tenantId" = ${tenantId}`];
  if (filtros.status !== 'todas') {
    condicoes.push(Prisma.sql`"status" = ${filtros.status}`);
  }
  if (filtros.busca) {
    const termo = `%${filtros.busca.replace(/[\\%_]/g, c => '\\' + c)}%`;
    const semAcento = removerAcentos(filtros.busca).replace(/[\\%_]/g, c => '\\' + c);
    const termoSemAcento = `%${semAcento}%`;
    const limpo = filtros.busca.replace(/[.\-\s/ºª]/g, '');
    const termoLimpo = `%${limpo.replace(/[\\%_]/g, c => '\\' + c)}%`;
    condicoes.push(Prisma.sql`(
      "numeroProcesso" ILIKE ${termo}
      OR (${limpo.length >= 2}::boolean AND translate(COALESCE("numeroProcesso", ''), '.- /ºª', '') ILIKE ${termoLimpo})
      OR "requerente" ILIKE ${termo}
      OR translate(LOWER(COALESCE("requerente", '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn') LIKE ${termoSemAcento}
      OR "matricula" ILIKE ${termo}
      OR (${limpo.length >= 2}::boolean AND translate(COALESCE("matricula", ''), '.- /ºª', '') ILIKE ${termoLimpo})
      OR "escrevente" ILIKE ${termo}
      OR "dados"->>'contribuinte_sql' ILIKE ${termo}
      OR (${limpo.length >= 2}::boolean AND translate(COALESCE("dados"->>'contribuinte_sql', ''), '.- /ºª', '') ILIKE ${termoLimpo})
      OR "dados"->>'imovel' ILIKE ${termo}
    )`);
  }
  if (filtros.escrevente) condicoes.push(Prisma.sql`"escrevente" = ${filtros.escrevente}`);
  const campoData = filtros.status === 'finalizada' ? Prisma.sql`"finalizadoEm"` : Prisma.sql`"updatedAt"`;
  // Datas do filtro no fuso de São Paulo
  if (filtros.de) condicoes.push(Prisma.sql`${campoData} >= (${filtros.de}::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'`);
  if (filtros.ate) condicoes.push(Prisma.sql`${campoData} < ((${filtros.ate}::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')`);
  const where = Prisma.join(condicoes, ' AND ');
  const limite = Math.min(Math.max(filtros.limite ?? 50, 1), 200);
  const deslocamento = Math.max(filtros.deslocamento ?? 0, 0);

  // A fila de conferência traz os dados completos do formulário; a listagem de ARQUIVO (status = finalizada) traz apenas metadados leves
  const colunas =
    filtros.status === 'conferencia' || filtros.status === 'todas'
      ? Prisma.sql`${COLUNAS_RESUMO}, "dados", "arquivoOrigem"`
      : COLUNAS_RESUMO;

  const [itens, contagem] = await Promise.all([
    prisma.$queryRaw<ManifestacaoResumo[]>`
      SELECT ${colunas} FROM "DocumentManifestacao" WHERE ${where}
      ORDER BY ${campoData} DESC NULLS LAST, "id" DESC LIMIT ${limite} OFFSET ${deslocamento}`,
    prisma.$queryRaw<Array<{ total: number }>>`SELECT COUNT(*)::int AS total FROM "DocumentManifestacao" WHERE ${where}`,
  ]);
  return { itens, total: contagem[0]?.total ?? 0 };
}

export async function removerFichaEmConferencia(tenantId: string, id: string): Promise<boolean> {
  const n = await prisma.$executeRaw`
    DELETE FROM "DocumentManifestacao" WHERE "tenantId" = ${tenantId} AND "id" = ${id} AND "status" = 'conferencia'`;
  if (n === 1) {
    await recordAuditLog({
      modulo: 'GESTAO_DOCUMENTAL',
      acao: 'EXCLUSAO',
      registroId: id,
      registroDescricao: 'Rascunho removido da fila Em Conferência',
    });
  }
  return n === 1;
}

export interface LogGestaoDocumentalItem {
  id: string;
  dataHora: string;
  modulo: 'GESTÃO DOCUMENTAL';
  acao: string;
  categoria:
  | 'PESQUISA'
  | 'EXTRACAO_PETICAO'
  | 'LEITURA_ACERVO'
  | 'VALIDACAO_ASSINATURA'
  | 'RASCUNHO_CONFERENCIA'
  | 'CONFERENCIA_OFICIAL'
  | 'ARQUIVAMENTO'
  | 'AUDITORIA';
  processo: string | null;
  matricula: string | null;
  requerente: string | null;
  usuarioNome: string | null;
  descricao: string;
  status: string | null;
  manifestacaoId?: string | null;
}

export interface FiltrosLogsGestaoDocumental {
  busca?: string;
  tipo?: string;
  de?: string; // AAAA-MM-DD
  ate?: string; // AAAA-MM-DD
  ordem?: 'desc' | 'asc';
  limite?: number;
}

/**
 * Retorna exclusivamente os logs do módulo GESTÃO DOCUMENTAL (nunca de outros módulos do FIORIX),
 * consolidados a partir de:
 * 1. fiorix_audit_logs (WHERE modulo = 'GESTAO_DOCUMENTAL')
 * 2. DocumentManifestacao (criação/salvamento de rascunho, conferência oficial e arquivamento definitivo)
 * 3. DocumentSearchRequest (pesquisas no acervo, extrações OCR/IA de petição, leituras de documentos e validações de assinatura ICP-Brasil)
 * Filtrados e ordenados por data.
 */
export async function listarLogsGestaoDocumental(
  tenantId: string,
  filtros: FiltrosLogsGestaoDocumental = {},
): Promise<{ itens: LogGestaoDocumentalItem[]; total: number }> {
  const logs: LogGestaoDocumentalItem[] = [];
  const chavesVistas = new Set<string>();

  // 1. Logs de Auditoria explícitos do módulo GESTAO_DOCUMENTAL
  try {
    const auditRows = await prisma.$queryRaw<
      Array<{
        id: string;
        acao: string;
        registro_id: string | null;
        registro_descricao: string | null;
        detalhes_json: string | null;
        usuario_nome: string | null;
        usuario_email: string | null;
        criado_em: Date;
      }>
    >`
      SELECT "id", "acao", "registro_id", "registro_descricao", "detalhes_json", "usuario_nome", "usuario_email", "criado_em"
      FROM "fiorix_audit_logs"
      WHERE "tenant_id" = ${tenantId} AND "modulo" = 'GESTAO_DOCUMENTAL'
      ORDER BY "criado_em" DESC
      LIMIT 400
    `;
    for (const r of auditRows) {
      let detalhes: Record<string, unknown> = {};
      if (r.detalhes_json) {
        try {
          detalhes = JSON.parse(r.detalhes_json) as Record<string, unknown>;
        } catch { }
      }
      const dataIso = r.criado_em instanceof Date ? r.criado_em.toISOString() : new Date(r.criado_em).toISOString();
      const acaoUpper = (r.acao || 'AUDITORIA').toUpperCase();
      const categoria: LogGestaoDocumentalItem['categoria'] =
        acaoUpper === 'ARQUIVAMENTO'
          ? 'ARQUIVAMENTO'
          : acaoUpper === 'CONFERENCIA'
            ? 'CONFERENCIA_OFICIAL'
            : acaoUpper === 'INCLUSAO' || acaoUpper === 'ALTERACAO' || acaoUpper === 'EXCLUSAO'
              ? 'RASCUNHO_CONFERENCIA'
              : 'AUDITORIA';
      const statusConf = typeof detalhes.statusConferencia === 'string' ? detalhes.statusConferencia : null;
      const desc =
        acaoUpper === 'ARQUIVAMENTO'
          ? `Manifestação finalizada e arquivada na Etapa 2 (${r.registro_descricao || 'Processo'})`
          : acaoUpper === 'CONFERENCIA'
            ? statusConf === 'CONFERIDO'
              ? `Conferência Oficial concluída — marcado como CONFERIDO (${r.registro_descricao || 'Processo'})`
              : `Status retornado para Aguardando Conferência (${r.registro_descricao || 'Processo'})`
            : `${r.acao}: ${r.registro_descricao || 'Registro da Gestão Documental'}`;

      const chaveDedup = `${categoria}:${r.registro_id || ''}:${dataIso.slice(0, 16)}`;
      chavesVistas.add(chaveDedup);

      logs.push({
        id: `audit-${r.id}`,
        dataHora: dataIso,
        modulo: 'GESTÃO DOCUMENTAL',
        acao: acaoUpper,
        categoria,
        processo: r.registro_descricao || null,
        matricula: typeof detalhes.matricula === 'string' ? sanitizarMatriculaTranscricao(detalhes.matricula) : null,
        requerente: typeof detalhes.requerente === 'string' ? detalhes.requerente : null,
        usuarioNome: r.usuario_nome || r.usuario_email || (typeof detalhes.conferidoPor === 'string' ? detalhes.conferidoPor : null) || (typeof detalhes.finalizadoPor === 'string' ? detalhes.finalizadoPor : null),
        descricao: desc,
        status: statusConf || acaoUpper,
        manifestacaoId: r.registro_id || null,
      });
    }
  } catch {
    // Tabela fiorix_audit_logs pode ainda não existir no ambiente de teste
  }

  // 2. Eventos e movimentações registrados em DocumentManifestacao (Gestão Documental)
  try {
    const manifRows = await prisma.$queryRaw<
      Array<{
        id: string;
        fichaId: string;
        status: StatusManifestacao;
        versao: number;
        numeroProcesso: string | null;
        requerente: string | null;
        matricula: string | null;
        escrevente: string | null;
        criadoPorNome: string | null;
        atualizadoPorNome: string | null;
        finalizadoPorNome: string | null;
        createdAt: Date;
        updatedAt: Date;
        finalizadoEm: Date | null;
        dados: Prisma.JsonValue;
      }>
    >`
      SELECT "id", "fichaId", "status", "versao", "numeroProcesso", "requerente", "matricula", "escrevente",
             "criadoPorNome", "atualizadoPorNome", "finalizadoPorNome", "createdAt", "updatedAt", "finalizadoEm", "dados"
      FROM "DocumentManifestacao"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "updatedAt" DESC
      LIMIT 300
    `;

    for (const m of manifRows) {
      const matLimpa = m.matricula ? sanitizarMatriculaTranscricao(m.matricula) : null;
      const proc = m.numeroProcesso || null;
      const req = m.requerente || null;
      const dadosObj = m.dados && typeof m.dados === 'object' ? (m.dados as Record<string, unknown>) : {};
      const eventos = Array.isArray(dadosObj.historico_eventos)
        ? (dadosObj.historico_eventos as EventoHistoricoManifestacao[])
        : [];

      // Evento de criação/abertura da ficha na Gestão Documental
      const createdIso = m.createdAt instanceof Date ? m.createdAt.toISOString() : new Date(m.createdAt).toISOString();
      logs.push({
        id: `manif-create-${m.id}`,
        dataHora: createdIso,
        modulo: 'GESTÃO DOCUMENTAL',
        acao: 'RASCUNHO SALVO',
        categoria: 'RASCUNHO_CONFERENCIA',
        processo: proc,
        matricula: matLimpa,
        requerente: req,
        usuarioNome: m.criadoPorNome || m.atualizadoPorNome || m.escrevente || 'Sistema',
        descricao: `Formulário / rascunho de manifestação registrado em conferência${proc ? ` • Processo ${proc}` : ''}${matLimpa ? ` • ${matLimpa}` : ''}.`,
        status: m.status === 'finalizada' ? 'FINALIZADA' : String(dadosObj.status_conferencia || 'AGUARDANDO_CONFERENCIA'),
        manifestacaoId: m.id,
      });

      // Eventos intermediários (conferência oficial / reabertura / arquivamento)
      for (let i = 0; i < eventos.length; i++) {
        const ev = eventos[i];
        if (!ev?.dataHora) continue;
        const categoria: LogGestaoDocumentalItem['categoria'] =
          ev.tipo === 'ETAPA2_FINALIZADA_E_ARQUIVADA'
            ? 'ARQUIVAMENTO'
            : ev.tipo === 'CONFERENCIA_CONCLUIDA' || ev.tipo === 'CONFERENCIA_REABERTA'
              ? 'CONFERENCIA_OFICIAL'
              : 'RASCUNHO_CONFERENCIA';
        const chaveDedup = `${categoria}:${m.id}:${ev.dataHora.slice(0, 16)}`;
        if (chavesVistas.has(chaveDedup)) continue;
        chavesVistas.add(chaveDedup);

        logs.push({
          id: `manif-ev-${m.id}-${i}`,
          dataHora: ev.dataHora,
          modulo: 'GESTÃO DOCUMENTAL',
          acao:
            ev.tipo === 'ETAPA2_FINALIZADA_E_ARQUIVADA'
              ? 'ARQUIVAMENTO'
              : ev.tipo === 'CONFERENCIA_CONCLUIDA'
                ? 'CONFERIDO'
                : ev.tipo === 'CONFERENCIA_REABERTA'
                  ? 'REABERTO'
                  : 'ATUALIZAÇÃO',
          categoria,
          processo: proc,
          matricula: matLimpa,
          requerente: req,
          usuarioNome: ev.usuarioNome || m.atualizadoPorNome || m.finalizadoPorNome || 'Usuário',
          descricao: `${ev.descricao}${proc ? ` (${proc})` : ''}`,
          status: ev.tipo,
          manifestacaoId: m.id,
        });
      }

      // Caso tenha sido atualizado após a criação e sem evento duplicado no mesmo minuto
      const updatedIso = m.updatedAt instanceof Date ? m.updatedAt.toISOString() : new Date(m.updatedAt).toISOString();
      if (updatedIso.slice(0, 16) !== createdIso.slice(0, 16) && m.status === 'conferencia') {
        const chaveUpd = `RASCUNHO_CONFERENCIA:${m.id}:${updatedIso.slice(0, 16)}`;
        if (!chavesVistas.has(chaveUpd)) {
          chavesVistas.add(chaveUpd);
          logs.push({
            id: `manif-upd-${m.id}`,
            dataHora: updatedIso,
            modulo: 'GESTÃO DOCUMENTAL',
            acao: 'EDIÇÃO DE RASCUNHO',
            categoria: 'RASCUNHO_CONFERENCIA',
            processo: proc,
            matricula: matLimpa,
            requerente: req,
            usuarioNome: m.atualizadoPorNome || m.criadoPorNome || m.escrevente || 'Usuário',
            descricao: `Rascunho atualizado na fila Em Conferência${proc ? ` • Processo ${proc}` : ''}${matLimpa ? ` • ${matLimpa}` : ''}.`,
            status: String(dadosObj.status_conferencia || 'AGUARDANDO_CONFERENCIA'),
            manifestacaoId: m.id,
          });
        }
      }

      // Caso finalizado e sem evento explícito já adicionado
      if (m.status === 'finalizada' && m.finalizadoEm) {
        const finIso = m.finalizadoEm instanceof Date ? m.finalizadoEm.toISOString() : new Date(m.finalizadoEm).toISOString();
        const chaveFin = `ARQUIVAMENTO:${m.id}:${finIso.slice(0, 16)}`;
        if (!chavesVistas.has(chaveFin)) {
          chavesVistas.add(chaveFin);
          logs.push({
            id: `manif-fin-${m.id}`,
            dataHora: finIso,
            modulo: 'GESTÃO DOCUMENTAL',
            acao: 'ARQUIVAMENTO',
            categoria: 'ARQUIVAMENTO',
            processo: proc,
            matricula: matLimpa,
            requerente: req,
            usuarioNome: m.finalizadoPorNome || m.atualizadoPorNome || 'Usuário',
            descricao: `Manifestação Oficial (v${m.versao}) finalizada e arquivada no FIORIX${proc ? ` • Processo ${proc}` : ''}.`,
            status: 'FINALIZADA',
            manifestacaoId: m.id,
          });
        }
      }
    }
  } catch { }

  // 3. Operações de Pesquisa, Extração OCR/IA de Petições, Leitura de Imagens (.KEN/PDF) e Validação ICP-Brasil na Gestão Documental
  try {
    const reqRows = await prisma.$queryRaw<
      Array<{
        id: string;
        type: string | null;
        query: string | null;
        rootId: string | null;
        relativePath: string | null;
        status: string;
        createdAt: Date;
      }>
    >`
      SELECT "id", "type", "query", "rootId", "relativePath", "status", "createdAt"
      FROM "DocumentSearchRequest"
      WHERE "tenantId" = ${tenantId}
        AND COALESCE("type", 'search') <> 'read_document_chunk'
      ORDER BY "createdAt" DESC
      LIMIT 300
    `;

    for (const req of reqRows) {
      let qObj: { type?: string; query?: string; rootId?: string; relativePath?: string } = {};
      if (req.type || req.rootId || req.relativePath) {
        qObj = {
          type: req.type || 'search',
          query: req.query || undefined,
          rootId: req.rootId || undefined,
          relativePath: req.relativePath || undefined,
        };
      } else if (req.query) {
        try {
          qObj = JSON.parse(req.query) as typeof qObj;
        } catch {
          qObj = { type: 'search', query: req.query };
        }
      }
      const tipoReq = qObj.type || 'search';
      const dataRef = req.createdAt;
      const dataIso = dataRef instanceof Date ? dataRef.toISOString() : new Date(dataRef).toISOString();

      let categoria: LogGestaoDocumentalItem['categoria'] = 'PESQUISA';
      let acao = 'PESQUISA NO ACERVO';
      let descricao = '';
      let processo: string | null = null;
      let matricula: string | null = null;

      const cnjMatch = (qObj.query || qObj.relativePath || '').match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
      if (cnjMatch) processo = cnjMatch[0];

      if (tipoReq === 'extract_petition' || tipoReq === 'extract_petition_data') {
        categoria = 'EXTRACAO_PETICAO';
        acao = 'EXTRAÇÃO OCR / IA';
        descricao = `Extração automática de dados da Petição Inicial (${qObj.relativePath || 'PDF dos autos'})`;
      } else if (tipoReq === 'analyze_signatures' || tipoReq === 'validate_pdf_signature') {
        categoria = 'VALIDACAO_ASSINATURA';
        acao = 'VALIDAÇÃO ICP-BRASIL';
        descricao = `Validação criptográfica de assinatura digital ICP-Brasil (${qObj.relativePath || 'PDF'})`;
      } else if (tipoReq === 'read_document_text') {
        categoria = 'LEITURA_ACERVO';
        acao = 'VISUALIZAÇÃO DE DOCUMENTO';
        descricao = `Abertura / leitura de documento no acervo (${qObj.rootId ? `[${qObj.rootId.toUpperCase()}] ` : ''}${qObj.relativePath || ''})`;
        const matMatch = (qObj.relativePath || '').match(/0*(\d{1,8})\.(?:ken|tif|tiff)$/i);
        if (matMatch && (qObj.rootId === 'livro2' || /lv2/i.test(qObj.relativePath || ''))) {
          matricula = `Matrícula ${matMatch[1]}`;
        }
      } else {
        categoria = 'PESQUISA';
        acao = 'PESQUISA NO ACERVO';
        const termoLimpo = sanitizarMatriculaTranscricao(qObj.query || '');
        descricao = `Consulta realizada no acervo da Gestão Documental: "${termoLimpo || qObj.query || ''}"`;
        if (/matr[íi]cula|transcri[çc][ãa]o/i.test(termoLimpo)) {
          matricula = termoLimpo;
        }
      }

      logs.push({
        id: `req-${req.id}`,
        dataHora: dataIso,
        modulo: 'GESTÃO DOCUMENTAL',
        acao,
        categoria,
        processo,
        matricula,
        requerente: null,
        usuarioNome: 'Estação Gestão Documental',
        descricao,
        status: req.status === 'complete' ? 'CONCLUÍDO' : req.status === 'failed' ? 'FALHA' : 'PROCESSANDO',
        manifestacaoId: null,
      });
    }
  } catch { }

  // Filtros por data (fuso America/Sao_Paulo), categoria/tipo e busca textual
  const deLimite = filtros.de ? new Date(`${filtros.de}T00:00:00-03:00`).getTime() : null;
  const ateLimite = filtros.ate ? new Date(`${filtros.ate}T23:59:59.999-03:00`).getTime() : null;
  const tipoFiltro = filtros.tipo && filtros.tipo !== 'TODOS' ? filtros.tipo : null;
  const termoBusca = (filtros.busca || '').trim();
  const termoNorm = removerAcentos(termoBusca);
  const termoDigitos = termoBusca.replace(/[^\d]/g, '');

  const filtrados = logs.filter(item => {
    const t = new Date(item.dataHora).getTime();
    if (Number.isNaN(t)) return false;
    if (deLimite !== null && t < deLimite) return false;
    if (ateLimite !== null && t > ateLimite) return false;
    if (tipoFiltro && item.categoria !== tipoFiltro) return false;
    if (termoNorm) {
      const alvo = removerAcentos(
        [
          item.acao,
          item.categoria,
          item.processo,
          item.matricula,
          item.requerente,
          item.usuarioNome,
          item.descricao,
        ]
          .filter(Boolean)
          .join(' '),
      );
      if (alvo.includes(termoNorm)) return true;
      if (termoDigitos.length >= 2) {
        const alvoDigitos = alvo.replace(/[^\d]/g, '');
        if (alvoDigitos.includes(termoDigitos)) return true;
      }
      return false;
    }
    return true;
  });

  // Ordenação por data (padrão: mais recentes primeiro; permite alternar para mais antigos primeiro)
  const ordem = filtros.ordem === 'asc' ? 'asc' : 'desc';
  filtrados.sort((a, b) => {
    const ta = new Date(a.dataHora).getTime();
    const tb = new Date(b.dataHora).getTime();
    return ordem === 'asc' ? ta - tb : tb - ta;
  });

  const limite = Math.min(Math.max(filtros.limite ?? 250, 1), 500);
  return {
    itens: filtrados.slice(0, limite),
    total: filtrados.length,
  };
}

/** Envia ao banco as fichas que estavam apenas no navegador (fila antiga), sem duplicar. */
export async function importarFilaLocal(
  tenantId: string,
  usuario: UsuarioManifestacao,
  fichas: EntradaFicha[],
): Promise<number> {
  let importadas = 0;
  for (const ficha of fichas) {
    const jaExiste = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "DocumentManifestacao" WHERE "tenantId" = ${tenantId} AND "fichaId" = ${ficha.fichaId} LIMIT 1`;
    if (jaExiste.length) continue;
    await salvarFichaEmConferencia(tenantId, usuario, ficha);
    importadas++;
  }
  return importadas;
}
