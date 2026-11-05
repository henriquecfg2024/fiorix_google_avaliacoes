"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Search,
  Download,
  Check,
  Laptop,
  Inbox,
  RefreshCw,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  SlidersHorizontal,
  FileText,
  BarChart3,
  Layers,
  Users,
  ArrowRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Printer,
  X,
  Clock,
  Activity,
} from "lucide-react";
import { toast } from "sonner";
import { FiorixSkeleton } from "@/components/fiorix/FiorixSkeleton";
import {
  ProdutividadeEquipePanel,
  type ProdutividadeRegistro,
} from "@/components/bi/ProdutividadeEquipePanel";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÕES DE REGRAS DE NEGÓCIO E CLASSIFICAÇÃO DE CANAL
// ─────────────────────────────────────────────────────────────────────────────

const CAIXAS_DIGITAIS = ["eProtocolo", "GuilhermeM", "Rafael", "Intimação", "Intimacao"];

const normalizeNome = (valor: string) =>
  (valor || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isDigital = (nome: string) =>
  CAIXAS_DIGITAIS.some((item) => normalizeNome(nome).includes(normalizeNome(item)));

type CanalFiltro = "todos" | "digital" | "presencial";
type AbaNavegacao = "visao_geral" | "produtividade" | "servicos";

export interface FiltroHorario {
  dia: string | null; // "Seg", "Ter", etc. ou null para todas as faixas do horário
  hora: number;       // 8, 9, 10, ... 17
  count?: number;
}

// Dia da semana indexado por Date#getUTCDay() (0 = domingo)
const DIA_KEYS_POR_DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Fallback textual quando a DATA não estiver disponível (aceita português e inglês)
const DIA_ALIASES: Array<[string, string]> = [
  ["segunda", "Seg"],
  ["monday", "Seg"],
  ["terca", "Ter"],
  ["tuesday", "Ter"],
  ["quarta", "Qua"],
  ["wednesday", "Qua"],
  ["quinta", "Qui"],
  ["thursday", "Qui"],
  ["sexta", "Sex"],
  ["friday", "Sex"],
  ["sabado", "Sáb"],
  ["saturday", "Sáb"],
  ["domingo", "Dom"],
  ["sunday", "Dom"],
];

const DIAS_NOMES: Record<string, string> = {
  Seg: "Segunda-feira",
  Ter: "Terça-feira",
  Qua: "Quarta-feira",
  Qui: "Quinta-feira",
  Sex: "Sexta-feira",
  Sáb: "Sábado",
  Dom: "Domingo",
};

interface RawProdutividadeRow {
  [key: string]: unknown;
  DATA?: string;
  HORA_NUM?: number;
  DIA_SEMANA?: string;
  HORA?: string;
  PEDIDO?: string;
  NOME?: string;
  TIPO?: string;
  TIPO_PEDIDO?: string;
  TIPO_DETALHADO?: string;
  QUANTIDADE?: number;
}

interface ServicoItem {
  id: string;
  numero: string;
  dataHora: string;
  data: string;
  hora: string;
  diaSemana?: string;
  colaborador: string;
  canal: "Digital ONR" | "Presencial";
  tipo: "TÍTULO" | "CERTIDÃO";
  tipoServico: string;
  tipoDetalhado: string;
}

// Registro pronto para filtros: dia/hora resolvidos e quantidade numérica
interface RegistroNormalizado extends ServicoItem {
  horaNum: number;
  diaKey: string | null;
  quantidade: number;
}

// Opções de paginação e ordenação por coluna — Padrão FIORIX
type ColunaOrdenacao = "dataHora" | "numero" | "colaborador" | "canal" | "tipoDetalhado";

const ROTULO_COLUNA_ORDEM: Record<ColunaOrdenacao, string> = {
  dataHora: "Data / Hora",
  numero: "Serviço",
  colaborador: "Colaborador",
  canal: "Canal",
  tipoDetalhado: "Tipo / Detalhe",
};

const OPCOES_ITENS_PAGINA = [10, 25, 50] as const;

const escapeHtml = (valor: string) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ─────────────────────────────────────────────────────────────────────────────
// DADOS DE BENCHMARK ILUSTRATIVO (REFERÊNCIA DE ALTA FIDELIDADE)
// ─────────────────────────────────────────────────────────────────────────────

const BENCHMARK_SERVICOS: ServicoItem[] = [
  // 08h
  {
    id: "1",
    numero: "67301",
    dataHora: "13/10 · 08:24",
    data: "2026-10-13",
    hora: "08:24",
    diaSemana: "Sex",
    colaborador: "Gabriel",
    canal: "Digital ONR",
    tipo: "TÍTULO",
    tipoServico: "PRENOTADO",
    tipoDetalhado: "Depósito de títulos ONR",
  },
  {
    id: "2",
    numero: "67302",
    dataHora: "13/10 · 08:45",
    data: "2026-10-13",
    hora: "08:45",
    diaSemana: "Sex",
    colaborador: "Mariana",
    canal: "Presencial",
    tipo: "CERTIDÃO",
    tipoServico: "Certidão Presencial",
    tipoDetalhado: "Consulta de Matrícula balcão",
  },
  // 09h
  {
    id: "3",
    numero: "67320",
    dataHora: "13/10 · 09:15",
    data: "2026-10-13",
    hora: "09:15",
    diaSemana: "Sex",
    colaborador: "Antônio",
    canal: "Digital ONR",
    tipo: "CERTIDÃO",
    tipoServico: "Consulta eletrônica (VM)",
    tipoDetalhado: "Depósito de certidões ONR",
  },
  {
    id: "4",
    numero: "67338",
    dataHora: "13/10 · 09:50",
    data: "2026-10-13",
    hora: "09:50",
    diaSemana: "Sex",
    colaborador: "Juliana",
    canal: "Presencial",
    tipo: "TÍTULO",
    tipoServico: "PRENOTADO",
    tipoDetalhado: "Complemento de depósito balcão",
  },
  // 10h
  {
    id: "5",
    numero: "67345",
    dataHora: "13/10 · 10:18",
    data: "2026-10-13",
    hora: "10:18",
    diaSemana: "Sex",
    colaborador: "eProtocolo",
    canal: "Digital ONR",
    tipo: "TÍTULO",
    tipoServico: "PRENOTADO",
    tipoDetalhado: "Depósito de títulos ONR",
  },
  {
    id: "6",
    numero: "67351",
    dataHora: "13/10 · 10:40",
    data: "2026-10-13",
    hora: "10:40",
    diaSemana: "Sex",
    colaborador: "Carlos",
    canal: "Presencial",
    tipo: "CERTIDÃO",
    tipoServico: "Certidão Presencial",
    tipoDetalhado: "Certidão Vinteanária Balcão",
  },
  // 11h
  {
    id: "7",
    numero: "67364",
    dataHora: "13/10 · 11:15",
    data: "2026-10-13",
    hora: "11:15",
    diaSemana: "Sex",
    colaborador: "Mariana",
    canal: "Presencial",
    tipo: "TÍTULO",
    tipoServico: "PRENOTADO",
    tipoDetalhado: "Depósito de títulos balcão",
  },
  {
    id: "8",
    numero: "67375",
    dataHora: "13/10 · 11:42",
    data: "2026-10-13",
    hora: "11:42",
    diaSemana: "Sex",
    colaborador: "Gabriel",
    canal: "Digital ONR",
    tipo: "CERTIDÃO",
    tipoServico: "Consulta eletrônica (VM)",
    tipoDetalhado: "Certidão digital de matrícula",
  },
  // 12h (Pico)
  {
    id: "9",
    numero: "67382",
    dataHora: "13/10 · 12:53",
    data: "2026-10-13",
    hora: "12:53",
    diaSemana: "Sex",
    colaborador: "eProtocolo",
    canal: "Digital ONR",
    tipo: "TÍTULO",
    tipoServico: "PRENOTADO",
    tipoDetalhado: "Depósito de títulos ONR",
  },
  {
    id: "10",
    numero: "67384",
    dataHora: "13/10 · 12:35",
    data: "2026-10-13",
    hora: "12:35",
    diaSemana: "Sex",
    colaborador: "Fernanda",
    canal: "Presencial",
    tipo: "CERTIDÃO",
    tipoServico: "Certidão Presencial",
    tipoDetalhado: "Certidão de Breve Relato",
  },
  {
    id: "11",
    numero: "67388",
    dataHora: "13/10 · 12:15",
    data: "2026-10-13",
    hora: "12:15",
    diaSemana: "Sex",
    colaborador: "Vinícius",
    canal: "Digital ONR",
    tipo: "CERTIDÃO",
    tipoServico: "Consulta eletrônica (VM)",
    tipoDetalhado: "Consulta eletrônica (VM)",
  },
  // 13h
  {
    id: "12",
    numero: "67390",
    dataHora: "13/10 · 13:45",
    data: "2026-10-13",
    hora: "13:45",
    diaSemana: "Sex",
    colaborador: "Fernanda",
    canal: "Presencial",
    tipo: "CERTIDÃO",
    tipoServico: "Certidão Presencial",
    tipoDetalhado: "Consulta de Matrícula balcão",
  },
  {
    id: "13",
    numero: "67395",
    dataHora: "13/10 · 13:15",
    data: "2026-10-13",
    hora: "13:15",
    diaSemana: "Sex",
    colaborador: "Antônio",
    canal: "Digital ONR",
    tipo: "TÍTULO",
    tipoServico: "PRENOTADO",
    tipoDetalhado: "Complemento de depósito ONR",
  },
  // 14h
  {
    id: "14",
    numero: "67402",
    dataHora: "13/10 · 14:10",
    data: "2026-10-13",
    hora: "14:10",
    diaSemana: "Sex",
    colaborador: "GuilhermeM",
    canal: "Digital ONR",
    tipo: "TÍTULO",
    tipoServico: "PRENOTADO",
    tipoDetalhado: "Complemento de depósito ONR",
  },
  {
    id: "15",
    numero: "67415",
    dataHora: "13/10 · 14:55",
    data: "2026-10-13",
    hora: "14:55",
    diaSemana: "Sex",
    colaborador: "Carlos",
    canal: "Presencial",
    tipo: "TÍTULO",
    tipoServico: "PRENOTADO",
    tipoDetalhado: "Depósito de títulos balcão",
  },
  // 15h
  {
    id: "16",
    numero: "67420",
    dataHora: "13/10 · 15:32",
    data: "2026-10-13",
    hora: "15:32",
    diaSemana: "Sex",
    colaborador: "Mariana",
    canal: "Presencial",
    tipo: "CERTIDÃO",
    tipoServico: "Certidão Presencial",
    tipoDetalhado: "Certidão de Breve Relato",
  },
  {
    id: "17",
    numero: "67428",
    dataHora: "13/10 · 15:48",
    data: "2026-10-13",
    hora: "15:48",
    diaSemana: "Sex",
    colaborador: "eProtocolo",
    canal: "Digital ONR",
    tipo: "TÍTULO",
    tipoServico: "PRENOTADO",
    tipoDetalhado: "Depósito de títulos ONR",
  },
  // 16h
  {
    id: "18",
    numero: "67435",
    dataHora: "13/10 · 16:13",
    data: "2026-10-13",
    hora: "16:13",
    diaSemana: "Sex",
    colaborador: "Rafael",
    canal: "Digital ONR",
    tipo: "CERTIDÃO",
    tipoServico: "Consulta eletrônica (VM)",
    tipoDetalhado: "Consulta eletrônica (VM)",
  },
  {
    id: "19",
    numero: "67437",
    dataHora: "13/10 · 16:19",
    data: "2026-10-13",
    hora: "16:19",
    diaSemana: "Sex",
    colaborador: "Antônio",
    canal: "Digital ONR",
    tipo: "TÍTULO",
    tipoServico: "PRENOTADO",
    tipoDetalhado: "Complemento de depósito ONR",
  },
  {
    id: "20",
    numero: "67439",
    dataHora: "13/10 · 16:22",
    data: "2026-10-13",
    hora: "16:22",
    diaSemana: "Sex",
    colaborador: "Vinícius",
    canal: "Digital ONR",
    tipo: "CERTIDÃO",
    tipoServico: "Consulta eletrônica (VM)",
    tipoDetalhado: "Depósito de certidões ONR",
  },
  {
    id: "21",
    numero: "67440",
    dataHora: "13/10 · 16:29",
    data: "2026-10-13",
    hora: "16:29",
    diaSemana: "Sex",
    colaborador: "Gabriel",
    canal: "Digital ONR",
    tipo: "TÍTULO",
    tipoServico: "PRENOTADO",
    tipoDetalhado: "Depósito de títulos ONR",
  },
  // 17h
  {
    id: "22",
    numero: "67445",
    dataHora: "13/10 · 17:08",
    data: "2026-10-13",
    hora: "17:08",
    diaSemana: "Sex",
    colaborador: "Rafael",
    canal: "Digital ONR",
    tipo: "CERTIDÃO",
    tipoServico: "Consulta eletrônica (VM)",
    tipoDetalhado: "Certidão digital de matrícula",
  },
  {
    id: "23",
    numero: "67448",
    dataHora: "13/10 · 17:25",
    data: "2026-10-13",
    hora: "17:25",
    diaSemana: "Sex",
    colaborador: "Carlos",
    canal: "Presencial",
    tipo: "TÍTULO",
    tipoServico: "PRENOTADO",
    tipoDetalhado: "Complemento de depósito balcão",
  },
];

const DIAS_HEATMAP = [
  { key: "Seg", label: "Seg" },
  { key: "Ter", label: "Ter" },
  { key: "Qua", label: "Qua" },
  { key: "Qui", label: "Qui" },
  { key: "Sex", label: "Sex" },
  { key: "Sáb", label: "Sáb" },
  { key: "Dom", label: "Dom" },
];

const HORAS_HEATMAP = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

type MatrizHeatmap = Record<string, Record<number, { level: number; count: number }>>;

const MATRIZ_TODOS: MatrizHeatmap = {
  Seg: { 8: { level: 1, count: 12 }, 9: { level: 1, count: 18 }, 10: { level: 1, count: 42 }, 11: { level: 2, count: 110 }, 12: { level: 3, count: 185 }, 13: { level: 2, count: 95 }, 14: { level: 1, count: 40 }, 15: { level: 1, count: 20 }, 16: { level: 1, count: 15 }, 17: { level: 1, count: 8 } },
  Ter: { 8: { level: 1, count: 14 }, 9: { level: 1, count: 22 }, 10: { level: 1, count: 45 }, 11: { level: 2, count: 118 }, 12: { level: 3, count: 192 }, 13: { level: 2, count: 98 }, 14: { level: 1, count: 44 }, 15: { level: 1, count: 25 }, 16: { level: 1, count: 12 }, 17: { level: 1, count: 6 } },
  Qua: { 8: { level: 1, count: 15 }, 9: { level: 1, count: 19 }, 10: { level: 1, count: 50 }, 11: { level: 3, count: 125 }, 12: { level: 3, count: 205 }, 13: { level: 2, count: 102 }, 14: { level: 1, count: 48 }, 15: { level: 1, count: 28 }, 16: { level: 1, count: 18 }, 17: { level: 1, count: 9 } },
  Qui: { 8: { level: 1, count: 16 }, 9: { level: 1, count: 24 }, 10: { level: 1, count: 52 }, 11: { level: 3, count: 130 }, 12: { level: 3, count: 210 }, 13: { level: 2, count: 105 }, 14: { level: 1, count: 50 }, 15: { level: 1, count: 30 }, 16: { level: 1, count: 19 }, 17: { level: 1, count: 11 } },
  Sex: { 8: { level: 1, count: 18 }, 9: { level: 1, count: 30 }, 10: { level: 2, count: 65 }, 11: { level: 3, count: 145 }, 12: { level: 4, count: 260 }, 13: { level: 3, count: 120 }, 14: { level: 2, count: 55 }, 15: { level: 1, count: 32 }, 16: { level: 1, count: 22 }, 17: { level: 1, count: 14 } },
  Sáb: { 8: { level: 0, count: 0 }, 9: { level: 0, count: 0 }, 10: { level: 0, count: 0 }, 11: { level: 0, count: 0 }, 12: { level: 0, count: 0 }, 13: { level: 0, count: 0 }, 14: { level: 0, count: 0 }, 15: { level: 0, count: 0 }, 16: { level: 0, count: 0 }, 17: { level: 0, count: 0 } },
  Dom: { 8: { level: 0, count: 0 }, 9: { level: 0, count: 0 }, 10: { level: 0, count: 0 }, 11: { level: 0, count: 0 }, 12: { level: 0, count: 0 }, 13: { level: 0, count: 0 }, 14: { level: 0, count: 0 }, 15: { level: 0, count: 0 }, 16: { level: 0, count: 0 }, 17: { level: 0, count: 0 } },
};

const MATRIZ_DIGITAL: MatrizHeatmap = {
  Seg: { 8: { level: 1, count: 10 }, 9: { level: 1, count: 12 }, 10: { level: 1, count: 32 }, 11: { level: 2, count: 85 }, 12: { level: 3, count: 145 }, 13: { level: 2, count: 70 }, 14: { level: 1, count: 28 }, 15: { level: 1, count: 14 }, 16: { level: 1, count: 10 }, 17: { level: 1, count: 6 } },
  Ter: { 8: { level: 1, count: 11 }, 9: { level: 1, count: 15 }, 10: { level: 1, count: 35 }, 11: { level: 2, count: 90 }, 12: { level: 3, count: 150 }, 13: { level: 2, count: 72 }, 14: { level: 1, count: 30 }, 15: { level: 1, count: 18 }, 16: { level: 1, count: 8 }, 17: { level: 1, count: 4 } },
  Qua: { 8: { level: 1, count: 12 }, 9: { level: 1, count: 14 }, 10: { level: 1, count: 38 }, 11: { level: 2, count: 95 }, 12: { level: 3, count: 160 }, 13: { level: 2, count: 76 }, 14: { level: 1, count: 32 }, 15: { level: 1, count: 20 }, 16: { level: 1, count: 12 }, 17: { level: 1, count: 7 } },
  Qui: { 8: { level: 1, count: 13 }, 9: { level: 1, count: 16 }, 10: { level: 1, count: 40 }, 11: { level: 2, count: 98 }, 12: { level: 3, count: 165 }, 13: { level: 2, count: 78 }, 14: { level: 1, count: 34 }, 15: { level: 1, count: 22 }, 16: { level: 1, count: 14 }, 17: { level: 1, count: 8 } },
  Sex: { 8: { level: 1, count: 14 }, 9: { level: 1, count: 20 }, 10: { level: 1, count: 48 }, 11: { level: 3, count: 110 }, 12: { level: 4, count: 185 }, 13: { level: 2, count: 92 }, 14: { level: 1, count: 38 }, 15: { level: 1, count: 24 }, 16: { level: 1, count: 16 }, 17: { level: 1, count: 10 } },
  Sáb: { 8: { level: 0, count: 0 }, 9: { level: 0, count: 0 }, 10: { level: 0, count: 0 }, 11: { level: 0, count: 0 }, 12: { level: 0, count: 0 }, 13: { level: 0, count: 0 }, 14: { level: 0, count: 0 }, 15: { level: 0, count: 0 }, 16: { level: 0, count: 0 }, 17: { level: 0, count: 0 } },
  Dom: { 8: { level: 0, count: 0 }, 9: { level: 0, count: 0 }, 10: { level: 0, count: 0 }, 11: { level: 0, count: 0 }, 12: { level: 0, count: 0 }, 13: { level: 0, count: 0 }, 14: { level: 0, count: 0 }, 15: { level: 0, count: 0 }, 16: { level: 0, count: 0 }, 17: { level: 0, count: 0 } },
};

const MATRIZ_PRESENCIAL: MatrizHeatmap = {
  Seg: { 8: { level: 1, count: 2 }, 9: { level: 1, count: 6 }, 10: { level: 1, count: 10 }, 11: { level: 2, count: 25 }, 12: { level: 2, count: 40 }, 13: { level: 2, count: 25 }, 14: { level: 1, count: 12 }, 15: { level: 1, count: 6 }, 16: { level: 1, count: 5 }, 17: { level: 1, count: 2 } },
  Ter: { 8: { level: 1, count: 3 }, 9: { level: 1, count: 7 }, 10: { level: 1, count: 10 }, 11: { level: 2, count: 28 }, 12: { level: 2, count: 42 }, 13: { level: 2, count: 26 }, 14: { level: 1, count: 14 }, 15: { level: 1, count: 7 }, 16: { level: 1, count: 4 }, 17: { level: 1, count: 2 } },
  Qua: { 8: { level: 1, count: 3 }, 9: { level: 1, count: 5 }, 10: { level: 1, count: 12 }, 11: { level: 2, count: 30 }, 12: { level: 3, count: 45 }, 13: { level: 2, count: 26 }, 14: { level: 1, count: 16 }, 15: { level: 1, count: 8 }, 16: { level: 1, count: 6 }, 17: { level: 1, count: 2 } },
  Qui: { 8: { level: 1, count: 3 }, 9: { level: 1, count: 8 }, 10: { level: 1, count: 12 }, 11: { level: 2, count: 32 }, 12: { level: 3, count: 45 }, 13: { level: 2, count: 27 }, 14: { level: 1, count: 16 }, 15: { level: 1, count: 8 }, 16: { level: 1, count: 5 }, 17: { level: 1, count: 3 } },
  Sex: { 8: { level: 1, count: 4 }, 9: { level: 1, count: 10 }, 10: { level: 1, count: 17 }, 11: { level: 4, count: 75 }, 12: { level: 3, count: 55 }, 13: { level: 2, count: 28 }, 14: { level: 1, count: 17 }, 15: { level: 1, count: 8 }, 16: { level: 1, count: 6 }, 17: { level: 1, count: 4 } },
  Sáb: { 8: { level: 0, count: 0 }, 9: { level: 0, count: 0 }, 10: { level: 0, count: 0 }, 11: { level: 0, count: 0 }, 12: { level: 0, count: 0 }, 13: { level: 0, count: 0 }, 14: { level: 0, count: 0 }, 15: { level: 0, count: 0 }, 16: { level: 0, count: 0 }, 17: { level: 0, count: 0 } },
  Dom: { 8: { level: 0, count: 0 }, 9: { level: 0, count: 0 }, 10: { level: 0, count: 0 }, 11: { level: 0, count: 0 }, 12: { level: 0, count: 0 }, 13: { level: 0, count: 0 }, 14: { level: 0, count: 0 }, 15: { level: 0, count: 0 }, 16: { level: 0, count: 0 }, 17: { level: 0, count: 0 } },
};

const DESTAQUES_BENCHMARK = {
  todos: {
    pico: { titulo: "Sexta-feira · 12h53", detalhe: "260 autenticações no pico · Geral", badge: "Pico geral na sexta" },
    usuario: { nome: "eProtocolo", detalhe: "2.534 autenticações · 38% do total", rotulo: "CANAL DIGITAL ONR" },
    servico: { nome: "Consulta eletrônica (VM)", detalhe: "2.510 autenticações · 37% do total", rotulo: "CERTIDÃO DIGITAL" },
  },
  digital: {
    pico: { titulo: "Sexta-feira · 12h53", detalhe: "185 autenticações no pico · ONR Digital", badge: "Pico digital às 12h53" },
    usuario: { nome: "eProtocolo", detalhe: "2.534 autenticações · 55,7% do canal", rotulo: "INTEGRAÇÃO ONR" },
    servico: { nome: "Consulta eletrônica (VM)", detalhe: "2.510 autenticações · 55,2% do canal", rotulo: "CERTIDÃO DIGITAL" },
  },
  presencial: {
    pico: { titulo: "Sexta-feira · 11h15", detalhe: "75 atendimentos no pico · Balcão presencial", badge: "Pico presencial às 11h15" },
    usuario: { nome: "Mariana", detalhe: "842 atendimentos · 38,7% do balcão", rotulo: "ATENDENTE DE BALCÃO" },
    servico: { nome: "Depósito de títulos balcão", detalhe: "920 atendimentos · 42,3% do balcão", rotulo: "TÍTULO PRESENCIAL" },
  },
};

const ANDAMENTOS_BENCHMARK = {
  todos: [
    { nome: "Consulta eletrônica (VM)", volume: "2.510", pct: "37,3%", barPct: "100%" },
    { nome: "Depósito de títulos", volume: "2.031", pct: "30,2%", barPct: "81%" },
    { nome: "Outros serviços", volume: "1.327", pct: "19,7%", barPct: "53%" },
    { nome: "Complemento de depósito", volume: "854", pct: "12,7%", barPct: "34%" },
  ],
  digital: [
    { nome: "Consulta eletrônica (VM)", volume: "2.510", pct: "55,2%", barPct: "100%" },
    { nome: "Depósito de títulos ONR", volume: "1.250", pct: "27,5%", barPct: "50%" },
    { nome: "Complemento de depósito ONR", volume: "580", pct: "12,8%", barPct: "23%" },
    { nome: "Outros serviços digitais", volume: "209", pct: "4,6%", barPct: "9%" },
  ],
  presencial: [
    { nome: "Depósito de títulos balcão", volume: "920", pct: "42,3%", barPct: "100%" },
    { nome: "Certidão de Breve Relato", volume: "640", pct: "29,4%", barPct: "70%" },
    { nome: "Consulta de Matrícula balcão", volume: "339", pct: "15,6%", barPct: "37%" },
    { nome: "Complemento de depósito balcão", volume: "274", pct: "12,6%", barPct: "30%" },
  ],
};

const VOLUMES_BENCHMARK = {
  todos: { certidoes: "3.240", titulos: "3.482" },
  digital: { certidoes: "2.510", titulos: "2.039" },
  presencial: { certidoes: "730", titulos: "1.443" },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE NORMALIZAÇÃO E AGREGAÇÃO DOS DADOS REAIS
// ─────────────────────────────────────────────────────────────────────────────

const formatarPct = (parte: number, total: number) =>
  total > 0 ? `${((parte / total) * 100).toFixed(1).replace(".", ",")}%` : "0%";

const formatarDataCurta = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};

/** Dia da semana pela data civil (YYYY-MM-DD do banco, já no calendário de São Paulo); o texto é só fallback. */
const resolverDiaKey = (data: string, diaSemana: unknown): string | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  if (m) {
    const dow = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
    return DIA_KEYS_POR_DOW[dow] ?? null;
  }
  const texto = normalizeNome(String(diaSemana ?? ""));
  if (!texto) return null;
  for (const [alias, key] of DIA_ALIASES) {
    if (texto.includes(alias)) return key;
  }
  return null;
};

const resolverHora = (r: RawProdutividadeRow): number => {
  if (r.HORA_NUM !== undefined && r.HORA_NUM !== null) {
    const n = Number(r.HORA_NUM);
    if (Number.isFinite(n)) return n;
  }
  const m = /(\d{1,2}):(\d{2})/.exec(String(r.HORA ?? ""));
  return m ? Number(m[1]) : -1;
};

const normalizarRegistro = (r: RawProdutividadeRow, idx: number): RegistroNormalizado => {
  const nome = String(r.NOME || "").trim() || "Não informado";
  const canalDigital = isDigital(nome);
  const data = r.DATA ? String(r.DATA).slice(0, 10) : "";
  const horaNum = resolverHora(r);
  const horaMatch = /(\d{1,2}):(\d{2})/.exec(String(r.HORA ?? ""));
  const hora = horaMatch
    ? `${horaMatch[1].padStart(2, "0")}:${horaMatch[2]}`
    : horaNum >= 0
    ? `${String(horaNum).padStart(2, "0")}:00`
    : "--:--";
  const dataFormatada = data ? `${data.slice(8, 10)}/${data.slice(5, 7)}` : "--/--";

  return {
    id: String(idx + 1),
    numero: String(r.PEDIDO ?? "").replace(/^#/, "").trim() || "—",
    dataHora: `${dataFormatada} · ${hora}`,
    data,
    hora,
    horaNum,
    diaKey: resolverDiaKey(data, r.DIA_SEMANA),
    diaSemana: undefined,
    colaborador: nome,
    canal: canalDigital ? "Digital ONR" : "Presencial",
    tipo: String(r.TIPO || "").toUpperCase() === "CERTIDÃO" ? "CERTIDÃO" : "TÍTULO",
    tipoServico: String(r.TIPO_PEDIDO || (canalDigital ? "Digital ONR" : "Presencial")),
    tipoDetalhado: String(r.TIPO_DETALHADO || r.TIPO_PEDIDO || "Serviço cartorário"),
    quantidade: Number(r.QUANTIDADE) > 0 ? Number(r.QUANTIDADE) : 1,
  };
};

const pertenceAoCanal = (canal: RegistroNormalizado["canal"], filtro: CanalFiltro) =>
  filtro === "todos" || (filtro === "digital" ? canal === "Digital ONR" : canal === "Presencial");

const somarQuantidade = (lista: RegistroNormalizado[]) =>
  lista.reduce((acc, r) => acc + r.quantidade, 0);

const somarTotais = (lista: RegistroNormalizado[]) => {
  let digital = 0;
  let presencial = 0;
  lista.forEach((r) => {
    if (r.canal === "Digital ONR") digital += r.quantidade;
    else presencial += r.quantidade;
  });
  const total = digital + presencial;
  return {
    total,
    digital,
    presencial,
    digitalPct: formatarPct(digital, total),
    presencialPct: formatarPct(presencial, total),
  };
};

/** Agrupa somando quantidades e ordena do maior para o menor. */
const agruparOrdenado = (
  lista: RegistroNormalizado[],
  chaveDe: (r: RegistroNormalizado) => string
) => {
  const grupos = new Map<string, { chave: string; total: number; amostra: RegistroNormalizado }>();
  lista.forEach((r) => {
    const chave = chaveDe(r);
    const atual = grupos.get(chave);
    if (atual) atual.total += r.quantidade;
    else grupos.set(chave, { chave, total: r.quantidade, amostra: r });
  });
  return Array.from(grupos.values()).sort((a, b) => b.total - a.total);
};

/** Dia/hora com maior volume (considera todos os horários registrados). */
const encontrarPico = (lista: RegistroNormalizado[]) => {
  const contagem = new Map<string, { diaKey: string; hora: number; count: number }>();
  lista.forEach((r) => {
    if (!r.diaKey || r.horaNum < 0) return;
    const chave = `${r.diaKey}|${r.horaNum}`;
    const atual = contagem.get(chave);
    if (atual) atual.count += r.quantidade;
    else contagem.set(chave, { diaKey: r.diaKey, hora: r.horaNum, count: r.quantidade });
  });
  let pico: { diaKey: string; hora: number; count: number } | null = null;
  contagem.forEach((c) => {
    if (!pico || c.count > pico.count) pico = c;
  });
  return pico as { diaKey: string; hora: number; count: number } | null;
};

/** Matriz real do heatmap (dias x 8h–17h) com níveis relativos ao maior valor. */
const montarMatrizReal = (lista: RegistroNormalizado[]) => {
  const matriz: MatrizHeatmap = {};
  DIAS_HEATMAP.forEach((d) => {
    matriz[d.key] = {};
    HORAS_HEATMAP.forEach((h) => {
      matriz[d.key][h] = { level: 0, count: 0 };
    });
  });

  let fora = 0;
  lista.forEach((r) => {
    const cell = r.diaKey ? matriz[r.diaKey]?.[r.horaNum] : undefined;
    if (cell) cell.count += r.quantidade;
    else fora += r.quantidade;
  });

  const celulas = Object.values(matriz).flatMap((linha) => Object.values(linha));
  const max = Math.max(0, ...celulas.map((c) => c.count));
  celulas.forEach((c) => {
    if (c.count === 0) c.level = 0;
    else if (c.count === max) c.level = 4;
    else {
      const razao = c.count / max;
      c.level = razao >= 0.6 ? 3 : razao >= 0.3 ? 2 : 1;
    }
  });

  return { matrizHeatmapAtiva: matriz, entradasForaDoMapa: fora };
};

// Geometria do gráfico "Volume ao longo do dia" (viewBox 500 x 120)
const CURVA_X0 = 30;
const CURVA_X1 = 490;
const CURVA_Y_BASE = 100;
const CURVA_ALTURA = 90;
const xDaHora = (indice: number, total: number) =>
  CURVA_X0 + (indice * (CURVA_X1 - CURVA_X0)) / Math.max(1, total - 1);

const montarCurva = (valores: number[], max: number) => {
  const pontos = valores.map((v, i) => [xDaHora(i, valores.length), CURVA_Y_BASE - (v / max) * CURVA_ALTURA]);
  let linha = `M ${pontos[0][0].toFixed(1)} ${pontos[0][1].toFixed(1)}`;
  for (let i = 1; i < pontos.length; i++) {
    const [x0, y0] = pontos[i - 1];
    const [x1, y1] = pontos[i];
    const xm = ((x0 + x1) / 2).toFixed(1);
    linha += ` C ${xm} ${y0.toFixed(1)}, ${xm} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return { linha, area: `${linha} L ${CURVA_X1} ${CURVA_Y_BASE} L ${CURVA_X0} ${CURVA_Y_BASE} Z` };
};

export default function ProdutividadePage() {
  // Estados da página
  const [activeTab, setActiveTab] = useState<AbaNavegacao>("visao_geral");
  const [filtroCanal, setFiltroCanal] = useState<CanalFiltro>("digital"); // Inicia em Digital ONR
  const [filtroHorario, setFiltroHorario] = useState<FiltroHorario | null>(null); // Filtro clicável no Heatmap
  // Período preenchido a partir dos dados (mês da data mais recente); vazio = sem limite
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [buscaTabela, setBuscaTabela] = useState("");
  const [isMaisFiltrosOpen, setIsMaisFiltrosOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroColaborador, setFiltroColaborador] = useState("TODOS");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbRows, setDbRows] = useState<RawProdutividadeRow[]>([]);
  const [sortBy, setSortBy] = useState<ColunaOrdenacao>("dataHora");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState<number>(10);
  const [menuImprimirAberto, setMenuImprimirAberto] = useState(false);
  const printMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setPaginaAtual(1);
  }, [
    activeTab,
    filtroCanal,
    filtroHorario,
    startDate,
    endDate,
    filtroTipo,
    filtroColaborador,
    buscaTabela,
    sortBy,
    sortOrder,
    itensPorPagina,
  ]);

  useEffect(() => {
    if (!menuImprimirAberto) return;
    const handleClickFora = (event: MouseEvent) => {
      if (printMenuRef.current && !printMenuRef.current.contains(event.target as Node)) {
        setMenuImprimirAberto(false);
      }
    };
    document.addEventListener("mousedown", handleClickFora);
    return () => document.removeEventListener("mousedown", handleClickFora);
  }, [menuImprimirAberto]);

  // Carregar dados reais da API
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const dataRes = await fetch("/api/bi/produtividade/data");
      if (!dataRes.ok) throw new Error(`HTTP ${dataRes.status}`);

      const result = await dataRes.json();
      if (result.success && Array.isArray(result.data)) {
        const validRows = result.data.filter(Boolean) as RawProdutividadeRow[];
        setDbRows(validRows);

        if (validRows.length > 0) {
          const latestDate = validRows[0]?.DATA;
          if (latestDate && typeof latestDate === "string") {
            const [year, month] = latestDate.split("-");
            setStartDate((prev) => prev || `${year}-${month}-01`);
            setEndDate((prev) => prev || latestDate);
          }
        }
      } else {
        setDbRows([]);
      }
    } catch (error) {
      console.warn("Utilizando dataset padrão ilustrativo da Recepção:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    toast.info("Atualizando dados da Recepção...");
    await fetchData();
    setTimeout(() => {
      setIsRefreshing(false);
      toast.success("Indicadores atualizados com sucesso!");
    }, 500);
  };

  // Manipulador de clique nos cards de canal com notificação interativa
  const handleSelecionarCanal = (novoCanal: CanalFiltro) => {
    setFiltroCanal(novoCanal);
    const rotulos = {
      todos: "Todos os serviços consolidados",
      digital: "Canal Digital ONR",
      presencial: "Canal Balcão Presencial",
    };
    toast.success(`Filtro inteligente aplicado: ${rotulos[novoCanal]}`);
  };

  // Limpar filtros secundários
  const handleLimparFiltros = () => {
    setFiltroTipo("TODOS");
    setFiltroColaborador("TODOS");
    setBuscaTabela("");
    setFiltroHorario(null);
    toast.success("Filtros complementares restaurados.");
  };

  // Totais computados (reais se disponíveis no banco ou benchmark ilustrativo)
  const hasRealData = dbRows.length > 0;

  // Registros normalizados: dia da semana derivado da DATA, hora numérica e canal resolvidos uma única vez
  const registrosBase: RegistroNormalizado[] = useMemo(() => {
    if (!hasRealData) {
      return BENCHMARK_SERVICOS.map((s) => ({
        ...s,
        horaNum: parseInt(s.hora.split(":")[0], 10),
        diaKey: s.diaSemana ?? null,
        quantidade: 1,
      }));
    }
    return dbRows.map(normalizarRegistro);
  }, [hasRealData, dbRows]);

  // Período (Data inicial / Data final) aplicado a todos os cards do painel
  const registrosPeriodo = useMemo(() => {
    if (!hasRealData) return registrosBase;
    return registrosBase.filter((r) => {
      if (startDate && (!r.data || r.data < startDate)) return false;
      if (endDate && (!r.data || r.data > endDate)) return false;
      return true;
    });
  }, [hasRealData, registrosBase, startDate, endDate]);

  // Se o usuário restringir o período para datas que não contêm o dia da semana filtrado no heatmap (ex: 04/11 a 05/11 sem Terça-feira), remove o filtro órfão
  useEffect(() => {
    if (!filtroHorario?.dia || registrosPeriodo.length === 0) return;
    const diaExisteNoPeriodo = registrosPeriodo.some((r) => r.diaKey === filtroHorario.dia);
    if (!diaExisteNoPeriodo) {
      setFiltroHorario(null);
    }
  }, [registrosPeriodo, filtroHorario]);

  // Período + filtros secundários (tipo e colaborador): base comum de cards, heatmap e tabela
  const registrosSegmentados = useMemo(
    () =>
      registrosPeriodo.filter(
        (r) =>
          (filtroTipo === "TODOS" || r.tipo === filtroTipo) &&
          (filtroColaborador === "TODOS" || r.colaborador === filtroColaborador)
      ),
    [registrosPeriodo, filtroTipo, filtroColaborador]
  );

  // Registros do canal ativo
  const registrosCanal = useMemo(
    () => registrosSegmentados.filter((r) => pertenceAoCanal(r.canal, filtroCanal)),
    [registrosSegmentados, filtroCanal]
  );

  // Regra única do filtro de horário (sem fallback para outros dias)
  const correspondeHorario = useCallback(
    (r: RegistroNormalizado) =>
      !filtroHorario ||
      (r.horaNum === filtroHorario.hora && (!filtroHorario.dia || r.diaKey === filtroHorario.dia)),
    [filtroHorario]
  );

  // Registros do canal no horário selecionado: fonte única de destaques, andamentos, volumes e tabela
  const registrosFoco = useMemo(
    () => registrosCanal.filter(correspondeHorario),
    [registrosCanal, correspondeHorario]
  );

  const totaisGerais = useMemo(() => {
    if (!hasRealData) {
      return {
        total: 6722,
        digital: 4549,
        presencial: 2173,
        digitalPct: "67,7%",
        presencialPct: "32,3%",
      };
    }
    return somarTotais(registrosSegmentados);
  }, [hasRealData, registrosSegmentados]);

  // Heatmap: contagem real por dia/hora no canal ativo (matrizes ilustrativas apenas sem dados)
  const { matrizHeatmapAtiva, entradasForaDoMapa } = useMemo(() => {
    if (!hasRealData) {
      const matriz =
        filtroCanal === "digital"
          ? MATRIZ_DIGITAL
          : filtroCanal === "presencial"
          ? MATRIZ_PRESENCIAL
          : MATRIZ_TODOS;
      return { matrizHeatmapAtiva: matriz, entradasForaDoMapa: 0 };
    }
    return montarMatrizReal(registrosCanal);
  }, [hasRealData, filtroCanal, registrosCanal]);

  // Manipulador de clique nos cards/células do Heatmap
  const handleToggleHorario = (diaKey: string, hora: number, count: number) => {
    if (count === 0) {
      toast.warning(`Nenhuma entrada registrada em ${DIAS_NOMES[diaKey] || diaKey} às ${hora}h.`);
      return;
    }
    if (filtroHorario?.dia === diaKey && filtroHorario?.hora === hora) {
      setFiltroHorario(null);
      toast.info("Filtro de horário removido. Exibindo todos os horários.");
    } else {
      setFiltroHorario({ dia: diaKey, hora, count });
      toast.success(
        `Filtro inteligente ativado: ${DIAS_NOMES[diaKey] || diaKey} às ${hora}h (${count} entradas) · Todos os cards foram atualizados`
      );
    }
  };

  // Manipulador de clique no cabeçalho da coluna de horário
  const handleToggleColunaHora = (hora: number) => {
    if (filtroHorario?.dia === null && filtroHorario?.hora === hora) {
      setFiltroHorario(null);
      toast.info("Filtro de horário removido. Exibindo todos os horários.");
    } else {
      let countHora = 0;
      DIAS_HEATMAP.forEach((d) => {
        countHora += matrizHeatmapAtiva[d.key]?.[hora]?.count || 0;
      });

      setFiltroHorario({ dia: null, hora, count: countHora });
      toast.success(
        `Filtro inteligente ativado: Faixa das ${hora}h em todos os dias (${countHora} entradas) · Todos os cards foram atualizados`
      );
    }
  };

  // Totais reativos ao filtro de horário (mesma base do heatmap e da tabela)
  const totaisExibidos = useMemo(() => {
    if (!filtroHorario) {
      return totaisGerais;
    }

    if (hasRealData) {
      return somarTotais(registrosSegmentados.filter(correspondeHorario));
    }

    // Benchmark: calcular exatamente a partir das matrizes do heatmap
    let total = 0;
    let digital = 0;
    let presencial = 0;

    if (filtroHorario.dia) {
      total = MATRIZ_TODOS[filtroHorario.dia]?.[filtroHorario.hora]?.count || 0;
      digital = MATRIZ_DIGITAL[filtroHorario.dia]?.[filtroHorario.hora]?.count || 0;
      presencial = MATRIZ_PRESENCIAL[filtroHorario.dia]?.[filtroHorario.hora]?.count || 0;
    } else {
      DIAS_HEATMAP.forEach((d) => {
        total += MATRIZ_TODOS[d.key]?.[filtroHorario.hora]?.count || 0;
        digital += MATRIZ_DIGITAL[d.key]?.[filtroHorario.hora]?.count || 0;
        presencial += MATRIZ_PRESENCIAL[d.key]?.[filtroHorario.hora]?.count || 0;
      });
    }

    return {
      total,
      digital,
      presencial,
      digitalPct: formatarPct(digital, total),
      presencialPct: formatarPct(presencial, total),
    };
  }, [filtroHorario, hasRealData, registrosSegmentados, correspondeHorario, totaisGerais]);

  // Volume do canal ativo no recorte atual (mesmo número da célula do heatmap e da tabela)
  const volumeCanalExibido =
    filtroCanal === "digital"
      ? totaisExibidos.digital
      : filtroCanal === "presencial"
      ? totaisExibidos.presencial
      : totaisExibidos.total;

  // Destaques ilustrativos (usados apenas sem dados reais)
  const destaquesAtivos = DESTAQUES_BENCHMARK[filtroCanal];
  const andamentosAtivos = ANDAMENTOS_BENCHMARK[filtroCanal];
  const volumesAtivos = VOLUMES_BENCHMARK[filtroCanal];

  // Registros para a aba Produtividade (respeitam o período selecionado)
  const registrosProdutividade: ProdutividadeRegistro[] = useMemo(
    () =>
      registrosPeriodo.map((r) => ({
        nome: r.colaborador,
        canal: r.canal,
        tipo: r.tipo,
        hora: r.horaNum,
        diaKey: r.diaKey,
        data: r.data || null,
        quantidade: r.quantidade,
      })),
    [registrosPeriodo]
  );

  // Colaboradores disponíveis no filtro "Mais filtros" (derivados dos registros, respeitando o canal)
  const colaboradoresDisponiveis = useMemo(() => {
    const nomes = new Map<string, "Digital ONR" | "Presencial">();
    registrosProdutividade.forEach((r) => {
      if (filtroCanal === "digital" && r.canal !== "Digital ONR") return;
      if (filtroCanal === "presencial" && r.canal !== "Presencial") return;
      if (!nomes.has(r.nome)) nomes.set(r.nome, r.canal);
    });
    return Array.from(nomes.entries()).sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [registrosProdutividade, filtroCanal]);

  // Seleção de colaborador a partir do ranking (alterna seleção e sincroniza com a tabela)
  const handleSelecionarColaborador = (nome: string) => {
    if (filtroColaborador === nome) {
      setFiltroColaborador("TODOS");
      toast.info("Seleção de colaborador removida.");
    } else {
      setFiltroColaborador(nome);
      toast.success(`Colaborador selecionado: ${nome} · Tabela de serviços filtrada`);
    }
  };

  const destaquesExibidos = useMemo(() => {
    const diaNome = filtroHorario
      ? filtroHorario.dia
        ? DIAS_NOMES[filtroHorario.dia] || filtroHorario.dia
        : "Todos os dias"
      : "";

    if (!hasRealData) {
      if (!filtroHorario) return destaquesAtivos;
      const volCanal = volumeCanalExibido;
      return {
        pico: {
          titulo: `${diaNome} · ${filtroHorario.hora}h00`,
          detalhe: `${volCanal} entradas registradas neste horário (${formatarPct(volCanal, totaisExibidos.total)})`,
          badge: `Horário ${filtroHorario.hora}h ativo`,
        },
        usuario: {
          ...destaquesAtivos.usuario,
          detalhe: `${Math.max(1, Math.round(volCanal * 0.42))} entradas às ${filtroHorario.hora}h (ilustrativo)`,
        },
        servico: {
          ...destaquesAtivos.servico,
          detalhe: `${Math.max(1, Math.round(volCanal * 0.45))} registros às ${filtroHorario.hora}h (ilustrativo)`,
        },
      };
    }

    const rotuloCanal =
      filtroCanal === "digital" ? "Digital ONR" : filtroCanal === "presencial" ? "Balcão presencial" : "Todos os canais";
    const escopo = filtroCanal === "todos" ? "do total" : "do canal";
    const sufixoHora = filtroHorario ? ` às ${filtroHorario.hora}h` : "";
    const volFoco = somarQuantidade(registrosFoco);

    let pico: { titulo: string; detalhe: string; badge: string };
    if (filtroHorario) {
      pico = {
        titulo: `${diaNome} · ${filtroHorario.hora}h00`,
        detalhe: `${volumeCanalExibido.toLocaleString("pt-BR")} entradas registradas neste horário (${formatarPct(volumeCanalExibido, totaisExibidos.total)} do total)`,
        badge: `Horário ${filtroHorario.hora}h ativo`,
      };
    } else {
      const picoReal = encontrarPico(registrosCanal);
      pico = picoReal
        ? {
            titulo: `${DIAS_NOMES[picoReal.diaKey] || picoReal.diaKey} · ${picoReal.hora}h00`,
            detalhe: `${picoReal.count.toLocaleString("pt-BR")} entradas no pico · ${rotuloCanal}`,
            badge: `Pico às ${picoReal.hora}h`,
          }
        : {
            titulo: "Sem entradas no período",
            detalhe: "Ajuste o período, o canal ou os filtros",
            badge: "Sem dados",
          };
    }

    const topUsuario = agruparOrdenado(registrosFoco, (r) => r.colaborador)[0];
    const usuario = topUsuario
      ? {
          nome: topUsuario.chave,
          detalhe: `${topUsuario.total.toLocaleString("pt-BR")} entradas${sufixoHora} · ${formatarPct(topUsuario.total, volFoco)} ${escopo}`,
          rotulo: topUsuario.amostra.canal === "Digital ONR" ? "CANAL DIGITAL ONR" : "ATENDENTE DE BALCÃO",
        }
      : { nome: "—", detalhe: "Nenhuma entrada para os filtros atuais", rotulo: "SEM DADOS" };

    const topServico = agruparOrdenado(registrosFoco, (r) => r.tipoDetalhado)[0];
    const servico = topServico
      ? {
          nome: topServico.chave,
          detalhe: `${topServico.total.toLocaleString("pt-BR")} registros${sufixoHora} · ${formatarPct(topServico.total, volFoco)} ${escopo}`,
          rotulo: `${topServico.amostra.tipo === "CERTIDÃO" ? "CERTIDÃO" : "TÍTULO"} ${
            topServico.amostra.canal === "Digital ONR" ? "DIGITAL" : "PRESENCIAL"
          }`,
        }
      : { nome: "—", detalhe: "Nenhum serviço para os filtros atuais", rotulo: "SEM DADOS" };

    return { pico, usuario, servico };
  }, [
    filtroHorario,
    hasRealData,
    destaquesAtivos,
    volumeCanalExibido,
    totaisExibidos,
    filtroCanal,
    registrosFoco,
    registrosCanal,
  ]);

  const andamentosExibidos = useMemo(() => {
    if (!hasRealData) {
      if (!filtroHorario) return andamentosAtivos;
      const volCanal = volumeCanalExibido;
      const pesos = [0.42, 0.3, 0.18, 0.1];
      const maxVol = Math.max(1, Math.round(volCanal * pesos[0]));
      return andamentosAtivos.map((item, idx) => {
        const volNum = Math.max(1, Math.round(volCanal * (pesos[idx] || 0.1)));
        return {
          nome: item.nome,
          volume: volNum.toLocaleString("pt-BR"),
          pct: volCanal > 0 ? formatarPct(volNum, volCanal) : item.pct,
          barPct: idx === 0 ? "100%" : `${Math.min(100, Math.round((volNum / maxVol) * 100))}%`,
        };
      });
    }

    const volFoco = somarQuantidade(registrosFoco);
    const grupos = agruparOrdenado(registrosFoco, (r) => r.tipoDetalhado);
    const principais: Array<{ chave: string; total: number }> = grupos.slice(0, 4);
    const restante = grupos.slice(4).reduce((acc, g) => acc + g.total, 0);
    if (restante > 0) principais.push({ chave: "Outros serviços", total: restante });
    const maxVol = Math.max(1, ...principais.map((g) => g.total));

    return principais.map((g) => ({
      nome: g.chave,
      volume: g.total.toLocaleString("pt-BR"),
      pct: formatarPct(g.total, volFoco),
      barPct: `${Math.min(100, Math.max(2, Math.round((g.total / maxVol) * 100)))}%`,
    }));
  }, [hasRealData, filtroHorario, andamentosAtivos, volumeCanalExibido, registrosFoco]);

  const volumesExibidos = useMemo(() => {
    if (!hasRealData) {
      if (!filtroHorario) return volumesAtivos;
      const cert = Math.max(1, Math.round(volumeCanalExibido * 0.48));
      const tit = Math.max(1, volumeCanalExibido - cert);
      return { certidoes: cert.toLocaleString("pt-BR"), titulos: tit.toLocaleString("pt-BR") };
    }

    let certidoes = 0;
    let titulos = 0;
    registrosFoco.forEach((r) => {
      if (r.tipo === "CERTIDÃO") certidoes += r.quantidade;
      else titulos += r.quantidade;
    });
    return { certidoes: certidoes.toLocaleString("pt-BR"), titulos: titulos.toLocaleString("pt-BR") };
  }, [hasRealData, filtroHorario, volumesAtivos, volumeCanalExibido, registrosFoco]);

  // Curva real de volume por hora (8h às 17h); com dia selecionado mostra o perfil daquele dia
  const curvaVolume = useMemo(() => {
    if (!hasRealData) return null;
    const base = filtroHorario?.dia
      ? registrosCanal.filter((r) => r.diaKey === filtroHorario.dia)
      : registrosCanal;
    const cert = HORAS_HEATMAP.map(() => 0);
    const tit = HORAS_HEATMAP.map(() => 0);
    base.forEach((r) => {
      const i = HORAS_HEATMAP.indexOf(r.horaNum);
      if (i < 0) return;
      if (r.tipo === "CERTIDÃO") cert[i] += r.quantidade;
      else tit[i] += r.quantidade;
    });
    const max = Math.max(1, ...cert, ...tit);
    return { certidoes: montarCurva(cert, max), titulos: montarCurva(tit, max), max };
  }, [hasRealData, filtroHorario, registrosCanal]);

  const correspondeBusca = useCallback(
    (item: RegistroNormalizado) => {
      const query = buscaTabela.trim().toLowerCase();
      if (!query) return true;
      return (
        item.numero.toLowerCase().includes(query) ||
        item.colaborador.toLowerCase().includes(query) ||
        item.tipoDetalhado.toLowerCase().includes(query) ||
        item.canal.toLowerCase().includes(query)
      );
    },
    [buscaTabela]
  );

  // Tabela de serviços: filtra sobre todos os registros do recorte, ordena por coluna e pagina (Padrão FIORIX)
  const servicosFiltrados = useMemo(
    () => registrosFoco.filter(correspondeBusca),
    [registrosFoco, correspondeBusca]
  );

  const handleOrdenarColuna = useCallback(
    (coluna: ColunaOrdenacao) => {
      if (sortBy === coluna) {
        setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setSortBy(coluna);
        setSortOrder(coluna === "dataHora" ? "desc" : "asc");
      }
      setPaginaAtual(1);
    },
    [sortBy]
  );

  const servicosOrdenados = useMemo(() => {
    const fator = sortOrder === "asc" ? 1 : -1;
    const copia = [...servicosFiltrados];
    copia.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "dataHora") {
        const chaveA = `${a.data || "0000-00-00"} ${a.hora || "00:00"}`;
        const chaveB = `${b.data || "0000-00-00"} ${b.hora || "00:00"}`;
        cmp = chaveA.localeCompare(chaveB);
      } else if (sortBy === "numero") {
        cmp = String(a.numero || "").localeCompare(String(b.numero || ""), "pt-BR", {
          numeric: true,
          sensitivity: "base",
        });
      } else if (sortBy === "colaborador") {
        cmp = a.colaborador.localeCompare(b.colaborador, "pt-BR", { sensitivity: "base" });
      } else if (sortBy === "canal") {
        cmp = a.canal.localeCompare(b.canal, "pt-BR", { sensitivity: "base" });
      } else if (sortBy === "tipoDetalhado") {
        cmp = a.tipoDetalhado.localeCompare(b.tipoDetalhado, "pt-BR", { sensitivity: "base" });
      }
      if (cmp !== 0) return cmp * fator;
      const desempateData = `${b.data || ""} ${b.hora || ""}`.localeCompare(`${a.data || ""} ${a.hora || ""}`);
      if (desempateData !== 0) return desempateData;
      return Number(a.id) - Number(b.id);
    });
    return copia;
  }, [servicosFiltrados, sortBy, sortOrder]);

  const totalServicosTabela = servicosOrdenados.length;
  const totalPaginasTabela = Math.max(1, Math.ceil(totalServicosTabela / itensPorPagina));
  const paginaSeguraTabela = Math.min(paginaAtual, totalPaginasTabela);
  const indiceInicioTabela = totalServicosTabela === 0 ? 0 : (paginaSeguraTabela - 1) * itensPorPagina + 1;
  const indiceFimTabela = Math.min(paginaSeguraTabela * itensPorPagina, totalServicosTabela);

  const servicosPaginados = useMemo(
    () =>
      servicosOrdenados.slice(
        (paginaSeguraTabela - 1) * itensPorPagina,
        paginaSeguraTabela * itensPorPagina
      ),
    [servicosOrdenados, paginaSeguraTabela, itensPorPagina]
  );

  // Paginação padronizada FIORIX (10 / 25 / 50 + navegação compacta igual à Espera)

  // ───────────────────────────────────────────────────────────────────────────
  // MÉTRICAS DINÂMICAS DOS 3 CARDS SUPERIORES E SUB-DESTAQUES POR ABA ATIVA
  // ───────────────────────────────────────────────────────────────────────────

  // 1) Base da aba Visão Geral: mix Certidões x Títulos no recorte atual
  const mixVisaoGeral = useMemo(() => {
    const base = registrosSegmentados.filter(correspondeHorario);
    let certidoes = 0;
    let titulos = 0;
    base.forEach((r) => {
      if (r.tipo === "CERTIDÃO") certidoes += r.quantidade;
      else titulos += r.quantidade;
    });
    if (!hasRealData && !filtroHorario) {
      return { certidoes: 3898, titulos: 2824 };
    }
    return { certidoes, titulos };
  }, [registrosSegmentados, correspondeHorario, hasRealData, filtroHorario]);

  // 2) Base da aba Produtividade: média por operador, operadores ativos e ritmo diário por canal
  const metricasProdutividadeCanais = useMemo(() => {
    const base = registrosPeriodo.filter(
      (r) =>
        (filtroTipo === "TODOS" || r.tipo === filtroTipo) &&
        (filtroColaborador === "TODOS" || r.colaborador === filtroColaborador) &&
        correspondeHorario(r)
    );

    const resumir = (lista: RegistroNormalizado[]) => {
      const ops = new Map<string, { total: number; dias: Set<string>; canal: "Digital ONR" | "Presencial" }>();
      const diasSet = new Set<string>();
      let volume = 0;

      lista.forEach((r) => {
        volume += r.quantidade;
        if (r.data) diasSet.add(r.data);
        let op = ops.get(r.colaborador);
        if (!op) {
          op = { total: 0, dias: new Set<string>(), canal: r.canal };
          ops.set(r.colaborador, op);
        }
        op.total += r.quantidade;
        if (r.data) op.dias.add(r.data);
      });

      const operadores = ops.size;
      const dias = diasSet.size;
      const mediaColab = operadores > 0 ? Math.round(volume / operadores) : 0;
      const mediaDia = dias > 0 ? Math.round(volume / dias) : 0;
      const ranking = Array.from(ops.entries())
        .map(([nome, v]) => ({
          nome,
          total: v.total,
          dias: v.dias.size,
          canal: v.canal,
        }))
        .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome, "pt-BR"));

      return { volume, operadores, dias, mediaColab, mediaDia, ranking };
    };

    if (!hasRealData && !filtroHorario) {
      return {
        todos: {
          volume: 6722,
          operadores: 22,
          dias: 5,
          mediaColab: 306,
          mediaDia: 1344,
          ranking: [{ nome: "eProtocolo", total: 2890, dias: 5, canal: "Digital ONR" as const }],
          pctVolume: "100%",
          barCss: "100%",
        },
        digital: {
          volume: 4549,
          operadores: 4,
          dias: 5,
          mediaColab: 1137,
          mediaDia: 910,
          ranking: [{ nome: "eProtocolo", total: 2890, dias: 5, canal: "Digital ONR" as const }],
          pctVolume: "67,7%",
          barCss: "67.7%",
        },
        presencial: {
          volume: 2173,
          operadores: 18,
          dias: 5,
          mediaColab: 121,
          mediaDia: 435,
          ranking: [{ nome: "Mariana", total: 312, dias: 5, canal: "Presencial" as const }],
          pctVolume: "32,3%",
          barCss: "32.3%",
        },
      };
    }

    const todos = resumir(base);
    const digital = resumir(base.filter((r) => r.canal === "Digital ONR"));
    const presencial = resumir(base.filter((r) => r.canal === "Presencial"));
    const pctDigNum = todos.volume > 0 ? (digital.volume / todos.volume) * 100 : 0;
    const pctPresNum = todos.volume > 0 ? (presencial.volume / todos.volume) * 100 : 0;

    return {
      todos: { ...todos, pctVolume: "100%", barCss: todos.volume > 0 ? "100%" : "0%" },
      digital: {
        ...digital,
        pctVolume: formatarPct(digital.volume, todos.volume),
        barCss: `${pctDigNum.toFixed(1)}%`,
      },
      presencial: {
        ...presencial,
        pctVolume: formatarPct(presencial.volume, todos.volume),
        barCss: `${pctPresNum.toFixed(1)}%`,
      },
    };
  }, [registrosPeriodo, filtroTipo, filtroColaborador, correspondeHorario, hasRealData, filtroHorario]);

  // 3) Base da aba Serviços: protocolos únicos (descontando reentradas do mesmo pedido) e reativa à busca
  const metricasServicosCanais = useMemo(() => {
    const base = registrosSegmentados.filter(correspondeHorario).filter(correspondeBusca);

    const resumir = (lista: RegistroNormalizado[]) => {
      const protocolosSet = new Set<string>();
      const naturezasMap = new Map<string, number>();
      let movimentacoes = 0;
      let certidoes = 0;
      let titulos = 0;

      lista.forEach((r) => {
        const chavePedido = r.numero && r.numero !== "—" ? r.numero : `row_${r.id}`;
        protocolosSet.add(chavePedido);
        if (r.tipoDetalhado) {
          naturezasMap.set(r.tipoDetalhado, (naturezasMap.get(r.tipoDetalhado) || 0) + r.quantidade);
        }
        movimentacoes += r.quantidade;
        if (r.tipo === "CERTIDÃO") certidoes += r.quantidade;
        else titulos += r.quantidade;
      });

      const naturezasLista = Array.from(naturezasMap.entries())
        .map(([nome, qtd]) => ({ nome, qtd }))
        .sort((a, b) => b.qtd - a.qtd || a.nome.localeCompare(b.nome, "pt-BR"));

      return {
        protocolos: protocolosSet.size,
        movimentacoes,
        certidoes,
        titulos,
        naturezas: naturezasLista.length,
        naturezasLista,
      };
    };

    if (!hasRealData && !filtroHorario && !buscaTabela.trim()) {
      return {
        todos: {
          protocolos: 5980,
          movimentacoes: 6722,
          certidoes: 3898,
          titulos: 2824,
          naturezas: 12,
          naturezasLista: [] as Array<{ nome: string; qtd: number }>,
          pct: "100%",
          barCss: "100%",
        },
        digital: {
          protocolos: 3912,
          movimentacoes: 4549,
          certidoes: 2610,
          titulos: 1939,
          naturezas: 8,
          naturezasLista: [
            { nome: "Depósito de Certidões", qtd: 800 },
            { nome: "Saída de Certidão com Saldo a Receber", qtd: 711 },
            { nome: "Complemento de Depósito de Títulos", qtd: 377 },
            { nome: "Saída de Títulos com Saldo Zerado", qtd: 305 },
            { nome: "Depósito de Títulos", qtd: 275 },
            { nome: "Depósito de Reentrada de Títulos", qtd: 11 },
            { nome: "Saída de Título c Exigência com Saldo a Devolver", qtd: 2 },
            { nome: "Saída de Título Registrado com Saldo a Devolver", qtd: 1 },
          ],
          pct: "65,4%",
          barCss: "65.4%",
        },
        presencial: {
          protocolos: 2068,
          movimentacoes: 2173,
          certidoes: 1288,
          titulos: 885,
          naturezas: 11,
          naturezasLista: [
            { nome: "Depósito de Certidões", qtd: 415 },
            { nome: "Depósito de Títulos", qtd: 181 },
            { nome: "Saída de Títulos com Saldo Zerado", qtd: 133 },
            { nome: "Complemento de Depósito de Títulos", qtd: 101 },
            { nome: "Saída de Certidão com Saldo a Devolver", qtd: 56 },
            { nome: "Saída de Título c Exigência com Saldo a Devolver", qtd: 20 },
            { nome: "Saída de Título Registrado com Saldo a Devolver", qtd: 12 },
            { nome: "Saída de Título Registrado com Saldo a Receber", qtd: 7 },
            { nome: "Depósito de Reentrada de Títulos", qtd: 5 },
            { nome: "Complemento de Depósito de Certidões", qtd: 4 },
            { nome: "Saída de Certidões com Saldo Zerado", qtd: 1 },
          ],
          pct: "34,6%",
          barCss: "34.6%",
        },
      };
    }

    const todos = resumir(base);
    const digital = resumir(base.filter((r) => r.canal === "Digital ONR"));
    const presencial = resumir(base.filter((r) => r.canal === "Presencial"));
    const pctDigNum = todos.protocolos > 0 ? (digital.protocolos / todos.protocolos) * 100 : 0;
    const pctPresNum = todos.protocolos > 0 ? (presencial.protocolos / todos.protocolos) * 100 : 0;

    return {
      todos: { ...todos, pct: "100%", barCss: todos.protocolos > 0 ? "100%" : "0%" },
      digital: {
        ...digital,
        pct: formatarPct(digital.protocolos, todos.protocolos),
        barCss: `${pctDigNum.toFixed(1)}%`,
      },
      presencial: {
        ...presencial,
        pct: formatarPct(presencial.protocolos, todos.protocolos),
        barCss: `${pctPresNum.toFixed(1)}%`,
      },
    };
  }, [registrosSegmentados, correspondeHorario, correspondeBusca, hasRealData, filtroHorario, buscaTabela]);

  // Configuração visual dos 3 cards superiores de acordo com a aba ativa
  const heroCardsAba = useMemo(() => {
    if (activeTab === "produtividade") {
      const p = metricasProdutividadeCanais;
      return {
        orientacao: "Produtividade média por colaborador em cada canal · Clique em um card para filtrar a equipe",
        todos: {
          titulo: "PRODUTIVIDADE GERAL",
          valor: p.todos.mediaColab.toLocaleString("pt-BR"),
          sufixo: "serv./colab.",
          subtitulo: `${p.todos.operadores} colaboradores ativos · ${p.todos.mediaDia.toLocaleString("pt-BR")}/dia · ${p.todos.volume.toLocaleString("pt-BR")} entradas`,
          barCss: p.todos.barCss,
          ctaAtivo: `Exibindo toda a equipe (${p.todos.operadores})`,
          ctaInativo: `Ver toda a equipe (${p.todos.operadores})`,
          resumoSelect: `Todos os canais (${p.todos.mediaColab.toLocaleString("pt-BR")}/colab · ${p.todos.operadores} ativos)`,
        },
        digital: {
          titulo: "DIGITAL ONR · PRODUTIVIDADE",
          valor: p.digital.mediaColab.toLocaleString("pt-BR"),
          sufixo: "serv./caixa",
          subtitulo: `${p.digital.operadores} caixas digitais · ${p.digital.mediaDia.toLocaleString("pt-BR")}/dia · ${p.digital.volume.toLocaleString("pt-BR")} entradas (${p.digital.pctVolume})`,
          barCss: p.digital.barCss,
          ctaAtivo: `Exibindo equipe Digital ONR (${p.digital.operadores})`,
          ctaInativo: `Ver equipe Digital ONR (${p.digital.operadores})`,
          resumoSelect: `Digital ONR (${p.digital.mediaColab.toLocaleString("pt-BR")}/caixa · ${p.digital.operadores} ativos)`,
        },
        presencial: {
          titulo: "PRESENCIAL · PRODUTIVIDADE",
          valor: p.presencial.mediaColab.toLocaleString("pt-BR"),
          sufixo: "serv./atend.",
          subtitulo: `${p.presencial.operadores} atendentes de balcão · ${p.presencial.mediaDia.toLocaleString("pt-BR")}/dia · ${p.presencial.volume.toLocaleString("pt-BR")} entradas (${p.presencial.pctVolume})`,
          barCss: p.presencial.barCss,
          ctaAtivo: `Exibindo equipe Presencial (${p.presencial.operadores})`,
          ctaInativo: `Ver equipe Presencial (${p.presencial.operadores})`,
          resumoSelect: `Presencial (${p.presencial.mediaColab.toLocaleString("pt-BR")}/atend · ${p.presencial.operadores} ativos)`,
        },
      };
    }

    if (activeTab === "servicos") {
      const s = metricasServicosCanais;
      const termo = buscaTabela.trim();
      return {
        orientacao: "Protocolos únicos atendidos por canal (descontando reentradas) · Reage também à busca da tabela",
        todos: {
          titulo: "PROTOCOLOS ÚNICOS",
          valor: s.todos.protocolos.toLocaleString("pt-BR"),
          sufixo: "protocolos",
          subtitulo: termo
            ? `Busca "${termo}" · ${s.todos.movimentacoes.toLocaleString("pt-BR")} movimentações encontradas`
            : `${s.todos.movimentacoes.toLocaleString("pt-BR")} movimentações · ${s.todos.certidoes.toLocaleString("pt-BR")} certidões · ${s.todos.titulos.toLocaleString("pt-BR")} títulos`,
          barCss: s.todos.barCss,
          ctaAtivo: "Exibindo todos os protocolos",
          ctaInativo: "Ver todos os protocolos",
          resumoSelect: `Todos os canais (${s.todos.protocolos.toLocaleString("pt-BR")} protocolos)`,
        },
        digital: {
          titulo: "DIGITAL ONR · PROTOCOLOS",
          valor: s.digital.protocolos.toLocaleString("pt-BR"),
          sufixo: s.digital.pct,
          subtitulo: `${s.digital.movimentacoes.toLocaleString("pt-BR")} movimentações ONR · ${s.digital.naturezas} tipos de serviço`,
          tiposLista: s.digital.naturezasLista,
          barCss: s.digital.barCss,
          ctaAtivo: "Exibindo protocolos digitais",
          ctaInativo: "Ver protocolos digitais",
          resumoSelect: `Digital ONR (${s.digital.protocolos.toLocaleString("pt-BR")} protocolos)`,
        },
        presencial: {
          titulo: "PRESENCIAL · PROTOCOLOS",
          valor: s.presencial.protocolos.toLocaleString("pt-BR"),
          sufixo: s.presencial.pct,
          subtitulo: `${s.presencial.movimentacoes.toLocaleString("pt-BR")} movimentações no balcão · ${s.presencial.naturezas} tipos de serviço`,
          tiposLista: s.presencial.naturezasLista,
          barCss: s.presencial.barCss,
          ctaAtivo: "Exibindo protocolos presenciais",
          ctaInativo: "Ver protocolos presenciais",
          resumoSelect: `Presencial (${s.presencial.protocolos.toLocaleString("pt-BR")} protocolos)`,
        },
      };
    }

    const digPctNum = totaisExibidos.total > 0 ? (totaisExibidos.digital / totaisExibidos.total) * 100 : 0;
    const presPctNum = totaisExibidos.total > 0 ? (totaisExibidos.presencial / totaisExibidos.total) * 100 : 0;

    return {
      orientacao: "Selecione um card para consultar o fluxo de entradas por canal",
      todos: {
        titulo: "TOTAL DE ENTRADAS",
        valor: totaisExibidos.total.toLocaleString("pt-BR"),
        sufixo: null as string | null,
        subtitulo: filtroHorario
          ? `Entradas filtradas às ${filtroHorario.hora}h · Geral`
          : `${mixVisaoGeral.certidoes.toLocaleString("pt-BR")} certidões · ${mixVisaoGeral.titulos.toLocaleString("pt-BR")} títulos recebidos`,
        barCss: totaisExibidos.total > 0 ? "100%" : "0%",
        ctaAtivo: "Exibindo todos os serviços",
        ctaInativo: "Ver todos os serviços",
        resumoSelect: `Todos os canais (${totaisExibidos.total.toLocaleString("pt-BR")})`,
      },
      digital: {
        titulo: "DIGITAL ONR",
        valor: totaisExibidos.digital.toLocaleString("pt-BR"),
        sufixo: totaisExibidos.digitalPct,
        subtitulo: filtroHorario
          ? `Volume ONR filtrado às ${filtroHorario.hora}h`
          : "Clique para consultar entradas eletrônicas do ONR",
        barCss: `${digPctNum.toFixed(1)}%`,
        ctaAtivo: "Exibindo serviços digitais",
        ctaInativo: "Ver serviços digitais",
        resumoSelect: `Digital ONR (${totaisExibidos.digital.toLocaleString("pt-BR")})`,
      },
      presencial: {
        titulo: "PRESENCIAL",
        valor: totaisExibidos.presencial.toLocaleString("pt-BR"),
        sufixo: totaisExibidos.presencialPct,
        subtitulo: filtroHorario
          ? `Volume Balcão filtrado às ${filtroHorario.hora}h`
          : "Clique para consultar entradas presenciais do balcão",
        barCss: `${presPctNum.toFixed(1)}%`,
        ctaAtivo: "Exibindo serviços presenciais",
        ctaInativo: "Ver serviços presenciais",
        resumoSelect: `Presencial (${totaisExibidos.presencial.toLocaleString("pt-BR")})`,
      },
    };
  }, [
    activeTab,
    metricasProdutividadeCanais,
    metricasServicosCanais,
    buscaTabela,
    totaisExibidos,
    filtroHorario,
    mixVisaoGeral,
  ]);

  // Sub-faixa de 3 destaques contextualizada para cada aba
  const destaquesPorAba = useMemo(() => {
    if (activeTab === "produtividade") {
      const recorte = metricasProdutividadeCanais[filtroCanal];
      const lider = recorte.ranking[0];
      const top3Vol = recorte.ranking.slice(0, 3).reduce((acc, item) => acc + item.total, 0);
      const top3Pct = formatarPct(top3Vol, recorte.volume);
      const mediaLiderDia = lider && lider.dias > 0 ? Math.round(lider.total / lider.dias) : 0;

      return {
        card1: {
          label: "RITMO DIÁRIO DA EQUIPE",
          badge: recorte.dias > 0 ? `${recorte.dias} dia${recorte.dias > 1 ? "s" : ""} ativo${recorte.dias > 1 ? "s" : ""}` : "Sem datas",
          titulo: recorte.dias > 0 ? `${recorte.mediaDia.toLocaleString("pt-BR")} serviços / dia` : "Sem ritmo calculado",
          detalhe: `${recorte.volume.toLocaleString("pt-BR")} entradas distribuídas entre ${recorte.operadores} operador${recorte.operadores === 1 ? "" : "es"}`,
        },
        card2: {
          label: "LÍDER DE PRODUTIVIDADE",
          badge: lider ? (lider.canal === "Digital ONR" ? "1º · DIGITAL ONR" : "1º · BALCÃO") : "SEM DADOS",
          titulo: lider ? lider.nome : "—",
          detalhe: lider
            ? `${mediaLiderDia > 0 ? `${mediaLiderDia.toLocaleString("pt-BR")}/dia · ` : ""}${lider.total.toLocaleString("pt-BR")} serviços (${formatarPct(lider.total, recorte.volume)})`
            : "Nenhum operador encontrado para os filtros atuais",
        },
        card3: {
          label: "CONCENTRAÇÃO TOP 3",
          badge: `${recorte.operadores} OPERADORES`,
          titulo: recorte.volume > 0 ? `${top3Pct} do volume` : "0,0%",
          detalhe:
            recorte.volume > 0
              ? `${top3Vol.toLocaleString("pt-BR")} serviços concentrados nos 3 maiores operadores`
              : "Sem volume registrado no recorte",
        },
      };
    }

    if (activeTab === "servicos") {
      const recorte = metricasServicosCanais[filtroCanal];
      const reentradas = Math.max(0, recorte.movimentacoes - recorte.protocolos);
      const razao =
        recorte.protocolos > 0
          ? (recorte.movimentacoes / recorte.protocolos).toFixed(2).replace(".", ",")
          : "0,00";
      const topNatureza = agruparOrdenado(servicosFiltrados, (r) => r.tipoDetalhado)[0];

      return {
        card1: {
          label: "REENTRADAS DE PROTOCOLO",
          badge: `${razao} mov./pedido`,
          titulo:
            reentradas > 0
              ? `${reentradas.toLocaleString("pt-BR")} movimentações complementares`
              : "1 movimentação por protocolo",
          detalhe: `${recorte.protocolos.toLocaleString("pt-BR")} protocolos únicos em ${recorte.movimentacoes.toLocaleString("pt-BR")} registros`,
        },
        card2: {
          label: "MIX DOCUMENTAL",
          badge: "CERTIDÕES × TÍTULOS",
          titulo: `${formatarPct(recorte.certidoes, recorte.movimentacoes)} Certidões · ${formatarPct(recorte.titulos, recorte.movimentacoes)} Títulos`,
          detalhe: `${recorte.certidoes.toLocaleString("pt-BR")} certidões e ${recorte.titulos.toLocaleString("pt-BR")} títulos listados`,
        },
        card3: {
          label: "NATUREZA PREDOMINANTE",
          badge: `${recorte.naturezas} TIPOS ATIVOS`,
          titulo: topNatureza ? topNatureza.chave : "—",
          detalhe: topNatureza
            ? `${topNatureza.total.toLocaleString("pt-BR")} registros (${formatarPct(topNatureza.total, recorte.movimentacoes)} da listagem)`
            : "Nenhum serviço encontrado na busca atual",
        },
      };
    }

    return {
      card1: {
        label: "PICO DE ENTRADAS",
        badge: destaquesExibidos.pico.badge,
        titulo: destaquesExibidos.pico.titulo,
        detalhe: destaquesExibidos.pico.detalhe,
      },
      card2: {
        label: "USUÁRIO EM DESTAQUE",
        badge: destaquesExibidos.usuario.rotulo,
        titulo: destaquesExibidos.usuario.nome,
        detalhe: destaquesExibidos.usuario.detalhe,
      },
      card3: {
        label: "SERVIÇO EM DESTAQUE",
        badge: destaquesExibidos.servico.rotulo,
        titulo: destaquesExibidos.servico.nome,
        detalhe: destaquesExibidos.servico.detalhe,
      },
    };
  }, [
    activeTab,
    metricasProdutividadeCanais,
    metricasServicosCanais,
    filtroCanal,
    servicosFiltrados,
    destaquesExibidos,
  ]);

  // Exportar CSV (respeitando a ordenação ativa da tabela)
  const handleExportCSV = () => {
    if (servicosOrdenados.length === 0) {
      toast.warning("Nenhum serviço para exportar com os filtros atuais.");
      return;
    }
    const headers = ["Data/Hora", "Serviço", "Colaborador", "Canal", "Tipo/Detalhe"];
    const rows = servicosOrdenados.map((p) => [
      `"${p.dataHora}"`,
      `"${p.numero}"`,
      `"${p.colaborador}"`,
      `"${p.canal}"`,
      `"${p.tipoDetalhado}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `servicos_recepcao_${filtroCanal}_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exportados ${servicosOrdenados.length.toLocaleString("pt-BR")} serviços em formato CSV.`);
  };

  // Impressão Oficial da Listagem — Padrão FIORIX (página atual ou todos os registros filtrados)
  const handleImprimirListagem = (escopo: "pagina" | "todos") => {
    setMenuImprimirAberto(false);
    const registrosImprimir = escopo === "pagina" ? servicosPaginados : servicosOrdenados;

    if (registrosImprimir.length === 0) {
      toast.warning("Nenhum registro disponível para impressão com os filtros atuais.");
      return;
    }

    const printWin = window.open("", "_blank");
    if (!printWin) {
      toast.error("Permita pop-ups no navegador para abrir a listagem de impressão.");
      return;
    }

    const tituloCanal =
      filtroCanal === "digital"
        ? "Serviços Digitais · ONR"
        : filtroCanal === "presencial"
        ? "Serviços Presenciais · Balcão"
        : "Todos os Canais Consolidados";

    const periodoTexto =
      startDate || endDate
        ? `${startDate ? formatarDataCurta(startDate) : "Início"} a ${endDate ? formatarDataCurta(endDate) : "Hoje"}`
        : "Período integral";

    const escopoTexto =
      escopo === "pagina"
        ? `Página ${paginaSeguraTabela} de ${totalPaginasTabela} (${registrosImprimir.length.toLocaleString("pt-BR")} registros)`
        : `Listagem completa filtrada (${registrosImprimir.length.toLocaleString("pt-BR")} registros)`;

    const ordemTexto = `${ROTULO_COLUNA_ORDEM[sortBy]} (${sortOrder === "asc" ? "Crescente" : "Decrescente"})`;
    const resumoCanal = metricasServicosCanais[filtroCanal];
    const filtrosExtras: string[] = [];
    if (filtroHorario) {
      filtrosExtras.push(
        `Horário: ${filtroHorario.dia ? `${DIAS_NOMES[filtroHorario.dia] || filtroHorario.dia} ` : ""}às ${filtroHorario.hora}h`
      );
    }
    if (filtroTipo !== "TODOS") filtrosExtras.push(`Tipo: ${filtroTipo}`);
    if (filtroColaborador !== "TODOS") filtrosExtras.push(`Colaborador: ${filtroColaborador}`);
    if (buscaTabela.trim()) filtrosExtras.push(`Busca: "${buscaTabela.trim()}"`);

    const emitidoEm = new Date().toLocaleString("pt-BR");
    const offsetNumeracao = escopo === "pagina" ? (paginaSeguraTabela - 1) * itensPorPagina : 0;

    const linhasHtml = registrosImprimir
      .map((item, idx) => {
        const dataCompleta = item.data ? `${formatarDataCurta(item.data)} · ${item.hora}` : item.dataHora;
        return `
          <tr>
            <td class="col-seq">${offsetNumeracao + idx + 1}</td>
            <td class="col-data">${escapeHtml(dataCompleta)}</td>
            <td class="col-num">${escapeHtml(String(item.numero).replace(/^#/, ""))}</td>
            <td>${escapeHtml(item.colaborador)}</td>
            <td>
              <span class="badge ${item.canal === "Digital ONR" ? "badge-digital" : "badge-presencial"}">
                ${escapeHtml(item.canal)}
              </span>
            </td>
            <td>${escapeHtml(item.tipoDetalhado)}</td>
          </tr>
        `;
      })
      .join("");

    printWin.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Relatório de Recepção e Serviços — 7º RI de São Paulo</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.4;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .brand {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #0369a1;
      margin-bottom: 2px;
    }
    .title {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin: 0;
    }
    .subtitle {
      font-size: 11px;
      color: #475569;
      margin: 2px 0 0 0;
    }
    .meta-right {
      text-align: right;
      font-size: 10px;
      color: #475569;
      white-space: nowrap;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 10px;
    }
    .summary-card {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px 10px;
      background: #f8fafc;
    }
    .summary-label {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }
    .summary-val {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      margin-top: 2px;
    }
    .filters-bar {
      font-size: 10px;
      color: #334155;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 6px 10px;
      margin-bottom: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th {
      background: #0f172a;
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      text-align: left;
      padding: 7px 8px;
      border: 1px solid #0f172a;
    }
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
      color: #1e293b;
    }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    .col-seq { width: 34px; color: #64748b; font-family: monospace; text-align: right; }
    .col-data { width: 118px; white-space: nowrap; font-family: monospace; }
    .col-num { width: 92px; font-weight: 700; font-family: monospace; color: #1d4ed8; }
    .badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 9.5px;
      font-weight: 700;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .badge-digital { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
    .badge-presencial { background: #f0f9ff; color: #0369a1; border-color: #bae6fd; }
    .footer {
      margin-top: 14px;
      padding-top: 8px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 9.5px;
      color: #64748b;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">7º Oficial de Registro de Imóveis de São Paulo • Sistema FIORIX</div>
      <h1 class="title">Relatório de Recepção — ${escapeHtml(tituloCanal)}</h1>
      <p class="subtitle">Período: ${escapeHtml(periodoTexto)} • ${escapeHtml(escopoTexto)}</p>
    </div>
    <div class="meta-right">
      <div><strong>Emitido em:</strong> ${escapeHtml(emitidoEm)}</div>
      <div><strong>Ordenação:</strong> ${escapeHtml(ordemTexto)}</div>
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-label">Movimentações Filtradas</div>
      <div class="summary-val">${totalServicosTabela.toLocaleString("pt-BR")}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Protocolos Únicos</div>
      <div class="summary-val">${resumoCanal.protocolos.toLocaleString("pt-BR")}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Certidões / Títulos</div>
      <div class="summary-val">${resumoCanal.certidoes.toLocaleString("pt-BR")} / ${resumoCanal.titulos.toLocaleString("pt-BR")}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Registros Impressos</div>
      <div class="summary-val">${registrosImprimir.length.toLocaleString("pt-BR")}</div>
    </div>
  </div>

  <div class="filters-bar">
    <strong>Escopo ativo:</strong> Canal: ${escapeHtml(tituloCanal)} | Ordem: ${escapeHtml(ordemTexto)}${
      filtrosExtras.length > 0 ? ` | ${escapeHtml(filtrosExtras.join(" | "))}` : ""
    }
  </div>

  <table>
    <thead>
      <tr>
        <th class="col-seq">#</th>
        <th class="col-data">Data / Hora</th>
        <th class="col-num">Serviço</th>
        <th>Colaborador</th>
        <th>Canal</th>
        <th>Tipo / Detalhe</th>
      </tr>
    </thead>
    <tbody>
      ${linhasHtml}
    </tbody>
  </table>

  <div class="footer">
    <span>7º Oficial de Registro de Imóveis de São Paulo • Gestão de Qualidade e Prazos</span>
    <span>Total impresso: ${registrosImprimir.length.toLocaleString("pt-BR")} de ${totalServicosTabela.toLocaleString("pt-BR")} movimentações</span>
  </div>
</body>
</html>`);
    printWin.document.close();
    setTimeout(() => {
      try {
        printWin.focus();
        printWin.print();
      } catch {}
    }, 220);
  };

  // Cores de intensidade do Heatmap
  const getCellColor = (level: number, count = 0) => {
    switch (level) {
      case 4:
        return "bg-amber-400 border-amber-300 text-slate-900 shadow-[0_0_14px_rgba(251,191,36,0.6)] font-bold";
      case 3:
        return "bg-emerald-500/90 border-emerald-400/60 text-white font-medium";
      case 2:
        return "bg-teal-600/70 border-teal-500/50 text-white";
      case 1:
        return "bg-slate-800/90 border-slate-700/70 text-slate-300";
      default:
        return count > 0
          ? "bg-slate-800/70 border-slate-700/60 text-slate-300"
          : "bg-[#0E1528]/80 border-white/[0.04] text-slate-600 hover:border-white/20";
    }
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-white selection:bg-cyan-500/30 relative overflow-hidden">
      {/* Background Glow Atmospheric Effect (Padrão Espera) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-80 w-[52rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/12 via-purple-500/10 to-cyan-500/8 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 py-6 lg:px-8 lg:py-8 space-y-6">
        {/* ───────────────────────────────────────────────────────────── */}
        {/* CABEÇALHO COMPACTO EM LINHA ÚNICA (PADRÃO FIORIX)             */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1 pt-1 pb-2 border-b border-white/8">
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-slate-400 tracking-wider">GESTÃO DE PRAZOS</span>
            <span className="text-slate-600">/</span>
            <span className="text-cyan-400 font-extrabold tracking-wider">RECEPÇÃO</span>
            <h1 className="sr-only">Recepção</h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#0B1020] border border-white/15 hover:border-white/30 text-white text-xs font-semibold shadow-lg shadow-black/40 transition-all hover:bg-white/5 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>Atualizar</span>
            </button>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* MENU DE ABAS EM DESTAQUE MÁXIMO (ALTO RECONHECIMENTO VISUAL)  */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="relative rounded-2xl border border-indigo-500/40 bg-[#0B1020]/95 backdrop-blur-2xl p-2.5 shadow-2xl shadow-indigo-950/40">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none w-full p-0.5">
            {(
              [
                {
                  key: "visao_geral",
                  label: "Visão geral",
                  icon: Layers,
                },
                {
                  key: "produtividade",
                  label: "Produtividade",
                  icon: BarChart3,
                },
                {
                  key: "servicos",
                  label: "Serviços",
                  icon: FileText,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    toast.info(`Módulo ativado: ${tab.label}`);
                  }}
                  className={`group relative inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer whitespace-nowrap select-none border ${
                    isActive
                      ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-600/40 border-indigo-400/80 ring-2 ring-indigo-400/30 scale-[1.02]"
                      : "bg-[#080D1A]/90 hover:bg-white/[0.08] text-slate-300 hover:text-white border-white/10 hover:border-indigo-400/40 hover:shadow-md"
                  }`}
                >
                  <div
                    className={`p-1 rounded-lg transition-colors ${
                      isActive
                        ? "bg-white/20 text-cyan-200"
                        : "bg-white/5 text-slate-400 group-hover:bg-white/10 group-hover:text-cyan-300"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <span className="font-extrabold tracking-wide text-xs">{tab.label}</span>

                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse ml-0.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Texto de orientação dos cards de canal */}
        <div className="px-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs text-slate-200 font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>
              {heroCardsAba.orientacao} ·{" "}
              <strong className="text-cyan-300">Todos os cards abaixo interagem com o filtro selecionado</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0E1528] border border-cyan-500/30 text-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Canal ativo:</span>
              <span className="font-bold text-cyan-300">{heroCardsAba[filtroCanal].resumoSelect}</span>
            </div>

            {filtroHorario && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 text-xs font-semibold shadow-[0_0_12px_rgba(6,182,212,0.35)] animate-in fade-in">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Horário:{" "}
                  <strong>
                    {filtroHorario.dia ? `${DIAS_NOMES[filtroHorario.dia]} ` : ""}às {filtroHorario.hora}h
                  </strong>
                  {` (${volumeCanalExibido.toLocaleString("pt-BR")})`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setFiltroHorario(null);
                    toast.info("Filtro de horário removido. Exibindo todos os horários.");
                  }}
                  className="p-0.5 rounded-full hover:bg-white/20 text-cyan-200 hover:text-white transition-colors cursor-pointer"
                  title="Remover filtro de horário"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* CARDS PRINCIPAIS CLICÁVEIS (DINÂMICOS CONFORME A ABA ATIVA)   */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CARD 1: TODOS OS CANAIS */}
          <div
            role="button"
            tabIndex={0}
            aria-pressed={filtroCanal === "todos"}
            onClick={() => handleSelecionarCanal("todos")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelecionarCanal("todos");
              }
            }}
            className={`group relative flex flex-col justify-between rounded-[24px] border p-6 transition-all duration-300 cursor-pointer backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              filtroCanal === "todos"
                ? "border-cyan-400/90 bg-[#0B1020] shadow-[0_0_28px_rgba(6,182,212,0.25)] ring-2 ring-cyan-400/60 scale-[1.01]"
                : "border-white/10 bg-[#0B1020]/80 hover:border-white/30 hover:bg-[#0B1020] hover:scale-[1.008]"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                {heroCardsAba.todos.titulo}
              </span>
              <div className="flex items-center gap-2">
                {filtroHorario && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 font-bold">
                    ⏰ {filtroHorario.dia ? `${filtroHorario.dia} ` : ""}{filtroHorario.hora}h
                  </span>
                )}
                <div
                  className={`p-2 rounded-xl border transition-colors ${
                    filtroCanal === "todos"
                      ? "bg-cyan-500/20 border-cyan-400/50 text-cyan-300"
                      : "bg-white/[0.04] border-white/8 text-slate-300 group-hover:text-white"
                  }`}
                >
                  <Inbox className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1 mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white font-mono tracking-tight">
                  {heroCardsAba.todos.valor}
                </span>
                {heroCardsAba.todos.sufixo && (
                  <span className="text-xs font-bold text-cyan-300 font-mono">
                    {heroCardsAba.todos.sufixo}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">{heroCardsAba.todos.subtitulo}</p>
            </div>

            <div className="w-full bg-white/5 rounded-full h-1.5 mb-4 overflow-hidden">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: heroCardsAba.todos.barCss }}
              />
            </div>

            <div
              className={`pt-2 border-t flex items-center justify-between text-xs font-bold transition-colors ${
                filtroCanal === "todos"
                  ? "border-cyan-400/30 text-cyan-300"
                  : "border-white/8 text-indigo-400 group-hover:text-indigo-300"
              }`}
            >
              <span>
                {filtroCanal === "todos" ? heroCardsAba.todos.ctaAtivo : heroCardsAba.todos.ctaInativo}
              </span>
              {filtroCanal === "todos" ? (
                <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                  <Check className="w-3.5 h-3.5" /> Ativo
                </span>
              ) : (
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              )}
            </div>
          </div>

          {/* CARD 2: DIGITAL ONR */}
          <div
            role="button"
            tabIndex={0}
            aria-pressed={filtroCanal === "digital"}
            onClick={() => handleSelecionarCanal("digital")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelecionarCanal("digital");
              }
            }}
            className={`group relative flex flex-col justify-between rounded-[24px] border p-6 transition-all duration-300 cursor-pointer backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
              filtroCanal === "digital"
                ? "border-emerald-400/90 bg-[#0B1020] shadow-[0_0_28px_rgba(52,211,153,0.25)] ring-2 ring-emerald-400/60 scale-[1.01]"
                : "border-white/10 bg-[#0B1020]/80 hover:border-white/30 hover:bg-[#0B1020] hover:scale-[1.008]"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                {heroCardsAba.digital.titulo}
              </span>
              <div className="flex items-center gap-2">
                {filtroHorario && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 font-bold">
                    ⏰ {filtroHorario.dia ? `${filtroHorario.dia} ` : ""}{filtroHorario.hora}h
                  </span>
                )}
                <div
                  className={`p-2 rounded-xl border transition-colors ${
                    filtroCanal === "digital"
                      ? "bg-emerald-500/20 border-emerald-400/50 text-emerald-300"
                      : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  }`}
                >
                  <Laptop className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1 mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white font-mono tracking-tight">
                  {heroCardsAba.digital.valor}
                </span>
                {heroCardsAba.digital.sufixo && (
                  <span className="text-xs font-bold text-emerald-400 font-mono">
                    {heroCardsAba.digital.sufixo}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">{heroCardsAba.digital.subtitulo}</p>
              {activeTab === "servicos" &&
                "tiposLista" in heroCardsAba.digital &&
                Array.isArray(heroCardsAba.digital.tiposLista) &&
                heroCardsAba.digital.tiposLista.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-emerald-500/15 space-y-1">
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-emerald-300/90 font-semibold">
                      {heroCardsAba.digital.tiposLista.length} tipos de serviço ONR:
                    </span>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      {heroCardsAba.digital.tiposLista
                        .map((t) => `${t.nome} (${t.qtd.toLocaleString("pt-BR")})`)
                        .join(" · ")}
                    </p>
                  </div>
                )}
            </div>

            <div className="w-full bg-white/5 rounded-full h-1.5 mb-4 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: heroCardsAba.digital.barCss }}
              />
            </div>

            <div
              className={`pt-2 border-t flex items-center justify-between text-xs font-bold transition-colors ${
                filtroCanal === "digital"
                  ? "border-emerald-400/30 text-emerald-300"
                  : "border-white/8 text-emerald-400 group-hover:text-emerald-300"
              }`}
            >
              <span>
                {filtroCanal === "digital" ? heroCardsAba.digital.ctaAtivo : heroCardsAba.digital.ctaInativo}
              </span>
              {filtroCanal === "digital" ? (
                <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                  <Check className="w-3.5 h-3.5" /> Ativo
                </span>
              ) : (
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              )}
            </div>
          </div>

          {/* CARD 3: PRESENCIAL */}
          <div
            role="button"
            tabIndex={0}
            aria-pressed={filtroCanal === "presencial"}
            onClick={() => handleSelecionarCanal("presencial")}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleSelecionarCanal("presencial");
              }
            }}
            className={`group relative flex flex-col justify-between rounded-[24px] border p-6 transition-all duration-300 cursor-pointer backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-400 ${
              filtroCanal === "presencial"
                ? "border-sky-400/90 bg-[#0B1020] shadow-[0_0_28px_rgba(56,189,248,0.25)] ring-2 ring-sky-400/60 scale-[1.01]"
                : "border-white/10 bg-[#0B1020]/80 hover:border-white/30 hover:bg-[#0B1020] hover:scale-[1.008]"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                {heroCardsAba.presencial.titulo}
              </span>
              <div className="flex items-center gap-2">
                {filtroHorario && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/50 text-sky-300 font-bold">
                    ⏰ {filtroHorario.dia ? `${filtroHorario.dia} ` : ""}{filtroHorario.hora}h
                  </span>
                )}
                <div
                  className={`p-2 rounded-xl border transition-colors ${
                    filtroCanal === "presencial"
                      ? "bg-sky-500/20 border-sky-400/50 text-sky-300"
                      : "bg-sky-500/10 border-sky-500/20 text-sky-400"
                  }`}
                >
                  <Users className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1 mb-6">
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white font-mono tracking-tight">
                  {heroCardsAba.presencial.valor}
                </span>
                {heroCardsAba.presencial.sufixo && (
                  <span className="text-xs font-bold text-sky-400 font-mono">
                    {heroCardsAba.presencial.sufixo}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300">{heroCardsAba.presencial.subtitulo}</p>
              {activeTab === "servicos" &&
                "tiposLista" in heroCardsAba.presencial &&
                Array.isArray(heroCardsAba.presencial.tiposLista) &&
                heroCardsAba.presencial.tiposLista.length > 0 && (
                  <div className="mt-2.5 pt-2.5 border-t border-sky-500/15 space-y-1">
                    <span className="block text-[10px] font-mono uppercase tracking-wider text-sky-300/90 font-semibold">
                      {heroCardsAba.presencial.tiposLista.length} tipos de serviço presenciais:
                    </span>
                    <p className="text-[11px] leading-relaxed text-slate-400">
                      {heroCardsAba.presencial.tiposLista
                        .map((t) => `${t.nome} (${t.qtd.toLocaleString("pt-BR")})`)
                        .join(" · ")}
                    </p>
                  </div>
                )}
            </div>

            <div className="w-full bg-white/5 rounded-full h-1.5 mb-4 overflow-hidden">
              <div
                className="bg-sky-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: heroCardsAba.presencial.barCss }}
              />
            </div>

            <div
              className={`pt-2 border-t flex items-center justify-between text-xs font-bold transition-colors ${
                filtroCanal === "presencial"
                  ? "border-sky-400/30 text-sky-300"
                  : "border-white/8 text-sky-400 group-hover:text-sky-300"
              }`}
            >
              <span>
                {filtroCanal === "presencial"
                  ? heroCardsAba.presencial.ctaAtivo
                  : heroCardsAba.presencial.ctaInativo}
              </span>
              {filtroCanal === "presencial" ? (
                <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-400/40 text-sky-300">
                  <Check className="w-3.5 h-3.5" /> Ativo
                </span>
              ) : (
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              )}
            </div>
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* BARRA DE FILTROS (SINCRONIZADA INTELIGENTEMENTE COM OS CARDS) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="rounded-[22px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            {/* Data Inicial */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Data inicial
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (filtroHorario) setFiltroHorario(null);
                  }}
                  className="w-full rounded-xl bg-[#080D1A] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400/80 transition-colors"
                />
              </div>
            </div>

            {/* Data Final */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Data final
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    if (filtroHorario) setFiltroHorario(null);
                  }}
                  className="w-full rounded-xl bg-[#080D1A] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400/80 transition-colors"
                />
              </div>
            </div>

            {/* Seletor de Canal */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Canal (Filtro inteligente)
              </label>
              <div className="relative">
                <select
                  value={filtroCanal}
                  onChange={(e) => handleSelecionarCanal(e.target.value as CanalFiltro)}
                  className="w-full rounded-xl bg-[#080D1A] border border-cyan-500/40 px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-cyan-400 appearance-none transition-colors cursor-pointer"
                >
                  <option value="todos">{heroCardsAba.todos.resumoSelect}</option>
                  <option value="digital">{heroCardsAba.digital.resumoSelect}</option>
                  <option value="presencial">{heroCardsAba.presencial.resumoSelect}</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-cyan-400 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Botão Mais Filtros */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMaisFiltrosOpen(!isMaisFiltrosOpen)}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                  isMaisFiltrosOpen || filtroTipo !== "TODOS" || filtroColaborador !== "TODOS"
                    ? "bg-indigo-600/30 border-indigo-400 text-white"
                    : "bg-[#080D1A] border-white/15 text-slate-300 hover:text-white hover:bg-white/5"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                <span>Mais filtros</span>
                {(filtroTipo !== "TODOS" || filtroColaborador !== "TODOS") && (
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                )}
              </button>
            </div>
          </div>

          {/* Gaveta expansível de Mais Filtros */}
          {isMaisFiltrosOpen && (
            <div className="pt-3 border-t border-white/8 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end animate-in fade-in duration-200">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  Tipo de Registro
                </label>
                <select
                  value={filtroTipo}
                  onChange={(e) => setFiltroTipo(e.target.value)}
                  className="w-full rounded-xl bg-[#080D1A] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400/80 cursor-pointer"
                >
                  <option value="TODOS">Todos os tipos (Título e Certidão)</option>
                  <option value="TÍTULO">TÍTULO</option>
                  <option value="CERTIDÃO">CERTIDÃO</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                  Colaborador / Operador
                </label>
                <select
                  value={filtroColaborador}
                  onChange={(e) => setFiltroColaborador(e.target.value)}
                  className="w-full rounded-xl bg-[#080D1A] border border-white/15 px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400/80 cursor-pointer"
                >
                  <option value="TODOS">Todos os colaboradores</option>
                  {filtroColaborador !== "TODOS" &&
                    !colaboradoresDisponiveis.some(([nome]) => nome === filtroColaborador) && (
                      <option value={filtroColaborador}>{filtroColaborador}</option>
                    )}
                  {colaboradoresDisponiveis.map(([nome, canal]) => (
                    <option key={nome} value={nome}>
                      {nome} ({canal === "Digital ONR" ? "Digital" : "Balcão"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleLimparFiltros}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpar filtros secundários</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────── */}
        {/* SUB-FAIXA DE DESTAQUES INTELIGENTES (CONTEXTUAIS POR ABA)     */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* DESTAQUE 1 */}
          <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 p-5 shadow-lg space-y-1.5 transition-all duration-300">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                {destaquesPorAba.card1.label}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold shrink-0">
                {destaquesPorAba.card1.badge}
              </span>
            </div>
            <div className="text-base font-bold text-white tracking-tight">
              {destaquesPorAba.card1.titulo}
            </div>
            <p className="text-xs text-slate-300">{destaquesPorAba.card1.detalhe}</p>
          </div>

          {/* DESTAQUE 2 */}
          <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 p-5 shadow-lg space-y-1.5 transition-all duration-300">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                {destaquesPorAba.card2.label}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold shrink-0">
                {destaquesPorAba.card2.badge}
              </span>
            </div>
            <div className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>{destaquesPorAba.card2.titulo}</span>
              {activeTab === "visao_geral" && filtroCanal === "presencial" && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
                  Balcão
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300">{destaquesPorAba.card2.detalhe}</p>
          </div>

          {/* DESTAQUE 3 */}
          <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 p-5 shadow-lg space-y-1.5 transition-all duration-300">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                {destaquesPorAba.card3.label}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-bold shrink-0">
                {destaquesPorAba.card3.badge}
              </span>
            </div>
            <div className="text-base font-bold text-white tracking-tight">
              {destaquesPorAba.card3.titulo}
            </div>
            <p className="text-xs text-slate-300">{destaquesPorAba.card3.detalhe}</p>
          </div>
        </div>

        {/* LOADING PLACEHOLDER */}
        {loading && <FiorixSkeleton />}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* SEÇÕES ANALÍTICAS DA VISÃO GERAL (FLUXO DE ENTRADAS)          */}
        {/* ───────────────────────────────────────────────────────────── */}
        {!loading && activeTab === "visao_geral" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* ───────────────────────────────────────────────────────── */}
            {/* CARD HEATMAP: ENTRADA DE CERTIDÕES e TÍTULOS             */}
            {/* ───────────────────────────────────────────────────────── */}
            <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>ENTRADA DE CERTIDÕES e TÍTULOS</span>
                    <span className="text-[11px] font-normal text-cyan-300">
                      (Filtrado por: {filtroCanal === "todos" ? "Geral" : filtroCanal === "digital" ? "Digital ONR" : "Presencial"}
                      {filtroHorario
                        ? ` · ${filtroHorario.dia ? `${DIAS_NOMES[filtroHorario.dia]} às ` : "Faixa das "}${filtroHorario.hora}h`
                        : ""}
                      )
                    </span>
                  </h2>
                  <p className="text-xs text-slate-300">
                    Distribuição por dia da semana e hora · Clique em qualquer card de horário para filtrar todos os cards do painel
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {filtroHorario && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-400/60 text-cyan-300 text-xs font-bold shadow-[0_0_16px_rgba(6,182,212,0.35)] animate-in fade-in">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      <span>
                        {filtroHorario.dia ? `${DIAS_NOMES[filtroHorario.dia]} às ` : "Faixa das "}
                        {filtroHorario.hora}h
                        {` (${volumeCanalExibido.toLocaleString("pt-BR")} entradas)`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFiltroHorario(null);
                          toast.info("Filtro de horário removido. Exibindo todos os horários.");
                        }}
                        className="p-0.5 rounded-full hover:bg-white/20 text-cyan-200 hover:text-white transition-colors cursor-pointer"
                        title="Limpar filtro de horário"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>{destaquesExibidos.pico.badge}</span>
                  </div>
                </div>
              </div>

              {/* Grid do Heatmap Operacional (8h às 17h) */}
              <div className="overflow-x-auto pt-2">
                <div className="min-w-[680px] space-y-1.5">
                  <div className="flex items-center text-[10px] font-mono text-slate-300">
                    <div className="w-12 text-right pr-3 font-bold">Dia</div>
                    <div className="grid flex-1 grid-cols-10 gap-1.5">
                      {HORAS_HEATMAP.map((h) => {
                        const isColSelected = filtroHorario?.hora === h && filtroHorario?.dia === null;
                        return (
                          <button
                            key={h}
                            type="button"
                            onClick={() => handleToggleColunaHora(h)}
                            title={`Clique para filtrar todas as entradas das ${h}h (todos os dias)`}
                            className={`text-center font-bold py-1 px-0.5 rounded-md transition-all cursor-pointer ${
                              isColSelected
                                ? "bg-cyan-500/30 text-cyan-200 border border-cyan-400/70 shadow-[0_0_12px_rgba(6,182,212,0.5)] scale-105"
                                : "hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {h}h
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {DIAS_HEATMAP.map((dia) => (
                    <div key={dia.key} className="flex items-center">
                      <div className="w-12 text-right pr-3 text-xs font-semibold text-slate-300">
                        {dia.label}
                      </div>
                      <div className="grid flex-1 grid-cols-10 gap-1.5">
                        {HORAS_HEATMAP.map((hora) => {
                          const cell = matrizHeatmapAtiva[dia.key]?.[hora] || { level: 0, count: 0 };
                          const isSelected =
                            filtroHorario !== null &&
                            filtroHorario.hora === hora &&
                            (filtroHorario.dia === null || filtroHorario.dia === dia.key);
                          const isDimmed = filtroHorario !== null && !isSelected;

                          const colorClass = getCellColor(cell.level, cell.count);
                          const interactiveClass = isSelected
                            ? "ring-2 ring-cyan-400 scale-105 shadow-[0_0_20px_rgba(6,182,212,0.9)] z-20 brightness-125"
                            : isDimmed
                            ? "opacity-30 hover:opacity-85 hover:scale-105"
                            : "hover:scale-105 hover:z-10";

                          return (
                            <button
                              type="button"
                              key={hora}
                              onClick={() => handleToggleHorario(dia.key, hora, cell.count)}
                              title={`${dia.label}, ${hora}h: ${cell.count} entradas no canal ${filtroCanal}. Clique para filtrar todos os cards.`}
                              className={`h-9 rounded-md border flex items-center justify-center transition-all duration-200 cursor-pointer group relative ${colorClass} ${interactiveClass}`}
                            >
                              {cell.count > 0 && (
                                <span
                                  className={`text-[10px] font-mono leading-none ${
                                    cell.level === 4
                                      ? "font-black text-slate-900"
                                      : cell.level === 3
                                      ? "font-extrabold text-white"
                                      : cell.level === 2
                                      ? "font-bold text-white/95"
                                      : "font-semibold text-slate-300"
                                  }`}
                                >
                                  {cell.count}
                                </span>
                              )}
                              {isSelected && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Legenda do Heatmap */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-white/8 text-xs text-slate-300">
                <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>* Mostrando horários operacionais do cartório (8h às 17h)</span>
                  {hasRealData && (startDate || endDate) && (
                    <span>
                      · Período: {startDate ? formatarDataCurta(startDate) : "início"} a{" "}
                      {endDate ? formatarDataCurta(endDate) : "hoje"}
                    </span>
                  )}
                  {entradasForaDoMapa > 0 && (
                    <span className="text-amber-300/90">
                      · {entradasForaDoMapa.toLocaleString("pt-BR")} entradas fora das 8h–17h não aparecem no mapa
                    </span>
                  )}
                  {!hasRealData && <span className="text-amber-300/90">· Dados ilustrativos</span>}
                  <span className="text-cyan-400">· Clique em qualquer card de horário para filtrar o painel</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Menos</span>
                  <span className="w-3.5 h-3.5 rounded bg-[#0E1528] border border-white/10" />
                  <span className="w-3.5 h-3.5 rounded bg-slate-800" />
                  <span className="w-3.5 h-3.5 rounded bg-teal-600" />
                  <span className="w-3.5 h-3.5 rounded bg-emerald-500" />
                  <span className="w-3.5 h-3.5 rounded bg-amber-400 shadow-sm" />
                  <span>Mais (Pico)</span>
                </div>
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────── */}
            {/* CARD: Tipos de andamentos (REAGEM AO CANAL E AO HORÁRIO)  */}
            {/* ───────────────────────────────────────────────────────── */}
            <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Tipos de andamentos</h2>
                  <p className="text-xs text-slate-300">
                    Comparação direta do volume recebido no canal{" "}
                    <strong className="text-cyan-300 uppercase">{filtroCanal}</strong>
                    {filtroHorario && (
                      <span className="text-cyan-400 font-semibold">
                        {" "}· Faixa das {filtroHorario.hora}h{filtroHorario.dia ? ` (${filtroHorario.dia})` : ""}
                      </span>
                    )}
                  </p>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Total no canal:{" "}
                  <strong className="text-white">
                    {totaisExibidos[filtroCanal === "todos" ? "total" : filtroCanal].toLocaleString("pt-BR")}
                  </strong>
                </span>
              </div>

              <div className="space-y-4 pt-2">
                {andamentosExibidos.length === 0 && (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    Nenhum andamento registrado para o período e os filtros selecionados.
                  </p>
                )}
                {andamentosExibidos.map((item) => (
                  <div key={item.nome} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">{item.nome}</span>
                      <span className="font-mono text-slate-300">
                        {item.volume} · <strong className="text-cyan-300">{item.pct}</strong>
                      </span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400 h-2 rounded-full transition-all duration-500"
                        style={{ width: item.barPct }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────── */}
            {/* CARD: Volume ao longo do dia (CURVA ILUSTRATIVA REATIVA)  */}
            {/* ───────────────────────────────────────────────────────── */}
            <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Volume ao longo do dia
                  </h2>
                  <p className="text-xs text-slate-300">
                    Entradas por hora ·{" "}
                    {curvaVolume ? "dados reais do período" : "curva ilustrativa"} para{" "}
                    {filtroCanal === "todos" ? "todos os canais" : `canal ${filtroCanal}`}
                    {curvaVolume && filtroHorario?.dia ? ` · ${DIAS_NOMES[filtroHorario.dia] || filtroHorario.dia}` : ""}
                    {filtroHorario && (
                      <span className="text-cyan-400 font-bold ml-1">
                        (Foco na faixa das {filtroHorario.hora}h)
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                    <span className="text-slate-300">
                      Certidões: <strong className="text-white">{volumesExibidos.certidoes}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                    <span className="text-slate-300">
                      Títulos: <strong className="text-white">{volumesExibidos.titulos}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Visualização da Curva SVG Estilizada */}
              <div className="h-44 w-full pt-4 relative">
                <svg viewBox="0 0 500 120" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="gradCertidoesOficial" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="gradTitulosOficial" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#34D399" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  <line x1="30" y1="10" x2="490" y2="10" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="30" y1="55" x2="490" y2="55" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="30" y1="100" x2="490" y2="100" stroke="rgba(255,255,255,0.08)" />

                  <text x="5" y="14" fill="#94A3B8" fontSize="9" fontFamily="monospace">
                    {curvaVolume ? curvaVolume.max : filtroCanal === "presencial" ? "80" : "200"}
                  </text>
                  <text x="5" y="59" fill="#94A3B8" fontSize="9" fontFamily="monospace">
                    {curvaVolume ? Math.round(curvaVolume.max / 2) : filtroCanal === "presencial" ? "40" : "100"}
                  </text>
                  <text x="15" y="104" fill="#94A3B8" fontSize="9" fontFamily="monospace">0</text>

                  {curvaVolume ? (
                    <>
                      {filtroHorario && HORAS_HEATMAP.includes(filtroHorario.hora) && (
                        <line
                          x1={xDaHora(HORAS_HEATMAP.indexOf(filtroHorario.hora), HORAS_HEATMAP.length)}
                          x2={xDaHora(HORAS_HEATMAP.indexOf(filtroHorario.hora), HORAS_HEATMAP.length)}
                          y1="6"
                          y2="100"
                          stroke="rgba(34,211,238,0.55)"
                          strokeDasharray="3 3"
                        />
                      )}
                      <path d={curvaVolume.certidoes.linha} fill="none" stroke="#38BDF8" strokeWidth="2.5" />
                      <path d={curvaVolume.certidoes.area} fill="url(#gradCertidoesOficial)" />
                      <path d={curvaVolume.titulos.linha} fill="none" stroke="#34D399" strokeWidth="2.5" />
                      <path d={curvaVolume.titulos.area} fill="url(#gradTitulosOficial)" />
                      {HORAS_HEATMAP.map((h, i) => (
                        <text
                          key={h}
                          x={xDaHora(i, HORAS_HEATMAP.length)}
                          y="116"
                          textAnchor="middle"
                          fontSize="9"
                          fontFamily="monospace"
                          fill={filtroHorario?.hora === h ? "#67E8F9" : "#94A3B8"}
                          fontWeight={filtroHorario?.hora === h ? 800 : 400}
                        >
                          {String(h).padStart(2, "0")}h
                        </text>
                      ))}
                    </>
                  ) : filtroCanal === "presencial" ? (
                    <>
                      <path
                        d="M 30 100 Q 100 95, 180 25 T 280 65 T 380 40 T 490 100"
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M 30 100 Q 100 95, 180 25 T 280 65 T 380 40 T 490 100 L 490 100 L 30 100 Z"
                        fill="url(#gradCertidoesOficial)"
                      />

                      <path
                        d="M 30 100 Q 120 90, 180 50 T 290 55 T 390 75 T 490 100"
                        fill="none"
                        stroke="#34D399"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M 30 100 Q 120 90, 180 50 T 290 55 T 390 75 T 490 100 L 490 100 L 30 100 Z"
                        fill="url(#gradTitulosOficial)"
                      />
                    </>
                  ) : (
                    <>
                      <path
                        d="M 30 100 Q 120 95, 170 30 T 260 85 T 350 50 T 490 98"
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M 30 100 Q 120 95, 170 30 T 260 85 T 350 50 T 490 98 L 490 100 L 30 100 Z"
                        fill="url(#gradCertidoesOficial)"
                      />

                      <path
                        d="M 30 100 Q 140 98, 200 70 T 300 80 T 400 95 T 490 100"
                        fill="none"
                        stroke="#34D399"
                        strokeWidth="2.5"
                      />
                      <path
                        d="M 30 100 Q 140 98, 200 70 T 300 80 T 400 95 T 490 100 L 490 100 L 30 100 Z"
                        fill="url(#gradTitulosOficial)"
                      />
                    </>
                  )}
                </svg>

                {!curvaVolume && (
                <div className="flex justify-between text-[10px] font-mono text-slate-300 px-6 pt-2">
                  {[8, 10, 12, 14, 16, 17].map((h) => {
                    const isFocado = filtroHorario?.hora === h;
                    return (
                      <span
                        key={h}
                        className={`transition-colors ${
                          isFocado
                            ? "text-cyan-300 font-extrabold px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/50"
                            : ""
                        }`}
                      >
                        {String(h).padStart(2, "0")}h
                      </span>
                    );
                  })}
                </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* ABA PRODUTIVIDADE: INDICADORES, RANKING E PERFIL DA EQUIPE    */}
        {/* ───────────────────────────────────────────────────────────── */}
        {!loading && activeTab === "produtividade" && (
          <ProdutividadeEquipePanel
            registros={registrosProdutividade}
            filtroCanal={filtroCanal}
            filtroHorario={filtroHorario}
            filtroTipo={filtroTipo}
            colaboradorSelecionado={filtroColaborador}
            onSelecionarColaborador={handleSelecionarColaborador}
            isIlustrativo={!hasRealData}
          />
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* CARD PADRÃO FIORIX (1:1 ESPERA): LISTAGEM DE SERVIÇOS         */}
        {/* ───────────────────────────────────────────────────────────── */}
        {!loading && (activeTab === "visao_geral" || activeTab === "servicos") && (
          <div className="rounded-2xl sm:rounded-3xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-[#0B1020]/95 backdrop-blur-xl p-5 sm:p-6 shadow-sm dark:shadow-2xl space-y-4 animate-in fade-in duration-300">
            {/* Cabeçalho do Card (Idêntico à Espera) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/15 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-xs">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                      {filtroCanal === "digital"
                        ? "Serviços digitais · ONR"
                        : filtroCanal === "presencial"
                        ? "Serviços presenciais"
                        : "Todos os serviços"}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/25">
                      {servicosFiltrados.length.toLocaleString("pt-BR")} registros
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Monitoramento de protocolos únicos ({metricasServicosCanais[filtroCanal].protocolos.toLocaleString("pt-BR")}) e movimentações de recepção
                    {filtroHorario
                      ? ` · Filtrado às ${filtroHorario.hora}h${filtroHorario.dia ? ` (${DIAS_NOMES[filtroHorario.dia] || filtroHorario.dia})` : ""}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {/* Botão Imprimir Listagem no padrão Espera */}
                <div className="relative" ref={printMenuRef}>
                  <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/40 bg-slate-50 dark:bg-white/5 transition-all shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleImprimirListagem("todos")}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-xl hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                      title={`Imprimir toda a listagem filtrada (${totalServicosTabela.toLocaleString("pt-BR")} registros)`}
                    >
                      <Printer className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                      <span>Imprimir Listagem</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMenuImprimirAberto((prev) => !prev)}
                      className="px-2 py-1.5 rounded-r-xl border-l border-slate-200 dark:border-white/10 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 text-slate-500 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
                      title="Opções de impressão"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {menuImprimirAberto && (
                    <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-[#10172A] border border-white/15 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-white/10 mb-1">
                        Opções de Impressão
                      </div>
                      <button
                        type="button"
                        onClick={() => handleImprimirListagem("todos")}
                        className="flex items-start gap-2.5 w-full px-3 py-2 text-left rounded-lg text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                      >
                        <Printer className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-white">Toda a listagem filtrada</div>
                          <div className="text-[11px] text-slate-400">
                            {totalServicosTabela.toLocaleString("pt-BR")} registros filtrados
                          </div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleImprimirListagem("pagina")}
                        className="flex items-start gap-2.5 w-full px-3 py-2 text-left rounded-lg text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                      >
                        <Printer className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-white">Somente página atual</div>
                          <div className="text-[11px] text-slate-400">
                            {servicosPaginados.length.toLocaleString("pt-BR")} registros na página {paginaSeguraTabela}
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/40 bg-slate-50 dark:bg-white/5 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-300 transition-all cursor-pointer shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {/* Barra de Filtros, Busca e Ordenação em Linha Única (Idêntica à Espera) */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-1">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por protocolo, colaborador ou tipo de serviço..."
                  value={buscaTabela}
                  onChange={(e) => {
                    setBuscaTabela(e.target.value);
                    setPaginaAtual(1);
                  }}
                  className="w-full pl-10 pr-9 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-[#080d1a] text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/60 transition-all shadow-2xs"
                />
                {buscaTabela && (
                  <button
                    type="button"
                    onClick={() => {
                      setBuscaTabela("");
                      setPaginaAtual(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                    title="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                {/* Filtro 1: Tipo Documental */}
                <select
                  value={filtroTipo}
                  onChange={(e) => {
                    setFiltroTipo(e.target.value);
                    setPaginaAtual(1);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-[#080d1a] text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer shadow-2xs font-medium"
                  title="Filtrar por natureza documental"
                >
                  <option value="TODOS" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                    Todos os Tipos
                  </option>
                  <option value="CERTIDÃO" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                    Certidões
                  </option>
                  <option value="TÍTULO" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                    Títulos
                  </option>
                </select>

                {/* Filtro 2: Colaborador / Caixa */}
                <select
                  value={filtroColaborador}
                  onChange={(e) => {
                    setFiltroColaborador(e.target.value);
                    setPaginaAtual(1);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-[#080d1a] text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 cursor-pointer shadow-2xs font-medium max-w-[180px] truncate"
                  title="Filtrar por Colaborador"
                >
                  <option value="TODOS" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                    Todos Atendentes
                  </option>
                  {colaboradoresDisponiveis.map(([nome]) => (
                    <option
                      key={nome}
                      value={nome}
                      className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white"
                    >
                      {nome}
                    </option>
                  ))}
                </select>

                {/* Menu de Ordenação */}
                <div className="relative inline-flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-[#080d1a] px-3 py-2 text-xs text-slate-700 dark:text-slate-200 shadow-2xs">
                  <ArrowUpDown className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 mr-2 shrink-0" />
                  <select
                    value={`${sortBy}-${sortOrder}`}
                    onChange={(e) => {
                      const [col, ord] = e.target.value.split("-") as [ColunaOrdenacao, "asc" | "desc"];
                      setSortBy(col);
                      setSortOrder(ord);
                      setPaginaAtual(1);
                    }}
                    className="bg-transparent text-slate-800 dark:text-white font-medium text-xs focus:outline-none cursor-pointer pr-1"
                    title="Menu de ordenação"
                  >
                    <option value="dataHora-desc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                      Mais recentes (Data/Hora)
                    </option>
                    <option value="dataHora-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                      Mais antigos (Data/Hora)
                    </option>
                    <option value="numero-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                      Protocolo (Crescente)
                    </option>
                    <option value="numero-desc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                      Protocolo (Decrescente)
                    </option>
                    <option value="colaborador-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                      Colaborador (A → Z)
                    </option>
                    <option value="colaborador-desc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                      Colaborador (Z → A)
                    </option>
                    <option value="tipoDetalhado-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                      Tipo / Serviço (A → Z)
                    </option>
                    <option value="canal-asc" className="bg-white dark:bg-[#0B1020] text-slate-900 dark:text-white">
                      Canal (A → Z)
                    </option>
                  </select>
                </div>

                {(buscaTabela || filtroTipo !== "TODOS" || filtroColaborador !== "TODOS" || filtroHorario) && (
                  <button
                    type="button"
                    onClick={handleLimparFiltros}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer whitespace-nowrap px-1"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Tabela Formatada Padrão Fiorix (1:1 Espera) */}
            <div className="overflow-x-auto rounded-xl sm:rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/40 dark:bg-[#070b16]/70 shadow-inner">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/80 dark:bg-[#080811] text-[11px] font-mono uppercase text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-white/8 select-none">
                  <tr>
                    {(
                      [
                        { key: "numero", label: "Serviço" },
                        { key: "tipoDetalhado", label: "Tipo / Detalhe" },
                        { key: "dataHora", label: "Data / Hora" },
                        { key: "canal", label: "Canal" },
                        { key: "colaborador", label: "Colaborador" },
                      ] as const
                    ).map((col) => {
                      const ativo = sortBy === col.key;
                      return (
                        <th
                          key={col.key}
                          aria-sort={ativo ? (sortOrder === "asc" ? "ascending" : "descending") : "none"}
                          onClick={() => handleOrdenarColuna(col.key)}
                          title={`Clique para ordenar por ${col.label}`}
                          className={`py-3.5 px-4 cursor-pointer select-none transition-colors group ${
                            ativo
                              ? "text-indigo-600 dark:text-indigo-300 font-bold bg-indigo-50 dark:bg-indigo-500/10"
                              : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-white/[0.04]"
                          }`}
                        >
                          <div className="inline-flex items-center gap-1.5">
                            <span>{col.label}</span>
                            {ativo ? (
                              sortOrder === "asc" ? (
                                <ArrowUp className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-40 group-hover:opacity-100 transition-opacity shrink-0" />
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-white/6">
                  {servicosPaginados.length > 0 ? (
                    servicosPaginados.map((item) => {
                      const partesNome = (item.colaborador || "—").trim().split(/\s+/);
                      const iniciais =
                        partesNome.length >= 2
                          ? (partesNome[0][0] + partesNome[1][0]).toUpperCase()
                          : (item.colaborador || "SR").slice(0, 2).toUpperCase();
                      const isTitulo = item.tipo === "TÍTULO";

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors text-slate-300"
                        >
                          {/* Código do Protocolo / Serviço */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                              {String(item.numero).replace(/^#/, "")}
                            </span>
                          </td>

                          {/* Tipo / Detalhe como badge de serviço estilo Espera */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border ${
                                isTitulo
                                  ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                                  : "bg-cyan-50 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-500/30"
                              }`}
                            >
                              {item.tipoDetalhado}
                            </span>
                          </td>

                          {/* Data / Hora */}
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-xs text-slate-600 dark:text-slate-300">
                            {item.dataHora}
                          </td>

                          {/* Canal */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${
                                item.canal === "Digital ONR"
                                  ? "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/25"
                                  : "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/25"
                              }`}
                            >
                              {item.canal}
                            </span>
                          </td>

                          {/* Colaborador com Avatar de Iniciais */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-indigo-100 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-[10px] font-bold text-indigo-700 dark:text-indigo-300 shrink-0">
                                {iniciais}
                              </div>
                              <span className="text-xs font-medium text-slate-800 dark:text-slate-200 uppercase truncate max-w-[180px]">
                                {item.colaborador}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400">
                        Nenhum serviço encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Rodapé com Paginação Padrão Fiorix (Idêntico à Espera) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-3 border-t border-slate-100 dark:border-white/5 text-xs text-slate-600 dark:text-slate-400">
              <div className="text-center sm:text-left">
                Exibindo{" "}
                <strong className="text-slate-900 dark:text-white">
                  {indiceInicioTabela.toLocaleString("pt-BR")}
                </strong>{" "}
                a{" "}
                <strong className="text-slate-900 dark:text-white">
                  {indiceFimTabela.toLocaleString("pt-BR")}
                </strong>{" "}
                de{" "}
                <strong className="text-slate-900 dark:text-white">
                  {totalServicosTabela.toLocaleString("pt-BR")}
                </strong>{" "}
                registros
                {(buscaTabela || filtroTipo !== "TODOS" || filtroColaborador !== "TODOS" || filtroHorario) && (
                  <span className="ml-1 text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                    (filtrado)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end">
                <div className="flex items-center gap-1.5">
                  <span>Exibir:</span>
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0B1020] p-0.5">
                    {OPCOES_ITENS_PAGINA.map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => {
                          setItensPorPagina(size);
                          setPaginaAtual(1);
                        }}
                        className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                          itensPorPagina === size
                            ? "bg-gradient-to-r from-indigo-500 to-amber-500 text-white font-semibold shadow-xs"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={paginaSeguraTabela <= 1}
                    onClick={() => setPaginaAtual(1)}
                    className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                    title="Primeira Página"
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={paginaSeguraTabela <= 1}
                    onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                    className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                    title="Página Anterior"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <span className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200/60 dark:border-white/10">
                    {paginaSeguraTabela.toLocaleString("pt-BR")} / {totalPaginasTabela.toLocaleString("pt-BR")}
                  </span>

                  <button
                    type="button"
                    disabled={paginaSeguraTabela >= totalPaginasTabela}
                    onClick={() => setPaginaAtual((p) => Math.min(totalPaginasTabela, p + 1))}
                    className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                    title="Próxima Página"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={paginaSeguraTabela >= totalPaginasTabela}
                    onClick={() => setPaginaAtual(totalPaginasTabela)}
                    className="h-8 w-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0B1020] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                    title="Última Página"
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Rodapé Informativo */}
        <div className="text-center pt-4 pb-8 text-[11px] text-slate-400">
          Painel de Recepção do 7º RI de São Paulo · Gestão de fluxos por canal com filtros inteligentes e sincronização contínua
        </div>
      </div>
    </div>
  );
}
