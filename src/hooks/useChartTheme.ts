'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

/**
 * Hook que retorna tokens de cor adaptativos para gráficos Recharts/ECharts.
 * Reage à mudança de tema (light/dark) automaticamente.
 */
export function useChartTheme() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted ? resolvedTheme === 'dark' : true; // fallback to dark (original)

  return {
    isDark,
    mounted,

    // ─── Grid & Eixos ───────────────────────────────
    gridStroke: isDark ? 'rgba(148,163,184,0.12)' : 'rgba(148,163,184,0.25)',
    axisStroke: isDark ? 'rgba(148,163,184,0.38)' : 'rgba(100,116,139,0.6)',
    tickFill: isDark ? '#94A3B8' : '#64748B',
    tickFillMuted: isDark ? '#64748B' : '#94A3B8',

    // ─── Tooltip ────────────────────────────────────
    tooltipBg: isDark ? '#0B1020' : '#FFFFFF',
    tooltipBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(148,163,184,0.3)',
    tooltipText: isDark ? '#FFFFFF' : '#0F172A',
    tooltipSubtext: isDark ? 'rgba(255,255,255,0.6)' : '#64748B',
    tooltipCursor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',

    // ─── Labels & Text ──────────────────────────────
    labelColor: isDark ? '#E2E8F0' : '#1E293B',
    mutedLabelColor: isDark ? 'rgba(255,255,255,0.40)' : '#64748B',

    // ─── Gauge (ECharts) ────────────────────────────
    gaugeTrackColor: isDark
      ? [[1, 'rgba(148,163,184,0.15)']]
      : [[1, 'rgba(148,163,184,0.25)']],

    // ─── Gradients (opacidades mais fortes no light para melhor contraste) ──
    gradientOpacityHigh: isDark ? 0.34 : 0.45,
    gradientOpacityLow: isDark ? 0 : 0.05,
  };
}
