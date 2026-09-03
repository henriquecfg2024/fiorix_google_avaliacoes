"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, LogOut, Building2, Home } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { handleSignOut } from "@/app/actions/auth";
import { filterNavigationByRole, Role } from "@/lib/navigation/permissions";
import { getHomeRouteForRole } from "@/lib/permissions";
import {
  loadCurrentUserOnce,
  loadNavigationStatsOnce,
  type NavigationStats,
} from "@/lib/navigation/client-data";

export function FiorixTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [currentUser, setCurrentUser] = useState<{
    name: string;
    email: string;
    role: string;
  } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navigationStats, setNavigationStats] = useState<NavigationStats>({});

  useEffect(() => {
    loadCurrentUserOnce()
      .then((user) => {
        if (user) setCurrentUser(user);
      })
      .catch(() => {});

    loadNavigationStatsOnce()
      .then((stats) => {
        setNavigationStats(stats);
        setPendingCount(Number(stats.pendingReviewsCount || 0));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

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
  const homeRoute = getHomeRouteForRole(role);
  const visibleGroups = filterNavigationByRole(role);

  return (
    <header className="sticky top-0 z-50 h-14 w-full border-b border-white/[0.06] bg-[#080A12]/90 backdrop-blur-md">
      <div className="flex h-full items-center justify-between px-4 lg:px-8">
        
        {/* Esquerda: Contexto, Hamburguer (Mobile) */}
        <div className="flex items-center gap-4">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <button
                className="lg:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors cursor-pointer -ml-2"
                aria-label="Abrir menu"
              >
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-80 bg-[#080A12] border-white/10 text-white p-0 flex flex-col justify-between"
            >
              <div className="flex-1 overflow-y-auto">
                <SheetHeader className="p-5 border-b border-white/10 text-left">
                  <SheetTitle className="text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366f1] to-[#a855f7] text-white font-extrabold shadow-md shadow-indigo-500/20">
                        F
                      </div>
                      <div>
                        <span className="font-extrabold text-white text-base tracking-tight block">
                          FIORIX
                        </span>
                        <span className="text-[10px] font-semibold text-white/50 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-indigo-400" />
                          7º RI São Paulo
                        </span>
                      </div>
                    </div>
                  </SheetTitle>
                </SheetHeader>

                <div className="p-4 flex flex-col gap-2">
                  <Link
                    prefetch={false}
                    href={homeRoute}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                      isActive(homeRoute)
                        ? "bg-white/[0.08] text-white border border-white/10"
                        : "text-white/70 hover:bg-white/5 hover:text-white border border-transparent"
                    }`}
                  >
                    <Home className="w-4 h-4 opacity-75" />
                    <span>Home</span>
                  </Link>

                  <Accordion type="single" collapsible className="space-y-1 mt-2">
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
                                  prefetch={false}
                                  key={item.href}
                                  href={item.href}
                                  onClick={() => setIsMobileMenuOpen(false)}
                                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                                    active
                                      ? "bg-white/[0.08] text-white"
                                      : "text-white/60 hover:bg-white/[0.04] hover:text-white"
                                  }`}
                                >
                                  <ItemIcon className="w-3.5 h-3.5 opacity-75" />
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
              <div className="p-5 border-t border-white/10 bg-[#12141F] space-y-4 shrink-0">
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    router.push("/minha-conta");
                  }}
                  className="w-full bg-white/5 hover:bg-white/10 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
                >
                  <span>👤 Minha conta</span>
                </button>

                <div className="flex items-center gap-3 pt-1 border-t border-white/10">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-[#6366f1] to-[#a855f7] text-white font-bold text-xs flex items-center justify-center shadow-md shrink-0">
                    {getInitials(currentUser?.name)}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <div className="text-xs font-bold text-white truncate">
                      {currentUser?.name || "Usuário"}
                    </div>
                    <div className="text-[10px] text-white/50 truncate">
                      {currentUser?.email}
                    </div>
                  </div>
                  <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                    {currentUser?.role || "USER"}
                  </span>
                </div>

                <form action={handleSignOut} className="pt-1">
                  <button
                    type="submit"
                    className="w-full bg-red-500/10 hover:bg-red-500/15 text-red-300 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 border border-red-500/20 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sair do Sistema</span>
                  </button>
                </form>
              </div>
            </SheetContent>
          </Sheet>

          {/* Selector 7º RI São Paulo */}
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/5 bg-white/[0.02] text-xs font-semibold text-white/70">
            <Building2 className="w-3.5 h-3.5 text-[#6366f1]" />
            <span>7º RI São Paulo</span>
          </div>
        </div>

        {/* Direita: Badge Status, User Profile */}
        <div className="flex items-center gap-4">
          <Link
            prefetch={false}
            href="/avaliacoes?status=PENDING"
            className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${
              pendingCount > 0
                ? "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                pendingCount > 0 ? "bg-red-500 animate-pulse" : "bg-emerald-500"
              }`}
            />
            {pendingCount > 0 ? `${pendingCount} pendentes` : "✓ Todas respondidas"}
          </Link>

          {/* User Profile Dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#6366f1] to-[#a855f7] text-white font-bold text-xs shadow-md cursor-pointer hover:scale-105 transition-transform"
              title={currentUser?.name || "Menu do Usuário"}
            >
              {getInitials(currentUser?.name)}
            </button>

            {userMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className="absolute right-0 top-10 z-50 w-52 rounded-xl border border-white/10 bg-[#12141F] p-2 shadow-2xl backdrop-blur-xl">
                  <div className="px-3 py-2 border-b border-white/5 mb-1.5">
                    <p className="text-xs font-bold text-white truncate">
                      {currentUser?.name || "Usuário"}
                    </p>
                    <p className="text-[10px] text-white/50 truncate mt-0.5">
                      {currentUser?.email}
                    </p>
                    <div className="mt-1.5">
                      <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                        {currentUser?.role || "USER"}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
                      router.push("/minha-conta");
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-white/70 hover:bg-white/[0.04] hover:text-white text-left cursor-pointer"
                  >
                    👤 Minha conta
                  </button>

                  <form action={handleSignOut} className="mt-1">
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/10 text-left cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sair
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
