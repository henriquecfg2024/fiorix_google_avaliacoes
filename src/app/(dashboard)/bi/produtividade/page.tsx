import { ProdutividadeClient } from "@/components/bi/ProdutividadeClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "BI Produtividade - Fiorix",
  description: "Módulo BI Dark Premium - Produtividade de Caixa",
};

export default function ProdutividadePage() {
  return <ProdutividadeClient />;
}
