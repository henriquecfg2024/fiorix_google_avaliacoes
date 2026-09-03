"use client";

import { getCurrentUser } from "@/app/actions/auth";

type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;
export type NavigationStats = Record<string, string | number> & {
  pendingReviewsCount?: number;
};

let currentUserPromise: Promise<CurrentUser> | null = null;
let navigationStatsPromise: Promise<NavigationStats> | null = null;

export function loadCurrentUserOnce() {
  if (!currentUserPromise) {
    currentUserPromise = getCurrentUser().catch((error) => {
      currentUserPromise = null;
      throw error;
    });
  }

  return currentUserPromise;
}

export function loadNavigationStatsOnce() {
  if (!navigationStatsPromise) {
    navigationStatsPromise = fetch("/api/navigation/stats")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Falha ao carregar estatísticas (${response.status})`);
        const data = await response.json();
        return data.success && data.stats ? data.stats : {};
      })
      .catch((error) => {
        navigationStatsPromise = null;
        throw error;
      });
  }

  return navigationStatsPromise;
}
