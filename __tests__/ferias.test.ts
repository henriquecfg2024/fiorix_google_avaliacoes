import { describe, it, expect } from 'vitest';
import { validarRegrasCLTFerias } from '@/lib/ferias/clt-validator';

describe('Módulo de Férias - Validações CLT (Art. 134 e 135)', () => {
  it('deve aprovar período único válido de 30 dias', () => {
    const res = validarRegrasCLTFerias([
      { inicio: '2027-01-10', fim: '2027-02-08', dias: 30 },
    ]);
    expect(res.valido).toBe(true);
    expect(res.erros).toHaveLength(0);
  });

  it('deve aprovar fracionamento legal em 2 períodos (15 + 15 dias)', () => {
    const res = validarRegrasCLTFerias([
      { inicio: '2027-01-10', fim: '2027-01-24', dias: 15 },
      { inicio: '2027-07-05', fim: '2027-07-19', dias: 15 },
    ]);
    expect(res.valido).toBe(true);
    expect(res.erros).toHaveLength(0);
  });

  it('deve aprovar fracionamento legal em 3 períodos (14 + 10 + 6 dias)', () => {
    const res = validarRegrasCLTFerias([
      { inicio: '2027-01-10', fim: '2027-01-23', dias: 14 },
      { inicio: '2027-05-10', fim: '2027-05-19', dias: 10 },
      { inicio: '2027-10-05', fim: '2027-10-10', dias: 6 },
    ]);
    expect(res.valido).toBe(true);
    expect(res.erros).toHaveLength(0);
  });

  it('deve reprovar fracionamento onde nenhum período tem pelo menos 14 dias (Art. 134 §1)', () => {
    const res = validarRegrasCLTFerias([
      { inicio: '2027-01-10', fim: '2027-01-19', dias: 10 },
      { inicio: '2027-07-05', fim: '2027-07-14', dias: 10 },
    ]);
    expect(res.valido).toBe(false);
    expect(res.erros[0]).toContain('14 dias corridos');
  });

  it('deve reprovar fracionamento com período menor que 5 dias (Art. 134 §1)', () => {
    const res = validarRegrasCLTFerias([
      { inicio: '2027-01-10', fim: '2027-01-29', dias: 20 },
      { inicio: '2027-07-05', fim: '2027-07-08', dias: 4 },
    ]);
    expect(res.valido).toBe(false);
    expect(res.erros[0]).toContain('5 dias corridos');
  });

  it('deve reprovar fracionamento com mais de 3 períodos', () => {
    const res = validarRegrasCLTFerias([
      { inicio: '2027-01-10', fim: '2027-01-24', dias: 15 },
      { inicio: '2027-04-05', fim: '2027-04-09', dias: 5 },
      { inicio: '2027-07-05', fim: '2027-07-09', dias: 5 },
      { inicio: '2027-10-05', fim: '2027-10-09', dias: 5 },
    ]);
    expect(res.valido).toBe(false);
    expect(res.erros.some((e) => e.includes('no máximo 3 períodos'))).toBe(true);
  });

  it('deve reprovar soma de períodos superior a 30 dias', () => {
    const res = validarRegrasCLTFerias([
      { inicio: '2027-01-10', fim: '2027-01-29', dias: 20 },
      { inicio: '2027-07-05', fim: '2027-07-24', dias: 20 },
    ]);
    expect(res.valido).toBe(false);
    expect(res.erros.some((e) => e.includes('excede o limite anual legal de 30 dias'))).toBe(true);
  });

  it('deve emitir alerta preventivo ao iniciar em uma sexta-feira (Art. 134 §3)', () => {
    // 2027-01-15 é Sexta-feira
    const res = validarRegrasCLTFerias([
      { inicio: '2027-01-15', fim: '2027-02-03', dias: 20 },
    ]);
    expect(res.valido).toBe(true);
    expect(res.alertas.some((a) => a.includes('Sexta-feira'))).toBe(true);
  });
});
