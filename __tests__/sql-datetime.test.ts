import { describe, expect, it } from 'vitest';
import { addSecondsToSqlDateTime2Local, SQL_CURSOR_TIME_BASIS, toSqlDateTime2Local } from '../src/utils/sqlDateTime.js';

describe('SQL Server datetime2 cursor formatting & timezone independence', () => {
  const timezones = ['America/Sao_Paulo', 'UTC', 'America/New_York', 'Asia/Tokyo', 'Europe/London'];

  it('preserves WEBRI local wall-clock time for SQL datetime2 parameters', () => {
    expect(SQL_CURSOR_TIME_BASIS).toBe('WEBRI_LOCAL_DATETIME');
    expect(toSqlDateTime2Local('2026-08-31T00:00:00.000')).toBe('2026-08-31 00:00:00.000');
    expect(toSqlDateTime2Local('2026-09-01T12:34:56.789')).toBe('2026-09-01 12:34:56.789');
  });

  describe('Calendar validation', () => {
    it('rejects invalid calendar dates and times', () => {
      expect(() => toSqlDateTime2Local('2026-02-31T10:00:00.000')).toThrowError('INVALID_SQL_DATETIME2_LOCAL');
      expect(() => toSqlDateTime2Local('2026-13-01T10:00:00.000')).toThrowError('INVALID_SQL_DATETIME2_LOCAL');
      expect(() => toSqlDateTime2Local('2026-01-01T25:00:00.000')).toThrowError('INVALID_SQL_DATETIME2_LOCAL');
      expect(() => toSqlDateTime2Local('2026-01-01T10:61:00.000')).toThrowError('INVALID_SQL_DATETIME2_LOCAL');
      expect(() => toSqlDateTime2Local('2026-02-29T10:00:00.000')).toThrowError('INVALID_SQL_DATETIME2_LOCAL'); // 2026 not leap year
    });

    it('accepts valid leap year date', () => {
      expect(toSqlDateTime2Local('2028-02-29T10:00:00.000')).toBe('2028-02-29 10:00:00.000');
    });
  });

  describe('Timezone & DST independence', () => {


    it('formats 2026-08-31T00:00:00.000 and 2026-09-01T12:34:56.789 identically across timezones', () => {
      const originalTz = process.env.TZ;
      try {
        for (const tz of timezones) {
          process.env.TZ = tz;
          expect(toSqlDateTime2Local('2026-08-31T00:00:00.000')).toBe('2026-08-31 00:00:00.000');
          expect(toSqlDateTime2Local('2026-09-01T12:34:56.789')).toBe('2026-09-01 12:34:56.789');
        }
      } finally {
        process.env.TZ = originalTz;
      }
    });

    it('computes overlap calculation identically across timezones', () => {
      const originalTz = process.env.TZ;
      try {
        for (const tz of timezones) {
          process.env.TZ = tz;
          const result = addSecondsToSqlDateTime2Local('2026-09-01T00:02:00.000', -300);
          expect(result).toBe('2026-08-31 23:57:00.000');
        }
      } finally {
        process.env.TZ = originalTz;
      }
    });

    it('calculates continuously without DST jumps or gaps', () => {
      const originalTz = process.env.TZ;
      try {
        // America/New_York DST start would skip 02:00 -> 03:00 on 2026-03-08
        process.env.TZ = 'America/New_York';
        const result1 = addSecondsToSqlDateTime2Local('2026-03-08T01:59:00.000', 120);
        expect(result1).toBe('2026-03-08 02:01:00.000');

        // America/Sao_Paulo hypothetical historical DST shift
        process.env.TZ = 'America/Sao_Paulo';
        const result2 = addSecondsToSqlDateTime2Local('2026-10-18T23:59:00.000', 120);
        expect(result2).toBe('2026-10-19 00:01:00.000');
      } finally {
        process.env.TZ = originalTz;
      }
    });
  });

  describe('Day / Month / Year rollover & Leap year', () => {
    it('handles day rollover correctly', () => {
      expect(addSecondsToSqlDateTime2Local('2026-08-31 23:58:00.000', 300)).toBe('2026-09-01 00:03:00.000');
      expect(addSecondsToSqlDateTime2Local('2026-09-01 00:02:00.000', -300)).toBe('2026-08-31 23:57:00.000');
    });

    it('handles month rollover correctly', () => {
      expect(addSecondsToSqlDateTime2Local('2026-01-31 23:59:00.000', 120)).toBe('2026-02-01 00:01:00.000');
      expect(addSecondsToSqlDateTime2Local('2026-03-01 00:01:00.000', -120)).toBe('2026-02-28 23:59:00.000');
    });

    it('handles year rollover correctly', () => {
      expect(addSecondsToSqlDateTime2Local('2026-12-31T23:59:00.000', 120)).toBe('2027-01-01 00:01:00.000');
      expect(addSecondsToSqlDateTime2Local('2027-01-01T00:01:00.000', -120)).toBe('2026-12-31 23:59:00.000');
    });

    it('handles leap year rollover correctly', () => {
      expect(addSecondsToSqlDateTime2Local('2028-02-28 23:59:00.000', 120)).toBe('2028-02-29 00:01:00.000');
      expect(addSecondsToSqlDateTime2Local('2028-02-29 23:59:00.000', 120)).toBe('2028-03-01 00:01:00.000');
      expect(addSecondsToSqlDateTime2Local('2028-03-01 00:01:00.000', -120)).toBe('2028-02-29 23:59:00.000');
    });

    it('preserves textual Z ISO string as pure wall-clock without timezone shift', () => {

      const originalTz = process.env.TZ;
      try {
        for (const tz of timezones) {
          process.env.TZ = tz;
          const sqlVal = toSqlDateTime2Local('2026-09-01T10:55:31.000Z');
          expect(sqlVal).toBe('2026-09-01 10:55:31.000');
          // Verify no shift occurred (neither -3h 07:55 nor +3h 13:55)
          expect(sqlVal).not.toBe('2026-09-01 07:55:31.000');
          expect(sqlVal).not.toBe('2026-09-01 13:55:31.000');
        }
      } finally {
        process.env.TZ = originalTz;
      }
    });
  });
});


