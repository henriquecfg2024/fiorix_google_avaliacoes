import { describe, expect, it } from 'vitest';
import {
  connectorMessage,
  documentJobInput,
  documentResult,
  readDocumentTextInput,
  searchInput,
} from '../src/lib/documental/contracts';
import { PASTAS_FAVORITAS_PADRAO, RAIZES_DOCUMENTAL } from '../src/lib/documental/pastasFavoritas';

const file = { rootId: 'judicial', relativePath: 'pasta/teste.pdf', name: 'teste.pdf', size: 10, modifiedAt: '2026-10-28T12:00:00.000Z' };
describe('documental contracts', () => {
  it('rejects a browser-selected path or tenant', () => {
    expect(searchInput.safeParse({ query: 'teste', connectorId: 'local', path: 'H:\\' }).success).toBe(false);
    expect(searchInput.safeParse({ query: 'teste', connectorId: 'local', tenantId: 'other' }).success).toBe(false);
  });
  it('accepts SETORES and LV2 searches and document reads even when connectorId is empty or rootId is provided', () => {
    const parsedSearch = documentJobInput.safeParse({
      connectorId: '',
      type: 'search',
      rootId: 'imagens',
      query: '00052287',
      forceFresh: false,
    });
    expect(parsedSearch.success).toBe(true);
    if (parsedSearch.success) {
      expect(parsedSearch.data.connectorId).toBe('auto');
    }

    const parsedRead = readDocumentTextInput.safeParse({
      connectorId: '',
      type: 'read_document_text',
      rootId: 'imagens',
      relativePath: 'SETORES\\00052000\\00052287.KEN',
    });
    expect(parsedRead.success).toBe(true);
    if (parsedRead.success) {
      expect(parsedRead.data.connectorId).toBe('auto');
    }
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
  it('accepts 5-field cross-search query up to 260 chars and titulos_visualiza / titulos_online roots', () => {
    const query5Campos =
      '1037173-83.2024.8.26.0007 | Matrícula 160430 | 012.345.6789-1 | Requerente Nome Completo | Protocolo 645706 AC016401954';
    expect(query5Campos.length).toBeLessThanOrEqual(260);
    expect(searchInput.safeParse({ connectorId: '', query: query5Campos }).success).toBe(true);
    expect(searchInput.safeParse({ connectorId: '', query: 'x'.repeat(260) }).success).toBe(true);
    expect(searchInput.safeParse({ connectorId: '', query: 'x'.repeat(261) }).success).toBe(false);

    expect(documentJobInput.safeParse({
      connectorId: 'auto',
      type: 'list_directory',
      rootId: 'titulos_visualiza',
      relativePath: '00645000',
    }).success).toBe(true);
    expect(documentJobInput.safeParse({
      connectorId: 'auto',
      type: 'read_document_text',
      rootId: 'titulos_online',
      relativePath: 'AC\\645706-AC016401954\\titulo.pdf',
    }).success).toBe(true);
    expect(documentJobInput.safeParse({
      connectorId: 'auto',
      type: 'ocr_document_pages',
      rootId: 'titulos_visualiza',
      relativePath: '00428000\\00428370.TIF',
      pageStart: 1,
      pageEnd: 12,
    }).success).toBe(true);

    expect(RAIZES_DOCUMENTAL.some((r) => r.id === 'titulos_visualiza' && r.caminho === 'K:\\IMAGENS\\TITULOS-VISUALIZA')).toBe(true);
    expect(RAIZES_DOCUMENTAL.some((r) => r.id === 'titulos_online' && r.caminho === 'K:\\IMAGENS\\Titulos_Online')).toBe(true);
    expect(PASTAS_FAVORITAS_PADRAO.some((f) => f.rootId === 'titulos_visualiza')).toBe(true);
    expect(PASTAS_FAVORITAS_PADRAO.some((f) => f.rootId === 'titulos_online')).toBe(true);
  });
});
