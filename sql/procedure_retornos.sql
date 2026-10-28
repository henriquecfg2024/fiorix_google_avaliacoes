USE WEBRI;
GO

-- =========================================================================================
-- Procedure: dbo.pr_Fiorix_BI_Retornos
-- Descrição: Extração incremental/parametrizada de eventos de retorno (notas de devolução/exigências)
--            referentes aos andamentos de tipos 292, 293, 294, 295, 296 e 297 no WebRI.
-- Integração: FIORIXConnector -> Supabase / FIORIX SaaS (Módulo Gestão de Prazos / Retornos)
-- Modo: Incremental via @CursorIdAndamento (PK_ID do andamento)
-- =========================================================================================

CREATE OR ALTER PROCEDURE dbo.pr_Fiorix_BI_Retornos
    @DataInicial DATE = NULL,
    @DataFinal DATE = NULL,
    @CursorIdAndamento BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.PK_Recepcao AS IdRecepcao,
        r.NumPrenotacao AS NumeroPrenotacao,
        r.DtRecep AS DataRecepcao,
        CASE r.TipoPrenotacao
            WHEN 1 THEN 'ENTRADA'
            WHEN 2 THEN 'REINGRESSO'
            ELSE CAST(r.TipoPrenotacao AS VARCHAR(10))
        END AS TipoRecepcao,
        nat.Descricao AS FormaTitulo,
        tp.PK_Id AS IdTipoRetorno,
        tp.Sigla AS SiglaRetorno,
        tp.Descricao AS TipoRetorno,
        a.PK_ID AS IdAndamento,
        a.Data AS DataRetorno,
        usuOrigem.IDUser AS IdUsuarioOrigem,
        usuOrigem.NomeCompletoUser AS UsuarioOrigem,
        usuDestino.IDUser AS IdUsuarioDestino,
        usuDestino.NomeCompletoUser AS UsuarioDestinoRetorno,
        a.Observacao,
        t.PK_SeqTitulo AS SeqTitulo,
        r.ProtocoloEntidade AS ProtocoloEntidade
    FROM dbo.tblWRIAndamentos AS a
    INNER JOIN dbo.tblWRITpAndamentos AS tp
        ON tp.PK_Id = a.FK_tblWRITpAndamento_Id
    INNER JOIN dbo.tblWRITitulos AS t
        ON t.FK_tblWRIRecepcaoFlagRecepcao = a.FK_tblWRIRecepcaoFlagRecepcao
        AND t.FK_tblWRIRecepcaoRecepcao = a.FK_tblWRIRecepcaoRecepcao
        AND t.PK_SeqTitulo = a.FK_tblWRISeqTitulo
    INNER JOIN dbo.tblWRIRecepcao AS r
        ON r.PK_FlagRecepcao = t.FK_tblWRIRecepcaoFlagRecepcao
        AND r.PK_Recepcao = t.FK_tblWRIRecepcaoRecepcao
    LEFT JOIN dbo.tblWRINatureza AS nat
        ON nat.PK_Id = t.FK_tblWRINatureza_Id
    LEFT JOIN dbo.tblSIPUsuarios AS usuOrigem
        ON usuOrigem.IDUser = a.FK_tblWRIUsuarioOrigem_Id
    LEFT JOIN dbo.tblSIPUsuarios AS usuDestino
        ON usuDestino.IDUser = a.FK_tblWRIUsuarioDestino_Id
    WHERE tp.PK_Id IN (292, 293, 294, 295, 296, 297)
      AND (@CursorIdAndamento IS NULL OR a.PK_ID > @CursorIdAndamento)
      AND (@DataInicial IS NULL OR CAST(a.Data AS DATE) >= @DataInicial)
      AND (@DataFinal IS NULL OR CAST(a.Data AS DATE) <= @DataFinal)
    ORDER BY a.Data DESC, a.PK_ID DESC;
END;
GO

-- Concessão de permissão de execução ao usuário de integração do FIORIXConnector
GRANT EXECUTE ON dbo.pr_Fiorix_BI_Retornos TO fiorix_connector;
GO
