"use client";

import React, { createContext, useContext, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Landmark,
  LayoutDashboard,
  Printer,
  History,
  ShieldCheck,
  ChevronUp,
  ChevronDown,
  EyeOff,
  Eye,
} from "lucide-react";
import { type PapelRegistral } from "@/lib/cartorio-virtual/types";

interface ContextoTopoCartorioVirtual {
  tresLinhasVisiveis: boolean;
  setTresLinhasVisiveis: React.Dispatch<React.SetStateAction<boolean>>;
  alternarTresLinhas: () => void;
}

const TopoCartorioVirtualContext = createContext<ContextoTopoCartorioVirtual>({
  tresLinhasVisiveis: true,
  setTresLinhasVisiveis: () => {},
  alternarTresLinhas: () => {},
});

export function useCartorioVirtualTopoVisivel() {
  return useContext(TopoCartorioVirtualContext);
}

interface TopBarProps {
  tenantNome: string;
  papelSistema: string;
  papelRegistral: PapelRegistral;
  ambienteSintetico: boolean;
  migracaoPendente: boolean;
  alertaOperacionalConnector: string | null;
  children?: React.ReactNode;
}

const SUBMENUS = [
  { href: "/cartorio-virtual", label: "PEDIDOS", icon: LayoutDashboard, exact: true },
  {
    href: "/cartorio-virtual/impressao",
    label: "VERIFICAÇÃO DO ESCREVENTE",
    icon: Printer,
    exact: false,
  },
  { href: "/cartorio-virtual/historico", label: "ANDAMENTOS", icon: History, exact: false },
];

export function CartorioVirtualTopBar({
  tenantNome: _tenantNome,
  papelSistema,
  papelRegistral: _papelRegistral,
  ambienteSintetico,
  children,
}: TopBarProps) {
  const pathname = usePathname();
  const [tresLinhasVisiveis, setTresLinhasVisiveis] = useState<boolean>(true);

  const alternarTresLinhas = () => {
    setTresLinhasVisiveis((v) => !v);
  };

  return (
    <TopoCartorioVirtualContext.Provider
      value={{ tresLinhasVisiveis, setTresLinhasVisiveis, alternarTresLinhas }}
    >
      {tresLinhasVisiveis && (
        <div className="space-y-2">
          <div className="relative flex flex-wrap items-center justify-center gap-3 px-2 pb-2.5 border-b border-white/10">
            <div className="flex items-center gap-1.5 text-xs font-mono lg:absolute lg:left-2">
              <Landmark className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300 font-semibold">Cartório Virtual</span>
            </div>

            <nav
              aria-label="Submenus do Cartório Virtual"
              className="inline-flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-cyan-500/30 bg-[#070C18]/90 p-1.5 shadow-lg shadow-cyan-950/30"
            >
              {SUBMENUS.map((item) => {
                const Icon = item.icon;
                const ativo = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname?.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-[13px] font-black tracking-wide whitespace-nowrap border-2 transition-all ${
                      ativo
                        ? "bg-gradient-to-r from-cyan-600 to-sky-600 border-cyan-300 text-white shadow-md shadow-cyan-500/25"
                        : "bg-[#0D1528] border-cyan-500/30 text-cyan-100 hover:border-cyan-400/70 hover:bg-cyan-500/15 hover:text-white"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${ativo ? "text-white" : "text-cyan-300"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 flex-wrap text-xs lg:absolute lg:right-2">
              <button
                type="button"
                onClick={alternarTresLinhas}
                className="h-7 px-2.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 text-[11px] font-bold text-cyan-200 inline-flex items-center gap-1 cursor-pointer transition"
                title="Ocultar as 3 linhas superiores de navegação e filtros rápidos de uma vez"
              >
                <EyeOff className="w-3.5 h-3.5 text-cyan-300" />
                <span>Ocultar 3 Linhas</span>
                <ChevronUp className="w-3.5 h-3.5 text-cyan-300" />
              </button>
              {ambienteSintetico && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border border-amber-500/40 bg-amber-500/15 text-amber-200">
                  Homologação Local
                </span>
              )}
              <div className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-mono font-bold text-white">{papelSistema}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      {children}
    </TopoCartorioVirtualContext.Provider>
  );
}
