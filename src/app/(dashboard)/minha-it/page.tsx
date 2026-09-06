import { redirect } from 'next/navigation';
import { obterMinhaItId } from '@/app/actions/its';
import { BookOpen, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function MinhaItRedirectPage() {
  const itId = await obterMinhaItId();

  if (itId) {
    redirect(`/instrucoes-trabalho/${itId}`);
  }

  // Sem IT atribuída — exibir mensagem informativa
  return (
    <div className="min-h-screen bg-[#070A12] text-white flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-zinc-800/50 border border-zinc-700 flex items-center justify-center mx-auto">
          <BookOpen className="w-10 h-10 text-zinc-500" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-white">Nenhuma Instrução de Trabalho Atribuída</h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Você ainda não possui uma instrução de trabalho vinculada ao seu perfil.
            Entre em contato com o seu gestor ou com o setor de RH para mais informações.
          </p>
        </div>
        <Link
          href="/pessoas"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black text-sm font-bold transition-colors"
        >
          Voltar para Minha Central <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}
