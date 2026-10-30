'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  Printer,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  RotateCw,
  Info,
  Image as ImageIcon,
  Loader2,
  Check,
  Wand2,
  ArrowLeft,
  X,
  Eye,
  BookOpen,
  AlertTriangle,
  ScrollText,
  Plus,
  Search,
  RotateCcw,
  Save,
  Archive,
  Download,
} from 'lucide-react';
import { ConfidenceReview, OrigemCampoUI } from './ConfidenceReview';
import { ValidacaoAutenticidadeView } from './ValidacaoAutenticidadeView';
import { formatCartorioPath, getRootInfo } from './DocumentSearch';
import { extrairConfrontacoes, ConfrontacoesExtraidas } from '@/lib/confrontacoes';

export interface DadosManifestacao {
  id_ficha: string;
  buscas_feitas_em: string;
  tipo_processo: string;
  numero_processo: string;
  vara: string;
  data_chegada: string;
  requerente: string;
  imovel: string;
  rua_olhar_confrontacao: string;
  contribuinte_sql: string;
  contribuinte_nao_averbado?: boolean;
  fls_inicial: string;
  fls_laudo: string;
  matricula_transcricao: string;
  cartorio_origem: string;
  fls_certidao_origem: string;
  titular_origem: string;
  resultado_buscas: string;
  subdistrito: string;
  data_competencia_subdistrito: string;
  confrontante_lado_direito: string;
  confrontante_lado_esquerdo: string;
  confrontante_fundos: string;
  transcricoes_anexas: string;
  matriculas_anexas: string;
  cartorio_encaminhamento: string;
  anotacoes_ficha_oficial: string;
  escrevente_pasta: string;
  pagina_inicial_detectada: number;
  pagina_final_detectada: number;
  total_paginas_pdf: number;
  origem_campos?: OrigemCampoUI[];
}

export const SUBDISTRITOS_7RI = [
  { nome: 'ALTO DA MOÓCA', cartorioSugerido: '3º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
  { nome: 'BELENZINHO', cartorioSugerido: '3º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
  { nome: 'MOÓCA', cartorioSugerido: '3º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
  { nome: 'BRÁS', cartorioSugerido: '3º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
  { nome: 'PARI', cartorioSugerido: '3º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
  { nome: 'TATUAPÉ', cartorioSugerido: '3º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
  { nome: 'ITAQUERA', cartorioSugerido: '9º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
  { nome: 'GUAIANAZES', cartorioSugerido: '9º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
  { nome: 'SÃO MIGUEL PAULISTA', cartorioSugerido: '12º Oficial de Registro de Imóveis da Capital', competencia: 'Circunscrição atribuída ao 12º Registro de Imóveis da Capital' },
  { nome: 'ERMELINO MATARAZZO', cartorioSugerido: '12º Oficial de Registro de Imóveis da Capital', competencia: 'Circunscrição atribuída ao 12º Registro de Imóveis da Capital' },
  { nome: 'CANGAÍBA', cartorioSugerido: '12º Oficial de Registro de Imóveis da Capital', competencia: 'Circunscrição atribuída ao 12º Registro de Imóveis da Capital' },
  { nome: 'PENHA DE FRANÇA', cartorioSugerido: '12º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
  { nome: 'VILA PRUDENTE', cartorioSugerido: '6º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
  { nome: 'VILA FORMOSA', cartorioSugerido: '3º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
  { nome: 'VILA MATILDE', cartorioSugerido: '12º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
];

export const ESCREVENTES_USUCAPIAO = ['CFALANGA', 'Bruno', 'DIEGO', 'LUCAS', 'TATIANA', 'YULLI'];

export interface SugestaoCampo {
  valor: string;
  motivo: string;
  sugerido: boolean;
  confianca: 'alta' | 'media';
}

export interface ConjuntoSugestoes {
  escrevente: SugestaoCampo;
  subdistrito: SugestaoCampo;
  resultadoBuscas: SugestaoCampo;
  cartorioEncaminhamento: SugestaoCampo;
  dataCompetencia: string;
  confrontacoes: ConfrontacoesExtraidas;
}

export function inferirSugestoesInteligentes(
  dados: DadosManifestacao,
  arquivoOrigem?: { name: string; relativePath: string } | null
): ConjuntoSugestoes {
  const normalizar = (txt: string) =>
    (txt || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ');

  const textoImovelNorm = normalizar(dados.imovel || '');
  const textoGeral = [
    dados.imovel,
    dados.rua_olhar_confrontacao,
    dados.anotacoes_ficha_oficial,
    dados.matricula_transcricao,
    dados.cartorio_origem,
    dados.titular_origem,
    dados.requerente,
    ...(dados.origem_campos || []).map(o => o.trecho || ''),
    arquivoOrigem?.name,
    arquivoOrigem?.relativePath,
  ].filter(Boolean).join('\n');
  const textoGeralNorm = normalizar(textoGeral);

  // Extrai confrontações perimetrais do conjunto documental disponível
  const confrontacoesExtraidas = extrairConfrontacoes(textoGeral);

  // --- 1. SUBDISTRITO TERRITORIAL ---
  let subdistritoFinal = 'ALTO DA MOÓCA';
  let subdistritoMotivo = 'Padrão da 7ª Circunscrição Imobiliária';
  let subdistritoConfianca: 'alta' | 'media' = 'media';
  let subdistritoSugerido = false;

  const regrasSubdistrito = [
    { nome: 'GUAIANAZES', termos: ['guaianazes', 'guaianases', 'guianazes'] },
    { nome: 'ITAQUERA', termos: ['itaquera'] },
    { nome: 'ALTO DA MOÓCA', termos: ['alto da mooca', 'alto mooca', 'alto de mooca'] },
    { nome: 'BELENZINHO', termos: ['belenzinho', 'belem'] },
    { nome: 'MOÓCA', termos: ['mooca'] },
    { nome: 'BRÁS', termos: ['bras'] },
    { nome: 'PARI', termos: ['pari'] },
    { nome: 'TATUAPÉ', termos: ['tatuape'] },
    { nome: 'SÃO MIGUEL PAULISTA', termos: ['sao miguel paulista', 'sao miguel', 'miguei paulista'] },
    { nome: 'ERMELINO MATARAZZO', termos: ['ermelino matarazzo', 'ermelino'] },
    { nome: 'CANGAÍBA', termos: ['cangaiba'] },
    { nome: 'PENHA DE FRANÇA', termos: ['penha de franca', 'penha de frança', 'penha'] },
    { nome: 'VILA PRUDENTE', termos: ['vila prudente'] },
    { nome: 'VILA FORMOSA', termos: ['vila formosa'] },
    { nome: 'VILA MATILDE', termos: ['vila matilde'] },
  ];

  let achouSub = false;
  for (const reg of regrasSubdistrito) {
    for (const termo of reg.termos) {
      const regex = new RegExp(`\\b${termo}\\b`, 'i');
      if (regex.test(textoImovelNorm)) {
        subdistritoFinal = reg.nome;
        subdistritoMotivo = `Detectado no imóvel: "${termo}"`;
        subdistritoConfianca = 'alta';
        subdistritoSugerido = true;
        achouSub = true;
        break;
      }
    }
    if (achouSub) break;
  }

  if (!achouSub) {
    for (const reg of regrasSubdistrito) {
      for (const termo of reg.termos) {
        const regex = new RegExp(`\\b${termo}\\b`, 'i');
        if (regex.test(textoGeralNorm)) {
          subdistritoFinal = reg.nome;
          subdistritoMotivo = `Detectado no texto da petição/certidão (OCR)`;
          subdistritoConfianca = 'alta';
          subdistritoSugerido = true;
          achouSub = true;
          break;
        }
      }
      if (achouSub) break;
    }
  }

  if (!achouSub && dados.subdistrito && dados.subdistrito !== 'ALTO DA MOÓCA') {
    subdistritoFinal = dados.subdistrito;
    subdistritoMotivo = 'Mantido conforme dados existentes';
    subdistritoConfianca = 'media';
  }

  const dadosSub = SUBDISTRITOS_7RI.find(s => s.nome.toUpperCase() === subdistritoFinal.toUpperCase());
  const cartorioCompetenciaHistorica = dadosSub?.cartorioSugerido || '3º Oficial de Registro de Imóveis da Capital';
  const dataCompetenciaFinal = dadosSub?.competencia || '23 de dezembro de 1.938';

  // --- 2. CARTÓRIO DE ENCAMINHAMENTO ---
  let cartorioFinal = cartorioCompetenciaHistorica;
  let cartorioMotivo = `Circunscrição histórica sobre ${subdistritoFinal} antes de 1938`;
  let cartorioConfianca: 'alta' | 'media' = 'alta';
  let cartorioSugerido = true;

  const matchCartorio = (dados.cartorio_origem || dados.cartorio_encaminhamento || '') + ' ' + textoGeralNorm;
  const matchNum = matchCartorio.match(/(?:digno\s+)?(\d{1,2})[ºoªa°]?\s*(?:oficial|oficio|cartorio|registro\s+de\s+imoveis|cri|ri)\b/i);
  if (matchNum && matchNum[1]) {
    const num = matchNum[1];
    if (num === '7') {
      cartorioFinal = '7º Cartório de Registro de Imóveis da Capital';
      cartorioMotivo = 'Imóvel com assento originário na 7ª Circunscrição';
    } else {
      cartorioFinal = `${num}º Oficial de Registro de Imóveis da Capital`;
      cartorioMotivo = `Cartório ${num}º expressamente citado nos autos`;
    }
  } else if (
    dados.matricula_transcricao &&
    /7[ºoªa°]?\s*(?:oficial|cri|cartorio)/i.test(dados.matricula_transcricao)
  ) {
    cartorioFinal = '7º Cartório de Registro de Imóveis da Capital';
    cartorioMotivo = 'Matrícula com assento principal na 7ª Circunscrição';
  }

  // --- 3. RESULTADO DAS BUSCAS ---
  let resultadoFinal = 'NEGATIVAS';
  let resultadoMotivo = 'Buscas no 7º RI negativas (área de serventia anterior)';
  let resultadoConfianca: 'alta' | 'media' = 'alta';
  let resultadoSugerido = true;

  if (/\b(?:negativas?|nao consta registro|nenhum registro|pesquisa negativa)\b/i.test(textoGeralNorm)) {
    resultadoFinal = 'NEGATIVAS';
    resultadoMotivo = 'Confirmado nos autos (Indicador Real e Pessoal sem registro no 7º)';
    resultadoConfianca = 'alta';
  } else if (/\b(?:positivas?|matricula ativa no 7|buscas resultaram positivas)\b/i.test(textoGeralNorm)) {
    resultadoFinal = 'POSITIVAS';
    resultadoMotivo = 'Registro imobiliário ativo localizado no 7º RI';
    resultadoConfianca = 'alta';
  } else if (cartorioFinal === '7º Cartório de Registro de Imóveis da Capital') {
    resultadoFinal = 'POSITIVAS';
    resultadoMotivo = 'Imóvel sob assento da própria 7ª Serventia (buscas positivas)';
    resultadoConfianca = 'media';
  }

  // --- 4. ESCREVENTE RESPONSÁVEL ---
  let escreventeFinal = 'CFALANGA';
  let escreventeMotivo = 'Escrevente de Usucapião';
  let escreventeConfianca: 'alta' | 'media' = 'media';
  let escreventeSugerido = false;

  const caminhoCompleto = (arquivoOrigem?.relativePath || '') + ' ' + (arquivoOrigem?.name || '');
  for (const esc of ESCREVENTES_USUCAPIAO) {
    const regex = new RegExp(`[\\\\/\\s_]${esc}[\\\\/\\s_]`, 'i');
    if (regex.test(caminhoCompleto) || caminhoCompleto.toLowerCase().startsWith(esc.toLowerCase())) {
      escreventeFinal = esc;
      escreventeMotivo = `Pasta de trabalho do escrevente no servidor ("${esc}")`;
      escreventeConfianca = 'alta';
      escreventeSugerido = true;
      break;
    }
  }

  if (!escreventeSugerido) {
    for (const esc of ESCREVENTES_USUCAPIAO) {
      const regex = new RegExp(`(?:escrevente|autor|conferido por)[^\\n\\r]{0,30}\\b${esc}\\b`, 'i');
      if (regex.test(textoGeralNorm) || new RegExp(`\\b${esc}\\b`, 'i').test(dados.escrevente_pasta || '')) {
        escreventeFinal = esc;
        escreventeMotivo = `Detectado na assinatura / autoria da manifestação ("${esc}")`;
        escreventeConfianca = 'alta';
        escreventeSugerido = true;
        break;
      }
    }
  }

  if (!escreventeSugerido && dados.escrevente_pasta && ESCREVENTES_USUCAPIAO.includes(dados.escrevente_pasta)) {
    escreventeFinal = dados.escrevente_pasta;
    escreventeMotivo = 'Definido na ficha técnica';
  }

  return {
    subdistrito: {
      valor: subdistritoFinal,
      motivo: subdistritoMotivo,
      sugerido: subdistritoSugerido,
      confianca: subdistritoConfianca,
    },
    cartorioEncaminhamento: {
      valor: cartorioFinal,
      motivo: cartorioMotivo,
      sugerido: cartorioSugerido,
      confianca: cartorioConfianca,
    },
    resultadoBuscas: {
      valor: resultadoFinal,
      motivo: resultadoMotivo,
      sugerido: resultadoSugerido,
      confianca: resultadoConfianca,
    },
    escrevente: {
      valor: escreventeFinal,
      motivo: escreventeMotivo,
      sugerido: escreventeSugerido,
      confianca: escreventeConfianca,
    },
    dataCompetencia: dataCompetenciaFinal,
    confrontacoes: confrontacoesExtraidas,
  };
}

function obterDataPorExtenso(): string {
  const agora = new Date();
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  return `${agora.getDate()} de ${meses[agora.getMonth()]} de ${agora.getFullYear()}`;
}

export interface Livro2Match {
  rootId: string;
  relativePath: string;
  name: string;
  size: number;
  modifiedAt: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// Formulário em branco e fila de fichas (portados do FIORIX — Gestão Documental)
// ═══════════════════════════════════════════════════════════════════════════

function dataHojeBr(): string {
  const hoje = new Date();
  return `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
}

/** Formulário para Manifestação em branco (equivalente ao "Novo Formulário" do app original). */
export function criarDadosManifestacaoPadrao(): DadosManifestacao {
  return {
    id_ficha: `FICHA-${Date.now()}`,
    buscas_feitas_em: dataHojeBr(),
    tipo_processo: 'USUCAPIÃO',
    numero_processo: '',
    vara: '',
    data_chegada: '',
    requerente: '',
    imovel: '',
    rua_olhar_confrontacao: '',
    contribuinte_sql: '',
    contribuinte_nao_averbado: true,
    fls_inicial: '',
    fls_laudo: '',
    matricula_transcricao: '',
    cartorio_origem: '',
    fls_certidao_origem: '',
    titular_origem: '',
    resultado_buscas: 'NEGATIVAS',
    subdistrito: '',
    data_competencia_subdistrito: '',
    confrontante_lado_direito: '',
    confrontante_lado_esquerdo: '',
    confrontante_fundos: '',
    transcricoes_anexas: '',
    matriculas_anexas: '',
    cartorio_encaminhamento: '',
    anotacoes_ficha_oficial: '',
    escrevente_pasta: '',
    pagina_inicial_detectada: 0,
    pagina_final_detectada: 0,
    total_paginas_pdf: 0,
  };
}

export interface ArquivoOrigemFicha {
  name: string;
  relativePath: string;
  rootId?: string;
}

export interface FichaOficialPendente {
  id: string;
  numero_processo: string;
  requerente: string;
  imovel: string;
  subdistrito: string;
  matricula_transcricao: string;
  data_criacao: string;
  dados: DadosManifestacao;
  arquivoOrigem?: ArquivoOrigemFicha | null;
}

/** Manifestação arquivada no banco do FIORIX (retorno da finalização). */
export interface ManifestacaoArquivada {
  id: string;
  versao: number;
  numeroProcesso: string | null;
  finalizadoEm: string;
  finalizadoPorNome: string | null;
  hashSha256: string;
}

export interface PayloadFinalizacao {
  fichaId: string;
  dados: DadosManifestacao;
  arquivoOrigem: ArquivoOrigemFicha | null;
  minuta: MinutaModelo;
  textoFinal: string;
  versaoAnteriorId: string | null;
}

/**
 * Chave da fila antiga, que ficava só no navegador. Mantida apenas para migrar
 * automaticamente as fichas antigas para o banco do FIORIX.
 */
export const CHAVE_FILA_FICHAS_OFICIAL = 'fiorix_fichas_oficial_pendentes';

export function lerFilaFichasOficial(): FichaOficialPendente[] {
  try {
    const salvo = localStorage.getItem(CHAVE_FILA_FICHAS_OFICIAL);
    const lista = salvo ? JSON.parse(salvo) : [];
    return Array.isArray(lista) ? lista.filter(f => f && typeof f.id === 'string' && f.dados) : [];
  } catch {
    return [];
  }
}

export function gravarFilaFichasOficial(lista: FichaOficialPendente[]): void {
  try {
    localStorage.setItem(CHAVE_FILA_FICHAS_OFICIAL, JSON.stringify(lista));
  } catch (e) {
    console.error('Erro ao gravar a fila de fichas no armazenamento local:', e);
  }
}

/** Insere/atualiza a ficha no topo da fila (mesma regra de deduplicação do original). */
export function incluirFichaNaFila(
  lista: FichaOficialPendente[],
  dados: DadosManifestacao,
  arquivoOrigem?: ArquivoOrigemFicha | null
): FichaOficialPendente[] {
  const agora = new Date();
  const ficha: FichaOficialPendente = {
    id: dados.id_ficha || `FICHA-${Date.now()}`,
    numero_processo: dados.numero_processo || 'Processo sem número',
    requerente: dados.requerente || 'Interessado a definir',
    imovel: dados.imovel || '',
    subdistrito: dados.subdistrito || '—',
    matricula_transcricao: dados.matricula_transcricao || '-',
    data_criacao: `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    dados: { ...dados },
    arquivoOrigem: arquivoOrigem ? { name: arquivoOrigem.name, relativePath: arquivoOrigem.relativePath, rootId: arquivoOrigem.rootId } : null,
  };
  const temNumero = Boolean(dados.numero_processo);
  const filtrados = lista.filter(f => f.id !== ficha.id && !(temNumero && f.numero_processo === ficha.numero_processo));
  return [ficha, ...filtrados];
}

// ─── Sincronização automática das certidões anexas (5º parágrafo) ──────────
function extrairReferenciasConfrontantes(textoTotal: string): { transcricoes: string[]; matriculas: string[] } {
  const transcricoes: string[] = [];
  const matriculas: string[] = [];
  const coletar = (regex: RegExp, destino: string[]) => {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(textoTotal)) !== null) {
      const numeros = m[1].match(/\d{1,3}(?:\.\d{3})*|\d+/g);
      numeros?.forEach(n => { if (!destino.includes(n)) destino.push(n); });
    }
  };
  coletar(/(?:tr\.?|transcriç(?:ão|ões))\s*(?:nº?s?\.?)?\s*([0-9.\s,e]+)/gi, transcricoes);
  coletar(/(?:mat\.?|matrículas?)\s*(?:nº?s?\.?)?\s*([0-9.\s,e]+)/gi, matriculas);
  return { transcricoes, matriculas };
}

function formatarListaComE(itens: string[]): string {
  if (itens.length === 0) return '';
  if (itens.length === 1) return itens[0];
  if (itens.length === 2) return `${itens[0]} e ${itens[1]}`;
  return `${itens.slice(0, -1).join('; ')} e ${itens[itens.length - 1]}`;
}

function sincronizarAnexos(d: DadosManifestacao): DadosManifestacao {
  const texto = `${d.confrontante_lado_direito || ''} ${d.confrontante_lado_esquerdo || ''} ${d.confrontante_fundos || ''}`;
  const { transcricoes, matriculas } = extrairReferenciasConfrontantes(texto);
  return { ...d, transcricoes_anexas: formatarListaComE(transcricoes), matriculas_anexas: formatarListaComE(matriculas) };
}

const CAMPOS_CONFRONTACAO: (keyof DadosManifestacao)[] = ['confrontante_lado_direito', 'confrontante_lado_esquerdo', 'confrontante_fundos'];

// Inicialização inteligente: se a inferência do OCR identificou subdistrito, escrevente, cartório ou confrontações, preenche automaticamente
function prepararDadosIniciais(dadosIniciais: DadosManifestacao, arquivoOrigem?: ArquivoOrigemFicha | null): DadosManifestacao {
  const sug = inferirSugestoesInteligentes(dadosIniciais, arquivoOrigem);
  return {
    ...dadosIniciais,
    subdistrito: (dadosIniciais.subdistrito && dadosIniciais.subdistrito !== 'ALTO DA MOÓCA')
      ? dadosIniciais.subdistrito
      : sug.subdistrito.valor,
    data_competencia_subdistrito: (dadosIniciais.data_competencia_subdistrito && dadosIniciais.data_competencia_subdistrito !== '23 de dezembro de 1.938')
      ? dadosIniciais.data_competencia_subdistrito
      : sug.dataCompetencia,
    cartorio_encaminhamento: dadosIniciais.cartorio_encaminhamento || sug.cartorioEncaminhamento.valor,
    cartorio_origem: dadosIniciais.cartorio_origem || sug.cartorioEncaminhamento.valor,
    resultado_buscas: dadosIniciais.resultado_buscas || sug.resultadoBuscas.valor,
    escrevente_pasta: (dadosIniciais.escrevente_pasta && ESCREVENTES_USUCAPIAO.includes(dadosIniciais.escrevente_pasta))
      ? dadosIniciais.escrevente_pasta
      : sug.escrevente.valor,
    confrontante_lado_direito: (dadosIniciais.confrontante_lado_direito && dadosIniciais.confrontante_lado_direito !== 'conforme apuração nos autos')
      ? dadosIniciais.confrontante_lado_direito
      : (sug.confrontacoes.ladoDireito || dadosIniciais.confrontante_lado_direito || ''),
    confrontante_lado_esquerdo: (dadosIniciais.confrontante_lado_esquerdo && dadosIniciais.confrontante_lado_esquerdo !== 'conforme apuração nos autos')
      ? dadosIniciais.confrontante_lado_esquerdo
      : (sug.confrontacoes.ladoEsquerdo || dadosIniciais.confrontante_lado_esquerdo || ''),
    confrontante_fundos: (dadosIniciais.confrontante_fundos && dadosIniciais.confrontante_fundos !== 'conforme apuração nos autos')
      ? dadosIniciais.confrontante_fundos
      : (sug.confrontacoes.fundos || dadosIniciais.confrontante_fundos || ''),
  };
}

// ─── Paleta da estação original (FIORIX — Gestão Documental) ───────────────
const inputFolha = 'bg-transparent px-1 border-b border-gray-500 text-black placeholder:text-gray-600 focus:bg-[#FDFBF7] focus:outline-none';
const inputFolhaPontilhado = 'bg-transparent py-1 px-1 border-b-2 border-dotted border-gray-600 text-black placeholder:text-gray-600 focus:bg-[#FDFBF7] focus:outline-none';
const inputPainel = 'w-full px-2.5 py-1 text-xs border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#64748B] focus:outline-none';
const selectPainel = 'w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-[#64748B] focus:outline-none font-semibold';
const rotuloPainel = 'block text-[10px] font-bold text-gray-600 mb-0.5';
const botaoClaro = 'inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold text-[#1E293B] bg-[#F8F7F4] hover:bg-[#F5F2ED] border border-[#CBD5E1] transition cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64748B]';
const botaoEscuro = 'inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#1E293B] hover:bg-[#334155] transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A082]';
const botaoOrigem = 'inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold bg-white border border-[#B8A082] text-[#57534E] hover:bg-[#F5F2ED] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9B896]';

const CSS_IMPRESSAO = `
  @media screen { #fiorix-print-root { display: none !important; } }
  @media print {
    @page { size: A4 portrait; margin: 15mm; }
    :root, html { color-scheme: light !important; }
    html, body {
      background: #ffffff !important;
      background-image: none !important;
      width: auto !important;
      min-width: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    body::before, body::after { content: none !important; display: none !important; }
    body > *:not(#fiorix-print-root) { display: none !important; }
    #fiorix-print-root { display: block !important; position: static !important; color: #000 !important; background: #fff !important; }
    #fiorix-print-root * {
      box-sizing: border-box !important;
      color: #000 !important;
      animation: none !important;
      transition: none !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

export function FichaOficialView({
  dadosIniciais,
  connectorId,
  arquivoOrigem,
  onClose,
  onReextrair,
  onBuscarMatriculaNaLista,
  onVisualizarDocumento,
  onSalvarNaFila,
  onNovoFormulario,
  onFinalizar,
  versaoAnteriorId = null,
}: {
  dadosIniciais: DadosManifestacao;
  connectorId?: string;
  arquivoOrigem?: ArquivoOrigemFicha | null;
  onClose: () => void;
  onReextrair?: () => void;
  onBuscarMatriculaNaLista?: (matricula: string) => void;
  onVisualizarDocumento?: (file: Livro2Match) => void;
  /** Grava a ficha na fila "Fichas em Conferência com o Oficial" (banco do FIORIX, compartilhada entre as máquinas). */
  onSalvarNaFila?: (dados: DadosManifestacao) => void | Promise<void>;
  /** Abre um Formulário para Manifestação em branco. */
  onNovoFormulario?: () => void;
  /** Finaliza e arquiva a Manifestação no banco do FIORIX (registro imutável). */
  onFinalizar?: (payload: PayloadFinalizacao) => Promise<ManifestacaoArquivada>;
  /** Quando a ficha é correção de uma manifestação já arquivada (nova versão). */
  versaoAnteriorId?: string | null;
}) {
  const [dados, setDados] = useState<DadosManifestacao>(() => prepararDadosIniciais(dadosIniciais, arquivoOrigem));

  // Linha de base: estado logo após a extração, usado para detectar edições manuais
  const baseRef = useRef<DadosManifestacao>(dados);
  const rootRef = useRef<HTMLDivElement>(null);

  const [toastSugestao, setToastSugestao] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mostrarAviso = (msg: string, ms = 6500) => {
    setToastSugestao(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastSugestao(null), ms);
  };

  // Calcula sugestões em tempo real com base no estado atual
  const sugestoes = useMemo(() => inferirSugestoesInteligentes(dados, arquivoOrigem), [dados, arquivoOrigem]);

  const [abaAtiva, setAbaAtiva] = useState<'formulario' | 'manifestacao'>('formulario');
  const [saudacaoJuiz, setSaudacaoJuiz] = useState<'Meritíssima Juíza' | 'MM. Juiz'>('Meritíssima Juíza');
  const [copiado, setCopiado] = useState(false);
  const [origemAberta, setOrigemAberta] = useState(false);
  const [painelRevisaoAberto, setPainelRevisaoAberto] = useState(false);
  const [abaRevisao, setAbaRevisao] = useState<'pendencias' | 'origem' | 'autenticidade'>('pendencias');
  const [guiaAberto, setGuiaAberto] = useState(false);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [divergenciasRevisadas, setDivergenciasRevisadas] = useState<Record<string, string>>({});
  const [origemConfrontacoes, setOrigemConfrontacoes] = useState<string | null>(null);
  const [impressao, setImpressao] = useState<'formulario' | 'manifestacao' | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [arquivada, setArquivada] = useState<{ info: ManifestacaoArquivada; minuta: MinutaModelo; texto: string } | null>(null);

  // Estados da Busca de Imagem no Livro 2 (K:\IMAGENS\LV2)
  const [buscandoLivro2, setBuscandoLivro2] = useState(false);
  const [arquivosLivro2, setArquivosLivro2] = useState<Livro2Match[] | null>(null);
  const [termoBuscadoLivro2, setTermoBuscadoLivro2] = useState<string | null>(null);
  const [caminhoCopiadoLivro2, setCaminhoCopiadoLivro2] = useState<string | null>(null);
  const [erroLivro2, setErroLivro2] = useState<string | null>(null);

  const painelFecharRef = useRef<HTMLButtonElement>(null);
  const revisaoBotaoRef = useRef<HTMLButtonElement>(null);

  const camposEditados = useMemo(() => listarCamposAlterados(dados, baseRef.current), [dados]);
  const houveEdicao = camposEditados.length > 0;

  // ─── Pendências derivadas dos dados existentes ───────────────────────────
  const pendencias = useMemo<Pendencia[]>(() => {
    const defs: { id: string; campo: keyof DadosManifestacao; titulo: string; sug: SugestaoCampo }[] = [
      { id: 'escrevente_pasta', campo: 'escrevente_pasta', titulo: 'Escrevente responsável', sug: sugestoes.escrevente },
      { id: 'subdistrito', campo: 'subdistrito', titulo: 'Subdistrito territorial', sug: sugestoes.subdistrito },
      { id: 'resultado_buscas', campo: 'resultado_buscas', titulo: 'Resultado das buscas', sug: sugestoes.resultadoBuscas },
      { id: 'cartorio_encaminhamento', campo: 'cartorio_encaminhamento', titulo: 'Cartório de encaminhamento', sug: sugestoes.cartorioEncaminhamento },
    ];
    return defs.flatMap(d => {
      const atual = String(dados[d.campo] ?? '');
      if (!d.sug.sugerido || !d.sug.valor || normalizarComparacao(atual) === normalizarComparacao(d.sug.valor)) return [];
      return [{
        id: d.id,
        campo: d.campo,
        titulo: d.titulo,
        valorAtual: atual,
        sugestao: d.sug.valor,
        motivo: d.sug.motivo,
        chave: `${atual}|${d.sug.valor}`,
      }];
    });
  }, [dados, sugestoes]);

  const pendenciasAtivas = pendencias.filter(p => divergenciasRevisadas[p.id] !== p.chave);
  const pendenciasMantidas = pendencias.filter(p => divergenciasRevisadas[p.id] === p.chave);

  // ─── Edição de campos ────────────────────────────────────────────────────
  const atualizarCampo = <K extends keyof DadosManifestacao>(campo: K, valor: DadosManifestacao[K]) => {
    setDados(prev => {
      let atualizado: DadosManifestacao = { ...prev, [campo]: valor };
      if (campo === 'subdistrito') {
        const achado = SUBDISTRITOS_7RI.find(s => s.nome.toUpperCase() === String(valor).toUpperCase());
        if (achado) {
          atualizado.cartorio_origem = achado.cartorioSugerido;
          atualizado.cartorio_encaminhamento = achado.cartorioSugerido;
          atualizado.data_competencia_subdistrito = achado.competencia;
        }
      }
      if (CAMPOS_CONFRONTACAO.includes(campo)) atualizado = sincronizarAnexos(atualizado);
      return atualizado;
    });
  };

  const irParaCampo = (campo: keyof DadosManifestacao) => {
    setPainelRevisaoAberto(false);
    setAbaAtiva('manifestacao');
    setTimeout(() => {
      const el = document.getElementById(`campo-${campo}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLElement).focus();
      }
    }, 80);
  };

  // ─── Reaplicar sugestões (com proteção às edições manuais) ───────────────
  const reaplicarSugestoes = () => {
    const sug = inferirSugestoesInteligentes(dados, arquivoOrigem);
    const proposta: Partial<DadosManifestacao> = {
      subdistrito: sug.subdistrito.valor,
      data_competencia_subdistrito: sug.dataCompetencia,
      cartorio_encaminhamento: sug.cartorioEncaminhamento.valor,
      cartorio_origem: sug.cartorioEncaminhamento.valor,
      resultado_buscas: sug.resultadoBuscas.valor,
      escrevente_pasta: sug.escrevente.valor,
      confrontante_lado_direito: sug.confrontacoes.ladoDireito || dados.confrontante_lado_direito,
      confrontante_lado_esquerdo: sug.confrontacoes.ladoEsquerdo || dados.confrontante_lado_esquerdo,
      confrontante_fundos: sug.confrontacoes.fundos || dados.confrontante_fundos,
    };
    const base = baseRef.current;
    const sobrescritos = (Object.keys(proposta) as (keyof DadosManifestacao)[]).filter(k =>
      String(proposta[k] ?? '') !== String(dados[k] ?? '') &&
      String(dados[k] ?? '') !== String(base[k] ?? '')
    );

    const aplicar = () => {
      setDados(prev => sincronizarAnexos({ ...prev, ...proposta }));
      const confMsg = sug.confrontacoes.ladoDireito || sug.confrontacoes.ladoEsquerdo || sug.confrontacoes.fundos
        ? ` • Confrontações (D: ${sug.confrontacoes.ladoDireito || '—'} | E: ${sug.confrontacoes.ladoEsquerdo || '—'} | F: ${sug.confrontacoes.fundos || '—'})`
        : '';
      mostrarAviso(`Sugestões aplicadas: Subdistrito ${sug.subdistrito.valor} • Remessa ${sug.cartorioEncaminhamento.valor} • Buscas ${sug.resultadoBuscas.valor} • Escrevente ${sug.escrevente.valor}${confMsg}`);
    };

    if (sobrescritos.length > 0) {
      setConfirmacao({
        titulo: 'Reaplicar sugestões do OCR?',
        mensagem: (
          <div className="space-y-2">
            <p>As sugestões vão substituir {sobrescritos.length === 1 ? 'um campo editado' : `${sobrescritos.length} campos editados`} manualmente:</p>
            <ul className="list-disc pl-5 text-gray-600">
              {sobrescritos.map(k => (
                <li key={k}>
                  <span className="font-semibold text-gray-900">{ROTULOS_CAMPOS[k] || k}</span>
                  {': '}
                  <span>{String(dados[k] || '—')}</span>
                  {' → '}
                  <span className="font-semibold text-[#1E293B]">{String(proposta[k] || '—')}</span>
                </li>
              ))}
            </ul>
          </div>
        ),
        rotuloConfirmar: 'Substituir edições',
        onConfirmar: aplicar,
      });
      return;
    }
    aplicar();
  };

  // ─── Reextrair petição (descarta a sessão atual) ─────────────────────────
  const solicitarReextracao = () => {
    if (!onReextrair) return;
    if (houveEdicao) {
      setConfirmacao({
        titulo: 'Reextrair a petição?',
        mensagem: (
          <p>
            A nova extração fecha este formulário e descarta {camposEditados.length === 1 ? 'a edição feita' : `as edições feitas em ${camposEditados.length} campos`} nesta sessão.
            Se precisar, salve na fila ou imprima antes de continuar.
          </p>
        ),
        rotuloConfirmar: 'Descartar e reextrair',
        onConfirmar: onReextrair,
      });
      return;
    }
    onReextrair();
  };

  // ─── Limpar formulário / Novo formulário ─────────────────────────────────
  const limparFormulario = () => {
    setConfirmacao({
      titulo: 'Limpar o Formulário para Manifestação?',
      mensagem: <p>Todos os campos do Formulário e da Manifestação serão apagados. Esta ação não altera formulários já salvos na fila.</p>,
      rotuloConfirmar: 'Limpar formulário',
      onConfirmar: () => {
        const limpo = prepararDadosIniciais(criarDadosManifestacaoPadrao(), null);
        baseRef.current = limpo;
        setDados(limpo);
        setDivergenciasRevisadas({});
        setOrigemConfrontacoes(null);
        setArquivosLivro2(null);
        setErroLivro2(null);
        setTermoBuscadoLivro2(null);
        setAbaAtiva('formulario');
      },
    });
  };

  const solicitarNovoFormulario = () => {
    if (!onNovoFormulario) return;
    if (houveEdicao) {
      setConfirmacao({
        titulo: 'Abrir um novo formulário?',
        mensagem: <p>As edições deste formulário que não foram salvas na fila serão descartadas.</p>,
        rotuloConfirmar: 'Abrir novo formulário',
        onConfirmar: onNovoFormulario,
      });
      return;
    }
    onNovoFormulario();
  };

  const salvarNaFila = async (aviso = true) => {
    if (!onSalvarNaFila) return;
    try {
      await onSalvarNaFila(dados);
      if (aviso) mostrarAviso('Formulário salvo na fila “⏳ FORMULÁRIOS EM CONFERÊNCIA COM O OFICIAL” (banco do FIORIX). Ele pode ser reaberto em qualquer máquina do setor.');
    } catch (err) {
      mostrarAviso(err instanceof Error ? err.message : 'Não foi possível salvar o formulário na fila de conferência.', 9000);
    }
  };

  // ─── Confrontações a partir do texto dos autos ───────────────────────────
  const textoAutos = useMemo(
    () =>
      [dados.imovel, dados.rua_olhar_confrontacao, ...(dados.origem_campos || []).map(o => o.trecho || '')]
        .filter(Boolean)
        .join('\n'),
    [dados.imovel, dados.rua_olhar_confrontacao, dados.origem_campos]
  );
  const textoAutosDisponivel = textoAutos.trim().length > 0;

  const preencherConfrontacoesPelosAutos = () => {
    if (!textoAutosDisponivel) {
      mostrarAviso('Não há texto dos autos disponível para extrair confrontações. Preencha manualmente nos campos.');
      return;
    }
    const conf = extrairConfrontacoes(textoAutos);
    const extraidos: Partial<DadosManifestacao> = {};
    if (conf.ladoDireito) extraidos.confrontante_lado_direito = conf.ladoDireito;
    if (conf.ladoEsquerdo) extraidos.confrontante_lado_esquerdo = conf.ladoEsquerdo;
    if (conf.fundos) extraidos.confrontante_fundos = conf.fundos;
    const chaves = Object.keys(extraidos) as (keyof DadosManifestacao)[];

    if (chaves.length === 0) {
      mostrarAviso('Nenhuma confrontação identificável foi localizada no texto dos autos. Os campos continuam disponíveis para preenchimento manual.');
      return;
    }

    const conflitos = chaves.filter(k => {
      const atual = String(dados[k] || '').trim();
      return atual && atual.toLowerCase() !== 'conforme apuração nos autos' && atual !== String(extraidos[k]);
    });

    const aplicar = () => {
      setDados(prev => sincronizarAnexos({ ...prev, ...extraidos }));
      setOrigemConfrontacoes('texto dos autos (petição / OCR)');
      mostrarAviso(
        `Confrontações preenchidas a partir do texto dos autos — D: ${conf.ladoDireito || '—'} | E: ${conf.ladoEsquerdo || '—'} | Fundos: ${conf.fundos || '—'}. ` +
        (chaves.length < 3 ? 'Os lados não localizados permanecem como estavam.' : '')
      );
    };

    if (conflitos.length > 0) {
      setConfirmacao({
        titulo: 'Substituir confrontações já preenchidas?',
        mensagem: (
          <div className="space-y-2">
            <p>Valores extraídos do <strong className="text-gray-900">texto dos autos</strong>. Revise antes de substituir:</p>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F8F7F4] text-gray-500">
                  <tr>
                    <th className="px-3 py-1.5 font-medium">Lado</th>
                    <th className="px-3 py-1.5 font-medium">Atual</th>
                    <th className="px-3 py-1.5 font-medium">Extraído</th>
                  </tr>
                </thead>
                <tbody>
                  {chaves.map(k => (
                    <tr key={k} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 text-gray-700">{ROTULOS_CAMPOS[k]}</td>
                      <td className="px-3 py-1.5 text-gray-500">{String(dados[k] || '—')}</td>
                      <td className="px-3 py-1.5 font-semibold text-[#1E293B]">{String(extraidos[k])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ),
        rotuloConfirmar: 'Substituir',
        onConfirmar: aplicar,
      });
      return;
    }
    aplicar();
  };

  // ─── Localização da matrícula no Livro 2 (somente localização/visualização) ─
  async function localizarNoLivro2(matriculaCustom?: string) {
    const raw = matriculaCustom || dados.matricula_transcricao || '';
    const numeros = raw.replace(/[^\d]/g, '');
    const queryBusca = numeros && numeros.length >= 2 ? numeros : raw.trim();

    if (!queryBusca || queryBusca.length < 2) {
      setErroLivro2('Informe ao menos 2 dígitos da matrícula para localizar a imagem no Livro 2.');
      return;
    }

    setBuscandoLivro2(true);
    setErroLivro2(null);
    setTermoBuscadoLivro2(queryBusca);

    try {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId: connectorId || '',
          type: 'search',
          query: queryBusca,
          forceFresh: true,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Connector local indisponível.');

      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 800));
        const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
        const state = await res.json();
        if (!res.ok) throw new Error(state.error);
        if (state.status === 'complete' && state.result) {
          const files: Livro2Match[] = state.result.files || [];
          const imagensLv2 = files.filter(f => {
            const root = (f.rootId || '').toLowerCase();
            const rel = (f.relativePath || '').toLowerCase();
            return (
              root === 'livro2' ||
              root.includes('imagem') ||
              rel.includes('lv2') ||
              /\.(ken|tif|tiff)$/i.test(f.name || rel)
            );
          });
          setArquivosLivro2(imagensLv2);
          return;
        }
        if (state.status === 'failed') throw new Error('Falha na busca da matrícula pelo Connector local.');
      }
      throw new Error('Tempo limite excedido na busca do Livro 2. Verifique se o Connector e o acervo K:\\IMAGENS\\LV2 estão disponíveis.');
    } catch (err) {
      setArquivosLivro2(null);
      setErroLivro2(err instanceof Error ? err.message : 'Falha ao localizar a matrícula em K:\\IMAGENS\\LV2.');
    } finally {
      setBuscandoLivro2(false);
    }
  }

  // ─── Minuta: fonte única para exibição, cópia e impressão ────────────────
  const minuta = useMemo(() => montarMinuta(dados, saudacaoJuiz), [dados, saudacaoJuiz]);

  const copiarManifestacao = () => {
    navigator.clipboard.writeText(minutaParaTexto(minuta)).then(
      () => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      },
      () => mostrarAviso('Não foi possível copiar para a área de transferência neste navegador.')
    );
  };

  // ─── Finalização: arquiva o texto da Etapa 2 no banco do FIORIX ──────────
  const textoMinuta = useMemo(() => minutaParaTexto(minuta), [minuta]);
  const alteradaAposArquivar = Boolean(arquivada && arquivada.texto !== textoMinuta);

  const executarFinalizacao = async () => {
    if (!onFinalizar || finalizando) return;
    setFinalizando(true);
    try {
      const info = await onFinalizar({
        fichaId: dados.id_ficha || `FICHA-${Date.now()}`,
        dados,
        arquivoOrigem: arquivoOrigem ?? null,
        minuta,
        textoFinal: textoMinuta,
        // Correção após arquivar nesta mesma tela gera nova versão da que acabou de ser arquivada
        versaoAnteriorId: arquivada ? arquivada.info.id : versaoAnteriorId,
      });
      setArquivada({ info, minuta, texto: textoMinuta });
      mostrarAviso(`Manifestação arquivada no FIORIX (versão ${info.versao}). Use “Baixar PDF” para obter o arquivo.`);
    } catch (err) {
      mostrarAviso(err instanceof Error ? err.message : 'Não foi possível finalizar a manifestação.', 9000);
    } finally {
      setFinalizando(false);
    }
  };

  const solicitarFinalizacao = () => {
    if (!onFinalizar) return;
    if (textoMinuta.trim().length < 50) {
      mostrarAviso('O texto da manifestação está incompleto. Preencha os campos da Etapa 1 antes de finalizar.');
      return;
    }
    const novaVersao = Boolean(arquivada || versaoAnteriorId);
    setConfirmacao({
      titulo: novaVersao ? 'Finalizar nova versão da manifestação?' : 'Finalizar a manifestação?',
      mensagem: (
        <div className="space-y-2">
          <p>
            O texto exibido na pré-visualização será <strong className="text-gray-900">arquivado no banco do FIORIX</strong> e
            ficará disponível no Histórico para os escreventes do setor de Usucapião.
          </p>
          <p>Depois de finalizada, a manifestação <strong className="text-gray-900">não pode ser alterada nem excluída</strong>. Correções geram uma nova versão, mantendo a anterior.</p>
          {pendenciasAtivas.length > 0 && (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              Há {pendenciasAtivas.length} pendência(s) de revisão em aberto. Confira antes de finalizar.
            </p>
          )}
        </div>
      ),
      rotuloConfirmar: novaVersao ? 'Finalizar nova versão' : 'Finalizar e arquivar',
      onConfirmar: () => { void executarFinalizacao(); },
    });
  };

  const baixarPdfArquivado = async () => {
    if (!arquivada) return;
    try {
      const { baixarPdfManifestacao } = await import('@/lib/pdf/generateManifestacaoPdf');
      baixarPdfManifestacao(arquivada.minuta, arquivada.info, arquivada.info.numeroProcesso || dados.numero_processo);
    } catch {
      mostrarAviso('Não foi possível gerar o PDF neste navegador.');
    }
  };

  // Impressão isolada: somente a folha ativa, em retrato, sem os controles da aplicação
  const imprimirFormularioOficial = () => {
    // Comportamento do original: ao imprimir a ficha física ela entra na fila de conferência
    // (exceto quando a manifestação já foi arquivada e não houve correção)
    if (!arquivada || alteradaAposArquivar) void salvarNaFila(false);
    setImpressao('formulario');
  };
  const imprimirManifestacaoOficial = () => setImpressao('manifestacao');

  useEffect(() => {
    if (!impressao) return;
    const finalizar = () => setImpressao(null);
    window.addEventListener('afterprint', finalizar);
    const t = setTimeout(() => window.print(), 80);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', finalizar);
    };
  }, [impressao]);

  const podeVisualizarOriginal = Boolean(arquivoOrigem && onVisualizarDocumento);
  const visualizarOriginal = () => {
    if (!arquivoOrigem || !onVisualizarDocumento) return;
    onVisualizarDocumento({
      rootId: arquivoOrigem.rootId || 'processos',
      relativePath: arquivoOrigem.relativePath,
      name: arquivoOrigem.name,
      size: 0,
      modifiedAt: new Date().toISOString(),
    });
  };

  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    if (painelRevisaoAberto) {
      const t = setTimeout(() => painelFecharRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [painelRevisaoAberto]);

  // Esc fecha apenas camadas auxiliares (nunca descarta a sessão de edição)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (confirmacao) { setConfirmacao(null); return; }
      if (guiaAberto) { setGuiaAberto(false); return; }
      if (painelRevisaoAberto) { setPainelRevisaoAberto(false); revisaoBotaoRef.current?.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [confirmacao, guiaAberto, painelRevisaoAberto]);

  // ─── Derivados para exibição ─────────────────────────────────────────────
  const pastaUsucapiao = getRootInfo('usucapiao').pathDisplay;
  const caminhoOrigem = arquivoOrigem ? formatCartorioPath(arquivoOrigem.rootId || 'processos', arquivoOrigem.relativePath) : '';
  const resumoOrigem =
    `PDF: ${arquivoOrigem?.name || 'nenhum PDF selecionado'}${dados.total_paginas_pdf > 0 ? ` (${dados.total_paginas_pdf} págs.)` : ''}` +
    ` • Págs ${dados.pagina_inicial_detectada || 'auto'}${dados.pagina_final_detectada ? `–${dados.pagina_final_detectada}` : ''}` +
    `${dados.fls_laudo ? ` • Laudo ${dados.fls_laudo}` : ''}${dados.fls_certidao_origem ? ` • Certidão ${dados.fls_certidao_origem}` : ''}`;
  const totalCamposOrigem = dados.origem_campos?.length || 0;
  const subdistritoValido = SUBDISTRITOS_7RI.some(s => s.nome === dados.subdistrito);

  // ─── Folha da Manifestação (tela e impressão) ────────────────────────────
  const renderFolhaManifestacao = (paraImpressao: boolean) => (
    <article
      className={
        paraImpressao
          ? 'mx-auto max-w-[820px] bg-white px-6 py-5 font-sans text-[12pt] leading-normal text-black'
          : 'bg-white p-6 sm:p-8 md:p-10 border border-gray-300 rounded shadow-md text-black font-sans leading-relaxed text-[11pt] space-y-4 break-words'
      }
    >
      {/* TIMBRE */}
      <div className="border-b-2 border-black pb-2 mb-4">
        <div className="text-base font-bold tracking-wide">
          {minuta.timbre.numero} • {minuta.timbre.ordinal} {minuta.timbre.linha1} {minuta.timbre.linha3}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-3">
          <div className="text-[8pt] text-gray-600">{minuta.timbre.endereco}</div>
          <div className="text-[8.5pt] italic text-gray-500">Portaria Conjunta nº 1/26</div>
        </div>
      </div>

      {/* CABEÇALHO */}
      <div className="text-xs space-y-0.5 mb-3">
        <div><strong>{minuta.cabecalho.processoRotulo}</strong> {minuta.cabecalho.processoValor}</div>
        <div><strong>{minuta.cabecalho.vara}</strong></div>
        <div><strong>{minuta.cabecalho.interessadosRotulo}</strong> <b>{minuta.cabecalho.interessadosValor}</b></div>
        <div><strong>{minuta.cabecalho.natureza}</strong></div>
      </div>

      <div className="font-bold pt-2 mb-3">{minuta.saudacao}</div>

      <div className="text-justify space-y-3 text-xs leading-normal">
        {minuta.paragrafosAntes.map((p, i) => (
          <p key={`a${i}`} className="indent-8"><Segmentos segmentos={p} /></p>
        ))}
        <p className="indent-8">{minuta.introConfrontacoes}</p>
        <div className="pl-12 space-y-0.5">
          {minuta.confrontacoes.map(c => (
            <div key={c.campo}>{c.rotulo} {c.valor}{c.pontuacao}</div>
          ))}
        </div>
        {minuta.paragrafosDepois.map((p, i) => (
          <p key={`d${i}`} className="indent-8"><Segmentos segmentos={p} /></p>
        ))}
      </div>

      <div className="pt-6 text-right text-xs">{minuta.local}</div>

      <div className="pt-8 text-center">
        <div className="text-xs mb-8">O Oficial,</div>
        <div className="border-t border-black w-64 max-w-full mx-auto pt-1 font-bold text-xs">{minuta.assinatura.nome}</div>
        <div className="text-[10px] text-gray-500">{minuta.assinatura.cargo}</div>
      </div>
    </article>
  );

  // ─── Folha da Ficha de Conferência para impressão (layout do original) ───
  const linhaPontilhada = (altura = 18) => (
    <span style={{ display: 'block', borderBottom: '1px dotted #555', height: altura }} />
  );
  const renderFolhaFichaImpressao = () => (
    <div style={{ fontFamily: "'Times New Roman', Times, serif", color: '#000', background: '#fff', border: '2.5px solid #000', padding: 26, maxWidth: 820, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: 10, marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 'bold', letterSpacing: 0.5, textTransform: 'uppercase' }}>7º Cartório de Registro de Imóveis</h2>
        <p style={{ fontSize: 13, fontStyle: 'italic', margin: '2px 0 0' }}>Comarca da Capital</p>
        <p style={{ fontSize: 12, fontWeight: 'bold', letterSpacing: 1.2, margin: '4px 0 0' }}>OFICIAL ADEMAR FIORANELLI</p>
      </div>

      <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '1px dotted #555', paddingBottom: 4 }}>
          <span><strong>Buscas feitas em:</strong> {dados.buscas_feitas_em || '___/___/______'}</span>
          <span><strong>Processo:</strong> {dados.tipo_processo || 'USUCAPIÃO'} &nbsp;|&nbsp; <strong>Número:</strong> {dados.numero_processo || '____________________'}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '1px dotted #555', padding: '4px 0' }}>
          <span><strong>{dados.vara || '____'} Vara</strong> de Registros Públicos da Capital</span>
          <span><strong>Chegada em:</strong> {dados.data_chegada || '___/___/______'}</span>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 'bold', margin: 0 }}>Requerente:</p>
        <p style={{ fontSize: 13, borderBottom: '1px dotted #555', minHeight: 22, padding: '2px 4px', margin: 0, fontFamily: 'Arial, sans-serif' }}>{dados.requerente || '\u00a0'}</p>
        {linhaPontilhada()}
      </div>

      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 12, fontWeight: 'bold', margin: 0 }}>Imóvel:</p>
        <p style={{ fontSize: 12, borderBottom: '1px dotted #555', minHeight: 22, padding: '2px 4px', margin: 0, fontFamily: 'Arial, sans-serif' }}>
          {dados.imovel || '\u00a0'} {dados.contribuinte_sql ? <>– <strong>SQL:</strong> {dados.contribuinte_sql}{dados.contribuinte_nao_averbado !== false ? ' (não averbado na matrícula de origem)' : ''}</> : null}
        </p>
        {linhaPontilhada()}
      </div>

      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, fontWeight: 'bold', margin: 0 }}>Matrícula / Transcrição:</p>
        <p style={{ fontSize: 12, borderBottom: '1px dotted #555', minHeight: 22, padding: '2px 4px', margin: 0, fontFamily: 'Arial, sans-serif' }}>
          {dados.matricula_transcricao ? <strong>{dados.matricula_transcricao}</strong> : '____________________'}
          {dados.cartorio_origem ? ` (${dados.cartorio_origem})` : ''}
          {dados.titular_origem ? <> – Titular: <strong>{dados.titular_origem}</strong></> : null}
        </p>
        {linhaPontilhada()}
      </div>

      <span style={{ display: 'block', height: 3, background: '#000', margin: '20px 0 14px' }} />

      <div>
        <p style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: 0.8, margin: '0 0 6px', textTransform: 'uppercase' }}>Conferência e Anotações:</p>
        {dados.anotacoes_ficha_oficial ? (
          <p style={{ fontSize: 12, fontFamily: 'Arial, sans-serif', minHeight: 40, padding: '2px 4px', margin: '0 0 6px', whiteSpace: 'pre-wrap', borderBottom: '1px dotted #777' }}>
            {dados.anotacoes_ficha_oficial}
          </p>
        ) : null}
        <div style={{ marginTop: 8 }}>
          {Array.from({ length: dados.anotacoes_ficha_oficial ? 14 : 18 }).map((_, i) => (
            <span key={i} style={{ display: 'block', borderBottom: '1px dotted #888', paddingTop: 20 }} />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={rootRef}
      id="estacao-manifestacao-usucapiao"
      className="scroll-mt-4 overflow-clip rounded-2xl border border-[#E5E7EB] bg-[#F5F2ED] text-[#111827] shadow-xl"
    >
      {/* ── Barra superior da estação (48px, padrão do original) ── */}
      <div className="flex h-12 items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            title="Fechar o formulário e voltar a Manifestações"
            aria-label="Voltar a Manifestações"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64748B] transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="shrink-0 rounded-lg bg-[#1E293B] p-1">
            <ScrollText className="h-4 w-4 text-[#B8A082]" aria-hidden="true" />
          </div>
          <h2 className="whitespace-nowrap text-sm font-bold tracking-tight text-[#111827]">{formatarTitulo(dados.tipo_processo || 'Usucapião')} Judicial</h2>
          <span className="hidden min-w-0 truncate text-xs text-gray-700 md:inline" title={caminhoOrigem || undefined}>
            7º RI da Capital • {arquivoOrigem ? arquivoOrigem.name : 'Formulário sem PDF de origem'}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onNovoFormulario && (
            <button
              type="button"
              onClick={solicitarNovoFormulario}
              title="Criar novo formulário de manifestação em branco"
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#1E293B] hover:bg-[#F8F7F4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64748B] transition"
            >
              <Plus className="h-3.5 w-3.5 text-[#334155]" aria-hidden="true" />
              <span className="hidden sm:inline">Novo Formulário</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Fechar e voltar a Manifestações"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#1E293B] hover:bg-[#F8F7F4] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64748B] transition"
          >
            <Search className="h-3.5 w-3.5 text-[#334155]" aria-hidden="true" />
            <span className="hidden sm:inline">Voltar à pesquisa</span>
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {/* CARD: FORMULÁRIO PARA MANIFESTAÇÃO */}
        <div className="overflow-clip rounded-xl border border-[#1E293B] bg-white shadow-lg">
          {/* CABEÇALHO DO CARD */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1E293B] p-3.5 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className="shrink-0 rounded-xl border border-[#334155]/50 bg-[#1E293B]/80 p-2">
                <ScrollText className="h-6 w-6 text-[#B8A082]" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-base font-bold tracking-tight text-white">
                    📝 Formulário para Manifestação — Busca Negativa em {pastaUsucapiao}
                  </h3>
                  <span className="whitespace-nowrap rounded-full border border-[#94A3B8]/40 bg-[#64748B]/25 px-2 py-0.5 text-[10px] font-bold uppercase text-[#CBD5E1]">
                    Usucapião Judicial • 7º RI-SP
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[#CBD5E1]/80">
                  {arquivoOrigem
                    ? `Dados extraídos da petição inicial (${arquivoOrigem.name}). Confira os campos para gerar o Formulário do Oficial e a Manifestação.`
                    : 'Preencha os campos abaixo ou extraia os dados de uma petição inicial pela pesquisa em Manifestações para preenchimento automático.'}
                </p>
              </div>
            </div>

            {/* ETAPAS DE TRABALHO */}
            <div role="tablist" aria-label="Etapas do formulário" className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#334155]/40 bg-[#1E293B]/60 p-1">
              {([
                { id: 'formulario', rotulo: '1. Formulário de Conferência do Oficial' },
                { id: 'manifestacao', rotulo: '2. Revisão e Manifestação Oficial' },
              ] as const).map(aba => {
                const ativa = abaAtiva === aba.id;
                return (
                  <button
                    key={aba.id}
                    type="button"
                    role="tab"
                    id={`aba-${aba.id}`}
                    aria-selected={ativa}
                    aria-controls="etapa-ativa"
                    onClick={() => setAbaAtiva(aba.id)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9B896] ${
                      ativa
                        ? 'border-b-2 border-[#C9B896] bg-[#F5F2ED] text-[#1E293B] shadow-xs'
                        : 'text-[#CBD5E1] hover:bg-[#334155]/50 hover:text-white'
                    }`}
                  >
                    {aba.rotulo}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CONTEÚDO DAS ETAPAS */}
          <div id="etapa-ativa" role="tabpanel" aria-labelledby={`aba-${abaAtiva}`} className="space-y-4 bg-[#F8F7F4] p-3 sm:p-4 md:p-6">
            {/* ORIGEM DOS DADOS (recolhível) */}
            <section id="bloco-origem-dados" aria-label="Origem dos dados" className="rounded-xl border border-[#B8A082] bg-[#FDFBF7]">
              <div className="flex flex-wrap items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setOrigemAberta(v => !v)}
                  aria-expanded={origemAberta}
                  aria-controls="origem-dados-conteudo"
                  className="min-w-0 flex-1 cursor-pointer truncate text-left text-xs font-bold text-[#57534E] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9B896] rounded"
                  title={resumoOrigem}
                >
                  {origemAberta ? '▾' : '▸'} 📄 Origem dos dados — Páginas da Petição Inicial no PDF
                  {!origemAberta && <span className="font-normal"> · {resumoOrigem}</span>}
                </button>
                <button
                  ref={revisaoBotaoRef}
                  type="button"
                  onClick={() => { setAbaRevisao('pendencias'); setPainelRevisaoAberto(true); }}
                  aria-haspopup="dialog"
                  aria-expanded={painelRevisaoAberto}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#B8A082] bg-white px-2 py-0.5 text-[11px] font-bold text-[#57534E] hover:bg-[#F5F2ED] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9B896]"
                >
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Revisão dos dados</span>
                  {pendenciasAtivas.length > 0 && (
                    <span data-contador-pendencias className="rounded bg-amber-100 px-1.5 text-[10px] font-bold text-amber-800">
                      {pendenciasAtivas.length}
                    </span>
                  )}
                </button>
              </div>

              {origemAberta && (
                <div id="origem-dados-conteudo" className="space-y-3 border-t border-[#E9E2D3] px-3 pb-3 pt-2.5 text-xs text-[#57534E]">
                  <div className="font-bold">📄 Páginas da Petição Inicial no PDF</div>
                  {arquivoOrigem ? (
                    <div className="space-y-1">
                      <div className="break-all font-mono text-[11px]">{caminhoOrigem}</div>
                      <div>
                        Páginas lidas: <strong>{dados.pagina_inicial_detectada || 'auto'}{dados.pagina_final_detectada ? `–${dados.pagina_final_detectada}` : ''}</strong>
                        {dados.total_paginas_pdf > 0 && <> de <strong>{dados.total_paginas_pdf}</strong></>}
                        {totalCamposOrigem > 0 && <> • <strong>{totalCamposOrigem}</strong> campos localizados no texto</>}
                      </div>
                    </div>
                  ) : (
                    <p className="italic">Formulário sem PDF de origem. Para preenchimento automático, extraia a ficha de uma petição inicial pela pesquisa em Manifestações.</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex items-center gap-1">Fls. Inicial:
                      <input type="text" value={dados.fls_inicial} onChange={e => atualizarCampo('fls_inicial', e.target.value)} className="w-20 rounded border border-[#B8A082] bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#C9B896]" />
                    </label>
                    <label className="flex items-center gap-1">Fls. Laudo:
                      <input type="text" value={dados.fls_laudo} onChange={e => atualizarCampo('fls_laudo', e.target.value)} className="w-20 rounded border border-[#B8A082] bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#C9B896]" />
                    </label>
                    <label className="flex items-center gap-1">Fls. Certidão:
                      <input type="text" value={dados.fls_certidao_origem} onChange={e => atualizarCampo('fls_certidao_origem', e.target.value)} className="w-20 rounded border border-[#B8A082] bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-[#C9B896]" />
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {podeVisualizarOriginal && (
                      <button type="button" onClick={visualizarOriginal} className={botaoOrigem}>
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Visualizar PDF do processo
                      </button>
                    )}
                    {onReextrair && (
                      <button type="button" onClick={solicitarReextracao} className={botaoOrigem} title="Descarta o cache e faz nova leitura da petição pelo Connector local">
                        <RotateCw className="h-3.5 w-3.5" aria-hidden="true" /> Reextrair petição
                      </button>
                    )}
                    <button type="button" onClick={reaplicarSugestoes} className={botaoOrigem} title="Reavalia subdistrito, competência, buscas, escrevente e confrontações">
                      <Wand2 className="h-3.5 w-3.5" aria-hidden="true" /> Reaplicar sugestões do OCR
                    </button>
                    {totalCamposOrigem > 0 && (
                      <button type="button" onClick={() => { setAbaRevisao('origem'); setPainelRevisaoAberto(true); }} className={botaoOrigem}>
                        <Info className="h-3.5 w-3.5" aria-hidden="true" /> Origem e confiança do OCR
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {toastSugestao && (
              <div role="status" aria-live="polite" className="flex items-start justify-between gap-3 rounded-r-xl border-l-4 border-[#334155] bg-white px-3 py-2 text-xs font-semibold text-[#1E293B] shadow-xs">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#334155]" aria-hidden="true" />
                  <span>{toastSugestao}</span>
                </div>
                <button type="button" onClick={() => setToastSugestao(null)} aria-label="Dispensar aviso" className="rounded p-0.5 text-[#334155] hover:text-[#1E293B] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64748B]">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {abaAtiva === 'formulario' ? (
              /* ETAPA 1: FICHA DE CONFERÊNCIA DO OFICIAL */
              <div className="space-y-6">
                {/* AÇÕES DESTA ETAPA */}
                <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/90 p-3.5 shadow-xs backdrop-blur">
                  <div className="min-w-[14rem] flex-1 text-xs text-gray-800">
                    <strong>Orientações:</strong> Imprima a folha de conferência física para conferência e visto do Oficial <strong>Dr. Ademar Fioranelli</strong>.
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={limparFormulario}
                      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D6D3D1] bg-[#F8F4F0] px-3 py-1.5 text-xs font-bold text-[#44403C] shadow-2xs transition hover:bg-[#F1ECE6] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64748B]"
                      title="Limpar: Formulário para Manifestação"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Limpar Formulário</span>
                    </button>
                    {onSalvarNaFila && (
                      <button type="button" onClick={() => salvarNaFila()} className={botaoClaro} title="Guardar na fila de formulários em conferência com o Oficial (banco do FIORIX, visível em todas as máquinas do setor)">
                        <Save className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Salvar na Fila</span>
                      </button>
                    )}
                    <button type="button" onClick={imprimirFormularioOficial} className={`${botaoEscuro} gap-2 px-4`}>
                      <Printer className="h-4 w-4 text-[#B8A082]" aria-hidden="true" />
                      <span>🖨️ Imprimir Formulário para Conferência do Oficial</span>
                    </button>
                    <button type="button" onClick={() => setAbaAtiva('manifestacao')} className={botaoEscuro}>
                      <span>Avançar para Etapa 2 ➔</span>
                    </button>
                  </div>
                </div>

                {/* FOLHA CLÁSSICA NA TELA */}
                <div className="mx-auto max-w-[780px] space-y-4 rounded-sm border-2 border-black bg-white p-5 font-serif text-black shadow-md sm:p-8">
                  <div className="border-b-2 border-black pb-3 text-center">
                    <h4 className="text-lg font-bold uppercase tracking-wider sm:text-xl">7º Cartório de Registro de Imóveis</h4>
                    <div className="text-sm italic">Comarca da Capital</div>
                    <div className="mt-1 text-xs font-bold tracking-widest">OFICIAL ADEMAR FIORANELLI</div>
                  </div>

                  <div className="space-y-3 font-sans text-xs">
                    {/* Linha 1 */}
                    <div className="grid grid-cols-1 gap-3 border-b border-dotted border-gray-400 pb-2 sm:grid-cols-2">
                      <div className="flex items-center gap-1.5">
                        <label htmlFor="doc-buscas" className="shrink-0 font-bold">Buscas feitas em:</label>
                        <input id="doc-buscas" type="text" value={dados.buscas_feitas_em} onChange={e => atualizarCampo('buscas_feitas_em', e.target.value)} className={`w-full min-w-0 font-mono font-semibold ${inputFolha}`} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label htmlFor="doc-tipo" className="shrink-0 font-bold">Processo:</label>
                        <input id="doc-tipo" type="text" value={dados.tipo_processo} onChange={e => atualizarCampo('tipo_processo', e.target.value)} className={`w-24 shrink-0 font-bold ${inputFolha}`} />
                        <label htmlFor="doc-numero" className="shrink-0 font-bold">Nº:</label>
                        <input id="doc-numero" type="text" value={dados.numero_processo} onChange={e => atualizarCampo('numero_processo', e.target.value)} placeholder="0000000-00.0000.8.26.0100" className={`w-full min-w-0 font-mono font-bold text-[#1E293B] ${inputFolha}`} />
                      </div>
                    </div>

                    {/* Linha 2 */}
                    <div className="grid grid-cols-1 gap-3 border-b border-dotted border-gray-400 pb-2 sm:grid-cols-2">
                      <div className="flex items-center gap-1.5">
                        <label htmlFor="doc-vara" className="shrink-0 font-bold">Vara:</label>
                        <input id="doc-vara" type="text" value={dados.vara} onChange={e => atualizarCampo('vara', e.target.value)} className={`w-16 shrink-0 font-bold ${inputFolha}`} />
                        <span className="min-w-0">Vara de Registros Públicos da Capital</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label htmlFor="doc-chegada" className="shrink-0 font-bold">Chegada em:</label>
                        <input id="doc-chegada" type="text" value={dados.data_chegada} onChange={e => atualizarCampo('data_chegada', e.target.value)} className={`w-full min-w-0 font-mono font-semibold ${inputFolha}`} />
                      </div>
                    </div>

                    {/* Requerente */}
                    <div className="space-y-1">
                      <label htmlFor="doc-requerente" className="block font-serif font-bold">Requerente:</label>
                      <input id="doc-requerente" type="text" value={dados.requerente} onChange={e => atualizarCampo('requerente', e.target.value)} placeholder="Nome do autor ou interessado na usucapião" className={`w-full text-sm font-bold uppercase ${inputFolhaPontilhado}`} />
                    </div>

                    {/* Imóvel e SQL */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label htmlFor="doc-imovel" className="font-serif font-bold">Imóvel:</label>
                        <div className="flex items-center gap-1.5">
                          <label htmlFor="doc-sql" className="font-bold">SQL / IPTU:</label>
                          <input id="doc-sql" type="text" value={dados.contribuinte_sql} onChange={e => atualizarCampo('contribuinte_sql', e.target.value)} placeholder="000.000.0000-0" className={`w-36 font-mono font-bold ${inputFolha}`} />
                        </div>
                      </div>
                      <textarea id="doc-imovel" rows={2} value={dados.imovel} onChange={e => atualizarCampo('imovel', e.target.value)} placeholder="Descrição do imóvel na inicial (Rua, número, antigo número, lote, quadra)..." className={`w-full resize-none text-xs font-semibold ${inputFolhaPontilhado}`} />
                      {dados.contribuinte_sql ? (
                        <label className="mt-1 flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-slate-700 hover:text-slate-900">
                          <input
                            type="checkbox"
                            checked={dados.contribuinte_nao_averbado !== false}
                            onChange={e => atualizarCampo('contribuinte_nao_averbado', e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-[#0F3D6E] focus:ring-[#0F3D6E]"
                          />
                          <span>Contribuinte não averbado na matrícula de origem (inserir ressalva de praxe na Manifestação)</span>
                        </label>
                      ) : null}
                    </div>

                    {/* Matrícula / Transcrição */}
                    <div className="space-y-1">
                      <span className="font-serif font-bold">Matrícula / Transcrição:</span>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <label className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-black">Nº da Transcrição / Matrícula</span>
                          <input type="text" value={dados.matricula_transcricao} onChange={e => atualizarCampo('matricula_transcricao', e.target.value)} placeholder="Nº da Transcrição ou Matrícula" className={`min-w-0 font-bold ${inputFolhaPontilhado}`} />
                        </label>
                        <label className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-black">Cartório de origem</span>
                          <input type="text" value={dados.cartorio_origem} onChange={e => atualizarCampo('cartorio_origem', e.target.value)} placeholder="Cartório de Origem (ex: 3º RI)" className={`min-w-0 text-xs font-semibold ${inputFolhaPontilhado}`} />
                        </label>
                        <label className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-sans text-[10px] font-bold uppercase tracking-wider text-black">Titular de origem (proprietário anterior)</span>
                          <input type="text" value={dados.titular_origem} onChange={e => atualizarCampo('titular_origem', e.target.value)} placeholder="Titular de Origem" className={`min-w-0 text-xs font-semibold uppercase ${inputFolhaPontilhado}`} />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* LINHA HORIZONTAL PRETA GROSSA */}
                  <div className="my-4 h-1 bg-black" />

                  {/* LINHAS PAUTADAS */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-1 font-sans text-[11px] font-bold uppercase tracking-wider">
                      <label htmlFor="doc-anotacoes">Conferência e Anotações:</label>
                      <span className="font-normal text-gray-700">Anotações editáveis abaixo</span>
                    </div>
                    <textarea
                      id="doc-anotacoes"
                      rows={6}
                      value={dados.anotacoes_ficha_oficial}
                      onChange={e => atualizarCampo('anotacoes_ficha_oficial', e.target.value)}
                      placeholder="Digite observações manuscritas prévias ou deixe as linhas pautadas em branco para anotação à caneta pelo Oficial..."
                      className="w-full rounded border border-dashed border-gray-500 bg-[#FDFBF7]/40 p-2.5 font-mono text-xs text-black placeholder:text-gray-600 focus:bg-white focus:outline-none"
                    />
                    <div className="space-y-4 pt-2" aria-hidden="true">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-1 border-b border-dotted border-gray-400" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ETAPA 2: REVISÃO DO ESCREVENTE E GERAÇÃO DA MANIFESTAÇÃO OFICIAL */
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                {/* PAINEL ESQUERDO: CONFIGURAÇÕES */}
                <div className="space-y-4 lg:col-span-5">
                  <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
                    <h4 className="flex items-center justify-between gap-2 border-b pb-2 text-xs font-bold uppercase tracking-wider text-[#1E293B]">
                      <span>Configurações da Manifestação</span>
                      <span className="ml-auto text-[10px] font-normal normal-case tracking-normal text-gray-500">Portaria Conjunta nº 1/26</span>
                      <button
                        type="button"
                        onClick={() => setGuiaAberto(true)}
                        className="inline-flex items-center gap-1 rounded px-1 text-[10px] font-semibold normal-case tracking-normal text-[#334155] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64748B]"
                      >
                        <BookOpen className="h-3 w-3" aria-hidden="true" /> Guia de competências
                      </button>
                    </h4>

                    <div>
                      <label htmlFor="campo-escrevente_pasta" className="mb-1 block text-[11px] font-bold text-gray-700">
                        Pasta de Destino (Escrevente em {pastaUsucapiao}):
                      </label>
                      <select
                        id="campo-escrevente_pasta"
                        value={dados.escrevente_pasta}
                        onChange={e => atualizarCampo('escrevente_pasta', e.target.value)}
                        className="w-full rounded-lg border border-[#CBD5E1] bg-[#F8F7F4]/50 px-3 py-1.5 text-xs font-bold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#64748B]"
                      >
                        {!ESCREVENTES_USUCAPIAO.includes(dados.escrevente_pasta) && <option value={dados.escrevente_pasta}>{dados.escrevente_pasta || 'Selecione…'}</option>}
                        {ESCREVENTES_USUCAPIAO.map(esc => (
                          <option key={esc} value={esc}>{pastaUsucapiao}\{esc}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="campo-subdistrito" className="mb-1 block text-[11px] font-bold text-gray-700">Subdistrito do Imóvel:</label>
                      <select id="campo-subdistrito" value={dados.subdistrito} onChange={e => atualizarCampo('subdistrito', e.target.value)} className={selectPainel}>
                        {!subdistritoValido && <option value={dados.subdistrito}>{dados.subdistrito || 'Selecione…'}</option>}
                        {SUBDISTRITOS_7RI.map(sub => (
                          <option key={sub.nome} value={sub.nome}>{sub.nome}</option>
                        ))}
                      </select>
                      <div className="mt-1 text-[10px] text-gray-500">
                        Competência: <strong>{dados.data_competencia_subdistrito || '—'}</strong> (Decreto Estadual nº 9.775/1938).
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="campo-fls_inicial" className={rotuloPainel}>Fls. Inicial:</label>
                        <input id="campo-fls_inicial" type="text" value={dados.fls_inicial} onChange={e => atualizarCampo('fls_inicial', e.target.value)} className={`${inputPainel} font-mono`} />
                      </div>
                      <div>
                        <label htmlFor="campo-fls_laudo" className={rotuloPainel}>Fls. Laudo Pericial:</label>
                        <input id="campo-fls_laudo" type="text" value={dados.fls_laudo} onChange={e => atualizarCampo('fls_laudo', e.target.value)} className={`${inputPainel} font-mono`} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label htmlFor="campo-fls_certidao_origem" className={rotuloPainel}>Fls. Certidão de Origem:</label>
                        <input id="campo-fls_certidao_origem" type="text" value={dados.fls_certidao_origem} onChange={e => atualizarCampo('fls_certidao_origem', e.target.value)} className={`${inputPainel} font-mono`} />
                      </div>
                      <div>
                        <label htmlFor="campo-resultado_buscas" className={rotuloPainel}>Resultado Buscas:</label>
                        <select id="campo-resultado_buscas" value={dados.resultado_buscas} onChange={e => atualizarCampo('resultado_buscas', e.target.value)} className={`${inputPainel} font-bold text-[#1E293B]`}>
                          <option value="NEGATIVAS">NEGATIVAS</option>
                          <option value="POSITIVAS">POSITIVAS</option>
                          <option value="PARCIALMENTE POSITIVAS">PARCIALMENTE POSITIVAS</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="campo-cartorio_encaminhamento" className={rotuloPainel}>Cartório de Encaminhamento:</label>
                      <input id="campo-cartorio_encaminhamento" type="text" value={dados.cartorio_encaminhamento} onChange={e => atualizarCampo('cartorio_encaminhamento', e.target.value)} className={inputPainel} />
                    </div>

                    <div>
                      <label htmlFor="campo-saudacao" className={rotuloPainel}>Saudação:</label>
                      <select id="campo-saudacao" value={saudacaoJuiz} onChange={e => setSaudacaoJuiz(e.target.value as 'Meritíssima Juíza' | 'MM. Juiz')} className={inputPainel}>
                        <option value="Meritíssima Juíza">Meritíssima Juíza</option>
                        <option value="MM. Juiz">MM. Juiz</option>
                      </select>
                    </div>
                  </div>

                  {/* CONFRONTANTES E SINCRONIZAÇÃO AUTOMÁTICA */}
                  <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-2xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#1E293B]">Confrontações (Planta Setor Fiscal)</h4>
                      <button
                        type="button"
                        disabled={buscandoLivro2 || !dados.matricula_transcricao?.trim()}
                        onClick={() => localizarNoLivro2()}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1 text-[11px] font-bold text-purple-800 shadow-2xs transition hover:bg-purple-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                        title="Localizar a imagem digitalizada (.KEN) da matrícula de origem no acervo do Livro 2 (K:\IMAGENS\LV2)"
                      >
                        {buscandoLivro2 ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                        <span>{buscandoLivro2 ? 'Localizando no Livro 2…' : '🔎 Espiar Matrícula .KEN (LV2)'}</span>
                      </button>
                    </div>

                    {(buscandoLivro2 || arquivosLivro2 || erroLivro2) && (
                      <div aria-live="polite" className="rounded-lg border border-purple-200 bg-purple-50/40 p-3 text-xs text-gray-700">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5">
                            <ImageIcon className="h-3.5 w-3.5 text-purple-700" aria-hidden="true" />
                            Livro 2 · matrícula <strong className="font-mono text-gray-900">{termoBuscadoLivro2}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => { setArquivosLivro2(null); setErroLivro2(null); setTermoBuscadoLivro2(null); }}
                            aria-label="Fechar resultado do Livro 2"
                            className="rounded p-0.5 text-gray-500 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {buscandoLivro2 && (
                          <p className="mt-2 flex items-center gap-2 text-gray-500">
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-700" aria-hidden="true" />
                            Consultando o acervo K:\IMAGENS\LV2 pelo Connector local…
                          </p>
                        )}
                        {erroLivro2 && !buscandoLivro2 && (
                          <p className="mt-2 text-rose-700">{erroLivro2} O preenchimento manual continua disponível.</p>
                        )}
                        {arquivosLivro2 && arquivosLivro2.length === 0 && !buscandoLivro2 && (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-gray-500">
                            <span>Nenhuma imagem desta matrícula foi localizada em K:\IMAGENS\LV2.</span>
                            <div className="flex items-center gap-2">
                              {onBuscarMatriculaNaLista && termoBuscadoLivro2 && (
                                <button type="button" onClick={() => onBuscarMatriculaNaLista(termoBuscadoLivro2)} className="font-semibold text-[#1E293B] hover:underline">
                                  Buscar na pesquisa
                                </button>
                              )}
                              <button type="button" onClick={() => localizarNoLivro2(termoBuscadoLivro2 || undefined)} className="font-semibold text-purple-800 hover:underline">
                                Buscar novamente
                              </button>
                            </div>
                          </div>
                        )}
                        {arquivosLivro2 && arquivosLivro2.length > 0 && !buscandoLivro2 && (
                          <>
                            <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                              {arquivosLivro2.map(file => {
                                const caminho = formatCartorioPath(file.rootId, file.relativePath);
                                return (
                                  <li key={`${file.rootId}:${file.relativePath}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-2">
                                    <div className="min-w-0">
                                      <div className="truncate font-semibold text-gray-900" title={file.name}>{file.name}</div>
                                      <div className="truncate font-mono text-[11px] text-gray-500" title={caminho}>{caminho}</div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(caminho);
                                          setCaminhoCopiadoLivro2(file.relativePath);
                                          setTimeout(() => setCaminhoCopiadoLivro2(null), 2500);
                                        }}
                                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100"
                                      >
                                        {caminhoCopiadoLivro2 === file.relativePath
                                          ? <><Check className="h-3 w-3 text-emerald-600" aria-hidden="true" /><span>Copiado</span></>
                                          : <><Copy className="h-3 w-3" aria-hidden="true" /><span>Copiar caminho</span></>}
                                      </button>
                                      {onVisualizarDocumento && (
                                        <button type="button" onClick={() => onVisualizarDocumento(file)} className="inline-flex items-center gap-1 rounded-md bg-[#1E293B] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#334155]">
                                          <Eye className="h-3 w-3" aria-hidden="true" /><span>Visualizar</span>
                                        </button>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                            <p className="mt-2 text-[11px] text-gray-500">As imagens do Livro 2 são exibidas para conferência visual; o texto da matrícula não é extraído automaticamente.</p>
                          </>
                        )}
                      </div>
                    )}

                    {([
                      ['confrontante_lado_direito', 'Do Lado Direito:'],
                      ['confrontante_lado_esquerdo', 'Do Lado Esquerdo:'],
                      ['confrontante_fundos', 'Nos Fundos:'],
                    ] as const).map(([campo, rotulo]) => (
                      <div key={campo}>
                        <label htmlFor={`campo-${campo}`} className={rotuloPainel}>{rotulo}</label>
                        <input
                          id={`campo-${campo}`}
                          type="text"
                          value={dados[campo]}
                          onChange={e => atualizarCampo(campo, e.target.value)}
                          placeholder={TEXTO_CONFRONTACAO_PADRAO}
                          className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 font-sans text-xs focus:outline-none focus:ring-2 focus:ring-[#64748B]"
                        />
                      </div>
                    ))}

                    <div className="flex flex-wrap items-center justify-between gap-2">
                      {textoAutosDisponivel ? (
                        <button type="button" onClick={preencherConfrontacoesPelosAutos} className={botaoClaro} title="Extrair confrontações do texto dos autos (petição / OCR) já carregado">
                          <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Preencher pelos autos</span>
                        </button>
                      ) : <span />}
                      {origemConfrontacoes && (
                        <span className="text-[10px] text-gray-500">Último preenchimento automático: {origemConfrontacoes}.</span>
                      )}
                    </div>

                    <div className="space-y-1.5 rounded-xl border border-[#CBD5E1]/80 bg-[#F8F7F4] p-3 text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-[#1E293B]">
                        <Sparkles className="h-3.5 w-3.5 text-[#334155]" aria-hidden="true" />
                        <span>Sincronização Automática (5º Parágrafo):</span>
                      </div>
                      <div className="text-[11px] text-[#1E293B]">
                        <strong>Transcrições Anexas:</strong> <span className="font-mono">{dados.transcricoes_anexas || 'nenhuma'}</span>
                      </div>
                      <div className="text-[11px] text-[#1E293B]">
                        <strong>Matrículas Anexas:</strong> <span className="font-mono">{dados.matriculas_anexas || 'nenhuma'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* PAINEL DIREITO: PRÉ-VISUALIZAÇÃO A4 DA MANIFESTAÇÃO */}
                <div className="min-w-0 space-y-4 lg:col-span-7">
                  <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs">
                    <div className="text-xs font-semibold text-gray-700">Pré-visualização A4 da Manifestação Oficial</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => setAbaAtiva('formulario')} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer">
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Voltar à Etapa 1</span>
                      </button>
                      <button type="button" onClick={copiarManifestacao} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200 cursor-pointer">
                        {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                        <span>{copiado ? 'Copiado' : 'Copiar'}</span>
                      </button>
                      <button type="button" onClick={imprimirManifestacaoOficial} className={botaoClaro}>
                        <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Imprimir A4</span>
                      </button>
                      {arquivada && (
                        <button type="button" onClick={baixarPdfArquivado} className={botaoClaro} title="Baixar o PDF da manifestação arquivada">
                          <Download className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Baixar PDF</span>
                        </button>
                      )}
                      {onFinalizar && (!arquivada || alteradaAposArquivar) && (
                        <button
                          type="button"
                          onClick={solicitarFinalizacao}
                          disabled={finalizando}
                          className={botaoEscuro}
                          title="Arquivar a manifestação no banco do FIORIX (não poderá ser alterada depois)"
                        >
                          {finalizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Archive className="h-3.5 w-3.5" aria-hidden="true" />}
                          <span>{finalizando ? 'Arquivando…' : arquivada || versaoAnteriorId ? 'Finalizar nova versão' : 'Finalizar Manifestação'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {versaoAnteriorId && !arquivada && (
                    <div className="rounded-xl border border-[#CBD5E1] bg-[#F8F7F4] px-3.5 py-2.5 text-xs font-semibold text-[#1E293B]">
                      Correção de manifestação já arquivada: ao finalizar, será gravada uma nova versão e a anterior permanece no Histórico.
                    </div>
                  )}
                  {arquivada && (
                    <div
                      role="status"
                      className={`flex flex-wrap items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                        alteradaAposArquivar ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'
                      }`}
                    >
                      {alteradaAposArquivar ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                      <span>
                        Arquivada no FIORIX em {new Date(arquivada.info.finalizadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        {arquivada.info.finalizadoPorNome ? ` por ${arquivada.info.finalizadoPorNome}` : ''} (versão {arquivada.info.versao}).
                        {alteradaAposArquivar && ' O texto foi alterado depois do arquivamento: as alterações só ficam registradas se você finalizar uma nova versão.'}
                      </span>
                    </div>
                  )}

                  {renderFolhaManifestacao(false)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Painel lateral: Revisão dos dados ── */}
      {painelRevisaoAberto && (
        <div className="fixed inset-0 z-[120] flex justify-end">
          <div
            className="absolute inset-0 bg-black/50"
            aria-hidden="true"
            onClick={() => { setPainelRevisaoAberto(false); revisaoBotaoRef.current?.focus(); }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="revisao-dados-titulo"
            className="relative flex h-full w-full flex-col border-l border-white/10 bg-[#0B1120] shadow-2xl sm:w-[480px] lg:w-[540px] animate-in slide-in-from-right-4 duration-200"
          >
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                <h3 id="revisao-dados-titulo" className="text-sm font-semibold text-white">Revisão dos dados</h3>
              </div>
              <button
                ref={painelFecharRef}
                type="button"
                onClick={() => { setPainelRevisaoAberto(false); revisaoBotaoRef.current?.focus(); }}
                aria-label="Fechar revisão dos dados"
                className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div role="tablist" aria-label="Seções da revisão" className="flex gap-1 overflow-x-auto border-b border-white/10 px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {([
                { id: 'pendencias', rotulo: 'Pendências e alertas' },
                { id: 'origem', rotulo: 'Origem e confiança do OCR' },
                { id: 'autenticidade', rotulo: 'Validação de autenticidade' },
              ] as const).map(aba => {
                const ativa = abaRevisao === aba.id;
                return (
                  <button
                    key={aba.id}
                    type="button"
                    role="tab"
                    aria-selected={ativa}
                    onClick={() => setAbaRevisao(aba.id)}
                    className={`relative shrink-0 px-2.5 pb-2.5 pt-2.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded-t ${
                      ativa ? 'text-cyan-300' : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {aba.rotulo}
                    {aba.id === 'pendencias' && pendenciasAtivas.length > 0 && (
                      <span className="ml-1.5 rounded bg-amber-400/15 px-1.5 text-[10px] font-semibold text-amber-300">
                        {pendenciasAtivas.length}
                      </span>
                    )}
                    <span aria-hidden="true" className={`absolute inset-x-1 -bottom-px h-0.5 rounded-full ${ativa ? 'bg-cyan-400' : 'bg-transparent'}`} />
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {abaRevisao === 'pendencias' && (
                <div className="space-y-3">
                  {pendenciasAtivas.length === 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-300">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <span>Nenhuma pendência identificada nos dados para elaboração.</span>
                    </div>
                  )}

                  {pendenciasAtivas.map(p => (
                    <div key={p.id} data-pendencia={p.id} className="rounded-lg border border-amber-400/25 bg-amber-400/[0.05] p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-100">{p.titulo}: valor diverge da sugestão automática</p>
                          <dl className="mt-1.5 grid grid-cols-[auto,1fr] gap-x-3 gap-y-0.5 text-xs">
                            <dt className="text-slate-500">Valor atual</dt>
                            <dd className="text-slate-200">{p.valorAtual || '—'}</dd>
                            <dt className="text-slate-500">Sugestão</dt>
                            <dd className="text-slate-200">{p.sugestao}</dd>
                            <dt className="text-slate-500">Origem</dt>
                            <dd className="text-slate-400">{p.motivo}</dd>
                          </dl>
                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => setDivergenciasRevisadas(prev => ({ ...prev, [p.id]: p.chave }))}
                              className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-100 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                            >
                              Manter valor escolhido
                            </button>
                            <button
                              type="button"
                              onClick={() => atualizarCampo(p.campo, p.sugestao)}
                              className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-slate-100 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                            >
                              Usar sugestão
                            </button>
                            <button
                              type="button"
                              onClick={() => irParaCampo(p.campo)}
                              className="rounded-md px-2.5 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-400/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                            >
                              Ir para o campo
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {pendenciasMantidas.length > 0 && (
                    <div className="pt-1">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Revisadas</p>
                      <ul className="space-y-1.5">
                        {pendenciasMantidas.map(p => (
                          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-xs text-slate-400">
                            <span>
                              {p.titulo}: mantido <span className="text-slate-200">{p.valorAtual}</span> (sugestão: {p.sugestao})
                            </span>
                            <button
                              type="button"
                              onClick={() => setDivergenciasRevisadas(prev => {
                                const n = { ...prev };
                                delete n[p.id];
                                return n;
                              })}
                              className="rounded px-1.5 text-cyan-300 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                            >
                              Desfazer
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="pt-1 text-[11px] leading-relaxed text-slate-500">
                    Divergências são calculadas comparando os valores atuais com as sugestões automáticas. Nenhum dado é alterado sem uma ação sua.
                  </p>
                </div>
              )}

              {abaRevisao === 'origem' && (
                totalCamposOrigem > 0 ? (
                  <ConfidenceReview campos={dados.origem_campos || []} requerente={dados.requerente} />
                ) : (
                  <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm text-slate-400">
                    Esta extração não registrou a origem dos campos no texto do PDF.
                  </div>
                )
              )}

              {abaRevisao === 'autenticidade' && <ValidacaoAutenticidadeView dados={dados} />}
            </div>
          </div>
        </div>
      )}

      {/* ── Guia de competências ── */}
      {guiaAberto && (
        <DialogoSobreposto titulo="Guia de competências" onFechar={() => setGuiaAberto(false)} largura="max-w-2xl">
          <ul className="grid grid-cols-1 gap-2.5 text-xs leading-relaxed text-gray-600 sm:grid-cols-2">
            <li className="rounded-lg border border-gray-200 bg-[#F8F7F4] p-3">
              <strong className="mb-0.5 block text-gray-900">Escrevente responsável</strong>
              Identifica o escrevente que fez a análise do processo, planta e certidões, vinculando a autoria funcional do exame.
            </li>
            <li className="rounded-lg border border-gray-200 bg-[#F8F7F4] p-3">
              <strong className="mb-0.5 block text-gray-900">Subdistrito territorial</strong>
              Cada subdistrito da Capital tem uma data de competência histórica territorial (ex.: Alto da Moóca = 23/12/1938). O sistema preenche essa data automaticamente na manifestação.
            </li>
            <li className="rounded-lg border border-gray-200 bg-[#F8F7F4] p-3">
              <strong className="mb-0.5 block text-gray-900">Resultado das buscas</strong>
              Indica se o imóvel tem matrícula ativa nesta 7ª Circunscrição (POSITIVAS) ou se não há registro local (NEGATIVAS). Isso altera a redação jurídica enviada ao Magistrado.
            </li>
            <li className="rounded-lg border border-gray-200 bg-[#F8F7F4] p-3">
              <strong className="mb-0.5 block text-gray-900">Cartório de encaminhamento</strong>
              Quando as buscas apontam que a transcrição de origem pertence a outra serventia anterior (ex.: 3º RI), sugere formalmente ao Juiz a remessa dos autos àquele cartório.
            </li>
          </ul>
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[480px] text-left text-xs">
              <caption className="sr-only">Subdistritos, cartório sugerido e competência</caption>
              <thead className="bg-[#F8F7F4] text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Subdistrito</th>
                  <th className="px-3 py-2 font-medium">Cartório sugerido</th>
                  <th className="px-3 py-2 font-medium">Competência</th>
                </tr>
              </thead>
              <tbody>
                {SUBDISTRITOS_7RI.map(s => (
                  <tr key={s.nome} className="border-t border-gray-100 text-gray-700">
                    <td className="px-3 py-1.5 font-medium text-gray-900">{s.nome}</td>
                    <td className="px-3 py-1.5">{s.cartorioSugerido}</td>
                    <td className="px-3 py-1.5">{s.competencia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogoSobreposto>
      )}

      {/* ── Confirmação de operações que sobrescrevem edições ── */}
      {confirmacao && (
        <DialogoSobreposto
          titulo={confirmacao.titulo}
          onFechar={() => setConfirmacao(null)}
          rodape={
            <>
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmacao(null)}
                className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64748B]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const acao = confirmacao.onConfirmar;
                  setConfirmacao(null);
                  acao();
                }}
                className="rounded-lg bg-[#1E293B] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#334155] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A082]"
              >
                {confirmacao.rotuloConfirmar}
              </button>
            </>
          }
        >
          <div className="text-sm leading-relaxed text-gray-700">{confirmacao.mensagem}</div>
        </DialogoSobreposto>
      )}

      {/* ── Folha isolada para impressão (somente durante a impressão) ── */}
      {impressao && typeof document !== 'undefined' && createPortal(
        <div id="fiorix-print-root">
          <style>{CSS_IMPRESSAO}</style>
          {impressao === 'formulario' ? renderFolhaFichaImpressao() : renderFolhaManifestacao(true)}
        </div>,
        document.body
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Componentes e utilitários de apoio
// ═══════════════════════════════════════════════════════════════════════════

interface Confirmacao {
  titulo: string;
  mensagem: React.ReactNode;
  rotuloConfirmar: string;
  onConfirmar: () => void;
}

interface Pendencia {
  id: string;
  campo: keyof DadosManifestacao;
  titulo: string;
  valorAtual: string;
  sugestao: string;
  motivo: string;
  chave: string;
}

const ROTULOS_CAMPOS: Partial<Record<keyof DadosManifestacao, string>> = {
  subdistrito: 'Subdistrito',
  data_competencia_subdistrito: 'Data de competência',
  cartorio_encaminhamento: 'Cartório de encaminhamento',
  cartorio_origem: 'Cartório de origem',
  resultado_buscas: 'Resultado das buscas',
  escrevente_pasta: 'Escrevente',
  confrontante_lado_direito: 'Lado direito',
  confrontante_lado_esquerdo: 'Lado esquerdo',
  confrontante_fundos: 'Fundos',
};

const CAMPOS_IGNORADOS_EDICAO: (keyof DadosManifestacao)[] = ['origem_campos'];

function listarCamposAlterados(atual: DadosManifestacao, base: DadosManifestacao): (keyof DadosManifestacao)[] {
  return (Object.keys(atual) as (keyof DadosManifestacao)[]).filter(
    k => !CAMPOS_IGNORADOS_EDICAO.includes(k) && String(atual[k] ?? '') !== String(base[k] ?? '')
  );
}

function normalizarComparacao(txt: string): string {
  return (txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function formatarTitulo(txt: string): string {
  return (txt || '')
    .toLowerCase()
    .replace(/(^|\s)(\S)/g, (_m, a: string, b: string) => a + b.toUpperCase())
    .replace(/\s(Da|De|Do|Das|Dos|E)(?=\s)/g, w => w.toLowerCase());
}

function DialogoSobreposto({
  titulo,
  onFechar,
  children,
  rodape,
  largura = 'max-w-lg',
}: {
  titulo: string;
  onFechar: () => void;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: string;
}) {
  const idTitulo = useMemo(() => `dlg-${titulo.replace(/\W+/g, '-').toLowerCase()}`, [titulo]);
  return (
    <div data-no-print="true" className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        className={`flex max-h-[90vh] w-full ${largura} flex-col overflow-hidden rounded-xl border border-gray-200 bg-white text-gray-900 shadow-2xl`}
      >
        <div className="flex items-center justify-between gap-3 bg-[#1E293B] px-4 py-3">
          <h3 id={idTitulo} className="text-sm font-semibold text-white">{titulo}</h3>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="rounded-md p-1 text-[#CBD5E1] hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A082]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        {rodape && <div className="flex justify-end gap-2 border-t border-gray-200 bg-[#F8F7F4] px-4 py-3">{rodape}</div>}
      </div>
    </div>
  );
}

// ─── Minuta de Manifestação: modelo único para exibição e cópia ──────────────

export interface Segmento {
  t: string;
  destaque?: boolean;
}

const TEXTO_CONFRONTACAO_PADRAO = 'conforme apuração nos autos';

export interface MinutaModelo {
  timbre: { linha1: string; numero: string; ordinal: string; linha3: string; endereco: string };
  cabecalho: {
    processoRotulo: string;
    processoValor: string;
    vara: string;
    interessadosRotulo: string;
    interessadosValor: string;
    natureza: string;
  };
  saudacao: string;
  paragrafosAntes: Segmento[][];
  introConfrontacoes: string;
  confrontacoes: { campo: 'confrontante_lado_direito' | 'confrontante_lado_esquerdo' | 'confrontante_fundos'; rotulo: string; valor: string; pontuacao: string }[];
  paragrafosDepois: Segmento[][];
  local: string;
  assinatura: { nome: string; cargo: string };
}

export function montarMinuta(d: DadosManifestacao, saudacao: string): MinutaModelo {
  const matricula = d.matricula_transcricao || '_____';
  const cartorioEncaminhamento = d.cartorio_encaminhamento || d.cartorio_origem || '3º Oficial de Registro de Imóveis da Capital';
  return {
    timbre: {
      linha1: 'OFICIAL',
      numero: '7',
      ordinal: 'SÉTIMO',
      linha3: 'DE REGISTRO DE IMÓVEIS',
      endereco: 'Fone: 3218-0527 — R. Augusta, 356 / Consolação — Cep: 01304-000 — São Paulo — SP',
    },
    cabecalho: {
      processoRotulo: 'PROCESSO DIGITAL nº',
      processoValor: d.numero_processo || '____________________',
      vara: `E. ${d.vara || '1ª'} Vara de Registros Públicos da Capital.`,
      interessadosRotulo: 'INTERESSADOS:',
      interessadosValor: (d.requerente || 'A IDENTIFICAR').toUpperCase(),
      natureza: 'USUCAPIÃO',
    },
    saudacao: `${saudacao}:`,
    paragrafosAntes: [
      [
        {
          t: `Em atenção ao r. despacho de fls. ${d.fls_inicial || '05/06'} e ${d.fls_laudo || '35/46'}, cumpre-me informar a V. Exa. que, revendo os livros de transcrições das transmissões, bem assim as fichas do Livro nº 2 – Registro Geral, deste Cartório, procedendo às buscas no Indicador Real e no Índice de Contribuintes da Prefeitura do Município de São Paulo, pelo contribuinte nº ${d.contribuinte_sql || '___________'}, as mesmas resultaram `,
        },
        { t: (d.resultado_buscas || 'NEGATIVAS').toUpperCase(), destaque: true },
        { t: '.' },
      ],
      [
        { t: 'Segundo elementos constantes dos autos, o imóvel usucapiendo encontra-se transcrito em nome de ' },
        { t: d.titular_origem || 'TITULAR A CONFERIR', destaque: true },
        { t: ', sob nº ' },
        { t: matricula, destaque: true },
        {
          t: ` do ${d.cartorio_origem || '3º Oficial de Registro de Imóveis da Capital'}, conforme certidão de fls. ${d.fls_certidao_origem || '30/32'}.`,
        },
      ],
    ],
    introConfrontacoes: 'Pela planta do Setor Fiscal Municipal do imóvel usucapiendo, verifica-se que o mesmo confronta:',
    confrontacoes: [
      { campo: 'confrontante_lado_direito', rotulo: '– pelo lado direito com', valor: d.confrontante_lado_direito || TEXTO_CONFRONTACAO_PADRAO, pontuacao: ';' },
      { campo: 'confrontante_lado_esquerdo', rotulo: '– pelo lado esquerdo com', valor: d.confrontante_lado_esquerdo || TEXTO_CONFRONTACAO_PADRAO, pontuacao: ';' },
      { campo: 'confrontante_fundos', rotulo: '– e aos fundos com', valor: d.confrontante_fundos || TEXTO_CONFRONTACAO_PADRAO, pontuacao: '.' },
    ],
    paragrafosDepois: [
      [
        {
          t: `Informo, outrossim, que a área em apreço passou a pertencer a esta Serventia a partir de ${d.data_competencia_subdistrito || '23 de dezembro de 1.938'}, por força do Decreto Estadual nº 9.775, de 30 de novembro de 1.938.`,
        },
      ],
      ...(d.contribuinte_nao_averbado !== false && d.contribuinte_sql ? [
        [
          {
            t: `Cumpre salientar que não consta expressamente averbada na(s) matrícula(s) / transcrição(ões) encontrada(s) a inscrição do contribuinte municipal nº `,
          },
          {
            t: d.contribuinte_sql,
            destaque: true,
          },
          {
            t: `, sendo indispensável que a correlação entre o lançamento fiscal e o fólio real decorra de confirmação pericial no local por perito nomeado por esse D. Juízo ou juntada de Certidão de Dados Cadastrais da Prefeitura do Município de São Paulo (PMSP).`,
          },
        ],
      ] : []),
      [
        {
          t:
            d.transcricoes_anexas || d.matriculas_anexas
              ? `Encaminho cópia da planta do Setor Fiscal Municipal, certidões das transcrições nºs ${d.transcricoes_anexas || '—'} e matrículas nºs ${d.matriculas_anexas || '—'}, para que acompanhe a presente.`
              : 'Encaminho cópia da planta do Setor Fiscal Municipal, para que acompanhe a presente.',
        },
      ],
      [
        { t: `Com a vênia devida, sugiro o encaminhamento dos presentes autos ao digno ${cartorioEncaminhamento}, tendo em vista a transcrição de origem nº ` },
        { t: matricula, destaque: true },
        { t: '.' },
      ],
      [{ t: 'Era o que, respeitosamente, cumpria informar a V. Exa.' }],
    ],
    local: `São Paulo, ${obterDataPorExtenso()}.`,
    assinatura: { nome: 'Ademar Fioranelli', cargo: '7º Oficial de Registro de Imóveis da Capital – SP' },
  };
}

function textoSegmentos(segs: Segmento[]): string {
  return segs.map(s => s.t).join('');
}

export function minutaParaTexto(m: MinutaModelo): string {
  const linhas: string[] = [
    m.timbre.linha1,
    `${m.timbre.numero} • ${m.timbre.ordinal}`,
    m.timbre.linha3,
    m.timbre.endereco,
    '____________________________________________________________________________________',
    '',
    `${m.cabecalho.processoRotulo} ${m.cabecalho.processoValor}`,
    m.cabecalho.vara,
    `${m.cabecalho.interessadosRotulo} ${m.cabecalho.interessadosValor}`,
    m.cabecalho.natureza,
    '',
    m.saudacao,
    '',
  ];
  m.paragrafosAntes.forEach(p => linhas.push(textoSegmentos(p), ''));
  linhas.push(m.introConfrontacoes);
  m.confrontacoes.forEach(c => linhas.push(`${c.rotulo} ${c.valor}${c.pontuacao}`));
  linhas.push('');
  m.paragrafosDepois.forEach(p => linhas.push(textoSegmentos(p), ''));
  linhas.push(m.local, '', '___________________________________', m.assinatura.nome, m.assinatura.cargo);
  return linhas.join('\n');
}

function Segmentos({ segmentos }: { segmentos: Segmento[] }) {
  return (
    <>
      {segmentos.map((s, i) =>
        s.destaque ? (
          <span key={i} className="font-bold underline">{s.t}</span>
        ) : (
          <React.Fragment key={i}>{s.t}</React.Fragment>
        )
      )}
    </>
  );
}
