import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
import { joinGroupViaInviteLink } from '@/app/actions/mensagens';
import { Shield, CheckCircle, XCircle, LogIn } from 'lucide-react';

interface InvitePageProps {
  params: { token: string };
}

export default async function InvitePage({ params }: InvitePageProps) {
  // Garante autenticação antes de processar o link
  let user: Awaited<ReturnType<typeof requireAuth>> | null = null;
  try {
    user = await requireAuth();
  } catch {
    // Redireciona para login com retorno
    redirect(`/login?redirect=/mensagens/convite/${params.token}`);
  }

  const result = await joinGroupViaInviteLink(params.token);

  if (result.success && result.conversationId) {
    redirect(`/mensagens?c=${result.conversationId}`);
  }

  // Exibe erro amigável
  const errorMessage = result.error ?? 'Link inválido ou expirado.';

  return (
    <div className="min-h-screen bg-[#070A12] flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        {/* Ícone */}
        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-7 h-7 text-rose-400" />
        </div>

        <h1 className="text-base font-bold text-white mb-2">Link de Convite Inválido</h1>
        <p className="text-xs text-slate-400 leading-relaxed mb-6">{errorMessage}</p>

        {/* Motivos possíveis */}
        <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4 mb-6 text-left space-y-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Possíveis causas:</p>
          {[
            'O link foi revogado pelo administrador',
            'O link expirou',
            'O limite de usos foi atingido',
            'Você não pertence à organização correta',
          ].map((t) => (
            <div key={t} className="flex items-start gap-2 text-[11px] text-slate-400">
              <Shield className="w-3 h-3 text-slate-600 mt-0.5 shrink-0" />
              {t}
            </div>
          ))}
        </div>

        <a
          href="/mensagens"
          className="block w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition text-center"
        >
          Ir para Mensagens
        </a>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Convite para Grupo — FIORIX',
  description: 'Você foi convidado para participar de um grupo no FIORIX Mensagens.',
};
