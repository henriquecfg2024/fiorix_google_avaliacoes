import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getAllowedNavItemsForUser,
  getFirstAllowedRouteForUser,
} from "@/lib/nav-permissions/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Recursos Humanos | FIORIX Gestão de Qualidade",
};

const ALLOWED_ROLES = ["ADMIN", "RH", "MASTER", "GESTOR", "SUBSTITUTO", "VISITANTE"];

const RH_TAB_TO_ROUTE: Record<string, { itemId: string; href: string }> = {
  comunicados: { itemId: "gestao_comunicados", href: "/sistema/pessoas/comunicados" },
  ferias: { itemId: "rh_ferias", href: "/sistema/pessoas/ferias" },
  holerites: { itemId: "rh_holerites", href: "/sistema/pessoas/holerites" },
};

const RH_ORDERED_ROUTES = [
  { itemId: "gestao_comunicados", href: "/sistema/pessoas/comunicados" },
  { itemId: "rh_ferias", href: "/sistema/pessoas/ferias" },
  { itemId: "rh_holerites", href: "/sistema/pessoas/holerites" },
];

export default async function PainelRHRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const userRole = session.user.role || "USER";
  if (!ALLOWED_ROLES.includes(userRole)) {
    redirect("/pessoas");
  }

  const resolvedParams = searchParams ? await Promise.resolve(searchParams) : {};
  const requestedTab = resolvedParams?.tab ? RH_TAB_TO_ROUTE[resolvedParams.tab] : undefined;

  const userContext = {
    id: session.user.id,
    role: userRole,
    tenantId: (session.user as any).tenantId || "",
    departamento: (session.user as any).departamento || null,
  };

  if (userRole === "MASTER") {
    redirect(requestedTab?.href || "/sistema/pessoas/comunicados");
  }

  const nav = await getAllowedNavItemsForUser(userContext);
  if (!nav.enabled) {
    redirect(requestedTab?.href || "/sistema/pessoas/comunicados");
  }

  const allowedSet = new Set(nav.allowedItemIds);

  if (requestedTab && allowedSet.has(requestedTab.itemId)) {
    redirect(requestedTab.href);
  }

  const firstAllowedRh = RH_ORDERED_ROUTES.find((r) => allowedSet.has(r.itemId));
  if (firstAllowedRh) {
    redirect(firstAllowedRh.href);
  }

  const fallbackRoute = await getFirstAllowedRouteForUser(userContext);
  redirect(fallbackRoute === "/sistema/pessoas" ? "/minha-conta" : fallbackRoute);
}
