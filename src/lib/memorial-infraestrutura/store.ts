import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { allPublicTablesExist } from '@/lib/db/ddl-guard';
import {
  GOVERNANCE_BOUNDARIES_7RI,
  OFFICIAL_INFRA_MEMORIAL_ENTRIES,
  SERVERS_TOPOLOGY_7RI,
} from './catalog';
import type {
  MemorialCategory,
  MemorialInfraEntry,
  MemorialInfraSnapshot,
  MemorialServerKey,
  MemorialStatus,
} from './types';

const SECRET_GUARD_REGEXES: RegExp[] = [
  /(?:CONNECTOR_SECRET|SQL_SERVER_PASSWORD|SIPLANIA_POSTGRES_PASSWORD|DATABASE_URL|NEXTAUTH_SECRET)\s*[:=]\s*["']?[^\s"']{4,}/i,
  /\b(?:password|pwd|senha)\s*[:=]\s*["']?(?!\[redacted\]|SUA_SENHA|<[^>]+>)[^;\s"']{3,}/i,
  /postgresql:\/\/[^:\s]+:[^@\s]+@/i,
];

export function containsSensitiveSecretPattern(text: string | null | undefined): boolean {
  if (!text) return false;
  return SECRET_GUARD_REGEXES.some((rx) => rx.test(text));
}

export const memorialEntryInputSchema = z
  .object({
    server: z.enum(['SRVSQL', 'SRVFILES', 'SRVSIPLANIA', 'GERAL']),
    category: z.enum([
      'PERFORMANCE',
      'SEGURANCA_ACESSO',
      'IA_OCR_PESQUISA',
      'OBSERVABILIDADE',
      'ALTA_DISPONIBILIDADE',
      'ARQUITETURA_REDE',
    ]),
    status: z.enum(['ATIVO', 'MONITORANDO', 'DECISAO_ARQUITETURAL', 'HISTORICO']),
    title: z.string().trim().min(5).max(180),
    implementedAt: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.'),
    connectorVersion: z.string().trim().max(32).nullable().optional(),
    summarySimple: z.string().trim().min(10).max(1200),
    problemBefore: z.string().trim().min(5).max(2000),
    solutionApplied: z.string().trim().min(5).max(3000),
    metricBefore: z.string().trim().min(1).max(240),
    metricAfter: z.string().trim().min(1).max(240),
    impactBadge: z.string().trim().min(2).max(120),
    technicalDetails: z.string().trim().max(6000).default(''),
    commandsSnippet: z.string().trim().max(8000).nullable().optional(),
    rollbackPlan: z.string().trim().max(4000).nullable().optional(),
  })
  .strict()
  .refine(
    (data) =>
      !containsSensitiveSecretPattern(data.summarySimple) &&
      !containsSensitiveSecretPattern(data.problemBefore) &&
      !containsSensitiveSecretPattern(data.solutionApplied) &&
      !containsSensitiveSecretPattern(data.technicalDetails) &&
      !containsSensitiveSecretPattern(data.commandsSnippet) &&
      !containsSensitiveSecretPattern(data.rollbackPlan),
    {
      message: 'Não inclua senhas, tokens ou strings de conexão com credenciais reais na documentação.',
    },
  );

export type MemorialEntryInput = z.infer<typeof memorialEntryInputSchema>;

const OFFICIAL_ID_SET = new Set(OFFICIAL_INFRA_MEMORIAL_ENTRIES.map((e) => e.id));

let ddlInitialized = false;
const memoryStoreByTenant = new Map<string, MemorialInfraEntry[]>();

export function resetMemorialInfraMemoryStoreForTests(): void {
  ddlInitialized = false;
  memoryStoreByTenant.clear();
}

function normalizeDbErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err ?? '');
}

async function ensureMemorialInfraTable(): Promise<boolean> {
  if (ddlInitialized) return true;
  if (!prisma || typeof prisma.$executeRawUnsafe !== 'function') {
    return false;
  }

  if (await allPublicTablesExist(['fiorix_infra_memorial_entries'])) {
    ddlInitialized = true;
    return true;
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.fiorix_infra_memorial_entries (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        server TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        implemented_at TEXT NOT NULL,
        connector_version TEXT,
        summary_simple TEXT NOT NULL,
        problem_before TEXT NOT NULL,
        solution_applied TEXT NOT NULL,
        metric_before TEXT NOT NULL,
        metric_after TEXT NOT NULL,
        impact_badge TEXT NOT NULL,
        technical_details TEXT NOT NULL DEFAULT '',
        commands_snippet TEXT,
        rollback_plan TEXT,
        author_name TEXT NOT NULL DEFAULT 'MASTER',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_fiorix_infra_memorial_tenant_date
        ON public.fiorix_infra_memorial_entries (tenant_id, implemented_at DESC, updated_at DESC);
    `);

    await prisma.$executeRawUnsafe(`
      DO $$
      BEGIN
        ALTER TABLE public.fiorix_infra_memorial_entries ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON TABLE public.fiorix_infra_memorial_entries FROM PUBLIC, anon, authenticated;
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = 'fiorix_infra_memorial_entries'
            AND policyname = 'rls_fiorix_infra_memorial_entries_deny_external'
        ) THEN
          CREATE POLICY rls_fiorix_infra_memorial_entries_deny_external
            ON public.fiorix_infra_memorial_entries
            FOR ALL TO anon, authenticated
            USING (false) WITH CHECK (false);
        END IF;
      END;
      $$;
    `);

    ddlInitialized = true;
    return true;
  } catch {
    return false;
  }
}

interface RawMemorialDbRow {
  id: string;
  server: string;
  category: string;
  status: string;
  title: string;
  implemented_at: string;
  connector_version: string | null;
  summary_simple: string;
  problem_before: string;
  solution_applied: string;
  metric_before: string;
  metric_after: string;
  impact_badge: string;
  technical_details: string;
  commands_snippet: string | null;
  rollback_plan: string | null;
  author_name: string;
  updated_at: Date | string;
}

function mapDbRowToEntry(row: RawMemorialDbRow): MemorialInfraEntry {
  const updatedIso =
    row.updated_at instanceof Date
      ? row.updated_at.toISOString()
      : new Date(String(row.updated_at || Date.now())).toISOString();

  return {
    id: String(row.id),
    source: 'REGISTRO_MASTER',
    server: row.server as MemorialServerKey,
    category: row.category as MemorialCategory,
    status: row.status as MemorialStatus,
    title: String(row.title),
    implementedAt: String(row.implemented_at),
    connectorVersion: row.connector_version ? String(row.connector_version) : null,
    summarySimple: String(row.summary_simple),
    problemBefore: String(row.problem_before),
    solutionApplied: String(row.solution_applied),
    metricBefore: String(row.metric_before),
    metricAfter: String(row.metric_after),
    impactBadge: String(row.impact_badge),
    technicalDetails: String(row.technical_details || ''),
    commandsSnippet: row.commands_snippet ? String(row.commands_snippet) : null,
    rollbackPlan: row.rollback_plan ? String(row.rollback_plan) : null,
    authorName: String(row.author_name || 'MASTER'),
    updatedAtIso: updatedIso,
  };
}

function sortEntriesNewestFirst(entries: MemorialInfraEntry[]): MemorialInfraEntry[] {
  return [...entries].sort((a, b) => {
    const byDate = b.implementedAt.localeCompare(a.implementedAt);
    if (byDate !== 0) return byDate;
    if (a.source !== b.source) {
      return a.source === 'REGISTRO_MASTER' ? -1 : 1;
    }
    return b.updatedAtIso.localeCompare(a.updatedAtIso);
  });
}

async function listCustomEntriesForTenant(tenantId: string): Promise<MemorialInfraEntry[]> {
  const dbReady = await ensureMemorialInfraTable();
  if (dbReady && typeof prisma.$queryRawUnsafe === 'function') {
    try {
      const rows = await prisma.$queryRawUnsafe<RawMemorialDbRow[]>(
        `SELECT id, server, category, status, title, implemented_at, connector_version,
                summary_simple, problem_before, solution_applied, metric_before, metric_after,
                impact_badge, technical_details, commands_snippet, rollback_plan,
                author_name, updated_at
         FROM public.fiorix_infra_memorial_entries
         WHERE tenant_id = $1
         ORDER BY implemented_at DESC, updated_at DESC`,
        tenantId,
      );
      if (Array.isArray(rows)) {
        return rows.map(mapDbRowToEntry);
      }
    } catch {
      // Fallback para memória em testes ou contingência local
    }
  }
  return [...(memoryStoreByTenant.get(tenantId) || [])];
}

export async function getMemorialInfraSnapshot(tenantId: string): Promise<MemorialInfraSnapshot> {
  const customEntries = await listCustomEntriesForTenant(tenantId);
  const merged = sortEntriesNewestFirst([...customEntries, ...OFFICIAL_INFRA_MEMORIAL_ENTRIES]);

  return {
    generatedAtIso: new Date().toISOString(),
    servers: SERVERS_TOPOLOGY_7RI.map((s) => ({
      ...s,
      keyMetrics: s.keyMetrics.map((m) => ({ ...m })),
    })),
    governance: GOVERNANCE_BOUNDARIES_7RI.map((g) => ({ ...g })),
    entries: merged,
    dbPersistedCount: customEntries.length,
  };
}

export async function createMemorialInfraEntry(params: {
  tenantId: string;
  authorName: string;
  input: MemorialEntryInput;
}): Promise<MemorialInfraEntry> {
  const { tenantId, authorName, input } = params;
  const parsed = memorialEntryInputSchema.parse(input);
  const nowIso = new Date().toISOString();
  const id = `master-${randomUUID()}`;

  const entry: MemorialInfraEntry = {
    id,
    source: 'REGISTRO_MASTER',
    server: parsed.server,
    category: parsed.category,
    status: parsed.status,
    title: parsed.title,
    implementedAt: parsed.implementedAt,
    connectorVersion: parsed.connectorVersion?.trim() || null,
    summarySimple: parsed.summarySimple,
    problemBefore: parsed.problemBefore,
    solutionApplied: parsed.solutionApplied,
    metricBefore: parsed.metricBefore,
    metricAfter: parsed.metricAfter,
    impactBadge: parsed.impactBadge,
    technicalDetails: parsed.technicalDetails || '',
    commandsSnippet: parsed.commandsSnippet?.trim() || null,
    rollbackPlan: parsed.rollbackPlan?.trim() || null,
    authorName: authorName || 'MASTER',
    updatedAtIso: nowIso,
  };

  const dbReady = await ensureMemorialInfraTable();
  if (dbReady && typeof prisma.$executeRawUnsafe === 'function') {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO public.fiorix_infra_memorial_entries (
          id, tenant_id, server, category, status, title, implemented_at, connector_version,
          summary_simple, problem_before, solution_applied, metric_before, metric_after,
          impact_badge, technical_details, commands_snippet, rollback_plan, author_name, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, NOW()
        )`,
        entry.id,
        tenantId,
        entry.server,
        entry.category,
        entry.status,
        entry.title,
        entry.implementedAt,
        entry.connectorVersion,
        entry.summarySimple,
        entry.problemBefore,
        entry.solutionApplied,
        entry.metricBefore,
        entry.metricAfter,
        entry.impactBadge,
        entry.technicalDetails,
        entry.commandsSnippet,
        entry.rollbackPlan,
        entry.authorName,
      );
      return entry;
    } catch (err) {
      if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
        throw new Error(`Falha ao gravar melhoria no Memorial: ${normalizeDbErrorMessage(err)}`);
      }
    }
  }

  const list = memoryStoreByTenant.get(tenantId) || [];
  list.unshift(entry);
  memoryStoreByTenant.set(tenantId, list);
  return entry;
}

export async function updateMemorialInfraEntry(params: {
  tenantId: string;
  id: string;
  authorName: string;
  input: MemorialEntryInput;
}): Promise<MemorialInfraEntry> {
  const { tenantId, id, authorName, input } = params;
  if (OFFICIAL_ID_SET.has(id) || id.startsWith('imp-')) {
    throw new Error('Registros oficiais versionados no código são somente leitura pela interface.');
  }

  const parsed = memorialEntryInputSchema.parse(input);
  const nowIso = new Date().toISOString();

  const updated: MemorialInfraEntry = {
    id,
    source: 'REGISTRO_MASTER',
    server: parsed.server,
    category: parsed.category,
    status: parsed.status,
    title: parsed.title,
    implementedAt: parsed.implementedAt,
    connectorVersion: parsed.connectorVersion?.trim() || null,
    summarySimple: parsed.summarySimple,
    problemBefore: parsed.problemBefore,
    solutionApplied: parsed.solutionApplied,
    metricBefore: parsed.metricBefore,
    metricAfter: parsed.metricAfter,
    impactBadge: parsed.impactBadge,
    technicalDetails: parsed.technicalDetails || '',
    commandsSnippet: parsed.commandsSnippet?.trim() || null,
    rollbackPlan: parsed.rollbackPlan?.trim() || null,
    authorName: authorName || 'MASTER',
    updatedAtIso: nowIso,
  };

  const dbReady = await ensureMemorialInfraTable();
  if (dbReady && typeof prisma.$executeRawUnsafe === 'function') {
    try {
      const affected = await prisma.$executeRawUnsafe(
        `UPDATE public.fiorix_infra_memorial_entries
         SET server = $3,
             category = $4,
             status = $5,
             title = $6,
             implemented_at = $7,
             connector_version = $8,
             summary_simple = $9,
             problem_before = $10,
             solution_applied = $11,
             metric_before = $12,
             metric_after = $13,
             impact_badge = $14,
             technical_details = $15,
             commands_snippet = $16,
             rollback_plan = $17,
             author_name = $18,
             updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        updated.id,
        tenantId,
        updated.server,
        updated.category,
        updated.status,
        updated.title,
        updated.implementedAt,
        updated.connectorVersion,
        updated.summarySimple,
        updated.problemBefore,
        updated.solutionApplied,
        updated.metricBefore,
        updated.metricAfter,
        updated.impactBadge,
        updated.technicalDetails,
        updated.commandsSnippet,
        updated.rollbackPlan,
        updated.authorName,
      );
      if (Number(affected) > 0) {
        return updated;
      }
      if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
        throw new Error('Registro não encontrado neste cartório para atualização.');
      }
    } catch (err) {
      if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
        throw err instanceof Error ? err : new Error(normalizeDbErrorMessage(err));
      }
    }
  }

  const list = memoryStoreByTenant.get(tenantId) || [];
  const idx = list.findIndex((item) => item.id === id);
  if (idx < 0) {
    throw new Error('Registro não encontrado para edição.');
  }
  list[idx] = updated;
  memoryStoreByTenant.set(tenantId, list);
  return updated;
}

export async function deleteMemorialInfraEntry(params: {
  tenantId: string;
  id: string;
}): Promise<void> {
  const { tenantId, id } = params;
  if (OFFICIAL_ID_SET.has(id) || id.startsWith('imp-')) {
    throw new Error('Registros oficiais versionados no código não podem ser excluídos pela interface.');
  }

  const dbReady = await ensureMemorialInfraTable();
  if (dbReady && typeof prisma.$executeRawUnsafe === 'function') {
    try {
      const affected = await prisma.$executeRawUnsafe(
        `DELETE FROM public.fiorix_infra_memorial_entries WHERE id = $1 AND tenant_id = $2`,
        id,
        tenantId,
      );
      if (Number(affected) > 0) return;
      if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
        throw new Error('Registro não encontrado para exclusão.');
      }
    } catch (err) {
      if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
        throw err instanceof Error ? err : new Error(normalizeDbErrorMessage(err));
      }
    }
  }

  const list = memoryStoreByTenant.get(tenantId) || [];
  const idx = list.findIndex((item) => item.id === id);
  if (idx < 0) {
    throw new Error('Registro não encontrado para exclusão.');
  }
  list.splice(idx, 1);
  memoryStoreByTenant.set(tenantId, list);
}
