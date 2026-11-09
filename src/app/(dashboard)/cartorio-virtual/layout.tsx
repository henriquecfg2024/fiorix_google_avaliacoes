import React from "react";
import { obterContextoAutorizacaoCartorioVirtual } from "@/lib/cartorio-virtual/permissions";
import { diagnosticarAdaptadoresCartorioVirtual } from "@/lib/cartorio-virtual/adapters";
import { isAmbienteSinteticoPermitido } from "@/lib/cartorio-virtual/synthetic-fixtures";
import { CartorioVirtualTopBar } from "@/components/cartorio-virtual/CartorioVirtualTopBar";

export const dynamic = "force-dynamic";

export default async function CartorioVirtualLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await obterContextoAutorizacaoCartorioVirtual();
  const adaptadores = await diagnosticarAdaptadoresCartorioVirtual(ctx.tenantId);
  const sqlWebri = adaptadores.find((a) => a.id === "WEBRI_SQL_CERTIDOES");
  const alertaConnector =
    sqlWebri && sqlWebri.estado !== "ONLINE" ? sqlWebri.mensagemOperacional : null;

  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden pb-2">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[52rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-emerald-500/8 blur-3xl opacity-70" />
      </div>

      <div className="relative w-full max-w-none px-2 py-2 lg:px-3 space-y-2">
        <CartorioVirtualTopBar
          tenantNome={ctx.tenantNome}
          papelSistema={ctx.papelSistema}
          papelRegistral={ctx.papelRegistral}
          ambienteSintetico={isAmbienteSinteticoPermitido()}
          migracaoPendente={ctx.migracaoTabelaPendente}
          alertaOperacionalConnector={alertaConnector}
        >
          {children}
        </CartorioVirtualTopBar>
      </div>
    </div>
  );
}

