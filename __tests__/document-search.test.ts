import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isWithinRoot, parseDocumentRoots, searchDocuments } from '../src/services/document-search.js';

const temporary: string[] = [];
async function fixture() { const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fiorix-doc-')); temporary.push(dir); return dir; }
afterEach(async () => { for (const dir of temporary.splice(0)) await fs.rm(dir, { recursive: true, force: true }); });
describe('document search', () => {
  it('searches anonymous names without exporting bytes or absolute paths', async () => {
    const dir = await fixture();
    await fs.mkdir(path.join(dir, 'Usucapião'));
    await fs.writeFile(path.join(dir, 'Usucapião', 'processo-ficticio-123.pdf'), 'fixture');
    await fs.writeFile(path.join(dir, 'ignorar.exe'), 'fixture');
    const result = await searchDocuments([{ id: 'judicial', path: dir }], 'usucapiao 123');
    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toMatchObject({ rootId: 'judicial', name: 'processo-ficticio-123.pdf', size: 7 });
    expect(JSON.stringify(result)).not.toContain(dir);
    expect(result.partial).toBe(false);
  });
  it('rejects escapes and sibling prefixes', async () => {
    const dir = await fixture();
    expect(isWithinRoot(dir, path.join(dir, '..', 'other'))).toBe(false);
    expect(isWithinRoot(dir, dir + '-sibling')).toBe(false);
    expect(isWithinRoot(dir, path.join(dir, 'inside'))).toBe(true);
  });
  it('does not traverse symlinks or junctions outside roots', async () => {
    const dir = await fixture(), outside = await fixture();
    await fs.writeFile(path.join(outside, 'segredo-ficticio.pdf'), 'fixture');
    await fs.symlink(outside, path.join(dir, 'atalho'), process.platform === 'win32' ? 'junction' : 'dir');
    expect((await searchDocuments([{ id: 'root', path: dir }], 'segredo')).files).toHaveLength(0);
  });
  it('reports unavailable roots and bounded traversal', async () => {
    const dir = await fixture();
    await fs.writeFile(path.join(dir, 'teste.pdf'), 'fixture');
    expect((await searchDocuments([{ id: 'root', path: dir }], 'teste', 100, { maxEntries: 0, timeoutMs: 1000 })).partial).toBe(true);
    const result = await searchDocuments([{ id: 'missing', path: path.join(dir, 'missing') }], 'teste');
    expect(result.unavailableRoots).toEqual(['missing']);
    expect(result.partial).toBe(true);
  });
  it('rejects root misconfiguration and too-short searches', async () => {
    expect(() => parseDocumentRoots('[]')).toThrow();
    expect(() => parseDocumentRoots('[{"id":"root","path":"relative"}]')).toThrow();
    const dir = await fixture();
    expect(() => parseDocumentRoots(JSON.stringify([{ id: 'same', path: dir }, { id: 'same', path: dir }]))).toThrow();
    await expect(searchDocuments([{ id: 'root', path: dir }], 'a')).rejects.toThrow();
  });
});
