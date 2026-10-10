import { TarefasDashboardClient } from "@/components/bi/TarefasDashboardClient";

export const metadata = {
  title: "Tarefas - Previsão de Carga Operacional | FIORIX",
};

export default function TarefasPage() {
  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-purple-500/30 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-purple-500/12 via-amber-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-5 py-6 pb-20 sm:px-8">
        {/* BARRA DE NAVEGAÇÃO COMPACTA EM LINHA ÚNICA (PADRÃO FIORIX) */}
        <div className="mb-6 flex items-center justify-between gap-2 px-1 pt-1 pb-2 border-b border-white/8">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">GESTÃO DE PRAZOS</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-extrabold tracking-wider">TAREFAS</span>
            <h1 className="sr-only">Tarefas - Previsão de Carga Operacional</h1>
          </div>
        </div>

        <TarefasDashboardClient />
      </div>
    </div>
  );
}
