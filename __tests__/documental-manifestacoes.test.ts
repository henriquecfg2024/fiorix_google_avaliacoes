import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: vi.fn() }));
vi.mock('@/lib/nav-permissions/service', () => ({ isRouteAllowedForUser: vi.fn(async () => true) }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { isSetorUsucapiao } from '../src/lib/documental/access';
import { finalizarManifestacaoInput, importarFilaLocalInput, listarManifestacoesQuery, salvarFichaInput } from '../src/lib/documental/contracts';
import { calcularHashManifestacao } from '../src/lib/documental/manifestacoes';
import { fichaIdValido, origemParaApi } from '../src/lib/documental/manifestacoesClient';

const dados = { id_ficha: 'FICHA-1730000000000', numero_processo: '1012345-67.2024.8.26.0100' };
const textoValido = 'PROCESSO DIGITAL nº 1012345-67.2024.8.26.0100 — texto da manifestação finalizada.';

describe('manifestações: acesso do setor de Usucapião', () => {
  it('reconhece o departamento com ou sem acento', () => {
    for (const d of ['Usucapião', 'USUCAPIAO', 'Setor de Usucapião', 'usucapiao ']) expect(isSetorUsucapiao(d)).toBe(true);
    for (const d of ['Registro', 'Atendimento', '', null, undefined]) expect(isSetorUsucapiao(d)).toBe(false);
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
});
