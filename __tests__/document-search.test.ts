import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  executeDocumentCli,
  isAllowedDocumentApiUrl,
  isWithinRoot,
  parseDocumentRoots,
  readDocumentText,
  resolveAuthorizedFile,
  searchDocuments,
} from '../src/services/document-search.js';

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
  it('requires HTTPS except explicit loopback HTTP outside production', () => {
    const allow = { allowInsecureLocalhost: true, environment: 'homolog' };
    const deny = { allowInsecureLocalhost: false, environment: 'homolog' };
    expect(isAllowedDocumentApiUrl('https://fiorix.app/api/v1/connector/sync', deny)).toBe(true);
    expect(isAllowedDocumentApiUrl('http://localhost:3000/api/v1/connector/sync', deny)).toBe(false);
    expect(isAllowedDocumentApiUrl('http://localhost:3000/api/v1/connector/sync', allow)).toBe(true);
    expect(isAllowedDocumentApiUrl('http://127.0.0.1:3000/x', allow)).toBe(true);
    expect(isAllowedDocumentApiUrl('http://localhost:3000/x', { ...allow, environment: 'production' })).toBe(false);
    expect(isAllowedDocumentApiUrl('http://192.168.0.10:3000/x', allow)).toBe(false);
    expect(isAllowedDocumentApiUrl('http://localhost.evil.com/x', allow)).toBe(false);
    expect(isAllowedDocumentApiUrl('not a url', allow)).toBe(false);
  });
  it('resolves authorized file paths strictly within configured roots', async () => {
    const dir = await fixture();
    const filePath = path.join(dir, 'sub', 'doc.pdf');
    await fs.mkdir(path.join(dir, 'sub'));
    await fs.writeFile(filePath, 'dummy');
    const roots = [{ id: 'usucapiao', path: dir }];

    const resolved = await resolveAuthorizedFile(roots, 'usucapiao', 'sub/doc.pdf');
    expect(resolved.toLowerCase()).toBe(path.resolve(filePath).toLowerCase());

    // Throws on unknown root
    await expect(resolveAuthorizedFile(roots, 'inexistente', 'sub/doc.pdf')).rejects.toThrow();

    // Throws on escape attempt
    await expect(resolveAuthorizedFile(roots, 'usucapiao', '../other.pdf')).rejects.toThrow();

    // Throws if file does not exist
    await expect(resolveAuthorizedFile(roots, 'usucapiao', 'nao-existe.pdf')).rejects.toThrow();
  });

  it('reads document text and html safely via readDocumentText', async () => {
    const dir = await fixture();
    const filePath = path.join(dir, 'minuta.txt');
    await fs.writeFile(filePath, '7º Oficial de Registro de Imóveis\nManifestação Fictícia');

    const result = await readDocumentText(filePath);
    expect(result.fileName).toBe('minuta.txt');
    expect(result.extension).toBe('.txt');
    expect(result.text).toContain('7º Oficial de Registro de Imóveis');
    expect(result.html).toContain('7º Oficial de Registro de Imóveis');
    expect(result.size).toBeGreaterThan(0);
  });
});

