import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireRole } from "@/lib/auth-helpers";
import { invalidateProdutividadeTenantCache } from "@/lib/bi-produtividade-cache";

export async function POST(request: Request) {
  try {
    const currentUser = await requireRole("ADMIN", "MASTER");
    const tenantId = currentUser.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: "Organização (tenant) não identificada na sessão." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { startDate = "2026-08-01", endDate = "2026-08-11" } = body;

    const mssqlOwnerTenantId = (process.env.MSSQL_OWNER_TENANT_ID || "").trim();
    const canUseMssqlDirect =
      process.env.MSSQL_DIRECT_FALLBACK_ENABLED === "true" &&
      Boolean(mssqlOwnerTenantId) &&
      mssqlOwnerTenantId === tenantId;

    const server = canUseMssqlDirect ? process.env.MSSQL_SERVER : undefined;
    const user = canUseMssqlDirect ? process.env.MSSQL_USER : undefined;
    const password = canUseMssqlDirect ? process.env.MSSQL_PASSWORD : undefined;
    const database = process.env.MSSQL_DATABASE || "WEBRI";

    let rowsToUpsert: any[] = [];
    let isSimulated = false;

    let sql: any = null;
    if (server && user && password) {
      try {
        sql = require("mssql");
      } catch (e) {
        console.warn("MSSQL package loading error:", e);
      }
    }

    if (server && user && password && sql) {
      // Configuração de conexão do SQL Server
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
        .input("DataInicial", sql.VarChar, startDate)
        .input("DataFinal", sql.VarChar, endDate)
        .query(`EXEC pr_Fiorix_BI_Produtividade @DataInicial, @DataFinal, '0'`);

      rowsToUpsert = result.recordset.map((row: any) => ({
        tenant_id: tenantId,
        data: row.DATA || row.data || row.Data,
        hora_num: parseInt(row.HORA_NUM || row.hora_num || 0, 10),
        dia_semana: row.DIA_SEMANA || row.dia_semana || "Monday",
        hora: row.HORA || row.hora || "00:00",
        pedido: parseInt(row.PEDIDO || row.pedido || 0, 10),
        nome: row.NOME || row.nome || "Outro",
        tipo: row.TIPO || row.tipo || "TÍTULO",
        tipo_pedido: row.TIPO_PEDIDO || row.tipo_pedido || "PRENOTADO",
        tipo_detalhado: row.TIPO_DETALHADO || row.tipo_detalhado || "",
        quantidade: parseInt(row.QUANTIDADE || row.quantidade || 1, 10),
      }));

      await sql.close();
    } else {
      // Simulação de dados de produtividade se não houver SQL Server configurado
      isSimulated = true;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const nomes = [
        "GuilhermeM", "Autentica Link de Pagamento", "FernandaS", "LucasK", 
        "RobertoA", "CamilaF", "FelipeG", "JulianaD"
      ];
      
      const tipoPedidos = [
        "PRENOTADO", "Consulta Eletrônica (CE)", "Consulta Eletrônica (VM)", 
        "Depósito de Certidões", "Exame e Cálculo"
      ];

      const diasSemana = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

      let pedidoAcumulado = 1300000;

      for (let i = 0; i < diffDays; i++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + i);
        const dataStr = currentDate.toISOString().split("T")[0];
        const diaSemanaStr = diasSemana[currentDate.getDay()];

        // Não gerar muito volume no fim de semana para simular realidade
        const isFimDeSemana = diaSemanaStr === "Sunday" || diaSemanaStr === "Saturday";
        const totalRegistrosDia = isFimDeSemana ? Math.floor(Math.random() * 20) + 5 : Math.floor(Math.random() * 800) + 1200;

        for (let j = 0; j < totalRegistrosDia; j++) {
          const horaNum = Math.floor(Math.random() * 24);
          const minutoNum = Math.floor(Math.random() * 60);
          const horaStr = `${String(horaNum).padStart(2, "0")}:${String(minutoNum).padStart(2, "0")}`;
          
          const tipo = Math.random() > 0.4 ? "TÍTULO" : "CERTIDÃO";
          
          let tipoPedido = tipoPedidos[Math.floor(Math.random() * tipoPedidos.length)];
          if (tipo === "CERTIDÃO" && Math.random() > 0.5) {
            tipoPedido = "Consulta Eletrônica (CE)";
          }

          const nome = nomes[Math.floor(Math.random() * nomes.length)];
          
          pedidoAcumulado += 1;

          rowsToUpsert.push({
            tenant_id: tenantId,
            data: dataStr,
            hora_num: horaNum,
            dia_semana: diaSemanaStr,
            hora: horaStr,
            pedido: pedidoAcumulado,
            nome: nome,
            tipo: tipo,
            tipo_pedido: tipoPedido,
            tipo_detalhado: `${tipo} - ${tipoPedido} detalhe`,
            quantidade: 1
          });
        }
      }
    }

    // Dividir em chunks para evitar estouro de tamanho no Supabase payload
    const chunkSize = 1000;
    let insertedCount = 0;

    for (let i = 0; i < rowsToUpsert.length; i += chunkSize) {
      const chunk = rowsToUpsert.slice(i, i + chunkSize);
      
      // Upsert via supabaseAdmin (service_role) respeitando isolamento multi-tenant
      const { error } = await supabaseAdmin
        .from("fiorix_produtividade_dados")
        .upsert(chunk, { onConflict: "tenant_id,pedido,data" });

      if (error) {
        console.error("Erro no upsert do Supabase:", error);
        throw new Error(error.message);
      }
      
      insertedCount += chunk.length;
    }

    invalidateProdutividadeTenantCache(tenantId);

    return NextResponse.json({
      success: true,
      total: rowsToUpsert.length,
      inserted: insertedCount,
      simulated: isSimulated,
    });
  } catch (error: any) {
    console.error("Erro na rota de sync:", error);
    return NextResponse.json(
      { success: false, error: "Erro interno na sincronização" },
      { status: 500 }
    );
  }
}
