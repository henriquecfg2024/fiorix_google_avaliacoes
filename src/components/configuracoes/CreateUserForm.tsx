'use client';

import React, { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { UserPlus, Loader2, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CpfInputWithValidation } from '@/components/configuracoes/CpfInputWithValidation';
import { createUserAction } from '@/app/actions/admin';

interface CreateUserFormProps {
  departamentosDb: string[];
}

export function CreateUserForm({ departamentosDb }: CreateUserFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formResetKey, setFormResetKey] = useState(0);
  const [selectedRole, setSelectedRole] = useState('COLABORADOR');
  const [totpRequired, setTotpRequired] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(
    null
  );

  const departamentosOrdenados = useMemo(() => {
    const base =
      departamentosDb.length > 0
        ? departamentosDb
        : ['Administração', 'Atendimento', 'Financeiro', 'Registro', 'RH', 'TI', 'VISITANTE'];
    return [...base].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
  }, [departamentosDb]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFeedback(null);

    const formEl = e.currentTarget;
    const formData = new FormData(formEl);

    startTransition(async () => {
      const res = await createUserAction(formData);
      if (res?.error) {
        setFeedback({ type: 'error', message: res.error });
        toast.error(res.error);
        return;
      }

      const createdName = ((formData.get('name') as string) || 'Usuário').trim();
      setFeedback({
        type: 'success',
        message: `Usuário "${createdName}" cadastrado com sucesso!`,
      });
      toast.success(`Usuário "${createdName}" cadastrado com sucesso!`);
      formRef.current?.reset();
      setSelectedRole('COLABORADOR');
      setTotpRequired(false);
      setFormResetKey((k) => k + 1);
      router.refresh();
    });
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="mt-4 rounded-[24px] border border-white/20 bg-[#0B1020]/90 p-5 sm:p-6 shadow-sm backdrop-blur-xl space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-bold text-white">
          <UserPlus className="h-4 w-4 text-amber-300" />
          <span>Cadastrar Novo Usuário do Cartório</span>
        </h4>
        <span className="text-[11px] text-white/40">
          * Campos obrigatórios · CPF opcional (visitantes / externos)
        </span>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs ${
            feedback.type === 'error'
              ? 'border-rose-500/35 bg-rose-950/35 text-rose-200'
              : 'border-emerald-500/35 bg-emerald-950/35 text-emerald-200'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-3 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            Nome Completo *
          </label>
          <Input
            type="text"
            name="name"
            required
            placeholder="Ex: João da Silva"
            className="border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 dark:border-white/12 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30 focus:border-amber-400/50"
          />
        </div>

        <div className="md:col-span-3 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            E-mail de Acesso *
          </label>
          <Input
            type="email"
            name="email"
            required
            placeholder="nome.sobrenome@7risp.com.br"
            className="border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 dark:border-white/12 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30 focus:border-amber-400/50"
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            CPF (Opcional — RH)
          </label>
          <CpfInputWithValidation key={formResetKey} name="cpf" required={false} />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            Senha Inicial *
          </label>
          <Input
            type="password"
            name="password"
            required
            defaultValue="Fiorix@2026"
            placeholder="••••••••"
            className="border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 dark:border-white/12 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30 focus:border-amber-400/50"
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            Função *
          </label>
          <select
            name="role"
            value={selectedRole}
            onChange={(e) => {
              const nextRole = e.target.value;
              setSelectedRole(nextRole);
              if (nextRole === 'ADMIN') {
                setTotpRequired(true);
              }
            }}
            className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-800 dark:border-white/12 dark:bg-[#0A0F1E] dark:text-white focus:outline-hidden focus:border-amber-400/50 cursor-pointer"
          >
            <option value="COLABORADOR">Colaborador</option>
            <option value="USER">Usuário</option>
            <option value="RH">RH (Gestão de Pessoas)</option>
            <option value="SUBSTITUTO">Substituto (ITs &amp; Governança)</option>
            <option value="VISITANTE">Visitante (Teste / Permissões)</option>
            <option value="ADMIN">Admin (Restrito)</option>
          </select>
        </div>

        <div className="md:col-span-3 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            Departamento *
          </label>
          <select
            name="departamento"
            defaultValue="Atendimento"
            className="w-full h-10 px-3 rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-800 dark:border-white/12 dark:bg-[#0A0F1E] dark:text-white focus:outline-hidden focus:border-amber-400/50 cursor-pointer"
          >
            {departamentosOrdenados.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            Cargo *
          </label>
          <Input
            type="text"
            name="cargo"
            required
            defaultValue="auxiliar"
            placeholder="auxiliar, escrevente, Visitante..."
            className="border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 dark:border-white/12 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30 focus:border-amber-400/50"
          />
        </div>

        <div className="md:col-span-2 space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
            Ramal
          </label>
          <Input
            type="text"
            name="ramal"
            placeholder="Ex: 204"
            className="border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 dark:border-white/12 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-white/30 focus:border-amber-400/50"
          />
        </div>

        <div className="md:col-span-3 flex flex-wrap items-center gap-3 pt-5">
          <label
            htmlFor="totpRequired"
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer select-none ${
              totpRequired
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                : 'border-white/12 bg-white/[0.03] text-white/80 hover:border-white/25'
            }`}
            title="Exige código de 6 dígitos (Google Authenticator) no login. O QR Code é gerado automaticamente no 1º acesso."
          >
            <input
              type="checkbox"
              name="totpRequired"
              id="totpRequired"
              value="true"
              checked={totpRequired}
              onChange={(e) => setTotpRequired(e.target.checked)}
              className="rounded border-white/20 bg-[#0A0F1E] text-emerald-500 focus:ring-emerald-500 cursor-pointer"
            />
            <ShieldCheck className={`h-3.5 w-3.5 ${totpRequired ? 'text-emerald-400' : 'text-white/45'}`} />
            <span>Ativar 2FA</span>
          </label>

          <label htmlFor="podeSerTutor" className="inline-flex items-center gap-2 text-xs text-white/80 cursor-pointer select-none">
            <input
              type="checkbox"
              name="podeSerTutor"
              id="podeSerTutor"
              className="rounded border-white/20 bg-[#0A0F1E] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span>Tutor de IT?</span>
          </label>
        </div>

        <div className="md:col-span-2 flex items-end">
          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-10 bg-gradient-to-r from-indigo-500 to-amber-400 font-bold text-white shadow-xs transition-colors hover:brightness-105 cursor-pointer disabled:opacity-60"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cadastrando...
              </span>
            ) : (
              'Cadastrar'
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2 pt-2 border-t border-white/6 text-[11px] text-white/50">
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="font-bold text-cyan-400 block mb-0.5">Colaborador:</span>
          <span>Acesso a Comunicados, Férias, Holerites e Minha IT.</span>
        </div>
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="font-bold text-blue-400 block mb-0.5">Usuário:</span>
          <span>Acesso operacional e consultas ao sistema.</span>
        </div>
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="font-bold text-purple-400 block mb-0.5">RH:</span>
          <span>Gestão de Comunicados, Férias e Holerites do Cartório.</span>
        </div>
        <div className="p-2.5 rounded-xl border border-indigo-500/30 bg-indigo-500/5">
          <span className="font-bold text-indigo-300 block mb-0.5">Substituto:</span>
          <span>Governança, criação, aprovação e fiscalização de ITs.</span>
        </div>
        <div className="p-2.5 rounded-xl border border-teal-500/30 bg-teal-500/5">
          <span className="font-bold text-teal-300 block mb-0.5">Visitante:</span>
          <span>Perfil de teste/externo com menus controlados em Gerenciar Permissões.</span>
        </div>
        <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <span className="font-bold text-indigo-400 block mb-0.5">Administrador:</span>
          <span>Acesso administrativo geral (concessão exclusiva pelo MASTER).</span>
        </div>
      </div>
    </form>
  );
}
