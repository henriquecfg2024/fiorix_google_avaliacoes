import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface DocumentRoot { id: string; path: string }
export interface DocumentMatch { rootId: string; relativePath: string; name: string; size: number; modifiedAt: string }
export interface DocumentSearchResult { files: DocumentMatch[]; partial: boolean; unavailableRoots: string[] }
const extensions = new Set(['.pdf', '.doc', '.docx', '.tif', '.tiff', '.txt', '.rtf']);
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function parseDocumentRoots(raw: string): DocumentRoot[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) throw new Error('Configure de 1 a 10 pastas.');
  const ids = new Set<string>();
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('Pasta inválida.');
    const root = item as Record<string, unknown>;
    if (typeof root.id !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(root.id) || ids.has(root.id)) throw new Error('Identificador de pasta inválido ou repetido.');
    if (typeof root.path !== 'string' || !path.isAbsolute(root.path) || root.path.includes('\0')) throw new Error('Use caminhos absolutos.');
    ids.add(root.id);
    return { id: root.id, path: root.path };
  });
}

export function isWithinRoot(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep));
}

// HTTPS is always required, except plain HTTP to the local loopback when explicitly
// allowed for local testing (never in production). Prevents credentials over the network.
export function isAllowedDocumentApiUrl(
  rawUrl: string,
  options: { allowInsecureLocalhost: boolean; environment: string },
): boolean {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.protocol === 'https:') return true;
  if (!options.allowInsecureLocalhost || options.environment === 'production') return false;
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

// No path supplied by a browser is accepted. Only locally configured roots are traversed.
// Symlinks/junctions are skipped and each directory/file is checked against the canonical root.
export async function searchDocuments(
  roots: DocumentRoot[], query: string, limit = 100,
  budget = { maxEntries: 50000, timeoutMs: 25000 },
): Promise<DocumentSearchResult> {
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  if (terms.join(' ').length < 2 || query.length > 120 || limit < 1 || limit > 100) throw new Error('Pesquisa inválida.');
  const result: DocumentSearchResult = { files: [], partial: false, unavailableRoots: [] };
  let visited = 0;
  const deadline = Date.now() + budget.timeoutMs;
  for (const root of roots) {
    let canonical: string;
    try { canonical = await fs.realpath(root.path); }
    catch { result.unavailableRoots.push(root.id); result.partial = true; continue; }
    const pending = [canonical];
    while (pending.length) {
      if (Date.now() >= deadline || visited >= budget.maxEntries || result.files.length >= limit) { result.partial = true; return result; }
      const directory = pending.pop()!;
      try {
        if (!isWithinRoot(canonical, await fs.realpath(directory))) { result.partial = true; continue; }
        const handle = await fs.opendir(directory);
        for await (const entry of handle) {
          if (++visited > budget.maxEntries || Date.now() >= deadline || result.files.length >= limit) { result.partial = true; return result; }
          if (entry.isSymbolicLink()) continue;
          const filePath = path.join(directory, entry.name);
          const info = await fs.lstat(filePath);
          if (info.isSymbolicLink()) continue;
          const resolved = await fs.realpath(filePath);
          if (!isWithinRoot(canonical, resolved)) continue;
          if (info.isDirectory()) { pending.push(filePath); continue; }
          if (!info.isFile() || !extensions.has(path.extname(entry.name).toLowerCase())) continue;
          const relativePath = path.relative(canonical, filePath);
          if (!terms.every(term => normalize(relativePath).includes(term))) continue;
          result.files.push({ rootId: root.id, relativePath, name: entry.name, size: info.size, modifiedAt: info.mtime.toISOString() });
        }
      } catch { result.partial = true; }
    }
  }
  return result;
}
