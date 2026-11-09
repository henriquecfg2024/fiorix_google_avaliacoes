/**
 * Adaptador SQL Server Estritamente SOMENTE LEITURA — Cartório Virtual (Certidões & Contraditório)
 *
 * REGRAS INEGOCIÁVEIS:
 * 1. Compatível com Microsoft SQL Server 2012 SP4 (11.0 SP4 — SRVSQL\WEBRI).
 * 2. Exclusivamente comandos SELECT parametrizados com WITH (NOLOCK).
 *    PROIBIDO executar INSERT, UPDATE, DELETE, MERGE, CREATE, ALTER, DROP ou EXEC de escrita.
 * 3. Trata erro SQL 229 (SELECT permission denied) de forma limpa e transparente, sem inventar dados.
 */

import sql from 'mssql';
import { env } from '../config/env.js';
import { runtimeDirective } from '../services/runtime-directive.js';
import { logger } from '../utils/logger.js';

export interface PedidoCertidaoSqlRow {
  numeroPedido: number;
  protocoloExterno: string | null;
  dataPedidoIso: string | null;
  dataFinalRetiradaIso: string | null;
  enviarCorreio: boolean;
  nomeRequerente: string;
  foneRequerente: string | null;
  emailRequerente: string | null;
  qtdPedidos: number;
  valorTotalCert1: number;
  valorTotalCert2: number;
}

export interface ItemPedidoCertidaoSqlRow {
  numeroPedido: number;
  sequenciaItem: number;
  naturezaCodigo: number | null;
  naturezaDescricao: string | null;
  numLivro: number | null;
  numMatricula: number | null;
  meioEntrega: string | null;
}

export interface PrenotacaoContraditorioSqlRow {
  numeroMatricula: number;
  numeroPrenotacao: number;
  dataRecepcaoIso: string | null;
  naturezaTitulo: string | null;
  atoEmProcessamento: boolean;
  situacaoTitulo: string | null;
}

export interface PedidoCompletoCartorioVirtualPayload {
  numeroPedido: number;
  protocoloExterno: string | null;
  dataPedidoIso: string | null;
  dataPrevisaoIso: string | null;
  dataFinalRetiradaIso: string | null;
  enviarCorreio: boolean;
  tipoPedido: number;
  tipoPedidoDescricao: string | null;
  nomeRequerente: string;
  documentoRequerente: string | null;
  foneRequerente: string | null;
  emailRequerente: string | null;
  enderecoRequerente: string | null;
  valorServico: number;
  valorDespesa: number;
  totalDeposito: number;
  observacoesOrigem: string | null;
  descricaoDosItens: string | null;
  numRps?: number | null;
  gerarNfe?: boolean;
  codigoAcesso?: string | null;
  divisorId?: number | null;
  usuarioIdPedido?: number | null;
  atendenteNome?: string | null;
  itens: Array<{
    sequenciaItem: number;
    naturezaCodigo: number | null;
    naturezaDescricao: string | null;
    naturezaDescricaoOriginal?: string | null;
    livroCodigo: number | null;
    numLivro: number | null;
    livroAntigo: number | null;
    nomePesquisado: string | null;
    documentoPesquisado: string | null;
    descricaoItem: string | null;
    observacoesItem: string | null;
    dataPrevisaoIso: string | null;
    dataEmissaoIso: string | null;
    dataImpressaoIso: string | null;
    dataRetiradaIso: string | null;
    dataDevolucaoIso: string | null;
    motivoDevolucao: string | null;
    enderecoPesquisa: string | null;
    transcricaoOuLoteamento: string | null;
    existeNaTblWriReal: boolean;
    dataDigitacaoRealIso: string | null;
    dataBloqueioRealIso: string | null;
    resultadoPesquisaSistema?: number | null;
    qtdeImpressao?: number;
    assinaOnr?: boolean;
    usuarioIdItem?: number | null;
    atendenteItemNome?: string | null;
  }>;
  prenotacoesContraditorio: Array<{
    numPrenotacao: number;
    pkRecepcao: number;
    pkFlagRecepcao: number;
    pkSeqTitulo: number;
    numMatricula: number | null;
    tipoPrenotacaoCodigo: number | null;
    tipoPrenotacaoDescricao: string | null;
    protocoloMagnetico: string | null;
    dataRecepcaoIso: string | null;
    dataPrevisaoIso: string | null;
    naturezaTitulo: string | null;
    emProcessamentoAto: boolean;
  }>;
}

export interface ResultadoConsultaSomenteLeitura<T> {
  habilitado: boolean;
  sucesso: boolean;
  erroPermissaoSelect229: boolean;
  mensagemDiagnostico: string;
  registros: T[];
  duracaoMs: number;
}

function getReadOnlySqlConfig(): sql.config {
  const remoteCfg = runtimeDirective.getRemoteConfig();
  return {
    user: env.SQL_SERVER_USER,
    password: env.SQL_SERVER_PASSWORD,
    database: remoteCfg.sqlDatabase || env.SQL_SERVER_DATABASE,
    server: remoteCfg.sqlHost || env.SQL_SERVER_HOST,
    requestTimeout: 30000,
    connectionTimeout: 12000,
    pool: {
      max: 4,
      min: 0,
      idleTimeoutMillis: 20000,
    },
    options: {
      encrypt: false,
      trustServerCertificate: true,
      readOnlyIntent: true,
      requestTimeout: 30000,
    },
  };
}

export function isCartorioVirtualSqlReadOnlyEnabled(): boolean {
  return process.env.CARTORIO_VIRTUAL_SQL_ENABLED === 'true';
}

/**
 * Normaliza datas sentinela do SQL Server legado (ex: 1900-01-01 00:00:00.000 -> null).
 */
export function normalizarDataSqlLegada(val: unknown): string | null {
  if (!val) return null;
  const dt = val instanceof Date ? val : new Date(String(val));
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() <= 1900) return null;
  return dt.toISOString();
}

function limparTextoSql(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).replace(/\s+/g, ' ').trim();
  if (!s || s === '0') return null;
  return s;
}

/**
 * Consulta estritamente SOMENTE LEITURA dos pedidos recentes em `dbo.tblWRICertidao` (SQL Server 2012 SP4).
 */
export async function consultarPedidosCertidaoReadOnly(params: {
  apartirDeDataIso: string;
  limiteTop?: number;
}): Promise<ResultadoConsultaSomenteLeitura<PedidoCertidaoSqlRow>> {
  const inicio = Date.now();
  if (!isCartorioVirtualSqlReadOnlyEnabled()) {
    return {
      habilitado: false,
      sucesso: false,
      erroPermissaoSelect229: false,
      mensagemDiagnostico:
        'CARTORIO_VIRTUAL_SQL_ENABLED != true (adaptador somente leitura mantido desabilitado no conector).',
      registros: [],
      duracaoMs: 0,
    };
  }

  const topSeguro = Math.min(Math.max(Number(params.limiteTop || 100), 1), 500);
  let pool: sql.ConnectionPool | undefined;

  try {
    pool = await sql.connect(getReadOnlySqlConfig());
    const req = pool.request();
    req.input('DataCorte', sql.DateTime, new Date(params.apartirDeDataIso));
    req.input('TopN', sql.Int, topSeguro);

    const query = `
      SELECT TOP (@TopN)
        c.PK_NrPedido,
        c.ProtocoloEntidade,
        c.DataPedido,
        c.DataFinalRetirada,
        c.Enviar_Correio,
        c.NomeRequerente,
        c.FoneRequerente,
        c.EmailRequerente,
        c.QtdPedidos,
        c.VlrTotCer1,
        c.VlrTotCer2
      FROM dbo.tblWRICertidao AS c WITH (NOLOCK)
      WHERE c.PK_NrPedido > 0
        AND ISNULL(c.TipoPedido, 0) NOT IN (7, 8)
        AND c.DataPedido >= @DataCorte
      ORDER BY c.PK_NrPedido DESC;
    `;

    const res = await req.query(query);
    const rows = (res.recordset || []).map((r: any): PedidoCertidaoSqlRow => ({
      numeroPedido: Number(r.PK_NrPedido),
      protocoloExterno:
        r.ProtocoloEntidade && String(r.ProtocoloEntidade).trim() !== '0'
          ? String(r.ProtocoloEntidade).trim()
          : null,
      dataPedidoIso: normalizarDataSqlLegada(r.DataPedido),
      dataFinalRetiradaIso: normalizarDataSqlLegada(r.DataFinalRetirada),
      enviarCorreio: Boolean(r.Enviar_Correio),
      nomeRequerente: String(r.NomeRequerente || '').trim(),
      foneRequerente: r.FoneRequerente ? String(r.FoneRequerente).trim() : null,
      emailRequerente: r.EmailRequerente ? String(r.EmailRequerente).trim() : null,
      qtdPedidos: Number(r.QtdPedidos || 0),
      valorTotalCert1: Number(r.VlrTotCer1 || 0),
      valorTotalCert2: Number(r.VlrTotCer2 || 0),
    }));

    return {
      habilitado: true,
      sucesso: true,
      erroPermissaoSelect229: false,
      mensagemDiagnostico: `Leitura concluída (${rows.length} pedidos).`,
      registros: rows,
      duracaoMs: Date.now() - inicio,
    };
  } catch (err: any) {
    const numeroErroSql = Number(err?.number || 0);
    const ehErro229 =
      numeroErroSql === 229 ||
      String(err?.message || '').toLowerCase().includes('select permission was denied');

    logger.warn(
      `[CARTORIO_VIRTUAL_SQL] Falha na leitura somente-leitura (código SQL ${numeroErroSql || 'N/A'}).`
    );

    return {
      habilitado: true,
      sucesso: false,
      erroPermissaoSelect229: ehErro229,
      mensagemDiagnostico: ehErro229
        ? 'Permissão SELECT pendente em dbo.tblWRICertidao para o login somente leitura do FIORIX Connector (SQL Error 229).'
        : `Falha de comunicação SQL somente leitura: ${String(err?.message || err).slice(0, 160)}`,
      registros: [],
      duracaoMs: Date.now() - inicio,
    };
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
}

/**
 * Consulta estritamente SOMENTE LEITURA do Contraditório (prenotações pertinentes à matrícula)
 * nas tabelas `dbo.tblWRIReal`, `dbo.tblWRITitulosReal`, `dbo.tblWRITitulos` e `dbo.tblWRIRecepcao`.
 */
export async function consultarContraditorioPorMatriculaReadOnly(
  numeroMatricula: number
): Promise<ResultadoConsultaSomenteLeitura<PrenotacaoContraditorioSqlRow>> {
  const inicio = Date.now();
  if (!isCartorioVirtualSqlReadOnlyEnabled()) {
    return {
      habilitado: false,
      sucesso: false,
      erroPermissaoSelect229: false,
      mensagemDiagnostico: 'CARTORIO_VIRTUAL_SQL_ENABLED != true.',
      registros: [],
      duracaoMs: 0,
    };
  }

  if (!Number.isInteger(numeroMatricula) || numeroMatricula <= 0 || numeroMatricula === 99999999) {
    return {
      habilitado: true,
      sucesso: true,
      erroPermissaoSelect229: false,
      mensagemDiagnostico: 'Número de matrícula sentinela ou inválido ignorado com segurança.',
      registros: [],
      duracaoMs: 0,
    };
  }

  let pool: sql.ConnectionPool | undefined;
  try {
    pool = await sql.connect(getReadOnlySqlConfig());
    const req = pool.request();
    req.input('NumMatricula', sql.Int, numeroMatricula);

    const query = `
      SELECT
        @NumMatricula AS NumMatricula,
        rec.PK_Recepcao AS NumeroPrenotacao,
        rec.DtRecep AS DataRecepcao,
        tit.DescricaoComplementarDoTitulo AS NaturezaTitulo,
        CASE WHEN ISNULL(tit.QtdAtos, 0) > 0 AND tit.DataUltimoRegistro IS NULL THEN 1 ELSE 0 END AS AtoEmProcessamento,
        tp.TipoPrenotacao AS SituacaoTitulo
      FROM dbo.tblWRIReal AS realMat WITH (NOLOCK)
      INNER JOIN dbo.tblWRITitulosReal AS tr WITH (NOLOCK)
        ON tr.FK_tblWRIReal_Id = realMat.PK_Id
       AND tr.FK_tblWRIRecepcaoFlagRecepcao = 1
      INNER JOIN dbo.tblWRIRecepcao AS rec WITH (NOLOCK)
        ON rec.PK_Recepcao = tr.FK_tblWRIRecepcaoRecepcao
       AND rec.PK_FlagRecepcao = tr.FK_tblWRIRecepcaoFlagRecepcao
      LEFT JOIN dbo.tblWRITipoPrenotacao AS tp WITH (NOLOCK)
        ON tp.PK_ID = rec.TipoPrenotacao
      LEFT JOIN dbo.tblWRITitulos AS tit WITH (NOLOCK)
        ON tit.FK_tblWRIRecepcaoRecepcao = rec.PK_Recepcao
       AND tit.FK_tblWRIRecepcaoFlagRecepcao = rec.PK_FlagRecepcao
       AND tit.PK_SeqTitulo = tr.PK_SeqTitulo
      WHERE realMat.FK_tblWRILivro_Id = 2
        AND realMat.PK_Num_Livro = @NumMatricula
        AND ISNULL(LTRIM(RTRIM(rec.FlagCancelamento)), '') <> 'S'
        AND ISNULL(LTRIM(RTRIM(rec.FlagRetirada)), '') <> 'S'
        AND tit.DtRetirada IS NULL
        AND tit.DataUltimoRegistro IS NULL
      ORDER BY rec.PK_Recepcao ASC;
    `;

    const res = await req.query(query);
    const registros = (res.recordset || []).map((row: any): PrenotacaoContraditorioSqlRow => ({
      numeroMatricula: Number(row.NumMatricula),
      numeroPrenotacao: Number(row.NumeroPrenotacao),
      dataRecepcaoIso: normalizarDataSqlLegada(row.DataRecepcao),
      naturezaTitulo: row.NaturezaTitulo ? String(row.NaturezaTitulo).trim() : null,
      atoEmProcessamento: Boolean(row.AtoEmProcessamento),
      situacaoTitulo: row.SituacaoTitulo ? String(row.SituacaoTitulo).trim() : null,
    }));

    return {
      habilitado: true,
      sucesso: true,
      erroPermissaoSelect229: false,
      mensagemDiagnostico: `Contraditório consultado (${registros.length} prenotações ativas).`,
      registros,
      duracaoMs: Date.now() - inicio,
    };
  } catch (err: any) {
    const numeroErroSql = Number(err?.number || 0);
    const ehErro229 =
      numeroErroSql === 229 ||
      String(err?.message || '').toLowerCase().includes('select permission was denied');

    return {
      habilitado: true,
      sucesso: false,
      erroPermissaoSelect229: ehErro229,
      mensagemDiagnostico: ehErro229
        ? 'Permissão SELECT pendente nas tabelas de Contraditório (SQL Error 229).'
        : `Falha ao consultar Contraditório somente leitura: ${String(err?.message || err).slice(0, 160)}`,
      registros: [],
      duracaoMs: Date.now() - inicio,
    };
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
}

/**
 * Extrai em lote (estritamente SOMENTE LEITURA com WITH (NOLOCK)) os Pedidos de Certidão reais
 * de `SRVSQL\WEBRI` (excluindo Consultas Eletrônicas VM=7 e CE=8), seus itens (`tblWRICertidaoItens`),
 * endereços (`tblWRICertidaoItensImovel`), vínculo em `tblWRIReal` e todas as Prenotações em Contraditório
 * (`tblWRICertidaoResultadoContraditorio` + `tblWRITitulosReal` -> `tblWRIRecepcao` -> `tblWRITitulos`).
 */
export async function extrairLoteCompletoCartorioVirtualReadOnly(params?: {
  limiteTop?: number;
  minNrPedido?: number;
}): Promise<ResultadoConsultaSomenteLeitura<PedidoCompletoCartorioVirtualPayload>> {
  const inicio = Date.now();
  const topSeguro = Math.min(Math.max(Number(params?.limiteTop || 500), 1), 1500);
  const minFiltro = Number(params?.minNrPedido || 0);
  let pool: sql.ConnectionPool | undefined;

  try {
    pool = await sql.connect(getReadOnlySqlConfig());

    const reqOrders = pool.request();
    reqOrders.input('TopN', sql.Int, topSeguro);
    reqOrders.input('MinNrPedido', sql.Int, minFiltro);

    const ordersRes = await reqOrders.query(`
      SELECT TOP (@TopN)
        c.Pk_NrPedido,
        c.ProtocoloEntidade,
        c.DataPedido,
        c.DataPrevisao,
        c.DataFinalRetirada,
        c.Enviar_Correio,
        c.TipoPedido,
        tp.Descricao AS TipoPedidoDescricao,
        c.NomeRequerente,
        c.DocumentoRequerente,
        c.FoneRequerente,
        c.EmailRequerente,
        c.EnderecoRequerente,
        c.Numero AS NumeroEnderecoRequerente,
        c.CompEndereRequerente,
        c.BairroRequerente,
        c.VlrTotCer1,
        c.VlrTotCer2,
        c.VlrTotCer3,
        c.VlrTotCer4,
        c.VlrTotCer5,
        c.VlrTotCer6,
        c.VlrTotCer7,
        c.VlrTotTotal,
        c.VlrTotalDeposito,
        c.VlrTotalCompDep,
        c.VlrTotalCota,
        c.ObservacaoPedido,
        c.DescricaoDosItens,
        c.NumRPS,
        c.GerarNfe,
        c.ConsultaInternet,
        c.FK_tblSIPDivisores_IDDivisor,
        c.FK_tblSIPUsuarios_Id
      FROM dbo.tblWRICertidao c WITH (NOLOCK)
      LEFT JOIN dbo.tblWRITipoPedidoCertidao tp WITH (NOLOCK)
        ON tp.PK_Id = c.TipoPedido
      WHERE (
          (c.Pk_NrPedido > 0 AND c.Pk_NrPedido >= @MinNrPedido)
          OR c.Pk_NrPedido = 1321013
        )
        AND ISNULL(c.TipoPedido, 0) NOT IN (7, 8)
      ORDER BY CASE WHEN c.Pk_NrPedido = 1321013 THEN 1 ELSE 0 END DESC, c.Pk_NrPedido DESC;
    `);

    const orderRows: any[] = ordersRes.recordset || [];
    if (orderRows.length === 0) {
      return {
        habilitado: true,
        sucesso: true,
        erroPermissaoSelect229: false,
        mensagemDiagnostico: 'Nenhum pedido de certidão encontrado no intervalo informado.',
        registros: [],
        duracaoMs: Date.now() - inicio,
      };
    }

    const orderIds = orderRows.map((r) => Number(r.Pk_NrPedido));
    const orderIdsRecentes = orderIds.filter((id) => id !== 1321013);
    const minPedido =
      orderIdsRecentes.length > 0 ? Math.min(...orderIdsRecentes) : Math.min(...orderIds);
    const maxPedido = Math.max(...orderIds);
    const orderIdSet = new Set(orderIds);

    // 1.5. Resolução opcional de nomes de atendentes em dbo.tblSIPUsuarios (após GRANT SELECT)
    const mapaUsuariosPorId = new Map<number, string>();
    try {
      const usrRes = await pool
        .request()
        .query(`SELECT TOP (5000) * FROM dbo.tblSIPUsuarios WITH (NOLOCK);`);
      for (const u of usrRes.recordset || []) {
        const idVal = Number(
          u.PK_Id ?? u.PK_ID ?? u.Id ?? u.ID ?? u.PK_Usuario ?? u.IDUsuario ?? u.Codigo ?? 0
        );
        const nomeBruto = String(
          u.Apelido ?? u.Nome ?? u.NomeUsuario ?? u.Usuario ?? u.Login ?? ''
        ).trim();
        if (idVal > 0 && nomeBruto) {
          mapaUsuariosPorId.set(idVal, nomeBruto);
        }
      }
    } catch {
      // Caso dbo.tblSIPUsuarios ainda aguarde GRANT SELECT, segue normalmente sem interromper a sincronização
    }

    // 2. Itens + Natureza + Endereço + Real (Matrícula)
    const itemsRes = await pool
      .request()
      .input('MinPedido', sql.Int, minPedido)
      .input('MaxPedido', sql.Int, maxPedido)
      .query(`
        SELECT
          i.FK_tblWRICertidoes_NrPedido AS NrPedido,
          i.SeqNrPedido,
          i.FK_tblWRINaturezaCertidao_Id AS NaturezaId,
          n.TipoCertidao AS NaturezaDesc,
          i.FK_tblWRILivro_Id AS LivroId,
          i.Num_Livro,
          i.Livro_Antigo,
          i.Folha_Antigo,
          i.Nome AS NomePesquisado,
          i.NumeroDocto AS DocumentoPesquisado,
          i.DescricaoItem,
          i.Observacoes,
          i.DataPrevisao,
          i.DataEmissao,
          i.DtEmissaoCertidao,
          i.DtImpressaoCertidao,
          i.DataRetirada,
          i.DataDevolucao,
          i.MotivoDevolucao,
          i.ResultadoPesquisaSistema,
          i.QtdeImpressao,
          i.LinkONR,
          i.IdAssinadorWeb,
          i.AssinanteONR,
          i.FK_tblSIPUsuarios_Id AS UsuarioIdItem,
          im.Logradouro,
          im.Numero AS NumeroImovel,
          im.ComplNumero,
          im.Bairro,
          im.Contribuinte,
          im.NomeCondominio,
          im.Edificio,
          im.Apartamento,
          im.NomeLoteamento,
          im.Quadra,
          im.Lote,
          realMat.PK_Id AS RealPkId,
          realMat.DataDigitacao AS RealDataDigitacao,
          realMat.DataBloqueio AS RealDataBloqueio,
          realMat.DataBloqueioImpressaoCertidao AS RealDataBloqueioImpressao
        FROM dbo.tblWRICertidaoItens i WITH (NOLOCK)
        INNER JOIN dbo.tblWRICertidao c WITH (NOLOCK)
          ON c.Pk_NrPedido = i.FK_tblWRICertidoes_NrPedido
        LEFT JOIN dbo.tblWRINaturezaCertidao n WITH (NOLOCK)
          ON n.PK_Id = i.FK_tblWRINaturezaCertidao_Id
        LEFT JOIN dbo.tblWRICertidaoItensImovel im WITH (NOLOCK)
          ON im.FK_tblWRICertidoes_NrPedido = i.FK_tblWRICertidoes_NrPedido
         AND im.FK_tblWRISeqNrPedido = i.SeqNrPedido
        LEFT JOIN dbo.tblWRIReal realMat WITH (NOLOCK)
          ON realMat.FK_tblWRILivro_Id = 2
         AND realMat.PK_Num_Livro = i.Num_Livro
         AND i.Num_Livro > 0
         AND i.Num_Livro < 9999999
        WHERE (
            i.FK_tblWRICertidoes_NrPedido BETWEEN @MinPedido AND @MaxPedido
            OR i.FK_tblWRICertidoes_NrPedido = 1321013
          )
          AND ISNULL(c.TipoPedido, 0) NOT IN (7, 8)
        ORDER BY i.FK_tblWRICertidoes_NrPedido DESC, i.SeqNrPedido ASC;
      `);

    // 3. Contraditório Fonte A (tblWRICertidaoResultadoContraditorio)
    const contradARes = await pool
      .request()
      .input('MinPedido', sql.Int, minPedido)
      .input('MaxPedido', sql.Int, maxPedido)
      .query(`
        SELECT
          rc.FK_tblWRICertidoes_NrPedido AS NrPedido,
          rc.FK_tblWRISeqNrPedido AS SeqItem,
          rc.FK_tblWRILivro_Num_Livro AS NumPrenotacao,
          rec.PK_Recepcao,
          rec.PK_FlagRecepcao,
          rec.DtRecep,
          rec.DtPrenotacao,
          rec.DtExpiraPrn,
          rec.ProtocoloEntidade AS ProtocoloMagnetico,
          rec.TipoPrenotacao AS TipoPrenotacaoCodigo,
          tp.TipoPrenotacao AS TipoPrenotacaoDescricao,
          CAST(rec.Outorgante AS VARCHAR(300)) AS Outorgante,
          CAST(rec.Outorgado AS VARCHAR(300)) AS Outorgado,
          CAST(rec.Observacao AS VARCHAR(500)) AS ObservacaoRecepcao,
          tit.PK_SeqTitulo,
          tit.DtPrevisaoEntrega,
          tit.DtRetirada,
          tit.DtDevolucao,
          tit.DataUltimoRegistro,
          tit.QtdAtos,
          CAST(tit.Processo AS VARCHAR(120)) AS Processo,
          CAST(tit.Observacoes AS VARCHAR(500)) AS ObservacaoTitulo,
          CAST(tit.DescricaoComplementarDoTitulo AS VARCHAR(300)) AS NaturezaTitulo
        FROM dbo.tblWRICertidaoResultadoContraditorio rc WITH (NOLOCK)
        INNER JOIN dbo.tblWRICertidao c WITH (NOLOCK)
          ON c.Pk_NrPedido = rc.FK_tblWRICertidoes_NrPedido
        LEFT JOIN dbo.tblWRIRecepcao rec WITH (NOLOCK)
          ON rec.PK_Recepcao = rc.FK_tblWRILivro_Num_Livro
         AND rec.PK_FlagRecepcao = 1
        LEFT JOIN dbo.tblWRITipoPrenotacao tp WITH (NOLOCK)
          ON tp.PK_ID = rec.TipoPrenotacao
        LEFT JOIN dbo.tblWRITitulos tit WITH (NOLOCK)
          ON tit.FK_tblWRIRecepcaoRecepcao = rec.PK_Recepcao
         AND tit.FK_tblWRIRecepcaoFlagRecepcao = rec.PK_FlagRecepcao
         AND tit.PK_SeqTitulo = 1
        WHERE (
            rc.FK_tblWRICertidoes_NrPedido BETWEEN @MinPedido AND @MaxPedido
            OR rc.FK_tblWRICertidoes_NrPedido = 1321013
          )
          AND ISNULL(c.TipoPedido, 0) NOT IN (7, 8)
          AND ISNULL(rc.Excluido, 0) = 0
          AND rc.FK_tblWRILivro_Id = 1
          AND rc.FK_tblWRILivro_Num_Livro > 0;
      `);

    // 4. Contraditório Fonte B (Prenotações ativas na matrícula em tblWRIReal -> tblWRITitulosReal -> tblWRIRecepcao)
    const contradBRes = await pool
      .request()
      .input('MinPedido', sql.Int, minPedido)
      .input('MaxPedido', sql.Int, maxPedido)
      .query(`
        SELECT DISTINCT
          i.FK_tblWRICertidoes_NrPedido AS NrPedido,
          i.SeqNrPedido AS SeqItem,
          i.Num_Livro AS NumMatricula,
          rec.PK_Recepcao AS NumPrenotacao,
          rec.PK_Recepcao,
          rec.PK_FlagRecepcao,
          rec.DtRecep,
          rec.DtPrenotacao,
          rec.DtExpiraPrn,
          rec.ProtocoloEntidade AS ProtocoloMagnetico,
          rec.TipoPrenotacao AS TipoPrenotacaoCodigo,
          tp.TipoPrenotacao AS TipoPrenotacaoDescricao,
          CAST(rec.Outorgante AS VARCHAR(300)) AS Outorgante,
          CAST(rec.Outorgado AS VARCHAR(300)) AS Outorgado,
          CAST(rec.Observacao AS VARCHAR(500)) AS ObservacaoRecepcao,
          tit.PK_SeqTitulo,
          tit.DtPrevisaoEntrega,
          tit.DtRetirada,
          tit.DtDevolucao,
          tit.DataUltimoRegistro,
          tit.QtdAtos,
          CAST(tit.Processo AS VARCHAR(120)) AS Processo,
          CAST(tit.Observacoes AS VARCHAR(500)) AS ObservacaoTitulo,
          CAST(tit.DescricaoComplementarDoTitulo AS VARCHAR(300)) AS NaturezaTitulo
        FROM dbo.tblWRICertidaoItens i WITH (NOLOCK)
        INNER JOIN dbo.tblWRICertidao c WITH (NOLOCK)
          ON c.Pk_NrPedido = i.FK_tblWRICertidoes_NrPedido
        INNER JOIN dbo.tblWRIReal realMat WITH (NOLOCK)
          ON realMat.FK_tblWRILivro_Id = 2
         AND realMat.PK_Num_Livro = i.Num_Livro
        INNER JOIN dbo.tblWRITitulosReal tr WITH (NOLOCK)
          ON tr.FK_tblWRIReal_Id = realMat.PK_Id
         AND tr.FK_tblWRIRecepcaoFlagRecepcao = 1
        INNER JOIN dbo.tblWRIRecepcao rec WITH (NOLOCK)
          ON rec.PK_Recepcao = tr.FK_tblWRIRecepcaoRecepcao
         AND rec.PK_FlagRecepcao = tr.FK_tblWRIRecepcaoFlagRecepcao
        LEFT JOIN dbo.tblWRITipoPrenotacao tp WITH (NOLOCK)
          ON tp.PK_ID = rec.TipoPrenotacao
        LEFT JOIN dbo.tblWRITitulos tit WITH (NOLOCK)
          ON tit.FK_tblWRIRecepcaoRecepcao = rec.PK_Recepcao
         AND tit.FK_tblWRIRecepcaoFlagRecepcao = rec.PK_FlagRecepcao
         AND tit.PK_SeqTitulo = tr.PK_SeqTitulo
        WHERE i.FK_tblWRICertidoes_NrPedido BETWEEN @MinPedido AND @MaxPedido
          AND ISNULL(c.TipoPedido, 0) NOT IN (7, 8)
          AND i.FK_tblWRILivro_Id = 2
          AND i.Num_Livro > 0
          AND i.Num_Livro < 9999999
          AND ISNULL(LTRIM(RTRIM(rec.FlagCancelamento)), '') <> 'S'
          AND ISNULL(LTRIM(RTRIM(rec.FlagRetirada)), '') <> 'S'
          AND tit.DtRetirada IS NULL
          AND tit.DataUltimoRegistro IS NULL
          AND rec.DtRecep >= '2025-01-01';
      `);

    const itensPorPedido = new Map<number, PedidoCompletoCartorioVirtualPayload['itens']>();
    for (const row of itemsRes.recordset || []) {
      const nr = Number(row.NrPedido);
      if (!orderIdSet.has(nr)) continue;
      const lista = itensPorPedido.get(nr) || [];

      const partesEnd = [
        limparTextoSql(row.Logradouro),
        limparTextoSql(row.NumeroImovel) ? `nº ${limparTextoSql(row.NumeroImovel)}` : null,
        limparTextoSql(row.ComplNumero),
        limparTextoSql(row.Edificio) ? `Ed. ${limparTextoSql(row.Edificio)}` : null,
        limparTextoSql(row.Apartamento) ? `Apto ${limparTextoSql(row.Apartamento)}` : null,
        limparTextoSql(row.NomeCondominio),
        limparTextoSql(row.Bairro),
        limparTextoSql(row.Contribuinte) ? `SQL ${limparTextoSql(row.Contribuinte)}` : null,
      ].filter(Boolean);

      const partesTransc = [
        row.Livro_Antigo && Number(row.Livro_Antigo) > 0
          ? `Transcrição nº ${Number(row.Livro_Antigo)}${
              row.Folha_Antigo ? ` (Fl. ${row.Folha_Antigo})` : ''
            }`
          : null,
        limparTextoSql(row.NomeLoteamento)
          ? `Loteamento ${limparTextoSql(row.NomeLoteamento)}`
          : null,
        limparTextoSql(row.Quadra) ? `Quadra ${limparTextoSql(row.Quadra)}` : null,
        limparTextoSql(row.Lote) ? `Lote ${limparTextoSql(row.Lote)}` : null,
      ].filter(Boolean);

      const usuarioIdItem = row.UsuarioIdItem != null ? Number(row.UsuarioIdItem) : null;
      const linkOnr = limparTextoSql(row.LinkONR);
      const idAssinadorWeb = limparTextoSql(row.IdAssinadorWeb);
      const assinanteOnr = limparTextoSql(row.AssinanteONR);

      lista.push({
        sequenciaItem: Number(row.SeqNrPedido || 1),
        naturezaCodigo: row.NaturezaId != null ? Number(row.NaturezaId) : null,
        naturezaDescricao: limparTextoSql(row.NaturezaDesc),
        naturezaDescricaoOriginal: row.NaturezaDesc ? String(row.NaturezaDesc).trim() : null,
        livroCodigo: row.LivroId != null ? Number(row.LivroId) : null,
        numLivro: row.Num_Livro != null ? Number(row.Num_Livro) : null,
        livroAntigo: row.Livro_Antigo != null ? Number(row.Livro_Antigo) : null,
        nomePesquisado: limparTextoSql(row.NomePesquisado),
        documentoPesquisado: limparTextoSql(row.DocumentoPesquisado),
        descricaoItem: limparTextoSql(row.DescricaoItem),
        observacoesItem: limparTextoSql(row.Observacoes),
        dataPrevisaoIso: normalizarDataSqlLegada(row.DataPrevisao),
        dataEmissaoIso: normalizarDataSqlLegada(row.DataEmissao || row.DtEmissaoCertidao),
        dataImpressaoIso: normalizarDataSqlLegada(row.DtImpressaoCertidao),
        dataRetiradaIso: normalizarDataSqlLegada(row.DataRetirada),
        dataDevolucaoIso: normalizarDataSqlLegada(row.DataDevolucao),
        motivoDevolucao: limparTextoSql(row.MotivoDevolucao),
        enderecoPesquisa: partesEnd.length > 0 ? partesEnd.join(', ') : null,
        transcricaoOuLoteamento: partesTransc.length > 0 ? partesTransc.join(' • ') : null,
        existeNaTblWriReal: Boolean(row.RealPkId),
        dataDigitacaoRealIso: normalizarDataSqlLegada(row.RealDataDigitacao),
        dataBloqueioRealIso: normalizarDataSqlLegada(
          row.RealDataBloqueio || row.RealDataBloqueioImpressao
        ),
        resultadoPesquisaSistema:
          row.ResultadoPesquisaSistema != null ? Number(row.ResultadoPesquisaSistema) : null,
        qtdeImpressao: Number(row.QtdeImpressao || 0),
        assinaOnr: Boolean(linkOnr || idAssinadorWeb || assinanteOnr),
        usuarioIdItem,
        atendenteItemNome:
          usuarioIdItem && mapaUsuariosPorId.has(usuarioIdItem)
            ? mapaUsuariosPorId.get(usuarioIdItem) || null
            : null,
      });
      itensPorPedido.set(nr, lista);
    }

    const contradPorPedido = new Map<
      number,
      PedidoCompletoCartorioVirtualPayload['prenotacoesContraditorio']
    >();

    const registrarPrenotacao = (row: any) => {
      const nr = Number(row.NrPedido);
      const numPren = Number(row.NumPrenotacao || 0);
      if (!orderIdSet.has(nr) || numPren <= 0) return;
      const lista = contradPorPedido.get(nr) || [];
      if (lista.some((x) => x.numPrenotacao === numPren)) return;

      const matDoPedido = itensPorPedido.get(nr)?.[0]?.numLivro ?? null;
      const numMat =
        row.NumMatricula && Number(row.NumMatricula) > 0 && Number(row.NumMatricula) < 9999999
          ? Number(row.NumMatricula)
          : matDoPedido && matDoPedido > 0 && matDoPedido < 9999999
          ? matDoPedido
          : null;

      const outorgante = limparTextoSql(row.Outorgante);
      const outorgado = limparTextoSql(row.Outorgado);
      const obsRec = limparTextoSql(row.ObservacaoRecepcao || row.ObservacaoTitulo);
      const proc = limparTextoSql(row.Processo);
      const natRaw = limparTextoSql(row.NaturezaTitulo);
      const natEhHashHex = Boolean(natRaw && /^[0-9A-F]{12}$/i.test(natRaw));

      const partesDetalhe: string[] = [];
      if (natRaw && !natEhHashHex) partesDetalhe.push(natRaw);
      if (outorgante && outorgado && outorgante !== outorgado) {
        partesDetalhe.push(`${outorgante} → ${outorgado}`);
      } else if (outorgante) {
        partesDetalhe.push(`Outorgante: ${outorgante}`);
      } else if (outorgado) {
        partesDetalhe.push(`Outorgado: ${outorgado}`);
      }
      if (proc) partesDetalhe.push(`Proc.: ${proc}`);
      if (obsRec) partesDetalhe.push(obsRec);

      lista.push({
        numPrenotacao: numPren,
        pkRecepcao: Number(row.PK_Recepcao || numPren),
        pkFlagRecepcao: Number(row.PK_FlagRecepcao || 1),
        pkSeqTitulo: Number(row.PK_SeqTitulo || 1),
        numMatricula: numMat,
        tipoPrenotacaoCodigo:
          row.TipoPrenotacaoCodigo != null ? Number(row.TipoPrenotacaoCodigo) : null,
        tipoPrenotacaoDescricao: limparTextoSql(row.TipoPrenotacaoDescricao) || 'PRENOTADO',
        protocoloMagnetico: limparTextoSql(row.ProtocoloMagnetico),
        dataRecepcaoIso: normalizarDataSqlLegada(row.DtRecep || row.DtPrenotacao),
        dataPrevisaoIso: normalizarDataSqlLegada(row.DtPrevisaoEntrega || row.DtExpiraPrn),
        naturezaTitulo:
          partesDetalhe.join(' • ') ||
          limparTextoSql(row.TipoPrenotacaoDescricao) ||
          'Título em Contraditório',
        emProcessamentoAto:
          Number(row.QtdAtos || 0) > 0 &&
          !row.DataUltimoRegistro &&
          !row.DtRetirada &&
          !row.DtDevolucao,
      });
      contradPorPedido.set(nr, lista);
    };

    for (const r of contradARes.recordset || []) registrarPrenotacao(r);
    for (const r of contradBRes.recordset || []) registrarPrenotacao(r);

    const payloadFinal: PedidoCompletoCartorioVirtualPayload[] = orderRows.map((r) => {
      const nr = Number(r.Pk_NrPedido);
      const v1 = Number(r.VlrTotCer1 || 0);
      const vTotal = Number(r.VlrTotTotal || 0);
      const vCota = Number(r.VlrTotalCota || 0);
      const vComp = Number(r.VlrTotalCompDep || 0);
      const vDep = Number(r.VlrTotalDeposito || 0);

      const valorDespesa =
        Number(r.VlrTotCer2 || 0) +
        Number(r.VlrTotCer3 || 0) +
        Number(r.VlrTotCer4 || 0) +
        Number(r.VlrTotCer5 || 0) +
        Number(r.VlrTotCer6 || 0) +
        Number(r.VlrTotCer7 || 0);

      const valorServico = v1 > 0 ? v1 : vTotal || vCota || vComp || vDep || 0;
      const totalDeposito = vComp || vDep || vTotal || vCota || valorServico + valorDespesa;

      const endReq = [
        limparTextoSql(r.EnderecoRequerente),
        limparTextoSql(r.NumeroEnderecoRequerente),
        limparTextoSql(r.CompEndereRequerente),
        limparTextoSql(r.BairroRequerente),
      ]
        .filter(Boolean)
        .join(', ');

      const usuarioIdPedido =
        r.FK_tblSIPUsuarios_Id != null ? Number(r.FK_tblSIPUsuarios_Id) : null;
      const atendenteNome =
        usuarioIdPedido && mapaUsuariosPorId.has(usuarioIdPedido)
          ? mapaUsuariosPorId.get(usuarioIdPedido) || null
          : null;

      return {
        numeroPedido: nr,
        protocoloExterno: limparTextoSql(r.ProtocoloEntidade),
        dataPedidoIso: normalizarDataSqlLegada(r.DataPedido),
        dataPrevisaoIso: normalizarDataSqlLegada(r.DataPrevisao),
        dataFinalRetiradaIso: normalizarDataSqlLegada(r.DataFinalRetirada),
        enviarCorreio: Boolean(r.Enviar_Correio),
        tipoPedido: Number(r.TipoPedido || 0),
        tipoPedidoDescricao: limparTextoSql(r.TipoPedidoDescricao),
        nomeRequerente: limparTextoSql(r.NomeRequerente) || 'Não informado',
        documentoRequerente: limparTextoSql(r.DocumentoRequerente),
        foneRequerente: limparTextoSql(r.FoneRequerente),
        emailRequerente: limparTextoSql(r.EmailRequerente),
        enderecoRequerente: endReq || null,
        valorServico: Math.round(valorServico * 100) / 100,
        valorDespesa: Math.round(valorDespesa * 100) / 100,
        totalDeposito: Math.round(totalDeposito * 100) / 100,
        observacoesOrigem: limparTextoSql(r.ObservacaoPedido),
        descricaoDosItens: limparTextoSql(r.DescricaoDosItens),
        numRps: r.NumRPS != null && Number(r.NumRPS) > 0 ? Number(r.NumRPS) : null,
        gerarNfe: r.GerarNfe !== undefined && r.GerarNfe !== null ? Boolean(r.GerarNfe) : true,
        codigoAcesso: limparTextoSql(r.ConsultaInternet),
        divisorId:
          r.FK_tblSIPDivisores_IDDivisor != null
            ? Number(r.FK_tblSIPDivisores_IDDivisor)
            : null,
        usuarioIdPedido,
        atendenteNome,
        itens: itensPorPedido.get(nr) || [],
        prenotacoesContraditorio: contradPorPedido.get(nr) || [],
      };
    });

    return {
      habilitado: true,
      sucesso: true,
      erroPermissaoSelect229: false,
      mensagemDiagnostico: `Extraídos ${payloadFinal.length} pedidos oficiais com Contraditório.`,
      registros: payloadFinal,
      duracaoMs: Date.now() - inicio,
    };
  } catch (err: any) {
    const numeroErroSql = Number(err?.number || 0);
    const ehErro229 =
      numeroErroSql === 229 ||
      String(err?.message || '').toLowerCase().includes('select permission was denied');

    logger.warn(
      `[CARTORIO_VIRTUAL_SQL] Falha na extração completa somente-leitura (código SQL ${numeroErroSql || 'N/A'}): ${err?.message}`
    );

    return {
      habilitado: true,
      sucesso: false,
      erroPermissaoSelect229: ehErro229,
      mensagemDiagnostico: ehErro229
        ? 'Permissão SELECT pendente nas tabelas do Cartório Virtual (SQL Error 229).'
        : `Falha na extração somente leitura: ${String(err?.message || err).slice(0, 180)}`,
      registros: [],
      duracaoMs: Date.now() - inicio,
    };
  } finally {
    if (pool) {
      await pool.close().catch(() => {});
    }
  }
}
