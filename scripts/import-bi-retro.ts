import fs from 'node:fs';
import path from 'node:path';

import Papa from 'papaparse';

import { prisma } from '../src/lib/prisma';

const filePath = process.argv[2];
const batchSize = Number(process.argv[3] || 5000);
const progressStep = Number(process.argv[4] || 50000);
const resumeImportId = process.argv[5] || '';
const resumeSkipValidRows = Number(process.argv[6] || 0);

if (!filePath) {
  console.error(
    'Uso: npx tsx scripts/import-bi-retro.ts <csvPath> [batchSize] [progressStep] [resumeImportId] [resumeSkipValidRows]'
  );
  process.exit(1);
}

function parseDate(value?: string | null) {
  if (!value || value.trim() === '') return null;

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  const match = value
    .trim()
    .match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?$/);

  if (!match) return null;

  const [, day, month, year, time = '00:00:00'] = match;
  const fallback = new Date(`${year}-${month}-${day}T${time}`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function parseIntVal(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  const parsed = parseInt(digits, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseBool(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const lower = String(value || '').trim().toLowerCase();
  return lower === 'true' || lower === '1' || lower === 'sim';
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.replace(/^\uFEFF/, '').trim() : '';
}

async function main() {
  const fileName = path.basename(filePath);
  const stat = await fs.promises.stat(filePath);

  console.log(
    `[START] ${new Date().toISOString()} arquivo=${fileName} tamanho=${stat.size} bytes batch=${batchSize} resumeImportId=${resumeImportId || 'novo'} resumeSkipValidRows=${resumeSkipValidRows}`
  );

  let importRecord:
    | Awaited<ReturnType<typeof prisma.fiorixBiImport.findUnique>>
    | Awaited<ReturnType<typeof prisma.fiorixBiImport.create>>;

  if (resumeImportId) {
    importRecord = await prisma.fiorixBiImport.findUnique({
      where: { id: resumeImportId },
    });

    if (!importRecord) {
      throw new Error(`Lote para retomada não encontrado: ${resumeImportId}`);
    }
  } else {
    const existing = await prisma.fiorixBiImport.findFirst({
      where: { fileName },
      orderBy: { importedAt: 'desc' },
    });

    if (existing) {
      throw new Error(
        `Já existe um lote com este arquivo no Supabase: ${existing.fileName} (${existing.id})`
      );
    }

    importRecord = await prisma.fiorixBiImport.create({
      data: {
        fileName,
        rowsCount: 0,
        importedBy: 'Servidor Codex',
      },
    });
  }

  console.log(`[IMPORT_ID] ${importRecord.id}`);

  let totalRead = 0;
  let totalValid = resumeSkipValidRows;
  let totalInserted = resumeSkipValidRows;
  let lastPersisted = importRecord.rowsCount || resumeSkipValidRows;
  let settled = false;
  let validSeen = 0;
  const rowBuffer: any[] = [];

  const cleanupAndFail = async (error: unknown) => {
    if (settled) return;
    settled = true;

    console.error('[ERROR]', error);

    try {
      if (!resumeImportId) {
        await prisma.fiorixBiImport.delete({ where: { id: importRecord.id } });
        console.error(`[ROLLBACK] lote ${importRecord.id} removido com cascade`);
      }
    } catch (rollbackError) {
      console.error('[ROLLBACK_ERROR]', rollbackError);
    }

    await prisma.$disconnect();
    process.exit(1);
  };

  const maybePersistProgress = async (force = false) => {
    if (!force && totalInserted - lastPersisted < progressStep) return;

    await prisma.fiorixBiImport.update({
      where: { id: importRecord.id },
      data: { rowsCount: totalInserted },
    });

    lastPersisted = totalInserted;
    console.log(
      `[PROGRESS] ${new Date().toISOString()} lidas=${totalRead} validas=${totalValid} inseridas=${totalInserted}`
    );
  };

  const flushBuffer = async (force = false) => {
    while (rowBuffer.length >= batchSize || (force && rowBuffer.length > 0)) {
      const take = force ? rowBuffer.length : batchSize;
      const batch = rowBuffer.splice(0, take);

      const result = await prisma.fiorixBiData.createMany({
        data: batch,
        skipDuplicates: true,
      });

      totalInserted += result.count;
      await maybePersistProgress(false);
    }
  };

  const parseStream: any = Papa.parse(Papa.NODE_STREAM_INPUT, {
    header: true,
    delimiter: ';',
    skipEmptyLines: false,
    quoteChar: '"',
    escapeChar: '"',
    transformHeader: (header: string) => normalizeText(header),
    transform: (value: string) => normalizeText(value),
  });

  let chain = Promise.resolve();

  parseStream.on('data', (row: Record<string, string>) => {
    if (settled) return;

    totalRead += 1;

    const protocolo = normalizeText(row.Protocolo);
    if (!protocolo || protocolo === '0' || protocolo.toLowerCase() === 'protocolo') {
      return;
    }

    validSeen += 1;
    if (validSeen <= resumeSkipValidRows) {
      return;
    }

    totalValid += 1;

    rowBuffer.push({
      importId: importRecord.id,
      protocolo,
      flagRecepcao: parseIntVal(row.FlagRecepcao),
      tipoSolicitacao: normalizeText(row.TipoSolicitacao) || null,
      idAndamento: normalizeText(row.IdAndamento)
        ? BigInt(normalizeText(row.IdAndamento).replace(/\D/g, '') || 0)
        : null,
      dtProtocolo: parseDate(normalizeText(row.DtProtocolo) || normalizeText(row.DataProtocolo)),
      dtPrevisaoEntrega: parseDate(normalizeText(row.DtPrevisaoEntrega)),
      dtAndamento: parseDate(normalizeText(row.DtAndamento)),
      codProcessamento: parseIntVal(row.CodProcessamento),
      descAndamento: normalizeText(row.DescAndamento) || null,
      natureza: normalizeText(row.Natureza) || null,
      tipoPrenotacao: normalizeText(row.TipoPrenotacao) || null,
      diasPrometidos: parseIntVal(row.DiasPrometidos),
      diasCorridos: parseIntVal(row.DiasCorridos),
      diasAtraso: parseIntVal(row.DiasAtraso),
      situacaoPrazo: normalizeText(row.SituacaoPrazo) || null,
      isDevolucao: parseBool(row.IsDevolucao),
      isRegistrado: parseBool(row.IsRegistrado),
      textoNotaDevolucao: normalizeText(row.TextoNotaDevolucao) || null,
    });

    if (rowBuffer.length >= batchSize) {
      parseStream.pause();

      chain = chain
        .then(async () => {
          await flushBuffer(false);
          parseStream.resume();
        })
        .catch(async (error) => {
          await cleanupAndFail(error);
        });
    }
  });

  parseStream.on('end', () => {
    chain
      .then(async () => {
        if (settled) return;

        await flushBuffer(true);
        await maybePersistProgress(true);

        settled = true;

        console.log(
          `[DONE] ${new Date().toISOString()} lidas=${totalRead} validas=${totalValid} inseridas=${totalInserted} importId=${importRecord.id}`
        );

        await prisma.$disconnect();
        process.exit(0);
      })
      .catch(async (error) => {
        await cleanupAndFail(error);
      });
  });

  parseStream.on('error', async (error: unknown) => {
    await cleanupAndFail(error);
  });

  const input = fs.createReadStream(filePath);
  input.on('error', async (error) => {
    await cleanupAndFail(error);
  });

  input.pipe(parseStream);
}

main().catch(async (error) => {
  console.error('[FATAL]', error);
  await prisma.$disconnect();
  process.exit(1);
});
