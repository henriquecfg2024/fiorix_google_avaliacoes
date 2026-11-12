"use client";

import { getCurrentUser } from "@/app/actions/auth";
import {
  getUserNavPermissionsAction,
  checkRouteAccessWithFallbackAction,
} from "@/app/actions/nav-permissions";

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;
export type UserNavPermissions = Awaited<ReturnType<typeof getUserNavPermissionsAction>>;
export type RouteAccessCheckResult = Awaited<ReturnType<typeof checkRouteAccessWithFallbackAction>>;
export type NavigationStats = Record<string, string | number> & {
  pendingReviewsCount?: number;
};

const STATS_TTL_MS = 30_000; // 30 segundos entre revalidações automáticas de navegação
const NAV_PERMS_TTL_MS = 60_000; // 60 segundos para permissões de menu no cliente

let currentUserPromise: Promise<CurrentUser> | null = null;
let navigationStatsPromise: Promise<NavigationStats> | null = null;
let navigationStatsFetchedAt = 0;

let navPermissionsPromise: Promise<UserNavPermissions> | null = null;
let navPermissionsFetchedAt = 0;

const routeAccessCache = new Map<string, { promise: Promise<RouteAccessCheckResult>; fetchedAt: number }>();

export function invalidateNavPermissionsClientCache() {
  navPermissionsPromise = null;
  navPermissionsFetchedAt = 0;
  routeAccessCache.clear();
}

export function checkRouteAccessCached(pathname: string): Promise<RouteAccessCheckResult> {
  const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === "test");
  const now = Date.now();
  const cached = routeAccessCache.get(pathname);
  if (!isTestEnv && cached && now - cached.fetchedAt < NAV_PERMS_TTL_MS) {
    return cached.promise;
  }

  const promise = checkRouteAccessWithFallbackAction(pathname).catch((err) => {
    routeAccessCache.delete(pathname);
    throw err;
  });

  if (!isTestEnv) {
    routeAccessCache.set(pathname, { promise, fetchedAt: now });
  }
  return promise;
}

export function loadCurrentUserOnce() {
  if (!currentUserPromise) {
    currentUserPromise = getCurrentUser().catch((error) => {
      currentUserPromise = null;
      throw error;
    });
  }

  return currentUserPromise;
}

export function loadUserNavPermissionsOnce(force = false): Promise<UserNavPermissions> {
  const now = Date.now();
  if (!force && navPermissionsPromise && now - navPermissionsFetchedAt < NAV_PERMS_TTL_MS) {
    return navPermissionsPromise;
  }

  navPermissionsFetchedAt = now;
  navPermissionsPromise = getUserNavPermissionsAction().catch((error) => {
    navPermissionsPromise = null;
    navPermissionsFetchedAt = 0;
    throw error;
  });

  return navPermissionsPromise;
}

export function invalidateNavigationStats() {
  navigationStatsPromise = null;
  navigationStatsFetchedAt = 0;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("fiorix:navigation-stats-updated"));
  }
}

export function fetchNavigationStatsFresh(force = false): Promise<NavigationStats> {
  const now = Date.now();
  if (!force && navigationStatsPromise && now - navigationStatsFetchedAt < STATS_TTL_MS) {
    return navigationStatsPromise;
  }

  navigationStatsFetchedAt = now;
  navigationStatsPromise = fetch("/api/navigation/stats", { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Falha ao carregar estatísticas (${response.status})`);
      const data = await response.json();
      return data.success && data.stats ? data.stats : {};
    })
    .catch((error) => {
      navigationStatsPromise = null;
      navigationStatsFetchedAt = 0;
      throw error;
    });

  return navigationStatsPromise;
}

export function loadNavigationStatsOnce() {
  return fetchNavigationStatsFresh(false);
}
