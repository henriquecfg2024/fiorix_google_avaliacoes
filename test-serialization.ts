import { queryBiDashboardData, queryBiImportsList, queryBiAtrasadosList } from './src/lib/bi-dashboard';

async function test() {
  try {
    const imports = await queryBiImportsList();
    console.log("Imports length:", imports.length);
    JSON.stringify(imports);

    const dashboard = await queryBiDashboardData({});
    console.log("Dashboard keys:", Object.keys(dashboard));
    JSON.stringify(dashboard);

    const atrasados = await queryBiAtrasadosList({});
    console.log("Atrasados length:", atrasados.items.length);
    JSON.stringify(atrasados);

    console.log("SUCCESS! No BigInts found.");
  } catch (e) {
    console.error("ERROR:", e);
  }
}
test();
