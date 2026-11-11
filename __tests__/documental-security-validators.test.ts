import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  validarNumeroProcessoCnj,
  validarSqlPmsp,
  validarMatriculaTranscricao,
  ehTrechoRuidoInstitucionalOcr,
  enriquecerEValidarOrigemCampos,
  gerarDiagnosticoSegurancaFormulario,
} from '@/lib/documental/securityValidators';

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
}));

class MockDocumentAccessError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

vi.mock('@/lib/documental/access', () => ({
  requireDocumentAccess: mocks.access,
  DocumentAccessError: MockDocumentAccessError,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(0),
    $executeRaw: vi.fn().mockResolvedValue(1),
    $queryRaw: vi.fn().mockResolvedValue([]),
  },
}));

describe('Validações Matemáticas, Anti-Ruído OCR e Segurança Criptográfica (7º RI-SP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Validação Matemática CNJ (ISO 7064 Mod 97-10 — Resolução CNJ nº 65/2008)', () => {
    it('valida corretamente o processo real 1162956-97.2024.8.26.0100', () => {
      const res = validarNumeroProcessoCnj('1162956-97.2024.8.26.0100');
      expect(res.valido).toBe(true);
      expect(res.digitoInformado).toBe('97');
      expect(res.digitoCalculado).toBe('97');
      expect(res.ano).toBe(2024);
      expect(res.segmentoCodigo).toBe('8');
      expect(res.tribunalCodigo).toBe('26');
      expect(res.foroCodigo).toBe('0100');
      expect(res.formatado).toBe('1162956-97.2024.8.26.0100');
    });

    it('detecta adulteração ou erro de digitação no dígito verificador CNJ', () => {
      const res = validarNumeroProcessoCnj('1162956-42.2024.8.26.0100');
      expect(res.valido).toBe(false);
      expect(res.digitoInformado).toBe('42');
      expect(res.digitoCalculado).toBe('97');
      expect(res.motivo).toContain('exige "97"');
    });

    it('rejeita número de processo com quantidade incorreta de dígitos', () => {
      const res = validarNumeroProcessoCnj('1162956-97.2024');
      expect(res.valido).toBe(false);
      expect(res.motivo).toContain('20 dígitos');
    });
  });

  describe('2. Validação Matemática SQL / IPTU PMSP (Módulo 11 Oficial)', () => {
    it('valida os números SQL reais do cadastro imobiliário de São Paulo', () => {
      const sql1 = validarSqlPmsp('138.331.0003-5');
      expect(sql1.valido).toBe(true);
      expect(sql1.setor).toBe('138');
      expect(sql1.quadra).toBe('331');
      expect(sql1.lote).toBe('0003');
      expect(sql1.dvCalculado).toBe('5');
      expect(sql1.arquivoPlantaKen).toBe('00138331.KEN');

      const sql2 = validarSqlPmsp('138.331.0076-0');
      expect(sql2.valido).toBe(true);
      expect(sql2.dvCalculado).toBe('0');

      const sql3 = validarSqlPmsp('138.331.0051-5');
      expect(sql3.valido).toBe(true);
      expect(sql3.dvCalculado).toBe('5');

      const sql4 = validarSqlPmsp('053.006.0049-0');
      expect(sql4.valido).toBe(true);
      expect(sql4.dvCalculado).toBe('0');
    });

    it('detecta dígito verificador SQL incorreto e sugere o dígito correto', () => {
      const res = validarSqlPmsp('138.331.0003-9');
      expect(res.valido).toBe(false);
      expect(res.dvInformado).toBe('9');
      expect(res.dvCalculado).toBe('5');
      expect(res.formatado).toBe('138.331.0003-5');
    });

    it('calcula o dígito verificador quando o SQL é informado com apenas 10 dígitos', () => {
      const res = validarSqlPmsp('138.331.0003');
      expect(res.valido).toBe(false);
      expect(res.possuiDv).toBe(false);
      expect(res.dvCalculado).toBe('5');
      expect(res.formatado).toBe('138.331.0003-5');
    });
  });

  describe('3. Validação de Matrícula / Transcrição e Endereçamento LV2', () => {
    it('valida Matrícula 76018 e calcula o bloco 00076000\\00076018.KEN', () => {
      const res = validarMatriculaTranscricao('Matrícula 76018');
      expect(res.valido).toBe(true);
      expect(res.tipo).toBe('MATRICULA');
      expect(res.numero).toBe('76018');
      expect(res.pad8).toBe('00076018');
      expect(res.blocoLv2).toBe('00076000');
      expect(res.arquivoKenLv2).toBe('00076018.KEN');
    });
  });

  describe('4. Blindagem Anti-Ruído de Cabeçalho/Rodapé do OCR (e-SAJ / Defensoria)', () => {
    it('intercepta timbres institucionais (Av. Liberdade 32, www.tjsp.jus.br, Foro Central Cível)', () => {
      expect(ehTrechoRuidoInstitucionalOcr('Avenida Liberdade, 32, Centro', 'imovel')).toBe(true);
      expect(ehTrechoRuidoInstitucionalOcr('... iber 32, Cen...', 'rua_olhar_confrontacao')).toBe(true);
      expect(ehTrechoRuidoInstitucionalOcr('...conferida em www.tjsp.jus.br...', 'requerente')).toBe(true);
      expect(ehTrechoRuidoInstitucionalOcr('...FORO CENTRAL CÍVEL...', 'matricula_transcricao')).toBe(true);
      expect(ehTrechoRuidoInstitucionalOcr('...uma sala, uma cozinha...', 'titular_origem')).toBe(true);
    });

    it('substitui trechos contaminados pela validação cruzada dos campos do processo', () => {
      const origensContaminadas = [
        { campo: 'imovel', pagina: 0, trecho: '', confianca: 'baixa' },
        { campo: 'vara', pagina: 1, trecho: '1ª VARA DE REGISTROS PÚBLICOS', confianca: 'alta' },
        { campo: 'rua_olhar_confrontacao', pagina: 1, trecho: 'Avenida Liberdade, 32, Centro', confianca: 'media' },
        { campo: 'cartorio_origem', pagina: 1, trecho: 'Avenida Liberdade, 32, Centro', confianca: 'alta' },
        { campo: 'contribuinte_sql', pagina: 5, trecho: 'totalidade do lote 138.331.0003-5', confianca: 'alta' },
        { campo: 'requerente', pagina: 14, trecho: 'conferida em www.tjsp.jus.br', confianca: 'media' },
        { campo: 'matricula_transcricao', pagina: 1, trecho: 'FORO CENTRAL CÍVEL', confianca: 'media' },
        { campo: 'titular_origem', pagina: 8, trecho: 'uma sala, uma cozinha', confianca: 'alta' },
      ];

      const enriquecidos = enriquecerEValidarOrigemCampos(origensContaminadas, {
        numero_processo: '1162956-97.2024.8.26.0100',
        vara: '1ª Vara de Registros Públicos da Capital',
        requerente: 'MARIA ANTONIA DA CONCEIÇÃO',
        imovel: 'Imóvel situado à R JOAO BODIN, nº 73 (75, 77 E 79A GUAIANAZES) (Lote 0003 da Quadra 331, Setor 138)',
        rua_olhar_confrontacao: 'R JOAO BODIN, nº 73',
        contribuinte_sql: '138.331.0003-5',
        matricula_transcricao: 'Matrícula 76018',
        cartorio_origem: '7º Cartório de Registro de Imóveis da Capital',
        titular_origem: 'CONFRONTANTES TABULARES AGUARDAM',
      });

      expect(enriquecidos).toHaveLength(8);
      for (const item of enriquecidos) {
        expect(item.trecho).not.toMatch(/Liberdade,\s*32/i);
        expect(item.trecho).not.toMatch(/www\.tjsp\.jus\.br/i);
      }

      const campoImovel = enriquecidos.find(c => c.campo === 'imovel');
      expect(campoImovel?.confianca).toBe('alta');
      expect(campoImovel?.trecho).toContain('R JOAO BODIN');

      const campoReq = enriquecidos.find(c => c.campo === 'requerente');
      expect(campoReq?.confianca).toBe('alta');
      expect(campoReq?.ruidoDescartado).toBe(true);
      expect(campoReq?.trecho).toContain('MARIA ANTONIA DA CONCEIÇÃO');
    });

    it('gera diagnóstico de segurança completo do formulário', () => {
      const diag = gerarDiagnosticoSegurancaFormulario({
        numero_processo: '1162956-97.2024.8.26.0100',
        vara: '1ª Vara de Registros Públicos da Capital',
        requerente: 'MARIA ANTONIA DA CONCEIÇÃO',
        imovel: 'Imóvel situado à R JOAO BODIN, nº 73, São Paulo - SP',
        contribuinte_sql: '138.331.0003-5',
        matricula_transcricao: 'Matrícula 76018',
        confrontante_lado_direito: 'com o lote 0076',
        confrontante_lado_esquerdo: 'com o lote 0051',
        confrontante_fundos: 'com o lote 0040',
      });

      expect(diag.score).toBe(100);
      expect(diag.nivel).toBe('MAXIMA');
      expect(diag.regrasValidadas).toBe(6);
    });
  });

  describe('5. Controle de Acesso, CSRF e Selo HMAC-SHA256 em /api/documental/validacao-autenticidade', () => {
    it('bloqueia acesso não autenticado (401) no POST e no GET', async () => {
      mocks.access.mockRejectedValueOnce(new MockDocumentAccessError(401, 'Não autenticado.'));
      const { POST, GET } = await import('@/app/api/documental/validacao-autenticidade/route');

      const reqPost = new NextRequest('http://localhost:3000/api/documental/validacao-autenticidade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          Host: 'localhost:3000',
        },
        body: JSON.stringify({ numero_processo: '1162956-97.2024.8.26.0100' }),
      });
      const resPost = await POST(reqPost);
      expect(resPost.status).toBe(401);

      mocks.access.mockRejectedValueOnce(new MockDocumentAccessError(401, 'Não autenticado.'));
      const reqGet = new NextRequest(
        'http://localhost:3000/api/documental/validacao-autenticidade?id=VAL-TJSP-1',
      );
      const resGet = await GET(reqGet);
      expect(resGet.status).toBe(401);
    });

    it('emite comprovantes assinados com HMAC-SHA256 e bloqueia parâmetros adulterados no GET (403)', async () => {
      mocks.access.mockResolvedValue({
        id: 'user-7ri',
        email: 'henrique@7ri.com.br',
        name: 'Henrique',
        role: 'ADMIN',
        tenantId: 'tenant-7ri',
      });

      const { POST, GET } = await import('@/app/api/documental/validacao-autenticidade/route');

      const reqPost = new NextRequest('http://localhost:3000/api/documental/validacao-autenticidade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'http://localhost:3000',
          Host: 'localhost:3000',
        },
        body: JSON.stringify({
          numero_processo: '1162956-97.2024.8.26.0100',
          vara: '1ª Vara de Registros Públicos da Capital',
          requerente: 'MARIA ANTONIA DA CONCEIÇÃO',
          imovel: 'Imóvel situado à R JOAO BODIN, nº 73',
          contribuinte_sql: '138.331.0003-5',
          matricula_transcricao: 'Matrícula 76018',
        }),
      });

      const resPost = await POST(reqPost);
      expect(resPost.status).toBe(200);
      const payload = await resPost.json();
      expect(payload.sucesso).toBe(true);
      expect(payload.documentos).toHaveLength(5);
      expect(payload.segurancaResumo.cnjValido).toBe(true);
      expect(payload.segurancaResumo.sqlValido).toBe(true);
      expect(payload.segurancaResumo.matriculaValida).toBe(true);

      const docTjsp = payload.documentos[0];
      expect(docTjsp.seloHmac).toMatch(/^[a-f0-9]{64}$/);

      // GET legítimo para ID não em cache mas com seloHmac adulterado -> deve rejeitar com 403
      const reqTampered = new NextRequest(
        `http://localhost:3000/api/documental/validacao-autenticidade?id=ID-NAO-CACHEADO&processo=1162956-97.2024.8.26.0100&orgaoSigla=TJSP&codigo=FORJADO&hash=${docTjsp.hashSha256}&status=AUTENTICIDADE_CONFIRMADA&seloHmac=${docTjsp.seloHmac}`,
      );
      const resTampered = await GET(reqTampered);
      expect(resTampered.status).toBe(403);

      // GET legítimo do comprovante emitido -> retorna PDF válido
      const reqValidPdf = new NextRequest(
        `http://localhost:3000/api/documental/validacao-autenticidade?id=${encodeURIComponent(docTjsp.id)}&processo=1162956-97.2024.8.26.0100`,
      );
      const resPdf = await GET(reqValidPdf);
      expect(resPdf.status).toBe(200);
      expect(resPdf.headers.get('Content-Type')).toBe('application/pdf');
    });
  });
});
