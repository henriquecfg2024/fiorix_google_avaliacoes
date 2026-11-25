'use client';

import {
  Briefcase,
  Calendar,
  Cpu,
  FileSearch,
  GraduationCap,
  HeartHandshake,
  Scale,
  ShieldAlert,
  Tag,
  User,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { AgendaPriority, AgendaRecurrenceType, AgendaStatus, AgendaVisibility } from '@/lib/agenda/types';

const ICON_MAP: Record<string, LucideIcon> = {
  Briefcase,
  Users,
  Cpu,
  ShieldAlert,
  HeartHandshake,
  Scale,
  GraduationCap,
  Wrench,
  Wallet,
  FileSearch,
  User,
  Tag,
  Calendar,
};

export function AgendaCategoryIcon({
  iconName,
  className = 'h-4 w-4',
}: {
  iconName?: string | null;
  className?: string;
}) {
  const Icon = (iconName && ICON_MAP[iconName]) || Calendar;
  return <Icon className={className} />;
}

export const PRIORITY_LABEL: Record<AgendaPriority, string> = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  CRITICA: 'Crítica',
};

export const STATUS_LABEL: Record<AgendaStatus, string> = {
  AGENDADO: 'Agendado',
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
  REAGENDADO: 'Reagendado',
  CANCELADO: 'Cancelado',
  ATRASADO: 'Atrasado',
};

export const VISIBILITY_LABEL: Record<AgendaVisibility, string> = {
  INDIVIDUAL: 'Individual (Privado)',
  COMPARTILHADO: 'Compartilhado',
  SETORIAL: 'Setorial',
  INSTITUCIONAL: 'Institucional',
};

export const RECURRENCE_LABEL: Record<AgendaRecurrenceType, string> = {
  UNICO: 'Único',
  DIARIO: 'Diário',
  SEMANAL: 'Semanal',
  QUINZENAL: 'Quinzenal',
  MENSAL: 'Mensal',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
  PERSONALIZADO: 'Personalizado',
};
