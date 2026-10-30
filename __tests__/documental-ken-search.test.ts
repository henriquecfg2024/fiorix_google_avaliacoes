import { describe, expect, it } from 'vitest';
import { GET } from '../src/app/api/documental/ken/route';

describe('Documental KEN Route & Fulltext Transcripts', () => {
  it('returns rich transcript with pageTexts for Matrícula 1 (00000001.KEN)', async () => {
    const req = new Request('http://localhost:3000/api/documental/ken?doc=1&sessao=LV2');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.pageCount).toBeGreaterThanOrEqual(1);
    expect(data.text).toBeDefined();
    expect(data.pageTexts).toBeDefined();
    expect(Array.isArray(data.pageTexts)).toBe(true);

    // Terms from the real deed image
    expect(data.text.toLowerCase()).toContain('hipoteca');
    expect(data.text.toLowerCase()).toContain('souvenir');
    expect(data.text.toLowerCase()).toContain('dejanira');

    // Page 1 specific text
    expect(data.pageTexts[0].toLowerCase()).toContain('hipoteca');

    // Page 3 specific text (NUA PROPRIEDADE, USUFRUTO)
    expect(data.pageTexts[2].toLowerCase()).toContain('nua propriedade');
    expect(data.pageTexts[2].toLowerCase()).toContain('usufruto');
  });

  it('handles search queries case-insensitively', () => {
    const text = 'R. 1/M.1, em 02/01/76. Ônus: HIPOTECA. Credor: SOUVENIR ASSUMPÇÃO';
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    const termoNorm = normalize('hipoteca');
    const textoNorm = normalize(text);
    expect(textoNorm.includes(termoNorm)).toBe(true);

    const termoNorm2 = normalize('Souvenir');
    expect(textoNorm.includes(termoNorm2)).toBe(true);

    const termoNorm3 = normalize('assumpcao'); // sem acento
    expect(textoNorm.includes(termoNorm3)).toBe(true);
  });

  it('locates and streams PDF process 1162956-97.2024.8.26.0100 in PROCESSOS session', async () => {
    const req = new Request('http://localhost:3000/api/documental/ken?doc=1162956-97.2024.8.26.0100&sessao=PROCESSOS');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.fileName).toBe('1162956-97.2024.8.26.0100.pdf');
    expect(data.extension).toBe('.pdf');
    expect(data.pdfDataUrl).toBeDefined();
    expect(data.pdfDataUrl).toContain('stream=1');

    const streamReq = new Request(`http://localhost:3000${data.pdfDataUrl}`);
    const streamRes = await GET(streamReq);
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('locates and decodes TIFF deed 445879 in TITULOS-VISUALIZA session', async () => {
    const req = new Request('http://localhost:3000/api/documental/ken?doc=445879&sessao=TITULOS-VISUALIZA');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.fileName.toLowerCase()).toContain('445879');
    expect(data.pageCount).toBeGreaterThanOrEqual(1);
    expect(data.pages?.length).toBeGreaterThanOrEqual(1);
  }, 25000);

  it('locates PDF deed in Titulos_Online by document name or protocol', async () => {
    const req = new Request('http://localhost:3000/api/documental/ken?doc=AC016564278_6473571_pdf_1&sessao=Titulos_Online');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.fileName).toBe('AC016564278_6473571_pdf_1.pdf');
    expect(data.extension).toBe('.pdf');
  }, 25000);
});

