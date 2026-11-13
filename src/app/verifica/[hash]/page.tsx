import React from "react";
import type { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { maskIp } from "@/lib/security/requestIp";
import { VerificaHashClient } from "./VerificaHashClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verificação de Autenticidade e Ciência — FIORIX Gestão de Qualidade",
  description: "Validação pública de integridade criptográfica SHA-256 e auditoria de comunicados do 7º Registro de Imóveis de São Paulo.",
  referrer: "no-referrer",
  robots: {
    index: false,
    follow: false,
  },
};

function mascararNomeTitularPublico(nome?: string | null): string {
  const limpo = String(nome || "").trim();
  if (!limpo) return "Colaborador Verificado";
  const partes = limpo.split(/\s+/).filter(Boolean);
  return partes
    .map((p) => {
      if (p.length <= 2) return `${p[0] || "*"}.`;
      return `${p[0]}${"*".repeat(Math.min(4, p.length - 1))}`;
    })
    .join(" ");
}

interface VerificaHashPageProps {
  params: {
    hash: string;
  };
}

export default async function VerificaHashPage({ params }: VerificaHashPageProps) {
  const { hash } = params;

  let cienciaData: {
    valido: boolean;
    comprovanteHash: string;
    comunicadoTitulo?: string;
    comunicadoVersao?: number;
    comunicadoHash?: string;
    colaboradorNome?: string;
    colaboradorEmail?: string;
    dataCiencia?: string;
    ipMascarado?: string;
    scrollPercent?: number;
    tenantNome?: string;
  } = {
    valido: false,
    comprovanteHash: hash || "",
  };

  if (hash) {
    try {
      const registro = await prisma.fiorixComunicadoCiencia.findUnique({
        where: { comprovanteHash: hash },
        include: {
          usuario: { select: { id: true, name: true, email: true } },
          comunicado: { select: { titulo: true, versao: true, conteudoHash: true, tenantId: true } },
          tenant: { select: { name: true } },
        },
      });

      if (registro) {
        const session = await auth().catch(() => null);
        const sessionUser = session?.user;
        const roleUpper = String(sessionUser?.role || "").toUpperCase();
        const isSameTenant = Boolean(
          sessionUser?.tenantId && sessionUser.tenantId === registro.comunicado.tenantId
        );
        const canViewFullDetails =
          isSameTenant &&
          (sessionUser?.id === registro.usuarioId ||
            ["MASTER", "ADMIN", "RH", "GESTOR", "SUBSTITUTO"].includes(roleUpper));

        cienciaData = {
          valido: true,
          comprovanteHash: registro.comprovanteHash,
          comunicadoTitulo: canViewFullDetails
            ? registro.comunicado.titulo
            : "Comunicado Interno Verificado",
          comunicadoVersao: registro.comunicado.versao ?? 1,
          comunicadoHash: registro.comunicadoHash || registro.comunicado.conteudoHash,
          colaboradorNome: canViewFullDetails
            ? registro.usuario?.name || "Colaborador"
            : mascararNomeTitularPublico(registro.usuario?.name),
          colaboradorEmail: canViewFullDetails ? registro.usuario?.email || "" : "",
          dataCiencia: registro.dataCiencia
            ? new Date(registro.dataCiencia).toISOString()
            : new Date(registro.createdAt).toISOString(),
          ipMascarado: canViewFullDetails ? maskIp(registro.ip || "") : "Protegido (LGPD)",
          scrollPercent: registro.scrollPercent ?? 100,
          tenantNome: registro.tenant?.name || "7º Oficial de Registro de Imóveis de São Paulo",
        };
      }
    } catch (err) {
      console.error("[VerificaHashPage] Erro ao buscar ciência:", err);
    }
  }

  return <VerificaHashClient data={cienciaData} />;
}
