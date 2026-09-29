import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import {
  Crown,
  Building2,
  Smartphone,
  ShieldCheck,
  Activity,
  Monitor,
  Globe,
  Radio,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Mensagens SaaS | Master FIORIX',
  description: 'Visão Agregada de Telemetria e Mensageria Multi-Tenant',
};

export const dynamic = 'force-dynamic';

function parseBrowserInfo(userAgent?: string | null) {
  if (!userAgent) return 'Navegador Web';
  if (userAgent.includes('Edg/')) return 'Microsoft Edge';
  if (userAgent.includes('Chrome/')) return 'Google Chrome';
  if (userAgent.includes('Firefox/')) return 'Mozilla Firefox';
  if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) return 'Apple Safari';
  if (userAgent.includes('Opera') || userAgent.includes('OPR/')) return 'Opera';
  return 'Navegador Web';
}

function parseDeviceInfo(deviceName?: string | null, userAgent?: string | null) {
  if (deviceName && deviceName.trim()) return deviceName;
  if (!userAgent) return 'Dispositivo Web';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) return 'macOS';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  if (userAgent.includes('Linux')) return 'Linux PC';
  return 'Desktop / Web';
}

function isMobileDevice(deviceName?: string | null, userAgent?: string | null) {
  const str = `${deviceName || ''} ${userAgent || ''}`.toLowerCase();
  return str.includes('mobile') || str.includes('android') || str.includes('iphone') || str.includes('ipad');
}

function formatDateTime(date: Date | string | null | undefined) {
  if (!date) return '-';
  const d = new Date(date);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export default async function MasterMensagensPage() {
  try {
    await requireRole('MASTER');
  } catch {
    redirect('/dashboard');
  }

  const [tenants, pushSubscriptions] = await Promise.all([
    prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plano: true,
        status: true,
        _count: {
          select: {
            users: true,
            conversas: true,
            mensagens: true,
            mensagemAnexos: true,
            pushSubscriptions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.pushSubscription.findMany({
      include: {
        usuario: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            departamento: true,
            cargo: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        lastUsedAt: 'desc',
      },
    }),
  ]);

  const totals = tenants.reduce(
    (acc, t) => ({
      tenantsCount: acc.tenantsCount + 1,
      conversations: acc.conversations + t._count.conversas,
      messages: acc.messages + t._count.mensagens,
      attachments: acc.attachments + t._count.mensagemAnexos,
      subscriptions: acc.subscriptions + t._count.pushSubscriptions,
    }),
    { tenantsCount: 0, conversations: 0, messages: 0, attachments: 0, subscriptions: 0 }
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-amber-500/30 dark:bg-[#070A12] dark:text-white transition-colors duration-300 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-amber-500/12 via-indigo-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent dark:via-white/10" />
      </div>

      <main className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200 dark:border-white/6">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Master SaaS</span>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400">Mensagens Multi-Tenant</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <Crown className="w-6 h-6 text-amber-400" />
                Telemetria Global de Mensagens SaaS
              </h1>
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-amber-300 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                ZERO-CONTENT ISOLATION
              </span>
            </div>
          </div>
        </div>

        {/* Resumo Agregado */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="p-5 rounded-2xl bg-[#111827] border border-white/10">
            <p className="text-xs uppercase font-mono text-slate-400">Cartórios / Tenants</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totals.tenantsCount}</h3>
            <span className="text-[11px] text-amber-400 mt-1 inline-block">Instâncias registradas</span>
          </div>

          <div className="p-5 rounded-2xl bg-[#111827] border border-white/10">
            <p className="text-xs uppercase font-mono text-slate-400">Total de Conversas</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totals.conversations}</h3>
            <span className="text-[11px] text-indigo-400 mt-1 inline-block">Diretas e grupos</span>
          </div>

          <div className="p-5 rounded-2xl bg-[#111827] border border-white/10">
            <p className="text-xs uppercase font-mono text-slate-400">Volume de Mensagens</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totals.messages}</h3>
            <span className="text-[11px] text-emerald-400 mt-1 inline-block">Histórico global</span>
          </div>

          <a
            href="#aparelhos-web-push"
            className="p-5 rounded-2xl bg-[#111827] border border-white/10 hover:border-purple-500/50 transition-all group block cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-mono text-slate-400">Aparelhos Web Push</p>
              <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totals.subscriptions}</h3>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] text-purple-400">Inscrições ativas</span>
              <span className="text-[10px] text-slate-500 group-hover:text-purple-300 transition-colors">
                Ver lista ↓
              </span>
            </div>
          </a>
        </div>

        {/* Tabela de Tenants */}
        <div className="p-6 rounded-3xl bg-[#111827] border border-white/10 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div>
              <h3 className="text-base font-bold text-white">Telemetria de Mensageria por Organização</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Métricas de uso e infraestrutura por cliente sem exibição de conteúdo privado.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Organização (Cartório)</th>
                  <th className="py-2.5 px-3">Plano</th>
                  <th className="py-2.5 px-3 text-center">Usuários</th>
                  <th className="py-2.5 px-3 text-center">Conversas</th>
                  <th className="py-2.5 px-3 text-center">Mensagens</th>
                  <th className="py-2.5 px-3 text-center">Anexos</th>
                  <th className="py-2.5 px-3 text-center">Push Ativo</th>
                  <th className="py-2.5 px-3 text-right">Saúde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/20">
                          <Building2 className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">{t.name}</p>
                          <span className="text-[10px] text-slate-500 font-mono">{t.slug || t.id}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                        {t.plano}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">{t._count.users}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">{t._count.conversas}</td>
                    <td className="py-3 px-3 text-center font-mono text-indigo-300 font-semibold">{t._count.mensagens}</td>
                    <td className="py-3 px-3 text-center font-mono text-slate-300">{t._count.mensagemAnexos}</td>
                    <td className="py-3 px-3 text-center font-mono text-purple-300">{t._count.pushSubscriptions}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-[11px] font-medium text-emerald-400 inline-flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5" /> Normal
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabela de Aparelhos Web Push */}
        <div id="aparelhos-web-push" className="p-6 rounded-3xl bg-[#111827] border border-white/10 space-y-4 scroll-mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-white/5">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center font-bold text-xs border border-purple-500/20">
                  <Smartphone className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-base font-bold text-white">Aparelhos Conectados ao Web Push</h3>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20 font-semibold">
                  {pushSubscriptions.length} {pushSubscriptions.length === 1 ? 'aparelho' : 'aparelhos'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Dispositivos e navegadores autorizados a receber alertas e notificações instantâneas de novas mensagens corporativas.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-white/10 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Usuário / Colaborador</th>
                  <th className="py-2.5 px-3">Organização (Cartório)</th>
                  <th className="py-2.5 px-3">Dispositivo</th>
                  <th className="py-2.5 px-3">Navegador</th>
                  <th className="py-2.5 px-3">IP de Origem</th>
                  <th className="py-2.5 px-3">Data de Inscrição</th>
                  <th className="py-2.5 px-3">Última Atividade</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pushSubscriptions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                      Nenhum aparelho registrado para notificações Web Push até o momento.
                    </td>
                  </tr>
                ) : (
                  pushSubscriptions.map((sub) => {
                    const isMobile = isMobileDevice(sub.deviceName, sub.userAgent);
                    const browser = parseBrowserInfo(sub.userAgent);
                    const deviceLabel = parseDeviceInfo(sub.deviceName, sub.userAgent);

                    return (
                      <tr key={sub.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-purple-500/10 text-purple-300 flex items-center justify-center font-bold text-xs border border-purple-500/20">
                              {(sub.usuario?.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {sub.usuario?.name || 'Usuário Desconhecido'}
                                </p>
                                {sub.usuario?.role && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-slate-400">
                                    {sub.usuario.role}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-400">
                                {sub.usuario?.email || '-'}
                                {sub.usuario?.departamento && (
                                  <span className="text-slate-500"> • {sub.usuario.departamento}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div>
                            <p className="text-slate-200 font-medium">{sub.tenant?.name || '-'}</p>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {sub.tenant?.slug || sub.tenantId}
                            </span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5 text-slate-200 font-medium">
                            {isMobile ? (
                              <Smartphone className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                            ) : (
                              <Monitor className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                            )}
                            <span>{deviceLabel}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="text-slate-300 font-medium">{browser}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-mono text-slate-300 bg-white/5 px-2 py-0.5 rounded text-[11px] border border-white/5">
                            {sub.ipAddress || '-'}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-400 text-[11px]">
                          {formatDateTime(sub.createdAt)}
                        </td>

                        <td className="py-3 px-3 font-mono text-indigo-300 text-[11px]">
                          {formatDateTime(sub.lastUsedAt)}
                        </td>

                        <td className="py-3 px-3 text-right">
                          {sub.isActive ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                              Inativo
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
