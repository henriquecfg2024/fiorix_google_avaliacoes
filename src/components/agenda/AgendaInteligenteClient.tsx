'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  Calendar,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  Filter,
  History,
  Moon,
  Plus,
  Repeat,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  addDaysToLocalDate,
  formatCountdownLabel,
  formatHourShortBr,
  getZonedParts,
} from '@/lib/agenda/timezone';
import type {
  AgendaAuditLogDTO,
  AgendaCalendarView,
  AgendaCategoryDTO,
  AgendaDashboardIndicators,
  AgendaEmailOutboxDTO,
  AgendaNotificationJobDTO,
  AgendaOccurrenceView,
  AgendaPriority,
  AgendaRecurrenceType,
  AgendaSemesterMode,
  AgendaUserPreferenceDTO,
  AgendaVisibility,
  AgendaWelcomeResponse,
  AgendaWelcomeScenario,
} from '@/lib/agenda/types';
import { AgendaCalendarViews } from './AgendaCalendarViews';
import { AgendaEventModal } from './AgendaEventModal';
import { AgendaPreferencesPanel } from './AgendaPreferencesPanel';
import {
  AgendaCompartilhadosSection,
  AgendaHistoricoSection,
  AgendaProximosSection,
} from './AgendaSectionViews';
import { NotificationCenterDrawer } from './NotificationCenterDrawer';
import { WelcomeLoginModal } from './WelcomeLoginModal';
import {
  AgendaCategoryIcon,
  PRIORITY_LABEL,
  RECURRENCE_LABEL,
  VISIBILITY_LABEL,
} from './agenda-icons';

export type AgendaSectionMode =
  | 'dashboard'
  | 'calendario'
  | 'proximos'
  | 'compartilhados'
  | 'historico'
  | 'configuracoes';

interface AgendaInteligenteClientProps {
  initialSection?: AgendaSectionMode;
  initialView?: AgendaCalendarView;
}

const EMPTY_INDICATORS: AgendaDashboardIndicators = {
  hoje: 0,
  amanha: 0,
  proximos7Dias: 0,
  proximos30Dias: 0,
  pendentes: 0,
  atrasados: 0,
  concluidosMes: 0,
  lembretesProgramados: 0,
  recurrenceSummary: {
    diarias: 0,
    semanaisQuinzenais: 0,
    mensais: 0,
    semestrais: 0,
    anuais: 0,
    personalizadas: 0,
  },
};

const DEFAULT_PREFS: AgendaUserPreferenceDTO = {
  tenantId: '',
  userId: '',
  defaultView: 'MENSAL',
  weekStartsOn: 0,
  preferredCategories: [],
  defaultChannel: 'EMAIL',
  defaultOffsetMinutes: 30,
  quietHoursStart: null,
  quietHoursEnd: null,
  showCompleted: true,
  webPushEnabled: false,
  calendarCompactFormat: false,
  themeMode: 'light',
};

const SECTION_HEADER_META: Record<
  AgendaSectionMode,
  { title: string; subtitle: string; icon: typeof CalendarDays }
> = {
  dashboard: {
    title: 'Agenda Inteligente',
    subtitle: 'Visão geral de compromissos, recorrências e lembretes · 7º RI-SP',
    icon: CalendarDays,
  },
  calendario: {
    title: 'Calendário Institucional & Pessoal',
    subtitle: 'Planejamento diário, semanal, mensal, semestral e anual em tela dedicada · 7º RI-SP',
    icon: CalendarRange,
  },
  proximos: {
    title: 'Próximos Compromissos',
    subtitle: 'Cronograma em contagem regressiva agrupado por atrasados, hoje, amanhã e próximos prazos · 7º RI-SP',
    icon: CalendarClock,
  },
  compartilhados: {
    title: 'Compromissos Compartilhados e Setoriais',
    subtitle: 'Agenda colaborativa, eventos por departamento, reuniões institucionais e confirmações RSVP · 7º RI-SP',
    icon: Users,
  },
  historico: {
    title: 'Histórico e Auditoria da Agenda',
    subtitle: 'Compromissos concluídos, cancelados, datas passadas e trilha íntegra SHA-256 · 7º RI-SP',
    icon: History,
  },
  configuracoes: {
    title: 'Configurações de Lembretes e Preferências',
    subtitle: 'Personalize canais de alerta, horários silenciosos, histórico de e-mails e categorias · 7º RI-SP',
    icon: Settings,
  },
};

export function AgendaInteligenteClient({
  initialSection = 'dashboard',
  initialView = 'MENSAL',
}: AgendaInteligenteClientProps) {
  const searchParams = useSearchParams();
  const todayDate = useMemo(() => getZonedParts(new Date(), 'America/Sao_Paulo').dateStr, []);

  const [themeMode, setThemeMode] = useState<'light' | 'dark'>('light');
  const isDark = themeMode === 'dark';

  const [view, setView] = useState<AgendaCalendarView>(
    initialSection === 'proximos' || initialSection === 'compartilhados' || initialSection === 'historico'
      ? 'LISTA'
      : initialView
  );
  const [semesterMode, setSemesterMode] = useState<AgendaSemesterMode>('FIRST_HALF');
  const [anchorDate, setAnchorDate] = useState(todayDate);
  const [selectedDate, setSelectedDate] = useState(todayDate);

  // Filtros
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<AgendaPriority | ''>('');
  const [recurrenceType, setRecurrenceType] = useState<AgendaRecurrenceType | ''>('');
  const [visibility, setVisibility] = useState<AgendaVisibility | ''>('');
  const [scopeTab, setScopeTab] = useState<
    'todos' | 'proprios' | 'compartilhados' | 'institucionais'
  >('todos');
  const [quickFilter, setQuickFilter] = useState<string>(
    initialSection === 'historico'
      ? 'historico'
      : searchParams.get('quickFilter') || ''
  );

  const [loading, setLoading] = useState(true);
  const [indicators, setIndicators] = useState<AgendaDashboardIndicators>(EMPTY_INDICATORS);
  const [occurrences, setOccurrences] = useState<AgendaOccurrenceView[]>([]);
  const [upcoming, setUpcoming] = useState<AgendaOccurrenceView[]>([]);
  const [categories, setCategories] = useState<AgendaCategoryDTO[]>([]);
  const [preferences, setPreferences] = useState<AgendaUserPreferenceDTO>(DEFAULT_PREFS);
  const [auditLogs, setAuditLogs] = useState<AgendaAuditLogDTO[]>([]);
  const [permissions, setPermissions] = useState({
    role: 'USER',
    canCreateOwn: true,
    canAssignOrCreateSetorial: false,
    canCreateInstitucional: false,
    canManageCategories: false,
    canManageModule: false,
    isReadOnly: false,
  });

  // Notificações e central
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadList, setUnreadList] = useState<AgendaNotificationJobDTO[]>([]);
  const [readList, setReadList] = useState<AgendaNotificationJobDTO[]>([]);
  const [upcomingNotifs, setUpcomingNotifs] = useState<AgendaNotificationJobDTO[]>([]);
  const [snoozedNotifs, setSnoozedNotifs] = useState<AgendaNotificationJobDTO[]>([]);
  const [historyNotifs, setHistoryNotifs] = useState<AgendaNotificationJobDTO[]>([]);
  const [emailOutbox, setEmailOutbox] = useState<AgendaEmailOutboxDTO[]>([]);

  // Modal de criação/edição
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOcc, setEditingOcc] = useState<AgendaOccurrenceView | null>(null);
  const [modalInitialDate, setModalInitialDate] = useState(todayDate);

  // Prévia Boas-Vindas (apenas dashboard em dev/MASTER)
  const [previewWelcomeOpen, setPreviewWelcomeOpen] = useState(false);
  const [previewWelcomeData, setPreviewWelcomeData] = useState<AgendaWelcomeResponse | null>(null);

  const carregarDados = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set('search', search.trim());
      if (categoryId) qs.set('categoryId', categoryId);
      if (priority) qs.set('priority', priority);
      if (recurrenceType) qs.set('recurrenceType', recurrenceType);
      if (visibility) qs.set('visibility', visibility);
      if (initialSection !== 'compartilhados' && scopeTab !== 'todos') {
        qs.set('scopeTab', scopeTab);
      }
      if (initialSection === 'historico') {
        qs.set('quickFilter', 'historico');
        qs.set('start', addDaysToLocalDate(todayDate, -365));
      } else if (quickFilter) {
        qs.set('quickFilter', quickFilter);
      }

      const [dashRes, notifRes] = await Promise.all([
        fetch(`/api/agenda/dashboard?${qs.toString()}`, { cache: 'no-store' }),
        fetch('/api/agenda/notifications', { cache: 'no-store' }),
      ]);

      if (dashRes.ok) {
        const body = await dashRes.json();
        setIndicators(body.indicators ?? EMPTY_INDICATORS);
        setOccurrences(Array.isArray(body.occurrences) ? body.occurrences : []);
        setUpcoming(Array.isArray(body.upcoming) ? body.upcoming : []);
        setCategories(Array.isArray(body.categories) ? body.categories : []);
        if (body.preferences) setPreferences(body.preferences);
        setAuditLogs(Array.isArray(body.auditLogs) ? body.auditLogs : []);
        if (body.permissoes) setPermissions(body.permissoes);
      }

      if (notifRes.ok) {
        const nb = await notifRes.json();
        setUnreadCount(Number(nb.unreadCount ?? 0));
        setUnreadList(Array.isArray(nb.unread) ? nb.unread : []);
        setReadList(Array.isArray(nb.read) ? nb.read : []);
        setUpcomingNotifs(Array.isArray(nb.upcoming) ? nb.upcoming : []);
        setSnoozedNotifs(Array.isArray(nb.snoozed) ? nb.snoozed : []);
        setHistoryNotifs(Array.isArray(nb.history) ? nb.history : []);
        setEmailOutbox(Array.isArray(nb.emailOutbox) ? nb.emailOutbox : []);
      }
    } catch {
      toast.error('Erro ao carregar dados da Agenda Inteligente.');
    } finally {
      setLoading(false);
    }
  }, [
    initialSection,
    todayDate,
    search,
    categoryId,
    priority,
    recurrenceType,
    visibility,
    scopeTab,
    quickFilter,
  ]);

  useEffect(() => {
    void carregarDados();
  }, [carregarDados]);

  useEffect(() => {
    const onUpdated = () => void carregarDados();
    window.addEventListener('fiorix:agenda-updated', onUpdated);
    return () => window.removeEventListener('fiorix:agenda-updated', onUpdated);
  }, [carregarDados]);

  useEffect(() => {
    const targetEventId = searchParams.get('event');
    if (!targetEventId || occurrences.length === 0) return;
    const match = occurrences.find((o) => o.eventId === targetEventId);
    if (match) {
      setEditingOcc(match);
      setModalInitialDate(match.localStartDate);
      setModalOpen(true);
    }
  }, [searchParams, occurrences]);

  function handleNavigatePeriod(delta: number) {
    const [y, m, d] = anchorDate.split('-').map(Number);
    if (view === 'DIARIO') {
      const next = addDaysToLocalDate(selectedDate, delta);
      setSelectedDate(next);
      setAnchorDate(next);
      return;
    }
    if (view === 'SEMANAL') {
      const next = addDaysToLocalDate(anchorDate, delta * 7);
      setAnchorDate(next);
      setSelectedDate(next);
      return;
    }
    if (view === 'ANUAL') {
      const nextYear = y + delta;
      setAnchorDate(`${String(nextYear).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`);
      return;
    }
    const stepMonths = view === 'SEMESTRAL' ? delta * 6 : delta;
    const dt = new Date(Date.UTC(y, m - 1 + stepMonths, Math.min(d, 28)));
    setAnchorDate(dt.toISOString().slice(0, 10));
  }

  function handleSelectYear(nextYear: number) {
    const [, m] = anchorDate.split('-').map(Number);
    setAnchorDate(`${String(nextYear).padStart(4, '0')}-${String(m).padStart(2, '0')}-01`);
  }

  async function handleQuickConclude(occ: AgendaOccurrenceView) {
    try {
      const res = await fetch(`/api/agenda/events/${encodeURIComponent(occ.eventId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CONCLUIR',
          scope: occ.isRecurringInstance ? 'SINGLE' : 'ALL',
          occurrenceDate: occ.occurrenceDate,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || 'Não foi possível concluir o compromisso.');
        return;
      }
      toast.success(`"${occ.title}" marcado como concluído.`);
      window.dispatchEvent(new Event('fiorix:agenda-updated'));
      await carregarDados();
    } catch {
      toast.error('Erro ao concluir compromisso.');
    }
  }

  async function handleRespondRsvp(
    occ: AgendaOccurrenceView,
    rsvpStatus: 'CONFIRMADO' | 'RECUSADO'
  ) {
    try {
      const res = await fetch(`/api/agenda/events/${encodeURIComponent(occ.eventId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RSVP', rsvpStatus }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body?.error || 'Não foi possível registrar sua resposta.');
        return;
      }
      toast.success(
        rsvpStatus === 'CONFIRMADO' ? 'Participação confirmada!' : 'Convite recusado.'
      );
      window.dispatchEvent(new Event('fiorix:agenda-updated'));
      await carregarDados();
    } catch {
      toast.error('Erro ao responder convite.');
    }
  }

  async function handleMarkRead(jobId: string) {
    await fetch('/api/agenda/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'MARK_READ', jobId }),
    });
    await carregarDados();
  }

  async function handleMarkAllRead() {
    await fetch('/api/agenda/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'MARK_ALL_READ' }),
    });
    await carregarDados();
  }

  async function handleRunWorkerDev() {
    const res = await fetch('/api/cron/agenda-reminders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceSandboxEmail: true }),
    });
    const body = await res.json();
    if (!res.ok) {
      toast.error(body?.error || 'Não foi possível processar a fila de lembretes.');
      return;
    }
    toast.success(
      `Fila processada: ${body.deliveredPopup ?? 0} pop-up(s) · ${body.deliveredEmail ?? 0} e-mail(s).`
    );
    window.dispatchEvent(new Event('fiorix:agenda-updated'));
    await carregarDados();
  }

  async function handlePreviewWelcomeScenario(scenario: AgendaWelcomeScenario) {
    try {
      const res = await fetch(`/api/agenda/welcome?preview=${encodeURIComponent(scenario)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const body = (await res.json()) as AgendaWelcomeResponse;
      setPreviewWelcomeData(body);
      setPreviewWelcomeOpen(true);
    } catch {
      toast.error('Erro ao carregar prévia das boas-vindas.');
    }
  }

  const pageBg = isDark
    ? 'bg-[#070A12] text-white [color-scheme:dark]'
    : 'bg-[#F4F6FB] text-slate-900 [color-scheme:light]';
  const surfaceCard = isDark
    ? 'bg-[#0D1322] border-white/10 text-slate-100'
    : 'bg-white border-slate-200/80 text-slate-900 shadow-xs';
  const mutedText = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputCls = isDark
    ? 'border-white/15 bg-[#070A12] text-white placeholder:text-slate-500 focus:border-violet-400 focus:outline-none [color-scheme:dark]'
    : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 shadow-2xs focus:border-[#43239D] focus:outline-none [color-scheme:light]';

  const headerMeta = SECTION_HEADER_META[initialSection];
  const HeaderIcon = headerMeta.icon;
  const canCreate = !permissions.isReadOnly && permissions.canCreateOwn;
  const showHeaderCreateButton =
    canCreate &&
    (initialSection === 'calendario' ||
      initialSection === 'proximos' ||
      initialSection === 'compartilhados');
  const showWelcomeShortcuts =
    initialSection === 'dashboard' &&
    (process.env.NODE_ENV !== 'production' || permissions.role === 'MASTER');

  function openNewModal(dateStr = selectedDate) {
    setEditingOcc(null);
    setModalInitialDate(dateStr);
    setModalOpen(true);
  }

  function openOccurrenceModal(occ: AgendaOccurrenceView) {
    setEditingOcc(occ);
    setModalInitialDate(occ.localStartDate);
    setModalOpen(true);
  }

  return (
    <div className={`min-h-full p-4 sm:p-6 lg:p-7 space-y-5 transition-colors ${pageBg}`}>
      {/* Cabeçalho contextual por tela */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl border border-violet-200 bg-white text-[#43239D] flex items-center justify-center shadow-xs shrink-0">
            <HeaderIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              {headerMeta.title}
            </h1>
            <p className={`text-xs ${mutedText}`}>
              {headerMeta.subtitle}
              {permissions.isReadOnly ? ' · Somente leitura' : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {showWelcomeShortcuts && (
            <div className="hidden xl:flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-violet-600" />
              <span className="font-semibold">Boas-vindas:</span>
              {(
                [
                  ['A_UM_COMPROMISSO', '1 comp.'],
                  ['B_VARIOS_COMPROMISSOS', 'Vários'],
                  ['C_SEM_COMPROMISSOS', 'Livre'],
                  ['D_TODOS_CONCLUIDOS', 'Concluídos'],
                  ['E_COM_ATRASADOS', 'Atraso'],
                  ['F_FALHA_CONSULTA', 'Falha'],
                ] as Array<[AgendaWelcomeScenario, string]>
              ).map(([scen, label]) => (
                <button
                  key={scen}
                  type="button"
                  onClick={() => void handlePreviewWelcomeScenario(scen)}
                  className="rounded-lg px-2 py-0.5 font-semibold hover:bg-violet-50 hover:text-violet-800"
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {showHeaderCreateButton && (
            <button
              type="button"
              onClick={() => openNewModal(selectedDate)}
              className="rounded-full bg-[#43239D] px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-900/15 hover:bg-[#5B21B6] inline-flex items-center gap-1.5 whitespace-nowrap transition"
            >
              <Plus className="h-4 w-4" />
              Novo compromisso
            </button>
          )}

          <button
            type="button"
            onClick={() => setThemeMode((prev) => (prev === 'light' ? 'dark' : 'light'))}
            aria-label="Alternar tema claro/escuro da Agenda"
            title="Alternar tema da Agenda (padrão Claro)"
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              isDark
                ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs'
            }`}
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
            {isDark ? 'Tema Claro' : 'Claro'}
          </button>

          <button
            type="button"
            onClick={() => setNotifOpen(true)}
            aria-label="Abrir Central de Notificações"
            className={`relative rounded-xl border p-2.5 transition ${
              isDark
                ? 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs'
            }`}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 1. TELA MINHA AGENDA (DASHBOARD PRINCIPAL) */}
      {initialSection === 'dashboard' && (
        <>
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
              {[
                {
                  key: 'hoje',
                  label: 'Hoje',
                  value: indicators.hoje,
                  bg: isDark
                    ? 'bg-sky-500/15 border-sky-400/30 text-sky-200'
                    : 'bg-[#EAF2FF] border-[#D6E6FF] text-[#1E3A8A]',
                  icon: Calendar,
                },
                {
                  key: 'proximos7',
                  label: 'Próximos 7 dias',
                  value: indicators.proximos7Dias,
                  bg: isDark
                    ? 'bg-violet-500/15 border-violet-400/30 text-violet-200'
                    : 'bg-[#F3EEFE] border-[#E4D8FC] text-[#5B21B6]',
                  icon: CalendarDays,
                },
                {
                  key: 'pendentes',
                  label: 'Pendentes',
                  value: indicators.pendentes,
                  bg: isDark
                    ? 'bg-amber-500/15 border-amber-400/30 text-amber-200'
                    : 'bg-[#FFF3E6] border-[#FDE2C4] text-[#9A3412]',
                  icon: AlertTriangle,
                },
                {
                  key: 'concluidos_mes',
                  label: 'Concluídos no mês',
                  value: indicators.concluidosMes,
                  bg: isDark
                    ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200'
                    : 'bg-[#E9F9EE] border-[#CCF0D8] text-[#166534]',
                  icon: CheckCircle2,
                },
              ].map((kpi) => {
                const Icon = kpi.icon;
                const active = quickFilter === kpi.key;
                return (
                  <button
                    key={kpi.key}
                    type="button"
                    onClick={() =>
                      setQuickFilter((prev) => (prev === kpi.key ? '' : kpi.key))
                    }
                    className={`rounded-2xl border p-4 text-left transition ${kpi.bg} ${
                      active ? 'ring-2 ring-violet-600' : 'hover:shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-2 text-xs font-bold">
                      <Icon className="h-4 w-4" />
                      <span>{kpi.label}</span>
                    </div>
                    <div className="mt-1.5 text-3xl font-extrabold tabular-nums">{kpi.value}</div>
                    <div className="text-[11px] opacity-80">compromissos</div>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {[
                { key: 'amanha', label: `Amanhã: ${indicators.amanha}` },
                { key: 'proximos30', label: `Próximos 30 dias: ${indicators.proximos30Dias}` },
                { key: 'atrasados', label: `Atrasados: ${indicators.atrasados}` },
                {
                  key: 'lembretes',
                  label: `Lembretes programados: ${indicators.lembretesProgramados}`,
                },
              ].map((pill) => {
                const active = quickFilter === pill.key;
                return (
                  <button
                    key={pill.key}
                    type="button"
                    onClick={() => {
                      if (pill.key === 'lembretes') {
                        setNotifOpen(true);
                      } else {
                        setQuickFilter((prev) => (prev === pill.key ? '' : pill.key));
                      }
                    }}
                    className={`rounded-full border px-3 py-1 font-semibold transition ${
                      active
                        ? 'bg-[#43239D] text-white border-[#43239D]'
                        : isDark
                          ? 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {pill.label}
                  </button>
                );
              })}
              {quickFilter && (
                <button
                  type="button"
                  onClick={() => setQuickFilter('')}
                  className="text-xs font-bold text-violet-700 hover:underline ml-1"
                >
                  Limpar filtro rápido
                </button>
              )}
            </div>
          </div>

          <div className={`rounded-2xl border p-3.5 space-y-3 ${surfaceCard}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/80 p-1">
                {(
                  [
                    ['DIARIO', 'Diário'],
                    ['SEMANAL', 'Semanal'],
                    ['MENSAL', 'Mensal'],
                    ['SEMESTRAL', 'Semestral'],
                    ['ANUAL', 'Anual'],
                    ['LISTA', 'Lista'],
                  ] as Array<[AgendaCalendarView, string]>
                ).map(([vKey, vLabel]) => (
                  <button
                    key={vKey}
                    type="button"
                    onClick={() => setView(vKey)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      view === vKey
                        ? 'bg-[#43239D] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    {vLabel}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {(
                  [
                    ['todos', 'Todos'],
                    ['proprios', 'Meus'],
                    ['compartilhados', 'Compartilhados'],
                    ['institucionais', 'Institucionais'],
                  ] as const
                ).map(([sKey, sLabel]) => (
                  <button
                    key={sKey}
                    type="button"
                    onClick={() => setScopeTab(sKey)}
                    className={`rounded-xl border px-2.5 py-1.5 font-semibold transition ${
                      scopeTab === sKey
                        ? 'bg-violet-50 border-violet-300 text-violet-900'
                        : isDark
                          ? 'border-white/10 text-slate-300'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {sLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar compromisso por título, descrição ou local..."
                  className={`w-full rounded-xl border pl-8 pr-3 py-2 ${inputCls}`}
                />
              </div>

              <div className="inline-flex items-center gap-1 text-slate-500">
                <Filter className="h-3.5 w-3.5" />
              </div>

              <select
                aria-label="Filtrar por categoria"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
              >
                <option value="">Todas categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar por prioridade"
                value={priority}
                onChange={(e) => setPriority(e.target.value as AgendaPriority | '')}
                className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
              >
                <option value="">Todas prioridades</option>
                {(['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'] as AgendaPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar por recorrência"
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value as AgendaRecurrenceType | '')}
                className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
              >
                <option value="">Todas recorrências</option>
                {(Object.keys(RECURRENCE_LABEL) as AgendaRecurrenceType[]).map((r) => (
                  <option key={r} value={r}>
                    {RECURRENCE_LABEL[r]}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar por visibilidade"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as AgendaVisibility | '')}
                className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
              >
                <option value="">Todas visibilidades</option>
                {(Object.keys(VISIBILITY_LABEL) as AgendaVisibility[]).map((v) => (
                  <option key={v} value={v}>
                    {VISIBILITY_LABEL[v]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-8">
              {loading ? (
                <div className={`rounded-3xl border p-12 text-center text-sm ${surfaceCard}`}>
                  Carregando compromissos...
                </div>
              ) : (
                <AgendaCalendarViews
                  view={view}
                  semesterMode={semesterMode}
                  onChangeSemesterMode={setSemesterMode}
                  anchorDate={anchorDate}
                  selectedDate={selectedDate}
                  todayDate={todayDate}
                  occurrences={occurrences}
                  categories={categories}
                  isDark={isDark}
                  canCreate={canCreate}
                  onSelectDate={setSelectedDate}
                  onNavigatePeriod={handleNavigatePeriod}
                  onSelectYear={handleSelectYear}
                  onGoToday={() => {
                    setAnchorDate(todayDate);
                    setSelectedDate(todayDate);
                  }}
                  onOpenOccurrence={openOccurrenceModal}
                  onCreateOnDate={openNewModal}
                />
              )}
            </div>

            <div className={`xl:col-span-4 rounded-3xl border p-4 sm:p-5 space-y-3.5 ${surfaceCard}`}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-extrabold">Próximos compromissos</h2>
                <Link
                  href="/agenda/proximos"
                  className="text-xs font-bold text-[#43239D] hover:underline"
                >
                  Ver todos →
                </Link>
              </div>

              {upcoming.length === 0 ? (
                <div className={`rounded-2xl border border-dashed p-6 text-center text-xs ${mutedText}`}>
                  Nenhum próximo compromisso pendente.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcoming.slice(0, 5).map((occ) => (
                    <button
                      key={occ.occurrenceKey}
                      type="button"
                      onClick={() => openOccurrenceModal(occ)}
                      className="w-full rounded-2xl p-3 text-left text-white flex items-center justify-between gap-2.5 shadow-xs hover:opacity-95 transition"
                      style={{ backgroundColor: occ.color }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                          <AgendaCategoryIcon iconName={occ.icon} className="h-4 w-4 text-white" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold truncate">{occ.title}</div>
                          <div className="text-[11px] text-white/90 truncate">
                            {occ.localStartDate.slice(8, 10)}/{occ.localStartDate.slice(5, 7)} ·{' '}
                            {formatHourShortBr(occ.localStartTime, occ.allDay)}
                          </div>
                        </div>
                      </div>
                      <div className="rounded-xl bg-black/15 px-2.5 py-1.5 text-center shrink-0 min-w-[78px]">
                        <div className="text-xs font-extrabold leading-tight">
                          {formatCountdownLabel(occ)}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className={`lg:col-span-5 rounded-3xl border p-4 space-y-2.5 ${surfaceCard}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <Bell className="h-4 w-4 text-slate-600" />
                  Meus lembretes
                </div>
                <span className="text-[11px] font-semibold text-violet-700">
                  {indicators.lembretesProgramados} programado(s)
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Clock className="h-3.5 w-3.5 text-violet-600" />
                    E-mail:{' '}
                    {preferences.defaultOffsetMinutes >= 1440
                      ? '1 dia antes'
                      : `${preferences.defaultOffsetMinutes} min antes`}
                  </span>
                  <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold">
                    Ativo
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200/80 px-3 py-2">
                  <span className="inline-flex items-center gap-2 font-medium">
                    <Bell className="h-3.5 w-3.5 text-violet-600" />
                    Pop-up: 30 minutos antes
                  </span>
                  <span className="rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-[10px] font-bold">
                    Ativo
                  </span>
                </div>
              </div>
            </div>

            <div className={`lg:col-span-5 rounded-3xl border p-4 space-y-2.5 ${surfaceCard}`}>
              <div className="flex items-center gap-2 text-sm font-extrabold">
                <Repeat className="h-4 w-4 text-slate-600" />
                Recorrências cadastradas
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  {
                    label: 'Diárias',
                    val: indicators.recurrenceSummary.diarias,
                    cls: 'bg-[#FFF3E6] text-[#9A3412]',
                  },
                  {
                    label: 'Mensais',
                    val: indicators.recurrenceSummary.mensais,
                    cls: 'bg-[#EAF2FF] text-[#1E3A8A]',
                  },
                  {
                    label: 'Semestrais',
                    val: indicators.recurrenceSummary.semestrais,
                    cls: 'bg-[#E9F9EE] text-[#166534]',
                  },
                  {
                    label: 'Anuais',
                    val: indicators.recurrenceSummary.anuais,
                    cls: 'bg-[#F3EEFE] text-[#5B21B6]',
                  },
                ].map((r) => (
                  <div key={r.label} className={`rounded-2xl p-2 ${r.cls}`}>
                    <div className="text-[10px] font-bold">{r.label}</div>
                    <div className="text-xl font-extrabold tabular-nums">{r.val}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 flex justify-end">
              {canCreate && (
                <button
                  type="button"
                  onClick={() => openNewModal(selectedDate)}
                  className="w-full rounded-full bg-[#43239D] px-5 py-4 text-xs sm:text-sm font-bold text-white shadow-lg shadow-violet-900/20 hover:bg-[#5B21B6] inline-flex items-center justify-center gap-2 whitespace-nowrap transition"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  Novo compromisso
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* 2. TELA CALENDÁRIO (TELA CHEIA DEDICADA AO PLANEJAMENTO TEMPORAL) */}
      {initialSection === 'calendario' && (
        <>
          <div className={`rounded-2xl border p-3.5 space-y-3 ${surfaceCard}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/80 p-1">
                {(
                  [
                    ['DIARIO', 'Diário'],
                    ['SEMANAL', 'Semanal'],
                    ['MENSAL', 'Mensal'],
                    ['SEMESTRAL', 'Semestral'],
                    ['ANUAL', 'Anual'],
                  ] as Array<[AgendaCalendarView, string]>
                ).map(([vKey, vLabel]) => (
                  <button
                    key={vKey}
                    type="button"
                    onClick={() => setView(vKey)}
                    className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                      view === vKey
                        ? 'bg-[#43239D] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-950'
                    }`}
                  >
                    {vLabel}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {(
                  [
                    ['todos', 'Todos'],
                    ['proprios', 'Meus'],
                    ['compartilhados', 'Compartilhados'],
                    ['institucionais', 'Institucionais'],
                  ] as const
                ).map(([sKey, sLabel]) => (
                  <button
                    key={sKey}
                    type="button"
                    onClick={() => setScopeTab(sKey)}
                    className={`rounded-xl border px-2.5 py-1.5 font-semibold transition ${
                      scopeTab === sKey
                        ? 'bg-violet-50 border-violet-300 text-violet-900'
                        : isDark
                          ? 'border-white/10 text-slate-300'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {sLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrar no calendário por título, descrição ou local..."
                  className={`w-full rounded-xl border pl-8 pr-3 py-2 ${inputCls}`}
                />
              </div>

              <select
                aria-label="Filtrar por categoria"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
              >
                <option value="">Todas categorias</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar por prioridade"
                value={priority}
                onChange={(e) => setPriority(e.target.value as AgendaPriority | '')}
                className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
              >
                <option value="">Todas prioridades</option>
                {(['BAIXA', 'NORMAL', 'ALTA', 'CRITICA'] as AgendaPriority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filtrar por visibilidade"
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as AgendaVisibility | '')}
                className={`rounded-xl border px-2.5 py-2 ${inputCls}`}
              >
                <option value="">Todas visibilidades</option>
                {(Object.keys(VISIBILITY_LABEL) as AgendaVisibility[]).map((v) => (
                  <option key={v} value={v}>
                    {VISIBILITY_LABEL[v]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className={`rounded-3xl border p-12 text-center text-sm ${surfaceCard}`}>
              Carregando calendário...
            </div>
          ) : (
            <AgendaCalendarViews
              view={view === 'LISTA' ? 'MENSAL' : view}
              semesterMode={semesterMode}
              onChangeSemesterMode={setSemesterMode}
              anchorDate={anchorDate}
              selectedDate={selectedDate}
              todayDate={todayDate}
              occurrences={occurrences}
              categories={categories}
              isDark={isDark}
              canCreate={canCreate}
              onSelectDate={setSelectedDate}
              onNavigatePeriod={handleNavigatePeriod}
              onSelectYear={handleSelectYear}
              onGoToday={() => {
                setAnchorDate(todayDate);
                setSelectedDate(todayDate);
              }}
              onOpenOccurrence={openOccurrenceModal}
              onCreateOnDate={openNewModal}
            />
          )}
        </>
      )}

      {/* 3. TELA PRÓXIMOS COMPROMISSOS */}
      {initialSection === 'proximos' && (
        <AgendaProximosSection
          occurrences={occurrences}
          categories={categories}
          todayDate={todayDate}
          search={search}
          onSearchChange={setSearch}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          priority={priority}
          onPriorityChange={setPriority}
          recurrenceType={recurrenceType}
          onRecurrenceChange={setRecurrenceType}
          isDark={isDark}
          canCreate={canCreate}
          loading={loading}
          onOpenOccurrence={openOccurrenceModal}
          onQuickConclude={handleQuickConclude}
          onCreateNew={() => openNewModal(todayDate)}
        />
      )}

      {/* 4. TELA COMPARTILHADOS */}
      {initialSection === 'compartilhados' && (
        <AgendaCompartilhadosSection
          occurrences={occurrences}
          categories={categories}
          currentUserId={preferences.userId}
          search={search}
          onSearchChange={setSearch}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          priority={priority}
          onPriorityChange={setPriority}
          isDark={isDark}
          canCreate={canCreate}
          loading={loading}
          onOpenOccurrence={openOccurrenceModal}
          onRespondRsvp={handleRespondRsvp}
          onCreateNew={() => openNewModal(todayDate)}
        />
      )}

      {/* 5. TELA HISTÓRICO */}
      {initialSection === 'historico' && (
        <AgendaHistoricoSection
          occurrences={occurrences}
          categories={categories}
          auditLogs={auditLogs}
          todayDate={todayDate}
          search={search}
          onSearchChange={setSearch}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          isDark={isDark}
          loading={loading}
          onOpenOccurrence={openOccurrenceModal}
        />
      )}

      {/* 6. TELA CONFIGURAÇÕES DE LEMBRETES */}
      {initialSection === 'configuracoes' && (
        <AgendaPreferencesPanel
          preferences={preferences}
          emailOutbox={emailOutbox}
          categories={categories}
          canManageCategories={permissions.canManageCategories}
          isReadOnly={permissions.isReadOnly}
          isDark={isDark}
          onUpdated={setPreferences}
          onCategoryCreated={() => void carregarDados()}
          onRunWorkerSandbox={
            process.env.NODE_ENV !== 'production' ? handleRunWorkerDev : undefined
          }
        />
      )}

      <AgendaEventModal
        open={modalOpen}
        initialDate={modalInitialDate}
        editingOccurrence={editingOcc}
        categories={categories}
        permissions={permissions}
        onClose={() => setModalOpen(false)}
        onSaved={() => void carregarDados()}
      />

      <NotificationCenterDrawer
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        unread={unreadList}
        read={readList}
        upcoming={upcomingNotifs}
        snoozed={snoozedNotifs}
        history={historyNotifs}
        emailOutbox={emailOutbox}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onOpenEvent={(eventId) => {
          const match = occurrences.find((o) => o.eventId === eventId);
          if (match) {
            openOccurrenceModal(match);
          }
        }}
      />

      <WelcomeLoginModal
        open={previewWelcomeOpen}
        loading={false}
        data={previewWelcomeData}
        onClose={() => setPreviewWelcomeOpen(false)}
        onOpenAgenda={(qf) => {
          setPreviewWelcomeOpen(false);
          if (qf) setQuickFilter(qf);
        }}
        onRetry={() => void handlePreviewWelcomeScenario('B_VARIOS_COMPROMISSOS')}
      />
    </div>
  );
}
