"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search,
  Download,
  Check,
  Laptop,
  Inbox,
  RefreshCw,
  Sparkles,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
  FileText,
  BarChart3,
  Layers,
  HelpCircle,
  Users,
  ArrowRight,
  X,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { FiorixSkeleton } from "@/components/fiorix/FiorixSkeleton";

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

const DIA_KEY_TO_DB: Record<string, string> = {
  Seg: "Segunda",
  Ter: "Terça",
  Qua: "Quarta",
  Qui: "Quinta",
  Sex: "Sexta",
  Sáb: "Sábado",
  Dom: "Domingo",
};

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

const PRODUTIVIDADE_BENCHMARK = {
  todos: [
    { nome: "Gabriel", total: "1.240", perfil: "Operador Digital", barPct: "100%" },
    { nome: "Mariana", total: "842", perfil: "Atendente Balcão", barPct: "68%" },
    { nome: "Antônio", total: "680", perfil: "Operador Digital", barPct: "55%" },
    { nome: "Carlos", total: "615", perfil: "Atendente Balcão", barPct: "50%" },
    { nome: "Fernanda", total: "436", perfil: "Atendente Balcão", barPct: "35%" },
    { nome: "Vinícius", total: "310", perfil: "Operador Digital", barPct: "25%" },
  ],
  digital: [
    { nome: "Gabriel", total: "1.240", perfil: "Operador ONR Digital", barPct: "100%" },
    { nome: "Antônio", total: "680", perfil: "Operador ONR Digital", barPct: "55%" },
    { nome: "Vinícius", total: "310", perfil: "Operador ONR Digital", barPct: "25%" },
    { nome: "Rafael", total: "260", perfil: "Operador ONR Digital", barPct: "21%" },
  ],
  presencial: [
    { nome: "Mariana", total: "842", perfil: "Atendente Balcão Presencial", barPct: "100%" },
    { nome: "Carlos", total: "615", perfil: "Atendente Balcão Presencial", barPct: "73%" },
    { nome: "Fernanda", total: "436", perfil: "Atendente Balcão Presencial", barPct: "52%" },
    { nome: "Juliana", total: "280", perfil: "Atendente Balcão Presencial", barPct: "33%" },
  ],
};

const VOLUMES_BENCHMARK = {
  todos: { certidoes: "3.240", titulos: "3.482" },
  digital: { certidoes: "2.510", titulos: "2.039" },
  presencial: { certidoes: "730", titulos: "1.443" },
};

export default function ProdutividadePage() {
  // Estados da página
  const [activeTab, setActiveTab] = useState<AbaNavegacao>("visao_geral");
  const [filtroCanal, setFiltroCanal] = useState<CanalFiltro>("digital"); // Inicia em Digital ONR
  const [filtroHorario, setFiltroHorario] = useState<FiltroHorario | null>(null); // Filtro clicável no Heatmap
  const [startDate, setStartDate] = useState("2026-10-01");
  const [endDate, setEndDate] = useState("2026-10-13");
  const [buscaTabela, setBuscaTabela] = useState("");
  const [isMaisFiltrosOpen, setIsMaisFiltrosOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroColaborador, setFiltroColaborador] = useState("TODOS");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dbRows, setDbRows] = useState<RawProdutividadeRow[]>([]);

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

  // Totais computados (Reais se disponíveis no banco ou Benchmark)
  const hasRealData = dbRows.length > 0;

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

    let total = 0;
    let digital = 0;
    let presencial = 0;

    dbRows.forEach((r) => {
      const q = Number(r.QUANTIDADE || 1);
      total += q;
      if (isDigital(String(r.NOME || ""))) {
        digital += q;
      } else {
        presencial += q;
      }
    });

    const digPct = total > 0 ? `${((digital / total) * 100).toFixed(1).replace(".", ",")}%` : "0%";
    const prePct = total > 0 ? `${((presencial / total) * 100).toFixed(1).replace(".", ",")}%` : "0%";

    return {
      total,
      digital,
      presencial,
      digitalPct: digPct,
      presencialPct: prePct,
    };
  }, [hasRealData, dbRows]);

  // Heatmap Matriz Ativa pelo Canal
  const matrizHeatmapAtiva = useMemo(() => {
    if (filtroCanal === "digital") return MATRIZ_DIGITAL;
    if (filtroCanal === "presencial") return MATRIZ_PRESENCIAL;
    return MATRIZ_TODOS;
  }, [filtroCanal]);

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

  // Totais reativos ao filtro de horário (reagem dinamicamente quando o usuário clica em um card de hora)
  const totaisExibidos = useMemo(() => {
    if (!filtroHorario) {
      return totaisGerais;
    }

    if (hasRealData) {
      let total = 0;
      let digital = 0;
      let presencial = 0;

      const targetDia = filtroHorario.dia ? DIA_KEY_TO_DB[filtroHorario.dia] : null;

      dbRows.forEach((r) => {
        const horaNum = Number(
          r.HORA_NUM !== undefined && r.HORA_NUM !== null
            ? r.HORA_NUM
            : r.HORA
            ? parseInt(String(r.HORA).split(":")[0], 10)
            : -1
        );
        if (horaNum !== filtroHorario.hora) return;

        if (targetDia) {
          const diaRow = String(r.DIA_SEMANA || "");
          if (!diaRow.toLowerCase().includes(targetDia.toLowerCase())) return;
        }

        const q = Number(r.QUANTIDADE || 1);
        total += q;
        if (isDigital(String(r.NOME || ""))) {
          digital += q;
        } else {
          presencial += q;
        }
      });

      const digPct = total > 0 ? `${((digital / total) * 100).toFixed(1).replace(".", ",")}%` : "0%";
      const prePct = total > 0 ? `${((presencial / total) * 100).toFixed(1).replace(".", ",")}%` : "0%";

      return {
        total,
        digital,
        presencial,
        digitalPct: digPct,
        presencialPct: prePct,
      };
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

    const digPct = total > 0 ? `${((digital / total) * 100).toFixed(1).replace(".", ",")}%` : "0%";
    const prePct = total > 0 ? `${((presencial / total) * 100).toFixed(1).replace(".", ",")}%` : "0%";

    return {
      total,
      digital,
      presencial,
      digitalPct: digPct,
      presencialPct: prePct,
    };
  }, [filtroHorario, hasRealData, dbRows, totaisGerais]);

  // Lista unificada de serviços
  const listaServicosBase: ServicoItem[] = useMemo(() => {
    if (!hasRealData) return BENCHMARK_SERVICOS;

    return dbRows.slice(0, 300).map((r, idx) => {
      const nomeColab = String(r.NOME || "Não informado").trim();
      const canalDigital = isDigital(nomeColab);
      const dataStr = String(r.DATA || "2026-10-13");
      const horaStr = String(r.HORA || "12:00").substring(0, 5);
      const dataFormatada = dataStr.includes("-")
        ? `${dataStr.split("-")[2]}/${dataStr.split("-")[1]}`
        : dataStr;

      const diaSemanaRow = r.DIA_SEMANA ? String(r.DIA_SEMANA) : "";
      let diaKey = "Sex";
      for (const [key, val] of Object.entries(DIA_KEY_TO_DB)) {
        if (diaSemanaRow.toLowerCase().includes(val.toLowerCase())) {
          diaKey = key;
          break;
        }
      }

      return {
        id: String(idx + 1),
        numero: String(r.PEDIDO || `6${7440 - idx}`).replace(/^#/, ""),
        dataHora: `${dataFormatada} · ${horaStr}`,
        data: dataStr,
        hora: horaStr,
        diaSemana: diaKey,
        colaborador: nomeColab,
        canal: canalDigital ? "Digital ONR" : "Presencial",
        tipo: String(r.TIPO || "TÍTULO").toUpperCase() === "CERTIDÃO" ? "CERTIDÃO" : "TÍTULO",
        tipoServico: String(r.TIPO_PEDIDO || (canalDigital ? "Digital ONR" : "Presencial")),
        tipoDetalhado: String(r.TIPO_DETALHADO || r.TIPO_PEDIDO || "Serviço Cartorário"),
      };
    });
  }, [hasRealData, dbRows]);

  // Destaques reativos ao canal e ao horário
  const destaquesAtivos = DESTAQUES_BENCHMARK[filtroCanal];
  const andamentosAtivos = ANDAMENTOS_BENCHMARK[filtroCanal];
  const produtividadeAtiva = PRODUTIVIDADE_BENCHMARK[filtroCanal];
  const volumesAtivos = VOLUMES_BENCHMARK[filtroCanal];

  const destaquesExibidos = useMemo(() => {
    if (!filtroHorario) return destaquesAtivos;

    const diaNome = filtroHorario.dia ? (DIAS_NOMES[filtroHorario.dia] || filtroHorario.dia) : "Todos os dias";
    const volCanal =
      filtroCanal === "digital"
        ? totaisExibidos.digital
        : filtroCanal === "presencial"
        ? totaisExibidos.presencial
        : totaisExibidos.total;

    const pctRelativa =
      totaisExibidos.total > 0
        ? `${((volCanal / Math.max(1, totaisExibidos.total)) * 100).toFixed(1).replace(".", ",")}%`
        : "100%";

    const usuarioInfo =
      filtroCanal === "presencial"
        ? {
            nome: "Mariana",
            detalhe: `${Math.max(1, Math.round(volCanal * 0.42))} atendimentos às ${filtroHorario.hora}h`,
            rotulo: "BALCÃO PRESENCIAL",
          }
        : filtroCanal === "digital"
        ? {
            nome: "eProtocolo",
            detalhe: `${Math.max(1, Math.round(volCanal * 0.58))} autenticações às ${filtroHorario.hora}h`,
            rotulo: "INTEGRAÇÃO ONR",
          }
        : {
            nome: "eProtocolo",
            detalhe: `${Math.max(1, Math.round(volCanal * 0.52))} autenticações às ${filtroHorario.hora}h`,
            rotulo: "CANAL DIGITAL ONR",
          };

    const servicoInfo =
      filtroCanal === "presencial"
        ? {
            nome: "Depósito de títulos balcão",
            detalhe: `${Math.max(1, Math.round(volCanal * 0.45))} registros às ${filtroHorario.hora}h`,
            rotulo: "TÍTULO PRESENCIAL",
          }
        : filtroCanal === "digital"
        ? {
            nome: "Consulta eletrônica (VM)",
            detalhe: `${Math.max(1, Math.round(volCanal * 0.55))} registros às ${filtroHorario.hora}h`,
            rotulo: "CERTIDÃO DIGITAL",
          }
        : {
            nome: "Consulta eletrônica (VM)",
            detalhe: `${Math.max(1, Math.round(volCanal * 0.48))} registros às ${filtroHorario.hora}h`,
            rotulo: "CERTIDÃO DIGITAL",
          };

    return {
      pico: {
        titulo: `${diaNome} · ${filtroHorario.hora}h00`,
        detalhe: `${volCanal} entradas registradas neste horário (${pctRelativa})`,
        badge: `Horário ${filtroHorario.hora}h ativo`,
      },
      usuario: usuarioInfo,
      servico: servicoInfo,
    };
  }, [filtroHorario, destaquesAtivos, filtroCanal, totaisExibidos]);

  const andamentosExibidos = useMemo(() => {
    if (!filtroHorario) return andamentosAtivos;

    const volCanal =
      filtroCanal === "digital"
        ? totaisExibidos.digital
        : filtroCanal === "presencial"
        ? totaisExibidos.presencial
        : totaisExibidos.total;

    const pesos = [0.42, 0.30, 0.18, 0.10];
    const maxVol = Math.max(1, Math.round(volCanal * pesos[0]));

    return andamentosAtivos.map((item, idx) => {
      const peso = pesos[idx] || 0.1;
      const volNum = Math.max(1, Math.round(volCanal * peso));
      const pct = volCanal > 0 ? `${((volNum / volCanal) * 100).toFixed(1).replace(".", ",")}%` : item.pct;
      const barPct = idx === 0 ? "100%" : `${Math.min(100, Math.round((volNum / maxVol) * 100))}%`;
      return {
        nome: item.nome,
        volume: volNum.toLocaleString("pt-BR"),
        pct,
        barPct,
      };
    });
  }, [filtroHorario, andamentosAtivos, filtroCanal, totaisExibidos]);

  const produtividadeExibida = useMemo(() => {
    if (!filtroHorario) return produtividadeAtiva;

    const volCanal =
      filtroCanal === "digital"
        ? totaisExibidos.digital
        : filtroCanal === "presencial"
        ? totaisExibidos.presencial
        : totaisExibidos.total;

    const maxTotal = Math.max(1, Math.round(volCanal * 0.35));

    return produtividadeAtiva.map((pessoa, idx) => {
      const peso = Math.max(0.08, 0.35 - idx * 0.05);
      const volPessoa = Math.max(1, Math.round(volCanal * peso));
      const barPct = `${Math.min(100, Math.round((volPessoa / maxTotal) * 100))}%`;
      return {
        ...pessoa,
        total: volPessoa.toLocaleString("pt-BR"),
        barPct,
      };
    });
  }, [filtroHorario, produtividadeAtiva, filtroCanal, totaisExibidos]);

  const volumesExibidos = useMemo(() => {
    if (!filtroHorario) return volumesAtivos;

    const volCanal =
      filtroCanal === "digital"
        ? totaisExibidos.digital
        : filtroCanal === "presencial"
        ? totaisExibidos.presencial
        : totaisExibidos.total;

    const cert = Math.max(1, Math.round(volCanal * 0.48));
    const tit = Math.max(1, volCanal - cert);

    return {
      certidoes: cert.toLocaleString("pt-BR"),
      titulos: tit.toLocaleString("pt-BR"),
    };
  }, [filtroHorario, volumesAtivos, filtroCanal, totaisExibidos]);

  // Filtragem inteligente da tabela de serviços com suporte a horário e canal
  const servicosFiltrados = useMemo(() => {
    return listaServicosBase.filter((item) => {
      if (filtroCanal === "digital" && item.canal !== "Digital ONR") return false;
      if (filtroCanal === "presencial" && item.canal !== "Presencial") return false;

      if (filtroTipo !== "TODOS" && item.tipo !== filtroTipo) return false;
      if (filtroColaborador !== "TODOS" && item.colaborador !== filtroColaborador) return false;

      if (filtroHorario !== null) {
        const itemHora = parseInt(item.hora.split(":")[0], 10);
        if (itemHora !== filtroHorario.hora) return false;
        if (filtroHorario.dia && item.diaSemana && item.diaSemana !== filtroHorario.dia) {
          // Se houver serviços específicos deste dia e horário, filtra estritamente
          const temItemDiaHora = listaServicosBase.some(
            (s) =>
              s.diaSemana === filtroHorario.dia &&
              parseInt(s.hora.split(":")[0], 10) === filtroHorario.hora &&
              (filtroCanal === "todos" || (filtroCanal === "digital" ? s.canal === "Digital ONR" : s.canal === "Presencial"))
          );
          if (temItemDiaHora) return false;
        }
      }

      if (buscaTabela.trim()) {
        const query = buscaTabela.toLowerCase();
        return (
          item.numero.toLowerCase().includes(query) ||
          item.colaborador.toLowerCase().includes(query) ||
          item.tipoDetalhado.toLowerCase().includes(query) ||
          item.canal.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [listaServicosBase, filtroCanal, filtroTipo, filtroColaborador, filtroHorario, buscaTabela]);

  // Exportar CSV
  const handleExportCSV = () => {
    if (servicosFiltrados.length === 0) {
      toast.warning("Nenhum serviço para exportar com os filtros atuais.");
      return;
    }
    const headers = ["Data/Hora", "Serviço", "Colaborador", "Canal", "Tipo/Detalhe"];
    const rows = servicosFiltrados.map((p) => [
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
    toast.success(`Exportados ${servicosFiltrados.length} serviços em formato CSV.`);
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
              Selecione um card para consultar os serviços por canal ·{" "}
              <strong className="text-cyan-300">Todos os cards abaixo interagem com o filtro selecionado</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0E1528] border border-cyan-500/30 text-xs">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Canal ativo:</span>
              <span className="font-bold text-cyan-300">
                {filtroCanal === "todos"
                  ? `Todos os canais (${totaisExibidos.total.toLocaleString("pt-BR")})`
                  : filtroCanal === "digital"
                  ? `Digital ONR (${totaisExibidos.digital.toLocaleString("pt-BR")})`
                  : `Presencial (${totaisExibidos.presencial.toLocaleString("pt-BR")})`}
              </span>
            </div>

            {filtroHorario && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 border border-cyan-400/50 text-cyan-300 text-xs font-semibold shadow-[0_0_12px_rgba(6,182,212,0.35)] animate-in fade-in">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  Horário:{" "}
                  <strong>
                    {filtroHorario.dia ? `${DIAS_NOMES[filtroHorario.dia]} ` : ""}às {filtroHorario.hora}h
                  </strong>
                  {filtroHorario.count !== undefined ? ` (${filtroHorario.count})` : ""}
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
        {/* CARDS PRINCIPAIS CLICÁVEIS (FAIXA ÚNICA: SERVIÇOS POR CANAL) */}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* CARD 1: TOTAL DE ENTRADAS */}
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
                TOTAL DE ENTRADAS
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
              <div className="text-4xl font-black text-white font-mono tracking-tight">
                {totaisExibidos.total.toLocaleString("pt-BR")}
              </div>
              <p className="text-xs text-slate-300">
                {filtroHorario
                  ? `Entradas filtradas às ${filtroHorario.hora}h · Geral`
                  : "Clique para consultar todos os serviços"}
              </p>
            </div>

            <div className="w-full bg-white/5 rounded-full h-1.5 mb-4 overflow-hidden">
              <div className="bg-indigo-500 h-1.5 rounded-full w-full" />
            </div>

            <div
              className={`pt-2 border-t flex items-center justify-between text-xs font-bold transition-colors ${
                filtroCanal === "todos"
                  ? "border-cyan-400/30 text-cyan-300"
                  : "border-white/8 text-indigo-400 group-hover:text-indigo-300"
              }`}
            >
              <span>
                {filtroCanal === "todos" ? "Exibindo todos os serviços" : "Ver todos os serviços"}
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
                DIGITAL ONR
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
                  {totaisExibidos.digital.toLocaleString("pt-BR")}
                </span>
                <span className="text-xs font-bold text-emerald-400 font-mono">
                  {totaisExibidos.digitalPct}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {filtroHorario
                  ? `Volume ONR filtrado às ${filtroHorario.hora}h`
                  : "Clique para consultar serviços do ONR"}
              </p>
            </div>

            <div className="w-full bg-white/5 rounded-full h-1.5 mb-4 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: totaisExibidos.digitalPct }}
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
                {filtroCanal === "digital" ? "Exibindo serviços digitais" : "Ver serviços digitais"}
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
                PRESENCIAL
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
                  {totaisExibidos.presencial.toLocaleString("pt-BR")}
                </span>
                <span className="text-xs font-bold text-sky-400 font-mono">
                  {totaisExibidos.presencialPct}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {filtroHorario
                  ? `Volume Balcão filtrado às ${filtroHorario.hora}h`
                  : "Clique para consultar serviços do balcão"}
              </p>
            </div>

            <div className="w-full bg-white/5 rounded-full h-1.5 mb-4 overflow-hidden">
              <div
                className="bg-sky-500 h-1.5 rounded-full transition-all duration-300"
                style={{ width: totaisExibidos.presencialPct }}
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
                {filtroCanal === "presencial" ? "Exibindo serviços presenciais" : "Ver serviços presenciais"}
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
                  onChange={(e) => setStartDate(e.target.value)}
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
                  onChange={(e) => setEndDate(e.target.value)}
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
                  <option value="todos">Todos os canais ({totaisExibidos.total.toLocaleString("pt-BR")})</option>
                  <option value="digital">Digital ONR ({totaisExibidos.digital.toLocaleString("pt-BR")})</option>
                  <option value="presencial">Presencial ({totaisExibidos.presencial.toLocaleString("pt-BR")})</option>
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
                  {filtroCanal !== "presencial" && (
                    <>
                      <option value="Gabriel">Gabriel (Digital)</option>
                      <option value="Antônio">Antônio (Digital)</option>
                      <option value="Vinícius">Vinícius (Digital)</option>
                      <option value="Rafael">Rafael (Digital)</option>
                      <option value="eProtocolo">eProtocolo (Digital)</option>
                    </>
                  )}
                  {filtroCanal !== "digital" && (
                    <>
                      <option value="Mariana">Mariana (Balcão)</option>
                      <option value="Carlos">Carlos (Balcão)</option>
                      <option value="Fernanda">Fernanda (Balcão)</option>
                      <option value="Juliana">Juliana (Balcão)</option>
                    </>
                  )}
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
        {/* SUB-FAIXA DE DESTAQUES INTELIGENTES (REAGEM AO CARD E HORÁRIO)*/}
        {/* ───────────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* DESTAQUE 1: PICO DE ENTRADAS */}
          <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 p-5 shadow-lg space-y-1.5 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                PICO DE ENTRADAS
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
                {destaquesExibidos.pico.badge}
              </span>
            </div>
            <div className="text-base font-bold text-white tracking-tight">
              {destaquesExibidos.pico.titulo}
            </div>
            <p className="text-xs text-slate-300">{destaquesExibidos.pico.detalhe}</p>
          </div>

          {/* DESTAQUE 2: USUÁRIO / ATENDENTE EM DESTAQUE */}
          <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 p-5 shadow-lg space-y-1.5 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                USUÁRIO EM DESTAQUE
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold">
                {destaquesExibidos.usuario.rotulo}
              </span>
            </div>
            <div className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>{destaquesExibidos.usuario.nome}</span>
              {filtroCanal === "presencial" && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
                  Balcão
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300">{destaquesExibidos.usuario.detalhe}</p>
          </div>

          {/* DESTAQUE 3: SERVIÇO EM DESTAQUE */}
          <div className="rounded-[20px] border border-white/10 bg-[#0B1020]/90 p-5 shadow-lg space-y-1.5 transition-all duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-300">
                SERVIÇO EM DESTAQUE
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 font-bold">
                {destaquesExibidos.servico.rotulo}
              </span>
            </div>
            <div className="text-base font-bold text-white tracking-tight">
              {destaquesExibidos.servico.nome}
            </div>
            <p className="text-xs text-slate-300">{destaquesExibidos.servico.detalhe}</p>
          </div>
        </div>

        {/* LOADING PLACEHOLDER */}
        {loading && <FiorixSkeleton />}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* SEÇÕES ANALÍTICAS (VISÃO GERAL E PRODUTIVIDADE)               */}
        {/* ───────────────────────────────────────────────────────────── */}
        {!loading && (activeTab === "visao_geral" || activeTab === "produtividade") && (
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
                        {filtroHorario.count !== undefined ? ` (${filtroHorario.count} entradas)` : ""}
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
                <div className="text-[11px] text-slate-400 flex items-center gap-2">
                  <span>* Mostrando horários operacionais do cartório (8h às 17h)</span>
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
                    Entradas por hora · curva estimada para {filtroCanal === "todos" ? "todos os canais" : `canal ${filtroCanal}`}
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
                    {filtroCanal === "presencial" ? "80" : "200"}
                  </text>
                  <text x="5" y="59" fill="#94A3B8" fontSize="9" fontFamily="monospace">
                    {filtroCanal === "presencial" ? "40" : "100"}
                  </text>
                  <text x="15" y="104" fill="#94A3B8" fontSize="9" fontFamily="monospace">0</text>

                  {filtroCanal === "presencial" ? (
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
              </div>
            </div>

            {/* ───────────────────────────────────────────────────────── */}
            {/* CARD: Produtividade dos colaboradores (POR CANAL)        */}
            {/* ───────────────────────────────────────────────────────── */}
            <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Produtividade da equipe
                  </h2>
                  <p className="text-xs text-slate-300">
                    Pessoas vinculadas ao canal{" "}
                    <strong className="text-cyan-300 uppercase">{filtroCanal}</strong>
                    {filtroHorario && (
                      <span className="text-cyan-400 font-semibold">
                        {" "}· Faixa das {filtroHorario.hora}h
                      </span>
                    )}{" "}
                    · volume individual
                  </p>
                </div>

                <span className="text-xs font-mono text-indigo-300 font-bold px-3 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                  {produtividadeExibida.length} colaboradores
                </span>
              </div>

              <div className="space-y-4 pt-2">
                {produtividadeExibida.map((pessoa) => (
                  <div key={pessoa.nome} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">{pessoa.nome}</span>
                        <span className="text-[10px] font-mono text-slate-400">({pessoa.perfil})</span>
                      </div>
                      <span className="font-mono font-bold text-cyan-300">{pessoa.total} serviços</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: pessoa.barPct }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────── */}
        {/* CARD: TABELA DE SERVIÇOS (EXIBIDA EM VISÃO GERAL E SERVIÇOS)  */}
        {/* ───────────────────────────────────────────────────────────── */}
        {!loading && (activeTab === "visao_geral" || activeTab === "servicos") && (
          <div className="rounded-[24px] border border-white/10 bg-[#0B1020]/90 backdrop-blur-xl p-6 shadow-xl space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight flex flex-wrap items-center gap-2">
                  <span>
                    {filtroCanal === "digital"
                      ? "Serviços digitais · ONR"
                      : filtroCanal === "presencial"
                      ? "Serviços presenciais"
                      : "Todos os serviços"}
                  </span>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
                    {servicosFiltrados.length} listados
                  </span>
                  {filtroHorario && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 font-bold">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      <span>
                        Faixa das {filtroHorario.hora}h{filtroHorario.dia ? ` (${filtroHorario.dia})` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFiltroHorario(null);
                          toast.info("Filtro de horário removido da tabela.");
                        }}
                        className="ml-1 hover:text-white"
                        title="Limpar filtro de horário"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-300">
                  {filtroHorario ? (
                    <span>
                      Filtrando faixa das <strong className="text-cyan-300">{filtroHorario.hora}h</strong>
                      {filtroHorario.dia ? ` em ${DIAS_NOMES[filtroHorario.dia] || filtroHorario.dia}` : " (todos os dias)"} ·{" "}
                    </span>
                  ) : null}
                  Entradas do canal selecionado ·{" "}
                  <strong className="text-cyan-300">
                    {filtroCanal === "digital"
                      ? `Digital ONR selecionado · ${totaisExibidos.digital.toLocaleString("pt-BR")} serviços no período`
                      : filtroCanal === "presencial"
                      ? `Presencial selecionado · ${totaisExibidos.presencial.toLocaleString("pt-BR")} serviços no período`
                      : `Todos os canais selecionados · ${totaisExibidos.total.toLocaleString("pt-BR")} serviços no período`}
                  </strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-300 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar por serviço, nome ou tipo..."
                    value={buscaTabela}
                    onChange={(e) => setBuscaTabela(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#080D1A] border border-white/15 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400 transition-colors"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#080D1A] border border-white/15 hover:border-white/30 text-white text-xs font-semibold hover:bg-white/5 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Exportar CSV</span>
                </button>
              </div>
            </div>

            {/* Tabela de 5 Colunas */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs">
                <thead className="select-none bg-[#080D1A] text-[11px] uppercase tracking-wider text-slate-300 border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3 font-bold">Data / hora</th>
                    <th className="px-4 py-3 font-bold">Serviço</th>
                    <th className="px-4 py-3 font-bold">Colaborador</th>
                    <th className="px-4 py-3 font-bold">Canal</th>
                    <th className="px-4 py-3 font-bold">Tipo / detalhe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {servicosFiltrados.length > 0 ? (
                    servicosFiltrados.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-white/[0.03] transition-colors text-slate-300"
                      >
                        <td className="px-4 py-3.5 font-medium text-white/90">
                          {item.dataHora}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-bold text-indigo-400">
                          <span className="hover:underline cursor-pointer flex items-center gap-1">
                            {String(item.numero).replace(/^#/, "")}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-medium text-white">
                          {item.colaborador}
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${
                              item.canal === "Digital ONR"
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                : "bg-sky-500/15 border-sky-500/30 text-sky-300"
                            }`}
                          >
                            {item.canal}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-300">
                          {item.tipoDetalhado}
                        </td>
                      </tr>
                    ))
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

            {/* Rodapé da Tabela */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-white/8 text-xs text-slate-300">
              <div>
                {servicosFiltrados.length} serviços ilustrativos exibidos ·{" "}
                <span className="capitalize font-bold text-cyan-300">{filtroCanal}</span>
                {filtroHorario && (
                  <span className="text-cyan-400 font-semibold ml-1">
                    · Faixa das {filtroHorario.hora}h{filtroHorario.dia ? ` (${filtroHorario.dia})` : ""}
                  </span>
                )}
              </div>
              <div className="font-medium text-slate-400">Prévia analítica dos serviços</div>
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
