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

const USER_TTL_MS = 15_000; // 15 segundos para identidade no cliente
const STATS_TTL_MS = 30_000; // 30 segundos entre revalidações automáticas de navegação
const NAV_PERMS_TTL_MS = 60_000; // 60 segundos para permissões de menu no cliente

let currentUserPromise: Promise<CurrentUser> | null = null;
let currentUserFetchedAt = 0;
let lastResolvedIdentityKey: string | null = null;

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

export function clearClientSessionCaches() {
  currentUserPromise = null;
  currentUserFetchedAt = 0;
  lastResolvedIdentityKey = null;
  navigationStatsPromise = null;
  navigationStatsFetchedAt = 0;
  invalidateNavPermissionsClientCache();

  if (typeof window !== "undefined") {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (
            k &&
            (k.startsWith("fiorix.") ||
              k.startsWith("fiorix:") ||
              k.startsWith("fiorix_") ||
              k.startsWith("gestao-documental") ||
              k.startsWith("documental:"))
          ) {
            keysToRemove.push(k);
          }
        }
        for (const k of keysToRemove) {
          storage.removeItem(k);
        }
      } catch {
        // Ignora bloqueios de storage do navegador
      }
    }
  }
}

export function checkRouteAccessCached(pathname: string): Promise<RouteAccessCheckResult> {
  const isTestEnv = Boolean(process.env.VITEST || process.env.NODE_ENV === "test");
  const now = Date.now();
  const scopePrefix = lastResolvedIdentityKey || "anon";
  const cacheKey = `${scopePrefix}::${pathname}`;
  const cached = routeAccessCache.get(cacheKey);
  if (!isTestEnv && cached && now - cached.fetchedAt < NAV_PERMS_TTL_MS) {
    return cached.promise;
  }

  const promise = checkRouteAccessWithFallbackAction(pathname).catch((err) => {
    routeAccessCache.delete(cacheKey);
    throw err;
  });

  if (!isTestEnv) {
    routeAccessCache.set(cacheKey, { promise, fetchedAt: now });
  }
  return promise;
}

export function loadCurrentUserOnce(force = false) {
  const now = Date.now();
  if (!force && currentUserPromise && now - currentUserFetchedAt < USER_TTL_MS) {
    return currentUserPromise;
  }

  currentUserFetchedAt = now;
  currentUserPromise = getCurrentUser()
    .then((user) => {
      const nextKey = user ? `${user.id}:${user.tenantId}:${user.role}` : null;
      if (lastResolvedIdentityKey !== null && lastResolvedIdentityKey !== nextKey) {
        invalidateNavPermissionsClientCache();
        navigationStatsPromise = null;
        navigationStatsFetchedAt = 0;
      }
      lastResolvedIdentityKey = nextKey;
      return user;
    })
    .catch((error) => {
      currentUserPromise = null;
      currentUserFetchedAt = 0;
      throw error;
    });

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
