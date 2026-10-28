import { describe, expect, it } from 'vitest';
import { connectorMessage, documentResult, searchInput } from '../src/lib/documental/contracts';

const file = { rootId: 'judicial', relativePath: 'pasta/teste.pdf', name: 'teste.pdf', size: 10, modifiedAt: '2026-10-28T12:00:00.000Z' };
describe('documental contracts', () => {
  it('rejects a browser-selected path or tenant', () => {
    expect(searchInput.safeParse({ query: 'teste', connectorId: 'local', path: 'H:\\' }).success).toBe(false);
    expect(searchInput.safeParse({ query: 'teste', connectorId: 'local', tenantId: 'other' }).success).toBe(false);
  });
  it('rejects absolute paths, traversal and oversize results', () => {
    for (const relativePath of ['../outside.pdf', '..\\outside.pdf', '/etc/test.pdf', 'H:\\test.pdf']) {
      expect(documentResult.safeParse({ files: [{ ...file, relativePath }], partial: false, unavailableRoots: [] }).success).toBe(false);
    }
    expect(documentResult.safeParse({ files: Array(101).fill(file), partial: false, unavailableRoots: [] }).success).toBe(false);
  });
  it('allows only the expected connector protocol', () => {
    expect(connectorMessage.safeParse({ action: 'claim', connectorId: 'local' }).success).toBe(true);
    expect(connectorMessage.safeParse({ action: 'execute', connectorId: 'local', command: 'anything' }).success).toBe(false);
    expect(documentResult.safeParse({ files: [file], partial: false, unavailableRoots: [] }).success).toBe(true);
  });
});
