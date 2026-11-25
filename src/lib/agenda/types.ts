export type AgendaCalendarView =
  | 'DIARIO'
  | 'SEMANAL'
  | 'MENSAL'
  | 'SEMESTRAL'
  | 'ANUAL'
  | 'LISTA';

export type AgendaSemesterMode = 'FIRST_HALF' | 'SECOND_HALF' | 'ROLLING_6';

export type AgendaPriority = 'BAIXA' | 'NORMAL' | 'ALTA' | 'CRITICA';

export type AgendaStatus =
  | 'AGENDADO'
  | 'PENDENTE'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDO'
  | 'REAGENDADO'
  | 'CANCELADO'
  | 'ATRASADO';

export type AgendaVisibility =
  | 'INDIVIDUAL'
  | 'COMPARTILHADO'
  | 'SETORIAL'
  | 'INSTITUCIONAL';

export type AgendaRecurrenceType =
  | 'UNICO'
  | 'DIARIO'
  | 'SEMANAL'
  | 'QUINZENAL'
  | 'MENSAL'
  | 'BIMESTRAL'
  | 'TRIMESTRAL'
  | 'SEMESTRAL'
  | 'ANUAL'
  | 'PERSONALIZADO';

export type AgendaMonthEndPolicy = 'ULTIMO_DIA' | 'IGNORAR_MES';
export type AgendaBusinessDayRule = 'NONE' | 'FIRST_BUSINESS_DAY' | 'LAST_BUSINESS_DAY';
export type AgendaRecurrenceEditScope = 'SINGLE' | 'THIS_AND_FOLLOWING' | 'ALL';
export type AgendaReminderChannel = 'EMAIL' | 'POPUP' | 'PUSH';
export type AgendaRsvpStatus = 'PENDENTE' | 'CONFIRMADO' | 'RECUSADO';
export type AgendaCategoryScope = 'PESSOAL' | 'INSTITUCIONAL';
export type AgendaThemeMode = 'light' | 'dark';

export interface AgendaRecurrenceRule {
  frequency: AgendaRecurrenceType;
  interval: number; // >= 1
  weekdays?: number[]; // 0=Dom .. 6=Sáb
  monthDay?: number | null; // 1..31
  businessDayRule?: AgendaBusinessDayRule;
  monthEndPolicy?: AgendaMonthEndPolicy;
  endDate?: string | null; // YYYY-MM-DD local
  maxOccurrences?: number | null;
  unlimited?: boolean;
  customUnit?: 'DIAS' | 'SEMANAS' | 'MESES' | 'ANOS';
  holidayDates?: string[]; // YYYY-MM-DD configuráveis
}

export interface AgendaCategoryDTO {
  id: string;
  tenantId: string;
  slug: string;
  name: string;
  color: string;
  icon: string;
  scope: AgendaCategoryScope;
  ownerUserId: string | null;
  isSystem: boolean;
  isActive: boolean;
}

export interface AgendaParticipantDTO {
  id: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  rsvpStatus: AgendaRsvpStatus;
  canEdit: boolean;
  respondedAt: string | null;
}

export interface AgendaReminderConfigDTO {
  id: string;
  userId: string;
  channel: AgendaReminderChannel;
  offsetMinutes: number;
  isMandatory: boolean;
  isActive: boolean;
}

export interface AgendaRecurrenceExceptionDTO {
  id: string;
  eventId: string;
  occurrenceDate: string; // YYYY-MM-DD
  scope: 'SINGLE' | 'THIS_AND_FOLLOWING';
  action: 'MODIFIED' | 'CANCELLED';
  overrideStart: string | null;
  overrideEnd: string | null;
  overrideTitle: string | null;
  overrideNotes: string | null;
}

export interface AgendaOccurrenceStatusDTO {
  eventId: string;
  occurrenceDate: string;
  status: AgendaStatus;
  completedBy: string | null;
  completedAt: string | null;
}

export interface AgendaAttachmentRef {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
}

export interface AgendaEventDTO {
  id: string;
  tenantId: string;
  categoryId: string | null;
  categoryName: string;
  title: string;
  description: string | null;
  color: string;
  icon: string;
  startAt: string; // ISO UTC
  endAt: string; // ISO UTC
  allDay: boolean;
  timezone: string;
  localStartDate: string; // YYYY-MM-DD
  localStartTime: string; // HH:mm
  localEndDate: string;
  localEndTime: string;
  location: string | null;
  meetingLink: string | null;
  notes: string | null;
  priority: AgendaPriority;
  status: AgendaStatus;
  visibility: AgendaVisibility;
  isConfidential: boolean;
  ownerUserId: string;
  ownerName: string | null;
  department: string | null;
  recurrenceType: AgendaRecurrenceType;
  recurrenceRule: AgendaRecurrenceRule | null;
  rruleText: string | null;
  attachments: AgendaAttachmentRef[];
  participants: AgendaParticipantDTO[];
  reminders: AgendaReminderConfigDTO[];
  exceptions: AgendaRecurrenceExceptionDTO[];
  occurrenceStatuses: AgendaOccurrenceStatusDTO[];
  completedAt: string | null;
  cancelledAt: string | null;
  retentionClass: 'PESSOAL' | 'OPERACIONAL' | 'GOVERNANCA_5_ANOS';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgendaOccurrenceView {
  occurrenceKey: string; // `${eventId}::${occurrenceDate}`
  eventId: string;
  occurrenceDate: string; // YYYY-MM-DD
  isRecurringInstance: boolean;
  title: string;
  description: string | null;
  categoryId: string | null;
  categoryName: string;
  color: string;
  icon: string;
  startAt: string;
  endAt: string;
  localStartDate: string;
  localStartTime: string;
  localEndDate: string;
  localEndTime: string;
  allDay: boolean;
  timezone: string;
  location: string | null;
  meetingLink: string | null;
  notes: string | null;
  priority: AgendaPriority;
  effectiveStatus: AgendaStatus;
  isOverdue: boolean;
  visibility: AgendaVisibility;
  isConfidential: boolean;
  ownerUserId: string;
  ownerName: string | null;
  department: string | null;
  recurrenceType: AgendaRecurrenceType;
  participants: AgendaParticipantDTO[];
  reminders: AgendaReminderConfigDTO[];
  canEdit: boolean;
  canConclude: boolean;
  canDelete: boolean;
}

export interface AgendaDashboardIndicators {
  hoje: number;
  amanha: number;
  proximos7Dias: number;
  proximos30Dias: number;
  pendentes: number;
  atrasados: number;
  concluidosMes: number;
  lembretesProgramados: number;
  recurrenceSummary: {
    diarias: number;
    semanaisQuinzenais: number;
    mensais: number;
    semestrais: number;
    anuais: number;
    personalizadas: number;
  };
}

export interface AgendaNotificationJobDTO {
  id: string;
  tenantId: string;
  eventId: string;
  eventTitle: string;
  eventCategoryName: string;
  eventCategoryIcon: string;
  eventColor: string;
  eventPriority: AgendaPriority;
  eventStartAt: string;
  eventLocalDate: string;
  eventLocalTime: string;
  eventDescription: string | null;
  eventAllDay: boolean;
  reminderId: string | null;
  recipientUserId: string;
  occurrenceKey: string;
  channel: AgendaReminderChannel;
  idempotencyKey: string;
  scheduledFor: string;
  status:
    | 'PENDENTE'
    | 'PROCESSANDO'
    | 'DISPONIVEL'
    | 'ADIADO'
    | 'LIDO'
    | 'ENVIADO'
    | 'FALHA'
    | 'CANCELADO'
    | 'OBSOLETO';
  snoozedUntil: string | null;
  readAt: string | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgendaEmailOutboxDTO {
  id: string;
  jobId: string;
  recipientUserId: string;
  recipientEmail: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  status: 'PROCESSADA' | 'ACEITA_PROVEDOR' | 'ENTREGUE_CONFIRMADA' | 'FALHA' | 'SANDBOX_SIMULADA';
  providerMessageId: string | null;
  attempts: number;
  errorMessage: string | null;
  processedAt: string;
}

export interface AgendaUserPreferenceDTO {
  tenantId: string;
  userId: string;
  defaultView: AgendaCalendarView;
  weekStartsOn: 0 | 1;
  preferredCategories: string[];
  defaultChannel: AgendaReminderChannel;
  defaultOffsetMinutes: number;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  showCompleted: boolean;
  webPushEnabled: boolean;
  calendarCompactFormat: boolean;
  themeMode: AgendaThemeMode;
}

export interface AgendaAuditLogDTO {
  id: string;
  tenantId: string;
  eventId: string | null;
  actorUserId: string;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  sha256: string;
  createdAt: string;
}

export type AgendaWelcomeScenario =
  | 'A_UM_COMPROMISSO'
  | 'B_VARIOS_COMPROMISSOS'
  | 'C_SEM_COMPROMISSOS'
  | 'D_TODOS_CONCLUIDOS'
  | 'E_COM_ATRASADOS'
  | 'F_FALHA_CONSULTA'
  | 'G_SEM_PERMISSAO_AGENDA';

export interface AgendaWelcomeSummaryItem {
  occurrenceKey: string;
  eventId: string;
  title: string;
  localStartTime: string;
  allDay: boolean;
  color: string;
  icon: string;
  priority: AgendaPriority;
  status: AgendaStatus;
  categoryName: string;
}

export interface AgendaWelcomeResponse {
  enabled: boolean;
  loginKey: string;
  firstName: string | null;
  greetingTitle: string;
  timePeriod: 'MANHA' | 'TARDE' | 'NOITE';
  formattedDate: string;
  timezone: string;
  canAccessAgenda: boolean;
  queryFailed: boolean;
  scenario: AgendaWelcomeScenario;
  totalTodayScheduled: number;
  totalTodayCompleted: number;
  totalTodayPending: number;
  totalTodayInProgress: number;
  totalOverdue: number;
  todayItems: AgendaWelcomeSummaryItem[];
  remainingCount: number;
}

export const DEFAULT_AGENDA_CATEGORIES: Array<{
  slug: string;
  name: string;
  color: string;
  icon: string;
  scope: AgendaCategoryScope;
}> = [
  { slug: 'administrativo', name: 'Administrativo', color: '#2563EB', icon: 'Briefcase', scope: 'INSTITUCIONAL' },
  { slug: 'reunioes', name: 'Reuniões', color: '#7C3AED', icon: 'Users', scope: 'INSTITUCIONAL' },
  { slug: 'tecnologia-informacao', name: 'Tecnologia da Informação', color: '#1E3A8A', icon: 'Cpu', scope: 'INSTITUCIONAL' },
  { slug: 'seguranca-informacao', name: 'Segurança da Informação', color: '#DC2626', icon: 'ShieldAlert', scope: 'INSTITUCIONAL' },
  { slug: 'recursos-humanos', name: 'Recursos Humanos', color: '#DB2777', icon: 'HeartHandshake', scope: 'INSTITUCIONAL' },
  { slug: 'obrigacoes-legais', name: 'Obrigações legais', color: '#EA580C', icon: 'Scale', scope: 'INSTITUCIONAL' },
  { slug: 'treinamentos', name: 'Treinamentos', color: '#16A34A', icon: 'GraduationCap', scope: 'INSTITUCIONAL' },
  { slug: 'manutencoes', name: 'Manutenções', color: '#CA8A04', icon: 'Wrench', scope: 'INSTITUCIONAL' },
  { slug: 'financeiro', name: 'Financeiro', color: '#047857', icon: 'Wallet', scope: 'INSTITUCIONAL' },
  { slug: 'auditorias', name: 'Auditorias', color: '#7F1D1D', icon: 'FileSearch', scope: 'INSTITUCIONAL' },
  { slug: 'pessoal', name: 'Pessoal', color: '#475569', icon: 'User', scope: 'PESSOAL' },
  { slug: 'outros', name: 'Outros', color: '#64748B', icon: 'Tag', scope: 'INSTITUCIONAL' },
];

export const REMINDER_OFFSET_PRESETS: Array<{ label: string; minutes: number }> = [
  { label: 'No horário', minutes: 0 },
  { label: '5 minutos antes', minutes: 5 },
  { label: '10 minutos antes', minutes: 10 },
  { label: '15 minutos antes', minutes: 15 },
  { label: '30 minutos antes', minutes: 30 },
  { label: '1 hora antes', minutes: 60 },
  { label: '2 horas antes', minutes: 120 },
  { label: '1 dia antes', minutes: 1_440 },
  { label: '2 dias antes', minutes: 2_880 },
  { label: '3 dias antes', minutes: 4_320 },
  { label: '7 dias antes', minutes: 10_080 },
  { label: '15 dias antes', minutes: 21_600 },
  { label: '30 dias antes', minutes: 43_200 },
  { label: '60 dias antes', minutes: 86_400 },
  { label: '90 dias antes', minutes: 129_600 },
];
