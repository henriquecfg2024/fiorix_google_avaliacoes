"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  intervalMs?: number;
  enabled?: boolean;
}

export function AutoRefresh({ intervalMs = 60000, enabled = true }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const refresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      router.refresh();
    };

    const id = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
