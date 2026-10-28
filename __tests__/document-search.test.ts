import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  enrichPetitionData,
  executeDocumentCli,
  extrairConfrontacoes,
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

  it('infers and auto-suggests subdistrito, cartório, escrevente and buscas via enrichPetitionData', () => {
    // 1. Property in Guaianazes in CFALANGA folder
    const dataGuaianazes = {
      imovel: 'Rua Evaldo Calabrez, nº 1413, Guaianazes, São Paulo/SP',
      matricula_transcricao: 'Matrícula nº 123.456',
    };
    const enriched1 = enrichPetitionData(dataGuaianazes, 'CFALANGA/0000001-00.2099.docx');
    expect(enriched1.subdistrito).toBe('GUAIANAZES');
    expect(enriched1.cartorio_encaminhamento).toBe('9º Oficial de Registro de Imóveis da Capital');
    expect(enriched1.resultado_buscas).toBe('NEGATIVAS');
    expect(enriched1.escrevente_pasta).toBe('CFALANGA');

    // 2. Property in Mooca with explicit 3º CRI mention in text
    const dataMooca = {
      imovel: 'Rua da Mooca, nº 500, Mooca',
      anotacoes_ficha_oficial: 'Conforme certidão expedida pelo 3º Oficial de Registro de Imóveis',
    };
    const enriched2 = enrichPetitionData(dataMooca, 'Bruno/processo-mooca.pdf');
    expect(enriched2.subdistrito).toBe('MOÓCA');
    expect(enriched2.cartorio_encaminhamento).toBe('3º Oficial de Registro de Imóveis da Capital');
    expect(enriched2.resultado_buscas).toBe('NEGATIVAS');
    expect(enriched2.escrevente_pasta).toBe('BRUNO');

    // 3. Property with positive buscas and 7º RI registration
    const data7RI = {
      imovel: 'Rua Cavalheiro, nº 200, Brás',
      anotacoes_ficha_oficial: 'buscas resultaram positivas com matrícula ativa no 7º',
    };
    const enriched3 = enrichPetitionData(data7RI, 'DIEGO/usucapiao-bras.docx');
    expect(enriched3.subdistrito).toBe('BRÁS');
    expect(enriched3.resultado_buscas).toBe('POSITIVAS');
    expect(enriched3.escrevente_pasta).toBe('DIEGO');
  });

  it('extracts and cleans confrontations from matrícula and petition texts', () => {
    // 1. Text from plant / standard usucapiao minuta
    const textPlant = 'Pela planta do Setor Fiscal Municipal do imóvel usucapiendo, verifica-se que o mesmo confronta pelo lado direito com o nº 1405, pelo lado esquerdo com o nº 1421 e aos fundos com área municipal.';
    const conf1 = extrairConfrontacoes(textPlant);
    expect(conf1.ladoDireito).toBe('com o nº 1405');
    expect(conf1.ladoEsquerdo).toBe('com o nº 1421');
    expect(conf1.fundos).toBe('com área municipal');

    // 2. Text from petition
    const textPetition = 'Confrontantes: do lado direito com Pedro Silveira, esquerdo com Ana Clara Lima e fundos com área municipal.';
    const conf2 = extrairConfrontacoes(textPetition);
    expect(conf2.ladoDireito).toBe('com Pedro Silveira');
    expect(conf2.ladoEsquerdo).toBe('com Ana Clara Lima');
    expect(conf2.fundos).toBe('com área municipal');

    // 3. Tabular / multi-line matrícula format
    const textMatricula = 'Matrícula nº 123.456 - Confrontações:\n- Lado direito: com o imóvel transcrito sob nº 45.123;\n- Lado esquerdo: com a Rua B;\n- Fundos: com espólio de João Silva.';
    const conf3 = extrairConfrontacoes(textMatricula);
    expect(conf3.ladoDireito).toBe('com o imóvel transcrito sob nº 45.123');
    expect(conf3.ladoEsquerdo).toBe('com a Rua B');
    expect(conf3.fundos).toBe('com espólio de João Silva');

    // 4. enrichPetitionData automatically populates confrontations
    const enriched = enrichPetitionData({
      imovel: 'Rua Evaldo Calabrez, nº 1413, confronta pelo lado direito com o nº 1405, pelo lado esquerdo com o nº 1421 e aos fundos com área municipal',
    });
    expect(enriched.confrontante_lado_direito).toBe('com o nº 1405');
    expect(enriched.confrontante_lado_esquerdo).toBe('com o nº 1421');
    expect(enriched.confrontante_fundos).toBe('com área municipal');
  });

  it('detects and brings matricula automatically in search results', async () => {
    const dir = await fixture();
    const filePath = path.join(dir, 'Usucapiao 0000001-00.2099 manifestacao FICTICIA.txt');
    await fs.writeFile(
      filePath,
      'Processo 0000001-00.2099\nO imóvel usucapiendo encontra-se registrado sob a Matrícula nº 123.456 em nome de PESSOA INCERTA.'
    );

    const roots = [{ id: 'usucapiao', path: dir }];
    const result = await searchDocuments(roots, '0000001');

    expect(result.files).toHaveLength(1);
    expect(result.files[0].matricula).toBe('Matrícula nº 123.456');
    expect(result.matriculaDetectada).toBe('Matrícula nº 123.456');
    expect(result.matriculas).toContain('Matrícula nº 123.456');
  });
});

