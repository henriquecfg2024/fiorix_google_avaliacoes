'use client';

import React, { useState, useEffect } from 'react';
import {
  X, Search, FileText, CheckSquare, Megaphone, Loader2, ChevronRight,
} from 'lucide-react';
import { sendFiorixCard } from '@/app/actions/mensagens';
import { SerializedMessage } from '@/app/actions/mensagens';
import { toast } from 'sonner';

interface FiorixCardSelectorProps {
  conversationId: string;
  onSent: (msg: SerializedMessage) => void;
  onClose: () => void;
}

type CardTipo = 'IT' | 'TAREFA' | 'COMUNICADO';

const TIPOS: {
  key: CardTipo;
  label: string;
  icon: React.ElementType;
  color: string;
  apiPath: string;
}[] = [
  { key: 'IT', label: 'Instrução de Trabalho', icon: FileText, color: 'text-blue-400', apiPath: '/api/cards/it' },
  { key: 'TAREFA', label: 'Tarefa', icon: CheckSquare, color: 'text-emerald-400', apiPath: '/api/cards/tarefas' },
  { key: 'COMUNICADO', label: 'Comunicado', icon: Megaphone, color: 'text-amber-400', apiPath: '/api/cards/comunicados' },
];

interface CardItem {
  id: string;
  titulo: string;
  versao?: string;
  situacao?: string;
}

export function FiorixCardSelector({ conversationId, onSent, onClose }: FiorixCardSelectorProps) {
  const [tipoSelecionado, setTipoSelecionado] = useState<CardTipo | null>(null);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<CardItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!tipoSelecionado) return;
    const tipo = TIPOS.find((t) => t.key === tipoSelecionado)!;
    setLoading(true);

    fetch(`${tipo.apiPath}?q=${encodeURIComponent(query)}&limit=15`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setItems(data);
        else if (Array.isArray(data.items)) setItems(data.items);
        else setItems([]);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [tipoSelecionado, query]);

  const handleSend = async (item: CardItem) => {
    if (!tipoSelecionado || sending) return;
    setSending(item.id);

    const res = await sendFiorixCard({
      conversationId,
      cardTipo: tipoSelecionado,
      cardReferenciaId: item.id,
      cardMetadata: {
        titulo: item.titulo,
        versao: item.versao,
        situacao: item.situacao,
      },
    });

    if (res.success) {
      toast.success('Card enviado!');
      onClose();
    } else {
      toast.error(res.error ?? 'Falha ao enviar card.');
    }
    setSending(null);
  };

  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 bg-[#111827] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          {tipoSelecionado && (
            <button
              onClick={() => { setTipoSelecionado(null); setItems([]); setQuery(''); }}
              className="p-0.5 rounded text-slate-400 hover:text-white"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          )}
          <h3 className="text-xs font-semibold text-white">
            {tipoSelecionado
              ? TIPOS.find((t) => t.key === tipoSelecionado)?.label
              : 'Enviar FIORIX Card'}
          </h3>
        </div>
        <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Seleção de tipo */}
      {!tipoSelecionado ? (
        <div className="p-3 grid grid-cols-3 gap-2">
          {TIPOS.map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setTipoSelecionado(key)}
              className="flex flex-col items-center gap-2 p-3 rounded-xl border border-white/10 hover:bg-white/5 hover:border-white/20 transition"
            >
              <Icon className={`w-6 h-6 ${color}`} />
              <span className="text-[10px] font-semibold text-slate-300 text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>
      ) : (
        <>
          {/* Busca */}
          <div className="px-3 py-2 border-b border-white/10">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar…"
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/60"
              />
            </div>
          </div>

          {/* Resultados */}
          <div className="max-h-56 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-[10px] text-slate-500 text-center py-6">Nenhum item encontrado.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSend(item)}
                  disabled={sending === item.id}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition border-b border-white/[0.05] last:border-0 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{item.titulo}</p>
                    <div className="flex gap-2 mt-0.5">
                      {item.versao && <span className="text-[10px] text-slate-500">v{item.versao}</span>}
                      {item.situacao && (
                        <span className={`text-[10px] font-semibold ${
                          item.situacao === 'Vigente' ? 'text-emerald-400' :
                          item.situacao === 'Cancelado' ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          {item.situacao}
                        </span>
                      )}
                    </div>
                  </div>
                  {sending === item.id ? (
                    <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
