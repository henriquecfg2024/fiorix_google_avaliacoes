import { MetasDashboardClient } from "@/components/bi/MetasDashboardClient";

export const metadata = {
  title: "Metas | FIORIX",
};

export default function MetasPage() {
  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white">
      <div className="p-8 pb-20 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
              Dashboard de Metas
            </h1>
            <p className="text-white/50 text-sm mt-1">
              Acompanhamento de prazos, entregas e análise de gargalos nos protocolos.
            </p>
          </div>
        </div>

        <MetasDashboardClient />
      </div>
    </div>
  );
}
