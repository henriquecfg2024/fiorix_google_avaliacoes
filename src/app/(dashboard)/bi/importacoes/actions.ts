"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";

export async function deleteImportRecord(id: string, source: "BI" | "PRODUTIVIDADE" | "METAS") {
  try {
    const user = await requireRole("ADMIN", "MASTER");

    if (source === "METAS") {
      const numericId = parseInt(id, 10);
      if (isNaN(numericId)) throw new Error("ID inválido para METAS");
      await prisma.$executeRaw(
        Prisma.sql`DELETE FROM public.fiorix_metas_imports WHERE id = ${numericId} AND tenant_id = ${user.tenantId}`
      );
    } else if (source === "PRODUTIVIDADE") {
      await prisma.$executeRaw(
        Prisma.sql`DELETE FROM public.fiorix_produtividade_imports WHERE id = ${id} AND tenant_id = ${user.tenantId}`
      );
    } else if (source === "BI") {
      await prisma.fiorixBiImport.deleteMany({
        where: { id, tenantId: user.tenantId },
      });
    }
    
    revalidatePath("/bi/importacoes");
    return { success: true };
  } catch (error: any) {
    console.error("Failed to delete import record:", error);
    return { error: error.message || "Erro ao excluir registro de importação" };
  }
}

