-- =============================================================================
-- FIORIX Connector — Permissões Estritamente SOMENTE LEITURA (Pesquisa Registral)
-- Banco alvo: WEBRI em SRVSQL (10.0.0.25)
-- Login alvo: [fiorix_connector]
--
-- Finalidade: Permitir consultas SELECT (WITH NOLOCK / READ UNCOMMITTED) no
-- Indicador Real, Indicador Pessoal e Catálogos Auxiliares do WEBRI, sem criar
-- logs, triggers ou qualquer permissão de escrita/alteração.
-- =============================================================================

USE [WEBRI];
GO

-- 1. Catálogos auxiliares (listas suspensas da tela Pesquisa Registral)
GRANT SELECT ON [dbo].[tblWRILivro] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRITipoImovel] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRIDistritos] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRISubdistritos] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRITipoLogradouro] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRITipoArea] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRITipoConfrontante] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRIUnidadeMedida] TO [fiorix_connector];

-- 2. Indicador Real / Localizações / Confrontantes / Medidas / CAR
GRANT SELECT ON [dbo].[tblWRILocalizacao] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRILogradouros] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRICidades] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRICondominio] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRIBlocos] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRILoteamento] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRISetores] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRIConfrontantes] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRIMedidas] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRICadastroAmbientalRural] TO [fiorix_connector];

-- 3. Indicador Pessoal / Pessoas / Documentos / Atos
GRANT SELECT ON [dbo].[tblWRIPessoas] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRIDocumentos] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRITpDocumento] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRIAtosParticipantes] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRIAtosNegocios] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRIAtos] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRINegocios] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRITipoAtos] TO [fiorix_connector];
GRANT SELECT ON [dbo].[tblWRITpParticipacao] TO [fiorix_connector];
GO
