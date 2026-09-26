"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  React.useEffect(() => {
    try {
      localStorage.setItem('theme', 'dark');
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } catch {}
  }, []);

  return (
    <NextThemesProvider
      {...props}
      forcedTheme="dark"
      enableSystem={false}
      defaultTheme="dark"
    >
      {children}
    </NextThemesProvider>
  );
}
