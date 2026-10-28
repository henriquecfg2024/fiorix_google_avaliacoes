import sql from 'mssql';
import { env } from './src/config/env.js';

async function listTipos() {
  const config: sql.config = {
    server: env.SQL_SERVER_HOST,
    database: env.SQL_SERVER_DATABASE,
    user: env.SQL_SERVER_USER,
    password: env.SQL_SERVER_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true, enableArithAbort: true }
  };
  const pool = await sql.connect(config);
  
  // Buscar tipos de andamento
  const res = await pool.request().query(`
    SELECT PK_Id, Sigla, Descricao 
    FROM dbo.tblWRITpAndamentos 
    WHERE PK_Id IN (14, 86, 106, 265, 131, 281, 282, 63, 103, 113, 76, 75, 48, 83, 10, 11, 12, 72, 99, 264, 267)
       OR Descricao LIKE '%Balcão%' 
       OR Descricao LIKE '%Entrega%' 
       OR Descricao LIKE '%Retirada%'
       OR Descricao LIKE '%Conferência%'
    ORDER BY PK_Id
  `);
  console.log('Tipos de andamento relevantes:');
  console.table(res.recordset);

  // E vamos ver os andamentos REAIS do protocolo 619916 direto no SQL Server:
  const andamentos619916 = await pool.request().query(`
    SELECT 
      a.PK_ID,
      a.Data,
      tp.PK_Id AS IdTipo,
      tp.Sigla,
      tp.Descricao AS TipoAndamento,
      usuOrig.NomeCompletoUser AS Origem,
      usuDest.NomeCompletoUser AS Destino,
      a.Observacao
    FROM dbo.tblWRIAndamentos a
    INNER JOIN dbo.tblWRITpAndamentos tp ON tp.PK_Id = a.FK_tblWRITpAndamento_Id
    LEFT JOIN dbo.tblSIPUsuarios usuOrig ON usuOrig.IDUser = a.FK_tblWRIUsuarioOrigem_Id
    LEFT JOIN dbo.tblSIPUsuarios usuDest ON usuDest.IDUser = a.FK_tblWRIUsuarioDestino_Id
    WHERE a.FK_tblWRIRecepcaoRecepcao = 619916
    ORDER BY a.Data ASC, a.PK_ID ASC
  `);
  console.log('\nAndamentos reais do protocolo 619916 no SQL Server:');
  console.table(andamentos619916.recordset);

  await pool.close();
}

listTipos();
