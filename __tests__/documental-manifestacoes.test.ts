import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  isNavPermissionsFeatureEnabled: vi.fn(() => true),
  isRouteAllowedForUser: vi.fn(async () => true),
}));

const prismaMocks = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $executeRawUnsafe: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock('@/lib/auth-helpers', () => ({ requireAuth: authMocks.requireAuth }));
vi.mock('@/lib/nav-permissions/service', () => ({
  isNavPermissionsFeatureEnabled: authMocks.isNavPermissionsFeatureEnabled,
  isRouteAllowedForUser: authMocks.isRouteAllowedForUser,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: prismaMocks,
}));

import {
  canUserConferirManifestacao,
  isSetorUsucapiao,
  requireArquivoManifestacaoAccess,
  requireDocumentAccess,
  requireManifestacaoAccess,
} from '../src/lib/documental/access';
import {
  conferirFichaInput,
  finalizarManifestacaoInput,
  importarFilaLocalInput,
  listarManifestacoesQuery,
  salvarFichaInput,
} from '../src/lib/documental/contracts';
import {
  calcularHashManifestacao,
  conferirFichaManifestacao,
  finalizarManifestacao,
  listarManifestacoes,
  obterManifestacao,
  salvarFichaEmConferencia,
} from '../src/lib/documental/manifestacoes';
import {
  POR_PAGINA_ARQUIVO,
  carregarFilaConferencia,
  fichaIdValido,
  formatarDataHora,
  listarArquivoManifestacoes,
  origemParaApi,
} from '../src/lib/documental/manifestacoesClient';
import type { MinutaModelo } from '../src/components/documental/FichaOficialView';
import {
  gerarDocHtmlManifestacao,
  gerarDocxBytesManifestacao,
} from '../src/lib/documental/generateManifestacaoWord';
import { NAV_CATALOG_GROUPS } from '../src/lib/nav-permissions/catalog';
import { navigationGroups } from '../src/components/fiorix/navigation';

const dados = {
  id_ficha: 'FICHA-1730000000000',
  numero_processo: '1012345-67.2024.8.26.0100',
  requerente: 'JOÃO DA SILVA',
  matricula_transcricao: 'Matrícula 12.808',
};
const textoValido =
  'PROCESSO DIGITAL nº 1012345-67.2024.8.26.0100 — texto completo da manifestação finalizada após a Etapa 2.';

beforeEach(() => {
  vi.clearAllMocks();
  prismaMocks.$transaction.mockImplementation(async (cb: (tx: typeof prismaMocks) => unknown) =>
    cb(prismaMocks),
  );
  prismaMocks.$executeRaw.mockResolvedValue(1);
  prismaMocks.$executeRawUnsafe.mockResolvedValue(1);
});

describe('manifestações: posição e navegação da aba ARQUIVO e ANDAMENTOS', () => {
  it('mantém a ordem exata: MANIFESTAÇÕES | VISUALIZADOR | EM CONFERÊNCIA | ARQUIVO | ANDAMENTOS', () => {
    const grupoDoc = navigationGroups.documental;
    expect(grupoDoc).toBeDefined();
    expect(grupoDoc.items.map(i => ({ label: i.label, href: i.href }))).toEqual([
      { label: 'MANIFESTAÇÕES', href: '/gestao-documental' },
      { label: 'VISUALIZADOR', href: '/gestao-documental/visualizador' },
      { label: 'EM CONFERÊNCIA', href: '/gestao-documental/conferencia' },
      { label: 'ARQUIVO', href: '/gestao-documental/arquivo' },
      { label: 'ANDAMENTOS', href: '/gestao-documental/historico' },
    ]);

    const catalogoDoc = NAV_CATALOG_GROUPS.find(g => g.id === 'documental');
    expect(catalogoDoc).toBeDefined();
    expect(catalogoDoc!.items.map(i => i.href)).toEqual([
      '/gestao-documental',
      '/gestao-documental/visualizador',
      '/gestao-documental/conferencia',
      '/gestao-documental/arquivo',
      '/gestao-documental/historico',
    ]);
  });
});

describe('manifestações: acesso controlado e permissões por perfil', () => {
  it('reconhece o departamento com ou sem acento no fallback legado', () => {
    for (const d of ['Usucapião', 'USUCAPIAO', 'Setor de Usucapião', 'usucapiao ']) {
      expect(isSetorUsucapiao(d)).toBe(true);
    }
    for (const d of ['Registro', 'Atendimento', '', null, undefined]) {
      expect(isSetorUsucapiao(d)).toBe(false);
    }
  });

  it('permite marcar/alterar conferência oficial somente para ADMIN, MASTER e SUBSTITUTO', () => {
    for (const role of ['ADMIN', 'MASTER', 'SUBSTITUTO', 'substituto']) {
      expect(canUserConferirManifestacao(role)).toBe(true);
    }
    for (const role of ['USER', 'COLABORADOR', 'VISITANTE', 'RH', '', null, undefined]) {
      expect(canUserConferirManifestacao(role)).toBe(false);
    }
  });

  it('libera acesso para /gestao-documental e /gestao-documental/arquivo quando autorizado e bloqueia quando negado', async () => {
    vi.stubEnv('DOCUMENTAL_ENABLED', 'true');
    authMocks.isNavPermissionsFeatureEnabled.mockReturnValue(true);

    for (const role of ['USER', 'COLABORADOR', 'RH', 'SUBSTITUTO', 'ADMIN', 'MASTER']) {
      authMocks.requireAuth.mockResolvedValue({
        id: 'u-1',
        tenantId: 't-1',
        role,
        departamento: 'LIGAÇÃO JUDICIAL',
      });
      authMocks.isRouteAllowedForUser.mockResolvedValue(true);

      await expect(requireDocumentAccess('/gestao-documental')).resolves.toMatchObject({ role });
      await expect(requireDocumentAccess('/gestao-documental/arquivo')).resolves.toMatchObject({
        role,
      });
      await expect(requireArquivoManifestacaoAccess()).resolves.toMatchObject({ role });
      await expect(requireManifestacaoAccess()).resolves.toMatchObject({ role });

      authMocks.isRouteAllowedForUser.mockResolvedValue(false);
      await expect(requireDocumentAccess('/gestao-documental')).rejects.toMatchObject({
        status: 403,
      });
      await expect(requireArquivoManifestacaoAccess()).rejects.toMatchObject({ status: 403 });
      await expect(requireManifestacaoAccess()).rejects.toMatchObject({ status: 403 });
    }
  });
});

describe('manifestações: contratos da API e bloqueios de entrada', () => {
  it('aceita salvar na fila e rejeita campos extras ou caminho fora do acervo', () => {
    expect(salvarFichaInput.safeParse({ acao: 'salvar_fila', fichaId: dados.id_ficha, dados }).success).toBe(true);
    expect(salvarFichaInput.safeParse({ acao: 'salvar_fila', fichaId: dados.id_ficha, dados, tenantId: 'outro' }).success).toBe(false);
    expect(
      salvarFichaInput.safeParse({
        acao: 'salvar_fila',
        fichaId: dados.id_ficha,
        dados,
        arquivoOrigem: { name: 'x.pdf', relativePath: '../fora.pdf' },
      }).success,
    ).toBe(false);
    expect(salvarFichaInput.safeParse({ acao: 'salvar_fila', fichaId: 'ficha com espaço', dados }).success).toBe(false);
  });

  it('exige confirmouImpressao === true, texto completo e versão anterior em UUID para finalizar Etapa 2', () => {
    const base = {
      acao: 'finalizar',
      fichaId: dados.id_ficha,
      dados,
      minuta: {},
      textoFinal: textoValido,
      confirmouImpressao: true,
    };
    expect(finalizarManifestacaoInput.safeParse(base).success).toBe(true);
    // Bloqueia quando confirmouImpressao está ausente ou false
    expect(finalizarManifestacaoInput.safeParse({ ...base, confirmouImpressao: false }).success).toBe(false);
    const { confirmouImpressao: _omit, ...semConfirmacao } = base;
    expect(finalizarManifestacaoInput.safeParse(semConfirmacao).success).toBe(false);
    expect(finalizarManifestacaoInput.safeParse({ ...base, textoFinal: 'curto' }).success).toBe(false);
    expect(finalizarManifestacaoInput.safeParse({ ...base, versaoAnteriorId: '1; DROP TABLE x' }).success).toBe(false);
    expect(finalizarManifestacaoInput.safeParse({ ...base, hashSha256: 'forjado' }).success).toBe(false);
  });

  it('valida payload de conferência e filtros de listagem', () => {
    expect(
      conferirFichaInput.safeParse({
        acao: 'conferir_ficha',
        registroId: '550e8400-e29b-41d4-a716-446655440000',
        statusConferencia: 'CONFERIDO',
      }).success,
    ).toBe(true);
    const ficha = { fichaId: dados.id_ficha, dados };
    expect(importarFilaLocalInput.safeParse({ acao: 'importar_fila_local', fichas: Array(201).fill(ficha) }).success).toBe(false);
    expect(listarManifestacoesQuery.parse({}).status).toBe('finalizada');
    expect(listarManifestacoesQuery.safeParse({ de: '29/10/2026' }).success).toBe(false);
  });
});

describe('manifestações: regras de servidor (conferência, finalização Etapa 2, imutabilidade e isolamento)', () => {
  it('bloqueia conferência por usuário sem permissão (ex.: USER ou COLABORADOR) mesmo por chamada direta', async () => {
    await expect(
      conferirFichaManifestacao(
        'tenant-7ri',
        { id: 'u-esc', name: 'Escrevente', role: 'USER' },
        '550e8400-e29b-41d4-a716-446655440000',
        'CONFERIDO',
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(prismaMocks.$executeRaw).not.toHaveBeenCalled();
  });

  it('mantém procedimento apenas conferido com status = conferencia (não arquiva forçadamente antes da Etapa 2)', async () => {
    const regId = '550e8400-e29b-41d4-a716-446655440000';
    prismaMocks.$queryRaw
      .mockResolvedValueOnce([
        {
          id: regId,
          status: 'conferencia',
          dados: { ...dados, status_conferencia: 'AGUARDANDO_CONFERENCIA' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: regId,
          fichaId: dados.id_ficha,
          status: 'conferencia',
          versao: 1,
          versaoAnteriorId: null,
          numeroProcesso: dados.numero_processo,
          requerente: dados.requerente,
          matricula: dados.matricula_transcricao,
          subdistrito: 'ALTO DA MOÓCA',
          escrevente: 'CFALANGA',
          imovel: 'Rua Teste, 10',
          conferidoPorNome: 'Dr. Substituto',
          conferidoEm: '2026-11-11T13:00:00.000Z',
          criadoPorNome: 'Escrevente',
          atualizadoPorNome: 'Dr. Substituto',
          finalizadoPorNome: null,
          hashSha256: null,
          createdAt: new Date('2026-11-11T12:00:00.000Z'),
          updatedAt: new Date('2026-11-11T13:00:00.000Z'),
          finalizadoEm: null,
          dados: {
            ...dados,
            status_conferencia: 'CONFERIDO',
            conferido_por_nome: 'Dr. Substituto',
            conferido_em: '2026-11-11T13:00:00.000Z',
          },
          arquivoOrigem: null,
          minuta: null,
          textoFinal: null,
        },
      ]);

    const resultado = await conferirFichaManifestacao(
      'tenant-7ri',
      { id: 'u-sub', name: 'Dr. Substituto', role: 'SUBSTITUTO' },
      regId,
      'CONFERIDO',
    );
    expect(resultado.status).toBe('conferencia');
    expect((resultado.dados as Record<string, unknown>).status_conferencia).toBe('CONFERIDO');
  });

  it('bloqueia finalização da Etapa 2 sem confirmação de impressão ou sem conferência concluída', async () => {
    // 1. Sem confirmação de impressão
    await expect(
      finalizarManifestacao(
        'tenant-7ri',
        { id: 'u-esc', name: 'Escrevente', role: 'USER' },
        {
          fichaId: dados.id_ficha,
          dados: { ...dados, status_conferencia: 'CONFERIDO' },
          minuta: { cabecalho: {} },
          textoFinal: textoValido,
          confirmouImpressao: false,
        },
      ),
    ).rejects.toMatchObject({ status: 400 });

    // 2. Com confirmação de impressão, mas ficha no banco ainda está AGUARDANDO_CONFERENCIA
    prismaMocks.$queryRaw
      .mockResolvedValueOnce([]) // checagem de duplicidade em finalizada
      .mockResolvedValueOnce([
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          dados: { ...dados, status_conferencia: 'AGUARDANDO_CONFERENCIA' },
        },
      ]);

    await expect(
      finalizarManifestacao(
        'tenant-7ri',
        { id: 'u-esc', name: 'Escrevente', role: 'USER' },
        {
          fichaId: dados.id_ficha,
          dados: { ...dados, status_conferencia: 'AGUARDANDO_CONFERENCIA' },
          minuta: { cabecalho: {} },
          textoFinal: textoValido,
          confirmouImpressao: true,
        },
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('evita arquivamento duplicado em cliques repetidos e preserva documentos sem fabricar autor/data de conferência ausentes', async () => {
    const idExistente = '550e8400-e29b-41d4-a716-446655440001';
    // Simula ficha já conferida no banco, porém sem conferido_por_nome nem conferido_em (ex.: registro legado)
    prismaMocks.$queryRaw
      .mockResolvedValueOnce([]) // ainda não finalizada
      .mockResolvedValueOnce([
        {
          id: idExistente,
          dados: { ...dados, status_conferencia: 'CONFERIDO' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: idExistente,
          fichaId: dados.id_ficha,
          status: 'finalizada',
          versao: 1,
          versaoAnteriorId: null,
          numeroProcesso: dados.numero_processo,
          requerente: dados.requerente,
          matricula: dados.matricula_transcricao,
          subdistrito: 'ALTO DA MOÓCA',
          escrevente: 'CFALANGA',
          imovel: 'Rua Farol Paulistano, 63',
          conferidoPorNome: null,
          conferidoEm: null,
          criadoPorNome: 'Escrevente',
          atualizadoPorNome: 'Escrevente Finalizador',
          finalizadoPorNome: 'Escrevente Finalizador',
          hashSha256: calcularHashManifestacao(textoValido),
          createdAt: new Date('2026-11-11T12:00:00.000Z'),
          updatedAt: new Date('2026-11-11T14:00:00.000Z'),
          finalizadoEm: new Date('2026-11-11T14:00:00.000Z'),
          dados: {
            ...dados,
            status_conferencia: 'CONFERIDO',
            conferido_por_nome: null,
            conferido_em: null,
            impressao_confirmada: true,
          },
          arquivoOrigem: { name: 'autos.pdf', relativePath: 'PROC/autos.pdf', rootId: 'processos' },
          minuta: { cabecalho: { processoValor: dados.numero_processo } },
          textoFinal: textoValido,
        },
      ]);

    const finalizada = await finalizarManifestacao(
      'tenant-7ri',
      { id: 'u-esc', name: 'Escrevente Finalizador', role: 'USER' },
      {
        fichaId: dados.id_ficha,
        dados: { ...dados, status_conferencia: 'CONFERIDO' },
        arquivoOrigem: { name: 'autos.pdf', relativePath: 'PROC/autos.pdf', rootId: 'processos' },
        minuta: { cabecalho: { processoValor: dados.numero_processo } },
        textoFinal: textoValido,
        confirmouImpressao: true,
      },
    );

    expect(finalizada.status).toBe('finalizada');
    expect(finalizada.conferidoPorNome).toBeNull();
    expect(finalizada.conferidoEm).toBeNull();
    expect(finalizada.finalizadoPorNome).toBe('Escrevente Finalizador');

    // Verifica que o JSON gravado no UPDATE não fabricou conferido_por_nome nem conferido_em
    const chamadaUpdate = prismaMocks.$executeRaw.mock.calls.find(call => {
      const sqlParts = Array.isArray(call[0]) ? call[0].join(' ') : String(call[0]?.strings?.join(' ') || '');
      return sqlParts.includes('UPDATE "DocumentManifestacao"');
    });
    expect(chamadaUpdate).toBeDefined();
    const jsonGravado = JSON.parse(String(chamadaUpdate![3]));
    expect(jsonGravado.conferido_por_nome).toBeNull();
    expect(jsonGravado.conferido_em).toBeNull();
    expect(jsonGravado.impressao_confirmada).toBe(true);
    expect(jsonGravado.impressao_confirmada_por_nome).toBe('Escrevente Finalizador');

    // Segunda chamada repetida para a mesma ficha retorna o registro já arquivado sem executar novo UPDATE/INSERT
    prismaMocks.$executeRaw.mockClear();
    prismaMocks.$queryRaw
      .mockResolvedValueOnce([{ id: idExistente }]) // jaArquivada encontrada
      .mockResolvedValueOnce([finalizada]);

    const repetida = await finalizarManifestacao(
      'tenant-7ri',
      { id: 'u-esc', name: 'Escrevente Finalizador', role: 'USER' },
      {
        fichaId: dados.id_ficha,
        dados: { ...dados, status_conferencia: 'CONFERIDO' },
        minuta: { cabecalho: { processoValor: dados.numero_processo } },
        textoFinal: textoValido,
        confirmouImpressao: true,
      },
    );
    expect(repetida.id).toBe(idExistente);
    // Apenas o pg_advisory_xact_lock foi chamado, nenhum UPDATE ou INSERT duplicado
    expect(prismaMocks.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('aplica isolamento por tenantId, paginação de 20 itens e ordenação por finalizadoEm DESC, id DESC', async () => {
    prismaMocks.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 45 }]);

    const resultado = await listarManifestacoes('tenant-isolado-99', {
      status: 'finalizada',
      busca: 'João 12.808',
      limite: POR_PAGINA_ARQUIVO,
      deslocamento: 20,
    });

    expect(POR_PAGINA_ARQUIVO).toBe(20);
    expect(resultado.total).toBe(45);
    expect(prismaMocks.$queryRaw).toHaveBeenCalledTimes(2);
    const queryListagem = prismaMocks.$queryRaw.mock.calls[0][0];
    const valoresListagem = prismaMocks.$queryRaw.mock.calls[0]
      .slice(1)
      .flatMap((v: unknown) =>
        v && typeof v === 'object' && 'values' in v && Array.isArray((v as { values: unknown[] }).values)
          ? (v as { values: unknown[] }).values
          : [v],
      );
    const sqlTexto = [
      ...(Array.isArray(queryListagem) ? queryListagem : queryListagem?.strings || []),
      ...prismaMocks.$queryRaw.mock.calls[0]
        .slice(1)
        .flatMap((v: unknown) =>
          v && typeof v === 'object' && 'strings' in v && Array.isArray((v as { strings: string[] }).strings)
            ? (v as { strings: string[] }).strings
            : [],
        ),
    ].join(' ');

    expect(valoresListagem).toContain('tenant-isolado-99');
    expect(valoresListagem).toContain('finalizada');
    expect(valoresListagem).toContain(20);
    expect(sqlTexto).toContain('ORDER BY');
    expect(sqlTexto).toContain('"finalizadoEm"');
    expect(sqlTexto).toContain('"id" DESC');
    // Garante que a listagem do Arquivo não carrega os documentos completos (minuta/textoFinal)
    expect(sqlTexto).not.toContain('"textoFinal"');
    expect(sqlTexto).not.toContain('"minuta"');
  });

  it('impede que um tenant consulte manifestação pertencente a outro tenant', async () => {
    prismaMocks.$queryRaw.mockResolvedValueOnce([]);
    await expect(
      obterManifestacao('tenant-outro', '550e8400-e29b-41d4-a716-446655440001'),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('manifestações: cliente da fila Em Conferência vs Arquivo e utilitários', () => {
  it('separa estritamente Em Conferência (status=conferencia) e Arquivo (status=finalizada, 20 por página)', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => ({
        itens: [
          {
            id: '550e8400-e29b-41d4-a716-446655440010',
            fichaId: 'FICHA-10',
            status: url.includes('status=conferencia') ? 'conferencia' : 'finalizada',
            versao: 1,
            versaoAnteriorId: null,
            numeroProcesso: '4133835-02.2026.8.26.0100',
            requerente: 'ANTONIO CARLOS GOUVEA VENTURA DE SOUSA',
            matricula: 'Matrícula 12.808',
            subdistrito: 'ALTO DA MOÓCA',
            escrevente: 'CFALANGA',
            imovel: 'Rua Farol Paulistano, 63',
            criadoPorNome: 'Cristiane Falanga',
            atualizadoPorNome: 'Cristiane Falanga',
            finalizadoPorNome: 'Cristiane Falanga',
            hashSha256: 'abc',
            createdAt: '2026-11-10T22:20:00.000Z',
            updatedAt: '2026-11-10T22:20:00.000Z',
            finalizadoEm: '2026-11-10T22:30:00.000Z',
            dados: { id_ficha: 'FICHA-10', status_conferencia: 'CONFERIDO' },
          },
        ],
        total: 1,
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const fila = await carregarFilaConferencia();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/gestao-documental/manifestacoes?status=conferencia&limite=200',
      expect.any(Object),
    );
    expect(fila).toHaveLength(1);
    expect(fila[0].statusBanco).toBe('conferencia');

    const arq = await listarArquivoManifestacoes({ busca: '12.808', pagina: 2 });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/gestao-documental/manifestacoes?status=finalizada&limite=20&deslocamento=20&busca=12.808',
      expect.any(Object),
    );
    expect(arq.itens).toHaveLength(1);
    expect(arq.itens[0].status).toBe('finalizada');

    vi.unstubAllGlobals();
  });

  it('formata data e hora no fuso de Brasília (America/Sao_Paulo)', () => {
    // 2026-11-11T15:30:00.000Z equivale a 11/11/2026 12:30 em America/Sao_Paulo (UTC-3)
    expect(formatarDataHora('2026-11-11T15:30:00.000Z')).toBe('11/11/2026 12:30');
    expect(formatarDataHora(null)).toBe('—');
    expect(formatarDataHora('data-invalida')).toBe('—');
  });

  it('calcula o SHA-256 do texto no servidor e valida origemParaApi', () => {
    expect(calcularHashManifestacao('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    const origem = {
      name: 'peticao.pdf',
      relativePath: 'PROC\\peticao.pdf',
      rootId: 'processos',
      size: 10,
      modifiedAt: 'x',
    };
    expect(origemParaApi(origem)).toEqual({
      name: 'peticao.pdf',
      relativePath: 'PROC\\peticao.pdf',
      rootId: 'processos',
    });
    expect(origemParaApi({ name: 'a.pdf', relativePath: 'a.pdf', rootId: 'Raiz Inválida' })).toEqual({
      name: 'a.pdf',
      relativePath: 'a.pdf',
    });
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
        [
          { t: 'Segundo elementos constantes dos autos, o imóvel consta na ' },
          { t: 'Matrícula 11.538', destaque: true },
          { t: '.' },
        ],
      ],
      introConfrontacoes:
        'Pela planta do Setor Fiscal Municipal do imóvel usucapiendo, verifica-se que o mesmo confronta:',
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

    const docxBytes = gerarDocxBytesManifestacao(minutaHibrida);
    expect(docxBytes.byteLength).toBeGreaterThan(1000);
    expect(docxBytes[0]).toBe(0x50);
    expect(docxBytes[1]).toBe(0x4b);
    expect(docxBytes[2]).toBe(0x03);
    expect(docxBytes[3]).toBe(0x04);

    const docHtml = gerarDocHtmlManifestacao(minutaHibrida);
    expect(docHtml).toContain('4152773-45.2026.8.26.0100');
    expect(docHtml).toContain('LUCILENE FELIPE DE SENA CARVALHO');
    expect(docHtml).toContain('Parágrafo 1 editado diretamente pelo escrevente na tela híbrida A4.');
    expect(docHtml).toContain('O Oficial Substituto,');
  });
});
