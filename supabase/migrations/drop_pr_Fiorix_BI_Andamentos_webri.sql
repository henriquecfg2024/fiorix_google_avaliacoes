-- =========================================================================================
-- Script SQL Server (WebRI) para Execução Manual no Servidor Local do Cartório
-- Descrição: Remove a procedure dbo.pr_Fiorix_BI_Andamentos dedicada à tela de Auditoria.
-- =========================================================================================

USE WEBRI;
GO

IF OBJECT_ID('dbo.pr_Fiorix_BI_Andamentos', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.pr_Fiorix_BI_Andamentos;
    PRINT 'Procedure dbo.pr_Fiorix_BI_Andamentos removida com sucesso do banco WEBRI.';
END
ELSE
BEGIN
    PRINT 'Procedure dbo.pr_Fiorix_BI_Andamentos não encontrada ou já havia sido removida.';
END
GO
