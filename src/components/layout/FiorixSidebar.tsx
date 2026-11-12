"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Building2, ChevronLeft, Home, Loader2, LogOut } from "lucide-react";
import { filterNavigationByRole, Role } from "@/lib/navigation/permissions";
import { getHomeRouteForRole } from "@/lib/permissions";
import { handleSignOut } from "@/app/actions/auth";
import {
  clearClientSessionCaches,
  loadCurrentUserOnce,
  loadNavigationStatsOnce,
  loadUserNavPermissionsOnce,
  fetchNavigationStatsFresh,
  type NavigationStats,
} from "@/lib/navigation/client-data";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FiorixLogoIcon } from "@/components/layout/FiorixLogoIcon";

export function FiorixSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<Role>("USER");
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [allowedItemIds, setAllowedItemIds] = useState<string[] | undefined>(undefined);
  const [firstAllowedHref, setFirstAllowedHref] = useState<string | undefined>(undefined);
  const [navResolved, setNavResolved] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [userPopoverOpen, setUserPopoverOpen] = useState(false);

  const [navigationStats, setNavigationStats] = useState<NavigationStats>({});

  const refreshStats = useCallback((force = false) => {
    fetchNavigationStatsFresh(force)
      .then((stats) => {
        setNavigationStats(stats);
        setPendingCount(Number(stats.pendingReviewsCount || 0));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("fiorix_sidebar_state");
    if (saved === "collapsed") {
      setIsCollapsed(true);
    }

    loadCurrentUserOnce()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
          if (user.role) setRole(user.role);
        }
      })
      .catch(() => {});

    loadUserNavPermissionsOnce()
      .then((res) => {
        if (res && res.enabled) {
          setAllowedItemIds(res.allowedItemIds);
          if (res.firstAllowedHref) setFirstAllowedHref(res.firstAllowedHref);
        }
      })
      .catch(() => {})
      .finally(() => {
        setNavResolved(true);
      });

    loadNavigationStatsOnce()
      .then((stats) => {
        setNavigationStats(stats);
        setPendingCount(Number(stats.pendingReviewsCount || 0));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleStatsUpdated = () => refreshStats(true);
    window.addEventListener("fiorix:navigation-stats-updated", handleStatsUpdated);
    return () => window.removeEventListener("fiorix:navigation-stats-updated", handleStatsUpdated);
  }, [refreshStats]);

  // Resetar estado de navegação quando a rota muda
  useEffect(() => {
    setNavigatingTo(null);
    setUserPopoverOpen(false);
    refreshStats(false);
  }, [pathname, refreshStats]);

  // Timeout de segurança para nunca travar os itens do menu caso a rota mantenha o mesmo pathname
  useEffect(() => {
    if (!navigatingTo) return;
    const timer = setTimeout(() => {
      setNavigatingTo(null);
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigatingTo]);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleNavClick = useCallback((href: string) => {
    const baseHref = href.split("?")[0];
    if (baseHref === pathname) return;
    setNavigatingTo(href);
  }, [pathname]);

  const isNavigating = navigatingTo !== null;

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("fiorix_sidebar_state", newState ? "collapsed" : "expanded");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard" && pathname === "/dashboard") return true;

    if (href.includes("?")) {
      const [baseHref, queryStr] = href.split("?");
      if (pathname !== baseHref) return false;
      if (typeof window !== "undefined") {
        const currentParams = new URLSearchParams(window.location.search);
        const targetParams = new URLSearchParams(queryStr);
        for (const [k, v] of Array.from(targetParams.entries())) {
          if (currentParams.get(k) !== v) return false;
        }
        return true;
      }
      return false;
    }

    if (href === "/sistema/pessoas" && (pathname?.startsWith("/sistema/pessoas") || pathname?.startsWith("/administracao/rh"))) {
      return true;
    }

    if (href === "/cartorio-virtual" || href === "/gestao-documental") {
      return pathname === href;
    }

    if (href !== "/dashboard" && pathname?.startsWith(href)) return true;
    return false;
  };

  const badgeColorClass = (badgeVariant?: string, isNew?: boolean) => {
    if (isNew) return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    if (badgeVariant === "destructive") return "bg-red-500/20 text-red-400 border border-red-500/30";
    if (badgeVariant === "amber") return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
    return "bg-white/10 text-white/90 border border-white/20";
  };

  if (!mounted) return <div className="hidden lg:flex w-64 h-full bg-white dark:bg-[#080A12] border-r border-slate-200 dark:border-white/5" />;

  const effectiveRole = (currentUser?.role as Role) || role;
  const isVisitor = String(effectiveRole).toUpperCase() === "VISITANTE";
  const canViewReviews = ["MASTER", "ADMIN", "SUBSTITUTO", "VISITANTE"].includes(String(effectiveRole).toUpperCase());
  const visibleGroups = filterNavigationByRole(effectiveRole, allowedItemIds);
  const defaultHomeRoute = getHomeRouteForRole(effectiveRole);
  const showInicioLink =
    effectiveRole === "MASTER"
      ? true
      : allowedItemIds !== undefined
        ? allowedItemIds.includes("inicio")
        : navResolved
          ? !["COLABORADOR", "RH"].includes(String(effectiveRole).toUpperCase())
          : false;
  const homeRoute = allowedItemIds !== undefined ? "/dashboard" : defaultHomeRoute;
  const logoHref = showInicioLink
    ? homeRoute
    : firstAllowedHref ||
      Object.values(visibleGroups)
        .flatMap((g: any) => (g?.href ? [{ href: g.href }] : g?.items || []))
        .map((i: any) => i.href)[0] ||
      "/minha-conta";

  const renderUserMenuPopoverContent = () => (
    <PopoverContent
      side="right"
      align="start"
      sideOffset={12}
      className="z-[160] w-60 rounded-xl border border-white/10 bg-[#0B0F1A]/95 p-2.5 text-slate-200 shadow-2xl backdrop-blur-xl"
    >
      <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-[11px] font-medium text-slate-300">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
        <span className="truncate">7º RI São Paulo</span>
      </div>

      <div className="mb-2 border-b border-white/[0.07] px-2.5 pb-2.5">
        <p className="truncate text-xs font-semibold text-slate-100">
          {currentUser?.name || "Usuário"}
        </p>
        <p className="mt-0.5 truncate text-[10px] text-slate-400/80">
          {currentUser?.email}
        </p>
        <div className="mt-1.5">
          <span className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-300">
            {currentUser?.role || effectiveRole || "USER"}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          setUserPopoverOpen(false);
          router.push("/minha-conta");
        }}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-300 transition hover:bg-white/[0.05] hover:text-white"
      >
        <span>👤 Minha Conta</span>
      </button>

      <form action={handleSignOut} onSubmit={() => clearClientSessionCaches()} className="mt-1">
        <button
          type="submit"
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-400/90 transition hover:bg-rose-500/10 hover:text-rose-300"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Sair</span>
        </button>
      </form>
    </PopoverContent>
  );

  return (
    <TooltipProvider delay={0}>
      <aside
        className={`hidden lg:flex flex-col h-full bg-[#080A12] border-r border-white/8 transition-all duration-300 ease-in-out relative z-40 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Logo & Toggle Section */}
        <div
          className={`flex items-center h-14 border-b border-white/8 shrink-0 transition-all ${
            isCollapsed ? "justify-center px-2" : "justify-between px-3.5"
          }`}
        >
          {isCollapsed ? (
            <Tooltip>
              {/* @ts-expect-error Radix UI asChild type mismatch */}
              <TooltipTrigger asChild>
                <button
                  onClick={toggleCollapse}
                  className="flex items-center justify-center p-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                  title="Expandir menu (FIORIX - Gestão de Qualidade)"
                  aria-label="Expandir menu"
                >
                  <FiorixLogoIcon className="w-[36px] h-[36px] shrink-0 group-hover:scale-110 transition-transform" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir menu (FIORIX - Gestão de Qualidade)</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Link
                href={logoHref}
                onClick={() => handleNavClick(logoHref)}
                className="flex items-center overflow-hidden group cursor-pointer min-w-0"
                title="FIORIX - Gestão de Qualidade"
              >
                <img
                  src="/logo-fiorix.png"
                  alt="FIORIX Gestão de Qualidade"
                  className="h-8 w-auto max-w-[180px] object-contain select-none group-hover:scale-[1.02] transition-transform"
                  draggable={false}
                />
              </Link>

              <button
                onClick={toggleCollapse}
                title="Recolher menu"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0 ml-auto"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Card Integrado da Serventia (7º RI São Paulo) + Usuário (CF) + Badges de Status */}
        <div className={`shrink-0 border-b border-white/[0.06] ${isCollapsed ? "px-2 py-2.5" : "px-3 py-2.5"}`}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.015] px-1.5 py-2">
              <Tooltip>
                {/* @ts-expect-error Radix UI asChild type mismatch */}
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-center gap-0.5 rounded-lg border border-white/[0.07] bg-slate-900/60 px-2 py-1 text-slate-300 cursor-default transition-colors hover:border-white/12 hover:text-slate-200">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                    <span className="text-[8.5px] font-semibold tracking-wider text-slate-300/90 leading-none">7º RI</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">7º RI São Paulo</TooltipContent>
              </Tooltip>

              <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                {/* @ts-expect-error Radix UI asChild type mismatch */}
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title={`${currentUser?.name || "Menu do Usuário"} • 7º RI São Paulo`}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-gradient-to-b from-slate-800/90 to-slate-900/95 text-[11px] font-semibold tracking-wider text-slate-200 shadow-xs transition-all hover:border-slate-500/40 hover:bg-slate-800 hover:text-white cursor-pointer"
                  >
                    {getInitials(currentUser?.name)}
                  </button>
                </PopoverTrigger>
                {renderUserMenuPopoverContent()}
              </Popover>

              {isVisitor && (
                <Tooltip>
                  {/* @ts-expect-error Radix UI asChild type mismatch */}
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => window.dispatchEvent(new CustomEvent("fiorix:toggle-visitor-banner"))}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-amber-400/30 bg-amber-500/10 text-[9px] font-semibold text-amber-300/90 cursor-pointer"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400/80" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">VISITANTE • ACESSO PROVISÓRIO</TooltipContent>
                </Tooltip>
              )}

              {canViewReviews && pathname?.startsWith("/avaliacoes") && (
                <Tooltip>
                  {/* @ts-expect-error Radix UI asChild type mismatch */}
                  <TooltipTrigger asChild>
                    <Link
                      prefetch={false}
                      href="/avaliacoes?status=PENDING"
                      className={`flex h-6 w-6 items-center justify-center rounded-full border text-[9px] font-semibold ${
                        pendingCount > 0
                          ? "border-red-500/25 bg-red-500/10 text-red-300/90"
                          : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300/90"
                      }`}
                    >
                      {pendingCount > 0 ? pendingCount : "✓"}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {pendingCount > 0 ? `${pendingCount} pendentes` : "✓ Todas respondidas"}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
              <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300">
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
                    <span className="truncate">7º RI São Paulo</span>
                  </div>

                  {/* @ts-expect-error Radix UI asChild type mismatch */}
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title={currentUser?.name || "Menu do Usuário"}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/12 bg-gradient-to-b from-slate-800/90 to-slate-900/95 text-[11px] font-semibold tracking-wider text-slate-200 shadow-xs transition-all hover:border-slate-500/40 hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      {getInitials(currentUser?.name)}
                    </button>
                  </PopoverTrigger>
                </div>

                {currentUser && (
                  /* @ts-expect-error Radix UI asChild type mismatch */
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/[0.04] cursor-pointer"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] font-semibold text-slate-200">
                          {currentUser.name}
                        </div>
                        <div className="truncate text-[9.5px] text-slate-400/75">
                          {currentUser.email}
                        </div>
                      </div>
                      <span className="shrink-0 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wider text-slate-300">
                        {currentUser.role || "USER"}
                      </span>
                    </button>
                  </PopoverTrigger>
                )}

                {renderUserMenuPopoverContent()}
              </Popover>

              {isVisitor && (
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("fiorix:toggle-visitor-banner"))}
                  title="Credencial de Visitante com acesso provisório e monitorado (clique para mostrar ou ocultar detalhes)"
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-amber-400/10 to-teal-500/15 px-2.5 py-1 text-[10px] font-extrabold tracking-wide text-amber-200 transition-colors hover:border-amber-300/70 cursor-pointer"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>VISITANTE • ACESSO PROVISÓRIO</span>
                </button>
              )}

              {canViewReviews && pathname?.startsWith("/avaliacoes") && (
                <Link
                  prefetch={false}
                  href="/avaliacoes?status=PENDING"
                  className={`inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10.5px] font-bold transition-all ${
                    pendingCount > 0
                      ? "border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
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
          )}
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
          {showInicioLink && (
            <>
              {isCollapsed ? (
                <Tooltip>
                  {/* @ts-expect-error Radix UI asChild type mismatch */}
                  <TooltipTrigger asChild>
                    <Link
                      href={homeRoute}
                      className={`flex items-center justify-center h-10 w-full rounded-lg transition-colors ${
                        isActive(homeRoute)
                          ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20"
                          : "text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      <Home className="w-5 h-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">Início</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  href={homeRoute}
                  onClick={() => handleNavClick(homeRoute)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    navigatingTo === homeRoute
                      ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 pointer-events-none"
                      : isActive(homeRoute)
                      ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20"
                      : isNavigating
                      ? "text-slate-400 dark:text-white/40 pointer-events-none border border-transparent"
                      : "text-slate-600 dark:text-white/60 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white border border-transparent"
                  }`}
                >
                  {navigatingTo === homeRoute ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400" />
                  ) : (
                    <Home className="w-4 h-4 opacity-75" />
                  )}
                  <span>Início</span>
                </Link>
              )}

              {!isCollapsed && <div className="h-2" />}
            </>
          )}

          {/* Groups */}
          {Object.entries(visibleGroups).map(([key, group]: [string, any]) => {
            const GroupIcon = group.icon;
            const isDirectLink = Boolean(group.href);
            const isDirectActive = isDirectLink && (pathname?.startsWith(group.href) || pathname?.startsWith("/administracao/rh"));
            const isGroupActive = isDirectLink ? isDirectActive : group.items.some((item: any) => isActive(item.href));

            if (isCollapsed) {
              if (isDirectLink) {
                return (
                  <Tooltip key={key}>
                    {/* @ts-expect-error Radix UI asChild type mismatch */}
                    <TooltipTrigger asChild>
                      <Link
                        href={group.href}
                        onClick={() => handleNavClick(group.href)}
                        className={`flex items-center justify-center h-10 w-full rounded-lg transition-colors cursor-pointer ${
                          isDirectActive
                            ? "bg-white/[0.05] text-slate-200 border border-white/[0.08]"
                            : "text-slate-400/80 hover:bg-white/[0.03] hover:text-slate-200 border border-transparent"
                        }`}
                      >
                        <GroupIcon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">{group.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Popover key={key}>
                  {/* @ts-expect-error Radix UI asChild type mismatch */}
                  <PopoverTrigger asChild>
                    <button
                      className={`flex items-center justify-center h-10 w-full rounded-lg transition-colors cursor-pointer ${
                        isGroupActive
                          ? "bg-white/[0.05] text-slate-200 border border-white/[0.08]"
                          : "text-slate-400/80 hover:bg-white/[0.03] hover:text-slate-200 border border-transparent"
                      }`}
                    >
                      <GroupIcon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="right"
                    align="start"
                    sideOffset={14}
                    className="bg-[#12141F]/95 border-white/10 backdrop-blur-xl p-2 w-64 shadow-2xl rounded-xl space-y-1 z-[150]"
                  >
                    <div className="px-3 py-1.5 mb-1 border-b border-white/5 text-xs font-bold text-white/50 uppercase tracking-wider">
                      {group.label}
                    </div>
                    {group.items.map((item: any) => {
                      const resolvedHref = item.href;
                      const active = isActive(resolvedHref);
                      const ItemIcon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={resolvedHref}
                          className="block"
                          onClick={() => {
                            if (item.href === '/minha-it' && typeof window !== 'undefined') {
                              window.dispatchEvent(new CustomEvent('fiorix-minha-it-open'));
                            }
                          }}
                        >
                          <div
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                              active
                                ? "bg-white/[0.08] text-white"
                                : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                            }`}
                          >
                            <ItemIcon className="w-4 h-4 opacity-75" />
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
                          </div>
                        </Link>
                      );
                    })}
                  </PopoverContent>
                </Popover>
              );
            }

            if (isDirectLink) {
              return (
                <Link
                  key={key}
                  href={group.href}
                  onClick={() => handleNavClick(group.href)}
                  className="block"
                >
                  <div
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      navigatingTo === group.href
                        ? "bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 pointer-events-none"
                        : isDirectActive
                        ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                        : isNavigating
                        ? "text-white/40 pointer-events-none border border-transparent"
                        : "text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent"
                    }`}
                  >
                    {navigatingTo === group.href ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
                    ) : (
                      <GroupIcon className="w-4 h-4 opacity-80 shrink-0" />
                    )}
                    <span className="truncate">{group.label}</span>
                  </div>
                </Link>
              );
            }

            return (
              // @ts-expect-error Radix UI type mismatch
              <Accordion type="single" collapsible key={key} defaultValue={(isGroupActive || (effectiveRole === "RH" && key === "trabalho") ? key : undefined) as any}>
                <AccordionItem value={key} className="border-none">
                  <AccordionTrigger className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold text-slate-500 dark:text-white/70 uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white hover:no-underline [&_[data-slot=accordion-trigger-icon]]:text-slate-400 dark:[&_[data-slot=accordion-trigger-icon]]:text-white/60 [&_[data-slot=accordion-trigger-icon]]:size-3.5 group-hover/accordion-trigger:[&_[data-slot=accordion-trigger-icon]]:text-slate-900 dark:group-hover/accordion-trigger:[&_[data-slot=accordion-trigger-icon]]:text-white">
                    <span className="truncate">{group.label}</span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-1 space-y-1">
                    {group.items.map((item: any) => {
                      const resolvedHref = item.href;
                      const active = isActive(resolvedHref);
                      const ItemIcon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={resolvedHref}
                          className="block"
                          onClick={() => {
                            handleNavClick(resolvedHref);
                            if (item.href === '/minha-it' && typeof window !== 'undefined') {
                              window.dispatchEvent(new CustomEvent('fiorix-minha-it-open'));
                            }
                          }}
                        >
                          <div
                            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                              navigatingTo === resolvedHref
                                ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30"
                                : active
                                ? "bg-slate-100 dark:bg-white/[0.08] text-slate-900 dark:text-white border border-slate-200 dark:border-white/5 shadow-sm"
                                : isNavigating
                                ? "text-slate-400 dark:text-white/30 pointer-events-none border border-transparent"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] hover:text-slate-900 dark:hover:text-white border border-transparent"
                            }`}
                          >
                            {navigatingTo === resolvedHref ? (
                              <Loader2 className="w-4 h-4 animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
                            ) : (
                              <ItemIcon className="w-4 h-4 opacity-80 shrink-0" />
                            )}
                            <div className="flex-1 min-w-0 flex items-center justify-between gap-2">
                              <span className="truncate">{item.label}</span>
                              {item.isNew && (
                                <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[9.5px] font-black rounded-md uppercase tracking-wide leading-none shrink-0">
                                  NOVO
                                </span>
                              )}
                              {!item.isNew && (item.badgeKey || item.badge) && (
                                <span
                                  className={`px-1.5 py-0.5 text-[9.5px] font-black rounded-md uppercase tracking-wide leading-none shrink-0 ${badgeColorClass(
                                    item.badgeVariant
                                  )}`}
                                >
                                  {(item.badgeKey && navigationStats[item.badgeKey]) || item.badge}
                                </span>
                              )}
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            );
          })}
        </div>
      </aside>
    </TooltipProvider>
  );
}
