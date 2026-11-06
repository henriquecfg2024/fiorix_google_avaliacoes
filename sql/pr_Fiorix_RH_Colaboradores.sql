-- =========================================================================================
-- Script Oficial FIORIX: Integração Somente-Leitura GESTOR -> FIORIX (Módulo RH / Férias)
-- Servidor: SRVSQL (Compatível com SQL Server 2012 - 11.0 SP4 e superiores)
-- Bancos: GESTOR (leitura) e WEBRI (procedure de extração)
-- Permissão concedida: SOMENTE LEITURA (db_datareader em GESTOR + EXECUTE em WEBRI).
-- Nenhuma tabela do GESTOR sofre INSERT, UPDATE ou DELETE.
-- =========================================================================================

-- 1) Conceder acesso SOMENTE LEITURA ao usuário [fiorix_connector] no banco [GESTOR]
USE [GESTOR];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'fiorix_connector')
BEGIN
    CREATE USER [fiorix_connector] FOR LOGIN [fiorix_connector];
END;
GO

EXEC sp_addrolemember N'db_datareader', N'fiorix_connector';
GO

-- 2) Criar procedure de leitura estática (SQL Server 2012+) no banco [WEBRI]
USE [WEBRI];
GO

IF OBJECT_ID(N'dbo.pr_Fiorix_RH_Colaboradores', N'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.pr_Fiorix_RH_Colaboradores;
END;
GO

CREATE PROCEDURE dbo.pr_Fiorix_RH_Colaboradores
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.Registro AS Registro,
        LTRIM(RTRIM(c.Nome)) AS Nome,
        NULLIF(LTRIM(RTRIM(c.Apelido)), '') AS Apelido,
        NULLIF(LTRIM(RTRIM(c.CPF)), '') AS CPF,
        CONVERT(VARCHAR(10), c.DataNascimento, 23) AS DataNascimento,
        CONVERT(VARCHAR(10), c.DataAdmissao, 23) AS DataAdmissao,
        LTRIM(RTRIM(sx.Sexo)) AS Sexo,
        LTRIM(RTRIM(ec.EstadoCivil)) AS EstadoCivil,
        LTRIM(RTRIM(cid.Cidade)) AS Naturalidade,
        LTRIM(RTRIM(cid.FK_tblGESEstado_Id)) AS UF,
        LTRIM(RTRIM(nac.Nacionalidade)) AS Nacionalidade,
        LTRIM(RTRIM(cg.Cargo)) AS Cargo,
        LTRIM(RTRIM(st.Setor)) AS Setor,
        c.Ativo AS Ativo
    FROM GESTOR.dbo.tblColaborador AS c WITH (NOLOCK)
    LEFT JOIN GESTOR.dbo.tblGESSexo AS sx WITH (NOLOCK)
        ON sx.PK_Id = c.FK_tblGESSexo_Id
    LEFT JOIN GESTOR.dbo.tblGESEstadoCivil AS ec WITH (NOLOCK)
        ON ec.PK_Id = c.FK_tblGESEstadoCivil_Id
    LEFT JOIN GESTOR.dbo.tblGESCidade AS cid WITH (NOLOCK)
        ON cid.PK_Id = c.FK_tblGESCidadeNaturalidade_Id
    LEFT JOIN GESTOR.dbo.tblGESNacionalidade AS nac WITH (NOLOCK)
        ON nac.PK_Id = c.FK_tblGESNacionalidade_Id
    LEFT JOIN GESTOR.dbo.tblGESCargo AS cg WITH (NOLOCK)
        ON cg.PK_Id = c.FK_tblGESCargo_Id
    LEFT JOIN GESTOR.dbo.tblGESSetor AS st WITH (NOLOCK)
        ON st.PK_Id = c.FK_tblGESSetor_Id
    WHERE c.Nome IS NOT NULL
      AND LTRIM(RTRIM(c.Nome)) <> ''
    ORDER BY c.Registro ASC;
END;
GO

GRANT EXECUTE ON dbo.pr_Fiorix_RH_Colaboradores TO [fiorix_connector];
GO
