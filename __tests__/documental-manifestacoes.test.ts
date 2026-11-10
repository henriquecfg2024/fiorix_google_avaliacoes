import { describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  isNavPermissionsFeatureEnabled: vi.fn(() => true),
  isRouteAllowedForUser: vi.fn(async () => true),
}));

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: authMocks.requireAuth }));
vi.mock('@/lib/nav-permissions/service', () => ({
  isNavPermissionsFeatureEnabled: authMocks.isNavPermissionsFeatureEnabled,
  isRouteAllowedForUser: authMocks.isRouteAllowedForUser,
}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { isSetorUsucapiao, requireDocumentAccess, requireManifestacaoAccess } from '../src/lib/documental/access';
import { finalizarManifestacaoInput, importarFilaLocalInput, listarManifestacoesQuery, salvarFichaInput } from '../src/lib/documental/contracts';
import { calcularHashManifestacao } from '../src/lib/documental/manifestacoes';
import { fichaIdValido, origemParaApi } from '../src/lib/documental/manifestacoesClient';
import type { MinutaModelo } from '../src/components/documental/FichaOficialView';
import { gerarDocHtmlManifestacao, gerarDocxBytesManifestacao } from '../src/lib/documental/generateManifestacaoWord';

const dados = { id_ficha: 'FICHA-1730000000000', numero_processo: '1012345-67.2024.8.26.0100' };
const textoValido = 'PROCESSO DIGITAL nº 1012345-67.2024.8.26.0100 — texto da manifestação finalizada.';

describe('manifestações: acesso controlado por Permissões de Menu para todos os grupos', () => {
  it('reconhece o departamento com ou sem acento no fallback legado', () => {
    for (const d of ['Usucapião', 'USUCAPIAO', 'Setor de Usucapião', 'usucapiao ']) expect(isSetorUsucapiao(d)).toBe(true);
    for (const d of ['Registro', 'Atendimento', '', null, undefined]) expect(isSetorUsucapiao(d)).toBe(false);
  });

  it('libera acesso para USER (ex.: Ligação Judicial), COLABORADOR e RH quando permitido em Permissões de Menu e bloqueia quando negado', async () => {
    vi.stubEnv('DOCUMENTAL_ENABLED', 'true');
    authMocks.isNavPermissionsFeatureEnabled.mockReturnValue(true);

    for (const role of ['USER', 'COLABORADOR', 'RH']) {
      authMocks.requireAuth.mockResolvedValue({
        id: 'u-1',
        tenantId: 't-1',
        role,
        departamento: 'LIGAÇÃO JUDICIAL',
      });
      authMocks.isRouteAllowedForUser.mockResolvedValue(true);

      await expect(requireDocumentAccess('/gestao-documental')).resolves.toMatchObject({ role });
      await expect(requireManifestacaoAccess()).resolves.toMatchObject({ role });

      authMocks.isRouteAllowedForUser.mockResolvedValue(false);
      await expect(requireDocumentAccess('/gestao-documental')).rejects.toMatchObject({ status: 403 });
      await expect(requireManifestacaoAccess()).rejects.toMatchObject({ status: 403 });
    }
  });
});

describe('manifestações: contratos da API', () => {
  it('aceita salvar na fila e rejeita campos extras ou caminho fora do acervo', () => {
    expect(salvarFichaInput.safeParse({ acao: 'salvar_fila', fichaId: dados.id_ficha, dados }).success).toBe(true);
    expect(salvarFichaInput.safeParse({ acao: 'salvar_fila', fichaId: dados.id_ficha, dados, tenantId: 'outro' }).success).toBe(false);
    expect(salvarFichaInput.safeParse({
      acao: 'salvar_fila', fichaId: dados.id_ficha, dados,
      arquivoOrigem: { name: 'x.pdf', relativePath: '../fora.pdf' },
    }).success).toBe(false);
    expect(salvarFichaInput.safeParse({ acao: 'salvar_fila', fichaId: 'ficha com espaço', dados }).success).toBe(false);
  });

  it('exige texto completo para finalizar e versão anterior em UUID', () => {
    const base = { acao: 'finalizar', fichaId: dados.id_ficha, dados, minuta: {}, textoFinal: textoValido };
    expect(finalizarManifestacaoInput.safeParse(base).success).toBe(true);
    expect(finalizarManifestacaoInput.safeParse({ ...base, textoFinal: 'curto' }).success).toBe(false);
    expect(finalizarManifestacaoInput.safeParse({ ...base, versaoAnteriorId: '1; DROP TABLE x' }).success).toBe(false);
    expect(finalizarManifestacaoInput.safeParse({ ...base, hashSha256: 'forjado' }).success).toBe(false);
  });

  it('limita a importação da fila antiga e valida filtros do histórico', () => {
    const ficha = { fichaId: dados.id_ficha, dados };
    expect(importarFilaLocalInput.safeParse({ acao: 'importar_fila_local', fichas: Array(201).fill(ficha) }).success).toBe(false);
    expect(listarManifestacoesQuery.parse({}).status).toBe('finalizada');
    expect(listarManifestacoesQuery.safeParse({ de: '29/10/2026' }).success).toBe(false);
  });
});

describe('manifestações: utilitários', () => {
  it('calcula o SHA-256 do texto no servidor', () => {
    expect(calcularHashManifestacao('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('envia só os campos aceitos do arquivo de origem', () => {
    const origem = { name: 'peticao.pdf', relativePath: 'PROC\\peticao.pdf', rootId: 'processos', size: 10, modifiedAt: 'x' };
    expect(origemParaApi(origem)).toEqual({ name: 'peticao.pdf', relativePath: 'PROC\\peticao.pdf', rootId: 'processos' });
    expect(origemParaApi({ name: 'a.pdf', relativePath: 'a.pdf', rootId: 'Raiz Inválida' })).toEqual({ name: 'a.pdf', relativePath: 'a.pdf' });
    expect(origemParaApi(null)).toBeNull();
    expect(fichaIdValido('FICHA-123')).toBe(true);
    expect(fichaIdValido('../x')).toBe(false);
  });

  it('gera arquivos .docx e .doc válidos com as edições diretas da tela híbrida', () => {
    const minutaHibrida: MinutaModelo = {
      timbre: {
        numero: '7',
        ordinal: 'SÉTIMO',
        linha1: 'OFICIAL DE REGISTRO',
        linha3: 'DE IMÓVEIS',
        endereco: 'Rua Líbero Badaró, 377 – 12º andar – Centro – CEP 01009-906 – São Paulo – SP',
      },
      cabecalho: {
        processoRotulo: 'PROCESSO DIGITAL nº',
        processoValor: '4152773-45.2026.8.26.0100',
        vara: 'E. 2ª Vara de Registros Públicos da Capital.',
        interessadosRotulo: 'INTERESSADOS:',
        interessadosValor: 'LUCILENE FELIPE DE SENA CARVALHO',
        natureza: 'USUCAPIÃO',
      },
      saudacao: 'Meritíssima Juíza',
      paragrafosAntes: [
        [{ t: 'Parágrafo 1 editado diretamente pelo escrevente na tela híbrida A4.' }],
        [{ t: 'Segundo elementos constantes dos autos, o imóvel consta na ' }, { t: 'Matrícula 11.538', destaque: true }, { t: '.' }],
      ],
      introConfrontacoes: 'Pela planta do Setor Fiscal Municipal do imóvel usucapiendo, verifica-se que o mesmo confronta:',
      confrontacoes: [
        { campo: 'confrontante_lado_direito', rotulo: '– pelo lado direito com', valor: 'lote 11', pontuacao: ';' },
        { campo: 'confrontante_lado_esquerdo', rotulo: '– pelo lado esquerdo com', valor: 'lote 13', pontuacao: ';' },
        { campo: 'confrontante_fundos', rotulo: '– e nos fundos com', valor: 'lote 25', pontuacao: '.' },
      ],
      paragrafosDepois: [
        [{ t: 'Observação adicional inserida antes do fecho.' }],
        [{ t: 'Era o que, respeitosamente, cumpria informar a V. Exa.' }],
      ],
      local: 'São Paulo, 10 de novembro de 2026.',
      assinatura: {
        titulo: 'O Oficial Substituto,',
        nome: 'Ademar Fioranelli',
        cargo: '7º Oficial de Registro de Imóveis da Capital – SP',
      },
    };

    // Verifica geração do arquivo .docx (ZIP válido com assinatura PK\x03\x04)
    const docxBytes = gerarDocxBytesManifestacao(minutaHibrida);
    expect(docxBytes.byteLength).toBeGreaterThan(1000);
    expect(docxBytes[0]).toBe(0x50); // 'P'
    expect(docxBytes[1]).toBe(0x4b); // 'K'
    expect(docxBytes[2]).toBe(0x03);
    expect(docxBytes[3]).toBe(0x04);

    // Verifica geração do arquivo .doc (HTML Word)
    const docHtml = gerarDocHtmlManifestacao(minutaHibrida);
    expect(docHtml).toContain('4152773-45.2026.8.26.0100');
    expect(docHtml).toContain('LUCILENE FELIPE DE SENA CARVALHO');
    expect(docHtml).toContain('Parágrafo 1 editado diretamente pelo escrevente na tela híbrida A4.');
    expect(docHtml).toContain('O Oficial Substituto,');
  });
});
