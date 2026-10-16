import { describe, expect, it } from 'vitest';
import {
  computeNextExpectedDate,
  checkBusinessHoursState,
  getSaoPauloDateDetails,
  getNextBusinessDay,
} from '@/lib/health/operations-service';

describe('Cálculo de agendamento e sincronização incremental (Operations)', () => {
  it('identifica corretamente os detalhes da data no fuso de Brasília (America/Sao_Paulo)', () => {
    // 2026-10-16 18:13:39 BRT é 21:13:39 UTC
    const utcDate = new Date('2026-10-16T21:13:39.000Z');
    const sp = getSaoPauloDateDetails(utcDate);

    expect(sp.year).toBe(2026);
    expect(sp.month).toBe(10);
    expect(sp.day).toBe(16);
    expect(sp.hour).toBe(18);
    expect(sp.minute).toBe(13);
    expect(sp.second).toBe(39);
    expect(sp.dayOfWeek).toBe(5); // Sexta-feira
  });

  it('determina corretamente o próximo dia útil a partir de sábado e domingo', () => {
    // Sexta -> Sábado (+1 dia)
    const nextFromFri = getNextBusinessDay(2026, 10, 16, 5);
    expect(nextFromFri.day).toBe(17);

    // Sábado -> Segunda (+2 dias)
    const nextFromSat = getNextBusinessDay(2026, 10, 17, 6);
    expect(nextFromSat.day).toBe(19);

    // Domingo -> Segunda (+1 dia)
    const nextFromSun = getNextBusinessDay(2026, 10, 18, 0);
    expect(nextFromSun.day).toBe(19);
  });

  it('avalia o expediente das 07h às 19h (Seg-Sáb)', () => {
    // Sexta-feira 18:59:59 (dentro do expediente)
    const openDate = new Date('2026-10-16T18:59:59-03:00');
    expect(checkBusinessHoursState(openDate).isBusinessHours).toBe(true);

    // Sexta-feira 19:00:00 (fora do expediente)
    const closedNight = new Date('2026-10-16T19:00:00-03:00');
    expect(checkBusinessHoursState(closedNight).isBusinessHours).toBe(false);

    // Domingo 12:00:00 (fora do expediente)
    const closedSunday = new Date('2026-10-18T12:00:00-03:00');
    expect(checkBusinessHoursState(closedSunday).isBusinessHours).toBe(false);
  });

  it('NÃO gera atraso falso de 672m após execução das 18h (Caso Módulo BI)', () => {
    // Sexta-feira: BI executou às 18:00:00. Verificação às 18:13:39.
    const lastSync = new Date('2026-10-16T18:00:00-03:00');
    const now = new Date('2026-10-16T18:13:39-03:00');

    const result = computeNextExpectedDate(lastSync, 3600, 'bi', now);

    // Próxima data esperada deve ser no próximo dia útil (Sábado 17/10) às 07:00:00
    const spExpected = getSaoPauloDateDetails(result.nextExpectedDate);
    expect(spExpected.year).toBe(2026);
    expect(spExpected.month).toBe(10);
    expect(spExpected.day).toBe(17);
    expect(spExpected.hour).toBe(7);
    expect(spExpected.minute).toBe(0);

    // Deve estar no futuro em relação ao momento atual (18:13:39)
    expect(result.nextExpectedDate.getTime()).toBeGreaterThan(now.getTime());
    expect(result.isPendingFirstCycleToday).toBe(false);
  });

  it('agenda próximo ciclo para hoje quando ainda faltar mais de 1 hora para as 19h', () => {
    // Produtividade executou às 17:30:01. Verificação às 18:13:39.
    const lastSync = new Date('2026-10-16T17:30:01-03:00');
    const now = new Date('2026-10-16T18:13:39-03:00');

    const result = computeNextExpectedDate(lastSync, 3600, 'produtividade', now);

    const spExpected = getSaoPauloDateDetails(result.nextExpectedDate);
    expect(spExpected.day).toBe(16);
    expect(spExpected.hour).toBe(18);
    expect(spExpected.minute).toBe(30);
    expect(result.nextExpectedDate.getTime()).toBeGreaterThan(now.getTime());
  });

  it('em sábado às 18h agenda a próxima execução para segunda-feira às 07h', () => {
    const lastSyncSat = new Date('2026-10-17T18:00:00-03:00');
    const nowSat = new Date('2026-10-17T18:15:00-03:00');

    const result = computeNextExpectedDate(lastSyncSat, 3600, 'bi', nowSat);
    const spExpected = getSaoPauloDateDetails(result.nextExpectedDate);

    // 17/10 é sábado, próximo útil é 19/10 segunda-feira
    expect(spExpected.day).toBe(19);
    expect(spExpected.dayOfWeek).toBe(1); // Segunda
    expect(spExpected.hour).toBe(7);
    expect(spExpected.minute).toBe(0);
  });

  it('detecta atraso real quando rotina parou de sincronizar de manhã', () => {
    // Última sincronização foi às 08:00 hoje. Agora é 18:13.
    const lastSync = new Date('2026-10-16T08:00:00-03:00');
    const now = new Date('2026-10-16T18:13:39-03:00');

    const result = computeNextExpectedDate(lastSync, 3600, 'bi', now);
    const spExpected = getSaoPauloDateDetails(result.nextExpectedDate);

    // Deveria ter rodado às 09:00 hoje
    expect(spExpected.day).toBe(16);
    expect(spExpected.hour).toBe(9);
    expect(spExpected.minute).toBe(0);

    // O momento atual ultrapassou a próxima esperada em mais de 9 horas
    expect(now.getTime()).toBeGreaterThan(result.nextExpectedDate.getTime());
  });
});
