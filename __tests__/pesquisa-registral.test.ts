import { beforeEach, describe, expect, it } from 'vitest';
import {
  aplicarSubstituicaoFoneticaLike,
  executarPesquisaRegistralHibridaReadOnly,
  extrairMatriculaOrigemCitada,
  formatarContribuinteSp,
  formatarDocumentoCpfCnpj,
  isSqlPermissionDenied229,
  listarCatalogosPesquisaRegistralReadOnly,
  montarCriterioSiplanIaParaImovel,
  montarFiltroNomeSql,
  resetPesquisaRegistralForTests,
} from '../src/db/pesquisa-registral-readonly.js';

describe('Pesquisa Registral Híbrida Somente-Leitura (WEBRI + SiplanIA)', () => {
  beforeEach(() => {
    resetPesquisaRegistralForTests();
  });

  it('formata Contribuinte SP (SQL) e CPF/CNPJ mantendo valores já formatados', () => {
    expect(formatarContribuinteSp('03110801450')).toBe('031.108.0145-0');
    expect(formatarContribuinteSp('031.108.0145-0')).toBe('031.108.0145-0');
    expect(formatarContribuinteSp('')).toBeNull();

    expect(formatarDocumentoCpfCnpj('21265873801')).toBe('212.658.738-01');
    expect(formatarDocumentoCpfCnpj('12345678000199')).toBe('12.345.678/0001-99');
    expect(formatarDocumentoCpfCnpj('12.917.701-SSP/SP')).toBe('12.917.701-SSP/SP');
  });

  it('extrai matrícula de origem citada em Inf.Adicionais quando registro estiver sem vínculo', () => {
    expect(extrairMatriculaOrigemCitada('Com origem na Matrícula nº 33.605 desta Serventia')).toBe(33605);
    expect(extrairMatriculaOrigemCitada('Originada da Matricula 40000 - Bloco A6')).toBe(40000);
    expect(extrairMatriculaOrigemCitada('Sem indicação numérica')).toBeNull();
  });

  it('aplica substituição fonética segura mantendo prefixo indexável e gera cláusulas corretas nos 5 modos de nome', () => {
    const fonetica = aplicarSubstituicaoFoneticaLike('Sylvia 100%');
    expect(fonetica).toContain('S[IÍÌÎÏY]L[WV][IÍÌÎÏY][AÁÀÂÃÄ]');
    expect(fonetica).toContain('[%]');

    expect(montarFiltroNomeSql('MARIA SILVA', 'exata', false)).toEqual({
      sqlClause: 'p.Nome = @NomeExato',
      params: { NomeExato: 'MARIA SILVA' },
    });
    expect(montarFiltroNomeSql('JOAO', 'comecar_com', false)).toEqual({
      sqlClause: 'p.Nome LIKE @NomePrefix',
      params: { NomePrefix: 'JOAO%' },
    });
    const primSob = montarFiltroNomeSql('FLAVIO TADEU MOREIRA DA SILVA', 'primeiro_sobrenome', false);
    expect(primSob?.sqlClause).toContain('@PrimeiroPrefix');
    expect(primSob?.params.PrimeiroPrefix).toBe('FLAVIO%');
    expect(primSob?.params.UltimoMidPattern).toBe('% SILVA %');
    expect(primSob?.params.UltimoEndPattern).toBe('% SILVA');

    expect(montarFiltroNomeSql('MENDONCA', 'sobrenome', false)?.params.SobrenomePattern).toBe('% MENDONCA%');
    expect(montarFiltroNomeSql('TADEU', 'qualquer_parte', false)?.params.QualquerPattern).toBe('%TADEU%');
  });

  it('monta critério textual limpo para o SiplanIA a partir dos filtros de Imóvel', () => {
    expect(
      montarCriterioSiplanIaParaImovel({
        logradouro: 'Jerônimo de Mendonça',
        numero: '165',
        edificioCondominio: 'Conjunto Residencial da Mooca',
      }),
    ).toBe('Jerônimo de Mendonça 165 Conjunto Residencial da Mooca');

    expect(montarCriterioSiplanIaParaImovel({ contribuinte: '03110801450' })).toBe('031.108.0145-0');
    expect(montarCriterioSiplanIaParaImovel({ cep: '03189050' })).toBe('03189-050');
  });

  it('identifica corretamente erro SQL 229 (SELECT permission denied) inclusive em precedingErrors', () => {
    expect(isSqlPermissionDenied229({ number: 229 })).toBe(true);
    expect(isSqlPermissionDenied229({ precedingErrors: [{ originalError: { info: { number: 229 } } }] })).toBe(true);
    expect(isSqlPermissionDenied229({ message: 'The SELECT permission was denied on object tblWRIPessoas' })).toBe(true);
    expect(isSqlPermissionDenied229({ number: 1222, message: 'Lock request time out period exceeded' })).toBe(false);
  });

  it('retorna catálogos canônicos padrão fora do banco e exige ao menos um filtro na busca', async () => {
    const cat = await listarCatalogosPesquisaRegistralReadOnly();
    expect(cat.origemBanco).toBe('padrao');
    expect(cat.livros.some((l) => l.id === 2 && l.sigla === 'LV2')).toBe(true);
    expect(cat.tiposImovel.length).toBeGreaterThan(3);

    await expect(
      executarPesquisaRegistralHibridaReadOnly({ aba: 'imovel', filtrosImovel: {} }),
    ).rejects.toThrow(/Informe ao menos um campo/);
    await expect(
      executarPesquisaRegistralHibridaReadOnly({ aba: 'propriedade', filtrosPropriedade: {} }),
    ).rejects.toThrow(/Informe ao menos o nº do livro/);
  });
});
