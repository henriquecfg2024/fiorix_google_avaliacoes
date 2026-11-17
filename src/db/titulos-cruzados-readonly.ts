import sql from 'mssql';

export interface ProtocoloVinculadoWebri {
  protocolo: number;
  protocoloCentral: string | null;
  origem: 'matricula' | 'processo' | 'protocolo';
  matriculasLv2?: number[];
  transcricoesLv3?: number[];
}

export interface ConsultaProtocolosVinculadosParams {
  matriculas?: number[];
  processosCnj?: string[];
  protocolosDiretos?: number[];
  codigosCentral?: string[];
}

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 500;
const MAX_PROTOCOLOS_POR_CONSULTA = 10;

const queryCache = new Map<string, { expiresAt: number; items: ProtocoloVinculadoWebri[] }>();

let sharedPool: sql.ConnectionPool | null = null;
let sharedPoolKey = '';
let sharedPoolConnecting: Promise<sql.ConnectionPool | null> | null = null;

function buildProcessPrefixes(rawCnj: string): { prefFmt: string; prefDig: string } | null {
  const digits = String(rawCnj || '').replace(/\D+/g, '');
  if (digits.length < 9) return null;

  // Garante prefixo com >= 9 dígitos sem '%' à esquerda para manter Index Seek em IX_tblWRITitulos_Oficio.
  if (digits.length >= 13) {
    const base7 = digits.slice(0, 7);
    const dv2 = digits.slice(7, 9);
    const year4 = digits.slice(9, 13);
    return {
      prefFmt: `${base7}-${dv2}.${year4}%`,
      prefDig: `${digits.slice(0, 13)}%`,
    };
  }

  const base7 = digits.slice(0, 7);
  const dv2 = digits.slice(7, 9);
  return {
    prefFmt: `${base7}-${dv2}%`,
    prefDig: `${digits.slice(0, 9)}%`,
  };
}

function cloneProtocoloItem(item: ProtocoloVinculadoWebri): ProtocoloVinculadoWebri {
  return {
    ...item,
    ...(item.matriculasLv2 ? { matriculasLv2: [...item.matriculasLv2] } : {}),
    ...(item.transcricoesLv3 ? { transcricoesLv3: [...item.transcricoesLv3] } : {}),
  };
}

function getCached(key: string): ProtocoloVinculadoWebri[] | null {
  const hit = queryCache.get(key);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) {
    queryCache.delete(key);
    return null;
  }
  return hit.items.map(cloneProtocoloItem);
}

function setCached(key: string, items: ProtocoloVinculadoWebri[]): void {
  if (queryCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = queryCache.keys().next().value;
    if (oldest !== undefined) queryCache.delete(oldest);
  }
  queryCache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    items: items.map(cloneProtocoloItem),
  });
}

async function getReadOnlyPool(): Promise<sql.ConnectionPool | null> {
  const [{ env }, { runtimeDirective }] = await Promise.all([
    import('../config/env.js'),
    import('../services/runtime-directive.js'),
  ]);

  if (env.SHADOW_MODE) return null;

  const remoteCfg = runtimeDirective.getRemoteConfig();
  const server = remoteCfg.sqlHost || env.SQL_SERVER_HOST;
  const database = remoteCfg.sqlDatabase || env.SQL_SERVER_DATABASE;
  const encrypt =
    process.env.SQL_SERVER_ENCRYPT !== undefined
      ? process.env.SQL_SERVER_ENCRYPT === 'true'
      : env.SQL_SERVER_ENCRYPT;
  const trustServerCertificate =
    process.env.SQL_SERVER_TRUST_CERT !== undefined
      ? process.env.SQL_SERVER_TRUST_CERT !== 'false'
      : env.SQL_SERVER_TRUST_CERT;

  const key = `${server}|${database}|${env.SQL_SERVER_USER}`;
  if (sharedPool && sharedPool.connected && sharedPoolKey === key) {
    return sharedPool;
  }
  if (sharedPoolConnecting) {
    return sharedPoolConnecting;
  }

  sharedPoolConnecting = (async () => {
    try {
      if (sharedPool) {
        await sharedPool.close().catch(() => {});
        sharedPool = null;
      }
      const pool = await new sql.ConnectionPool({
        user: env.SQL_SERVER_USER,
        password: env.SQL_SERVER_PASSWORD,
        server,
        database,
        ...(process.env.SQL_SERVER_PORT ? { port: Number(process.env.SQL_SERVER_PORT) } : {}),
        connectionTimeout: 3500,
        requestTimeout: 4000,
        pool: { max: 2, min: 0, idleTimeoutMillis: 15000 },
        options: {
          encrypt,
          trustServerCertificate,
          readOnlyIntent: true,
          requestTimeout: 4000,
        },
      }).connect();
      pool.on('error', () => {
        if (sharedPool === pool) sharedPool = null;
      });
      sharedPool = pool;
      sharedPoolKey = key;
      return pool;
    } catch {
      sharedPool = null;
      return null;
    } finally {
      sharedPoolConnecting = null;
    }
  })();

  return sharedPoolConnecting;
}

const SQL_HEADER = `
SET NOCOUNT ON;
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
SET LOCK_TIMEOUT 1500;
`;

/**
 * Consulta estritamente SOMENTE LEITURA (WITH NOLOCK / READ UNCOMMITTED) no SRVSQL\WEBRI
 * para descobrir números de Protocolo/Prenotação e códigos da Central (`ProtocoloEntidade`)
 * vinculados a uma matrícula do Livro 2, processo judicial ou prenotação informada.
 * Qualquer erro de rede/permissão degrada silenciosamente retornando [].
 */
export async function consultarProtocolosVinculadosWebriReadOnly(
  params: ConsultaProtocolosVinculadosParams,
): Promise<ProtocoloVinculadoWebri[]> {
  if (
    process.env.VITEST ||
    process.env.NODE_ENV === 'test' ||
    process.env.SHADOW_MODE === 'true'
  ) {
    return [];
  }

  const matriculas = Array.from(
    new Set(
      (params.matriculas || [])
        .map((n) => Math.trunc(Number(n)))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 9_999_999),
    ),
  ).slice(0, 5);

  const processos = Array.from(
    new Set((params.processosCnj || []).map((p) => String(p || '').trim()).filter(Boolean)),
  )
    .map(buildProcessPrefixes)
    .filter((p): p is { prefFmt: string; prefDig: string } => p !== null)
    .slice(0, 3);

  const protocolosDiretos = Array.from(
    new Set(
      (params.protocolosDiretos || [])
        .map((n) => Math.trunc(Number(n)))
        .filter((n) => Number.isFinite(n) && n > 0 && n <= 99_999_999),
    ),
  ).slice(0, 5);

  if (matriculas.length === 0 && processos.length === 0 && protocolosDiretos.length === 0) {
    return [];
  }

  const cacheKey = JSON.stringify({
    m: matriculas,
    p: processos.map((x) => x.prefFmt),
    d: protocolosDiretos,
  });
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const pool = await getReadOnlyPool();
    if (!pool) return [];

    const collected = new Map<number, ProtocoloVinculadoWebri>();
    const addRow = (row: any, origem: ProtocoloVinculadoWebri['origem']) => {
      const protocolo = Math.trunc(Number(row?.protocolo || 0));
      if (!Number.isFinite(protocolo) || protocolo <= 0) return;
      const rawCentral = String(row?.protocoloCentral ?? '').trim();
      const protocoloCentral = rawCentral.length > 0 ? rawCentral : null;
      let target = collected.get(protocolo);
      if (!target) {
        target = { protocolo, protocoloCentral, origem };
        collected.set(protocolo, target);
      } else if (!target.protocoloCentral && protocoloCentral) {
        target.protocoloCentral = protocoloCentral;
      }

      const livroId = Number(row?.livroId);
      const numLivro = Math.trunc(Number(row?.numLivro || 0));
      if (Number.isFinite(numLivro) && numLivro > 0) {
        if (livroId === 2) {
          target.matriculasLv2 ??= [];
          if (!target.matriculasLv2.includes(numLivro) && target.matriculasLv2.length < 10) {
            target.matriculasLv2.push(numLivro);
          }
        } else if (livroId === 3) {
          target.transcricoesLv3 ??= [];
          if (!target.transcricoesLv3.includes(numLivro) && target.transcricoesLv3.length < 10) {
            target.transcricoesLv3.push(numLivro);
          }
        }
      }
    };

    await Promise.all([
      ...protocolosDiretos.map(async (proto) => {
        try {
          const res = await pool
            .request()
            .input('Protocolo', sql.Int, proto)
            .query(`
              ${SQL_HEADER}
              SELECT TOP (25)
                rec.PK_Recepcao AS protocolo,
                LTRIM(RTRIM(ISNULL(rec.ProtocoloEntidade, ''))) AS protocoloCentral,
                r.FK_tblWRILivro_Id AS livroId,
                r.PK_Num_Livro AS numLivro
              FROM dbo.tblWRIRecepcao rec WITH (NOLOCK)
              LEFT JOIN dbo.tblWRITitulosReal tr WITH (NOLOCK)
                ON tr.FK_tblWRIRecepcaoFlagRecepcao = 1
               AND tr.FK_tblWRIRecepcaoRecepcao = rec.PK_Recepcao
              LEFT JOIN dbo.tblWRIReal r WITH (NOLOCK)
                ON r.PK_Id = tr.FK_tblWRIReal_Id
              WHERE rec.PK_FlagRecepcao = 1
                AND rec.PK_Recepcao = @Protocolo;
            `);
          for (const row of res.recordset || []) addRow(row, 'protocolo');
        } catch {}
      }),
      ...matriculas.map(async (mat) => {
        try {
          const res = await pool
            .request()
            .input('Matricula', sql.Int, mat)
            .query(`
              ${SQL_HEADER}
              SELECT DISTINCT TOP (${MAX_PROTOCOLOS_POR_CONSULTA})
                rec.PK_Recepcao AS protocolo,
                LTRIM(RTRIM(ISNULL(rec.ProtocoloEntidade, ''))) AS protocoloCentral
              FROM dbo.tblWRIReal r WITH (NOLOCK)
              INNER JOIN dbo.tblWRITitulosReal tr WITH (NOLOCK)
                ON tr.FK_tblWRIReal_Id = r.PK_Id
               AND tr.FK_tblWRIRecepcaoFlagRecepcao = 1
              INNER JOIN dbo.tblWRIRecepcao rec WITH (NOLOCK)
                ON rec.PK_FlagRecepcao = 1
               AND rec.PK_Recepcao = tr.FK_tblWRIRecepcaoRecepcao
              WHERE r.FK_tblWRILivro_Id = 2
                AND r.PK_Num_Livro = @Matricula
              ORDER BY rec.PK_Recepcao DESC;
            `);
          for (const row of res.recordset || []) addRow(row, 'matricula');
        } catch {}
      }),
      ...processos.map(async (proc) => {
        try {
          const res = await pool
            .request()
            .input('PrefFmt', sql.VarChar(80), proc.prefFmt)
            .input('PrefDig', sql.VarChar(80), proc.prefDig)
            .query(`
              ${SQL_HEADER}
              SELECT DISTINCT TOP (${MAX_PROTOCOLOS_POR_CONSULTA})
                rec.PK_Recepcao AS protocolo,
                LTRIM(RTRIM(ISNULL(rec.ProtocoloEntidade, ''))) AS protocoloCentral
              FROM dbo.tblWRITitulos tit WITH (NOLOCK)
              INNER JOIN dbo.tblWRIRecepcao rec WITH (NOLOCK)
                ON rec.PK_FlagRecepcao = 1
               AND rec.PK_Recepcao = tit.FK_tblWRIRecepcaoRecepcao
              WHERE tit.FK_tblWRIRecepcaoFlagRecepcao = 1
                AND (tit.Processo LIKE @PrefFmt OR tit.Processo LIKE @PrefDig)
              ORDER BY rec.PK_Recepcao DESC;
            `);
          for (const row of res.recordset || []) addRow(row, 'processo');
        } catch {}
      }),
    ]);

    const ordered = Array.from(collected.values())
      .sort((a, b) => b.protocolo - a.protocolo)
      .slice(0, MAX_PROTOCOLOS_POR_CONSULTA);

    setCached(cacheKey, ordered);
    return ordered;
  } catch {
    return [];
  }
}
