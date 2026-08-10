import { FiorixDashboardClient } from "@/components/fiorix/FiorixDashboardClient";
import { queryBiDashboardData, queryBiImportsList, queryBiAtrasadosList } from "@/lib/bi-dashboard";
import { auth } from "@/auth";

export default async function FiorixBIPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const session = await auth();
  const userRole = session?.user?.role || 'USER';

  const importId = typeof searchParams.importId === 'string' ? searchParams.importId : undefined;
  const startDate = typeof searchParams.startDate === 'string' ? searchParams.startDate : undefined;
  const endDate = typeof searchParams.endDate === 'string' ? searchParams.endDate : undefined;
  const tipoPrenotacao = typeof searchParams.tipo === 'string' ? searchParams.tipo : undefined;

  const filters = {
    importId,
    startDate,
    endDate,
    tipoPrenotacao,
  };

  const [imports, dashboardData, atrasados] = await Promise.all([
    queryBiImportsList(),
    queryBiDashboardData(filters),
    queryBiAtrasadosList(filters),
  ]);

  return (
    <FiorixDashboardClient 
      imports={imports} 
      dashboardData={dashboardData} 
      atrasados={atrasados} 
      initialFilters={filters}
      userRole={userRole}
    />
  );
}
