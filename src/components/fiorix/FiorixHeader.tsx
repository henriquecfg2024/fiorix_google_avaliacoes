"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function FiorixHeader() {
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 h-16 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="container mx-auto flex h-full items-center justify-between px-4 lg:px-8">
        
        {/* Esquerda: Logo + Badge */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-80">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-900 text-white font-bold dark:bg-white dark:text-slate-900">
              F
            </div>
            <span className="font-bold tracking-wide text-foreground">FIORIX</span>
          </Link>
          <Badge variant="secondary" className="hidden sm:inline-flex bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
            G Respostas Google Avaliações
          </Badge>
        </div>

        {/* Direita: Navegação + Theme Toggle */}
        <div className="flex items-center gap-6">
          <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-muted-foreground">
            <Link href="/" className="px-3 py-1.5 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors">
              Home
            </Link>
            <Link href="/avaliacoes" className="px-3 py-1.5 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors">
              Avaliações
            </Link>
            <Link href="/estatisticas" className="px-3 py-1.5 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors">
              Estatísticas
            </Link>
            <Link href="/relatorios" className="px-3 py-1.5 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors">
              Relatórios
            </Link>
            <Link href="/bi" className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 transition-colors">
              Módulo BI
            </Link>
            <Link href="/bi/produtividade" className="px-3 py-1.5 rounded-full hover:bg-accent hover:text-accent-foreground transition-colors">
              Produtividade
            </Link>
          </nav>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
