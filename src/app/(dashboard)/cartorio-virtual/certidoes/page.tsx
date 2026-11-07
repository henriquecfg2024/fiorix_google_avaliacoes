import { redirect } from "next/navigation";

export default async function CartorioVirtualCertidoesRedirectPage({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const sp = searchParams ? await Promise.resolve(searchParams) : {};
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v) params.set(k, v);
  }
  const qs = params.toString();
  redirect(qs ? `/cartorio-virtual?${qs}#listagem-pedidos` : "/cartorio-virtual#listagem-pedidos");
}
