import { redirect } from "next/navigation";

interface ValidaPageProps {
  params: {
    hash: string;
  };
}

export default function ValidaPage({ params }: ValidaPageProps) {
  redirect(`/verifica/${params.hash}`);
}
