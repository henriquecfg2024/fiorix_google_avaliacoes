"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Laptop } from "lucide-react";

interface ThemeToggleProps {
  variant?: "icon-only" | "dropdown" | "pills";
  className?: string;
}

export function ThemeToggle({ variant = "icon-only", className = "" }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`w-8 h-8 rounded-xl bg-slate-200 dark:bg-white/5 border border-slate-300 dark:border-white/10 animate-pulse ${className}`} />
    );
  }

  const isDark = resolvedTheme === "dark";

  // Alternância rápida em 1 clique
  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  if (variant === "pills") {
    return (
      <div className={`inline-flex items-center p-1 rounded-xl bg-slate-200/80 dark:bg-white/[0.06] border border-slate-300 dark:border-white/10 ${className}`}>
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            theme === "light"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Claro</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            theme === "dark"
              ? "bg-[#1E2333] text-white shadow-sm"
              : "text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Moon className="w-3.5 h-3.5 text-cyan-400" />
          <span>Escuro</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme("system")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            theme === "system"
              ? "bg-white dark:bg-[#1E2333] text-slate-900 dark:text-white shadow-sm"
              : "text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Laptop className="w-3.5 h-3.5 text-slate-400" />
          <span>Sistema</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={toggleTheme}
        className={`relative flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 ${
          isDark
            ? "border-white/10 bg-white/[0.04] text-amber-300 hover:bg-white/[0.08] hover:text-amber-200"
            : "border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-100 hover:text-slate-900"
        } ${className}`}
        title={isDark ? "Alternar para Modo Claro (Light)" : "Alternar para Modo Escuro (Dark)"}
        aria-label="Alternar tema de cor"
      >
        {isDark ? (
          <Sun className="h-4 w-4 transition-transform duration-300 rotate-0 hover:rotate-45" />
        ) : (
          <Moon className="h-4 w-4 transition-transform duration-300 -rotate-12 hover:rotate-0 text-indigo-600" />
        )}
      </button>
    </div>
  );
}
