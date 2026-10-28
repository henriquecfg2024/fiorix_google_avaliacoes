import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

describe('node:sqlite', () => {
  it('should create an in-memory database', () => {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    db.prepare('INSERT INTO test (name) VALUES (?)').run('fiorix');
    const result = db.prepare('SELECT * FROM test').all();
    expect(result).toHaveLength(1);
    expect((result[0] as any).name).toBe('fiorix');
  });
});
