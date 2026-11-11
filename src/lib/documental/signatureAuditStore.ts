import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import {
  auditPdfSignatures,
  createFailedSignatureAuditResult,
  normalizeSignatureAuditResult,
  type AnaliseAssinaturaPdf,
  type ConferenciaExternaAssinatura,
} from '@/lib/documental/pdfSignatureAudit';

let tableInitialized = false;

export async function ensureSignatureConferenceTable(): Promise<void> {
  if (tableInitialized) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "DocumentSignatureConference" (
        "id" TEXT PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "rootId" TEXT NOT NULL,
        "relativePath" TEXT NOT NULL,
        "nomeArquivo" TEXT NOT NULL,
        "hashSha256" TEXT NOT NULL,
        "resultado" TEXT NOT NULL,
        "responsavelNome" TEXT NOT NULL,
        "responsavelId" TEXT,
        "dataConferencia" TEXT NOT NULL,
        "orgaoVerificador" TEXT NOT NULL,
        "relatorioConformidade" TEXT NOT NULL,
        "origemRegistro" TEXT NOT NULL DEFAULT 'MANUAL_EXTERNO',
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_docsigconf_tenant_hash"
      ON "DocumentSignatureConference" ("tenantId", "hashSha256");
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_docsigconf_tenant_path"
      ON "DocumentSignatureConference" ("tenantId", "rootId", "relativePath");
    `);
    tableInitialized = true;
  } catch {
    // Em ambientes de teste com prisma mockado, ignora DDL
  }
}

interface ConferenceRow {
  id: string;
  tenantId: string;
  rootId: string;
  relativePath: string;
  nomeArquivo: string;
  hashSha256: string;
  resultado: string;
  responsavelNome: string;
  responsavelId: string | null;
  dataConferencia: string;
  orgaoVerificador: string;
  relatorioConformidade: string;
  origemRegistro: string;
  createdAt: Date;
}

export async function getExternalConferenceForFile(
  tenantId: string,
  options: {
    hashSha256?: string | null;
    rootId?: string | null;
    relativePath?: string | null;
  },
): Promise<{
  conferencia: ConferenciaExternaAssinatura | null;
  conferenciaAnteriorDivergente: boolean;
}> {
  try {
    await ensureSignatureConferenceTable();
    const hashLimpo = options.hashSha256?.trim().toLowerCase() || null;

    if (hashLimpo) {
      const byHash = await prisma.$queryRaw<ConferenceRow[]>`
        SELECT "id", "tenantId", "rootId", "relativePath", "nomeArquivo", "hashSha256",
               "resultado", "responsavelNome", "responsavelId", "dataConferencia",
               "orgaoVerificador", "relatorioConformidade", "origemRegistro", "createdAt"
        FROM "DocumentSignatureConference"
        WHERE "tenantId" = ${tenantId} AND LOWER("hashSha256") = ${hashLimpo}
        ORDER BY "createdAt" DESC
        LIMIT 1
      `;

      if (byHash.length > 0) {
        const r = byHash[0];
        return {
          conferencia: {
            id: r.id,
            hash_sha256: r.hashSha256,
            resultado:
              r.resultado === 'VALIDA' || r.resultado === 'INVALIDA'
                ? r.resultado
                : 'INCONCLUSIVA',
            responsavel_nome: r.responsavelNome,
            responsavel_id: r.responsavelId,
            data_conferencia: r.dataConferencia,
            orgao_verificador: r.orgaoVerificador,
            relatorio_conformidade: r.relatorioConformidade,
            origem_registro:
              r.origemRegistro === 'INTEGRACAO_VERIFICAVEL'
                ? 'INTEGRACAO_VERIFICAVEL'
                : 'MANUAL_EXTERNO',
            hash_compativel_com_arquivo_atual: true,
          },
          conferenciaAnteriorDivergente: false,
        };
      }
    }

    if (options.rootId && options.relativePath) {
      const byPath = await prisma.$queryRaw<ConferenceRow[]>`
        SELECT "id", "hashSha256"
        FROM "DocumentSignatureConference"
        WHERE "tenantId" = ${tenantId}
          AND "rootId" = ${options.rootId}
          AND "relativePath" = ${options.relativePath}
        ORDER BY "createdAt" DESC
        LIMIT 1
      `;
      if (byPath.length > 0 && hashLimpo && byPath[0].hashSha256.toLowerCase() !== hashLimpo) {
        return {
          conferencia: null,
          conferenciaAnteriorDivergente: true,
        };
      }
    }
  } catch {
    // Se a tabela ainda não existir ou em teste unitário sem DB real
  }

  return { conferencia: null, conferenciaAnteriorDivergente: false };
}

export interface SaveExternalConferenceInput {
  rootId: string;
  relativePath: string;
  nomeArquivo: string;
  hashSha256: string;
  resultado: 'VALIDA' | 'INVALIDA' | 'INCONCLUSIVA';
  responsavelNome: string;
  responsavelId?: string | null;
  dataConferencia?: string;
  orgaoVerificador?: string;
  relatorioConformidade: string;
}

export async function saveExternalSignatureConference(
  tenantId: string,
  input: SaveExternalConferenceInput,
): Promise<ConferenciaExternaAssinatura> {
  await ensureSignatureConferenceTable();
  const id = randomUUID();
  const hashClean = input.hashSha256.trim().toLowerCase();
  const dataConf =
    input.dataConferencia?.trim() ||
    new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const orgao =
    input.orgaoVerificador?.trim() ||
    'ITI — Verificador de Conformidade (validar.iti.gov.br)';
  const relatorio = input.relatorioConformidade.trim().slice(0, 2000);
  const responsavel = input.responsavelNome.trim().slice(0, 160);

  await prisma.$executeRaw`
    INSERT INTO "DocumentSignatureConference" (
      "id", "tenantId", "rootId", "relativePath", "nomeArquivo", "hashSha256",
      "resultado", "responsavelNome", "responsavelId", "dataConferencia",
      "orgaoVerificador", "relatorioConformidade", "origemRegistro"
    ) VALUES (
      ${id}, ${tenantId}, ${input.rootId}, ${input.relativePath}, ${input.nomeArquivo},
      ${hashClean}, ${input.resultado}, ${responsavel}, ${input.responsavelId ?? null},
      ${dataConf}, ${orgao}, ${relatorio}, 'MANUAL_EXTERNO'
    )
  `;

  return {
    id,
    hash_sha256: hashClean,
    resultado: input.resultado,
    responsavel_nome: responsavel,
    responsavel_id: input.responsavelId ?? null,
    data_conferencia: dataConf,
    orgao_verificador: orgao,
    relatorio_conformidade: relatorio,
    origem_registro: 'MANUAL_EXTERNO',
    hash_compativel_com_arquivo_atual: true,
  };
}

function getConfiguredLocalRoots(): Array<{ id: string; path: string }> {
  const roots: Array<{ id: string; path: string }> = [];
  const rawEnv = process.env.DOCUMENTAL_ROOTS_JSON?.trim();
  if (rawEnv && rawEnv !== '[]') {
    try {
      const parsed = JSON.parse(rawEnv);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.id === 'string' && typeof item.path === 'string') {
            roots.push({ id: item.id.trim(), path: item.path.trim() });
          }
        }
      }
    } catch {
      // Ignora JSON inválido e usa mapeamentos padrão
    }
  }

  const defaults: Array<{ id: string; path: string }> = [
    { id: 'minutas', path: 'W:\\USUCAPIAO' },
    { id: 'usucapiao', path: 'W:\\USUCAPIAO' },
    { id: 'processos', path: 'H:\\PROCESSOS - ENVIADOS POR E-MAIL' },
    { id: 'imagens', path: 'K:\\IMAGENS' },
    { id: 'livro2', path: 'K:\\IMAGENS\\LV2' },
    { id: 'lv2', path: 'K:\\IMAGENS\\LV2' },
    { id: 'lv3', path: 'K:\\IMAGENS\\LV3' },
    { id: 'setores', path: 'K:\\IMAGENS\\SETORES' },
    { id: 'vol1', path: 'H:\\' },
    { id: 'deptos', path: 'W:\\' },
  ];

  for (const d of defaults) {
    if (!roots.some((r) => r.id.toLowerCase() === d.id.toLowerCase())) {
      roots.push(d);
    }
  }
  return roots;
}

export function resolveLocalAuthorizedFilePath(
  rootId: string,
  relativePath: string,
): string | null {
  if (!rootId || !relativePath) return null;
  if (relativePath.includes('\0')) return null;

  const roots = getConfiguredLocalRoots();
  const rootEntry = roots.find((r) => r.id.toLowerCase() === rootId.trim().toLowerCase());
  if (!rootEntry) return null;

  try {
    if (!fsSync.existsSync(rootEntry.path)) return null;
    const baseResolved = path.resolve(rootEntry.path);
    const cleanedRel = relativePath.replace(/^[/\\]+/, '');
    const targetResolved = path.resolve(baseResolved, cleanedRel);

    const baseCompare = baseResolved.endsWith(path.sep)
      ? baseResolved.toLowerCase()
      : (baseResolved + path.sep).toLowerCase();
    if (!targetResolved.toLowerCase().startsWith(baseCompare)) {
      return null;
    }

    if (!fsSync.existsSync(targetResolved)) return null;
    const stat = fsSync.statSync(targetResolved);
    if (!stat.isFile()) return null;
    return targetResolved;
  } catch {
    return null;
  }
}

export async function computeLocalFileSha256(
  rootId: string,
  relativePath: string,
): Promise<{ fullPath: string; hashSha256: string; size: number; modifiedAt: string } | null> {
  const fullPath = resolveLocalAuthorizedFilePath(rootId, relativePath);
  if (!fullPath) return null;
  try {
    const stat = await fs.stat(fullPath);
    const bytes = await fs.readFile(fullPath);
    const hashSha256 = createHash('sha256').update(bytes).digest('hex');
    return {
      fullPath,
      hashSha256,
      size: stat.size,
      modifiedAt: stat.mtime.toISOString(),
    };
  } catch {
    return null;
  }
}

export async function executeLocalPdfSignatureAudit(
  tenantId: string,
  rootId: string,
  relativePath: string,
): Promise<AnaliseAssinaturaPdf | null> {
  const fullPath = resolveLocalAuthorizedFilePath(rootId, relativePath);
  if (!fullPath) return null;

  try {
    const stat = await fs.stat(fullPath);
    const bytes = await fs.readFile(fullPath);
    const hashSha256 = createHash('sha256').update(bytes).digest('hex');

    const { conferencia, conferenciaAnteriorDivergente } = await getExternalConferenceForFile(
      tenantId,
      {
        hashSha256,
        rootId,
        relativePath,
      },
    );

    const audited = auditPdfSignatures(bytes, {
      fileName: path.basename(fullPath),
      modifiedAt: stat.mtime.toISOString(),
      conferenciaExterna: conferencia,
    });

    if (conferenciaAnteriorDivergente && !conferencia) {
      return {
        ...audited,
        conferencia_externa_invalidada_por_alteracao: true,
      };
    }

    return audited;
  } catch (err: any) {
    return createFailedSignatureAuditResult(
      `Não foi possível ler o arquivo no servidor para auditoria de assinaturas (${String(err?.code || 'erro de leitura')}).`,
    );
  }
}

export async function enrichAndNormalizeSignatureAuditForTenant(
  tenantId: string,
  rawResult: unknown,
  context?: { rootId?: string | null; relativePath?: string | null },
): Promise<AnaliseAssinaturaPdf> {
  const baseNormalized = normalizeSignatureAuditResult(rawResult);
  const { conferencia, conferenciaAnteriorDivergente } = await getExternalConferenceForFile(
    tenantId,
    {
      hashSha256: baseNormalized.hash_sha256,
      rootId: context?.rootId ?? null,
      relativePath: context?.relativePath ?? null,
    },
  );
  return normalizeSignatureAuditResult(baseNormalized, {
    conferenciaExterna: conferencia,
    conferenciaAnteriorDivergente,
  });
}
