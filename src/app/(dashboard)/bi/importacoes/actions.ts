"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

export async function deleteImportRecord(id: string, source: "BI" | "PRODUTIVIDADE" | "METAS") {
  try {
    const user = await requireRole("ADMIN", "MASTER");

    if (source === "METAS") {
      if (id.startsWith("inferred-")) {
        const ym = id.replace("inferred-", "");
        await prisma.$executeRaw(
          Prisma.sql`
            DELETE FROM public.fiorix_metas_dados 
            WHERE tenant_id = ${user.tenantId} 
              AND to_char(data_apresentado, 'YYYY-MM') = ${ym}
          `
        );
      } else {
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) throw new Error("ID inválido para METAS");
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM public.fiorix_metas_imports WHERE id = ${numericId} AND tenant_id = ${user.tenantId}`
        );
      }
    } else if (source === "PRODUTIVIDADE") {
      if (id.startsWith("inferred-")) {
        const ym = id.replace("inferred-", "");
        await prisma.$executeRaw(
          Prisma.sql`
            DELETE FROM public.fiorix_produtividade_dados 
            WHERE tenant_id = ${user.tenantId} 
              AND to_char(data, 'YYYY-MM') = ${ym}
          `
        );
      } else {
        await prisma.$executeRaw(
          Prisma.sql`DELETE FROM public.fiorix_produtividade_imports WHERE id = ${id} AND tenant_id = ${user.tenantId}`
        );
      }
    } else if (source === "BI") {
      await prisma.fiorixBiImport.deleteMany({
        where: { id, tenantId: user.tenantId },
      });
      await prisma.$executeRaw(
        Prisma.sql`DELETE FROM public.fiorix_bi_data WHERE tenant_id = ${user.tenantId}`
      );
    }

    revalidatePath("/bi/importacoes");
    revalidatePath("/bi/produtividade");
    revalidatePath("/bi/metas");
    revalidatePath("/bi");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete import record:", error);
    return { error: "Erro ao excluir registro de importação" };
  }
}

export async function clearAllProdutividadeData() {
  try {
    const user = await requireRole("ADMIN", "MASTER");
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_produtividade_dados WHERE tenant_id = ${user.tenantId}`
    );
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_produtividade_imports WHERE tenant_id = ${user.tenantId}`
    );

    revalidatePath("/bi/importacoes");
    revalidatePath("/bi/produtividade");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to clear produtividade data:", error);
    return { error: "Erro ao limpar dados de produtividade" };
  }
}

export async function clearAllMetasData() {
  try {
    const user = await requireRole("ADMIN", "MASTER");
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_metas_dados WHERE tenant_id = ${user.tenantId}`
    );
    await prisma.$executeRaw(
      Prisma.sql`DELETE FROM public.fiorix_metas_imports WHERE tenant_id = ${user.tenantId}`
    );

    revalidatePath("/bi/importacoes");
    revalidatePath("/bi/metas");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to clear metas data:", error);
    return { error: "Erro ao limpar dados de metas" };
  }
}

