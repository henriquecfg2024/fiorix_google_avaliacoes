import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/auth-helpers";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireTenant();
    const { searchParams } = new URL(request.url);
    const dataInicial = searchParams.get("dataInicial") || searchParams.get("DataInicial") || null;
    const dataFinal = searchParams.get("dataFinal") || searchParams.get("DataFinal") || null;
    const somenteAbertas = searchParams.get("somenteAbertas") !== "0" && searchParams.get("somenteAbertas") !== "false";

    let rawTarefas: any[] = [];

    // 1. Tentar buscar do Postgres fiorix_tarefas_dados escopado por tenant_id
    try {
      rawTarefas = await prisma.$queryRaw(
        Prisma.sql`
          SELECT * FROM public.fiorix_tarefas_dados 
          WHERE tenant_id = ${user.tenantId}
          ORDER BY dt_previsao ASC NULLS LAST, protocolo ASC
          LIMIT 5000
        `
      );
    } catch (dbErr) {
      console.warn("Erro ao buscar tarefas do Postgres:", dbErr);
    }

    // 2. Fallback para MSSQL (procedure dbo.pr_Fiorix_BI_TAREFAS) se o Postgres estiver vazio
    if (!rawTarefas || rawTarefas.length === 0) {
      const server = process.env.MSSQL_SERVER;
      const dbUser = process.env.MSSQL_USER;
      const password = process.env.MSSQL_PASSWORD;
      const database = process.env.MSSQL_DATABASE || "WEBRI";

      let sql: any = null;
      if (server && dbUser && password) {
        try {
          sql = require("mssql");
        } catch (e) {
          console.warn("Mssql module non-critical load error:", e);
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
          const requestMssql = pool.request();

          requestMssql.input("SomenteAbertas", sql.Bit, somenteAbertas ? 1 : 0);
          if (dataInicial) requestMssql.input("DataInicial", sql.VarChar, dataInicial);
          if (dataFinal) requestMssql.input("DataFinal", sql.VarChar, dataFinal);

          const result = await requestMssql.query(`EXEC dbo.pr_Fiorix_BI_TAREFAS @SomenteAbertas = @SomenteAbertas`);
          rawTarefas = result.recordset || [];
          await sql.close();
        } catch (mssqlErr) {
          console.error("Erro no fallback MSSQL para Tarefas:", mssqlErr);
        }
      }
    }

    // 3. Normalizador Universal de Atributos (suporta UPPERCASE, lowercase e camelCase)
    const normalizeRow = (row: any) => {
      const getVal = (...keys: string[]) => {
        for (const k of keys) {
          if (row[k] !== undefined && row[k] !== null) return row[k];
        }
        return null;
      };

      const dtPrevisao = getVal("DT_PREVISAO", "dt_previsao", "dtPrevisao");
      const dataAbertura = getVal("DATA_ABERTURA", "data_abertura", "dataAbertura");
      const dataFinalizacao = getVal("DATA_FINALIZACAO", "data_finalizacao", "dataFinalizacao");
      const statusPrevisao = getVal("STATUS_PREVISAO", "status_previsao", "statusPrevisao");
      const nivelRisco = getVal("NIVEL_RISCO", "nivel_risco", "nivelRisco");

      return {
        protocolo: Number(getVal("PROTOCOLO", "protocolo", "Protocolo") || 0),
        seqTitulo: Number(getVal("SEQ_TITULO", "seq_titulo", "seqTitulo") || 1),
        dataEntrada: getVal("DATA_ENTRADA", "data_entrada", "dataEntrada"),
        dtPrevisao,
        diasParaPrevisao: Number(getVal("DIAS_PARA_PREVISAO", "dias_para_previsao", "diasParaPrevisao") || 0),
        statusPrevisao: statusPrevisao || "NO PRAZO",
        nivelRisco: nivelRisco || "NORMAL",
        idServico: getVal("ID_SERVICO", "id_servico", "idServico"),
        numeroServico: getVal("NUMERO_SERVICO", "numero_servico", "numeroServico"),
        itemServico: getVal("ITEM_SERVICO", "item_servico", "itemServico"),
        dataServico: getVal("DATA_SERVICO", "data_servico", "dataServico"),
        vencimentoServico: getVal("VENCIMENTO_SERVICO", "vencimento_servico", "vencimentoServico"),
        idTarefa: String(getVal("ID_TAREFA", "id_tarefa", "idTarefa") || ""),
        tarefa: getVal("TAREFA", "tarefa", "Tarefa") || "Geral",
        dataCadastroTarefa: getVal("DATA_CADASTRO_TAREFA", "data_cadastro_tarefa", "dataCadastroTarefa"),
        statusTarefa: getVal("STATUS_TAREFA", "status_tarefa", "statusTarefa"),
        dataAbertura,
        dataFinalizacao,
        situacaoTarefa: getVal("SITUACAO_TAREFA", "situacao_tarefa", "situacaoTarefa") || "EM ANDAMENTO",
        idUsuario: getVal("ID_USUARIO", "id_usuario", "idUsuario"),
        responsavel: getVal("RESPONSAVEL", "responsavel", "Responsavel") || "Não Atribuído",
        tipo: getVal("TIPO", "tipo", "Tipo") || "",
        natureza: getVal("NATUREZA", "natureza", "Natureza") || "",
      };
    };

    const tarefas = (rawTarefas || []).map(normalizeRow);

    return NextResponse.json({
      success: true,
      count: tarefas.length,
      tarefas,
    });
  } catch (error: any) {
    console.error("Erro na API /api/bi/tarefas/data:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erro ao carregar dados de tarefas" },
      { status: 500 }
    );
  }
}
