USE WEBRI;
GO

-- =========================================================================================
-- Procedure: dbo.pr_Fiorix_BI_Impressoes
-- Compatibilidade: SQL Server 2012 (11.0 SP4) e superiores
-- Descrição: Extração incremental dos andamentos REAIS de Impressão no WebRI:
--            - Tipo 63:  "Impressao definitiva do ato no livro"  -> TipoImpressao = 'LIVRO'
--            - Tipo 103: "Impressão de Certidão de Registro"    -> TipoImpressao = 'CERTIDAO'
--            Ignora andamentos de fechamento automático de tarefas (tipo 264 / 267).
-- Integração: FIORIXConnector -> Supabase (public.fiorix_impressoes_dados)
-- =========================================================================================

IF OBJECT_ID('dbo.pr_Fiorix_BI_Impressoes', 'P') IS NULL
    EXEC('CREATE PROCEDURE dbo.pr_Fiorix_BI_Impressoes AS SELECT 1');
GO

ALTER PROCEDURE dbo.pr_Fiorix_BI_Impressoes
    @DataInicial DATE = NULL,
    @DataFinal DATE = NULL,
    @CursorIdAndamento BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        a.PK_ID AS IdAndamento,
        r.PK_Recepcao AS NumeroPrenotacao,
        r.PK_Recepcao AS IdRecepcao,
        COALESCE(t.PK_SeqTitulo, a.FK_tblWRISeqTitulo, 1) AS SeqTitulo,
        COALESCE(r.DtRecep, a.Data) AS DataEntrada,
        CASE r.TipoPrenotacao
            WHEN 1 THEN 'ENTRADA'
            WHEN 2 THEN 'REINGRESSO'
            ELSE CAST(r.TipoPrenotacao AS VARCHAR(10))
        END AS TipoPrenotacao,
        COALESCE(nat.Descricao, 'Prenotado') AS Natureza,
        COALESCE(
            LivroReal.NUMERO_LIVRO,
            CASE 
                WHEN a.Observacao LIKE '%MAT %' THEN 
                    CONCAT('MAT ', LTRIM(RTRIM(SUBSTRING(a.Observacao, CHARINDEX('MAT ', a.Observacao) + 4, 15))))
                WHEN a.Observacao LIKE '%MAT.%' THEN 
                    CONCAT('MAT ', LTRIM(RTRIM(SUBSTRING(a.Observacao, CHARINDEX('MAT.', a.Observacao) + 4, 15))))
                WHEN r.Observacao LIKE '%FRAÇÃO:%' THEN 
                    CONCAT('MAT ', LTRIM(RTRIM(SUBSTRING(
                        r.Observacao, 
                        CHARINDEX('FRAÇÃO:', r.Observacao) + 7, 
                        CHARINDEX('-', r.Observacao + '-', CHARINDEX('FRAÇÃO:', r.Observacao) + 7) - (CHARINDEX('FRAÇÃO:', r.Observacao) + 7)
                    ))))
                WHEN r.Observacao LIKE '%MATRÍCULA:%' THEN 
                    CONCAT('MAT ', LTRIM(RTRIM(SUBSTRING(r.Observacao, CHARINDEX('MATRÍCULA:', r.Observacao) + 10, 15))))
                WHEN r.Observacao LIKE '%MAT.%' THEN 
                    CONCAT('MAT ', LTRIM(RTRIM(SUBSTRING(r.Observacao, CHARINDEX('MAT.', r.Observacao) + 4, 15))))
                ELSE NULL
            END
        ) AS NumeroLivro,
        tp.PK_Id AS IdTipoAndamento,
        tp.Sigla AS SiglaAndamento,
        tp.Descricao AS TipoAndamento,
        CASE 
            WHEN tp.PK_Id IN (63, 264) THEN 'LIVRO'
            WHEN tp.PK_Id = 103 THEN 'CERTIDAO'
            ELSE 'OUTROS'
        END AS TipoImpressao,
        a.Data AS DataImpressao,
        usuOrigem.IDUser AS IdOperador,
        usuOrigem.NomeCompletoUser AS Operador,
        usuDestino.IDUser AS IdUsuarioDestino,
        usuDestino.NomeCompletoUser AS UsuarioDestino,
        a.Observacao
    FROM dbo.tblWRIAndamentos AS a
    INNER JOIN dbo.tblWRITpAndamentos AS tp
        ON tp.PK_Id = a.FK_tblWRITpAndamento_Id
    LEFT JOIN dbo.tblWRIRecepcao AS r
        ON r.PK_Recepcao = a.FK_tblWRIRecepcaoRecepcao
       AND r.PK_FlagRecepcao = a.FK_tblWRIRecepcaoFlagRecepcao
    LEFT JOIN dbo.tblWRITitulos AS t
        ON t.FK_tblWRIRecepcaoFlagRecepcao = a.FK_tblWRIRecepcaoFlagRecepcao
        AND t.FK_tblWRIRecepcaoRecepcao = a.FK_tblWRIRecepcaoRecepcao
        AND t.PK_SeqTitulo = a.FK_tblWRISeqTitulo
    LEFT JOIN dbo.tblWRINatureza AS nat
        ON nat.PK_Id = t.FK_tblWRINatureza_Id
    LEFT JOIN dbo.tblSIPUsuarios AS usuOrigem
        ON usuOrigem.IDUser = a.FK_tblWRIUsuarioOrigem_Id
    LEFT JOIN dbo.tblSIPUsuarios AS usuDestino
        ON usuDestino.IDUser = a.FK_tblWRIUsuarioDestino_Id
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
        WHERE AtosTit.FK_tblWRIRecepcaoRecepcao = a.FK_tblWRIRecepcaoRecepcao
          AND (a.FK_tblWRISeqTitulo IS NULL OR AtosTit.PK_SeqTitulo = a.FK_tblWRISeqTitulo)
          AND R.PK_Num_Livro IS NOT NULL
        ORDER BY AtosTit.PK_Id ASC
    ) LivroReal
    WHERE tp.PK_Id IN (63, 103, 264)
      AND (@CursorIdAndamento IS NULL OR a.PK_ID > @CursorIdAndamento)
      AND (@DataInicial IS NULL OR CAST(a.Data AS DATE) >= @DataInicial)
      AND (@DataFinal IS NULL OR CAST(a.Data AS DATE) <= @DataFinal)
    ORDER BY a.PK_ID ASC;
END;
GO

-- Concessão de permissão de execução ao usuário fiorix_connector
GRANT EXECUTE ON dbo.pr_Fiorix_BI_Impressoes TO fiorix_connector;
GO
