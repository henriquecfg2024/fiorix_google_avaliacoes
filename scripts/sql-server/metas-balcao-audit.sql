/*
  Integrar estas expressoes ao CTE Fases de dbo.pr_Fiorix_BI_METAS.
  Execute primeiro em homologacao e preserve todos os joins e filtros atuais.
*/

MAX(CASE
  WHEN A.FK_tblWRITpAndamento_Id = 76 THEN A.[Data]
END) AS D_BALCAO_REGISTRADO,

MAX(CASE
  WHEN A.FK_tblWRITpAndamento_Id = 75 THEN A.[Data]
END) AS D_BALCAO_DEVOLVIDO

/*
  Inclua D_BALCAO_REGISTRADO e D_BALCAO_DEVOLVIDO no SELECT final da procedure.
  O app aceita esses nomes no CSV e os persiste por tenant/protocolo.
*/
