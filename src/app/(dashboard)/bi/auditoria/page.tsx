import { AuditoriaDashboardClient } from "@/components/bi/AuditoriaDashboardClient";

export const metadata = {
  title: "Auditoria | FIORIX",
};

export default function AuditoriaPage() {
  return (
    <div className="min-h-screen bg-[#080A12] text-white">
      <div className="p-8 pb-20 max-w-[1600px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-500">
                FIORIX AUDITORIA
              </h1>
              <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-black uppercase rounded-md tracking-wider">
                Compliance & Correções Inteligentes
              </span>
            </div>
            <p className="text-white/50 text-sm mt-1.5 leading-relaxed max-w-[720px]">
              Auditoria diária de importações, intervenções do usuário FIORIX e relatórios por setor • Sistema inteligente de detecção de falsos atrasos e correção automática
            </p>
          </div>
        </div>

        <AuditoriaDashboardClient />
      </div>
    </div>
  );
}
