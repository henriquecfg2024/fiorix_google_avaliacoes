import { describe, expect, it, vi } from 'vitest';
import type { ReurbExportacaoDTO } from '@/lib/reurb/types';
import {
  buildStoredZipBytes,
  gerarZipReurbPorMes,
  matchExistingMonthFolderName,
  resolveCompetenciaExportacao,
  salvarArquivosReurbEmPastasExistentes,
  type FsDirectoryHandle,
  type FsFileHandle,
} from '@/components/reurb/reurb-batch-folders';
import {
  buildNomeArquivoComprovantePdf,
  gerarPdfComprovanteExportacaoReurb,
} from '@/components/reurb/reurb-comprovante-pdf';

class MemoryDirectoryHandle implements FsDirectoryHandle {
  readonly kind = 'directory' as const;
  readonly subdirs = new Map<string, MemoryDirectoryHandle>();
  readonly files = new Map<string, Uint8Array>();
  readonly createDirCalls: Array<{ name: string; create?: boolean }> = [];
  readonly createFileCalls: Array<{ name: string; create?: boolean }> = [];

  constructor(public readonly name: string) {}

  addSubdir(dir: MemoryDirectoryHandle) {
    this.subdirs.set(dir.name, dir);
    return dir;
  }

  addFile(name: string, content: Uint8Array | string) {
    const bytes =
      typeof content === 'string' ? new TextEncoder().encode(content) : content;
    this.files.set(name, bytes);
  }

  async getDirectoryHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FsDirectoryHandle> {
    this.createDirCalls.push({ name, create: options?.create });
    const found = this.subdirs.get(name);
    if (found) return found;
    if (options?.create) {
      throw new Error('Regra violada: não é permitido criar subpastas faltantes.');
    }
    const err = new Error(`Directory not found: ${name}`);
    err.name = 'NotFoundError';
    throw err;
  }

  async getFileHandle(
    name: string,
    options?: { create?: boolean }
  ): Promise<FsFileHandle> {
    this.createFileCalls.push({ name, create: options?.create });
    const existing = this.files.get(name);
    if (!existing && !options?.create) {
      const err = new Error(`File not found: ${name}`);
      err.name = 'NotFoundError';
      throw err;
    }
    const filesMap = this.files;
    return {
      kind: 'file',
      name,
      async createWritable() {
        let written = new Uint8Array(0);
        return {
          async write(data) {
            if (typeof data === 'string') {
              written = new TextEncoder().encode(data);
            } else if (data instanceof ArrayBuffer) {
              written = new Uint8Array(data);
            } else if (ArrayBuffer.isView(data)) {
              written = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
            } else {
              written = new Uint8Array(await data.arrayBuffer());
            }
          },
          async close() {
            filesMap.set(name, written);
          },
        };
      },
    };
  }

  async *values(): AsyncIterable<FsDirectoryHandle | FsFileHandle> {
    for (const dir of this.subdirs.values()) {
      yield dir;
    }
    for (const name of this.files.keys()) {
      yield {
        kind: 'file',
        name,
        async createWritable() {
          throw new Error('unexpected write');
        },
      };
    }
  }
}

function makeExportacao(overrides: Partial<ReurbExportacaoDTO> = {}): ReurbExportacaoDTO {
  return {
    id: 'exp-266468',
    tipo: 'UNITARIA',
    statusGeracao: 'GERADO',
    statusImportacaoOnr: 'CONFIRMADA_ONR',
    nomeArquivoJson: 'reurb_onr_mat_266468_20261124185950.json',
    nomeArquivoPendencias: null,
    qtdSolicitadas: 1,
    qtdAptasGeradas: 1,
    qtdBarradas: 0,
    qtdDerivadasIncluidas: 43,
    jsonSha256: 'a'.repeat(64),
    erroDetalhe: null,
    revalidacaoConnectorId: 'conn-1',
    revalidadoEm: '2026-11-24T18:59:50.000Z',
    ocrConsultado: true,
    geradoPorNome: 'Henrique Gama',
    confirmadoImportacaoEm: '2026-11-24T19:01:00.000Z',
    confirmadoPorNome: 'Henrique Gama',
    protocoloOnrExterno: 'ONR-123',
    observacaoConfirmacao: null,
    createdAt: '2026-11-24T18:59:50.000Z',
    itens: [
      {
        id: 'item-1',
        regularizacaoId: 'reg-1',
        prenotacao: 644587,
        matricula: 266468,
        protocolo: '644587',
        empreendimento: 'JARDIM FANGANIELLO',
        modalidade: 'REURB_S',
        dataRegistro: '2026-09-23',
        incluidaNoJson: true,
        situacaoNoMomento: 'APTO',
        qtdDerivadasIncluidas: 43,
        motivosBloqueio: [],
      },
    ],
    ...overrides,
  };
}

describe('Central REURB — Salvamento em lote nas pastas existentes', () => {
  it('resolve corretamente pastas reais incluindo 09-NOVEMBRO vs 09-SETEMBRO e 03-MARÇO', () => {
    const folders = [
      '01-JANEIRO',
      '02-FEVEREIRO',
      '03-MARÇO',
      '08-AGOSTO',
      '09-NOVEMBRO',
      '09-SETEMBRO',
      '10-OUTUBRO',
      '12-DEZEMBRO',
    ];

    expect(matchExistingMonthFolderName(folders, 3)).toBe('03-MARÇO');
    expect(matchExistingMonthFolderName(folders, 9)).toBe('09-SETEMBRO');
    expect(matchExistingMonthFolderName(folders, 11)).toBe('09-NOVEMBRO');
    expect(matchExistingMonthFolderName(['01-JANEIRO', '09-NOVEMBRO'], 9)).toBeNull();
    expect(matchExistingMonthFolderName(['07', '08-CUSTOM'], 7)).toBe('07');
  });

  it('determina pasta de destino pela data de registro e sinaliza competência mista', () => {
    const expSetembro = makeExportacao();
    expect(resolveCompetenciaExportacao(expSetembro)).toEqual({
      ano: 2026,
      mes: 9,
      mista: false,
    });

    const expMista = makeExportacao({
      itens: [
        {
          id: 'a',
          regularizacaoId: 'r1',
          prenotacao: 1,
          matricula: 100,
          protocolo: '1',
          empreendimento: 'EMP A',
          modalidade: 'REURB_S',
          dataRegistro: '2026-09-23',
          incluidaNoJson: true,
          situacaoNoMomento: 'APTO',
          qtdDerivadasIncluidas: 10,
          motivosBloqueio: [],
        },
        {
          id: 'b',
          regularizacaoId: 'r2',
          prenotacao: 2,
          matricula: 101,
          protocolo: '2',
          empreendimento: 'EMP A',
          modalidade: 'REURB_S',
          dataRegistro: '2026-09-24',
          incluidaNoJson: true,
          situacaoNoMomento: 'APTO',
          qtdDerivadasIncluidas: 5,
          motivosBloqueio: [],
        },
        {
          id: 'c',
          regularizacaoId: 'r3',
          prenotacao: 3,
          matricula: 102,
          protocolo: '3',
          empreendimento: 'EMP B',
          modalidade: 'REURB_E',
          dataRegistro: '2026-10-02',
          incluidaNoJson: true,
          situacaoNoMomento: 'APTO',
          qtdDerivadasIncluidas: 2,
          motivosBloqueio: [],
        },
      ],
    });
    expect(resolveCompetenciaExportacao(expMista)).toEqual({
      ano: 2026,
      mes: 9,
      mista: true,
    });
  });

  it('salva JSONs e PDFs nas pastas existentes, pula arquivos existentes e nunca cria pastas ausentes', async () => {
    const root = new MemoryDirectoryHandle('REURB');
    const dir2026 = root.addSubdir(new MemoryDirectoryHandle('2026'));
    const dirSet = dir2026.addSubdir(new MemoryDirectoryHandle('09-SETEMBRO'));
    dir2026.addSubdir(new MemoryDirectoryHandle('09-NOVEMBRO'));

    // Pré-popula arquivo JSON já existente para validar skip sem sobrescrita
    dirSet.addFile('reurb_onr_mat_266468_20261124185950.json', '{"jaExiste":true}');

    const expExistente = makeExportacao();
    const expNovembro = makeExportacao({
      id: 'exp-nov',
      nomeArquivoJson: 'reurb_onr_mat_266470_20261124190000.json',
      itens: [
        {
          ...makeExportacao().itens[0],
          matricula: 266470,
          dataRegistro: '2026-11-10',
        },
      ],
    });
    const expPastaAusente = makeExportacao({
      id: 'exp-out',
      nomeArquivoJson: 'reurb_onr_mat_266471_20261124190100.json',
      itens: [
        {
          ...makeExportacao().itens[0],
          matricula: 266471,
          dataRegistro: '2026-10-15',
        },
      ],
    });
    const expComPendencia = makeExportacao({
      id: 'exp-pend',
      nomeArquivoJson: 'reurb_onr_mat_266472_20261124190200.json',
      qtdBarradas: 1,
      itens: [
        {
          ...makeExportacao().itens[0],
          matricula: 266472,
          dataRegistro: '2026-11-12',
        },
      ],
    });

    const fetchJsonBytes = vi.fn(async (id: string) =>
      new TextEncoder().encode(JSON.stringify({ id }))
    );

    const summary = await salvarArquivosReurbEmPastasExistentes({
      exportacoes: [expExistente, expNovembro, expPastaAusente, expComPendencia],
      mode: 'ambos',
      rootDir: root,
      fetchJsonBytes,
      generatePdfBytes: (exp) => gerarPdfComprovanteExportacaoReurb(exp),
    });

    // Não criou pasta 10-OUTUBRO ausente
    expect(dir2026.subdirs.has('10-OUTUBRO')).toBe(false);
    expect(dir2026.createDirCalls.every((c) => !c.create)).toBe(true);

    // JSON pré-existente não foi sobrescrito nem baixado novamente
    expect(
      new TextDecoder().decode(dirSet.files.get('reurb_onr_mat_266468_20261124185950.json'))
    ).toBe('{"jaExiste":true}');
    // Mas o PDF de 266468 foi salvo em 09-SETEMBRO
    const pdfBytes = dirSet.files.get('reurb_onr_mat_266468_20261124185950.json.pdf');
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(pdfBytes!.slice(0, 5))).toBe('%PDF-');

    // Exp de novembro (dataRegistro 2026-11-10) foi roteada para 09-NOVEMBRO
    const novDir = dir2026.subdirs.get('09-NOVEMBRO')!;
    expect(novDir.files.has('reurb_onr_mat_266470_20261124190000.json')).toBe(true);
    expect(novDir.files.has('reurb_onr_mat_266470_20261124190000.json.pdf')).toBe(true);
    // Exp com pendência: salva JSON em 09-NOVEMBRO, mas PDF é nao_elegivel
    expect(novDir.files.has('reurb_onr_mat_266472_20261124190200.json')).toBe(true);
    expect(novDir.files.has('reurb_onr_mat_266472_20261124190200.json.pdf')).toBe(false);

    expect(summary.salvos).toBe(4);
    expect(summary.ignoradosExistentes).toBe(1);
    expect(summary.semPasta).toBe(2);
    expect(summary.naoElegiveis).toBe(1);
    expect(summary.erros).toBe(0);
    expect(summary.rootDirName).toBe('REURB');
    expect(summary.pastasAusentes).toEqual(['2026/10-OUTUBRO']);
  });

  it('aceita seleção direta da pasta do mês (09-SETEMBRO), do ano (2026) ou do drive (W:) contendo REURB', async () => {
    const expSet = makeExportacao();
    const expOut = makeExportacao({
      id: 'exp-out-direct',
      nomeArquivoJson: 'reurb_onr_mat_266499_20261124191000.json',
      itens: [
        {
          ...makeExportacao().itens[0],
          matricula: 266499,
          dataRegistro: '2026-10-15',
        },
      ],
    });

    // 1) Usuário seleciona diretamente a pasta "09-SETEMBRO"
    const directMonthDir = new MemoryDirectoryHandle('09-SETEMBRO');
    const resDirectMonth = await salvarArquivosReurbEmPastasExistentes({
      exportacoes: [expSet, expOut],
      mode: 'comprovantes',
      rootDir: directMonthDir,
      fetchJsonBytes: async () => new Uint8Array(),
      generatePdfBytes: (exp) => gerarPdfComprovanteExportacaoReurb(exp),
    });
    expect(directMonthDir.files.has('reurb_onr_mat_266468_20261124185950.json.pdf')).toBe(true);
    expect(directMonthDir.files.has('reurb_onr_mat_266499_20261124191000.json.pdf')).toBe(false);
    expect(resDirectMonth.salvos).toBe(1);
    expect(resDirectMonth.semPasta).toBe(1);
    expect(resDirectMonth.rootDirName).toBe('09-SETEMBRO');

    // 2) Usuário seleciona diretamente a pasta do ano "2026"
    const yearDir = new MemoryDirectoryHandle('2026');
    const yearSetDir = yearDir.addSubdir(new MemoryDirectoryHandle('09-SETEMBRO'));
    const resYear = await salvarArquivosReurbEmPastasExistentes({
      exportacoes: [expSet],
      mode: 'comprovantes',
      rootDir: yearDir,
      fetchJsonBytes: async () => new Uint8Array(),
      generatePdfBytes: (exp) => gerarPdfComprovanteExportacaoReurb(exp),
    });
    expect(yearSetDir.files.has('reurb_onr_mat_266468_20261124185950.json.pdf')).toBe(true);
    expect(resYear.salvos).toBe(1);

    // 3) Usuário seleciona a raiz do drive ("W:") contendo REURB/2026/09-SETEMBRO
    const driveRoot = new MemoryDirectoryHandle('W:');
    const driveReurb = driveRoot.addSubdir(new MemoryDirectoryHandle('REURB'));
    const drive2026 = driveReurb.addSubdir(new MemoryDirectoryHandle('2026'));
    const driveSet = drive2026.addSubdir(new MemoryDirectoryHandle('09-SETEMBRO'));
    const resDrive = await salvarArquivosReurbEmPastasExistentes({
      exportacoes: [expSet],
      mode: 'comprovantes',
      rootDir: driveRoot,
      fetchJsonBytes: async () => new Uint8Array(),
      generatePdfBytes: (exp) => gerarPdfComprovanteExportacaoReurb(exp),
    });
    expect(driveSet.files.has('reurb_onr_mat_266468_20261124185950.json.pdf')).toBe(true);
    expect(resDrive.salvos).toBe(1);
  });

  it('gera PDF válido com nome padrão <arquivo>.json.pdf e ZIP organizado por mês', async () => {
    const exp = makeExportacao();
    expect(buildNomeArquivoComprovantePdf(exp)).toBe(
      'reurb_onr_mat_266468_20261124185950.json.pdf'
    );

    const zipData = buildStoredZipBytes([
      {
        path: '2026/09-SETEMBRO/teste.json',
        data: new TextEncoder().encode('{"ok":true}'),
      },
    ]);
    // Assinatura local file header PK\x03\x04
    expect(Array.from(zipData.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);

    const zipBundle = await gerarZipReurbPorMes({
      exportacoes: [exp],
      mode: 'ambos',
      fetchJsonBytes: async () => new TextEncoder().encode('{"lote":1}'),
      generatePdfBytes: (item) => gerarPdfComprovanteExportacaoReurb(item),
    });
    expect(zipBundle.totalArquivos).toBe(2);
    expect(zipBundle.naoElegiveis).toBe(0);
    expect(zipBundle.blob.size).toBeGreaterThan(500);
  });
});
