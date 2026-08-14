import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const useSimulation = searchParams.get("simulate") === "true";

    let metas = [];

    // Tentar pegar do Postgres primeiro
    try {
      metas = await prisma.fiorixMetasDados.findMany({
        take: 5000,
        orderBy: {
          dataApresentado: 'desc'
        }
      });
    } catch (dbError) {
      console.warn("Postgres fetch error for Metas:", dbError);
    }

    // Fallback para SQL Server se estiver vazio ou com erro
    if (!metas || metas.length === 0) {
      const server = process.env.MSSQL_SERVER;
      const user = process.env.MSSQL_USER;
      const password = process.env.MSSQL_PASSWORD;
      const database = process.env.MSSQL_DATABASE || "WEBRI";

      let sql: any = null;
      if (server && user && password) {
        try {
          sql = require("mssql");
        } catch (e) {
          console.warn("MSSQL package loading error:", e);
        }
      }

      if (server && user && password && sql) {
        try {
          const config = {
            user,
            password,
            server,
            database,
            options: {
              encrypt: true,
              trustServerCertificate: true,
            },
          };

          const pool = await sql.connect(config);
          const result = await pool
            .request()
            .query(`EXEC pr_Fiorix_BI_METAS`);

          metas = result.recordset.map((row: any) => ({
            protocolo: row.PROTOCOLO || row.protocolo,
            dataApresentado: row.DATA_APRESENTADO || row.data_apresentado,
            dtPrevisao: row.DT_PREVISAO || row.dt_previsao,
            dtEntregaReal: row.DT_ENTREGA_REAL || row.dt_entrega_real,
            status: row.STATUS || row.status,
            atrasoDias: row.ATRASO_DIAS || row.atraso_dias,
            d1Protocolo: row.D1_PROTOCOLO || row.d1_protocolo,
            d2Contraditorio: row.D2_CONTRADITORIO || row.d2_contraditorio,
            d3Extrato: row.D3_EXTRATO || row.d3_extrato,
            d4Qualificacao: row.D4_QUALIFICACAO || row.d4_qualificacao,
            d5Calculo: row.D5_CALCULO || row.d5_calculo,
            d8Impressao: row.D8_IMPRESSAO || row.d8_impressao,
            d9Preparacao: row.D9_PREPARACAO || row.d9_preparacao,
            d10Entrega: row.D10_ENTREGA || row.d10_entrega,
            diasD1D2: row.DIAS_D1_D2 || row.dias_d1_d2,
            diasD2D3: row.DIAS_D2_D3 || row.dias_d2_d3,
            diasD3D4: row.DIAS_D3_D4 || row.dias_d3_d4,
            diasD4D5: row.DIAS_D4_D5 || row.dias_d4_d5,
            diasD5D8: row.DIAS_D5_D8 || row.dias_d5_d8,
            diasD8D9: row.DIAS_D8_D9 || row.dias_d8_d9,
          }));

          await sql.close();
        } catch (mssqlError) {
          console.error("MSSQL fallback error for Metas:", mssqlError);
        }
      }
    }

    // Fallback Mocked se tudo falhar (para testes do layout conforme prompt 629999)
    if (!metas || metas.length === 0 || useSimulation) {
      metas = [
        {
          protocolo: 629999,
          dataApresentado: new Date("2026-04-16T12:04:00Z"),
          dtPrevisao: new Date("2026-04-19T00:00:00Z"),
          dtEntregaReal: new Date("2026-04-28T00:00:00Z"),
          status: "Entregue com Atraso",
          atrasoDias: 9,
          d1Protocolo: new Date("2026-04-16T12:04:00Z"),
          d2Contraditorio: new Date("2026-04-17T09:00:00Z"),
          d3Extrato: new Date("2026-04-18T10:00:00Z"),
          d4Qualificacao: new Date("2026-04-25T14:00:00Z"), // Gargalo aqui (7 dias)
          d5Calculo: new Date("2026-04-28T10:00:00Z"),
          diasD1D2: 1,
          diasD2D3: 1,
          diasD3D4: 7,
          diasD4D5: 3,
          diasD5D8: 0,
          diasD8D9: 0,
        },
        {
          protocolo: 630000,
          dataApresentado: new Date("2026-04-17T10:00:00Z"),
          dtPrevisao: new Date("2026-04-20T00:00:00Z"),
          dtEntregaReal: new Date("2026-04-19T00:00:00Z"),
          status: "No Prazo",
          atrasoDias: 0,
          d1Protocolo: new Date("2026-04-17T10:00:00Z"),
          d2Contraditorio: new Date("2026-04-17T14:00:00Z"),
          d3Extrato: new Date("2026-04-18T10:00:00Z"),
          d4Qualificacao: new Date("2026-04-19T10:00:00Z"),
          d5Calculo: new Date("2026-04-19T12:00:00Z"),
          diasD1D2: 0,
          diasD2D3: 1,
          diasD3D4: 1,
          diasD4D5: 0,
          diasD5D8: 0,
          diasD8D9: 0,
        }
      ];
    }

    return NextResponse.json({ success: true, data: metas });
  } catch (error: any) {
    console.error("Metas API Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
