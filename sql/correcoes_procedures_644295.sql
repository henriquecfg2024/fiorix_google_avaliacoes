-- =========================================================================================
-- SCRIPT DE CORREÇÃO DAS PROCEDURES DO WEBRI (7º RI - SÃO PAULO)
-- Objetivo: Corrigir filtro de data de protocolo para escrituras antigas (ex: 2023) 
--           e permitir sincronização de tarefas finalizadas pelo CursorValue.
--
-- Executar este script no SQL Server Management Studio (SSMS) conectado ao banco WEBRI (SRVSQL)
-- =========================================================================================

USE [WEBRI];
GO

-- =========================================================================================
-- 1. CORREÇÃO: dbo.pr_Fiorix_BI_Incremental_v2
-- Ajuste: Utiliza a data real do Protocolo (tblWRIAndamentos Id=14) em vez de DataDoTituloApresentado.
-- =========================================================================================
CREATE OR ALTER PROCEDURE dbo.pr_Fiorix_BI_Incremental_v2
  @DataInicial varchar(10) = NULL,
  @DataFinal varchar(10) = NULL,
  @Flag int = 0,
  @LastProtocolo int = NULL,
  @LastSeqTitulo int = NULL,
  @CursorValue varchar(64) = NULL,
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
    ISNULL(proto.DataProtocolo, Tit.DataDoTituloApresentado) AS DATA_ENTRADA,
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
  OUTER APPLY (
    SELECT TOP 1 Andam.Data AS DataProtocolo
    FROM dbo.tblWRIAndamentos Andam
    WHERE Andam.FK_tblWRIRecepcaoRecepcao = Recp.PK_Recepcao
      AND Andam.FK_tblWRITpAndamento_Id = 14
    ORDER BY Andam.Data ASC
  ) proto
  WHERE (@DtIni IS NULL OR CAST(ISNULL(proto.DataProtocolo, Tit.DataDoTituloApresentado) AS date) BETWEEN @DtIni AND @DtFim)
    AND (
      @LastProtocolo IS NULL 
      OR Recp.PK_Recepcao > @LastProtocolo 
      OR (Recp.PK_Recepcao = @LastProtocolo AND Tit.PK_SeqTitulo > ISNULL(@LastSeqTitulo, 0))
    )
  ORDER BY Recp.PK_Recepcao, Tit.PK_SeqTitulo;
END;
GO

-- =========================================================================================
-- 2. CORREÇÃO: dbo.pr_Fiorix_BI_METAS
-- Ajuste: Utiliza D1_PROTOCOLO para o filtro de ano e cálculo de dias corridos,
--         evitando descarte de títulos com escrituras de anos anteriores (ex: 2023).
-- =========================================================================================
CREATE OR ALTER PROCEDURE [dbo].[pr_Fiorix_BI_METAS]
AS
BEGIN
    SET NOCOUNT ON;

    WITH Fases AS
    (
        SELECT
            FK_tblWRIRecepcaoRecepcao AS PROTOCOLO,

            MIN(CASE 
                WHEN FK_tblWRITpAndamento_Id = 14 
                THEN Data 
            END) AS D1_PROTOCOLO,

            MAX(CASE 
                WHEN FK_tblWRITpAndamento_Id = 86 
                THEN Data 
            END) AS D1_ESCANEAMENTO,

            MAX(CASE 
                WHEN FK_tblWRITpAndamento_Id = 106 
                THEN Data 
            END) AS D2_CONTRADITORIO,

            MAX(CASE 
                WHEN FK_tblWRITpAndamento_Id = 265 
                THEN Data 
            END) AS D3_EXTRATO,

            MAX(CASE 
                WHEN FK_tblWRITpAndamento_Id = 131 
                THEN Data 
            END) AS D4_QUALIFICACAO,

            MAX(CASE 
                WHEN FK_tblWRITpAndamento_Id IN (281, 282)
                THEN Data 
            END) AS D5_CALCULO,

            COUNT(CASE 
                WHEN FK_tblWRITpAndamento_Id = 109 
                THEN 1 
            END) AS QTD_RETRABALHO,

            MAX(CASE 
                WHEN FK_tblWRITpAndamento_Id = 264
                THEN Data 
            END) AS D8_IMPRESSAO,

            MAX(CASE 
                WHEN FK_tblWRITpAndamento_Id = 113 
                THEN Data 
            END) AS D9_PREPARACAO,

            MAX(CASE 
                WHEN FK_tblWRITpAndamento_Id = 76 
                THEN Data 
            END) AS D9_CONFERENCIA,

            MAX(CASE 
                WHEN FK_tblWRITpAndamento_Id IN (48,83,10,11,12,72,99)
                THEN Data 
            END) AS D10_ENTREGA

        FROM dbo.tblWRIAndamentos

        GROUP BY FK_tblWRIRecepcaoRecepcao
    ),

    FasesTratadas AS
    (
        SELECT
            F.*,

            CASE
                WHEN F.D1_PROTOCOLO IS NULL
                     AND (
                         F.D1_ESCANEAMENTO IS NOT NULL
                         OR F.D2_CONTRADITORIO IS NOT NULL
                         OR F.D3_EXTRATO IS NOT NULL
                         OR F.D4_QUALIFICACAO IS NOT NULL
                         OR F.D5_CALCULO IS NOT NULL
                         OR F.D8_IMPRESSAO IS NOT NULL
                         OR F.D9_PREPARACAO IS NOT NULL
                         OR F.D9_CONFERENCIA IS NOT NULL
                         OR F.D10_ENTREGA IS NOT NULL
                     )
                    THEN 'NAO REGISTRADA'
                WHEN F.D1_PROTOCOLO IS NULL
                    THEN 'PENDENTE'
                ELSE 'CONCLUIDA'
            END AS STATUS_D1_PROTOCOLO,

            CASE
                WHEN F.D1_ESCANEAMENTO IS NULL
                     AND (
                         F.D2_CONTRADITORIO IS NOT NULL
                         OR F.D3_EXTRATO IS NOT NULL
                         OR F.D4_QUALIFICACAO IS NOT NULL
                         OR F.D5_CALCULO IS NOT NULL
                         OR F.D8_IMPRESSAO IS NOT NULL
                         OR F.D9_PREPARACAO IS NOT NULL
                         OR F.D9_CONFERENCIA IS NOT NULL
                         OR F.D10_ENTREGA IS NOT NULL
                     )
                    THEN 'NAO REGISTRADA'
                WHEN F.D1_ESCANEAMENTO IS NULL
                    THEN 'PENDENTE'
                ELSE 'CONCLUIDA'
            END AS STATUS_D1_ESCANEAMENTO,

            CASE
                WHEN F.D2_CONTRADITORIO IS NULL
                     AND (
                         F.D3_EXTRATO IS NOT NULL
                         OR F.D4_QUALIFICACAO IS NOT NULL
                         OR F.D5_CALCULO IS NOT NULL
                         OR F.D8_IMPRESSAO IS NOT NULL
                         OR F.D9_PREPARACAO IS NOT NULL
                         OR F.D9_CONFERENCIA IS NOT NULL
                         OR F.D10_ENTREGA IS NOT NULL
                     )
                    THEN 'NAO REGISTRADA'
                WHEN F.D2_CONTRADITORIO IS NULL
                    THEN 'PENDENTE'
                ELSE 'CONCLUIDA'
            END AS STATUS_D2_CONTRADITORIO,

            CASE
                WHEN F.D3_EXTRATO IS NULL
                     AND (
                         F.D4_QUALIFICACAO IS NOT NULL
                         OR F.D5_CALCULO IS NOT NULL
                         OR F.D8_IMPRESSAO IS NOT NULL
                         OR F.D9_PREPARACAO IS NOT NULL
                         OR F.D9_CONFERENCIA IS NOT NULL
                         OR F.D10_ENTREGA IS NOT NULL
                     )
                    THEN 'NAO REGISTRADA'
                WHEN F.D3_EXTRATO IS NULL
                    THEN 'PENDENTE'
                ELSE 'CONCLUIDA'
            END AS STATUS_D3_EXTRATO,

            CASE
                WHEN F.D4_QUALIFICACAO IS NULL
                     AND (
                         F.D5_CALCULO IS NOT NULL
                         OR F.D8_IMPRESSAO IS NOT NULL
                         OR F.D9_PREPARACAO IS NOT NULL
                         OR F.D9_CONFERENCIA IS NOT NULL
                         OR F.D10_ENTREGA IS NOT NULL
                     )
                    THEN 'NAO REGISTRADA'
                WHEN F.D4_QUALIFICACAO IS NULL
                    THEN 'PENDENTE'
                ELSE 'CONCLUIDA'
            END AS STATUS_D4_QUALIFICACAO,

            CASE
                WHEN F.D5_CALCULO IS NULL
                     AND (
                         F.D8_IMPRESSAO IS NOT NULL
                         OR F.D9_PREPARACAO IS NOT NULL
                         OR F.D9_CONFERENCIA IS NOT NULL
                         OR F.D10_ENTREGA IS NOT NULL
                     )
                    THEN 'NAO REGISTRADA'
                WHEN F.D5_CALCULO IS NULL
                    THEN 'PENDENTE'
                ELSE 'CONCLUIDA'
            END AS STATUS_D5_CALCULO,

            CASE
                WHEN F.D8_IMPRESSAO IS NULL
                     AND (
                         F.D9_PREPARACAO IS NOT NULL
                         OR F.D9_CONFERENCIA IS NOT NULL
                         OR F.D10_ENTREGA IS NOT NULL
                     )
                    THEN 'NAO REGISTRADA'
                WHEN F.D8_IMPRESSAO IS NULL
                    THEN 'PENDENTE'
                ELSE 'CONCLUIDA'
            END AS STATUS_D8_IMPRESSAO,

            CASE
                WHEN F.D9_PREPARACAO IS NULL
                     AND (
                         F.D9_CONFERENCIA IS NOT NULL
                         OR F.D10_ENTREGA IS NOT NULL
                     )
                    THEN 'NAO REGISTRADA'
                WHEN F.D9_PREPARACAO IS NULL
                    THEN 'PENDENTE'
                ELSE 'CONCLUIDA'
            END AS STATUS_D9_PREPARACAO,

            CASE
                WHEN F.D9_PREPARACAO IS NOT NULL
                     OR F.D9_CONFERENCIA IS NOT NULL
                     OR F.D10_ENTREGA IS NOT NULL
                    THEN 1
                ELSE 0
            END AS MEDICAO_FINALIZADA

        FROM Fases F
    )

    SELECT
        Recp.PK_Recepcao AS PROTOCOLO,
        Tp.TipoPrenotacao AS TIPO,
        Nat.Descricao AS NATUREZA,
        Nat.PK_Id AS ID_NATUREZA,
        Recp.ProtocoloEntidade AS MAGNETICO,

        ISNULL(F.D1_PROTOCOLO, Tit.DataDoTituloApresentado) AS DataDoTituloApresentado,
        Tit.DtPrevisaoEntrega,

        F.D1_PROTOCOLO,
        F.STATUS_D1_PROTOCOLO,

        F.D1_ESCANEAMENTO,
        F.STATUS_D1_ESCANEAMENTO,

        F.D2_CONTRADITORIO,
        F.STATUS_D2_CONTRADITORIO,

        F.D3_EXTRATO,
        F.STATUS_D3_EXTRATO,

        F.D4_QUALIFICACAO,
        F.STATUS_D4_QUALIFICACAO,

        F.D5_CALCULO,
        F.STATUS_D5_CALCULO,

        F.QTD_RETRABALHO,

        F.D8_IMPRESSAO,
        F.STATUS_D8_IMPRESSAO,

        F.D9_PREPARACAO,
        F.STATUS_D9_PREPARACAO,

        /* APENAS DEMONSTRATIVO */
        F.D9_CONFERENCIA,
        F.D10_ENTREGA,

        CASE
            WHEN F.MEDICAO_FINALIZADA = 1
                THEN 'FINALIZADO'
            ELSE 'EM ANDAMENTO'
        END AS STATUS_MEDICAO,

        DATEDIFF(
            DAY,
            ISNULL(F.D1_PROTOCOLO, Tit.DataDoTituloApresentado),
            CASE
                WHEN F.D9_PREPARACAO IS NOT NULL
                    THEN F.D9_PREPARACAO
                WHEN F.D9_CONFERENCIA IS NOT NULL
                    THEN F.D9_CONFERENCIA
                WHEN F.D10_ENTREGA IS NOT NULL
                    THEN F.D10_ENTREGA
                ELSE GETDATE()
            END
        ) AS DIAS_CORRIDOS,

        CASE
            WHEN
                CASE
                    WHEN F.D9_PREPARACAO IS NOT NULL
                        THEN F.D9_PREPARACAO
                    WHEN F.D9_CONFERENCIA IS NOT NULL
                        THEN F.D9_CONFERENCIA
                    WHEN F.D10_ENTREGA IS NOT NULL
                        THEN F.D10_ENTREGA
                    ELSE GETDATE()
                END
                <= Tit.DtPrevisaoEntrega
            THEN 0

            ELSE DATEDIFF(
                DAY,
                Tit.DtPrevisaoEntrega,
                CASE
                    WHEN F.D9_PREPARACAO IS NOT NULL
                        THEN F.D9_PREPARACAO
                    WHEN F.D9_CONFERENCIA IS NOT NULL
                        THEN F.D9_CONFERENCIA
                    WHEN F.D10_ENTREGA IS NOT NULL
                        THEN F.D10_ENTREGA
                    ELSE GETDATE()
                END
            )
        END AS DIAS_ATRASO,

        CASE
            WHEN F.MEDICAO_FINALIZADA = 0
                 AND Tit.DtPrevisaoEntrega < GETDATE()
                THEN 'ATRASADO - PENDENTE'

            WHEN F.MEDICAO_FINALIZADA = 0
                THEN 'NO PRAZO - PENDENTE'

            WHEN
                CASE
                    WHEN F.D9_PREPARACAO IS NOT NULL
                        THEN F.D9_PREPARACAO
                    WHEN F.D9_CONFERENCIA IS NOT NULL
                        THEN F.D9_CONFERENCIA
                    WHEN F.D10_ENTREGA IS NOT NULL
                        THEN F.D10_ENTREGA
                END
                <= Tit.DtPrevisaoEntrega
                THEN 'META BATIDA'

            ELSE 'META ESTOURADA'
        END AS STATUS_META

    FROM dbo.tblWRITitulos Tit

    INNER JOIN dbo.tblWRIRecepcao Recp
        ON Recp.PK_Recepcao =
           Tit.FK_tblWRIRecepcaoRecepcao

    LEFT JOIN dbo.tblWRITipoPrenotacao Tp
        ON Tp.PK_ID = Recp.TipoPrenotacao

    LEFT JOIN dbo.tblWRINatureza Nat
        ON Nat.PK_Id = Tit.FK_tblWRINatureza_Id

    LEFT JOIN FasesTratadas F
        ON F.PROTOCOLO = Recp.PK_Recepcao

    WHERE Tit.DtPrevisaoEntrega IS NOT NULL

      -- Ajuste chave: filtra pelo ano do protocolo real ou do título
      AND (YEAR(F.D1_PROTOCOLO) = 2026 OR YEAR(Tit.DataDoTituloApresentado) = 2026)

      AND Tit.DtRetirada IS NULL

      AND ISNULL(Recp.FlagCancelamento, 'N') <> 'S'

      AND ISNULL(Recp.FlagRetirada, 'N') <> 'S'

      AND Recp.DtCancelamento IS NULL

      AND NOT EXISTS
      (
          SELECT 1
          FROM dbo.tblWRIAndamentos A
          WHERE A.FK_tblWRIRecepcaoRecepcao =
                Recp.PK_Recepcao
            AND A.FK_tblWRITpAndamento_Id = 75
      )

      AND ISNULL(Recp.ProtocoloEntidade, '') = ''

      AND ISNULL(Tp.TipoPrenotacao, '') NOT LIKE '%INTIMAC%'

      AND ISNULL(Tp.TipoPrenotacao, '') NOT LIKE '%INDISPONI%'

      AND ISNULL(Nat.Descricao, '') NOT LIKE '%Indisponibilidade%'

      AND ISNULL(Nat.PK_Id, 0) NOT IN (124,184,161)

    ORDER BY ISNULL(F.D1_PROTOCOLO, Tit.DataDoTituloApresentado) DESC;

END
GO

-- =========================================================================================
-- 3. CORREÇÃO: dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2
-- Ajuste: Quando @CursorValue é fornecido pelo conector incremental, permite retornar
--         tarefas que foram FINALIZADAS recentemente (evitando congelar em AGUARDANDO).
-- =========================================================================================
CREATE OR ALTER PROCEDURE dbo.pr_Fiorix_BI_TAREFAS_Incremental_v2
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
    -- Ajuste chave: no modo incremental (@CursorValue IS NOT NULL), permite trazer tarefas finalizadas recentemente
    AND (@SomenteAbertas = 0 OR @CursorValue IS NOT NULL OR H.DataFinalizacao IS NULL)
    AND ISNULL(Recp.FlagCancelamento, 'N') <> 'S'
    AND Recp.DtCancelamento IS NULL
  ORDER BY C.cursor_value, T.PK_Id, H.ID_HISTORICO;
END;
GO
