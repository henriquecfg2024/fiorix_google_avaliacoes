import { describe, expect, it } from 'vitest';
import { isSameOriginRequest } from '@/lib/documental/origin';
import { documentJobInput } from '@/lib/documental/contracts';
import { converterDataUrlPdfParaBlob, decodificarBase64ParaBytes } from '@/lib/documental/pdfTransfer';

describe('Compatibilidade multi-navegador (Safari, Chrome, Edge, Firefox)', () => {
  it('aceita mesma origem direta e via x-forwarded-host em proxies/Vercel (Safari e Chrome)', () => {
    const reqDireta = new Request('https://fiorix.app/api/gestao-documental', {
      method: 'POST',
      headers: { origin: 'https://fiorix.app' },
    });
    expect(isSameOriginRequest(reqDireta)).toBe(true);

    const reqProxy = new Request('http://internal-pod:3000/api/gestao-documental', {
      method: 'POST',
      headers: {
        origin: 'https://fiorix.app',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'fiorix.app',
      },
    });
    expect(isSameOriginRequest(reqProxy)).toBe(true);
  });

  it('rejeita origem externa, nula ou ausente contra CSRF', () => {
    const reqExterna = new Request('https://fiorix.app/api/gestao-documental', {
      method: 'POST',
      headers: { origin: 'https://atacante.exemplo.com' },
    });
    expect(isSameOriginRequest(reqExterna)).toBe(false);

    const reqNull = new Request('https://fiorix.app/api/gestao-documental', {
      method: 'POST',
      headers: { origin: 'null' },
    });
    expect(isSameOriginRequest(reqNull)).toBe(false);
  });

  it('valida contrato de read_document_chunk com limites de segurança', () => {
    const valido = documentJobInput.safeParse({
      connectorId: 'conn-7ri',
      type: 'read_document_chunk',
      rootId: 'processos',
      relativePath: '2025\\1064788-26.2025.8.26.0100.pdf',
      offset: 0,
      length: 2516582,
    });
    expect(valido.success).toBe(true);

    const traversal = documentJobInput.safeParse({
      connectorId: 'conn-7ri',
      type: 'read_document_chunk',
      rootId: 'processos',
      relativePath: '..\\segredo.pdf',
      offset: 0,
    });
    expect(traversal.success).toBe(false);
  });

  it('converte data:application/pdf;base64 em Blob para renderização nativa no Safari e Chrome', () => {
    const pdfSimples = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF', 'utf8');
    const b64 = pdfSimples.toString('base64');
    const bytes = decodificarBase64ParaBytes(b64);
    expect(Buffer.from(bytes).equals(pdfSimples)).toBe(true);

    const convertido = converterDataUrlPdfParaBlob(`data:application/pdf;base64,${b64}`);
    expect(convertido).not.toBeNull();
    expect(convertido?.blob.type).toBe('application/pdf');
    expect(convertido?.blob.size).toBe(pdfSimples.length);
    if (convertido?.url) URL.revokeObjectURL(convertido.url);
  });
});

