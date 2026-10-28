-- =========================================================================================
-- Script de Limpeza / Remoção da Procedure de Auditoria Operacional
-- Compatibilidade: SQL Server 2012 e superiores (Banco WEBRI)
-- Descrição: Remove a procedure dbo.pr_Fiorix_BI_Andamentos criada exclusivamente
--            para a tela de Auditoria Operacional (descontinuada).
-- NOTA DE SEGURANÇA: Não afeta as procedures dbo.pr_Fiorix_BI_METAS, dbo.pr_Fiorix_BI_Impressoes,
--                    dbo.pr_Fiorix_BI_Incremental, dbo.pr_Fiorix_BI_Produtividade,
--                    dbo.pr_Fiorix_BI_TAREFAS ou dbo.pr_Fiorix_BI_Retornos.
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
