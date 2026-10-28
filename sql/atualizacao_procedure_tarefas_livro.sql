-- =========================================================================================
-- SCRIPT DE ATUALIZAÇÃO DA PROCEDURE DE TAREFAS (WEBRI - SRVSQL)
-- Compatível com SQL Server 2012 (11.0 SP4)
-- Objetivo: Preencher a coluna NUMERO_LIVRO buscando a Matrícula Real de tblWRIReal / tblWRIAtos / tblWRIAtosTitulos
-- =========================================================================================

USE [WEBRI];
GO

ALTER PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2
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
    Tit.DtRetirada,

    -- Matrícula Real vinculada aos Atos do Título (tblWRIReal -> tblWRIAtos -> tblWRIAtosTitulos)
    -- com fallback para a observação da recepção caso exista
    COALESCE(
      LivroReal.NUMERO_LIVRO,
      CASE 
        WHEN Recp.Observacao LIKE '%FRAÇÃO:%' THEN 
          CONCAT('MAT ', LTRIM(RTRIM(SUBSTRING(
            Recp.Observacao, 
            CHARINDEX('FRAÇÃO:', Recp.Observacao) + 7, 
            CHARINDEX('-', Recp.Observacao + '-', CHARINDEX('FRAÇÃO:', Recp.Observacao) + 7) - (CHARINDEX('FRAÇÃO:', Recp.Observacao) + 7)
          ))))
        WHEN Recp.Observacao LIKE '%MATRÍCULA:%' THEN 
          CONCAT('MAT ', LTRIM(RTRIM(SUBSTRING(Recp.Observacao, CHARINDEX('MATRÍCULA:', Recp.Observacao) + 10, 15))))
        WHEN Recp.Observacao LIKE '%MAT.%' THEN 
          CONCAT('MAT ', LTRIM(RTRIM(SUBSTRING(Recp.Observacao, CHARINDEX('MAT.', Recp.Observacao) + 4, 15))))
        ELSE NULL
      END
    ) AS NUMERO_LIVRO,
    Recp.Observacao AS OBSERVACAO_RECEPCAO

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

  -- Junção segura com tblWRIReal via tblWRIAtosTitulos e tblWRIAtos (evita duplicar linhas)
  OUTER APPLY (
    SELECT TOP 1
      CASE 
        WHEN R.FK_tblWRILivro_Id = 2 THEN CONCAT('MAT ', CAST(R.PK_Num_Livro AS varchar(20)))
        WHEN R.FK_tblWRILivro_Id = 3 THEN CONCAT('L3 ', CAST(R.PK_Num_Livro AS varchar(20)))
        ELSE CAST(R.PK_Num_Livro AS varchar(20))
      END AS NUMERO_LIVRO
    FROM dbo.tblWRIAtosTitulos AtosTit
    INNER JOIN dbo.tblWRIAtos Atos 
      ON Atos.PK_Id = AtosTit.FK_tblWRIAtos_Id
    INNER JOIN dbo.tblWRIReal R 
      ON R.PK_Id = Atos.FK_tblWRIReal_Id
    WHERE AtosTit.FK_tblWRIRecepcaoRecepcao = Tit.FK_tblWRIRecepcaoRecepcao
      AND AtosTit.PK_SeqTitulo = Tit.PK_SeqTitulo
      AND AtosTit.FK_tblWRIRecepcaoFlagRecepcao = Tit.FK_tblWRIRecepcaoFlagRecepcao
      AND R.PK_Num_Livro IS NOT NULL
    ORDER BY AtosTit.PK_Id ASC
  ) LivroReal

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
