import { redirect } from "next/navigation";

export default async function CartorioVirtualCertidaoDetalheRedirectPage({
  params,
}: {
  params: Promise<{ pedidoId: string }> | { pedidoId: string };
}) {
  const resolved = await Promise.resolve(params);
  redirect(`/cartorio-virtual/impressao?pedido=${encodeURIComponent(resolved.pedidoId)}`);
}
