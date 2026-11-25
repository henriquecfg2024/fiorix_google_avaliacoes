import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    $queryRawUnsafe: vi.fn(async () => []),
    pushSubscription: { findMany: vi.fn(async () => []) },
  },
}));
import {
  buildGreetingByTime,
  computeEffectiveStatusAndOverdue,
  extractFirstName,
  formatCommitmentCountMessage,
  formatCountdownLabel,
  formatLocalDateBr,
  getLocalDayUtcBounds,
  localDateTimeToUtc,
} from '@/lib/agenda/timezone';
import {
  generateRecurrenceDatesInWindow,
  getDaysInMonth,
  isLeapYear,
  resolveDayInMonth,
  resolveFirstBusinessDayOfMonth,
  resolveLastBusinessDayOfMonth,
  toRruleString,
} from '@/lib/agenda/recurrence';
import { resetAgendaSandboxForTests } from '@/lib/agenda/sandbox-store';
import {
  changeAgendaOccurrenceStatus,
  createAgendaEvent,
  getAgendaDashboardData,
  updateAgendaEvent,
} from '@/lib/agenda/service';
import type { AgendaAccessContext } from '@/lib/agenda/permissions';

function makeCtx(overrides: Partial<AgendaAccessContext['user']> = {}): AgendaAccessContext {
  return {
    user: {
      id: 'user-1',
      tenantId: 'tenant-1',
      role: 'ADMIN',
      name: 'Henrique Gama',
      email: 'henrique@7risp.com.br',
      departamento: 'TI',
      ...overrides,
    },
    roleUpper: String(overrides.role || 'ADMIN').toUpperCase(),
    canView: true,
    canCreateOwn: true,
    canAssignOrCreateSetorial: true,
    canCreateInstitucional: true,
    canManageCategories: true,
    canManageModule: false,
    isReadOnly: false,
  };
}

describe('Agenda Inteligente — Fuso Horário, Saudações, Contagem Regressiva e Recorrências', () => {
  beforeEach(() => {
    resetAgendaSandboxForTests();
  });

  it('valida anos bissextos, meses com 28/29/30/31 dias e política de dia inexistente (dia 31 e 29/02)', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2025)).toBe(false);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);

    expect(getDaysInMonth(2024, 2)).toBe(29);
    expect(getDaysInMonth(2026, 2)).toBe(28);
    expect(getDaysInMonth(2026, 4)).toBe(30);
    expect(getDaysInMonth(2026, 1)).toBe(31);

    expect(resolveDayInMonth(2026, 2, 31, 'ULTIMO_DIA')).toBe('2026-02-28');
    expect(resolveDayInMonth(2024, 2, 31, 'ULTIMO_DIA')).toBe('2024-02-29');
    expect(resolveDayInMonth(2026, 4, 31, 'IGNORAR_MES')).toBeNull();
  });

  it('resolve primeiro e último dia útil considerando fins de semana e feriados SP/nacionais', () => {
    // Janeiro/2026: 01/01 é feriado (quinta), primeiro dia útil é sexta 02/01
    expect(resolveFirstBusinessDayOfMonth(2026, 1)).toBe('2026-01-02');
    // Novembro/2026: 30/11 é segunda-feira (dia útil)
    expect(resolveLastBusinessDayOfMonth(2026, 11)).toBe('2026-11-30');
    // Janeiro/2026: 31/01 é sábado, último dia útil é sexta 30/01
    expect(resolveLastBusinessDayOfMonth(2026, 1)).toBe('2026-01-30');
  });

  it('expande todas as frequências dentro da janela com limite seguro (diário, semanal, quinzenal, mensal, semestral, anual, personalizado)', () => {
    const daily = generateRecurrenceDatesInWindow({
      startDate: '2026-11-01',
      endDateOfEvent: '2026-11-01',
      recurrenceType: 'DIARIO',
      windowStartDate: '2026-11-01',
      windowEndDate: '2026-11-05',
    });
    expect(daily).toEqual(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);

    const biweekly = generateRecurrenceDatesInWindow({
      startDate: '2026-11-02', // segunda
      endDateOfEvent: '2026-11-02',
      recurrenceType: 'QUINZENAL',
      windowStartDate: '2026-11-01',
      windowEndDate: '2026-12-10',
    });
    expect(biweekly).toEqual(['2026-11-02', '2026-11-16', '2026-11-30']);

    const monthly31 = generateRecurrenceDatesInWindow({
      startDate: '2026-01-31',
      endDateOfEvent: '2026-01-31',
      recurrenceType: 'MENSAL',
      recurrenceRule: {
        frequency: 'MENSAL',
        interval: 1,
        monthDay: 31,
        monthEndPolicy: 'IGNORAR_MES',
      },
      windowStartDate: '2026-01-01',
      windowEndDate: '2026-06-30',
    });
    expect(monthly31).toEqual(['2026-01-31', '2026-03-31', '2026-05-31']);

    const semiannual = generateRecurrenceDatesInWindow({
      startDate: '2026-01-15',
      endDateOfEvent: '2026-01-15',
      recurrenceType: 'SEMESTRAL',
      windowStartDate: '2026-01-01',
      windowEndDate: '2027-02-01',
    });
    expect(semiannual).toEqual(['2026-01-15', '2026-07-15', '2027-01-15']);

    const annualLeap = generateRecurrenceDatesInWindow({
      startDate: '2024-02-29',
      endDateOfEvent: '2024-02-29',
      recurrenceType: 'ANUAL',
      recurrenceRule: { frequency: 'ANUAL', interval: 1, monthEndPolicy: 'ULTIMO_DIA' },
      windowStartDate: '2024-01-01',
      windowEndDate: '2028-04-01',
    });
    expect(annualLeap).toEqual(['2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29']);

    const custom = generateRecurrenceDatesInWindow({
      startDate: '2026-11-01',
      endDateOfEvent: '2026-11-01',
      recurrenceType: 'PERSONALIZADO',
      recurrenceRule: { frequency: 'PERSONALIZADO', interval: 10, customUnit: 'DIAS', maxOccurrences: 3 },
      windowStartDate: '2026-11-01',
      windowEndDate: '2026-12-31',
    });
    expect(custom).toEqual(['2026-11-01', '2026-11-11', '2026-11-21']);
    expect(toRruleString('SEMANAL', { frequency: 'SEMANAL', interval: 1, weekdays: [1, 3] })).toContain(
      'BYDAY=MO,WE'
    );
  });

  it('trata eventos que atravessam a meia-noite e dia inteiro no fuso America/Sao_Paulo', () => {
    // 23:30 America/Sao_Paulo = 02:30 UTC do dia seguinte, mas ainda pertence ao dia local 25/11
    const lateUtc = localDateTimeToUtc('2026-11-25', '23:30', 'America/Sao_Paulo');
    const bounds = getLocalDayUtcBounds('2026-11-25', 'America/Sao_Paulo');
    expect(lateUtc.getTime()).toBeGreaterThanOrEqual(bounds.startUtc.getTime());
    expect(lateUtc.getTime()).toBeLessThan(bounds.endUtc.getTime());
    expect(formatLocalDateBr('2026-11-25')).toBe('25/11/2026');

    const midnightCross = generateRecurrenceDatesInWindow({
      startDate: '2026-11-25',
      endDateOfEvent: '2026-11-26',
      recurrenceType: 'UNICO',
      windowStartDate: '2026-11-26',
      windowEndDate: '2026-11-26',
    });
    expect(midnightCross).toEqual(['2026-11-25']);
  });

  it('calcula saudações por faixa horária, primeiro nome, singular/plural, contagem regressiva e atraso', () => {
    expect(extractFirstName('Henrique Cesar Gama')).toBe('Henrique');
    expect(extractFirstName(null)).toBeNull();
    expect(extractFirstName('   ')).toBeNull();

    const morning = localDateTimeToUtc('2026-11-25', '08:30', 'America/Sao_Paulo');
    const afternoon = localDateTimeToUtc('2026-11-25', '14:15', 'America/Sao_Paulo');
    const night = localDateTimeToUtc('2026-11-25', '21:10', 'America/Sao_Paulo');
    const dawn = localDateTimeToUtc('2026-11-25', '04:30', 'America/Sao_Paulo');

    expect(buildGreetingByTime(morning, 'Henrique Gama')).toMatchObject({
      period: 'MANHA',
      title: 'Bom dia, Henrique!',
    });
    expect(buildGreetingByTime(afternoon, 'Maria Silva')).toMatchObject({
      period: 'TARDE',
      title: 'Boa tarde, Maria!',
    });
    expect(buildGreetingByTime(night, null)).toMatchObject({
      period: 'NOITE',
      title: 'Boa noite!',
    });
    expect(buildGreetingByTime(dawn, 'Ana')).toMatchObject({
      period: 'NOITE',
      title: 'Boa noite, Ana!',
    });

    expect(formatCommitmentCountMessage(1)).toBe('Você tem 1 compromisso agendado para hoje.');
    expect(formatCommitmentCountMessage(3)).toBe('Você tem 3 compromissos agendados para hoje.');

    const now = localDateTimeToUtc('2026-11-25', '10:00', 'America/Sao_Paulo');
    expect(
      computeEffectiveStatusAndOverdue({
        baseStatus: 'CONCLUIDO',
        startAt: localDateTimeToUtc('2026-11-20', '09:00'),
        endAt: localDateTimeToUtc('2026-11-20', '10:00'),
        now,
      })
    ).toEqual({ effectiveStatus: 'CONCLUIDO', isOverdue: false });

    expect(
      computeEffectiveStatusAndOverdue({
        baseStatus: 'AGENDADO',
        startAt: localDateTimeToUtc('2026-11-23', '09:00'),
        endAt: localDateTimeToUtc('2026-11-23', '10:00'),
        now,
      })
    ).toEqual({ effectiveStatus: 'ATRASADO', isOverdue: true });

    expect(
      formatCountdownLabel(
        {
          startAt: localDateTimeToUtc('2026-11-26', '09:00').toISOString(),
          endAt: localDateTimeToUtc('2026-11-26', '10:00').toISOString(),
          localStartDate: '2026-11-26',
          allDay: false,
          effectiveStatus: 'AGENDADO',
          timezone: 'America/Sao_Paulo',
        },
        now
      )
    ).toBe('Amanhã');

    expect(
      formatCountdownLabel(
        {
          startAt: localDateTimeToUtc('2026-11-25', '12:30').toISOString(),
          endAt: localDateTimeToUtc('2026-11-25', '13:30').toISOString(),
          localStartDate: '2026-11-25',
          allDay: false,
          effectiveStatus: 'AGENDADO',
          timezone: 'America/Sao_Paulo',
        },
        now
      )
    ).toBe('Hoje em 2h 30m');
  });

  it('aplica edição e cancelamento em 3 escopos (somente esta, esta e seguintes, toda a série) preservando histórico', async () => {
    const ctx = makeCtx();
    const { event } = await createAgendaEvent(ctx, {
      title: 'Reunião Diária',
      localStartDate: '2026-11-01',
      localStartTime: '09:00',
      localEndDate: '2026-11-01',
      localEndTime: '10:00',
      visibility: 'INSTITUCIONAL',
      recurrenceType: 'DIARIO',
      recurrenceRule: { frequency: 'DIARIO', interval: 1, maxOccurrences: 5 },
    });

    // Concluir dia 01 e editar somente dia 02
    await changeAgendaOccurrenceStatus(ctx, event.id, {
      action: 'CONCLUIR',
      scope: 'SINGLE',
      occurrenceDate: '2026-11-01',
    });
    await updateAgendaEvent(ctx, event.id, {
      scope: 'SINGLE',
      occurrenceDate: '2026-11-02',
      title: 'Reunião Especial Dia 02',
    });

    // Cancelar dia 04 e seguintes
    await changeAgendaOccurrenceStatus(ctx, event.id, {
      action: 'CANCELAR',
      scope: 'THIS_AND_FOLLOWING',
      occurrenceDate: '2026-11-04',
    });

    const dash = await getAgendaDashboardData(
      ctx,
      { windowStartDate: '2026-11-01', windowEndDate: '2026-11-10' },
      localDateTimeToUtc('2026-11-01', '08:00')
    );

    expect(dash.occurrences.map((o) => [o.occurrenceDate, o.title, o.effectiveStatus])).toEqual([
      ['2026-11-01', 'Reunião Diária', 'CONCLUIDO'],
      ['2026-11-02', 'Reunião Especial Dia 02', 'AGENDADO'],
      ['2026-11-03', 'Reunião Diária', 'AGENDADO'],
    ]);
  });
});
