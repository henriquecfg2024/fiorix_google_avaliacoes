import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isAgendaSandboxMode } from './feature-flags';
import { toRruleString } from './recurrence';
import {
  DEFAULT_AGENDA_TIMEZONE,
  addDaysToLocalDate,
  getZonedParts,
  localDateTimeToUtc,
} from './timezone';
import {
  DEFAULT_AGENDA_CATEGORIES,
  type AgendaAuditLogDTO,
  type AgendaCategoryDTO,
  type AgendaEmailOutboxDTO,
  type AgendaEventDTO,
  type AgendaNotificationJobDTO,
  type AgendaUserPreferenceDTO,
} from './types';

export interface AgendaSandboxTenantData {
  categories: AgendaCategoryDTO[];
  events: AgendaEventDTO[];
  jobs: AgendaNotificationJobDTO[];
  emailOutbox: AgendaEmailOutboxDTO[];
  preferences: AgendaUserPreferenceDTO[];
  auditLogs: AgendaAuditLogDTO[];
  seededAt: string;
}

interface AgendaSandboxRoot {
  tenants: Record<string, AgendaSandboxTenantData>;
}

const SANDBOX_DIR = path.join(process.cwd(), '.fiorix-agenda-sandbox');
const SANDBOX_FILE = path.join(SANDBOX_DIR, 'store.json');

let memoryStore: AgendaSandboxRoot | null = null;

function isTestRuntime(): boolean {
  return Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
}

function loadRootFromDiskOrMemory(): AgendaSandboxRoot {
  if (memoryStore) return memoryStore;
  if (!isTestRuntime() && isAgendaSandboxMode() && fs.existsSync(SANDBOX_FILE)) {
    try {
      const raw = fs.readFileSync(SANDBOX_FILE, 'utf8');
      const parsed = JSON.parse(raw) as AgendaSandboxRoot;
      if (parsed && typeof parsed === 'object' && parsed.tenants) {
        memoryStore = parsed;
        return memoryStore;
      }
    } catch {
      // Arquivo corrompido: reinicializa sandbox limpo
    }
  }
  memoryStore = { tenants: {} };
  return memoryStore;
}

export function persistAgendaSandboxRoot(): void {
  if (!memoryStore || isTestRuntime() || !isAgendaSandboxMode()) return;
  try {
    fs.mkdirSync(SANDBOX_DIR, { recursive: true });
    fs.writeFileSync(SANDBOX_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch {
    // Nunca interrompe operação por erro de disco no sandbox
  }
}

export function resetAgendaSandboxForTests(): void {
  memoryStore = { tenants: {} };
}

function buildSeedEventsForTenant(params: {
  tenantId: string;
  categories: AgendaCategoryDTO[];
  ownerUserId: string;
  ownerName: string;
  ownerEmail: string;
  department: string | null;
}): AgendaEventDTO[] {
  const { tenantId, categories, ownerUserId, ownerName, ownerEmail } = params;
  const tz = DEFAULT_AGENDA_TIMEZONE;
  const now = new Date();
  const todayStr = getZonedParts(now, tz).dateStr;
  const catBySlug = new Map(categories.map((c) => [c.slug, c]));

  const makeSeedEvent = (cfg: {
    id: string;
    slug: string;
    title: string;
    description: string;
    date: string;
    startTime: string;
    endTime: string;
    allDay?: boolean;
    priority: AgendaEventDTO['priority'];
    status: AgendaEventDTO['status'];
    visibility: AgendaEventDTO['visibility'];
    recurrenceType: AgendaEventDTO['recurrenceType'];
    recurrenceRule?: AgendaEventDTO['recurrenceRule'];
    location?: string;
    department?: string | null;
    reminders?: Array<{ channel: 'EMAIL' | 'POPUP' | 'PUSH'; offsetMinutes: number }>;
  }): AgendaEventDTO => {
    const cat = catBySlug.get(cfg.slug) ?? categories[0]!;
    const startUtc = localDateTimeToUtc(cfg.date, cfg.allDay ? '00:00' : cfg.startTime, tz);
    const endUtc = localDateTimeToUtc(cfg.date, cfg.allDay ? '23:59' : cfg.endTime, tz);
    return {
      id: cfg.id,
      tenantId,
      categoryId: cat.id,
      categoryName: cat.name,
      title: cfg.title,
      description: cfg.description,
      color: cat.color,
      icon: cat.icon,
      startAt: startUtc.toISOString(),
      endAt: endUtc.toISOString(),
      allDay: Boolean(cfg.allDay),
      timezone: tz,
      localStartDate: cfg.date,
      localStartTime: cfg.allDay ? '00:00' : cfg.startTime,
      localEndDate: cfg.date,
      localEndTime: cfg.allDay ? '23:59' : cfg.endTime,
      location: cfg.location ?? '7º RI-SP · Sala da Governança',
      meetingLink: null,
      notes: 'Compromisso demonstrativo de homologação local (Sandbox).',
      priority: cfg.priority,
      status: cfg.status,
      visibility: cfg.visibility,
      isConfidential: false,
      ownerUserId,
      ownerName,
      department: cfg.department ?? params.department ?? 'TI',
      recurrenceType: cfg.recurrenceType,
      recurrenceRule: cfg.recurrenceRule ?? null,
      rruleText: toRruleString(cfg.recurrenceType, cfg.recurrenceRule),
      attachments: [],
      participants: [
        {
          id: `part-${cfg.id}`,
          userId: ownerUserId,
          userName: ownerName,
          userEmail: ownerEmail,
          rsvpStatus: 'CONFIRMADO',
          canEdit: true,
          respondedAt: now.toISOString(),
        },
      ],
      reminders: (cfg.reminders ?? [
        { channel: 'EMAIL', offsetMinutes: 1440 },
        { channel: 'POPUP', offsetMinutes: 30 },
      ]).map((r, idx) => ({
        id: `rem-${cfg.id}-${idx}`,
        userId: ownerUserId,
        channel: r.channel,
        offsetMinutes: r.offsetMinutes,
        isMandatory: cfg.visibility === 'INSTITUCIONAL',
        isActive: true,
      })),
      exceptions: [],
      occurrenceStatuses: [],
      completedAt: cfg.status === 'CONCLUIDO' ? now.toISOString() : null,
      cancelledAt: null,
      retentionClass: cfg.visibility === 'INDIVIDUAL' ? 'PESSOAL' : 'OPERACIONAL',
      createdBy: ownerUserId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  };

  return [
    makeSeedEvent({
      id: `seed-${tenantId}-today-1`,
      slug: 'tecnologia-informacao',
      title: 'Reunião de TI e Infraestrutura',
      description: 'Alinhamento diário de disponibilidade SRVSQL, SRVFILES e Connector.',
      date: todayStr,
      startTime: '09:00',
      endTime: '10:00',
      priority: 'ALTA',
      status: 'AGENDADO',
      visibility: 'INSTITUCIONAL',
      recurrenceType: 'DIARIO',
      recurrenceRule: { frequency: 'DIARIO', interval: 1, weekdays: [1, 2, 3, 4, 5], maxOccurrences: 30 },
    }),
    makeSeedEvent({
      id: `seed-${tenantId}-today-2`,
      slug: 'reunioes',
      title: 'Alinhamento — Gestão de Prazos',
      description: 'Revisão de metas operacionais e gargalos de prenotações.',
      date: todayStr,
      startTime: '14:00',
      endTime: '15:00',
      priority: 'NORMAL',
      status: 'AGENDADO',
      visibility: 'SETORIAL',
      recurrenceType: 'SEMANAL',
      recurrenceRule: { frequency: 'SEMANAL', interval: 1, weekdays: [2, 4] },
    }),
    makeSeedEvent({
      id: `seed-${tenantId}-today-3`,
      slug: 'auditorias',
      title: 'Revisão de Sistemas (WEBRI & SiplanIA)',
      description: 'Auditoria preventiva de logs, acessos e backups.',
      date: todayStr,
      startTime: '17:00',
      endTime: '18:00',
      priority: 'ALTA',
      status: 'AGENDADO',
      visibility: 'COMPARTILHADO',
      recurrenceType: 'UNICO',
    }),
    makeSeedEvent({
      id: `seed-${tenantId}-tomorrow-1`,
      slug: 'treinamentos',
      title: 'Workshop LGPD & Provimento CNJ 213/2026',
      description: 'Capacitação periódica de conformidade e proteção de dados.',
      date: addDaysToLocalDate(todayStr, 1),
      startTime: '10:30',
      endTime: '12:00',
      priority: 'NORMAL',
      status: 'AGENDADO',
      visibility: 'INSTITUCIONAL',
      recurrenceType: 'MENSAL',
      recurrenceRule: { frequency: 'MENSAL', interval: 1, businessDayRule: 'FIRST_BUSINESS_DAY' },
    }),
    makeSeedEvent({
      id: `seed-${tenantId}-next7`,
      slug: 'obrigacoes-legais',
      title: 'Confraternização e Balanço Institucional 7º RI',
      description: 'Encontro oficial dos colaboradores e retrospectiva de metas.',
      date: addDaysToLocalDate(todayStr, 3),
      startTime: '19:00',
      endTime: '21:30',
      priority: 'NORMAL',
      status: 'AGENDADO',
      visibility: 'INSTITUCIONAL',
      recurrenceType: 'ANUAL',
      recurrenceRule: { frequency: 'ANUAL', interval: 1 },
    }),
    makeSeedEvent({
      id: `seed-${tenantId}-next15`,
      slug: 'seguranca-informacao',
      title: 'Revisão Semestral de Segurança da Informação',
      description: 'Avaliação completa de acessos, 2FA, RLS e plano de continuidade.',
      date: addDaysToLocalDate(todayStr, 18),
      startTime: '15:00',
      endTime: '17:00',
      priority: 'CRITICA',
      status: 'AGENDADO',
      visibility: 'INSTITUCIONAL',
      recurrenceType: 'SEMESTRAL',
      recurrenceRule: { frequency: 'SEMESTRAL', interval: 1 },
      reminders: [
        { channel: 'EMAIL', offsetMinutes: 43200 },
        { channel: 'EMAIL', offsetMinutes: 10080 },
        { channel: 'POPUP', offsetMinutes: 1440 },
        { channel: 'POPUP', offsetMinutes: 30 },
      ],
    }),
    makeSeedEvent({
      id: `seed-${tenantId}-done`,
      slug: 'financeiro',
      title: 'Fechamento de Emolumentos e Repasses',
      description: 'Conferência concluída do ciclo mensal.',
      date: addDaysToLocalDate(todayStr, -1),
      startTime: '11:00',
      endTime: '12:00',
      priority: 'NORMAL',
      status: 'CONCLUIDO',
      visibility: 'SETORIAL',
      recurrenceType: 'MENSAL',
      recurrenceRule: { frequency: 'MENSAL', interval: 1, businessDayRule: 'LAST_BUSINESS_DAY' },
    }),
    makeSeedEvent({
      id: `seed-${tenantId}-overdue`,
      slug: 'manutencoes',
      title: 'Checklist preventivo de Nobreak e Rack',
      description: 'Inspeção pendente de validação final.',
      date: addDaysToLocalDate(todayStr, -2),
      startTime: '08:30',
      endTime: '09:30',
      priority: 'ALTA',
      status: 'PENDENTE',
      visibility: 'INDIVIDUAL',
      recurrenceType: 'UNICO',
    }),
  ];
}

export function ensureTenantSandboxData(params: {
  tenantId: string;
  userId?: string;
  userName?: string | null;
  userEmail?: string | null;
  department?: string | null;
}): AgendaSandboxTenantData {
  const root = loadRootFromDiskOrMemory();
  let tenantData = root.tenants[params.tenantId];
  if (tenantData) {
    return tenantData;
  }

  const categories: AgendaCategoryDTO[] = DEFAULT_AGENDA_CATEGORIES.map((c) => ({
    id: `cat-${params.tenantId}-${c.slug}`,
    tenantId: params.tenantId,
    slug: c.slug,
    name: c.name,
    color: c.color,
    icon: c.icon,
    scope: c.scope,
    ownerUserId: c.scope === 'PESSOAL' ? params.userId ?? null : null,
    isSystem: true,
    isActive: true,
  }));

  const ownerId = params.userId || `owner-${params.tenantId}`;
  const ownerName = params.userName || 'Responsável da Serventia';
  const ownerEmail = params.userEmail || 'agenda@fiorix.local';

  const events = isTestRuntime()
    ? []
    : buildSeedEventsForTenant({
        tenantId: params.tenantId,
        categories,
        ownerUserId: ownerId,
        ownerName,
        ownerEmail,
        department: params.department ?? null,
      });

  const now = new Date();
  const samplePopupJob: AgendaNotificationJobDTO[] =
    !isTestRuntime() && events[0]
      ? [
          {
            id: `job-seed-${params.tenantId}`,
            tenantId: params.tenantId,
            eventId: events[0].id,
            eventTitle: events[0].title,
            eventCategoryName: events[0].categoryName,
            eventCategoryIcon: events[0].icon,
            eventColor: events[0].color,
            eventPriority: events[0].priority,
            eventStartAt: events[0].startAt,
            eventLocalDate: events[0].localStartDate,
            eventLocalTime: events[0].localStartTime,
            eventDescription: events[0].description,
            eventAllDay: events[0].allDay,
            reminderId: events[0].reminders[0]?.id ?? null,
            recipientUserId: ownerId,
            occurrenceKey: `${events[0].id}::${events[0].localStartDate}`,
            channel: 'POPUP',
            idempotencyKey: `seed-popup-${params.tenantId}-${ownerId}`,
            scheduledFor: now.toISOString(),
            status: 'DISPONIVEL',
            snoozedUntil: null,
            readAt: null,
            attempts: 1,
            maxAttempts: 4,
            lastError: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          },
        ]
      : [];

  tenantData = {
    categories,
    events,
    jobs: samplePopupJob,
    emailOutbox: [],
    preferences: [],
    auditLogs: [],
    seededAt: now.toISOString(),
  };

  root.tenants[params.tenantId] = tenantData;
  persistAgendaSandboxRoot();
  return tenantData;
}

export function appendSandboxAuditLog(
  tenantData: AgendaSandboxTenantData,
  entry: Omit<AgendaAuditLogDTO, 'id' | 'sha256' | 'createdAt'>
): AgendaAuditLogDTO {
  const createdAt = new Date().toISOString();
  const payloadStr = JSON.stringify({
    tenantId: entry.tenantId,
    eventId: entry.eventId,
    actorUserId: entry.actorUserId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: entry.summary,
    createdAt,
  });
  const sha256 = createHash('sha256').update(payloadStr).digest('hex');
  const full: AgendaAuditLogDTO = {
    id: randomUUID(),
    ...entry,
    sha256,
    createdAt,
  };
  tenantData.auditLogs.unshift(full);
  if (tenantData.auditLogs.length > 500) {
    tenantData.auditLogs.length = 500;
  }
  persistAgendaSandboxRoot();
  return full;
}

export function getAllTenantIdsInSandbox(): string[] {
  const root = loadRootFromDiskOrMemory();
  return Object.keys(root.tenants);
}
