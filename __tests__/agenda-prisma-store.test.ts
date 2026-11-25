import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  getAlertConfig: vi.fn(),
  sendMail: vi.fn(async () => ({
    messageId: 'smtp-msg-1',
    accepted: ['henrique@7risp.com.br'] as string[],
    rejected: [] as string[],
    response: '250 2.0.0 Ok: queued as ABC123',
  })),
  createTransport: vi.fn(),
  agendaCategoryCount: vi.fn(async () => 1),
  agendaCategoryCreateMany: vi.fn(async () => ({ count: 12 })),
  agendaCategoryFindMany: vi.fn(async () => [
    {
      id: 'cat-1',
      tenantId: 'tenant-prod',
      slug: 'administrativo',
      name: 'Administrativo',
      color: '#2563EB',
      icon: 'Briefcase',
      scope: 'INSTITUCIONAL',
      ownerUserId: null,
      isSystem: true,
      isActive: true,
      createdBy: 'system',
      createdAt: new Date('2026-11-25T10:00:00Z'),
      updatedAt: new Date('2026-11-25T10:00:00Z'),
    },
  ]),
  agendaEventFindMany: vi.fn(async () => []),
  agendaEventCreate: vi.fn(),
  agendaNotificationJobCount: vi.fn(async () => 0),
  agendaNotificationJobFindMany: vi.fn(async () => []),
  agendaNotificationJobCreateMany: vi.fn(async () => ({ count: 1 })),
  agendaUserPreferenceFindUnique: vi.fn(async () => ({
    id: 'pref-1',
    tenantId: 'tenant-prod',
    userId: 'user-1',
    defaultView: 'MENSAL',
    weekStartsOn: 0,
    preferredCategories: [],
    defaultChannel: 'EMAIL',
    defaultOffsetMinutes: 30,
    quietHoursStart: null,
    quietHoursEnd: null,
    showCompleted: true,
    webPushEnabled: false,
    calendarCompactFormat: false,
    themeMode: 'light',
    createdAt: new Date('2026-11-25T10:00:00Z'),
    updatedAt: new Date('2026-11-25T10:00:00Z'),
  })),
  agendaAuditLogCreate: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'audit-1',
    ...data,
  })),
  agendaAuditLogFindMany: vi.fn(async () => []),
}));

vi.mock('@/lib/alerts/alert-storage', () => ({
  getAlertConfig: prismaMocks.getAlertConfig,
}));
vi.mock('nodemailer', () => ({
  default: {
    createTransport: prismaMocks.createTransport,
  },
}));
vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));
vi.mock('@/lib/documental/origin', () => ({
  isSameOriginRequest: vi.fn(() => true),
}));
vi.mock('@/lib/nav-permissions/service', () => ({
  isNavPermissionsFeatureEnabled: vi.fn(() => true),
  isRouteAllowedForUser: vi.fn(async () => true),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    agendaCategory: {
      count: prismaMocks.agendaCategoryCount,
      createMany: prismaMocks.agendaCategoryCreateMany,
      findMany: prismaMocks.agendaCategoryFindMany,
    },
    agendaEvent: {
      findMany: prismaMocks.agendaEventFindMany,
      create: prismaMocks.agendaEventCreate,
    },
    agendaNotificationJob: {
      count: prismaMocks.agendaNotificationJobCount,
      findMany: prismaMocks.agendaNotificationJobFindMany,
      createMany: prismaMocks.agendaNotificationJobCreateMany,
    },
    agendaUserPreference: {
      findUnique: prismaMocks.agendaUserPreferenceFindUnique,
    },
    agendaAuditLog: {
      create: prismaMocks.agendaAuditLogCreate,
      findMany: prismaMocks.agendaAuditLogFindMany,
    },
    pushSubscription: { findMany: vi.fn(async () => []) },
  },
}));

import { dispatchAgendaReminderEmail } from '@/lib/agenda/email-service';
import type { AgendaAccessContext } from '@/lib/agenda/permissions';
import {
  createAgendaEvent,
  getAgendaDashboardData,
  getWelcomeSummaryForSession,
} from '@/lib/agenda/service';

function makeCtx(): AgendaAccessContext {
  return {
    user: {
      id: 'user-1',
      tenantId: 'tenant-prod',
      role: 'ADMIN',
      name: 'Henrique Gama',
      email: 'henrique@7risp.com.br',
      departamento: 'TI',
    },
    roleUpper: 'ADMIN',
    canView: true,
    canCreateOwn: true,
    canAssignOrCreateSetorial: true,
    canCreateInstitucional: true,
    canManageCategories: true,
    canManageModule: false,
    isReadOnly: false,
  };
}

describe('Agenda Inteligente — Adapter PostgreSQL/Prisma em Produção (sem dados fictícios)', () => {
  const prevSandboxFlag = process.env.FIORIX_AGENDA_SANDBOX_MODE;
  const prevAgendaFlag = process.env.FEATURE_AGENDA_INTELIGENTE_V1_ENABLED;
  const prevWelcomeFlag = process.env.FEATURE_LOGIN_WELCOME_V1_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FIORIX_AGENDA_SANDBOX_MODE = 'false';
    process.env.FEATURE_AGENDA_INTELIGENTE_V1_ENABLED = 'true';
    process.env.FEATURE_LOGIN_WELCOME_V1_ENABLED = 'true';
  });

  afterEach(() => {
    process.env.FIORIX_AGENDA_SANDBOX_MODE = prevSandboxFlag;
    process.env.FEATURE_AGENDA_INTELIGENTE_V1_ENABLED = prevAgendaFlag;
    process.env.FEATURE_LOGIN_WELCOME_V1_ENABLED = prevWelcomeFlag;
  });

  it('carrega dashboard do PostgreSQL filtrado por tenantId sem semear eventos fictícios', async () => {
    const ctx = makeCtx();
    const dash = await getAgendaDashboardData(ctx, {});

    expect(prismaMocks.agendaEventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 'tenant-prod' },
      })
    );
    expect(dash.occurrences).toEqual([]);
    expect(dash.indicators.hoje).toBe(0);
    expect(dash.categories).toHaveLength(1);
    expect(dash.preferences.themeMode).toBe('light');
  });

  it('persiste compromisso, auditoria e jobs de notificação via Prisma em produção', async () => {
    const ctx = makeCtx();
    prismaMocks.agendaEventCreate.mockImplementationOnce(async ({ data }) => ({
      ...data,
      category: { name: 'Administrativo' },
      participants: data.participants?.create ?? [],
      reminders: data.reminders?.create ?? [],
      recurrenceExceps: [],
      occurrenceStatuses: [],
      createdAt: new Date('2026-11-25T10:00:00Z'),
      updatedAt: new Date('2026-11-25T10:00:00Z'),
    }));

    const { event } = await createAgendaEvent(
      ctx,
      {
        title: 'Auditoria Real 7º RI',
        categoryId: 'cat-1',
        localStartDate: '2026-11-26',
        localStartTime: '14:00',
        localEndDate: '2026-11-26',
        localEndTime: '15:00',
        visibility: 'INSTITUCIONAL',
        reminders: [{ channel: 'EMAIL', offsetMinutes: 30 }],
      },
      new Date('2026-11-25T12:00:00Z')
    );

    expect(event.title).toBe('Auditoria Real 7º RI');
    expect(prismaMocks.agendaEventCreate).toHaveBeenCalledTimes(1);
    expect(prismaMocks.agendaNotificationJobCreateMany).toHaveBeenCalledTimes(1);
    expect(prismaMocks.agendaAuditLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-prod',
          action: 'CRIACAO_COMPROMISSO',
          actorUserId: 'user-1',
        }),
      })
    );
  });

  it('retorna cenário F_FALHA_CONSULTA quando o PostgreSQL falha durante o Boas-Vindas', async () => {
    prismaMocks.agendaEventFindMany.mockRejectedValueOnce(new Error('PG timeout'));
    const ctx = makeCtx();

    const welcome = await getWelcomeSummaryForSession({
      user: ctx.user,
      authAt: 9999,
      now: new Date('2026-11-25T12:00:00Z'),
    });

    expect(welcome.scenario).toBe('F_FALHA_CONSULTA');
    expect(welcome.queryFailed).toBe(true);
    expect(welcome.todayItems).toEqual([]);
  });

  it('reaproveita SMTP Corporativo da Central de Operações ao enviar lembrete por e-mail em produção', async () => {
    prismaMocks.createTransport.mockReturnValue({ sendMail: prismaMocks.sendMail });
    prismaMocks.getAlertConfig.mockResolvedValueOnce({
      tenantId: 'tenant-prod',
      emailProvider: 'smtp',
      emailConfig: {
        host: 'smtp.durend.com.br',
        port: 587,
        user: 'henrique@7risp.com.br',
        pass: 'segredo-mock',
      },
    });

    const result = await dispatchAgendaReminderEmail({
      tenantId: 'tenant-prod',
      recipientName: 'Henrique Gama',
      recipientEmail: 'henrique@7risp.com.br',
      eventTitle: 'Reunião Diretoria',
      localDate: '2026-11-26',
      localTime: '10:00',
      allDay: false,
      priority: 'ALTA',
      countdownLabel: 'Falta 1 dia',
      isConfidential: false,
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe('ACEITA_PROVEDOR');
    expect(result.providerHost).toBe('smtp.durend.com.br');
    expect(result.providerResponse).toBe('250 2.0.0 Ok: queued as ABC123');
    expect(prismaMocks.getAlertConfig).toHaveBeenCalledWith('tenant-prod');
    expect(prismaMocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: 'smtp.durend.com.br',
        port: 587,
        secure: false,
        auth: { user: 'henrique@7risp.com.br', pass: 'segredo-mock' },
      })
    );
    expect(prismaMocks.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'henrique@7risp.com.br',
        subject: 'FIORIX | Lembrete de compromisso — Reunião Diretoria',
      })
    );

    // Garante que rejeição explícita pelo servidor SMTP é tratada como FALHA
    prismaMocks.sendMail.mockResolvedValueOnce({
      messageId: 'smtp-msg-rej',
      accepted: [],
      rejected: ['henrique@7risp.com.br'],
      response: '550 5.1.1 User unknown',
    });
    prismaMocks.getAlertConfig.mockResolvedValueOnce({
      tenantId: 'tenant-prod',
      emailProvider: 'smtp',
      emailConfig: {
        host: 'smtp.durend.com.br',
        port: 587,
        user: 'henrique@7risp.com.br',
        pass: 'segredo-mock',
      },
    });
    const rejectedResult = await dispatchAgendaReminderEmail({
      tenantId: 'tenant-prod',
      recipientName: 'Henrique Gama',
      recipientEmail: 'henrique@7risp.com.br',
      eventTitle: 'Teste Rejeição',
      localDate: '2026-11-26',
      localTime: '10:00',
      allDay: false,
      priority: 'NORMAL',
      countdownLabel: 'Hoje',
      isConfidential: false,
    });
    expect(rejectedResult.success).toBe(false);
    expect(rejectedResult.status).toBe('FALHA');
    expect(rejectedResult.errorMessage).toContain('henrique@7risp.com.br');
  });
});
