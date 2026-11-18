import fsSync from 'node:fs';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  deveConsultarFullTextSiplanIa,
  parseSiplaniaOcrPosicoesJson,
} from '../src/db/siplania-readonly.js';
import { extractDocumentOcrPages, searchDocuments } from '../src/services/document-search.js';

function createMinimalTwoPageTiff(): Buffer {
  // Gera 2 IFDs TIFF uncompressed RGB 1x1 válidos para testar UTIF.decode no caminho rápido LV2
  const header = Buffer.alloc(8);
  header.write('II', 0, 'ascii');
  header.writeUInt16LE(42, 2);
  header.writeUInt32LE(8, 4);

  const buildIfd = (pixelOffset: number, nextIfdOffset: number) => {
    const entries = 8;
    const buf = Buffer.alloc(2 + entries * 12 + 4);
    buf.writeUInt16LE(entries, 0);
    const writeTag = (idx: number, tag: number, type: number, count: number, value: number) => {
      const off = 2 + idx * 12;
      buf.writeUInt16LE(tag, off);
      buf.writeUInt16LE(type, off + 2);
      buf.writeUInt32LE(count, off + 4);
      buf.writeUInt32LE(value, off + 8);
    };
    writeTag(0, 256, 3, 1, 1); // ImageWidth = 1
    writeTag(1, 257, 3, 1, 1); // ImageLength = 1
    writeTag(2, 258, 3, 1, 8); // BitsPerSample = 8
    writeTag(3, 259, 3, 1, 1); // Compression = None
    writeTag(4, 262, 3, 1, 1); // Photometric = MinIsBlack
    writeTag(5, 273, 4, 1, pixelOffset); // StripOffsets
    writeTag(6, 278, 3, 1, 1); // RowsPerStrip = 1
    writeTag(7, 279, 4, 1, 1); // StripByteCounts = 1
    buf.writeUInt32LE(nextIfdOffset, 2 + entries * 12);
    return buf;
  };

  const ifdSize = 2 + 8 * 12 + 4; // 102 bytes
  const ifd1Offset = 8;
  const ifd2Offset = ifd1Offset + ifdSize;
  const pixelOffset = ifd2Offset + ifdSize;
  const ifd1 = buildIfd(pixelOffset, ifd2Offset);
  const ifd2 = buildIfd(pixelOffset + 1, 0);
  const pixels = Buffer.from([0xff, 0xff]);
  return Buffer.concat([header, ifd1, ifd2, pixels]);
}

describe('Integração Read-Only SiplanIA (OCR Instantâneo LV2 + Full-Text GIN)', () => {
  it('1. parseSiplaniaOcrPosicoesJson converte pixels do SiplanIA para coordenadas normalizadas [0..1]', () => {
    const raw = JSON.stringify({
      Pagina: 1,
      Largura: 1000,
      Altura: 2000,
      Unidade: 'Pixel',
      Palavras: [
        { Texto: 'MATRÍCULA', X: 100, Y: 200, Largura: 150, Altura: 40 },
        { Texto: '40.000', X: 260, Y: 200, Largura: 90, Altura: 40 },
        { Texto: '   ', X: 10, Y: 10, Largura: 20, Altura: 10 },
      ],
    });

    const parsed = parseSiplaniaOcrPosicoesJson(raw);
    expect(parsed).toEqual([
      ['MATRÍCULA', 0.1, 0.1, 0.15, 0.02],
      ['40.000', 0.26, 0.1, 0.09, 0.02],
    ]);
    expect(parseSiplaniaOcrPosicoesJson('')).toEqual([]);
    expect(parseSiplaniaOcrPosicoesJson({ Largura: 0, Altura: 100, Palavras: [] })).toEqual([]);
  });

  it('2. deveConsultarFullTextSiplanIa evita buscas numéricas diretas e ativa apenas texto/CPF/CNPJ/SQL', () => {
    // Buscas numéricas/identificadores diretos NÃO devem poluir com FTS
    expect(deveConsultarFullTextSiplanIa('40000')).toBe(false);
    expect(deveConsultarFullTextSiplanIa('229.534')).toBe(false);
    expect(deveConsultarFullTextSiplanIa('Matrícula nº 40.000')).toBe(false);
    expect(deveConsultarFullTextSiplanIa('Protocolo 649109')).toBe(false);
    expect(deveConsultarFullTextSiplanIa('Transcrição 6063')).toBe(false);
    expect(deveConsultarFullTextSiplanIa('AC012345678')).toBe(false);
    expect(deveConsultarFullTextSiplanIa('1162956-97.2024.8.26.0100')).toBe(false);
    expect(deveConsultarFullTextSiplanIa('Setor 053 Quadra 006')).toBe(false);

    // Endereço, condomínio, pessoa, CPF/CNPJ/SQL DEVEM acionar FTS
    expect(deveConsultarFullTextSiplanIa('JERONIMO DE MENDONCA 75')).toBe(true);
    expect(deveConsultarFullTextSiplanIa('Condomínio Edifício Parque Analia Franco')).toBe(true);
    expect(deveConsultarFullTextSiplanIa('FLAVIO TADEU MOREIRA DA SILVA')).toBe(true);
    expect(deveConsultarFullTextSiplanIa('123.456.789-01')).toBe(true);
    expect(deveConsultarFullTextSiplanIa('12.345.678/0001-99')).toBe(true);
    expect(deveConsultarFullTextSiplanIa('053.006.0012-3')).toBe(true);
  });

  it('3. extractDocumentOcrPages usa SiplanIA no caminho rápido para LV2 .KEN e respeita fallback híbrido se faltar página', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fiorix-siplania-ocr-'));
    try {
      const lv2Dir = path.join(tmpDir, 'IMAGENS', 'LV2', '00040000');
      await fs.mkdir(lv2Dir, { recursive: true });
      const kenPath = path.join(lv2Dir, '00040000.KEN');
      await fs.writeFile(kenPath, createMinimalTwoPageTiff());

      const mockResolver = vi.fn(async () => ({
        qtdPaginasBanco: 2,
        pages: new Map<number, [string, number, number, number, number][]>([
          [1, [['MATRICULA', 0.1, 0.05, 0.12, 0.02]]],
          [2, [['40.000', 0.12, 0.08, 0.08, 0.02]]],
        ]),
      }));

      const res = await extractDocumentOcrPages(kenPath, {
        pageStart: 1,
        pageEnd: 60,
        siplaniaOcrResolver: mockResolver,
      });

      expect(mockResolver).toHaveBeenCalledTimes(1);
      expect(mockResolver).toHaveBeenCalledWith({
        numeroMatricula: 40000,
        pageStart: 1,
        pageEnd: 2,
      });
      expect(res.pageCount).toBe(2);
      expect(res.loadedPageStart).toBe(1);
      expect(res.loadedPageEnd).toBe(2);
      expect(res.hasMorePages).toBe(false);
      expect(res.pages[0].words[0][0]).toBe('MATRICULA');
      expect(res.pages[1].words[0][0]).toBe('40.000');

      // Teste híbrido com novo arquivo onde o banco só tem a página 1 (ex.: nova averbação na pág. 2)
      const kenHibridoPath = path.join(lv2Dir, '00040001.KEN');
      await fs.writeFile(kenHibridoPath, createMinimalTwoPageTiff());
      const hybridResolver = vi.fn(async () => ({
        qtdPaginasBanco: 1,
        pages: new Map<number, [string, number, number, number, number][]>([
          [1, [['MATRICULA', 0.1, 0.05, 0.12, 0.02]]],
        ]),
      }));
      const resHybrid = await extractDocumentOcrPages(kenHibridoPath, {
        pageStart: 1,
        pageEnd: 60,
        siplaniaOcrResolver: hybridResolver,
      });
      expect(resHybrid.pageCount).toBe(2);
      expect(resHybrid.loadedPageStart).toBe(1);
      expect(resHybrid.loadedPageEnd).toBe(1);
      expect(resHybrid.hasMorePages).toBe(true);
    } finally {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('4. searchDocuments inclui matrículas LV2 (.KEN) localizadas via Full-Text SiplanIA', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fiorix-siplania-fts-'));
    try {
      const procDir = path.join(tmpDir, 'PROCESSOS');
      const lv2Block = path.join(tmpDir, 'IMAGENS', 'LV2', '00040000');
      await fs.mkdir(procDir, { recursive: true });
      await fs.mkdir(lv2Block, { recursive: true });
      await fs.writeFile(path.join(lv2Block, '00040000.KEN'), Buffer.from('FAKEKEN'));

      const ftsMock = vi.fn(async () => [40000]);
      const res = await searchDocuments(
        [
          { id: 'processos', path: procDir },
          { id: 'livro2', path: path.join(tmpDir, 'IMAGENS', 'LV2') },
        ],
        'JERONIMO DE MENDONCA 75',
        50,
        { maxEntries: 1000, timeoutMs: 5000 },
        { siplaniaTextSearchResolver: ftsMock },
      );

      expect(ftsMock).toHaveBeenCalledTimes(1);
      expect(res.files.some((f) => f.rootId === 'livro2' && f.name === '00040000.KEN')).toBe(true);
      expect(res.matriculas).toContain('Matrícula nº 40.000');
    } finally {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
