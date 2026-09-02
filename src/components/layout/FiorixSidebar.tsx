"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Home, ChevronDown } from "lucide-react";
import { filterNavigationByRole, Role } from "@/lib/navigation/permissions";
import { getCurrentUser } from "@/app/actions/auth";
import { getHomeRouteForRole } from "@/lib/permissions";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function FiorixSidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>("USER");
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Fetch navigation stats dynamically if needed, just like FiorixHeader did
  const [navigationStats, setNavigationStats] = useState<Record<string, string>>({});

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("fiorix_sidebar_state");
    if (saved === "collapsed") {
      setIsCollapsed(true);
    }

    getCurrentUser()
      .then((user) => {
        if (user && user.role) setRole(user.role);
      })
      .catch(() => {});

    fetch("/api/navigation/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.stats) {
          setNavigationStats(data.stats);
        }
      })
      .catch(() => {});
  }, []);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("fiorix_sidebar_state", newState ? "collapsed" : "expanded");
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

  if (!mounted) return <div className="hidden lg:flex w-64 h-full bg-[#080A12] border-r border-white/5" />;

  const homeRoute = getHomeRouteForRole(role);
  const visibleGroups = filterNavigationByRole(role);

  return (
    <TooltipProvider delay={0}>
      <aside
        className={`hidden lg:flex flex-col h-full bg-[#080A12] border-r border-white/5 transition-all duration-300 ease-in-out relative z-40 ${
          isCollapsed ? "w-20" : "w-64"
        }`}
      >
        {/* Logo Section */}
        <div className="flex items-center h-14 px-4 border-b border-white/5 shrink-0 gap-3 overflow-hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366f1] to-[#a855f7] text-white font-extrabold shadow-md shrink-0">
            F
          </div>
          {!isCollapsed && (
            <span className="font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-white to-white/80 text-lg whitespace-nowrap transition-opacity duration-300">
              FIORIX
            </span>
          )}
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
          {/* Home Link */}
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={homeRoute}
                  className={`flex items-center justify-center h-10 w-full rounded-lg transition-colors ${
                    isActive(homeRoute)
                      ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Home className="w-5 h-5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Home</TooltipContent>
            </Tooltip>
          ) : (
            <Link
              href={homeRoute}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                isActive(homeRoute)
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "text-white/60 hover:bg-white/5 hover:text-white border border-transparent"
              }`}
            >
              <Home className="w-4 h-4 opacity-75" />
              <span>Home</span>
            </Link>
          )}

          {!isCollapsed && <div className="h-4" />}

          {/* Groups */}
          {Object.entries(visibleGroups).map(([key, group]) => {
            const GroupIcon = group.icon;
            const isGroupActive = group.items.some((item: any) => isActive(item.href));

            if (isCollapsed) {
              return (
                <Popover key={key}>
                  <PopoverTrigger asChild>
                    <button
                      className={`flex items-center justify-center h-10 w-full rounded-lg transition-colors cursor-pointer ${
                        isGroupActive
                          ? "bg-white/[0.08] text-white border border-white/10"
                          : "text-white/60 hover:bg-white/5 hover:text-white border border-transparent"
                      }`}
                    >
                      <GroupIcon className="w-5 h-5" />
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
                      const active = isActive(item.href);
                      const ItemIcon = item.icon;
                      return (
                        <Link key={item.href} href={item.href} className="block">
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

            return (
              <Accordion type="single" collapsible key={key} defaultValue={isGroupActive ? key : undefined}>
                <AccordionItem value={key} className="border-none">
                  <AccordionTrigger className="flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold text-white/50 uppercase tracking-wider hover:bg-white/5 hover:text-white hover:no-underline [&[data-state=open]>svg.chevron]:rotate-180">
                    <span className="truncate">{group.label}</span>
                    <ChevronDown className="chevron w-3.5 h-3.5 opacity-50 transition-transform duration-200" />
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-1 space-y-1">
                    {group.items.map((item: any) => {
                      const active = isActive(item.href);
                      const ItemIcon = item.icon;
                      return (
                        <Link key={item.href} href={item.href} className="block">
                          <div
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                              active
                                ? "bg-white/[0.08] text-white border border-white/5"
                                : "text-white/60 hover:bg-white/[0.04] hover:text-white border border-transparent"
                            }`}
                          >
                            <ItemIcon className="w-4 h-4 opacity-75 shrink-0" />
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
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            );
          })}
        </div>

        {/* Footer / Toggle Section */}
        <div className="p-3 border-t border-white/5 shrink-0">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleCollapse}
                  className="flex items-center justify-center w-full h-10 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Expandir menu</TooltipContent>
            </Tooltip>
          ) : (
            <button
              onClick={toggleCollapse}
              className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-semibold text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Recolher menu</span>
            </button>
          )}
        </div>
      </aside>
    </TooltipProvider>
  );
}
