import { TarefasDashboardClient } from "@/components/bi/TarefasDashboardClient";

export const metadata = {
  title: "Tarefas - Previsão de Carga Operacional | FIORIX",
};

export default function TarefasPage() {
  return (
    <div className="min-h-screen bg-[#070A12] text-white relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-5 py-6 pb-20 sm:px-8">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Dashboard</span>
              <span className="text-slate-600">/</span>
              <span>BI</span>
              <span className="text-slate-600">/</span>
              <span className="text-purple-300">Tarefas</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase">
                TAREFAS
              </h1>
              <span className="rounded-full border border-purple-500/25 bg-purple-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-purple-300">
                PREVISÃO DE CARGA OPERACIONAL
              </span>
            </div>
          </div>
        </div>

        <TarefasDashboardClient />
      </div>
    </div>
  );
}
