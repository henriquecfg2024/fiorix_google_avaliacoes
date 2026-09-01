"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  intervalMs?: number;
}

export function AutoRefresh({ intervalMs = 60000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }

      router.refresh();
    };

    const id = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, router]);

  return null;
}
