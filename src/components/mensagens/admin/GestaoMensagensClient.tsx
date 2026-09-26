'use client';

import React, { useState } from 'react';
import {
  MessageSquare,
  Users,
  Shield,
  Smartphone,
  Settings2,
  Activity,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Save,
  Loader2,
  Send,
  EyeOff,
} from 'lucide-react';
import { updateAdminMessagingPolicy } from '@/app/actions/mensagens';
import { toast } from 'sonner';

interface GestaoMensagensClientProps {
  metrics: {
    totalUsers: number;
    totalConversations: number;
    totalGroups: number;
    totalMessages: number;
    totalAttachments: number;
    activeSubscriptions: number;
  };
  policy: {
    directEnabled: boolean;
    groupsEnabled: boolean;
    attachmentsEnabled: boolean;
    maxAttachmentBytes: number;
    retentionDays: number;
    allowDelete: boolean;
    allowEdit: boolean;
    editWindowMinutes: number;
  };
  auditLogs: {
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    actorName: string;
    actorRole: string;
    ipAddress: string | null;
    createdAt: string;
  }[];
}

export function GestaoMensagensClient({
  metrics,
  policy: initialPolicy,
  auditLogs,
}: GestaoMensagensClientProps) {
  const [tab, setTab] = useState<'overview' | 'policies' | 'push' | 'audit'>('overview');
  const [policy, setPolicy] = useState(initialPolicy);
  const [savingPolicy, setSavingPolicy] = useState(false);

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPolicy(true);
    try {
      const res = await updateAdminMessagingPolicy(policy);
      if (res.success) {
        toast.success('Políticas corporativas de mensagens atualizadas com sucesso.');
      } else {
        toast.error(res.error || 'Erro ao atualizar políticas.');
      }
    } catch {
      toast.error('Erro de conexão.');
    } finally {
      setSavingPolicy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Aviso de Privacidade e Governança (Regra de Ouro da Seção 22) */}
      <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/20 flex items-start gap-3.5 shadow-sm">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30 mt-0.5">
          <EyeOff className="w-4 h-4" />
        </div>
        <div className="text-xs text-slate-300 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
              Governança de Privacidade (LGPD & Seção 22)
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px]">
              Blindagem Ativa
            </span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            O perfil Administrador gerencia indicadores operacionais, políticas corporativas, saúde do Web Push e auditoria forense.
            <strong className="text-slate-200"> Administradores não possuem autorização implícita para leitura do teor de conversas privadas entre colaboradores.</strong>
          </p>
        </div>
      </div>

      {/* Navegação por Abas */}
      <div className="flex border-b border-white/10 gap-2 pb-1 overflow-x-auto">
        <button
          onClick={() => setTab('overview')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition shrink-0 ${
            tab === 'overview'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-900 dark:text-white hover:bg-white/5'
          }`}
        >
          <Activity className="w-4 h-4" />
          Visão Geral & Métricas
        </button>

        <button
          onClick={() => setTab('policies')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition shrink-0 ${
            tab === 'policies'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-900 dark:text-white hover:bg-white/5'
          }`}
        >
          <Settings2 className="w-4 h-4" />
          Políticas da Organização
        </button>

        <button
          onClick={() => setTab('push')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition shrink-0 ${
            tab === 'push'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-900 dark:text-white hover:bg-white/5'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          Web Push / PWA
        </button>

        <button
          onClick={() => setTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl transition shrink-0 ${
            tab === 'audit'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-slate-900 dark:text-white hover:bg-white/5'
          }`}
        >
          <Shield className="w-4 h-4" />
          Auditoria Forense
        </button>
      </div>

      {/* ABA 1: VISÃO GERAL */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Métricas Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-mono tracking-wider text-slate-400">Conversas 1-para-1</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{metrics.totalConversations}</h3>
                <span className="text-[11px] text-indigo-400 mt-1 inline-block">Canais diretos ativos</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                <MessageSquare className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-mono tracking-wider text-slate-400">Grupos Internos</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{metrics.totalGroups}</h3>
                <span className="text-[11px] text-amber-400 mt-1 inline-block">Salas coletivas</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-mono tracking-wider text-slate-400">Mensagens Trocadas</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{metrics.totalMessages}</h3>
                <span className="text-[11px] text-emerald-400 mt-1 inline-block">Histórico ativo</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Activity className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-mono tracking-wider text-slate-400">Anexos Seguros</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{metrics.totalAttachments}</h3>
                <span className="text-[11px] text-cyan-400 mt-1 inline-block">Armazenamento privado</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-mono tracking-wider text-slate-400">Dispositivos Web Push</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{metrics.activeSubscriptions}</h3>
                <span className="text-[11px] text-purple-400 mt-1 inline-block">Inscrições ativas</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                <Smartphone className="w-5 h-5" />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#111827] border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase font-mono tracking-wider text-slate-400">Status do Realtime</p>
                <h3 className="text-base font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Operacional
                </h3>
                <span className="text-[11px] text-slate-400 mt-1 inline-block">Canais isolados por tenant</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                <Shield className="w-5 h-5" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: POLÍTICAS CORPORATIVAS */}
      {tab === 'policies' && (
        <form onSubmit={handleSavePolicy} className="p-6 rounded-3xl bg-[#111827] border border-white/10 space-y-6">
          <div className="border-b border-white/10 pb-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Parâmetros e Políticas de Mensageria</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Defina as regras de comunicação interna que se aplicam a todos os membros da sua organização.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Direct Enabled */}
            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Mensagens Diretas Habilitadas</p>
                <p className="text-[11px] text-slate-400">Permitir conversas 1-para-1 entre colaboradores</p>
              </div>
              <input
                type="checkbox"
                checked={policy.directEnabled}
                onChange={(e) => setPolicy({ ...policy, directEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-white/20"
              />
            </div>

            {/* Groups Enabled */}
            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Criação de Grupos Habilitada</p>
                <p className="text-[11px] text-slate-400">Permitir criação de grupos internos de trabalho</p>
              </div>
              <input
                type="checkbox"
                checked={policy.groupsEnabled}
                onChange={(e) => setPolicy({ ...policy, groupsEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-white/20"
              />
            </div>

            {/* Attachments Enabled */}
            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Envio de Anexos Habilitado</p>
                <p className="text-[11px] text-slate-400">Documentos PDF, imagens e planilhas</p>
              </div>
              <input
                type="checkbox"
                checked={policy.attachmentsEnabled}
                onChange={(e) => setPolicy({ ...policy, attachmentsEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-white/20"
              />
            </div>

            {/* Allow Delete */}
            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900 dark:text-white">Permitir Exclusão Lógica</p>
                <p className="text-[11px] text-slate-400">Permite ao autor remover mensagem (mantém auditoria)</p>
              </div>
              <input
                type="checkbox"
                checked={policy.allowDelete}
                onChange={(e) => setPolicy({ ...policy, allowDelete: e.target.checked })}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-white/20"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Tamanho Máximo de Anexo (MB)
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={(policy.maxAttachmentBytes / (1024 * 1024)).toFixed(0)}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    maxAttachmentBytes: parseInt(e.target.value || '25', 10) * 1024 * 1024,
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Retenção Histórica (Dias)
              </label>
              <input
                type="number"
                min="30"
                max="3650"
                value={policy.retentionDays}
                onChange={(e) =>
                  setPolicy({
                    ...policy,
                    retentionDays: parseInt(e.target.value || '365', 10),
                  })
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-white/10 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-end">
            <button
              type="submit"
              disabled={savingPolicy}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-slate-900 dark:text-white shadow-lg transition disabled:opacity-50"
            >
              {savingPolicy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Salvar Políticas</span>
            </button>
          </div>
        </form>
      )}

      {/* ABA 3: WEB PUSH & PWA */}
      {tab === 'push' && (
        <div className="p-6 rounded-3xl bg-[#111827] border border-white/10 space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Status da Infraestrutura Web Push / PWA</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Diagnóstico do serviço de notificações em segundo plano e chaves criptográficas VAPID.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-1">
              <p className="text-[11px] font-mono uppercase text-slate-400">Padrão Criptográfico</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">RFC 8291 (VAPID / ECDSA P-256)</p>
              <p className="text-[11px] text-emerald-400">Chave privada isolada no servidor</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-1">
              <p className="text-[11px] font-mono uppercase text-slate-400">Service Worker</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">/sw.js (Ativo no escopo raiz /)</p>
              <p className="text-[11px] text-emerald-400">Interceptadores push e notificationclick ativos</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-1">
              <p className="text-[11px] font-mono uppercase text-slate-400">Tratamento de Expiradas</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Auto-revogação ativa (410 Gone / 404)</p>
              <p className="text-[11px] text-slate-400">Subscriptions inválidas são desativadas no ato</p>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-1">
              <p className="text-[11px] font-mono uppercase text-slate-400">Inscrições Ativas no Cartório</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{metrics.activeSubscriptions} aparelhos registrados</p>
              <p className="text-[11px] text-purple-400">Limite de cota: 10 dispositivos por usuário</p>
            </div>
          </div>
        </div>
      )}

      {/* ABA 4: AUDITORIA FORENSE */}
      {tab === 'audit' && (
        <div className="p-6 rounded-3xl bg-[#111827] border border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Trilha de Auditoria Forense de Mensagens</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Registros imutáveis de ações relevantes (criação de grupos, uploads, exclusões, revogações de aparelhos).
              </p>
            </div>
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
              Insert-Only
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Data/Hora</th>
                  <th className="py-2.5 px-3">Ação</th>
                  <th className="py-2.5 px-3">Colaborador</th>
                  <th className="py-2.5 px-3">IP de Origem</th>
                  <th className="py-2.5 px-3">Alvo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      Nenhum evento auditado recentemente.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-mono text-slate-300">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-white/5 text-indigo-300 border border-white/10">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-slate-900 dark:text-white">{log.actorName}</span>
                        <span className="text-[10px] text-slate-400 block font-mono">{log.actorRole}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{log.ipAddress || '—'}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{log.targetType || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
