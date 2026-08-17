import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireTenant();
    const { searchParams } = new URL(request.url);
    const useSimulation = searchParams.get("simulate") === "true";

    let rawMetas: any[] = [];

    // Tentar pegar do Postgres escopado por tenantId
    try {
      rawMetas = await prisma.$queryRaw(
        Prisma.sql`
          SELECT * FROM public.fiorix_metas_dados 
          WHERE tenant_id = ${user.tenantId}
          ORDER BY COALESCE("DATA_APRESENTADO", data_apresentado) DESC 
          LIMIT 5000
        `
      );
    } catch (dbError) {
      try {
        rawMetas = await prisma.$queryRaw(
          Prisma.sql`
            SELECT * FROM public.fiorix_metas_dados 
            WHERE tenant_id = ${user.tenantId}
            LIMIT 5000
          `
        );
      } catch (err2) {
        console.warn("Postgres fetch error for Metas:", err2);
      }
    }

    // Fallback para SQL Server se estiver vazio ou com erro
    if (!rawMetas || rawMetas.length === 0) {
      const server = process.env.MSSQL_SERVER;
      const dbUser = process.env.MSSQL_USER;
      const password = process.env.MSSQL_PASSWORD;
      const database = process.env.MSSQL_DATABASE || "WEBRI";

      let sql: any = null;
      if (server && dbUser && password) {
        try {
          sql = require("mssql");
        } catch (e) {
          console.warn("MSSQL package loading error:", e);
        }
      }

      if (server && dbUser && password && sql) {
        try {
          const config = {
            user: dbUser,
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

          rawMetas = result.recordset || [];
          await sql.close();
        } catch (mssqlError) {
          console.error("MSSQL fallback error for Metas:", mssqlError);
        }
      }
    }

    // Normalizador Universal de Atributos (suporta UPPERCASE, lowercase, aliases e camelCase)
    const normalizeRow = (row: any) => {
      const getVal = (...keys: string[]) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null) return row[k];
        }
        return null;
      };

      const dataApresentado = getVal("DATA_APRESENTADO", "data_apresentado", "dataApresentado");
      const d1Protocolo = getVal("D1_PROTOCOLO", "d1_protocolo", "d1Protocolo", "D1_PROT");

      const dateKey = (value: unknown) => {
        if (!value) return null;
        const text = String(value);
        if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
        const brDate = text.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (brDate) return `${brDate[3]}-${brDate[2]}-${brDate[1]}`;
        const date = new Date(text);
        return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en-CA", {
          timeZone: "America/Sao_Paulo",
        }).format(date);
      };
      const todayKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
      }).format(new Date());
      const isProtocolOfToday = [dataApresentado, d1Protocolo]
        .some((value) => dateKey(value) === todayKey);

      return {
        protocolo: Number(getVal("PROTOCOLO", "protocolo", "Protocolo")),
        natureza: getVal("NATUREZA", "natureza", "Natureza", "TIPO_DETALHADO", "tipo_detalhado") || "",
        dataApresentado,
        dtPrevisao: getVal("DT_PREVISAO", "dt_previsao", "dtPrevisao"),
        dtEntregaReal: getVal("DT_ENTREGA_REAL", "dt_entrega_real", "dtEntregaReal"),
        status: isProtocolOfToday ? "Em dia" : (getVal("STATUS", "status", "Status") || "No Prazo"),
        atrasoDias: isProtocolOfToday ? 0 : Number(getVal("ATRASO_DIAS", "atraso_dias", "atrasoDias") || 0),
        
        d1Protocolo,
        d1Escaneamento: getVal("D1_ESCANEAMENTO", "d1_escaneamento", "d1Escaneamento", "D1_ESCAN"),
        d2Contraditorio: getVal("D2_CONTRADITORIO", "d2_contraditorio", "d2Contraditorio", "D2_CONTRAD"),
        d3Extrato: getVal("D3_EXTRATO", "d3_extrato", "d3Extrato", "D3_EXTR"),
        d4Qualificacao: getVal("D4_QUALIFICACAO", "d4_qualificacao", "d4Qualificacao", "D4_QUALI"),
        d5Calculo: getVal("D5_CALCULO", "d5_calculo", "d5Calculo", "D5_CALC"),
        d8Impressao: getVal("D8_IMPRESSAO", "d8_impressao", "d8Impressao", "D8_IMP"),
        d9Preparacao: getVal("D9_PREPARACAO", "d9_preparacao", "d9Preparacao", "D9_PREP"),
        d9Conferencia: getVal("D9_CONFERENCIA", "d9_conferencia", "d9Conferencia", "D9_CONF"),
        d10Entrega: getVal("D10_ENTREGA", "d10_entrega", "d10Entrega", "D10_ENT"),
        dBalcaoRegistrado: getVal("D_BALCAO_REGISTRADO", "d_balcao_registrado", "dBalcaoRegistrado"),
        dBalcaoDevolvido: getVal("D_BALCAO_DEVOLVIDO", "d_balcao_devolvido", "dBalcaoDevolvido"),
        
        qtdRetrabalho: Number(getVal("QTD_RETRABALHO", "qtd_retrabalho", "qtdRetrabalho") || 0),
        
        diasD1D2: getVal("DIAS_D1_D2", "dias_d1_d2", "diasD1D2") !== null ? Number(getVal("DIAS_D1_D2", "dias_d1_d2", "diasD1D2")) : null,
        diasD2D3: getVal("DIAS_D2_D3", "dias_d2_d3", "diasD2D3") !== null ? Number(getVal("DIAS_D2_D3", "dias_d2_d3", "diasD2D3")) : null,
        diasD3D4: getVal("DIAS_D3_D4", "dias_d3_d4", "diasD3D4") !== null ? Number(getVal("DIAS_D3_D4", "dias_d3_d4", "diasD3D4")) : null,
        diasD4D5: getVal("DIAS_D4_D5", "dias_d4_d5", "diasD4D5") !== null ? Number(getVal("DIAS_D4_D5", "dias_d4_d5", "diasD4D5")) : null,
        diasD5D8: getVal("DIAS_D5_D8", "dias_d5_d8", "diasD5D8") !== null ? Number(getVal("DIAS_D5_D8", "dias_d5_d8", "diasD5D8")) : null,
        diasD8D9: getVal("DIAS_D8_D9", "dias_d8_d9", "diasD8D9") !== null ? Number(getVal("DIAS_D8_D9", "dias_d8_d9", "diasD8D9")) : null,
      };
    };

    let metas = (rawMetas || []).map(normalizeRow);

    if (!metas || metas.length === 0 || useSimulation) {
      metas = [
        {
          protocolo: 642139,
          natureza: "Certidão",
          dataApresentado: new Date("2026-08-14T08:33:00Z"),
          dtPrevisao: new Date("2026-08-18T00:00:00Z"),
          dtEntregaReal: null,
          status: "Em dia",
          atrasoDias: 0,
          d1Protocolo: new Date("2026-08-14T08:33:00Z"),
          d1Escaneamento: null,
          d2Contraditorio: null,
          d3Extrato: null,
          d4Qualificacao: null,
          d5Calculo: null,
          d8Impressao: null,
          d9Preparacao: null,
          d9Conferencia: null,
          d10Entrega: null,
          dBalcaoRegistrado: null,
          dBalcaoDevolvido: null,
          qtdRetrabalho: 0,
          diasD1D2: 0,
          diasD2D3: null,
          diasD3D4: null,
          diasD4D5: null,
          diasD5D8: null,
          diasD8D9: null,
        },
        {
          protocolo: 629999,
          natureza: "Escritura de Compra e Venda",
          dataApresentado: new Date("2026-04-16T12:04:00Z"),
          dtPrevisao: new Date("2026-04-19T00:00:00Z"),
          dtEntregaReal: new Date("2026-04-28T00:00:00Z"),
          status: "Entregue com Atraso",
          atrasoDias: 9,
          d1Protocolo: new Date("2026-04-16T12:04:00Z"),
          d1Escaneamento: new Date("2026-04-16T14:30:00Z"),
          d2Contraditorio: new Date("2026-04-17T09:00:00Z"),
          d3Extrato: new Date("2026-04-18T10:00:00Z"),
          d4Qualificacao: new Date("2026-04-25T14:00:00Z"),
          d5Calculo: new Date("2026-04-28T10:00:00Z"),
          d8Impressao: new Date("2026-04-28T11:00:00Z"),
          d9Preparacao: new Date("2026-04-28T11:30:00Z"),
          d9Conferencia: new Date("2026-04-28T11:45:00Z"),
          d10Entrega: new Date("2026-04-28T12:00:00Z"),
          dBalcaoRegistrado: new Date("2026-04-28T11:50:00Z"),
          dBalcaoDevolvido: new Date("2026-04-28T12:00:00Z"),
          qtdRetrabalho: 1,
          diasD1D2: 1,
          diasD2D3: 1,
          diasD3D4: 7,
          diasD4D5: 3,
          diasD5D8: 0,
          diasD8D9: 0,
        }
      ];
    }

    return NextResponse.json({ success: true, data: metas });
  } catch (error: any) {
    console.error("Metas API Error:", error);
    return NextResponse.json({ success: false, error: "Erro ao consultar banco de dados" }, { status: 500 });
  }
}
