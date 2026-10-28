/* PREPARED ONLY — DO NOT APPLY AUTOMATICALLY. All statements are read-only. */

CREATE PROCEDURE dbo.pr_Fiorix_BI_Incremental
  @DataInicial varchar(10),
  @DataFinal varchar(10),
  @Flag int = 0,
  @CursorValue datetime2(3) = NULL,
  @OverlapMinutes int = 5
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @DtIni date = ISNULL(TRY_CONVERT(date, @DataInicial, 103), TRY_CONVERT(date, @DataInicial, 23));
  DECLARE @DtFim date = ISNULL(TRY_CONVERT(date, @DataFinal, 103), TRY_CONVERT(date, @DataFinal, 23));
  DECLARE @CursorStart datetime2(3) = CASE WHEN @CursorValue IS NULL THEN NULL ELSE DATEADD(minute, -@OverlapMinutes, @CursorValue) END;

  SELECT
    CONVERT(varchar(64), HASHBYTES('SHA2_256', CONCAT('bi:', Recp.PK_Recepcao, ':', Tit.PK_SeqTitulo)), 2) AS record_key,
    CONVERT(datetime2(3), Tit.DataDoTituloApresentado) AS cursor_value,
    CONCAT(Recp.PK_Recepcao, ':', Tit.PK_SeqTitulo) AS secondary_cursor,
    Recp.PK_Recepcao AS PROTOCOLO,
    Tit.PK_SeqTitulo AS SEQ_TITULO,
    Tit.DataDoTituloApresentado AS DATA_ENTRADA,
    TPT.TipoPrenotacao AS TIPO,
    CASE
      WHEN Tit.DtDevolucao IS NOT NULL THEN 'Em dia'
      WHEN Tit.DataUltimoRegistro IS NULL AND Tit.DtPrevisaoEntrega < GETDATE() THEN 'Atrasado'
      WHEN Tit.DataUltimoRegistro IS NOT NULL AND CAST(Tit.DataUltimoRegistro AS date) <= CAST(Tit.DtPrevisaoEntrega AS date) THEN 'Em dia'
      WHEN Tit.DataUltimoRegistro IS NOT NULL AND CAST(Tit.DataUltimoRegistro AS date) > CAST(Tit.DtPrevisaoEntrega AS date) THEN 'Atrasado'
      ELSE 'Em dia'
    END AS STATUS,
    CASE
      WHEN Tit.DtDevolucao IS NOT NULL THEN 0
      WHEN Tit.DataUltimoRegistro IS NULL AND Tit.DtPrevisaoEntrega < GETDATE() THEN DATEDIFF(day, CAST(Tit.DtPrevisaoEntrega AS date), CAST(GETDATE() AS date))
      WHEN Tit.DataUltimoRegistro IS NOT NULL AND CAST(Tit.DataUltimoRegistro AS date) <= CAST(Tit.DtPrevisaoEntrega AS date) THEN 0
      WHEN Tit.DataUltimoRegistro IS NOT NULL THEN DATEDIFF(day, CAST(Tit.DtPrevisaoEntrega AS date), CAST(Tit.DataUltimoRegistro AS date))
      ELSE 0
    END AS ATRASO_DIAS,
    CASE WHEN Tit.DtDevolucao IS NOT NULL THEN 'DEVOLVIDO' ELSE 'REGISTRADO' END AS SERVICO
  FROM dbo.tblWRIRecepcao Recp
  INNER JOIN dbo.tblWRITitulos Tit ON Tit.FK_tblWRIRecepcaoRecepcao = Recp.PK_Recepcao
  LEFT JOIN dbo.tblWRITipoPrenotacao TPT ON TPT.PK_ID = Recp.TipoPrenotacao
  WHERE CAST(Tit.DataDoTituloApresentado AS date) BETWEEN @DtIni AND @DtFim
    AND (@CursorStart IS NULL OR Tit.DataDoTituloApresentado >= @CursorStart)
  ORDER BY Tit.DataDoTituloApresentado, Recp.PK_Recepcao, Tit.PK_SeqTitulo;
END;
GO

CREATE PROCEDURE dbo.pr_Fiorix_BI_Produtividade_Incremental
  @DataInicial varchar(10),
  @DataFinal varchar(10),
  @IDCaixa varchar(3) = '0',
  @CursorValue datetime2(3) = NULL,
  @OverlapMinutes int = 5
AS
BEGIN
  SET NOCOUNT ON;
  SET DATEFIRST 1;
  DECLARE @CursorStart datetime2(3) = CASE WHEN @CursorValue IS NULL THEN NULL ELSE DATEADD(minute, -@OverlapMinutes, @CursorValue) END;

  SELECT
    CONVERT(varchar(64), HASHBYTES('SHA2_256', CONCAT(
      'produtividade:', CONVERT(varchar(33), X.CursorValue, 126), ':', a.NumeroDocumento, ':', a.FlagDocumento, ':', a.FK_tblWRIHistorico_Id
    )), 2) AS record_key,
    X.CursorValue AS cursor_value,
    CONCAT(a.NumeroDocumento, ':', a.FlagDocumento, ':', a.FK_tblWRIHistorico_Id) AS secondary_cursor,
    CONVERT(date, a.FK_tblWRICaixaDiarioSintetico_DataMovto) AS [data],
    CONVERT(varchar(5), a.HoraAutenticacao, 108) AS [hora],
    CASE DATEPART(weekday, a.FK_tblWRICaixaDiarioSintetico_DataMovto)
      WHEN 1 THEN 'Segunda' WHEN 2 THEN 'Terça' WHEN 3 THEN 'Quarta'
      WHEN 4 THEN 'Quinta' WHEN 5 THEN 'Sexta' WHEN 6 THEN 'Sábado' WHEN 7 THEN 'Domingo'
    END AS dia_semana,
    DATEPART(hour, a.HoraAutenticacao) AS hora_num,
    a.NumeroDocumento AS pedido,
    a.NumeroDocumento,
    a.FlagDocumento,
    a.FK_tblWRIHistorico_Id,
    ISNULL(usuProto.NomeUser, u.NomeUser) AS nome,
    CASE WHEN a.FlagDocumento = 1 THEN 'TÍTULO' WHEN a.FlagDocumento = 2 THEN 'CERTIDÃO' ELSE 'OUTROS' END AS tipo,
    CASE
      WHEN a.FlagDocumento = 2 THEN ISNULL(TPCert.Descricao, 'CERTIDÃO')
      WHEN a.FlagDocumento = 1 THEN ISNULL(TPTit.TipoPrenotacao, h.Descricao)
      ELSE h.Descricao
    END AS tipo_pedido,
    h.Descricao AS tipo_detalhado
  FROM dbo.tblWRICaixaAutenticacao a
  INNER JOIN dbo.tblWRICaixas c ON c.PK_ID = a.FK_tblWRICaixas_Id
  INNER JOIN dbo.tblSIPUsuarios u ON u.IDUser = c.FK_tblSIPUsuarios_IDUser
  INNER JOIN dbo.tblWRICaixaHistorico h ON h.PK_ID = a.FK_tblWRIHistorico_Id
  LEFT JOIN dbo.tblWRICertidao Cert ON Cert.Pk_NrPedido = a.NumeroDocumento AND a.FlagDocumento = 2
  LEFT JOIN dbo.tblWRITipoPedidoCertidao TPCert ON TPCert.PK_ID = Cert.TipoPedido
  LEFT JOIN dbo.tblWRIRecepcao Recp ON Recp.PK_Recepcao = a.NumeroDocumento AND a.FlagDocumento = 1
  LEFT JOIN dbo.tblWRITipoPrenotacao TPTit ON TPTit.PK_ID = Recp.TipoPrenotacao
  OUTER APPLY (
    SELECT TOP 1 Andam.FK_tblWRIUsuarioOrigem_Id
    FROM dbo.tblWRIAndamentos Andam
    WHERE Andam.FK_tblWRIRecepcaoRecepcao = Recp.PK_Recepcao
      AND Andam.FK_tblWRIRecepcaoFlagRecepcao = 1
      AND Andam.Observacao LIKE '%Novo Protocolo%'
    ORDER BY Andam.Data, Andam.FK_tblWRIUsuarioOrigem_Id
  ) proto
  LEFT JOIN dbo.tblSIPUsuarios usuProto ON usuProto.IDUser = proto.FK_tblWRIUsuarioOrigem_Id
  CROSS APPLY (VALUES (
    TRY_CONVERT(datetime2(3), CONCAT(
      CONVERT(char(10), a.FK_tblWRICaixaDiarioSintetico_DataMovto, 23), ' ',
      CONVERT(varchar(12), a.HoraAutenticacao, 114)
    ), 121)
  )) X(CursorValue)
  WHERE a.FK_tblWRICaixaDiarioSintetico_DataMovto >= CONVERT(datetime, @DataInicial, 103)
    AND a.FK_tblWRICaixaDiarioSintetico_DataMovto < DATEADD(day, 1, CONVERT(datetime, @DataFinal, 103))
    AND (@CursorStart IS NULL OR X.CursorValue >= @CursorStart)
    AND ISNULL(a.Estornado, 0) = 0
    AND a.FK_tblWRICaixas_Id = CASE WHEN @IDCaixa <> '0' THEN @IDCaixa ELSE a.FK_tblWRICaixas_Id END
  ORDER BY X.CursorValue, a.NumeroDocumento, a.FlagDocumento, a.FK_tblWRIHistorico_Id;
END;
GO

/*
  dbo.pr_Fiorix_BI_METAS_Incremental is intentionally not generated here.
  Its output depends on aggregates over all tblWRIAndamentos plus mutable title,
  reception and GETDATE-derived state. A cursor-only implementation would miss
  legitimate updates; this source remains reconciliation_required.
*/

CREATE PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental
  @DataInicial date = NULL,
  @DataFinal date = NULL,
  @SomenteAbertas bit = 1,
  @CursorValue datetime2(3) = NULL,
  @OverlapMinutes int = 5
AS
BEGIN
  SET NOCOUNT ON;
  CREATE TABLE #Tarefas (
    PROTOCOLO int NOT NULL, SEQ_TITULO smallint NOT NULL, DATA_ENTRADA smalldatetime NULL,
    DT_PREVISAO date NULL, DIAS_PARA_PREVISAO int NULL, STATUS_PREVISAO varchar(15) NOT NULL,
    NIVEL_RISCO varchar(7) NOT NULL, ID_SERVICO int NOT NULL, NUMERO_SERVICO int NOT NULL,
    ITEM_SERVICO smallint NULL, DATA_SERVICO datetime NOT NULL, VENCIMENTO_SERVICO datetime NULL,
    ID_TIPO_SERVICO smallint NOT NULL, CODIGO_TIPO_SERVICO smallint NOT NULL, ID_NATUREZA_CDS int NULL,
    ID_TAREFA int NOT NULL, TAREFA varchar(50) NOT NULL, DATA_CADASTRO_TAREFA datetime NOT NULL,
    ID_HISTORICO int NULL, STATUS_TAREFA smallint NULL, DATA_ABERTURA datetime NULL,
    DATA_FINALIZACAO datetime NULL, SITUACAO_TAREFA varchar(12) NOT NULL, ID_USUARIO int NULL,
    RESPONSAVEL varchar(50) NULL, USUARIO_ATIVO bit NULL, TIPO varchar(100) NULL,
    NATUREZA varchar(50) NULL, ID_NATUREZA smallint NULL, DtDevolucao smalldatetime NULL,
    DtRetirada smalldatetime NULL
  );

  INSERT INTO #Tarefas
  EXEC dbo.pr_Fiorix_BI_TAREFAS @DataInicial=@DataInicial, @DataFinal=@DataFinal, @SomenteAbertas=@SomenteAbertas;

  DECLARE @CursorStart datetime2(3) = CASE WHEN @CursorValue IS NULL THEN NULL ELSE DATEADD(minute, -@OverlapMinutes, @CursorValue) END;
  SELECT
    CONVERT(varchar(64), HASHBYTES('SHA2_256', CONCAT('tarefas:', T.ID_TAREFA, ':', ISNULL(T.ID_HISTORICO, 0))), 2) AS record_key,
    C.cursor_value,
    CONCAT(T.ID_TAREFA, ':', ISNULL(T.ID_HISTORICO, 0)) AS secondary_cursor,
    T.*
  FROM #Tarefas T
  CROSS APPLY (
    SELECT MAX(V.valor) AS cursor_value
    FROM (VALUES
      (CONVERT(datetime2(3), T.DATA_CADASTRO_TAREFA)),
      (CONVERT(datetime2(3), T.DATA_ABERTURA)),
      (CONVERT(datetime2(3), T.DATA_FINALIZACAO)),
      (CONVERT(datetime2(3), T.DATA_SERVICO))
    ) V(valor)
  ) C
  WHERE @CursorStart IS NULL OR C.cursor_value >= @CursorStart
  ORDER BY C.cursor_value, T.ID_TAREFA, T.ID_HISTORICO;
END;
GO

/* =========================================================================
   TRUE INCREMENTAL V2 (PREPARED ONLY - DO NOT APPLY IN WEBRI AUTOMATICALLY)
   Eliminates temporary table materialization and global history table scan.
   ========================================================================= */

CREATE PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2
  @DataInicial date = NULL,
  @DataFinal date = NULL,
  @SomenteAbertas bit = 1,
  @CursorValue datetime2(3) = NULL,
  @OverlapMinutes int = 5
AS
BEGIN
  SET NOCOUNT ON;

  SET @DataInicial = ISNULL(@DataInicial, CAST(GETDATE() AS date));
  SET @DataFinal = ISNULL(@DataFinal, DATEADD(day, 15, CAST(GETDATE() AS date)));

  DECLARE @CursorStart datetime2(3) = CASE WHEN @CursorValue IS NULL THEN NULL ELSE DATEADD(minute, -@OverlapMinutes, @CursorValue) END;

  ;WITH TarefasCandidatas AS
  (
    SELECT H.FK_tblCDSTarefa_Id AS ID_TAREFA
    FROM dbo.tblCDSTarefaHistorico H
    WHERE @CursorStart IS NOT NULL
      AND (H.DataAbertura >= @CursorStart OR H.DataFinalizacao >= @CursorStart)
    UNION
    SELECT T.PK_Id AS ID_TAREFA
    FROM dbo.tblCDSTarefa T
    INNER JOIN dbo.tblCDSServico S ON S.PK_Id = T.FK_tblCDSServico_Id
    WHERE @CursorStart IS NOT NULL
      AND (T.DataCadastro >= @CursorStart OR S.DataCadastro >= @CursorStart)
  ),
  HistoricoAtual AS
  (
    SELECT
      H.PK_Id AS ID_HISTORICO,
      H.FK_tblCDSTarefa_Id,
      H.FK_tblCDSUsuario_Id,
      H.Status,
      H.DataAbertura,
      H.DataFinalizacao,
      ROW_NUMBER() OVER
      (
        PARTITION BY H.FK_tblCDSTarefa_Id
        ORDER BY
          H.DataAbertura DESC,
          H.PK_Id DESC
      ) AS RN
    FROM dbo.tblCDSTarefaHistorico H
    WHERE @CursorStart IS NULL
       OR H.FK_tblCDSTarefa_Id IN (SELECT TC.ID_TAREFA FROM TarefasCandidatas TC)
  )
  SELECT
    CONVERT(varchar(64), HASHBYTES('SHA2_256', CONCAT('tarefas:', T.PK_Id, ':', ISNULL(H.ID_HISTORICO, 0))), 2) AS record_key,
    C.cursor_value,
    CONCAT(T.PK_Id, ':', ISNULL(H.ID_HISTORICO, 0)) AS secondary_cursor,
    Tit.FK_tblWRIRecepcaoRecepcao AS PROTOCOLO,
    Tit.PK_SeqTitulo AS SEQ_TITULO,
    Tit.DataDoTituloApresentado AS DATA_ENTRADA,
    CAST(Tit.DtPrevisaoEntrega AS date) AS DT_PREVISAO,
    DATEDIFF(day, CAST(GETDATE() AS date), CAST(Tit.DtPrevisaoEntrega AS date)) AS DIAS_PARA_PREVISAO,
    CASE
      WHEN CAST(Tit.DtPrevisaoEntrega AS date) < CAST(GETDATE() AS date) THEN 'ATRASADO'
      WHEN CAST(Tit.DtPrevisaoEntrega AS date) = CAST(GETDATE() AS date) THEN 'VENCE HOJE'
      WHEN CAST(Tit.DtPrevisaoEntrega AS date) = DATEADD(day, 1, CAST(GETDATE() AS date)) THEN 'VENCE AMANHA'
      WHEN CAST(Tit.DtPrevisaoEntrega AS date) = DATEADD(day, 2, CAST(GETDATE() AS date)) THEN 'VENCE EM 2 DIAS'
      WHEN CAST(Tit.DtPrevisaoEntrega AS date) = DATEADD(day, 3, CAST(GETDATE() AS date)) THEN 'VENCE EM 3 DIAS'
      ELSE 'PROGRAMADO'
    END AS STATUS_PREVISAO,
    CASE
      WHEN CAST(Tit.DtPrevisaoEntrega AS date) < CAST(GETDATE() AS date) THEN 'CRITICO'
      WHEN CAST(Tit.DtPrevisaoEntrega AS date) = CAST(GETDATE() AS date) THEN 'CRITICO'
      WHEN CAST(Tit.DtPrevisaoEntrega AS date) = DATEADD(day, 1, CAST(GETDATE() AS date)) THEN 'ALTO'
      WHEN CAST(Tit.DtPrevisaoEntrega AS date) <= DATEADD(day, 3, CAST(GETDATE() AS date)) THEN 'ATENCAO'
      ELSE 'NORMAL'
    END AS NIVEL_RISCO,
    S.PK_Id AS ID_SERVICO,
    S.NumeroServico AS NUMERO_SERVICO,
    S.ItemServico AS ITEM_SERVICO,
    S.DataCadastro AS DATA_SERVICO,
    S.Vencimento AS VENCIMENTO_SERVICO,
    S.FK_tblCDSServicoTipo_Id AS ID_TIPO_SERVICO,
    ST.Codigo AS CODIGO_TIPO_SERVICO,
    S.FK_tblCDSNatureza_Id AS ID_NATUREZA_CDS,
    T.PK_Id AS ID_TAREFA,
    T.Tarefa AS TAREFA,
    T.DataCadastro AS DATA_CADASTRO_TAREFA,
    H.ID_HISTORICO,
    H.Status AS STATUS_TAREFA,
    H.DataAbertura AS DATA_ABERTURA,
    H.DataFinalizacao AS DATA_FINALIZACAO,
    CASE
      WHEN H.DataFinalizacao IS NOT NULL THEN 'FINALIZADA'
      WHEN H.DataAbertura IS NOT NULL THEN 'EM ANDAMENTO'
      ELSE 'AGUARDANDO'
    END AS SITUACAO_TAREFA,
    U.PK_Id AS ID_USUARIO,
    U.NomeUsuario AS RESPONSAVEL,
    U.Ativo AS USUARIO_ATIVO,
    Tp.TipoPrenotacao AS TIPO,
    Nat.Descricao AS NATUREZA,
    Nat.PK_Id AS ID_NATUREZA,
    Tit.DtDevolucao,
    Tit.DtRetirada
  FROM dbo.tblCDSServico S
  INNER JOIN dbo.tblCDSServicoTipo ST
    ON ST.PK_Id = S.FK_tblCDSServicoTipo_Id
  INNER JOIN dbo.tblCDSTarefa T
    ON T.FK_tblCDSServico_Id = S.PK_Id
  LEFT JOIN HistoricoAtual H
    ON H.FK_tblCDSTarefa_Id = T.PK_Id
   AND H.RN = 1
  LEFT JOIN dbo.tblCDSUsuario U
    ON U.PK_Id = H.FK_tblCDSUsuario_Id
  INNER JOIN dbo.tblWRITitulos Tit
    ON Tit.FK_tblWRIRecepcaoRecepcao = S.NumeroServico
   AND Tit.PK_SeqTitulo = S.ItemServico
   AND Tit.FK_tblWRIRecepcaoFlagRecepcao = ST.Codigo
  INNER JOIN dbo.tblWRIRecepcao Recp
    ON Recp.PK_Recepcao = Tit.FK_tblWRIRecepcaoRecepcao
  LEFT JOIN dbo.tblWRITipoPrenotacao Tp
    ON Tp.PK_ID = Recp.TipoPrenotacao
  LEFT JOIN dbo.tblWRINatureza Nat
    ON Nat.PK_Id = Tit.FK_tblWRINatureza_Id
  CROSS APPLY (
    SELECT MAX(V.valor) AS cursor_value
    FROM (VALUES
      (CONVERT(datetime2(3), T.DataCadastro)),
      (CONVERT(datetime2(3), H.DataAbertura)),
      (CONVERT(datetime2(3), H.DataFinalizacao)),
      (CONVERT(datetime2(3), S.DataCadastro))
    ) V(valor)
  ) C
  WHERE ST.Codigo IN (0, 1)
    AND Tit.DtPrevisaoEntrega IS NOT NULL
    AND CAST(Tit.DtPrevisaoEntrega AS date) BETWEEN @DataInicial AND @DataFinal
    AND (@SomenteAbertas = 0 OR H.DataFinalizacao IS NULL)
    AND ISNULL(Recp.FlagCancelamento, 'N') <> 'S'
    AND Recp.DtCancelamento IS NULL
    AND (@CursorStart IS NULL OR T.PK_Id IN (SELECT TC.ID_TAREFA FROM TarefasCandidatas TC))
    AND (@CursorStart IS NULL OR C.cursor_value >= @CursorStart)
  ORDER BY C.cursor_value, T.PK_Id, H.ID_HISTORICO;
END;
GO

CREATE PROCEDURE dbo.pr_Fiorix_BI_Incremental_v2
  @DataInicial varchar(10) = NULL,
  @DataFinal varchar(10) = NULL,
  @Flag int = 0,
  @LastProtocolo int = NULL,
  @LastSeqTitulo int = NULL,
  @CursorValue datetime2(3) = NULL,
  @OverlapMinutes int = 0
AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @DtIni date = ISNULL(TRY_CONVERT(date, @DataInicial, 103), TRY_CONVERT(date, @DataInicial, 23));
  DECLARE @DtFim date = ISNULL(TRY_CONVERT(date, @DataFinal, 103), TRY_CONVERT(date, @DataFinal, 23));

  SELECT
    CONVERT(varchar(64), HASHBYTES('SHA2_256', CONCAT('bi:', Recp.PK_Recepcao, ':', Tit.PK_SeqTitulo)), 2) AS record_key,
    CONVERT(varchar(30), Recp.PK_Recepcao) AS cursor_value,
    CONVERT(varchar(30), Tit.PK_SeqTitulo) AS secondary_cursor,
    Recp.PK_Recepcao AS PROTOCOLO,
    Tit.PK_SeqTitulo AS SEQ_TITULO,
    Tit.DataDoTituloApresentado AS DATA_ENTRADA,

    TPT.TipoPrenotacao AS TIPO,
    CASE
      WHEN Tit.DtDevolucao IS NOT NULL THEN 'Em dia'
      WHEN Tit.DataUltimoRegistro IS NULL AND Tit.DtPrevisaoEntrega < GETDATE() THEN 'Atrasado'
      WHEN Tit.DataUltimoRegistro IS NOT NULL AND CAST(Tit.DataUltimoRegistro AS date) <= CAST(Tit.DtPrevisaoEntrega AS date) THEN 'Em dia'
      WHEN Tit.DataUltimoRegistro IS NOT NULL AND CAST(Tit.DataUltimoRegistro AS date) > CAST(Tit.DtPrevisaoEntrega AS date) THEN 'Atrasado'
      ELSE 'Em dia'
    END AS STATUS,
    CASE
      WHEN Tit.DtDevolucao IS NOT NULL THEN 0
      WHEN Tit.DataUltimoRegistro IS NULL AND Tit.DtPrevisaoEntrega < GETDATE() THEN DATEDIFF(day, CAST(Tit.DtPrevisaoEntrega AS date), CAST(GETDATE() AS date))
      WHEN Tit.DataUltimoRegistro IS NOT NULL AND CAST(Tit.DataUltimoRegistro AS date) <= CAST(Tit.DtPrevisaoEntrega AS date) THEN 0
      WHEN Tit.DataUltimoRegistro IS NOT NULL THEN DATEDIFF(day, CAST(Tit.DtPrevisaoEntrega AS date), CAST(Tit.DataUltimoRegistro AS date))
      ELSE 0
    END AS ATRASO_DIAS,
    CASE WHEN Tit.DtDevolucao IS NOT NULL THEN 'DEVOLVIDO' ELSE 'REGISTRADO' END AS SERVICO
  FROM dbo.tblWRIRecepcao Recp
  INNER JOIN dbo.tblWRITitulos Tit ON Tit.FK_tblWRIRecepcaoRecepcao = Recp.PK_Recepcao
  LEFT JOIN dbo.tblWRITipoPrenotacao TPT ON TPT.PK_ID = Recp.TipoPrenotacao
  WHERE (@DtIni IS NULL OR CAST(Tit.DataDoTituloApresentado AS date) BETWEEN @DtIni AND @DtFim)
    AND (
      @LastProtocolo IS NULL 
      OR Recp.PK_Recepcao > @LastProtocolo 
      OR (Recp.PK_Recepcao = @LastProtocolo AND Tit.PK_SeqTitulo > ISNULL(@LastSeqTitulo, 0))
    )
  ORDER BY Recp.PK_Recepcao, Tit.PK_SeqTitulo;
END;
GO




