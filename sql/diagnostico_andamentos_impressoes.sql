USE WEBRI;
GO

-- =========================================================================================
-- SCRIPT DE DIAGNÓSTICO E MAPEAMENTO: CONTROLE DE IMPRESSÕES WEBRI
-- Execute no SQL Server (SSMS) com usuário administrativo / sa
-- Objetivo:
-- 1. Descobrir os códigos reais (PK_Id) dos tipos de andamentos de Impressão (Livro e Certidão)
-- 2. Inspecionar todos os andamentos do protocolo de referência 645454
--    (Confirmando Jean no livro, David na certidão, e identificando andamentos reflexos a ignorar)
-- =========================================================================================

PRINT '===================================================================';
PRINT '1. PESQUISANDO TIPOS DE ANDAMENTOS RELACIONADOS A IMPRESSÃO/CERTIDÃO/LIVRO/PREPARAÇÃO';
PRINT '===================================================================';

SELECT 
    tp.PK_Id AS IdTipoAndamento,
    tp.Sigla,
    tp.Descricao AS TipoAndamento
FROM dbo.tblWRITpAndamentos tp
WHERE tp.Descricao LIKE '%impress%' 
   OR tp.Descricao LIKE '%certid%' 
   OR tp.Descricao LIKE '%livro%' 
   OR tp.Descricao LIKE '%prepar%'
   OR tp.PK_Id IN (264, 113, 76)
ORDER BY tp.PK_Id;

PRINT '===================================================================';
PRINT '2. TODOS OS ANDAMENTOS DO PROTOCOLO DE REFERÊNCIA 645454';
PRINT '===================================================================';

SELECT 
    a.PK_ID AS IdAndamento,
    a.Data AS DataAndamento,
    a.FK_tblWRITpAndamento_Id AS IdTipoAndamento,
    tp.Sigla,
    tp.Descricao AS TipoAndamento,
    a.FK_tblWRIUsuarioOrigem_Id AS IdUsuOrigem,
    usuOrig.NomeCompletoUser AS UsuarioOrigem,
    a.FK_tblWRIUsuarioDestino_Id AS IdUsuDestino,
    usuDest.NomeCompletoUser AS UsuarioDestino,
    a.Observacao
FROM dbo.tblWRIAndamentos a
LEFT JOIN dbo.tblWRITpAndamentos tp ON tp.PK_Id = a.FK_tblWRITpAndamento_Id
LEFT JOIN dbo.tblSIPUsuarios usuOrig ON usuOrig.IDUser = a.FK_tblWRIUsuarioOrigem_Id
LEFT JOIN dbo.tblSIPUsuarios usuDest ON usuDest.IDUser = a.FK_tblWRIUsuarioDestino_Id
WHERE a.FK_tblWRIRecepcaoRecepcao = 645454
ORDER BY a.Data ASC, a.PK_ID ASC;

PRINT '===================================================================';
PRINT '3. AMOSTRA DOS ÚLTIMOS 20 ANDAMENTOS DO TIPO 264 E SIMILARES';
PRINT '===================================================================';

SELECT TOP 20
    a.PK_ID AS IdAndamento,
    a.FK_tblWRIRecepcaoRecepcao AS Protocolo,
    a.Data,
    a.FK_tblWRITpAndamento_Id AS IdTipoAndamento,
    tp.Descricao AS TipoAndamento,
    usuOrig.NomeCompletoUser AS OperadorOrigem,
    usuDest.NomeCompletoUser AS OperadorDestino,
    a.Observacao
FROM dbo.tblWRIAndamentos a
INNER JOIN dbo.tblWRITpAndamentos tp ON tp.PK_Id = a.FK_tblWRITpAndamento_Id
LEFT JOIN dbo.tblSIPUsuarios usuOrig ON usuOrig.IDUser = a.FK_tblWRIUsuarioOrigem_Id
LEFT JOIN dbo.tblSIPUsuarios usuDest ON usuDest.IDUser = a.FK_tblWRIUsuarioDestino_Id
WHERE a.FK_tblWRITpAndamento_Id IN (264, 113)
ORDER BY a.Data DESC;
