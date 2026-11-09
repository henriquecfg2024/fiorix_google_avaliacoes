/**
 * Controle de Acesso em Rotas/Servidor — Cartório Virtual (Seção 14)
 */

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth, type AuthenticatedUser } from "@/lib/auth-helpers";
import {
  getFirstAllowedRouteForUser,
  isNavPermissionsFeatureEnabled,
  isRouteAllowedForUser,
} from "@/lib/nav-permissions/service";
import { filterNavigationByRole } from "@/lib/navigation/permissions";
import {
  avaliarAutorizacaoCartorioVirtual,
  obterMatrizPadraoPapelRegistral,
  validarIsolamentoTenantRecurso,
  type RegistroAutorizacaoRegistral,
} from "./permissions-core";
import type { CapacidadeCartorioVirtual, PapelRegistral } from "./types";

export {
  avaliarAutorizacaoCartorioVirtual,
  obterMatrizPadraoPapelRegistral,
  validarIsolamentoTenantRecurso,
  type RegistroAutorizacaoRegistral,
};

export interface ContextoAutorizacaoCartorioVirtual {
  user: AuthenticatedUser;
  tenantId: string;
  tenantNome: string;
  papelSistema: string;
  papelRegistral: PapelRegistral;
  autorizacaoExplicitaEncontrada: boolean;
  migracaoTabelaPendente: boolean;
  capacidades: CapacidadeCartorioVirtual[];
}

function isTabelaNaoMigradaError(err: unknown): boolean {
  const code = (err as any)?.code;
  const msg = String((err as any)?.message || "");
  return (
    code === "P2021" ||
    code === "P2022" ||
    msg.includes("42P01") ||
    msg.includes("does not exist") ||
    msg.includes("fiorix_cv_")
  );
}

/**
 * Carrega no servidor o contexto completo de autorização do usuário autenticado na serventia ativa.
 */
export async function obterContextoAutorizacaoCartorioVirtual(): Promise<ContextoAutorizacaoCartorioVirtual> {
  let user: AuthenticatedUser;
  try {
    user = await requireAuth();
  } catch (err) {
    if (err && typeof err === "object" && "digest" in err && String((err as { digest?: string }).digest || "").startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    redirect("/login");
  }
  let tenantNome = "7º Registro de Imóveis de São Paulo";
  let migracaoTabelaPendente = false;
  let registroAutorizacao: RegistroAutorizacaoRegistral | null = null;

  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { name: true },
    });
    if (tenant?.name) {
      tenantNome = tenant.name;
    }
  } catch {
    // Mantém rótulo padrão resiliente
  }

  try {
    const authRow = await prisma.fiorixCvAutorizacao.findUnique({
      where: {
        tenantId_usuarioId: {
          tenantId: user.tenantId,
          usuarioId: user.id,
        },
      },
    });
    if (authRow) {
      registroAutorizacao = {
        papelRegistral: authRow.papelRegistral as PapelRegistral,
        ativo: authRow.ativo,
        podeConsultar: authRow.podeConsultar,
        podeConferir: authRow.podeConferir,
        podeAnotar: authRow.podeAnotar,
        podeSolicitarAtualizacao: authRow.podeSolicitarAtualiz,
        podeAprovarRevisao: authRow.podeAprovarRevisao,
        podeImprimir: authRow.podeImprimir,
        podeSolicitarAssinatura: authRow.podeSolicitarAssin,
        podeConfigurarRegras: authRow.podeConfigurarRegras,
        podeAuditarHistorico: authRow.podeAuditarHistorico,
        vigenciaInicio: null,
        vigenciaFim: null,
      };
    }
  } catch (err) {
    if (isTabelaNaoMigradaError(err)) {
      migracaoTabelaPendente = true;
    } else {
      throw err;
    }
  }

  const avaliacao = avaliarAutorizacaoCartorioVirtual({
    papelSistema: String(user.role || "USER"),
    atorTipo: "HUMANO",
    autorizacaoRegistral: registroAutorizacao,
  });

  return {
    user,
    tenantId: user.tenantId,
    tenantNome,
    papelSistema: String(user.role || "USER"),
    papelRegistral: avaliacao.papelRegistral,
    autorizacaoExplicitaEncontrada: Boolean(registroAutorizacao),
    migracaoTabelaPendente,
    capacidades: avaliacao.capacidades,
  };
}

/**
 * Impõe no SERVIDOR a autorização de rota de menu (ocultar item na Sidebar não constitui controle de acesso).
 */
export async function exigirAcessoRotaCartorioVirtual(
  pathname: string
): Promise<ContextoAutorizacaoCartorioVirtual> {
  const ctx = await obterContextoAutorizacaoCartorioVirtual();
  const roleStr = ctx.papelSistema;

  if (isNavPermissionsFeatureEnabled()) {
    const permitido = await isRouteAllowedForUser(pathname, {
      id: ctx.user.id,
      role: roleStr,
      tenantId: ctx.tenantId,
      departamento: ctx.user.departamento,
    });
    if (!permitido) {
      const destino = await getFirstAllowedRouteForUser({
        id: ctx.user.id,
        role: roleStr,
        tenantId: ctx.tenantId,
        departamento: ctx.user.departamento,
      });
      redirect(destino);
    }
  } else if (roleStr !== "MASTER") {
    const gruposLegado = filterNavigationByRole(roleStr);
    const cvGrupo = (gruposLegado as Record<string, any>).cartorioVirtual;
    if (!cvGrupo) {
      redirect("/minha-conta");
    }
    const baseHref = pathname.startsWith("/cartorio-virtual/certidoes/")
      ? "/cartorio-virtual/certidoes"
      : pathname;
    const itemPermitido = cvGrupo.items?.some((i: any) => i.href === baseHref);
    if (!itemPermitido) {
      redirect("/minha-conta");
    }
  }

  if (!ctx.capacidades.includes("consultar")) {
    redirect("/minha-conta");
  }

  return ctx;
}

/**
 * Exige capacidade funcional/registral específica em Server Actions e API Routes.
 */
export async function exigirCapacidadeCartorioVirtual(
  capacidade: CapacidadeCartorioVirtual
): Promise<ContextoAutorizacaoCartorioVirtual> {
  const ctx = await obterContextoAutorizacaoCartorioVirtual();
  if (!ctx.capacidades.includes(capacidade)) {
    throw new Error(
      `Acesso negado no Cartório Virtual: sua conta (${ctx.papelSistema} / ${ctx.papelRegistral}) não possui a autorização "${capacidade}" nesta serventia.`
    );
  }
  return ctx;
}
