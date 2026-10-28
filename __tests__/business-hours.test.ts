import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isBusinessHours } from '../src/utils/businessHours.js';

describe('Business Hours Utility (Expediente do Cartório)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('1. Retorna true em horário comercial de Segunda a Sábado (07:00 - 18:59 BRT)', () => {
    process.env.TEST_BUSINESS_HOURS = 'true';
    process.env.BUSINESS_HOURS_ONLY = 'true';

    // Terça-feira às 10:00 da manhã em Brasília (13:00 UTC)
    const tuesdayMorning = new Date('2026-09-01T13:00:00.000Z');
    expect(isBusinessHours(tuesdayMorning)).toBe(true);

    // Sábado às 18:45 da tarde em Brasília (21:45 UTC)
    const saturdayEvening = new Date('2026-09-05T21:45:00.000Z');
    expect(isBusinessHours(saturdayEvening)).toBe(true);
  });

  it('2. Retorna false durante a noite (19:00 - 06:59 BRT) e aos Domingos', () => {
    process.env.TEST_BUSINESS_HOURS = 'true';
    process.env.BUSINESS_HOURS_ONLY = 'true';

    // Segunda-feira às 21:00 da noite em Brasília (00:00 UTC de terça)
    const mondayNight = new Date('2026-09-02T00:00:00.000Z');
    expect(isBusinessHours(mondayNight)).toBe(false);

    // Domingo às 14:00 da tarde em Brasília (17:00 UTC)
    const sundayAfternoon = new Date('2026-09-06T17:00:00.000Z');
    expect(isBusinessHours(sundayAfternoon)).toBe(false);

    // Terça-feira às 05:00 da madrugada em Brasília (08:00 UTC)
    const tuesdayDawn = new Date('2026-09-01T08:00:00.000Z');
    expect(isBusinessHours(tuesdayDawn)).toBe(false);
  });

  it('3. Retorna true quando BUSINESS_HOURS_ONLY não é "true"', () => {
    process.env.TEST_BUSINESS_HOURS = 'true';
    process.env.BUSINESS_HOURS_ONLY = 'false';

    const sundayNight = new Date('2026-09-06T23:00:00.000Z');
    expect(isBusinessHours(sundayNight)).toBe(true);
  });
});
