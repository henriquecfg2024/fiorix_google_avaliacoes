import { AuditoriaDashboardClient } from "@/components/bi/AuditoriaDashboardClient";

export const metadata = {
  title: "Auditoria | FIORIX",
};

export default function AuditoriaPage() {
  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-5 py-6 pb-20 sm:px-8">
        <div className="mb-8 space-y-3 rounded-[28px] border border-white/8 bg-[#0B1020]/72 p-6 shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs font-medium text-white/42">
            <span>Dashboard</span>
            <span className="text-white/20">/</span>
            <span>BI</span>
            <span className="text-white/20">/</span>
            <span className="text-amber-300">Auditoria</span>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-[920px]">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl sm:text-[2.15rem] font-black tracking-[0.01em] text-transparent bg-clip-text bg-gradient-to-r from-slate-50 via-white to-amber-300">
                  Auditoria Operacional
                </h1>
                <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                  Compliance & Correções
                </span>
              </div>
              <p className="mt-2 max-w-[760px] text-sm leading-relaxed text-white/58">
                Auditoria diária de importações, intervenções do usuário FIORIX e relatórios por setor. Painel inteligente para identificar atrasos, revisar pendências e acompanhar a regularização com leitura executiva.
              </p>
            </div>
          </div>
        </div>

        <AuditoriaDashboardClient />
      </div>
    </div>
  );
}
