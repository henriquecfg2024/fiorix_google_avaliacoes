import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  classifyDerivadaHeader,
  classifyMatrixOcr,
  extractAgentFromOcr,
  extractBairroFromOcr,
  extractEmpreendimentoFromOcr,
  extractInterestFromOcr,
  extractOpenedRangesFromOcr,
  loadReurbSqlScript,
  resolveReurbSqlPath,
  validateOnrJsonV14,
} from '../reurb-readonly.js';
import { EMBEDDED_REURB_SQL } from '../reurb-sql-embedded.js';
import { recordKey } from '../../services/recordKey.js';

describe('REURB Somente-Leitura & Regras ONR v1.4 (fiorix-connector)', () => {
  it('resolve o arquivo SQL canônico somente-leitura e confirma @ModoCentral + NO WRITE', () => {
    const sqlPath = resolveReurbSqlPath();
    const sql = fs.readFileSync(sqlPath, 'utf8');
    expect(sql).toContain('SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
    expect(sql).toContain('DECLARE @ModoCentral');
    expect(sql).toContain('WHEN e.EhArt69 = 1 THEN N\'3\'');

    expect(EMBEDDED_REURB_SQL).toBe(sql.replace(/^\uFEFF/, ''));
    const loaded = loadReurbSqlScript();
    expect(loaded).toContain('SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED');
    expect(loaded).toContain('DECLARE @ModoCentral');
  });

  it('extrai empreendimento, bairro e agente a partir do texto OCR sem abreviar bairro indevidamente', () => {
    const prenText =
      'R.5/188.228 (PRENOTAÇÃO nº 572.013) - Certidão de Regularização Fundiária (CRF) expedida pela Municipalidade de São Paulo - SEHAB, referente ao núcleo urbano informal denominado "Jardim das Palmeiras", modalidade REURB-S.';
    const matTexto = `IMÓVEL: Terreno urbano situado no bairro JARDIM DAS PALMEIRAS, distrito de Itaquera, São Paulo. ${prenText}`;

    const emp = extractEmpreendimentoFromOcr(matTexto, prenText);
    expect(emp.empreendimentoOcr).toBe('Jardim das Palmeiras');

    const bairro = extractBairroFromOcr(matTexto, prenText);
    expect(bairro.bairroExpresso).toBe('JARDIM DAS PALMEIRAS');

    const agente = extractAgentFromOcr(prenText);
    expect(agente.tipoAgente).toBe(1);
    expect(agente.agente).toBe('MUNICIPALIDADE DE SÃO PAULO');

    const intr = extractInterestFromOcr(prenText, matTexto);
    expect(intr.tipoInteresseOcr).toBe(1);
    expect(intr.temArt69).toBe(false);
  });

  it('extrai bairro com vírgula antes de "Bairro do ..." e enriquece matriz sem OCR próprio a partir da matrícula de origem', () => {
    const origemTexto = `
      LIVRO N.º 2 - REGISTRO GERAL 7.º OFICIAL DE REGISTRO DE IMÓVEIS - matrícula 183.967
      IMOVEL: TERRENO situado nas ruas Mario Ferraz de Souza, Mar de Baffim, Um e Dois, no Sítio dos Cunhas, Bairro do Rodeio, no DISTRITO DE GUAIANAZES, com a seguinte descrição: inicia-se no vértice 01...
      Av. 01, em 19 de Janeiro de 2016 - À vista do Ofício expedido pela Coordenadoria de Regularização Fundiária-CRF da Secretaria Municipal de Habitação-SEHAB da Prefeitura da Capital, referente ao loteamento denominado Vila Paulista I e II, com acesso principal...
    `;

    const bairroOrig = extractBairroFromOcr(origemTexto, '');
    expect(bairroOrig.bairroExpresso).toBe('Rodeio');

    const res = classifyMatrixOcr(
      { Prenotacao: 649975, Matricula: 270002, NegId: 947, Tem71: 0, QtdSeq0: 502 },
      '',
      { matricula: 183967, texto: origemTexto },
    );

    expect(res.Classificacao).toBe('MATRIZ_947');
    expect(res.TemArt69).toBe(false);
    expect(res.TipoInteresseOcr).toBeNull();
    expect(res.BairroExpressoOcr).toBe('Rodeio');
    expect(res.EmpreendimentoOcr).toBe('Vila Paulista I e II');
    expect(res.AgenteOcr).toBe('SECRETARIA MUNICIPAL DA HABITAÇÃO DA PREFEITURA DE SÃO PAULO - SEHAB');
    expect(res.TipoAgenteOcr).toBe(1);
    expect(res.DocumentoOcr).toBe('SiplanIA.matricula 183967 (origem na prot. 649975)');
  });

  it('extrai bairro urbano de cabeçalho IMÓVEL sem palavra literal "bairro" até 30 chars e descarta > 30 chars', () => {
    const fanganielo =
      'IMÓVEL: TERRENO situado nas ruas Alessio Prati (designado Perímetro 11), no Jardim Fanganielo, em GUAIANAZES (CEP: 08450-530), com a seguinte descrição:';
    expect(extractBairroFromOcr(fanganielo, '').bairroExpresso).toBe('Jardim Fanganielo');

    const longo =
      'IMÓVEL: TERRENO situado na rua Um, no Jardim Residencial Muito Extenso Mesmo, em GUAIANAZES (CEP: 08450-530), com a seguinte descrição:';
    expect(extractBairroFromOcr(longo, '').bairroExpresso).toBeNull();

    const lageado =
      'IMÓVEL: TERRENO situado na rua do Folclore e estrada Iguatemi, no Sítio Iguatemi, no Lageado, em GUAIANAZES, com a seguinte descrição:';
    expect(extractBairroFromOcr(lageado, '').bairroExpresso).toBe('Lageado');

    const parteJardim =
      'IMÓVEL: TERRENO com frente para as ruas Manuel Soares Madureira, localizado em parte do Jardim Célia e do Jardim Irene, em GUAIANAZES, com a seguinte descrição:';
    expect(extractBairroFromOcr(parteJardim, '').bairroExpresso).toBe('Jardim Irene');

    const nucleoItaim =
      'IMÓVEL: TERRENO situado nas ruas Francisco Soutomaior, do loteamento denominado Núcleo Itaim, Secção "A", em GUAIANAZES, com a seguinte descrição:';
    expect(extractBairroFromOcr(nucleoItaim, '').bairroExpresso).toBe('Núcleo Itaim');
  });

  it('extrai matrículas derivadas no singular ("FOI ABERTA") e avulsas após faixa ("... e 261.553")', () => {
    const allowed = new Set([261535, 261536, 261537, 261538, 261553]);
    const singular = 'Av. 02 (PRENOTAÇÃO 624.785). FOI ABERTA nesta data a matrícula referente ao lote de terreno, que recebeu o nº 261.538. selo: ABC';
    expect(extractOpenedRangesFromOcr(singular, allowed).map((x) => x.matriculaDerivada)).toEqual([261538]);

    const faixaEAvulsa =
      'Av. 02 (PRENOTAÇÃO 624.785). FORAM ABERTAS nesta data as matrículas referentes aos lotes de terreno e a área remanescente, que receberam os nºs 261.535 a 261.537 (lotes) e 261.553 (área remanescente). selo: DEF';
    expect(
      extractOpenedRangesFromOcr(faixaEAvulsa, allowed)
        .map((x) => x.matriculaDerivada)
        .sort((a, b) => a - b),
    ).toEqual([261535, 261536, 261537, 261553]);
  });

  it('classifica matrícula 947 de Condomínio Urbano Simples encerrado como CONDOMINIO_SIMPLES_INTERMEDIARIO', () => {
    const condSimplesTexto = `
      IMÓVEL: TERRENO situado na rua Andreas de Silva, lote 06, da quadra 10, do Núcleo Urbano denominado "JARDIM BANDEIRANTES", em GUAIANAZES.
      R. 02, em 23 de setembro de 2026- (PRENOTAÇÃO nº 644.587 de 10/09/2026). ... foi destinado ao regime de condomínio, de conformidade com os artigos 61 e 62 da Lei Federal nº 13.465/2017, denominado "CONDOMÍNIO URBANO SIMPLES do Lote 06 da Quadra 10" ...
      Av. 03 - fica ENCERRADA a disponibilidade de área desta matrícula, nos termos do art. 233 da Lei 6.015/73.
    `;
    const res = classifyMatrixOcr(
      { Prenotacao: 644587, Matricula: 266869, NegId: 947, Tem71: 0, QtdSeq0: 1 },
      condSimplesTexto,
    );
    expect(res.Classificacao).toBe('CONDOMINIO_SIMPLES_INTERMEDIARIO');
  });

  it('separa áreas públicas (APM/Via/Institucional) apenas pelo cabeçalho IMÓVEL, sem falso positivo em confrontações', () => {
    const loteHabitacional =
      'IMÓVEL: Lote 12 da quadra B, do núcleo Sítio Conceição, nesta Capital, com a seguinte descrição perimetral: partindo-se do ponto 1, confrontando com APM-1 nos fundos, mede 10,00m.';
    const apmReal =
      'IMÓVEL: Área Pública Municipal APM-1 do parcelamento Sítio Conceição, com a seguinte descrição perimetral: mede 20,00m.';

    const resLote = classifyDerivadaHeader(244294, loteHabitacional);
    expect(resLote.EhAreaPublica).toBe(false);
    expect(resLote.Categoria).toBe('UNIDADE');

    const resApm = classifyDerivadaHeader(244310, apmReal);
    expect(resApm.EhAreaPublica).toBe(true);
    expect(resApm.Categoria).toBe('APM');
  });

  it('separa 947 matriz vs 947 titulação individual e inclui condomínio 616 REURB somente com evidência', () => {
    const res947Ind = classifyMatrixOcr(
      { Prenotacao: 612623, Matricula: 230001, NegId: 947, Tem71: 1, QtdSeq0: 0 },
      'R.2 - PRENOTAÇÃO 612.623 - TITULAÇÃO por legitimação fundiária nos termos do art. 23 da Lei 13.465/2017.',
    );
    expect(res947Ind.Classificacao).toBe('TITULACAO_INDIVIDUAL_947');

    const res616Reurb = classifyMatrixOcr(
      { Prenotacao: 640441, Matricula: 217822, NegId: 616, Tem71: 0, QtdSeq0: 12 },
      'R.8 - PRENOTAÇÃO 640.441 - Instituição de Condomínio proveniente de REURB-E com CRF anexa, Lei 13.465/2017.',
    );
    expect(res616Reurb.Classificacao).toBe('CONDOMINIO_616_REURB');

    const res616Inc = classifyMatrixOcr(
      { Prenotacao: 640442, Matricula: 217823, NegId: 616, Tem71: 0, QtdSeq0: 0 },
      '',
    );
    expect(res616Inc.Classificacao).toBe('CONDOMINIO_616_INCONCLUSIVO');
  });

  it('valida estritamente o Manual ONR v1.4 (aceita quantidadeUnidades != derivadas.length, dataAbertura/dataRegistro null e tipoInteresse 1..3)', () => {
    const okPayload = {
      regularizacoes: [
        {
          matricula: 100000,
          municipio: 'SÃO PAULO',
          distrito: 'ITAQUERA',
          bairro: 'VILA DAS FLORES',
          tipoLocalizacao: 'U',
          quantidadeUnidades: 15,
          dataRegistro: '2025-03-10',
          dataPrenotacao: '2025-03-01',
          tipoInteresse: 1,
          tipoAgente: 1,
          agente: 'PREFEITURA DO MUNICIPIO DE SAO PAULO',
          derivadas: [
            { matricula: 100001, dataAbertura: '2025-03-15', dataRegistro: null, tipoInteresse: 1 },
            { matricula: 100002, dataAbertura: null, dataRegistro: null, tipoInteresse: 2 },
          ],
        },
      ],
    };
    expect(validateOnrJsonV14(okPayload)).toEqual([]);

    const art69Blocked = validateOnrJsonV14({
      regularizacoes: [{ ...okPayload.regularizacoes[0], tipoInteresse: 3 }],
    });
    expect(art69Blocked.some((e) => e.includes('tipoInteresse=3'))).toBe(true);

    const art69Allowed = validateOnrJsonV14(
      {
        regularizacoes: [
          {
            ...okPayload.regularizacoes[0],
            tipoInteresse: 3,
            derivadas: [{ matricula: 100001, dataAbertura: '2025-03-15', dataRegistro: null, tipoInteresse: 3 }],
          },
        ],
      },
      { incluirArt69: true },
    );
    expect(art69Allowed).toEqual([]);

    const emptyDeriv = validateOnrJsonV14({
      regularizacoes: [{ ...okPayload.regularizacoes[0], derivadas: [] }],
    });
    expect(emptyDeriv.some((e) => e.includes('ao menos 1'))).toBe(true);
  });

  it('gera recordKey determinístico para reurb_regularizacoes', () => {
    const k1 = recordKey('reurb_regularizacoes', { prenotacao: 572013, matricula: 188228 });
    const k2 = recordKey('reurb_regularizacoes', { prenotacao: 572013, matricula: 188228 });
    const k3 = recordKey('reurb_regularizacoes', { prenotacao: 572013, matricula: 188229 });
    expect(k1).toBe(k2);
    expect(k1).not.toBe(k3);
  });
});
