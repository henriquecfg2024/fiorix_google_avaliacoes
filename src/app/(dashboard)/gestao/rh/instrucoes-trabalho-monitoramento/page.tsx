import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function InstrucoesTrabalhoMonitoramentoPage() {
  redirect('/administracao/its?tab=fiscalizacao');
}
