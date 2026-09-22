import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ComunicadosClient } from "@/components/comunicados/ComunicadosClient";
import { PessoasRepository } from "@/lib/pessoas/repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comunicados Internos | FIORIX",
};

export default async function ComunicadosPage() {
  let userRole = "USER";
  let userName = "Colaborador";
  let userId = "";
  let initialComunicados: any[] = [];

  try {
    const session = await auth();
    if (session?.user) {
      userRole = session.user.role || "USER";
      userName = session.user.name || "Colaborador";
      userId = session.user.id;
      let tenantId = session.user.tenantId;

      if (!tenantId && userId) {
        const u = await prisma.user.findUnique({
          where: { id: userId },
          select: { tenantId: true },
        });
        tenantId = u?.tenantId || undefined;
      }

      if (tenantId && userId) {
        const dbComunicados = await PessoasRepository.getComunicados(tenantId, userId, userRole);
        initialComunicados = dbComunicados.map((c: any) => ({
          id: c.id,
          titulo: c.titulo,
          conteudo: c.conteudo,
          conteudoHash: c.conteudoHash,
          prioridade: c.prioridade,
          versao: c.versao ?? 1,
          dataPublicacao: c.dataPublicacao ? new Date(c.dataPublicacao).toISOString() : new Date().toISOString(),
          dataExpiracao: c.dataExpiracao ? new Date(c.dataExpiracao).toISOString() : null,
          exigeCiencia: c.exigeCiencia ?? true,
          visualizado: Boolean(c.ciencias && c.ciencias.length > 0),
          autorNome: c.autor?.name || "RH / Gestão",
          anexos: (c.anexos || []).map((a: any) => ({
            id: a.id,
            nomeOriginal: a.nomeOriginal,
            tamanhoBytes: a.tamanhoBytes,
            hashSha256: a.hashSha256,
            storagePath: a.storagePath,
          })),
          ciencias: (c.ciencias || []).map((ci: any) => ({
            id: ci.id,
            dataCiencia: ci.dataCiencia ? new Date(ci.dataCiencia).toISOString() : new Date().toISOString(),
            comprovanteHash: ci.comprovanteHash || "",
          })),
        }));
      }
    }
  } catch (err) {
    console.error("Auth or data error in ComunicadosPage:", err);
  }

  return (
    <ComunicadosClient
      userRole={userRole}
      userName={userName}
      initialComunicados={initialComunicados}
    />
  );
}
