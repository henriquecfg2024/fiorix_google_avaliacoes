import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isRealtimeRecordExpired } from '@/lib/espera/espera-service';

describe('isRealtimeRecordExpired (Regra de Expiração Automática de Senhas Ao Vivo)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. Deve expirar atendimento deixado aberto no horário de almoço quando a recepção fecha às 17h45', () => {
    // Simula dia útil (Terça-feira, 2026-10-13) às 17:45:00 em São Paulo (UTC-3)
    vi.setSystemTime(new Date('2026-10-13T20:45:00Z')); // 20:45 UTC = 17:45 SP

    const ticketAlmoco = {
      data: '2026-10-13',
      chamada: '12:15',
      inicioAtendimento: '12:15',
    };

    expect(isRealtimeRecordExpired(ticketAlmoco, false)).toBe(true);
  });

  it('2. Deve expirar atendimento da Mesa 2 chamado às 13:17 quando o horário é 17:45', () => {
    vi.setSystemTime(new Date('2026-10-13T20:45:00Z')); // 17:45 SP

    const ticket1317 = {
      data: '2026-10-13',
      chamada: '13:17',
      inicioAtendimento: '13:17',
    };

    expect(isRealtimeRecordExpired(ticket1317, false)).toBe(true);
  });

  it('3. Deve manter atendimento legítimo iniciado há 10 minutos durante o expediente', () => {
    // 14:30 SP (17:30 UTC)
    vi.setSystemTime(new Date('2026-10-13T17:30:00Z'));

    const ticketRecente = {
      data: '2026-10-13',
      chamada: '14:20',
      inicioAtendimento: '14:20',
    };

    expect(isRealtimeRecordExpired(ticketRecente, false)).toBe(false);
  });

  it('4. Deve expirar atendimento com mais de 60 minutos durante o expediente (timeout operacional)', () => {
    // 14:30 SP (17:30 UTC)
    vi.setSystemTime(new Date('2026-10-13T17:30:00Z'));

    const ticketEsquecido = {
      data: '2026-10-13',
      chamada: '13:10', // 80 min atrás
      inicioAtendimento: '13:10',
    };

    expect(isRealtimeRecordExpired(ticketEsquecido, false)).toBe(true);
  });

  it('5. Deve zerar fila de espera após o fechamento da recepção (17:15+)', () => {
    vi.setSystemTime(new Date('2026-10-13T20:20:00Z')); // 17:20 SP

    const ticketFila = {
      data: '2026-10-13',
      emissao: '16:50',
    };

    expect(isRealtimeRecordExpired(ticketFila, true)).toBe(true);
  });

  it('6. Deve expirar qualquer atendimento fora do expediente geral (após 18h00)', () => {
    vi.setSystemTime(new Date('2026-10-13T21:05:00Z')); // 18:05 SP

    const ticketNoite = {
      data: '2026-10-13',
      chamada: '17:58',
    };

    expect(isRealtimeRecordExpired(ticketNoite, false)).toBe(true);
  });

  it('7. Deve expirar todos os atendimentos ao vivo nos finais de semana', () => {
    // Sábado 2026-10-17 às 10:00 SP (13:00 UTC)
    vi.setSystemTime(new Date('2026-10-17T13:00:00Z'));

    const ticketSabado = {
      data: '2026-10-17',
      chamada: '09:55',
    };

    expect(isRealtimeRecordExpired(ticketSabado, false)).toBe(true);
  });
});
