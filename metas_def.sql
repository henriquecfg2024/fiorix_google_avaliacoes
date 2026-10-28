
CREATE PROCEDURE [dbo].[pr_Fiorix_BI_METAS]
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

        Tit.DataDoTituloApresentado,
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
            Tit.DataDoTituloApresentado,
            CASE
                WHEN F.D9_PREPARACAO IS NOT NULL
                    THEN F.D9_PREPARACAO

                /*
                  D9 ficou sem data, mas o fluxo avançou.
                  Não prolongamos o prazo até hoje.
                  Usamos a primeira evidência posterior disponível.
                */
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

      AND YEAR(Tit.DataDoTituloApresentado) = 2026

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

    ORDER BY Tit.DataDoTituloApresentado DESC;

END
