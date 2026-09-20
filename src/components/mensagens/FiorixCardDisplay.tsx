'use client';

import React, { useState } from 'react';
import { ExternalLink, Loader2, AlertTriangle, FileText, CheckSquare, Megaphone, Lock } from 'lucide-react';
import { validateFiorixCardAccess } from '@/app/actions/mensagens';
import { useRouter } from 'next/navigation';
import { SerializedMessage } from '@/app/actions/mensagens';

interface FiorixCardDisplayProps {
  message: SerializedMessage;
  isMine: boolean;
}

const CARD_CONFIG: Record<string, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
  route: (id: string) => string;
}> = {
  IT: {
    icon: FileText,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    label: 'Instrução de Trabalho',
    route: (id) => `/pessoas/instrucoes/${id}`,
  },
  TAREFA: {
    icon: CheckSquare,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    label: 'Tarefa',
    route: (id) => `/tarefas/${id}`,
  },
  COMUNICADO: {
    icon: Megaphone,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    label: 'Comunicado',
    route: (id) => `/pessoas/comunicados/${id}`,
  },
};

export function FiorixCardDisplay({ message, isMine }: FiorixCardDisplayProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  const cardTipo = message.cardTipo ?? 'IT';
  const meta = message.cardMetadata;
  const config = CARD_CONFIG[cardTipo] ?? CARD_CONFIG.IT;
  const Icon = config.icon;

  const handleOpen = async () => {
    if (loading || !message.cardReferenciaId) return;

    setLoading(true);
    setError(null);
    setAccessDenied(false);

    try {
      // 1. Re-valida acesso em tempo real (posse do card ≠ acesso permanente)
      const result = await validateFiorixCardAccess(message.id);

      if (!result.success || !result.hasAccess) {
        setAccessDenied(true);
        return;
      }

      // 2. Redireciona para o objeto — o módulo destino valida autorização completa
      router.push(config.route(message.cardReferenciaId));
    } catch (err) {
      setError('Não foi possível abrir. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border overflow-hidden max-w-xs w-64 ${
        isMine ? 'rounded-br-sm' : 'rounded-bl-sm'
      } ${config.borderColor} ${config.bgColor} backdrop-blur-sm`}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${config.borderColor}`}>
        <Icon className={`w-3.5 h-3.5 shrink-0 ${config.color}`} />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
          {config.label}
        </span>
      </div>

      {/* Corpo */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-semibold text-white leading-tight mb-1">
          {meta?.titulo ?? 'Sem título'}
        </p>
        {meta?.versao && (
          <p className="text-[10px] text-slate-400">
            Versão {meta.versao}
            {meta.situacao && (
              <span className={`ml-2 font-semibold ${
                meta.situacao === 'Vigente' ? 'text-emerald-400' :
                meta.situacao === 'Cancelado' ? 'text-rose-400' : 'text-amber-400'
              }`}>
                • {meta.situacao}
              </span>
            )}
          </p>
        )}
        {meta?.situacao && !meta.versao && (
          <p className="text-[10px] text-slate-400">{meta.situacao}</p>
        )}
      </div>

      {/* Aviso de acesso negado */}
      {accessDenied && (
        <div className="px-3 pb-2 flex items-center gap-1.5 text-[10px] text-rose-400">
          <Lock className="w-3 h-3" />
          Você não tem mais acesso a este item.
        </div>
      )}

      {error && (
        <div className="px-3 pb-2 flex items-center gap-1.5 text-[10px] text-amber-400">
          <AlertTriangle className="w-3 h-3" />
          {error}
        </div>
      )}

      {/* Botão Abrir */}
      <div className="px-3 pb-3">
        <button
          onClick={handleOpen}
          disabled={loading || accessDenied}
          className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition border ${
            accessDenied
              ? 'border-white/10 text-slate-500 cursor-not-allowed'
              : `${config.borderColor} ${config.color} hover:bg-white/10`
          }`}
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <>
              {accessDenied ? <Lock className="w-3 h-3" /> : <ExternalLink className="w-3 h-3" />}
              {accessDenied ? 'Acesso revogado' : 'Abrir'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
