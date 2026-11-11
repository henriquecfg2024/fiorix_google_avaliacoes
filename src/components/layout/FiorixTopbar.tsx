"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, LogOut, Building2, Home, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { handleSignOut } from "@/app/actions/auth";
import { filterNavigationByRole, Role } from "@/lib/navigation/permissions";
import { getHomeRouteForRole } from "@/lib/permissions";
import {
  loadCurrentUserOnce,
  fetchNavigationStatsFresh,
  type NavigationStats,
} from "@/lib/navigation/client-data";
import { getUserNavPermissionsAction } from "@/app/actions/nav-permissions";

export function FiorixTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [allowedItemIds, setAllowedItemIds] = useState<string[] | undefined>(undefined);
  const [firstAllowedHref, setFirstAllowedHref] = useState<string | undefined>(undefined);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [navigationStats, setNavigationStats] = useState<NavigationStats>({});
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);

  const refreshStats = useCallback(() => {
    fetchNavigationStatsFresh()
      .then((stats) => {
        setNavigationStats(stats);
        setPendingCount(Number(stats.pendingReviewsCount || 0));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCurrentUserOnce()
      .then((user) => {
        if (user) setCurrentUser(user);
      })
      .catch(() => {});

    getUserNavPermissionsAction()
      .then((res) => {
        if (res && res.enabled) {
          setAllowedItemIds(res.allowedItemIds);
          if (res.firstAllowedHref) setFirstAllowedHref(res.firstAllowedHref);
        }
      })
      .catch(() => {});

    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    const handleStatsUpdated = () => refreshStats();
    window.addEventListener("fiorix:navigation-stats-updated", handleStatsUpdated);
    return () => window.removeEventListener("fiorix:navigation-stats-updated", handleStatsUpdated);
  }, [refreshStats]);

  useEffect(() => {
    refreshStats();
  }, [pathname, refreshStats]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setNavigatingTo(null);
  }, [pathname]);

  const handleNavClick = useCallback((href: string) => {
    if (href === pathname) return;
    setNavigatingTo(href);
  }, [pathname]);

  const isNavigating = navigatingTo !== null;

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const isActive = (href: string) => {
    if (href === "/dashboard" && pathname === "/dashboard") return true;
    if (href !== "/dashboard" && pathname?.startsWith(href)) return true;
    return false;
  };

  const badgeColorClass = (badgeVariant?: string, isNew?: boolean) => {
    if (isNew) return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    if (badgeVariant === "destructive") return "bg-red-500/20 text-red-400 border border-red-500/30";
    if (badgeVariant === "amber") return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
    return "bg-white/10 text-white/90 border border-white/20";
  };

  const role = (currentUser?.role as Role) || "USER";
  const isVisitor = String(role).toUpperCase() === "VISITANTE";
  const visibleGroups = filterNavigationByRole(role, allowedItemIds);
  const defaultHomeRoute = getHomeRouteForRole(role);
  const showInicioLink =
    role === "MASTER"
      ? true
      : allowedItemIds !== undefined
        ? allowedItemIds.includes("inicio")
        : !["COLABORADOR", "RH"].includes(String(role).toUpperCase());
  const homeRoute = allowedItemIds !== undefined ? "/dashboard" : defaultHomeRoute;
  const logoHref = showInicioLink ? homeRoute : firstAllowedHref || "/minha-conta";
  const canViewReviews = ["MASTER", "ADMIN", "SUBSTITUTO", "VISITANTE"].includes(role.toUpperCase());

  // No Desktop (lg:), todas as informações ficam no card do menu lateral (FiorixSidebar),
  // eliminando a primeira linha horizontal para aproveitar 100% da altura da tela.
  // No Mobile (< lg), um botão compacto flutuante abre o Card do Menu com todas as informações.
  return (
    <div className="lg:hidden print:hidden">
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="fixed top-2.5 right-3 z-50 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-[#080A12]/90 px-2.5 py-1.5 text-slate-200 shadow-lg backdrop-blur-md transition hover:border-white/25 hover:bg-[#121626] cursor-pointer"
            aria-label="Abrir menu do FIORIX"
            title="Abrir menu (7º RI São Paulo • Perfil e Navegação)"
          >
            <Menu className="h-4 w-4 text-slate-300" strokeWidth={1.75} />
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/12 bg-gradient-to-b from-slate-800/90 to-slate-900/95 text-[10px] font-semibold tracking-wider text-slate-200 shadow-2xs">
              {getInitials(currentUser?.name)}
            </span>
          </button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-80 bg-[#080A12] border-white/10 text-white p-0 flex flex-col justify-between"
        >
          <div className="flex-1 overflow-y-auto">
            <SheetHeader className="p-4 border-b border-white/10 text-left">
              <SheetTitle className="text-white flex items-center justify-between">
                <Link
                  href={logoHref}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center"
                >
                  <img
                    src="/logo-fiorix.png"
                    alt="FIORIX Gestão de Qualidade"
                    className="h-8 w-auto max-w-[190px] object-contain select-none"
                    draggable={false}
                  />
                </Link>
              </SheetTitle>
            </SheetHeader>

            {/* Card Elegante da Serventia (7º RI São Paulo) + Usuário (CF) + Badges no Menu Mobile */}
            <div className="px-4 pt-3 pb-2 border-b border-white/[0.07]">
              <div className="space-y-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
                    <span className="truncate">7º RI São Paulo</span>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-gradient-to-b from-slate-800/90 to-slate-900/95 text-[11px] font-semibold tracking-wider text-slate-200 shadow-xs">
                    {getInitials(currentUser?.name)}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-slate-200">
                      {currentUser?.name || "Usuário"}
                    </div>
                    <div className="truncate text-[10px] text-slate-400/75">
                      {currentUser?.email}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-300">
                    {currentUser?.role || "USER"}
                  </span>
                </div>

                {isVisitor && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      window.dispatchEvent(new CustomEvent("fiorix:toggle-visitor-banner"));
                    }}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-teal-500/15 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-amber-200 cursor-pointer"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span>VISITANTE • ACESSO PROVISÓRIO</span>
                  </button>
                )}

                {canViewReviews && pathname?.startsWith("/avaliacoes") && (
                  <Link
                    prefetch={false}
                    href="/avaliacoes?status=PENDING"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10.5px] font-bold transition-all ${
                      pendingCount > 0
                        ? "border-red-500/20 bg-red-500/10 text-red-400"
                        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        pendingCount > 0 ? "bg-red-500 animate-pulse" : "bg-emerald-500"
                      }`}
                    />
                    <span>{pendingCount > 0 ? `${pendingCount} pendentes` : "✓ Todas respondidas"}</span>
                  </Link>
                )}
              </div>
            </div>

            <div className="p-4 flex flex-col gap-2">
              {showInicioLink && (
                <Link
                  href={homeRoute}
                  onClick={() => { handleNavClick(homeRoute); setIsMobileMenuOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all duration-200 ${
                    navigatingTo === homeRoute
                      ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 pointer-events-none"
                      : isActive(homeRoute)
                      ? "bg-white/[0.08] text-white border border-white/10"
                      : isNavigating
                      ? "text-white/40 pointer-events-none border border-transparent"
                      : "text-white/70 hover:bg-white/5 hover:text-white border border-transparent"
                  }`}
                >
                  {navigatingTo === homeRoute ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  ) : (
                    <Home className="w-4 h-4 opacity-75" />
                  )}
                  <span>Início</span>
                </Link>
              )}

              {/* @ts-expect-error Radix UI type mismatch */}
              <Accordion type="single" collapsible className="space-y-1 mt-1">
                {Object.entries(visibleGroups).map(([key, group]) => {
                  const GroupIcon = group.icon;
                  return (
                    <AccordionItem key={key} value={key} className="border-none">
                      <AccordionTrigger className="flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold text-white/70 hover:bg-white/5 hover:text-white hover:no-underline [&[data-state=open]>svg]:rotate-90">
                        <div className="flex items-center gap-2">
                          <GroupIcon className="w-4 h-4 opacity-75" />
                          <span>{group.label}</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-1 pb-2 pl-6 pr-4 space-y-1">
                        {group.items.map((item: any) => {
                          const active = isActive(item.href);
                          const ItemIcon = item.icon;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => { handleNavClick(item.href); setIsMobileMenuOpen(false); }}
                              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                navigatingTo === item.href
                                  ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
                                  : active
                                  ? "bg-white/[0.08] text-white"
                                  : isNavigating
                                  ? "text-white/30 pointer-events-none"
                                  : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                              }`}
                            >
                              {navigatingTo === item.href ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                              ) : (
                                <ItemIcon className="w-3.5 h-3.5 opacity-75" />
                              )}
                              <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                                <span className="truncate">{item.label}</span>
                                {item.isNew && (
                                  <span className="px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[8px] font-black rounded-md uppercase tracking-wide leading-none shrink-0">
                                    NOVO
                                  </span>
                                )}
                                {!item.isNew && (item.badgeKey || item.badge) && (
                                  <span
                                    className={`px-1.5 py-0.2 text-[8px] font-black rounded-md uppercase tracking-wide leading-none shrink-0 ${badgeColorClass(
                                      item.badgeVariant
                                    )}`}
                                  >
                                    {(item.badgeKey && navigationStats[item.badgeKey]) || item.badge}
                                  </span>
                                )}
                              </div>
                            </Link>
                          );
                        })}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          </div>

          {/* Mobile Drawer Footer */}
          <div className="p-4 border-t border-white/10 bg-[#12141F] space-y-2.5 shrink-0">
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                router.push("/minha-conta");
              }}
              className="w-full bg-white/5 hover:bg-white/10 text-white font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
            >
              <span>👤 Minha Conta</span>
            </button>

            <form action={handleSignOut}>
              <button
                type="submit"
                className="w-full bg-red-500/10 hover:bg-red-500/15 text-red-300 font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-red-500/20 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair</span>
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
