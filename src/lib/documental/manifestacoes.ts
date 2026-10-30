import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

/**
 * Fila "Formulários em Conferência com o Oficial" (status = conferencia) e
 * histórico de Manifestações finalizadas (status = finalizada, imutável no banco).
 * Tabela criada por prisma/migrations/document_manifestacoes.sql.
 */

export type StatusManifestacao = 'conferencia' | 'finalizada';

export interface UsuarioManifestacao {
  id: string;
  name?: string | null;
  email?: string | null;
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
  versaoAnteriorId?: string | null;
}

export interface FiltrosManifestacao {
  status: StatusManifestacao;
  busca?: string;
  escrevente?: string;
  de?: string; // AAAA-MM-DD
  ate?: string; // AAAA-MM-DD
  limite?: number;
  deslocamento?: number;
}

export class ManifestacaoError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const COLUNAS_RESUMO = Prisma.sql`"id", "fichaId", "status", "versao", "versaoAnteriorId", "numeroProcesso", "requerente",
  "matricula", "subdistrito", "escrevente", "dados"->>'imovel' AS "imovel", "criadoPorNome", "atualizadoPorNome",
  "finalizadoPorNome", "hashSha256", "createdAt", "updatedAt", "finalizadoEm"`;

const texto = (v: unknown, max = 500): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};
const nomeUsuario = (u: UsuarioManifestacao) => (u.name || u.email || 'Usuário').slice(0, 200);

/** Campos indexados extraídos do formulário (para listagem e pesquisa). */
function camposIndexados(dados: Record<string, unknown>) {
  return {
    numeroProcesso: texto(dados.numero_processo, 60),
    requerente: texto(dados.requerente),
    matricula: texto(dados.matricula_transcricao, 120),
    subdistrito: texto(dados.subdistrito, 120),
    escrevente: texto(dados.escrevente_pasta, 120),
  };
}

export function calcularHashManifestacao(textoFinal: string): string {
  return createHash('sha256').update(textoFinal, 'utf8').digest('hex');
}

type Tx = Prisma.TransactionClient;

/** Ficha em conferência do mesmo formulário ou, na falta, do mesmo processo (uma por processo, como no app original). */
async function localizarEmConferencia(tx: Tx, tenantId: string, fichaId: string, numeroProcesso: string | null) {
  const porFicha = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "DocumentManifestacao"
    WHERE "tenantId" = ${tenantId} AND "status" = 'conferencia' AND "fichaId" = ${fichaId}
    LIMIT 1 FOR UPDATE`;
  if (porFicha.length) return porFicha[0].id;
  if (!numeroProcesso) return null;
  const porProcesso = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "DocumentManifestacao"
    WHERE "tenantId" = ${tenantId} AND "status" = 'conferencia' AND "numeroProcesso" = ${numeroProcesso}
    ORDER BY "updatedAt" DESC LIMIT 1 FOR UPDATE`;
  return porProcesso[0]?.id ?? null;
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
  const dadosJson = JSON.stringify(entrada.dados);
  const origemJson = entrada.arquivoOrigem ? JSON.stringify(entrada.arquivoOrigem) : null;
  return prisma.$transaction(async tx => {
    await bloquear(tx, tenantId, campos.numeroProcesso || entrada.fichaId);
    const existente = await localizarEmConferencia(tx, tenantId, entrada.fichaId, campos.numeroProcesso);
    if (existente) {
      await tx.$executeRaw`
        UPDATE "DocumentManifestacao" SET
          "dados" = ${dadosJson}::jsonb, "arquivoOrigem" = ${origemJson}::jsonb,
          "numeroProcesso" = ${campos.numeroProcesso}, "requerente" = ${campos.requerente}, "matricula" = ${campos.matricula},
          "subdistrito" = ${campos.subdistrito}, "escrevente" = ${campos.escrevente},
          "atualizadoPorId" = ${usuario.id}, "atualizadoPorNome" = ${nomeUsuario(usuario)}, "updatedAt" = NOW()
        WHERE "id" = ${existente} AND "tenantId" = ${tenantId} AND "status" = 'conferencia'`;
      return lerResumo(tx, tenantId, existente);
    }
    const id = randomUUID();
    await tx.$executeRaw`
      INSERT INTO "DocumentManifestacao" ("id", "tenantId", "fichaId", "status", "numeroProcesso", "requerente", "matricula",
        "subdistrito", "escrevente", "dados", "arquivoOrigem", "criadoPorId", "criadoPorNome", "atualizadoPorId", "atualizadoPorNome")
      VALUES (${id}, ${tenantId}, ${entrada.fichaId}, 'conferencia', ${campos.numeroProcesso}, ${campos.requerente}, ${campos.matricula},
        ${campos.subdistrito}, ${campos.escrevente}, ${dadosJson}::jsonb, ${origemJson}::jsonb, ${usuario.id}, ${nomeUsuario(usuario)},
        ${usuario.id}, ${nomeUsuario(usuario)})`;
    return lerResumo(tx, tenantId, id);
  });
}

export async function finalizarManifestacao(
  tenantId: string,
  usuario: UsuarioManifestacao,
  entrada: EntradaFinalizacao,
): Promise<ManifestacaoCompleta> {
  const campos = camposIndexados(entrada.dados);
  const dadosJson = JSON.stringify(entrada.dados);
  const origemJson = entrada.arquivoOrigem ? JSON.stringify(entrada.arquivoOrigem) : null;
  const minutaJson = JSON.stringify(entrada.minuta);
  const hash = calcularHashManifestacao(entrada.textoFinal);

  const id = await prisma.$transaction(async tx => {
    await bloquear(tx, tenantId, campos.numeroProcesso || entrada.fichaId);

    let versao = 1;
    let versaoAnteriorId: string | null = null;
    if (entrada.versaoAnteriorId) {
      const anterior = await tx.$queryRaw<Array<{ id: string; versao: number }>>`
        SELECT "id", "versao" FROM "DocumentManifestacao"
        WHERE "tenantId" = ${tenantId} AND "id" = ${entrada.versaoAnteriorId} AND "status" = 'finalizada'`;
      if (!anterior.length) throw new ManifestacaoError(404, 'A versão anterior desta manifestação não foi encontrada.');
      const ultima = await tx.$queryRaw<Array<{ max: number | null }>>`
        WITH RECURSIVE cadeia AS (
          SELECT "id", "versao" FROM "DocumentManifestacao" WHERE "id" = ${anterior[0].id}
          UNION ALL
          SELECT d."id", d."versao" FROM "DocumentManifestacao" d JOIN cadeia c ON d."versaoAnteriorId" = c."id"
        ) SELECT MAX("versao")::int AS max FROM cadeia`;
      versaoAnteriorId = anterior[0].id;
      versao = (ultima[0]?.max ?? anterior[0].versao) + 1;
    }

    const existente = await localizarEmConferencia(tx, tenantId, entrada.fichaId, campos.numeroProcesso);
    if (existente) {
      await tx.$executeRaw`
        UPDATE "DocumentManifestacao" SET
          "status" = 'finalizada', "versao" = ${versao}, "versaoAnteriorId" = ${versaoAnteriorId},
          "dados" = ${dadosJson}::jsonb, "arquivoOrigem" = ${origemJson}::jsonb,
          "numeroProcesso" = ${campos.numeroProcesso}, "requerente" = ${campos.requerente}, "matricula" = ${campos.matricula},
          "subdistrito" = ${campos.subdistrito}, "escrevente" = ${campos.escrevente},
          "minuta" = ${minutaJson}::jsonb, "textoFinal" = ${entrada.textoFinal}, "hashSha256" = ${hash},
          "atualizadoPorId" = ${usuario.id}, "atualizadoPorNome" = ${nomeUsuario(usuario)},
          "finalizadoPorId" = ${usuario.id}, "finalizadoPorNome" = ${nomeUsuario(usuario)},
          "updatedAt" = NOW(), "finalizadoEm" = NOW()
        WHERE "id" = ${existente} AND "tenantId" = ${tenantId} AND "status" = 'conferencia'`;
      return existente;
    }
    const novoId = randomUUID();
    await tx.$executeRaw`
      INSERT INTO "DocumentManifestacao" ("id", "tenantId", "fichaId", "status", "versao", "versaoAnteriorId", "numeroProcesso",
        "requerente", "matricula", "subdistrito", "escrevente", "dados", "arquivoOrigem", "minuta", "textoFinal", "hashSha256",
        "criadoPorId", "criadoPorNome", "atualizadoPorId", "atualizadoPorNome", "finalizadoPorId", "finalizadoPorNome", "finalizadoEm")
      VALUES (${novoId}, ${tenantId}, ${entrada.fichaId}, 'finalizada', ${versao}, ${versaoAnteriorId}, ${campos.numeroProcesso},
        ${campos.requerente}, ${campos.matricula}, ${campos.subdistrito}, ${campos.escrevente}, ${dadosJson}::jsonb, ${origemJson}::jsonb,
        ${minutaJson}::jsonb, ${entrada.textoFinal}, ${hash}, ${usuario.id}, ${nomeUsuario(usuario)}, ${usuario.id}, ${nomeUsuario(usuario)},
        ${usuario.id}, ${nomeUsuario(usuario)}, NOW())`;
    return novoId;
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
  const condicoes: Prisma.Sql[] = [Prisma.sql`"tenantId" = ${tenantId}`, Prisma.sql`"status" = ${filtros.status}`];
  if (filtros.busca) {
    const termo = `%${filtros.busca.replace(/[\\%_]/g, c => '\\' + c)}%`;
    condicoes.push(Prisma.sql`("numeroProcesso" ILIKE ${termo} OR "requerente" ILIKE ${termo} OR "matricula" ILIKE ${termo}
      OR "escrevente" ILIKE ${termo} OR "dados"->>'contribuinte_sql' ILIKE ${termo} OR "dados"->>'imovel' ILIKE ${termo})`);
  }
  if (filtros.escrevente) condicoes.push(Prisma.sql`"escrevente" = ${filtros.escrevente}`);
  const campoData = filtros.status === 'finalizada' ? Prisma.sql`"finalizadoEm"` : Prisma.sql`"updatedAt"`;
  // Datas do filtro no fuso de São Paulo
  if (filtros.de) condicoes.push(Prisma.sql`${campoData} >= (${filtros.de}::date)::timestamp AT TIME ZONE 'America/Sao_Paulo'`);
  if (filtros.ate) condicoes.push(Prisma.sql`${campoData} < ((${filtros.ate}::date + 1)::timestamp AT TIME ZONE 'America/Sao_Paulo')`);
  const where = Prisma.join(condicoes, ' AND ');
  const limite = Math.min(Math.max(filtros.limite ?? 50, 1), 200);
  const deslocamento = Math.max(filtros.deslocamento ?? 0, 0);

  // A fila de conferência é pequena e precisa dos dados do formulário para reabrir a ficha
  const colunas = filtros.status === 'conferencia'
    ? Prisma.sql`${COLUNAS_RESUMO}, "dados", "arquivoOrigem"`
    : COLUNAS_RESUMO;

  const [itens, contagem] = await Promise.all([
    prisma.$queryRaw<ManifestacaoResumo[]>`
      SELECT ${colunas} FROM "DocumentManifestacao" WHERE ${where}
      ORDER BY ${campoData} DESC NULLS LAST, "createdAt" DESC LIMIT ${limite} OFFSET ${deslocamento}`,
    prisma.$queryRaw<Array<{ total: number }>>`SELECT COUNT(*)::int AS total FROM "DocumentManifestacao" WHERE ${where}`,
  ]);
  return { itens, total: contagem[0]?.total ?? 0 };
}

export async function removerFichaEmConferencia(tenantId: string, id: string): Promise<boolean> {
  const n = await prisma.$executeRaw`
    DELETE FROM "DocumentManifestacao" WHERE "tenantId" = ${tenantId} AND "id" = ${id} AND "status" = 'conferencia'`;
  return n === 1;
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
