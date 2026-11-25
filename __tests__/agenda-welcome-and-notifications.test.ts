import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isNavPermissionsFeatureEnabled: vi.fn(() => true),
  isRouteAllowedForUser: vi.fn(async () => true),
}));

vi.mock('@/lib/auth-helpers', () => ({
  requireAuth: vi.fn(),
}));
vi.mock('@/lib/documental/origin', () => ({
  isSameOriginRequest: vi.fn(() => true),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: vi.fn(async () => []),
    pushSubscription: { findMany: vi.fn(async () => []) },
  },
}));
vi.mock('@/lib/nav-permissions/service', () => ({
  isNavPermissionsFeatureEnabled: mocks.isNavPermissionsFeatureEnabled,
  isRouteAllowedForUser: mocks.isRouteAllowedForUser,
}));

import { processDueAgendaNotificationJobs } from '@/lib/agenda/notification-worker';
import { buildAgendaReminderEmail } from '@/lib/agenda/email-service';
import type { AgendaAccessContext } from '@/lib/agenda/permissions';
import { resetAgendaSandboxForTests } from '@/lib/agenda/sandbox-store';
import {
  actOnAgendaNotification,
  changeAgendaOccurrenceStatus,
  createAgendaEvent,
  getWelcomeSummaryForSession,
  listAgendaNotificationsForUser,
} from '@/lib/agenda/service';
import { localDateTimeToUtc } from '@/lib/agenda/timezone';

function makeUser(overrides: Partial<AgendaAccessContext['user']> = {}) {
  return {
    id: 'u-1',
    tenantId: 'tenant-sp-7ri',
    role: 'ADMIN',
    name: 'Henrique Gama',
    email: 'henrique@7risp.com.br',
    departamento: 'TI',
    ...overrides,
  };
}

function makeCtx(user = makeUser()): AgendaAccessContext {
  return {
    user,
    roleUpper: String(user.role).toUpperCase(),
    canView: true,
    canCreateOwn: true,
    canAssignOrCreateSetorial: true,
    canCreateInstitucional: true,
    canManageCategories: true,
    canManageModule: false,
    isReadOnly: false,
  };
}

describe('Boas-Vindas Inteligentes & Worker de Lembretes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isNavPermissionsFeatureEnabled.mockReturnValue(true);
    mocks.isRouteAllowedForUser.mockResolvedValue(true);
    resetAgendaSandboxForTests();
  });

  it('cobre todos os cenários de Boas-Vindas (A..G) e controle de chave por login', async () => {
    const user = makeUser();
    const ctx = makeCtx(user);
    const nowMorning = localDateTimeToUtc('2026-11-25', '08:30');

    // Cenário C: Agenda livre hoje
    const wFree = await getWelcomeSummaryForSession({
      user,
      authAt: 1001,
      now: nowMorning,
    });
    expect(wFree.scenario).toBe('C_SEM_COMPROMISSOS');
    expect(wFree.loginKey).toBe('u-1:1001');
    expect(wFree.greetingTitle).toBe('Bom dia, Henrique!');

    // Cenário A: 1 compromisso hoje (cancela um segundo para garantir exclusão de cancelados)
    await createAgendaEvent(
      ctx,
      {
        title: 'Reunião de TI',
        localStartDate: '2026-11-25',
        localStartTime: '09:00',
        localEndDate: '2026-11-25',
        localEndTime: '10:00',
        visibility: 'INDIVIDUAL',
      },
      nowMorning
    );
    const { event: cancelled } = await createAgendaEvent(
      ctx,
      {
        title: 'Cancelado Hoje',
        localStartDate: '2026-11-25',
        localStartTime: '11:00',
        localEndDate: '2026-11-25',
        localEndTime: '12:00',
        visibility: 'INDIVIDUAL',
      },
      nowMorning
    );
    await changeAgendaOccurrenceStatus(ctx, cancelled.id, { action: 'CANCELAR' }, nowMorning);

    const wOne = await getWelcomeSummaryForSession({ user, authAt: 1002, now: nowMorning });
    expect(wOne.scenario).toBe('A_UM_COMPROMISSO');
    expect(wOne.totalTodayScheduled).toBe(1);
    expect(wOne.loginKey).toBe('u-1:1002'); // Novo login no mesmo dia gera nova loginKey

    // Cenário B: mais de 5 compromissos -> retorna 5 + remainingCount
    for (let i = 0; i < 6; i += 1) {
      await createAgendaEvent(
        ctx,
        {
          title: `Compromisso ${i + 2}`,
          localStartDate: '2026-11-25',
          localStartTime: `${String(12 + i).padStart(2, '0')}:00`,
          localEndDate: '2026-11-25',
          localEndTime: `${String(12 + i).padStart(2, '0')}:30`,
          visibility: 'INDIVIDUAL',
        },
        nowMorning
      );
    }
    const wMany = await getWelcomeSummaryForSession({ user, authAt: 1003, now: nowMorning });
    expect(wMany.scenario).toBe('B_VARIOS_COMPROMISSOS');
    expect(wMany.totalTodayScheduled).toBe(7);
    expect(wMany.todayItems).toHaveLength(5);
    expect(wMany.remainingCount).toBe(2);

    // Cenário F: falha na consulta não exibe agenda livre
    const wFail = await getWelcomeSummaryForSession({
      user,
      authAt: 1004,
      now: nowMorning,
      forceQueryFailure: true,
    });
    expect(wFail.scenario).toBe('F_FALHA_CONSULTA');
    expect(wFail.queryFailed).toBe(true);

    // Cenário G: usuário sem permissão no módulo recebe apenas saudação sem expor dados
    mocks.isRouteAllowedForUser.mockResolvedValueOnce(false);
    const wNoPerm = await getWelcomeSummaryForSession({
      user: makeUser({ id: 'u-vis', role: 'USER', name: '' }),
      authAt: 1005,
      now: nowMorning,
    });
    expect(wNoPerm.scenario).toBe('G_SEM_PERMISSAO_AGENDA');
    expect(wNoPerm.canAccessAgenda).toBe(false);
    expect(wNoPerm.todayItems).toEqual([]);
    expect(wNoPerm.greetingTitle).toBe('Bom dia!'); // Tratamento seguro para nome ausente
  });

  it('identifica Cenário D (todos concluídos) e Cenário E (atrasados separados de hoje)', async () => {
    const user = makeUser();
    const ctx = makeCtx(user);
    const now = localDateTimeToUtc('2026-11-25', '18:30');

    const { event: todayEv } = await createAgendaEvent(
      ctx,
      {
        title: 'Concluído Hoje',
        localStartDate: '2026-11-25',
        localStartTime: '10:00',
        localEndDate: '2026-11-25',
        localEndTime: '11:00',
        visibility: 'INDIVIDUAL',
      },
      now
    );
    await changeAgendaOccurrenceStatus(ctx, todayEv.id, { action: 'CONCLUIR' }, now);

    const wDone = await getWelcomeSummaryForSession({ user, authAt: 2001, now });
    expect(wDone.scenario).toBe('D_TODOS_CONCLUIDOS');
    expect(wDone.totalTodayCompleted).toBe(1);
    expect(wDone.totalOverdue).toBe(0);

    // Cria compromisso atrasado de ontem (não deve somar em totalTodayScheduled)
    await createAgendaEvent(
      ctx,
      {
        title: 'Pendência de Ontem',
        localStartDate: '2026-11-24',
        localStartTime: '09:00',
        localEndDate: '2026-11-24',
        localEndTime: '10:00',
        visibility: 'INDIVIDUAL',
      },
      now
    );

    const wWithOverdue = await getWelcomeSummaryForSession({ user, authAt: 2002, now });
    expect(wWithOverdue.totalTodayScheduled).toBe(1);
    expect(wWithOverdue.totalOverdue).toBe(1);
  });

  it('processa fila de lembretes com idempotência, retry backoff, adiamento e invalidação após cancelamento', async () => {
    const ctx = makeCtx();
    const eventTime = localDateTimeToUtc('2026-11-25', '15:00');
    const dueNow = localDateTimeToUtc('2026-11-25', '14:35');

    const { event } = await createAgendaEvent(
      ctx,
      {
        title: 'Revisão Anual de Segurança',
        localStartDate: '2026-11-25',
        localStartTime: '15:00',
        localEndDate: '2026-11-25',
        localEndTime: '16:00',
        visibility: 'INDIVIDUAL',
        isConfidential: true,
        reminders: [
          { channel: 'EMAIL', offsetMinutes: 30 },
          { channel: 'POPUP', offsetMinutes: 30 },
        ],
      },
      eventTime
    );

    // 1) Simula falha transitória na primeira tentativa de e-mail -> aplica backoff e entrega pop-up
    const run1 = await processDueAgendaNotificationJobs({
      tenantId: ctx.user.tenantId,
      now: dueNow,
      forceSandboxEmail: true,
      simulateEmailFailureOnce: true,
    });
    expect(run1.deliveredPopup).toBe(1);
    expect(run1.retried).toBe(1);

    // 2) Após janela de backoff (15 min depois), reenvia em sandbox sem duplicar o pop-up
    const afterBackoff = new Date(dueNow.getTime() + 15 * 60_000);
    const run2 = await processDueAgendaNotificationJobs({
      tenantId: ctx.user.tenantId,
      now: afterBackoff,
      forceSandboxEmail: true,
    });
    expect(run2.deliveredEmail).toBe(1);
    expect(run2.deliveredPopup).toBe(0);

    // 3) Verifica minimização de conteúdo confidencial no e-mail
    const notifState = await listAgendaNotificationsForUser(ctx, afterBackoff);
    expect(notifState.emailOutbox).toHaveLength(1);
    expect(notifState.emailOutbox[0]!.subject).not.toContain('Revisão Anual de Segurança');
    expect(notifState.duePopups).toHaveLength(1);

    // Template padrão (não confidencial) exibe assunto completo do Prompt Seção 19
    const normalEmail = buildAgendaReminderEmail({
      recipientName: 'Henrique Gama',
      recipientEmail: 'henrique@7risp.com.br',
      eventTitle: 'Reunião de TI',
      localDate: '2026-11-25',
      localTime: '09:00',
      allDay: false,
      priority: 'ALTA',
      countdownLabel: 'Falta 1 dia',
      isConfidential: false,
    });
    expect(normalEmail.subject).toBe('FIORIX | Lembrete de compromisso — Reunião de TI');

    // 4) Adia o pop-up por 15 minutos e depois cancela o evento -> invalida notificação adiada
    const popupId = notifState.duePopups[0]!.id;
    await actOnAgendaNotification(ctx, { action: 'SNOOZE', jobId: popupId, snoozeMinutes: 15 }, afterBackoff);
    expect((await listAgendaNotificationsForUser(ctx, afterBackoff)).snoozed).toHaveLength(1);

    await changeAgendaOccurrenceStatus(ctx, event.id, { action: 'CANCELAR' }, afterBackoff);
    expect((await listAgendaNotificationsForUser(ctx, afterBackoff)).duePopups).toHaveLength(0);
    expect((await listAgendaNotificationsForUser(ctx, afterBackoff)).snoozed).toHaveLength(0);
  });
});
