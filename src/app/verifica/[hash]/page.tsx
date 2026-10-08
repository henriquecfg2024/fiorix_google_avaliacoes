import React from "react";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { maskIp } from "@/lib/security/requestIp";
import { VerificaHashClient } from "./VerificaHashClient";

export const metadata: Metadata = {
  title: "Verificação de Autenticidade e Ciência — FIORIX",
  description: "Validação pública de integridade criptográfica SHA-256 e auditoria de comunicados do 7º Registro de Imóveis de São Paulo.",
  robots: {
    index: false,
    follow: false,
  },
};

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
          usuario: { select: { name: true, email: true } },
          comunicado: { select: { titulo: true, versao: true, conteudoHash: true } },
          tenant: { select: { name: true } },
        },
      });

      if (registro) {
        cienciaData = {
          valido: true,
          comprovanteHash: registro.comprovanteHash,
          comunicadoTitulo: registro.comunicado.titulo,
          comunicadoVersao: registro.comunicado.versao ?? 1,
          comunicadoHash: registro.comunicadoHash || registro.comunicado.conteudoHash,
          colaboradorNome: registro.usuario?.name || "Colaborador",
          colaboradorEmail: registro.usuario?.email || "",
          dataCiencia: registro.dataCiencia
            ? new Date(registro.dataCiencia).toISOString()
            : new Date(registro.createdAt).toISOString(),
          ipMascarado: maskIp(registro.ip || ""),
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
