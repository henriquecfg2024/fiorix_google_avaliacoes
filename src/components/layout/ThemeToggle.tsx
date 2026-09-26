"use client";

import React from "react";

interface ThemeToggleProps {
  variant?: "icon-only" | "dropdown" | "pills";
  className?: string;
}

/**
 * Modo Dark Premium Permanente:
 * O aplicativo foi fixado exclusivamente no modo escuro a pedido do cliente.
 * Este componente retorna null para desativar qualquer controle de alternância.
 */
export function ThemeToggle({ variant, className }: ThemeToggleProps) {
  return null;
}
