import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function FiorixControlBar() {
  return (
    <Card className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl shadow-sm border-gray-100 dark:border-border gap-4">
      
      {/* Left */}
      <div className="flex items-center gap-3 w-full sm:w-auto text-sm">
        <span className="font-semibold text-foreground">Gráficos exibidos</span>
        <span className="text-muted-foreground hidden md:inline">3 de 3 gráficos ativos.</span>
        <button className="text-blue-600 hover:text-blue-700 font-medium ml-2 dark:text-blue-400 dark:hover:text-blue-300">
          Gerenciar
        </button>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
        <Button variant="outline" className="w-full sm:w-auto shadow-sm">
          Restaurar padrão
        </Button>
        <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white shadow-sm dark:bg-blue-600 dark:hover:bg-blue-700">
          Escolher gráficos
        </Button>
      </div>

    </Card>
  );
}
