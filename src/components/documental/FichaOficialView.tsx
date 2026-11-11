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
  Globe,
  MapPin,
  ExternalLink,
  Compass,
  FolderOpen,
  FilePlus2,
  FileText,
  Edit3,
  SlidersHorizontal,
  Clock,
} from 'lucide-react';
import { ConfidenceReview, OrigemCampoUI } from './ConfidenceReview';
import { ValidacaoAutenticidadeView } from './ValidacaoAutenticidadeView';
import { formatCartorioPath, getRootInfo } from './DocumentSearch';
import {
  extrairConfrontacoes,
  ConfrontacoesExtraidas,
  resolverPlantaSetorQuadra,
  sanitizarDescricaoImovel,
  sanitizarLogradouroConfrontacao,
  extrairImovelDoTextoAutos,
  formatarDescricaoImovelGeoSampa,
} from '@/lib/confrontacoes';
import { copiarTextoSeguro } from '@/lib/documental/pdfTransfer';
import { baixarDocxManifestacao, baixarDocManifestacao } from '@/lib/documental/generateManifestacaoWord';
import {
  LOGO_7RI_MANIFESTACAO_DATA_URI,
  LOGO_7RI_MANIFESTACAO_HEIGHT_PX,
  LOGO_7RI_MANIFESTACAO_WIDTH_PX,
} from '@/lib/documental/logo7riManifestacao';

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
  status_conferencia?: 'AGUARDANDO_CONFERENCIA' | 'CONFERIDO';
  conferido_por_nome?: string | null;
  conferido_em?: string | null;
  // Campos da tela híbrida da Manifestação e salvamento de rascunho no FIORIX
  natureza_processo?: string;
  saudacao_juiz?: string;
  paragrafo_1_custom?: string;
  paragrafo_2_custom?: string;
  intro_confrontacoes_custom?: string;
  paragrafo_competencia_custom?: string;
  paragrafo_contribuinte_custom?: string;
  paragrafo_anexos_custom?: string;
  paragrafo_encaminhamento_custom?: string;
  modelo_finalizacao_manifestacao?: ModeloFinalizacaoManifestacaoId;
  incluir_fecho_cortesia?: boolean;
  paragrafo_fecho_custom?: string;
  paragrafo_extra_custom?: string;
  corpo_livre_manifestacao?: string;
  modo_edicao_manifestacao?: 'hibrido' | 'texto_livre';
  local_data_manifestacao?: string;
  assinatura_titulo?: string;
  assinatura_nome?: string;
  assinatura_cargo?: string;
  rascunho_salvo_em?: string | null;
  etapa_ativa_salva?: 'formulario' | 'manifestacao';
}

export type ModeloFinalizacaoManifestacaoId =
  | '1_positivas_portaria_juizo'
  | '2_positivas_aqui_12ri_juizo'
  | '3_nesta_oportunidade_9ri'
  | '4_complemento_3ri'
  | '5_complemento_9ri_6ri_3ri'
  | '6_zona_limitrofe_ipiranga_6ri'
  | '7_complemento_cartorio_dinamico'
  | '8_sugestao_origem_matricula';

export interface ModeloFinalizacaoOpcao {
  id: ModeloFinalizacaoManifestacaoId;
  numero: number;
  rotuloCurto: string;
  rotulo: string;
  descricao: string;
}

export const MODELOS_FINALIZACAO_MANIFESTACAO: ModeloFinalizacaoOpcao[] = [
  {
    id: '1_positivas_portaria_juizo',
    numero: 1,
    rotuloCurto: '1. Positivas (Portaria 1/26 → Juízo)',
    rotulo: '1 - Buscas Positivas (Portaria Conjunta nº 1/26 — Encaminhamento direto ao D. Juízo)',
    descricao:
      'Tendo sido positivas as buscas em relação ao imóvel usucapiendo e seus confinantes, em cumprimento ao § 2º do art. 1º da Portaria Conjunta nº 1/26, dessa e da 1ª Vara de Registros Públicos, encaminho os Autos diretamente a esse D. Juízo.',
  },
  {
    id: '2_positivas_aqui_12ri_juizo',
    numero: 2,
    rotuloCurto: '2. Positivas (aqui e 12º RI → Juízo)',
    rotulo: '2 - Buscas Positivas aqui e no 12º RI (Encaminhamento direto ao D. Juízo)',
    descricao:
      'Tendo sido positivas as buscas em relação à área a ser usucapida e seus confinantes, aqui e no 12º Registro de Imóveis da Capital, encaminho os autos diretamente a esse D. Juízo.',
  },
  {
    id: '3_nesta_oportunidade_9ri',
    numero: 3,
    rotuloCurto: '3. Encaminhar ao 9º RI (Nesta oportunidade)',
    rotulo: '3 - Nesta oportunidade encaminho os Autos ao digno 9º Oficial de Registro de Imóveis da Capital',
    descricao:
      'Nesta oportunidade encaminho os Autos ao digno 9º Oficial de Registro de Imóveis da Capital, para complemento das informações.',
  },
  {
    id: '4_complemento_3ri',
    numero: 4,
    rotuloCurto: '4. Encaminhar ao 3º RI (Complemento)',
    rotulo: '4 - Para complemento das informações encaminho os Autos ao digno 3º Oficial de Registro de Imóveis da Capital',
    descricao:
      'Para complemento das informações encaminho os Autos ao digno 3º Oficial de Registro de Imóveis da Capital.',
  },
  {
    id: '5_complemento_9ri_6ri_3ri',
    numero: 5,
    rotuloCurto: '5. Encaminhar ao 9º RI (+ 6º e 3º RI)',
    rotulo: '5 - Encaminhamento ao 9º RI, devendo manifestar-se também o 6º e 3º Registros de Imóveis',
    descricao:
      'Para complemento das informações encaminho os Autos ao digno 9º Oficial de Registro de Imóveis da Capital, sendo que, deverá manifestar-se também o 6º e 3º Registros de Imóveis da Capital.',
  },
  {
    id: '6_zona_limitrofe_ipiranga_6ri',
    numero: 6,
    rotuloCurto: '6. Zona Limítrofe IPIRANGA (+ 6º RI)',
    rotulo: '6 - Zona limítrofe com o Subdistrito IPIRANGA — manifestação do 6º Oficial de Registro de Imóveis',
    descricao:
      'Nesta oportunidade para complemento das informações, alertando para o fato de que, por estar o imóvel situado em zona limítrofe com o Subdistrito IPIRANGA, deverá manifestar-se também, o 6º Oficial de Registro de Imóveis da Capital.',
  },
  {
    id: '7_complemento_cartorio_dinamico',
    numero: 7,
    rotuloCurto: '7. Complemento (Cartório selecionado)',
    rotulo: '7 - Para complemento das informações encaminho ao Cartório selecionado nos dados',
    descricao:
      'Para complemento das informações encaminho os Autos ao digno Cartório de Registro de Imóveis selecionado.',
  },
  {
    id: '8_sugestao_origem_matricula',
    numero: 8,
    rotuloCurto: '8. Sugestão com nº da Matrícula/Transcrição',
    rotulo: '8 - Com a vênia devida, sugiro o encaminhamento tendo em vista a transcrição/matrícula de origem',
    descricao:
      'Com a vênia devida, sugiro o encaminhamento dos presentes autos ao digno Cartório, tendo em vista a transcrição de origem.',
  },
];

export function inferirModeloFinalizacaoPadrao(d: Partial<DadosManifestacao>): ModeloFinalizacaoManifestacaoId {
  if (d.modelo_finalizacao_manifestacao) return d.modelo_finalizacao_manifestacao;
  const buscas = (d.resultado_buscas || '').toUpperCase();
  const cart = (d.cartorio_encaminhamento || d.cartorio_origem || '').toUpperCase();
  const sub = (d.subdistrito || '').toUpperCase();
  if (buscas.includes('POSITIVA')) {
    if (
      cart.includes('12') ||
      ['SÃO MIGUEL PAULISTA', 'ERMELINO MATARAZZO', 'CANGAÍBA', 'PENHA DE FRANÇA', 'VILA MATILDE'].includes(sub)
    ) {
      return '2_positivas_aqui_12ri_juizo';
    }
    return '1_positivas_portaria_juizo';
  }
  if (cart.includes('9º') || cart.includes('9O') || cart.startsWith('9')) {
    return '3_nesta_oportunidade_9ri';
  }
  if (cart.includes('3º') || cart.includes('3O') || cart.startsWith('3')) {
    return '4_complemento_3ri';
  }
  if (sub.includes('IPIRANGA')) {
    return '6_zona_limitrofe_ipiranga_6ri';
  }
  return '8_sugestao_origem_matricula';
}

export function obterSegmentosFinalizacaoPorModelo(
  d: DadosManifestacao,
  modeloId?: ModeloFinalizacaoManifestacaoId,
): Segmento[] {
  const id = modeloId || inferirModeloFinalizacaoPadrao(d);
  const matricula = d.matricula_transcricao || '_____';
  const cartorioEncaminhamento =
    d.cartorio_encaminhamento || d.cartorio_origem || '3º Oficial de Registro de Imóveis da Capital';

  switch (id) {
    case '1_positivas_portaria_juizo':
      return [
        {
          t: 'Tendo sido positivas as buscas em relação ao imóvel usucapiendo e seus confinantes, em cumprimento ao § 2º do art. 1º da Portaria Conjunta nº 1/26, dessa e da 1ª Vara de Registros Públicos, encaminho os Autos diretamente a esse D. Juízo.',
        },
      ];
    case '2_positivas_aqui_12ri_juizo':
      return [
        { t: 'Tendo sido positivas as buscas em relação à área a ser usucapida e seus confinantes, ' },
        { t: 'aqui', sublinhado: true },
        { t: ' e no ' },
        { t: '12º', negrito: true },
        { t: ' Registro de Imóveis da Capital, encaminho os autos diretamente a esse D. Juízo.' },
      ];
    case '3_nesta_oportunidade_9ri':
      return [
        { t: 'Nesta oportunidade encaminho os Autos ao digno ' },
        { t: '9º', negrito: true },
        { t: ' Oficial de Registro de Imóveis da Capital, para complemento das informações.' },
      ];
    case '4_complemento_3ri':
      return [
        { t: 'Para complemento das informações encaminho os Autos ao digno ' },
        { t: '3º', negrito: true },
        { t: ' Oficial de Registro de Imóveis da Capital.' },
      ];
    case '5_complemento_9ri_6ri_3ri':
      return [
        { t: 'Para complemento das informações encaminho os Autos ao digno ' },
        { t: '9º', negrito: true },
        { t: ' Oficial de Registro de Imóveis da Capital, sendo que, deverá manifestar-se também o ' },
        { t: '6º', negrito: true },
        { t: ' e ' },
        { t: '3º', negrito: true },
        { t: ' Registros de Imóveis da Capital.' },
      ];
    case '6_zona_limitrofe_ipiranga_6ri':
      return [
        {
          t: 'Nesta oportunidade para complemento das informações, alertando para o fato de que, por estar o imóvel situado em zona limítrofe com o Subdistrito ',
        },
        { t: 'IPIRANGA', negrito: true },
        { t: ', deverá manifestar-se também, o ' },
        { t: '6º', negrito: true },
        { t: ' Oficial de Registro de Imóveis da Capital.' },
      ];
    case '7_complemento_cartorio_dinamico':
      return [
        { t: `Para complemento das informações encaminho os Autos ao digno ${cartorioEncaminhamento}.` },
      ];
    case '8_sugestao_origem_matricula':
    default:
      return [
        {
          t: `Com a vênia devida, sugiro o encaminhamento dos presentes autos ao digno ${cartorioEncaminhamento}, tendo em vista a transcrição de origem nº `,
        },
        { t: matricula, destaque: true },
        { t: '.' },
      ];
  }
}

export function obterTextoPlanoFinalizacaoPorModelo(
  d: DadosManifestacao,
  modeloId?: ModeloFinalizacaoManifestacaoId,
): string {
  return obterSegmentosFinalizacaoPorModelo(d, modeloId)
    .map(s => s.t)
    .join('');
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
  confirmouImpressao?: boolean;
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
  let imovelLimpo = sanitizarDescricaoImovel(dadosIniciais.imovel);
  let ruaLimpa = sanitizarLogradouroConfrontacao(dadosIniciais.rua_olhar_confrontacao, dadosIniciais.imovel);

  const origensHigienizadas = Array.isArray(dadosIniciais.origem_campos)
    ? dadosIniciais.origem_campos.map(o => {
        if (o?.campo === 'imovel' && o.trecho) {
          return { ...o, trecho: sanitizarDescricaoImovel(o.trecho) };
        }
        return o;
      })
    : dadosIniciais.origem_campos;

  if (!imovelLimpo) {
    const textoAux = [
      dadosIniciais.anotacoes_ficha_oficial,
      ...(origensHigienizadas || []).map(o => o?.trecho || ''),
    ]
      .filter(Boolean)
      .join('\n');
    const recuperado = extrairImovelDoTextoAutos(textoAux);
    if (recuperado.imovel) imovelLimpo = recuperado.imovel;
    if (!ruaLimpa && recuperado.rua) ruaLimpa = recuperado.rua;
  }

  const baseHigienizada: DadosManifestacao = {
    ...dadosIniciais,
    imovel: imovelLimpo,
    rua_olhar_confrontacao: ruaLimpa,
    origem_campos: origensHigienizadas,
  };

  const sug = inferirSugestoesInteligentes(baseHigienizada, arquivoOrigem);
  const dir = (baseHigienizada.confrontante_lado_direito && baseHigienizada.confrontante_lado_direito !== 'conforme apuração nos autos')
    ? baseHigienizada.confrontante_lado_direito
    : (sug.confrontacoes.ladoDireito || baseHigienizada.confrontante_lado_direito || '');
  const esq = (baseHigienizada.confrontante_lado_esquerdo && baseHigienizada.confrontante_lado_esquerdo !== 'conforme apuração nos autos')
    ? baseHigienizada.confrontante_lado_esquerdo
    : (sug.confrontacoes.ladoEsquerdo || baseHigienizada.confrontante_lado_esquerdo || '');
  const fun = (baseHigienizada.confrontante_fundos && baseHigienizada.confrontante_fundos !== 'conforme apuração nos autos')
    ? baseHigienizada.confrontante_fundos
    : (sug.confrontacoes.fundos || baseHigienizada.confrontante_fundos || '');

  let anotacoes = baseHigienizada.anotacoes_ficha_oficial || '';
  if (anotacoes) {
    // Remove linha de Frente (Logradouro) caso contivesse timbre institucional descartado
    anotacoes = anotacoes
      .replace(
        /^[ \t]*•\s*Frente\s*\(Logradouro\):\s*(.+?)[ \t]*\r?$/gim,
        (_match, val) => {
          const vLimpo = sanitizarLogradouroConfrontacao(String(val), dadosIniciais.imovel);
          return vLimpo ? `• Frente (Logradouro): ${vLimpo}` : '';
        },
      )
      .replace(/\n{2,}/g, '\n')
      .trim();
  }
  if (!anotacoes.trim() && (dir || esq || fun)) {
    const linhas: string[] = [];
    if (ruaLimpa) linhas.push(`• Frente (Logradouro): ${ruaLimpa}`);
    if (dir) linhas.push(`• Lado Direito: ${dir}`);
    if (esq) linhas.push(`• Lado Esquerdo: ${esq}`);
    if (fun) linhas.push(`• Fundos: ${fun}`);
    anotacoes = `CONFRONTAÇÕES APURADAS (PETIÇÃO INICIAL / MATRÍCULA):\n${linhas.join('\n')}`;
  }

  return {
    ...baseHigienizada,
    subdistrito: (baseHigienizada.subdistrito && baseHigienizada.subdistrito !== 'ALTO DA MOÓCA')
      ? baseHigienizada.subdistrito
      : sug.subdistrito.valor,
    data_competencia_subdistrito: (baseHigienizada.data_competencia_subdistrito && baseHigienizada.data_competencia_subdistrito !== '23 de dezembro de 1.938')
      ? baseHigienizada.data_competencia_subdistrito
      : sug.dataCompetencia,
    cartorio_encaminhamento: baseHigienizada.cartorio_encaminhamento || sug.cartorioEncaminhamento.valor,
    cartorio_origem: baseHigienizada.cartorio_origem || sug.cartorioEncaminhamento.valor,
    resultado_buscas: baseHigienizada.resultado_buscas || sug.resultadoBuscas.valor,
    escrevente_pasta: (baseHigienizada.escrevente_pasta && ESCREVENTES_USUCAPIAO.includes(baseHigienizada.escrevente_pasta))
      ? baseHigienizada.escrevente_pasta
      : sug.escrevente.valor,
    confrontante_lado_direito: dir,
    confrontante_lado_esquerdo: esq,
    confrontante_fundos: fun,
    anotacoes_ficha_oficial: anotacoes,
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
  onAlternarConferencia,
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
  /** Altera o carimbo de conferência (AGUARDANDO CONFERÊNCIA <-> CONFERIDO). */
  onAlternarConferencia?: (novoStatus: 'AGUARDANDO_CONFERENCIA' | 'CONFERIDO') => void | Promise<void>;
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

  const [abaAtiva, setAbaAtiva] = useState<'formulario' | 'manifestacao'>(() =>
    dadosIniciais.etapa_ativa_salva === 'manifestacao' ? 'manifestacao' : 'formulario',
  );
  const [saudacaoJuiz, setSaudacaoJuiz] = useState<'Meritíssima Juíza' | 'MM. Juiz'>(() =>
    dadosIniciais.saudacao_juiz === 'MM. Juiz' ? 'MM. Juiz' : 'Meritíssima Juíza',
  );
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
  const [salvandoRascunho, setSalvandoRascunho] = useState(false);
  const [arquivada, setArquivada] = useState<{ info: ManifestacaoArquivada; minuta: MinutaModelo; texto: string } | null>(null);
  const [paragrafosEmEdicao, setParagrafosEmEdicao] = useState<Record<string, boolean>>({});
  const [mostrarParagrafoExtra, setMostrarParagrafoExtra] = useState<boolean>(() => Boolean(dadosIniciais.paragrafo_extra_custom));
  const [configuracoesRapidasAbertas, setConfiguracoesRapidasAbertas] = useState(false);

  // Modal de Consulta de Rascunhos e Manifestações Salvas no FIORIX
  const [modalRascunhosAberto, setModalRascunhosAberto] = useState(false);
  const [carregandoRascunhos, setCarregandoRascunhos] = useState(false);
  const [buscaRascunhos, setBuscaRascunhos] = useState('');
  const [filtroRascunhos, setFiltroRascunhos] = useState<'TODOS' | 'RASCUNHO' | 'FINALIZADA'>('TODOS');
  const [listaRascunhosSalvos, setListaRascunhosSalvos] = useState<
    Array<{
      id: string;
      fichaId: string;
      status: 'conferencia' | 'finalizada';
      versao: number;
      numeroProcesso: string | null;
      requerente: string | null;
      matricula: string | null;
      subdistrito: string | null;
      escrevente: string | null;
      updatedAt: string;
      finalizadoEm: string | null;
      criadoPorNome: string | null;
      atualizadoPorNome: string | null;
      finalizadoPorNome: string | null;
      hashSha256: string | null;
      dados: DadosManifestacao;
      minuta: MinutaModelo | null;
      textoFinal: string | null;
    }>
  >([]);

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

  const salvarNaFila = async (aviso = true, etapaPreferida?: 'formulario' | 'manifestacao') => {
    setSalvandoRascunho(true);
    const agoraIso = new Date().toISOString();
    const dadosParaSalvar: DadosManifestacao = {
      ...dados,
      saudacao_juiz: dados.saudacao_juiz || saudacaoJuiz,
      etapa_ativa_salva: etapaPreferida || abaAtiva,
      rascunho_salvo_em: agoraIso,
    };
    setDados(dadosParaSalvar);
    try {
      // Backup local imediato
      gravarFilaFichasOficial(incluirFichaNaFila(lerFilaFichasOficial(), dadosParaSalvar, arquivoOrigem));
      if (onSalvarNaFila) {
        await onSalvarNaFila(dadosParaSalvar);
      } else {
        const { salvarFichaConferencia } = await import('@/lib/documental/manifestacoesClient');
        await salvarFichaConferencia(dadosParaSalvar, arquivoOrigem);
      }
      if (aviso) {
        mostrarAviso(
          'Rascunho salvo em local seguro no FIORIX! Disponível para consulta, edição e finalização a qualquer momento em qualquer estação.',
        );
      }
    } catch (err) {
      mostrarAviso(err instanceof Error ? err.message : 'Não foi possível salvar o rascunho no FIORIX.', 9000);
    } finally {
      setSalvandoRascunho(false);
    }
  };

  const carregarRascunhosDoFiorix = async () => {
    setCarregandoRascunhos(true);
    try {
      const res = await fetch('/api/gestao-documental/manifestacoes?status=todas&limite=150', { cache: 'no-store' });
      const body = await res.json();
      if (res.ok && Array.isArray(body.itens)) {
        setListaRascunhosSalvos(body.itens);
      }
    } catch {
      mostrarAviso('Não foi possível consultar a lista de rascunhos e manifestações salvas no momento.');
    } finally {
      setCarregandoRascunhos(false);
    }
  };

  const abrirModalConsultaRascunhos = () => {
    setModalRascunhosAberto(true);
    void carregarRascunhosDoFiorix();
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
  const ultimaMatriculaAutoLivro2Ref = useRef<string>('');

  function filtrarImagensLivro2(files: Livro2Match[], queryBusca: string): Livro2Match[] {
    const numAlvo = parseInt(queryBusca.replace(/[^\d]/g, ''), 10);
    const candidatas = files.filter(f => {
      const root = (f.rootId || '').toLowerCase();
      const rel = (f.relativePath || '').toLowerCase();
      const isImg =
        root === 'livro2' ||
        root.includes('imagem') ||
        rel.includes('lv2') ||
        /\.(ken|tif|tiff)$/i.test(f.name || rel);
      if (!isImg) return false;
      if (!isNaN(numAlvo) && numAlvo > 0) {
        const fNum = parseInt((f.name || '').replace(/[^\d]/g, ''), 10);
        if (!isNaN(fNum) && fNum === numAlvo) return true;
      }
      return true;
    });
    return candidatas.sort((a, b) => {
      const aNum = parseInt((a.name || '').replace(/[^\d]/g, ''), 10);
      const bNum = parseInt((b.name || '').replace(/[^\d]/g, ''), 10);
      const aExato = !isNaN(numAlvo) && aNum === numAlvo ? 1 : 0;
      const bExato = !isNaN(numAlvo) && bNum === numAlvo ? 1 : 0;
      if (aExato !== bExato) return bExato - aExato;
      const aLv2 = a.rootId === 'livro2' || /lv2/i.test(a.relativePath) ? 1 : 0;
      const bLv2 = b.rootId === 'livro2' || /lv2/i.test(b.relativePath) ? 1 : 0;
      return bLv2 - aLv2;
    });
  }

  async function localizarNoLivro2(matriculaCustom?: string, silencioso = false) {
    const raw = matriculaCustom ?? dados.matricula_transcricao ?? '';
    const numeros = raw.replace(/[^\d]/g, '');
    const queryBusca = numeros && numeros.length >= 2 ? numeros : raw.trim();

    if (!queryBusca || queryBusca.length < 2) {
      if (!silencioso && onVisualizarDocumento) {
        onVisualizarDocumento({
          rootId: 'livro2',
          relativePath: '00000000\\00000001.KEN',
          name: '00000001.KEN',
          size: 0,
          modifiedAt: '',
        });
        return;
      }
      if (!silencioso) {
        setErroLivro2('Informe ao menos 2 dígitos da matrícula para localizar a imagem no Livro 2.');
      }
      return;
    }

    if (!silencioso && !matriculaCustom && arquivosLivro2 && arquivosLivro2.length > 0 && onVisualizarDocumento) {
      onVisualizarDocumento(arquivosLivro2[0]);
      return;
    }

    const construirFallbackLv2 = (): Livro2Match => {
      const n = parseInt(numeros || '1', 10) || 1;
      const pad8 = String(n).padStart(8, '0');
      const bloco = String(Math.floor(n / 1000) * 1000).padStart(8, '0');
      return {
        rootId: 'livro2',
        relativePath: `${bloco}\\${pad8}.KEN`,
        name: `${pad8}.KEN`,
        size: 0,
        modifiedAt: '',
      };
    };

    setBuscandoLivro2(true);
    setErroLivro2(null);
    setTermoBuscadoLivro2(queryBusca);

    try {
      const queryEnvio = /^\d+$/.test(queryBusca) && !/transcri[çc][ãa]o/i.test(raw)
        ? `Matrícula ${queryBusca}`
        : queryBusca;
      const response = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId: connectorId || 'auto',
          type: 'search',
          query: queryEnvio,
          forceFresh: !silencioso,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Connector local indisponível.');

      if (body.status === 'complete' && body.result) {
        const files: Livro2Match[] = body.result.files || [];
        const filtrados = filtrarImagensLivro2(files, queryBusca);
        setArquivosLivro2(filtrados);
        if (!silencioso && onVisualizarDocumento) {
          onVisualizarDocumento(filtrados[0] || construirFallbackLv2());
        }
        return;
      }

      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 650));
        const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
        const state = await res.json();
        if (!res.ok) throw new Error(state.error);
        if (state.status === 'complete' && state.result) {
          const files: Livro2Match[] = state.result.files || [];
          const filtrados = filtrarImagensLivro2(files, queryBusca);
          setArquivosLivro2(filtrados);
          if (!silencioso && onVisualizarDocumento) {
            onVisualizarDocumento(filtrados[0] || construirFallbackLv2());
          }
          return;
        }
        if (state.status === 'failed') throw new Error('Falha na busca da matrícula pelo Connector local.');
      }
      throw new Error('Tempo limite excedido na busca do Livro 2. Verifique se o Connector e o acervo K:\\IMAGENS\\LV2 estão disponíveis.');
    } catch (err) {
      setArquivosLivro2(null);
      if (!silencioso && onVisualizarDocumento) {
        onVisualizarDocumento(construirFallbackLv2());
      } else if (!silencioso) {
        setErroLivro2(err instanceof Error ? err.message : 'Falha ao localizar a matrícula em K:\\IMAGENS\\LV2.');
      }
    } finally {
      setBuscandoLivro2(false);
    }
  }

  // Sempre que houver número de matrícula no processo de usucapião, localiza automaticamente a imagem em K:\IMAGENS\LV2
  useEffect(() => {
    const raw = (dados.matricula_transcricao || '').trim();
    if (!raw || /transcri[çc][ãa]o/i.test(raw)) return;
    const numeros = raw.replace(/[^\d]/g, '');
    if (numeros.length < 2) return;
    const chaveAuto = `${connectorId || 'auto'}:${numeros}`;
    if (ultimaMatriculaAutoLivro2Ref.current === chaveAuto) return;
    ultimaMatriculaAutoLivro2Ref.current = chaveAuto;
    void localizarNoLivro2(raw, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dados.matricula_transcricao, connectorId]);

  // ─── Localização de Plantas Fiscais em K:\IMAGENS\SETORES ────────────────
  const [buscandoSetores, setBuscandoSetores] = useState(false);
  const [arquivosSetores, setArquivosSetores] = useState<Livro2Match[] | null>(null);
  const [erroSetores, setErroSetores] = useState<string | null>(null);
  const [termoBuscadoSetores, setTermoBuscadoSetores] = useState('');

  // ─── Consulta ao GEOSAMPA (WFS Lotes + Integração IPTU + Links Oficiais) ─
  const [cardsGeoSampaVisiveis, setCardsGeoSampaVisiveis] = useState(true);
  const [buscandoGeoSampa, setBuscandoGeoSampa] = useState(false);
  const [erroGeoSampa, setErroGeoSampa] = useState<string | null>(null);
  const [resultadoGeoSampa, setResultadoGeoSampa] = useState<{
    setor: string | null;
    quadra: string | null;
    lote: string | null;
    plantaSetor?: {
      setor: string;
      quadra: string;
      lote?: string;
      pastaSetor: string;
      arquivoKen: string;
      caminhoRelativo: string;
      caminhoCompleto: string;
      termoBusca: string;
    } | null;
    loteGeoSampa?: {
      nr_contribuinte?: string;
      nm_logradouro_completo?: string;
      cd_numero_porta?: string;
      qt_area_terreno?: number;
      qt_area_construida?: number;
      dc_tipo_uso_imovel?: string;
      cd_cib?: string;
    } | null;
    iptuIntegracao?: Record<string, string> | null;
    confrontantesGeoSampa?: {
      frente: string;
      ladoDireito: string;
      ladoEsquerdo: string;
      fundos: string;
      vizinhos: Array<{
        direcao: 'DIREITO' | 'ESQUERDO' | 'FUNDOS' | 'LINDEIRO';
        lote: string;
        sql: string;
        logradouro: string;
        numeroPorta: string;
        areaTerreno?: number;
        distanciaMetros: number;
        descricaoFormatada: string;
      }>;
    } | null;
    linksGeoSampa?: {
      portalNovoGeoSampa: string;
      mapaCamadasSetoresLotes: string;
      mapaPadrao: string;
      atalhoCompartilhado: string;
      geoSampaClassicoSbc: string;
    };
  } | null>(null);

  const plantaSetorCalculada = useMemo(
    () =>
      resultadoGeoSampa?.plantaSetor ||
      resolverPlantaSetorQuadra(dados.contribuinte_sql, dados.imovel),
    [resultadoGeoSampa?.plantaSetor, dados.contribuinte_sql, dados.imovel],
  );

  const arquivoPlantaSetorDireto: Livro2Match | null = useMemo(() => {
    if (arquivosSetores && arquivosSetores.length > 0) return arquivosSetores[0];
    if (!plantaSetorCalculada) return null;
    return {
      rootId: 'imagens',
      relativePath: plantaSetorCalculada.caminhoRelativo,
      name: plantaSetorCalculada.arquivoKen,
      size: 0,
      modifiedAt: '',
    };
  }, [arquivosSetores, plantaSetorCalculada]);

  const ultimaPlantaAutoSetoresRef = useRef<string>('');

  async function localizarPlantaSetorNoAcervo(termoCustom?: string, silencioso = false) {
    const info = resolverPlantaSetorQuadra(dados.contribuinte_sql, dados.imovel) || resultadoGeoSampa?.plantaSetor;
    const queryBusca = (
      termoCustom ||
      info?.termoBusca ||
      (dados.contribuinte_sql && !/^0+$/.test(dados.contribuinte_sql.replace(/[^\d]/g, '')) ? dados.contribuinte_sql : '') ||
      ''
    ).trim();

    const construirFallbackSetor = (): Livro2Match => {
      if (arquivoPlantaSetorDireto) return arquivoPlantaSetorDireto;
      const digitos = queryBusca.replace(/[^\d]/g, '');
      const n = parseInt(digitos.slice(0, 6) || '1001', 10) || 1001;
      const pad8 = String(n).padStart(8, '0');
      const bloco = String(Math.floor(n / 1000) * 1000).padStart(8, '0');
      return {
        rootId: 'imagens',
        relativePath: `SETORES\\${bloco}\\${pad8}.KEN`,
        name: `${pad8}.KEN`,
        size: 0,
        modifiedAt: '',
      };
    };

    if (!queryBusca || queryBusca.length < 2) {
      if (!silencioso && onVisualizarDocumento) {
        onVisualizarDocumento(construirFallbackSetor());
        return;
      }
      if (!silencioso) {
        setErroSetores('Informe o SQL (ex.: 053.006.0049-0) ou o Setor/Quadra (ex.: 00053006 ou setor 053 quadra 006) para localizar a Planta Fiscal em K:\\IMAGENS\\SETORES.');
      }
      return;
    }

    setBuscandoSetores(true);
    setErroSetores(null);
    setTermoBuscadoSetores(queryBusca);

    try {
      const response = await fetch('/api/gestao-documental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectorId: connectorId || 'auto',
          type: 'search',
          query: queryBusca,
          forceFresh: !silencioso,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Connector local indisponível.');

      const filtrarPlantas = (files: Livro2Match[]) => {
        const plantas = files.filter(f => {
          const rel = (f.relativePath || '').toLowerCase();
          return rel.includes('setores') || /^00\d{6}\.(ken|tif|tiff)$/i.test(f.name || '');
        });
        return plantas.length > 0 ? plantas : files;
      };

      if (body.status === 'complete' && body.result) {
        const filtradas = filtrarPlantas(body.result.files || []);
        setArquivosSetores(filtradas);
        if (!silencioso && onVisualizarDocumento) {
          onVisualizarDocumento(filtradas[0] || construirFallbackSetor());
        }
        return;
      }

      const deadline = Date.now() + 35000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 650));
        const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
        const state = await res.json();
        if (!res.ok) throw new Error(state.error);
        if (state.status === 'complete' && state.result) {
          const filtradas = filtrarPlantas(state.result.files || []);
          setArquivosSetores(filtradas);
          if (!silencioso && onVisualizarDocumento) {
            onVisualizarDocumento(filtradas[0] || construirFallbackSetor());
          }
          return;
        }
        if (state.status === 'failed') throw new Error('Falha na busca da Planta Fiscal pelo Connector local.');
      }
      throw new Error('Tempo limite excedido ao consultar K:\\IMAGENS\\SETORES.');
    } catch (err) {
      setArquivosSetores(null);
      if (!silencioso && onVisualizarDocumento) {
        onVisualizarDocumento(construirFallbackSetor());
      } else if (!silencioso) {
        setErroSetores(err instanceof Error ? err.message : 'Falha ao localizar a Planta Fiscal em K:\\IMAGENS\\SETORES.');
      }
    } finally {
      setBuscandoSetores(false);
    }
  }

  // Sempre que o Setor/Quadra do imóvel for identificado, localiza automaticamente a Planta de Setor em K:\IMAGENS\SETORES\
  useEffect(() => {
    const termo = plantaSetorCalculada?.termoBusca?.trim();
    if (!termo || termo.length < 4) return;
    const chaveAuto = `${connectorId || 'auto'}:${termo}`;
    if (ultimaPlantaAutoSetoresRef.current === chaveAuto) return;
    ultimaPlantaAutoSetoresRef.current = chaveAuto;
    void localizarPlantaSetorNoAcervo(termo, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantaSetorCalculada?.termoBusca, connectorId]);

  const registrarConfrontacoesNasAnotacoes = (
    override?: Partial<{
      frente: string;
      ladoDireito: string;
      ladoEsquerdo: string;
      fundos: string;
      plantaFiscal: string;
      sqlGeoSampa: string;
    }>,
  ) => {
    setDados(prev => {
      const frente = override?.frente ?? prev.rua_olhar_confrontacao ?? '';
      const dir = override?.ladoDireito ?? prev.confrontante_lado_direito ?? '';
      const esq = override?.ladoEsquerdo ?? prev.confrontante_lado_esquerdo ?? '';
      const fun = override?.fundos ?? prev.confrontante_fundos ?? '';
      const planta =
        override?.plantaFiscal ??
        plantaSetorCalculada?.caminhoCompleto ??
        '';
      const sqlRef = override?.sqlGeoSampa ?? prev.contribuinte_sql ?? '';

      const linhas: string[] = ['CONFRONTAÇÕES DO IMÓVEL USUCAPIENDO:'];
      if (frente) linhas.push(`• Frente (Logradouro): ${frente}`);
      if (dir) linhas.push(`• Pelo Lado Direito: ${dir}`);
      if (esq) linhas.push(`• Pelo Lado Esquerdo: ${esq}`);
      if (fun) linhas.push(`• Aos Fundos: ${fun}`);
      if (prev.matricula_transcricao) {
        linhas.push(
          `• Matrícula / Transcrição mencionada: ${prev.matricula_transcricao}${prev.cartorio_origem ? ` (${prev.cartorio_origem})` : ''}`,
        );
      }
      if (planta) linhas.push(`• Planta Fiscal (Setores): ${planta}`);
      if (sqlRef && !/^0+$/.test(sqlRef.replace(/[^\d]/g, ''))) {
        linhas.push(`• SQL / GeoSampa: ${sqlRef}`);
      }

      const blocoNovo = linhas.join('\n');
      const atual = (prev.anotacoes_ficha_oficial || '').trim();
      const regexBlocoExistente = /CONFRONTAÇÕES (?:DO IMÓVEL USUCAPIENDO|APURADAS[^\n]*):[\s\S]*?(?=\n\n|$)/i;
      const novasAnotacoes = !atual
        ? blocoNovo
        : regexBlocoExistente.test(atual)
        ? atual.replace(regexBlocoExistente, blocoNovo)
        : `${blocoNovo}\n\n${atual}`;

      return sincronizarAnexos({
        ...prev,
        rua_olhar_confrontacao: frente || prev.rua_olhar_confrontacao,
        confrontante_lado_direito: dir || prev.confrontante_lado_direito,
        confrontante_lado_esquerdo: esq || prev.confrontante_lado_esquerdo,
        confrontante_fundos: fun || prev.confrontante_fundos,
        contribuinte_sql:
          (!prev.contribuinte_sql || /^0+$/.test(prev.contribuinte_sql.replace(/[^\d]/g, ''))) && sqlRef
            ? sqlRef
            : prev.contribuinte_sql,
        anotacoes_ficha_oficial: novasAnotacoes,
      });
    });
  };

  async function consultarGeoSampaConfrontacoes(silencioso = false) {
    if (!silencioso) {
      setCardsGeoSampaVisiveis(true);
    }
    if (!dados.contribuinte_sql && !dados.imovel && !dados.rua_olhar_confrontacao) {
      if (!silencioso) {
        setErroGeoSampa('Informe o SQL ou o endereço do imóvel para realizar a consulta no GeoSampa.');
      }
      return;
    }

    setBuscandoGeoSampa(true);
    setErroGeoSampa(null);
    try {
      const resp = await fetch('/api/gestao-documental/confrontacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sql: dados.contribuinte_sql,
          imovel: dados.imovel,
          rua: dados.rua_olhar_confrontacao,
          subdistrito: dados.subdistrito,
          matricula: dados.matricula_transcricao,
          textoAutos,
        }),
      });
      const json = await resp.json();
      if (!resp.ok || !json.ok) {
        throw new Error(json.error || 'Não foi possível consultar o GeoSampa.');
      }
      setResultadoGeoSampa(json);

      // Se havia confrontações ou descrição do imóvel ainda em branco (ou higienizadas de timbre institucional), preenche com o apurado nos autos / GeoSampa
      const cg = json.confrontantesGeoSampa;
      const ct = json.confrontacoesTextoAutos;
      const dirSug = ct?.ladoDireito || cg?.ladoDireito || '';
      const esqSug = ct?.ladoEsquerdo || cg?.ladoEsquerdo || '';
      const funSug = ct?.fundos || cg?.fundos || '';
      const sqlSug = json.loteGeoSampa?.nr_contribuinte || '';
      const plantaSug = json.plantaSetor?.caminhoCompleto || '';
      const imovelGeoSampaSug = formatarDescricaoImovelGeoSampa({
        logradouro: json.loteGeoSampa?.nm_logradouro_completo || cg?.frente,
        numeroPorta: json.loteGeoSampa?.cd_numero_porta,
        complemento: json.loteGeoSampa?.tx_complemento_endereco,
        setor: json.setor,
        quadra: json.quadra,
        lote: json.lote,
        areaTerreno: json.loteGeoSampa?.qt_area_terreno,
      });

      setDados(prev => {
        const imovelPrevLimpo = sanitizarDescricaoImovel(prev.imovel);
        const ruaPrevLimpa = sanitizarLogradouroConfrontacao(prev.rua_olhar_confrontacao, prev.imovel);
        const novoImovel = imovelPrevLimpo || imovelGeoSampaSug || '';
        const precisaDir = !prev.confrontante_lado_direito || prev.confrontante_lado_direito === 'conforme apuração nos autos';
        const precisaEsq = !prev.confrontante_lado_esquerdo || prev.confrontante_lado_esquerdo === 'conforme apuração nos autos';
        const precisaFun = !prev.confrontante_fundos || prev.confrontante_fundos === 'conforme apuração nos autos';
        const novoDir = precisaDir && dirSug ? dirSug : prev.confrontante_lado_direito;
        const novoEsq = precisaEsq && esqSug ? esqSug : prev.confrontante_lado_esquerdo;
        const novoFun = precisaFun && funSug ? funSug : prev.confrontante_fundos;
        const novoFrente = !ruaPrevLimpa && cg?.frente ? cg.frente : ruaPrevLimpa;
        const novoSql =
          (!prev.contribuinte_sql || /^0+$/.test(prev.contribuinte_sql.replace(/[^\d]/g, ''))) && sqlSug
            ? sqlSug
            : prev.contribuinte_sql;

        let novasAnotacoes = prev.anotacoes_ficha_oficial || '';
        if (!novasAnotacoes.trim() && (novoDir || novoEsq || novoFun || plantaSug)) {
          const linhas: string[] = ['CONFRONTAÇÕES DO IMÓVEL USUCAPIENDO:'];
          if (novoFrente) linhas.push(`• Frente (Logradouro): ${novoFrente}`);
          if (novoDir) linhas.push(`• Pelo Lado Direito: ${novoDir}`);
          if (novoEsq) linhas.push(`• Pelo Lado Esquerdo: ${novoEsq}`);
          if (novoFun) linhas.push(`• Aos Fundos: ${novoFun}`);
          if (prev.matricula_transcricao) {
            linhas.push(`• Matrícula / Transcrição mencionada: ${prev.matricula_transcricao}`);
          }
          if (plantaSug) linhas.push(`• Planta Fiscal (Setores): ${plantaSug}`);
          if (novoSql && !/^0+$/.test(novoSql.replace(/[^\d]/g, ''))) {
            linhas.push(`• SQL / GeoSampa: ${novoSql}`);
          }
          novasAnotacoes = linhas.join('\n');
        } else if (novasAnotacoes && novoFrente) {
          if (/Frente\s*\(Logradouro\)/i.test(novasAnotacoes)) {
            novasAnotacoes = novasAnotacoes.replace(
              /^([ \t]*•\s*Frente\s*\(Logradouro\):\s*)(.+)$/gim,
              (_m, prefixo, atualVal) => {
                const limpoVal = sanitizarLogradouroConfrontacao(String(atualVal), '');
                return `${prefixo}${limpoVal || novoFrente}`;
              },
            );
          } else {
            novasAnotacoes = novasAnotacoes.replace(
              /(CONFRONTAÇÕES[^\n]*\n)/i,
              `$1• Frente (Logradouro): ${novoFrente}\n`,
            );
          }
        }

        if (silencioso) {
          baseRef.current = {
            ...baseRef.current,
            imovel: baseRef.current.imovel || novoImovel,
            rua_olhar_confrontacao: baseRef.current.rua_olhar_confrontacao || novoFrente,
          };
        }

        return sincronizarAnexos({
          ...prev,
          imovel: novoImovel,
          rua_olhar_confrontacao: novoFrente,
          confrontante_lado_direito: novoDir,
          confrontante_lado_esquerdo: novoEsq,
          confrontante_fundos: novoFun,
          contribuinte_sql: novoSql,
          anotacoes_ficha_oficial: novasAnotacoes,
        });
      });

      if (!silencioso) {
        if (cg) {
          setOrigemConfrontacoes(`GeoSampa (Setor ${json.setor} • Quadra ${json.quadra} • Lote ${json.lote})`);
          mostrarAviso(`Consulta ao GeoSampa concluída: Setor ${json.setor} • Quadra ${json.quadra} • Lote ${json.lote} (${cg.vizinhos?.length || 0} lotes confrontantes lindeiros identificados).`);
        } else {
          mostrarAviso('Consulta concluída. Verifique os links diretos do GeoSampa e a Planta Fiscal.');
        }
      }
    } catch (err) {
      if (!silencioso) {
        setErroGeoSampa(err instanceof Error ? err.message : 'Erro ao consultar o GeoSampa.');
      }
    } finally {
      setBuscandoGeoSampa(false);
    }
  }

  // Dispara consulta automática ao GeoSampa ao abrir a ficha quando houver SQL ou endereço do imóvel
  const geoSampaAutoConsultadoRef = useRef<string>('');
  useEffect(() => {
    const chave = `${dados.id_ficha}|${dados.contribuinte_sql}|${dados.imovel}`;
    if (geoSampaAutoConsultadoRef.current === chave) return;
    if (dados.contribuinte_sql || dados.imovel || dados.rua_olhar_confrontacao) {
      geoSampaAutoConsultadoRef.current = chave;
      void consultarGeoSampaConfrontacoes(true);
    }
  }, [dados.id_ficha]);

  // ─── Minuta: fonte única para exibição, cópia e impressão ────────────────
  const minuta = useMemo(() => montarMinuta(dados, saudacaoJuiz), [dados, saudacaoJuiz]);

  const copiarManifestacao = () => {
    void copiarTextoSeguro(minutaParaTexto(minuta)).then(ok => {
      if (ok) {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      } else {
        mostrarAviso('Não foi possível copiar para a área de transferência neste navegador.');
      }
    });
  };

  // ─── Finalização: arquiva o texto da Etapa 2 no banco do FIORIX ──────────
  const textoMinuta = useMemo(() => minutaParaTexto(minuta), [minuta]);
  const alteradaAposArquivar = Boolean(arquivada && arquivada.texto !== textoMinuta);
  const conferenciaConcluida = Boolean(
    dados.status_conferencia === 'CONFERIDO' || versaoAnteriorId || arquivada,
  );
  const [modalFinalizarAberto, setModalFinalizarAberto] = useState(false);
  const [confirmouImpressaoEtapa2, setConfirmouImpressaoEtapa2] = useState(false);
  const [erroFinalizacaoModal, setErroFinalizacaoModal] = useState<string | null>(null);

  const executarFinalizacao = async () => {
    if (!onFinalizar || finalizando || !confirmouImpressaoEtapa2) return;
    setFinalizando(true);
    setErroFinalizacaoModal(null);
    try {
      const info = await onFinalizar({
        fichaId: dados.id_ficha || `FICHA-${Date.now()}`,
        dados: {
          ...dados,
          status_conferencia: 'CONFERIDO',
        },
        arquivoOrigem: arquivoOrigem ?? null,
        minuta,
        textoFinal: textoMinuta,
        confirmouImpressao: true,
        // Correção após arquivar nesta mesma tela gera nova versão da que acabou de ser arquivada
        versaoAnteriorId: arquivada ? arquivada.info.id : versaoAnteriorId,
      });
      setArquivada({ info, minuta, texto: textoMinuta });
      setModalFinalizarAberto(false);
      mostrarAviso(
        `Procedimento finalizado e arquivado no FIORIX (versão ${info.versao}). Ele saiu de Em Conferência e já está disponível no Arquivo.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível finalizar a manifestação.';
      setErroFinalizacaoModal(msg);
      mostrarAviso(msg, 9000);
    } finally {
      setFinalizando(false);
    }
  };

  const solicitarFinalizacao = () => {
    if (!onFinalizar || finalizando) return;
    if (!conferenciaConcluida) {
      mostrarAviso(
        'A manifestação só pode ser finalizada e arquivada após a conferência concluída (status CONFERIDO).',
      );
      return;
    }
    if (textoMinuta.trim().length < 50) {
      mostrarAviso('O texto da manifestação está incompleto. Preencha os campos da Etapa 1 antes de finalizar.');
      return;
    }
    setConfirmouImpressaoEtapa2(false);
    setErroFinalizacaoModal(null);
    setModalFinalizarAberto(true);
  };

  const baixarPdfArquivado = async () => {
    try {
      const { baixarPdfManifestacao } = await import('@/lib/pdf/generateManifestacaoPdf');
      const minutaAlvo = arquivada ? arquivada.minuta : minuta;
      const infoAlvo = arquivada ? arquivada.info : null;
      baixarPdfManifestacao(minutaAlvo, infoAlvo, arquivada?.info.numeroProcesso || dados.numero_processo);
    } catch {
      mostrarAviso('Não foi possível gerar o PDF neste navegador.');
    }
  };

  const baixarDocxAtual = () => {
    try {
      const minutaAlvo = arquivada && !alteradaAposArquivar ? arquivada.minuta : minuta;
      const infoAlvo = arquivada && !alteradaAposArquivar ? arquivada.info : null;
      baixarDocxManifestacao(minutaAlvo, infoAlvo, dados.numero_processo);
      mostrarAviso('Arquivo Word (.docx) gerado e baixado com sucesso!');
    } catch {
      mostrarAviso('Não foi possível gerar o arquivo .docx neste navegador.');
    }
  };

  const baixarDocAtual = () => {
    try {
      const minutaAlvo = arquivada && !alteradaAposArquivar ? arquivada.minuta : minuta;
      const infoAlvo = arquivada && !alteradaAposArquivar ? arquivada.info : null;
      baixarDocManifestacao(minutaAlvo, infoAlvo, dados.numero_processo);
      mostrarAviso('Arquivo Word (.doc) gerado e baixado com sucesso!');
    } catch {
      mostrarAviso('Não foi possível gerar o arquivo .doc neste navegador.');
    }
  };

  const modoTextoLivreAtivo = dados.modo_edicao_manifestacao === 'texto_livre';

  const temEdicaoTextoPersonalizado = Boolean(
    dados.paragrafo_1_custom?.trim() ||
    dados.paragrafo_2_custom?.trim() ||
    dados.intro_confrontacoes_custom?.trim() ||
    dados.paragrafo_competencia_custom?.trim() ||
    dados.paragrafo_contribuinte_custom?.trim() ||
    dados.paragrafo_anexos_custom?.trim() ||
    dados.paragrafo_encaminhamento_custom?.trim() ||
    dados.paragrafo_extra_custom?.trim() ||
    dados.paragrafo_fecho_custom?.trim() ||
    dados.corpo_livre_manifestacao?.trim()
  );

  const alternarModoEdicaoManifestacao = (novoModo: 'hibrido' | 'texto_livre') => {
    if (novoModo === 'texto_livre') {
      const textoBase = dados.corpo_livre_manifestacao?.trim()
        ? dados.corpo_livre_manifestacao
        : gerarTextoCorpoPadrao(minuta);
      setDados(prev => ({
        ...prev,
        modo_edicao_manifestacao: 'texto_livre',
        corpo_livre_manifestacao: textoBase,
      }));
    } else {
      setDados(prev => ({
        ...prev,
        modo_edicao_manifestacao: 'hibrido',
      }));
    }
  };

  const restaurarTextoPadraoManifestacao = () => {
    setConfirmacao({
      titulo: 'Restaurar redação automática da Manifestação?',
      mensagem: (
        <p>
          As edições livres feitas diretamente nos parágrafos serão redefinidas para a redação padrão sincronizada com os campos do processo (OCR / GeoSampa / Acervo). Os dados dos campos (processo, matrícula, confrontações, folhas) serão mantidos.
        </p>
      ),
      rotuloConfirmar: 'Restaurar redação padrão',
      onConfirmar: () => {
        setDados(prev => ({
          ...prev,
          modo_edicao_manifestacao: 'hibrido',
          paragrafo_1_custom: '',
          paragrafo_2_custom: '',
          intro_confrontacoes_custom: '',
          paragrafo_competencia_custom: '',
          paragrafo_contribuinte_custom: '',
          paragrafo_anexos_custom: '',
          paragrafo_encaminhamento_custom: '',
          paragrafo_extra_custom: '',
          paragrafo_fecho_custom: '',
          corpo_livre_manifestacao: '',
        }));
        setParagrafosEmEdicao({});
        setMostrarParagrafoExtra(false);
        mostrarAviso('Redação padrão restaurada e sincronizada com os campos.');
      },
    });
  };

  const carregarItemSalvoNoEditor = (item: (typeof listaRascunhosSalvos)[number]) => {
    const preparados = prepararDadosIniciais(
      { ...criarDadosManifestacaoPadrao(), ...item.dados, id_ficha: item.fichaId || item.dados.id_ficha },
      arquivoOrigem,
    );
    baseRef.current = preparados;
    setDados(preparados);
    if (preparados.saudacao_juiz === 'MM. Juiz' || preparados.saudacao_juiz === 'Meritíssima Juíza') {
      setSaudacaoJuiz(preparados.saudacao_juiz);
    }
    setMostrarParagrafoExtra(Boolean(preparados.paragrafo_extra_custom));
    setParagrafosEmEdicao({});
    setArquivada(null);
    setModalRascunhosAberto(false);
    setAbaAtiva('manifestacao');
    mostrarAviso(
      `Rascunho do processo ${item.numeroProcesso || preparados.numero_processo || item.fichaId} carregado no editor híbrido.`,
    );
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
    const mql = typeof window.matchMedia === 'function' ? window.matchMedia('print') : null;
    const aoMudarMidia = (ev: MediaQueryListEvent) => {
      if (!ev.matches) finalizar();
    };
    mql?.addEventListener?.('change', aoMudarMidia);
    const t = setTimeout(() => window.print(), 100);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', finalizar);
      mql?.removeEventListener?.('change', aoMudarMidia);
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
      {/* LOGOTIPO OFICIAL 7º RI */}
      <div className="mb-5 flex flex-col items-center">
        <img
          src={LOGO_7RI_MANIFESTACAO_DATA_URI}
          alt="7º Oficial de Registro de Imóveis da Capital - SP — Fone: 3218-0527 – R. Augusta, 356 – Consolação – Cep: 01304-000 – São Paulo – SP"
          width={LOGO_7RI_MANIFESTACAO_WIDTH_PX}
          height={LOGO_7RI_MANIFESTACAO_HEIGHT_PX}
          className="h-auto w-full max-w-[680px] object-contain select-none"
        />
      </div>

      {/* CABEÇALHO */}
      <div className="text-xs space-y-0.5 mb-3">
        <div><strong>{minuta.cabecalho.processoRotulo}</strong> {minuta.cabecalho.processoValor}</div>
        <div><strong>{minuta.cabecalho.vara}</strong></div>
        <div><strong>{minuta.cabecalho.interessadosRotulo}</strong> <b>{minuta.cabecalho.interessadosValor}</b></div>
        <div><strong>{minuta.cabecalho.natureza}</strong></div>
      </div>

      <div className="font-bold pt-2 mb-3">{minuta.saudacao}</div>

      {minuta.corpoTextoLivre && minuta.corpoTextoLivre.trim().length > 0 ? (
        <div className="text-justify space-y-3 text-xs leading-normal">
          {minuta.corpoTextoLivre
            .split(/\r?\n\s*\r?\n/)
            .map(b => b.trim())
            .filter(Boolean)
            .map((bloco, idx) => (
              <p key={`livre-${idx}`} className="indent-8 whitespace-pre-line">{bloco}</p>
            ))}
        </div>
      ) : (
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
      )}

      <div className="pt-6 text-right text-xs">{minuta.local}</div>

      <div className="pt-8 text-center">
        <div className="text-xs mb-8">{minuta.assinatura.titulo || 'O Oficial,'}</div>
        <div className="border-t border-black w-64 max-w-full mx-auto pt-1 font-bold text-xs">{minuta.assinatura.nome}</div>
        <div className="text-[10px] text-gray-500">{minuta.assinatura.cargo}</div>
      </div>
    </article>
  );

  // ─── Folha A4 Híbrida e Interativa (Edição Direta no Texto) ──────────────
  const classeCampoInline =
    'inline-block rounded border-b border-dashed border-[#334155]/70 bg-amber-50/70 px-1.5 py-0.5 font-sans text-xs font-semibold text-[#0F172A] transition hover:bg-amber-100/80 focus:border-solid focus:border-[#0F172A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#64748B]/50';

  const alternarEdicaoParagrafo = (
    chave: string,
    campoCustom: keyof DadosManifestacao,
    textoGeradoPadrao: string,
  ) => {
    const aberto = Boolean(paragrafosEmEdicao[chave]);
    if (!aberto && !String(dados[campoCustom] || '').trim()) {
      atualizarCampo(campoCustom, textoGeradoPadrao as never);
    }
    setParagrafosEmEdicao(prev => ({ ...prev, [chave]: !aberto }));
  };

  const limparCustomParagrafo = (chave: string, campoCustom: keyof DadosManifestacao) => {
    atualizarCampo(campoCustom, '' as never);
    setParagrafosEmEdicao(prev => ({ ...prev, [chave]: false }));
  };

  const renderFolhaManifestacaoHibrida = () => {
    const textoParagrafo1Padrao = `Em atenção ao r. despacho de fls. ${dados.fls_inicial || '___'}, cumpre-me informar a V. Exa. que, revendo os livros de transcrições das transmissões, bem assim as fichas do Livro nº 2 – Registro Geral, deste Cartório, tendo por base o perímetro constante do laudo pericial de fls. ${dados.fls_laudo || '___'}, referente ao imóvel localizado no Rol de Contribuintes da Prefeitura do Município de São Paulo, sob contribuinte nº ${dados.contribuinte_sql || '________'}, as mesmas resultaram ${dados.resultado_buscas || 'NEGATIVAS'}.`;
    const textoParagrafo2Padrao = `Segundo elementos constantes dos autos, o imóvel usucapiendo consta ou fazia parte em nome de ${dados.titular_origem || '____________'}, objeto da ${dados.matricula_transcricao || 'Transcrição nº ___'} do ${dados.cartorio_origem || '___ Cartório de Registro de Imóveis da Capital'}, conforme certidão de fls. ${dados.fls_certidao_origem || '___'}.`;
    const textoIntroConfrontacoesPadrao =
      'Pela planta do Setor Fiscal Municipal do imóvel usucapiendo, verifica-se que o mesmo confronta:';
    const textoParagrafoCompetenciaPadrao = `Informo, outrossim, que a área em apreço passou a pertencer a esta Serventia a partir da Circunscrição atribuída ao 12º Registro de Imóveis da Capital, por força do Decreto Estadual nº 9.775, de ${dados.data_competencia_subdistrito || '___ de ________ de ____'}.`;
    const textoParagrafoContribuintePadrao = `Cumpre ressaltar que o número de contribuinte (${dados.contribuinte_sql || '________'}) não se encontra averbado à margem da matrícula ou transcrição de origem nesta Serventia.`;
    const textoParagrafoAnexosPadrao = `Encaminho cópia da planta do Setor Fiscal Municipal, certidão das transcrições nºs ${dados.transcricoes_anexas || 'conforme na certidão'} e matrículas nºs ${dados.matriculas_anexas || 'conforme na certidão'}, para que acompanhe a presente.`;
    const modeloFinalizacaoAtivo = inferirModeloFinalizacaoPadrao(dados);
    const segmentosFinalizacaoAtiva = obterSegmentosFinalizacaoPorModelo(dados, modeloFinalizacaoAtivo);
    const textoParagrafoEncaminhamentoPadrao = obterTextoPlanoFinalizacaoPorModelo(dados, modeloFinalizacaoAtivo);
    const textoFechoPadrao = 'Era o que, respeitosamente, cumpria informar a V. Exa.';

    const selecionarModeloFinalizacao = (novoModelo: ModeloFinalizacaoManifestacaoId) => {
      const novoTexto = obterTextoPlanoFinalizacaoPorModelo(dados, novoModelo);
      setDados(prev => {
        const proximo: DadosManifestacao = {
          ...prev,
          modelo_finalizacao_manifestacao: novoModelo,
          paragrafo_encaminhamento_custom: paragrafosEmEdicao.pEnc ? novoTexto : '',
        };
        if (novoModelo === '1_positivas_portaria_juizo' || novoModelo === '2_positivas_aqui_12ri_juizo') {
          proximo.resultado_buscas = 'POSITIVAS';
        } else if (novoModelo === '3_nesta_oportunidade_9ri' || novoModelo === '5_complemento_9ri_6ri_3ri') {
          proximo.cartorio_encaminhamento = '9º Oficial de Registro de Imóveis da Capital';
        } else if (novoModelo === '4_complemento_3ri') {
          proximo.cartorio_encaminhamento = '3º Oficial de Registro de Imóveis da Capital';
        } else if (novoModelo === '6_zona_limitrofe_ipiranga_6ri') {
          proximo.cartorio_encaminhamento = '6º Oficial de Registro de Imóveis da Capital';
        }
        if (prev.modo_edicao_manifestacao === 'texto_livre' && prev.corpo_livre_manifestacao?.trim()) {
          const blocos = prev.corpo_livre_manifestacao
            .split(/\r?\n\s*\r?\n/)
            .map(b => b.trim())
            .filter(Boolean);
          if (blocos.length > 0) {
            blocos[blocos.length - 1] = novoTexto;
            proximo.corpo_livre_manifestacao = blocos.join('\n\n');
          }
        }
        return proximo;
      });
    };

    return (
      <article className="mx-auto max-w-[900px] rounded-xl border-2 border-gray-300 bg-white p-6 sm:p-8 md:p-11 font-sans text-[11pt] leading-relaxed text-black shadow-lg space-y-4 break-words">
        {/* FAIXA DE ORIENTAÇÃO DE EDIÇÃO DIRETA NO A4 */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300/90 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950">
          <div className="flex items-center gap-2">
            <Edit3 className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
            <span>
              <strong>Folha A4 Híbrida e Editável:</strong> clique diretamente sobre qualquer campo destacado no texto (mesmo os preenchidos pelo OCR/IA do FIORIX) ou clique em{' '}
              <span className="rounded border border-amber-400 bg-white px-1.5 py-0.5 font-semibold text-amber-900">✏️ Editar parágrafo</span>{' '}
              para alterar livremente qualquer frase.
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {temEdicaoTextoPersonalizado && (
              <button
                type="button"
                onClick={restaurarTextoPadraoManifestacao}
                className="inline-flex items-center gap-1 rounded border border-amber-400 bg-white px-2 py-0.5 text-[10.5px] font-bold text-amber-900 hover:bg-amber-100 cursor-pointer"
                title="Voltar todos os parágrafos para a redação automática sincronizada com os campos"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Restaurar redação automática</span>
              </button>
            )}
          </div>
        </div>

        {/* LOGOTIPO OFICIAL 7º RI */}
        <div className="mb-5 flex flex-col items-center">
          <img
            src={LOGO_7RI_MANIFESTACAO_DATA_URI}
            alt="7º Oficial de Registro de Imóveis da Capital - SP — Fone: 3218-0527 – R. Augusta, 356 – Consolação – Cep: 01304-000 – São Paulo – SP"
            width={LOGO_7RI_MANIFESTACAO_WIDTH_PX}
            height={LOGO_7RI_MANIFESTACAO_HEIGHT_PX}
            className="h-auto w-full max-w-[680px] object-contain select-none"
          />
        </div>

        {/* CABEÇALHO EDITÁVEL DIRETO NO TEXTO */}
        <div className="text-xs space-y-1.5 mb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <strong>{minuta.cabecalho.processoRotulo}</strong>
            <input
              type="text"
              aria-label="Número do Processo Digital"
              value={dados.numero_processo}
              onChange={e => atualizarCampo('numero_processo', e.target.value)}
              placeholder="0000000-00.0000.8.26.0100"
              className={`${classeCampoInline} font-mono min-w-[230px]`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <strong>E.</strong>
            <input
              type="text"
              aria-label="Vara de Registros Públicos"
              value={dados.vara}
              onChange={e => atualizarCampo('vara', e.target.value)}
              placeholder="1ª / 2ª"
              className={`${classeCampoInline} w-16 text-center font-bold`}
            />
            <strong>Vara de Registros Públicos da Capital.</strong>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <strong>{minuta.cabecalho.interessadosRotulo}</strong>
            <input
              type="text"
              aria-label="Interessados / Requerente"
              value={dados.requerente}
              onChange={e => atualizarCampo('requerente', e.target.value)}
              placeholder="NOME DO REQUERENTE / INTERESSADO"
              className={`${classeCampoInline} flex-1 min-w-[260px] font-bold uppercase`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="text"
              aria-label="Natureza do Processo"
              value={dados.natureza_processo ?? 'USUCAPIÃO'}
              onChange={e => atualizarCampo('natureza_processo', e.target.value)}
              placeholder="USUCAPIÃO"
              className={`${classeCampoInline} w-44 font-bold uppercase`}
            />
          </div>
        </div>

        {/* SAUDAÇÃO EDITÁVEL DIRETO NO TEXTO */}
        <div className="pt-2 mb-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            list="opcoes-saudacao-juiz"
            aria-label="Saudação ao Magistrado"
            value={dados.saudacao_juiz ?? saudacaoJuiz}
            onChange={e => {
              const val = e.target.value;
              atualizarCampo('saudacao_juiz', val);
              if (val === 'Meritíssima Juíza' || val === 'MM. Juiz') {
                setSaudacaoJuiz(val);
              }
            }}
            className={`${classeCampoInline} font-bold text-sm min-w-[180px]`}
          />
          <datalist id="opcoes-saudacao-juiz">
            <option value="Meritíssima Juíza" />
            <option value="MM. Juiz" />
            <option value="Excelentíssimo(a) Senhor(a) Doutor(a) Juiz(a) de Direito" />
          </datalist>
        </div>

        {/* CORPO DA MANIFESTAÇÃO: MODO TEXTO LIVRE COMPLETO OU MODO HÍBRIDO */}
        {modoTextoLivreAtivo ? (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1.5 text-[11px] text-indigo-950">
              <span>
                <strong>Modo Texto Livre Completo ativo:</strong> edite qualquer palavra ou parágrafo abaixo como em um editor de texto. Separe parágrafos com uma linha em branco.
              </span>
              <button
                type="button"
                onClick={() => {
                  const gerado = gerarTextoCorpoPadrao(montarMinuta({ ...dados, modo_edicao_manifestacao: 'hibrido', corpo_livre_manifestacao: '' }, saudacaoJuiz));
                  atualizarCampo('corpo_livre_manifestacao', gerado);
                  mostrarAviso('Texto livre sincronizado novamente com os campos atuais.');
                }}
                className="inline-flex items-center gap-1 rounded border border-indigo-300 bg-white px-2 py-0.5 text-[10.5px] font-bold text-indigo-900 hover:bg-indigo-100 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Sincronizar com os campos</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs">
              <label htmlFor="select-finalizacao-livre" className="font-bold text-[#0F3D6E]">
                Trocar Finalização da Manifestação (Último Parágrafo):
              </label>
              <select
                id="select-finalizacao-livre"
                value={modeloFinalizacaoAtivo}
                onChange={e => selecionarModeloFinalizacao(e.target.value as ModeloFinalizacaoManifestacaoId)}
                className="min-w-[260px] flex-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F3D6E]"
              >
                {MODELOS_FINALIZACAO_MANIFESTACAO.map(op => (
                  <option key={op.id} value={op.id}>{op.rotulo}</option>
                ))}
              </select>
            </div>
            <textarea
              id="campo-corpo_livre_manifestacao"
              rows={18}
              value={dados.corpo_livre_manifestacao || ''}
              onChange={e => atualizarCampo('corpo_livre_manifestacao', e.target.value)}
              placeholder="Digite ou edite livremente o corpo completo da Manifestação Oficial..."
              className="w-full rounded-lg border border-[#64748B] bg-[#FFFDF9] p-4 font-sans text-xs leading-relaxed text-black shadow-inner focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
            />
          </div>
        ) : (
          <div className="text-justify space-y-3.5 text-xs leading-relaxed">
            {/* 1º PARÁGRAFO */}
            <div className="group relative rounded-lg border border-transparent p-1.5 transition hover:border-gray-200 hover:bg-gray-50/50">
              <div className="mb-1 flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                {dados.paragrafo_1_custom?.trim() && (
                  <button
                    type="button"
                    onClick={() => limparCustomParagrafo('p1', 'paragrafo_1_custom')}
                    className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Automático
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => alternarEdicaoParagrafo('p1', 'paragrafo_1_custom', textoParagrafo1Padrao)}
                  className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  <Edit3 className="h-2.5 w-2.5" />
                  <span>{paragrafosEmEdicao.p1 ? 'Concluir edição do parágrafo' : '✏️ Editar parágrafo inteiro'}</span>
                </button>
              </div>

              {paragrafosEmEdicao.p1 || dados.paragrafo_1_custom?.trim() ? (
                paragrafosEmEdicao.p1 ? (
                  <textarea
                    rows={4}
                    value={dados.paragrafo_1_custom || ''}
                    onChange={e => atualizarCampo('paragrafo_1_custom', e.target.value)}
                    className="w-full rounded border border-amber-400 bg-white p-2.5 font-sans text-xs leading-relaxed text-black focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
                  />
                ) : (
                  <p
                    onClick={() => setParagrafosEmEdicao(prev => ({ ...prev, p1: true }))}
                    className="indent-8 cursor-text rounded bg-amber-50/40 px-1 py-0.5"
                    title="Clique para editar este parágrafo personalizado"
                  >
                    {dados.paragrafo_1_custom}
                  </p>
                )
              ) : (
                <p className="indent-8 leading-7">
                  Em atenção ao r. despacho de fls.{' '}
                  <input
                    id="campo-fls_inicial"
                    type="text"
                    value={dados.fls_inicial}
                    onChange={e => atualizarCampo('fls_inicial', e.target.value)}
                    placeholder="___"
                    title="Folhas da petição inicial / despacho"
                    className={`${classeCampoInline} font-mono w-24 text-center`}
                  />
                  , cumpre-me informar a V. Exa. que, revendo os livros de transcrições das transmissões, bem assim as fichas do Livro nº 2 – Registro Geral, deste Cartório, tendo por base o perímetro constante do laudo pericial de fls.{' '}
                  <input
                    id="campo-fls_laudo"
                    type="text"
                    value={dados.fls_laudo}
                    onChange={e => atualizarCampo('fls_laudo', e.target.value)}
                    placeholder="___"
                    title="Folhas do laudo pericial / planta"
                    className={`${classeCampoInline} font-mono w-24 text-center`}
                  />
                  , referente ao imóvel localizado no Rol de Contribuintes da Prefeitura do Município de São Paulo, sob contribuinte nº{' '}
                  <input
                    type="text"
                    value={dados.contribuinte_sql}
                    onChange={e => atualizarCampo('contribuinte_sql', e.target.value)}
                    placeholder="000.000.0000-0"
                    title="Número de contribuinte SQL / IPTU"
                    className={`${classeCampoInline} font-mono w-36 text-center font-bold`}
                  />
                  , as mesmas resultaram{' '}
                  <select
                    id="campo-resultado_buscas"
                    value={dados.resultado_buscas}
                    onChange={e => atualizarCampo('resultado_buscas', e.target.value)}
                    title="Resultado das buscas no 7º RI"
                    className={`${classeCampoInline} font-bold uppercase cursor-pointer`}
                  >
                    <option value="NEGATIVAS">NEGATIVAS</option>
                    <option value="POSITIVAS">POSITIVAS</option>
                    <option value="PARCIALMENTE POSITIVAS">PARCIALMENTE POSITIVAS</option>
                  </select>
                  .
                </p>
              )}
            </div>

            {/* 2º PARÁGRAFO */}
            <div className="group relative rounded-lg border border-transparent p-1.5 transition hover:border-gray-200 hover:bg-gray-50/50">
              <div className="mb-1 flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                {dados.paragrafo_2_custom?.trim() && (
                  <button
                    type="button"
                    onClick={() => limparCustomParagrafo('p2', 'paragrafo_2_custom')}
                    className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Automático
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => alternarEdicaoParagrafo('p2', 'paragrafo_2_custom', textoParagrafo2Padrao)}
                  className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  <Edit3 className="h-2.5 w-2.5" />
                  <span>{paragrafosEmEdicao.p2 ? 'Concluir edição do parágrafo' : '✏️ Editar parágrafo inteiro'}</span>
                </button>
              </div>

              {paragrafosEmEdicao.p2 || dados.paragrafo_2_custom?.trim() ? (
                paragrafosEmEdicao.p2 ? (
                  <textarea
                    rows={3}
                    value={dados.paragrafo_2_custom || ''}
                    onChange={e => atualizarCampo('paragrafo_2_custom', e.target.value)}
                    className="w-full rounded border border-amber-400 bg-white p-2.5 font-sans text-xs leading-relaxed text-black focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
                  />
                ) : (
                  <p
                    onClick={() => setParagrafosEmEdicao(prev => ({ ...prev, p2: true }))}
                    className="indent-8 cursor-text rounded bg-amber-50/40 px-1 py-0.5"
                    title="Clique para editar este parágrafo personalizado"
                  >
                    {dados.paragrafo_2_custom}
                  </p>
                )
              ) : (
                <p className="indent-8 leading-7">
                  Segundo elementos constantes dos autos, o imóvel usucapiendo consta ou fazia parte em nome de{' '}
                  <input
                    type="text"
                    value={dados.titular_origem}
                    onChange={e => atualizarCampo('titular_origem', e.target.value)}
                    placeholder="NOME DO TITULAR DE ORIGEM"
                    title="Titular de origem (proprietário anterior)"
                    className={`${classeCampoInline} min-w-[220px] font-bold underline`}
                  />
                  , objeto da{' '}
                  <input
                    type="text"
                    value={dados.matricula_transcricao}
                    onChange={e => atualizarCampo('matricula_transcricao', e.target.value)}
                    placeholder="Matrícula / Transcrição nº ___"
                    title="Matrícula ou Transcrição de origem"
                    className={`${classeCampoInline} min-w-[160px] font-bold underline`}
                  />{' '}
                  do{' '}
                  <input
                    type="text"
                    value={dados.cartorio_origem}
                    onChange={e => atualizarCampo('cartorio_origem', e.target.value)}
                    placeholder="___ Cartório de Registro de Imóveis da Capital"
                    title="Cartório de origem"
                    className={`${classeCampoInline} min-w-[240px]`}
                  />
                  , conforme certidão de fls.{' '}
                  <input
                    id="campo-fls_certidao_origem"
                    type="text"
                    value={dados.fls_certidao_origem}
                    onChange={e => atualizarCampo('fls_certidao_origem', e.target.value)}
                    placeholder="___"
                    title="Folhas da certidão de origem"
                    className={`${classeCampoInline} font-mono w-24 text-center`}
                  />
                  .
                </p>
              )}
            </div>

            {/* INTRODUÇÃO + CONFRONTAÇÕES EDITÁVEIS DIRETO NO TEXTO */}
            <div className="group relative rounded-lg border border-transparent p-1.5 transition hover:border-gray-200 hover:bg-gray-50/50 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="indent-8 flex-1">
                  {paragrafosEmEdicao.introConf ? (
                    <input
                      type="text"
                      value={dados.intro_confrontacoes_custom ?? textoIntroConfrontacoesPadrao}
                      onChange={e => atualizarCampo('intro_confrontacoes_custom', e.target.value)}
                      className="w-full rounded border border-amber-400 bg-white px-2 py-1 font-sans text-xs text-black"
                    />
                  ) : (
                    <span>{dados.intro_confrontacoes_custom?.trim() || textoIntroConfrontacoesPadrao}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    alternarEdicaoParagrafo('introConf', 'intro_confrontacoes_custom', textoIntroConfrontacoesPadrao)
                  }
                  className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer opacity-80 group-hover:opacity-100"
                >
                  <Edit3 className="h-2.5 w-2.5" />
                  <span>{paragrafosEmEdicao.introConf ? 'OK' : 'Editar frase'}</span>
                </button>
              </div>

              <div className="pl-8 sm:pl-12 space-y-1.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="shrink-0">– pelo lado direito com</span>
                  <input
                    id="campo-confrontante_lado_direito"
                    type="text"
                    value={dados.confrontante_lado_direito}
                    onChange={e => atualizarCampo('confrontante_lado_direito', e.target.value)}
                    placeholder={TEXTO_CONFRONTACAO_PADRAO}
                    className={`${classeCampoInline} flex-1 min-w-[260px]`}
                  />
                  <span>;</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="shrink-0">– pelo lado esquerdo com</span>
                  <input
                    id="campo-confrontante_lado_esquerdo"
                    type="text"
                    value={dados.confrontante_lado_esquerdo}
                    onChange={e => atualizarCampo('confrontante_lado_esquerdo', e.target.value)}
                    placeholder={TEXTO_CONFRONTACAO_PADRAO}
                    className={`${classeCampoInline} flex-1 min-w-[260px]`}
                  />
                  <span>;</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="shrink-0">– e nos fundos com</span>
                  <input
                    id="campo-confrontante_fundos"
                    type="text"
                    value={dados.confrontante_fundos}
                    onChange={e => atualizarCampo('confrontante_fundos', e.target.value)}
                    placeholder={TEXTO_CONFRONTACAO_PADRAO}
                    className={`${classeCampoInline} flex-1 min-w-[260px]`}
                  />
                  <span>.</span>
                </div>
              </div>
            </div>

            {/* 3º PARÁGRAFO: COMPETÊNCIA TERRITORIAL */}
            <div className="group relative rounded-lg border border-transparent p-1.5 transition hover:border-gray-200 hover:bg-gray-50/50">
              <div className="mb-1 flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                {dados.paragrafo_competencia_custom?.trim() && (
                  <button
                    type="button"
                    onClick={() => limparCustomParagrafo('pComp', 'paragrafo_competencia_custom')}
                    className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Automático
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    alternarEdicaoParagrafo('pComp', 'paragrafo_competencia_custom', textoParagrafoCompetenciaPadrao)
                  }
                  className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  <Edit3 className="h-2.5 w-2.5" />
                  <span>{paragrafosEmEdicao.pComp ? 'Concluir edição do parágrafo' : '✏️ Editar parágrafo inteiro'}</span>
                </button>
              </div>

              {paragrafosEmEdicao.pComp || dados.paragrafo_competencia_custom?.trim() ? (
                paragrafosEmEdicao.pComp ? (
                  <textarea
                    rows={3}
                    value={dados.paragrafo_competencia_custom || ''}
                    onChange={e => atualizarCampo('paragrafo_competencia_custom', e.target.value)}
                    className="w-full rounded border border-amber-400 bg-white p-2.5 font-sans text-xs leading-relaxed text-black focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
                  />
                ) : (
                  <p
                    onClick={() => setParagrafosEmEdicao(prev => ({ ...prev, pComp: true }))}
                    className="indent-8 cursor-text rounded bg-amber-50/40 px-1 py-0.5"
                  >
                    {dados.paragrafo_competencia_custom}
                  </p>
                )
              ) : (
                <p className="indent-8 leading-7">
                  Informo, outrossim, que a área em apreço passou a pertencer a esta Serventia a partir da Circunscrição atribuída ao 12º Registro de Imóveis da Capital, por força do Decreto Estadual nº 9.775, de{' '}
                  <input
                    type="text"
                    value={dados.data_competencia_subdistrito}
                    onChange={e => atualizarCampo('data_competencia_subdistrito', e.target.value)}
                    placeholder="30 de novembro de 1.938"
                    title="Data de competência territorial do Subdistrito"
                    className={`${classeCampoInline} min-w-[180px] font-bold`}
                  />
                  .
                </p>
              )}
            </div>

            {/* PARÁGRAFO DE RESSALVA DO CONTRIBUINTE (OPCIONAL / EDITÁVEL) */}
            {(dados.contribuinte_sql || dados.paragrafo_contribuinte_custom?.trim()) && (
              <div className="group relative rounded-lg border border-transparent p-1.5 transition hover:border-gray-200 hover:bg-gray-50/50">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-1.5 opacity-80 group-hover:opacity-100">
                  <label className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={dados.contribuinte_nao_averbado !== false}
                      onChange={e => atualizarCampo('contribuinte_nao_averbado', e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-gray-400 text-[#1E293B]"
                    />
                    <span>Incluir parágrafo de contribuinte SQL não averbado na origem</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    {dados.paragrafo_contribuinte_custom?.trim() && (
                      <button
                        type="button"
                        onClick={() => limparCustomParagrafo('pSql', 'paragrafo_contribuinte_custom')}
                        className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                      >
                        <RotateCcw className="h-2.5 w-2.5" /> Automático
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        alternarEdicaoParagrafo('pSql', 'paragrafo_contribuinte_custom', textoParagrafoContribuintePadrao)
                      }
                      className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                    >
                      <Edit3 className="h-2.5 w-2.5" />
                      <span>{paragrafosEmEdicao.pSql ? 'Concluir edição' : '✏️ Editar parágrafo'}</span>
                    </button>
                  </div>
                </div>

                {dados.contribuinte_nao_averbado !== false || dados.paragrafo_contribuinte_custom?.trim() ? (
                  paragrafosEmEdicao.pSql || dados.paragrafo_contribuinte_custom?.trim() ? (
                    paragrafosEmEdicao.pSql ? (
                      <textarea
                        rows={2}
                        value={dados.paragrafo_contribuinte_custom || ''}
                        onChange={e => atualizarCampo('paragrafo_contribuinte_custom', e.target.value)}
                        className="w-full rounded border border-amber-400 bg-white p-2.5 font-sans text-xs leading-relaxed text-black"
                      />
                    ) : (
                      <p
                        onClick={() => setParagrafosEmEdicao(prev => ({ ...prev, pSql: true }))}
                        className="indent-8 cursor-text rounded bg-amber-50/40 px-1 py-0.5"
                      >
                        {dados.paragrafo_contribuinte_custom}
                      </p>
                    )
                  ) : (
                    <p className="indent-8 leading-7">
                      Cumpre ressaltar que o número de contribuinte (
                      <input
                        type="text"
                        value={dados.contribuinte_sql}
                        onChange={e => atualizarCampo('contribuinte_sql', e.target.value)}
                        className={`${classeCampoInline} font-mono w-36 text-center font-bold`}
                      />
                      ) <strong>não se encontra averbado</strong> à margem da matrícula ou transcrição de origem nesta Serventia.
                    </p>
                  )
                ) : (
                  <p className="indent-8 text-[11px] italic text-gray-400 line-through">
                    {textoParagrafoContribuintePadrao} (ocultado na manifestação)
                  </p>
                )}
              </div>
            )}

            {/* 4º PARÁGRAFO: ANEXOS (PLANTA + TRANSCRIÇÕES + MATRÍCULAS) */}
            <div className="group relative rounded-lg border border-transparent p-1.5 transition hover:border-gray-200 hover:bg-gray-50/50">
              <div className="mb-1 flex items-center justify-end gap-1.5 opacity-80 group-hover:opacity-100">
                {dados.paragrafo_anexos_custom?.trim() && (
                  <button
                    type="button"
                    onClick={() => limparCustomParagrafo('pAnexos', 'paragrafo_anexos_custom')}
                    className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                  >
                    <RotateCcw className="h-2.5 w-2.5" /> Automático
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    alternarEdicaoParagrafo('pAnexos', 'paragrafo_anexos_custom', textoParagrafoAnexosPadrao)
                  }
                  className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                >
                  <Edit3 className="h-2.5 w-2.5" />
                  <span>{paragrafosEmEdicao.pAnexos ? 'Concluir edição do parágrafo' : '✏️ Editar parágrafo inteiro'}</span>
                </button>
              </div>

              {paragrafosEmEdicao.pAnexos || dados.paragrafo_anexos_custom?.trim() ? (
                paragrafosEmEdicao.pAnexos ? (
                  <textarea
                    rows={3}
                    value={dados.paragrafo_anexos_custom || ''}
                    onChange={e => atualizarCampo('paragrafo_anexos_custom', e.target.value)}
                    className="w-full rounded border border-amber-400 bg-white p-2.5 font-sans text-xs leading-relaxed text-black"
                  />
                ) : (
                  <p
                    onClick={() => setParagrafosEmEdicao(prev => ({ ...prev, pAnexos: true }))}
                    className="indent-8 cursor-text rounded bg-amber-50/40 px-1 py-0.5"
                  >
                    {dados.paragrafo_anexos_custom}
                  </p>
                )
              ) : (
                <p className="indent-8 leading-7">
                  Encaminho cópia da planta do Setor Fiscal Municipal, certidão das transcrições nºs{' '}
                  <input
                    type="text"
                    value={dados.transcricoes_anexas}
                    onChange={e => atualizarCampo('transcricoes_anexas', e.target.value)}
                    placeholder="conforme na certidão"
                    title="Transcrições anexas (sincronizadas das confrontações ou editadas manualmente)"
                    className={`${classeCampoInline} min-w-[170px] font-bold`}
                  />{' '}
                  e matrículas nºs{' '}
                  <input
                    type="text"
                    value={dados.matriculas_anexas}
                    onChange={e => atualizarCampo('matriculas_anexas', e.target.value)}
                    placeholder="conforme na certidão"
                    title="Matrículas anexas (sincronizadas das confrontações ou editadas manualmente)"
                    className={`${classeCampoInline} min-w-[170px] font-bold`}
                  />
                  , para que acompanhe a presente.
                </p>
              )}
            </div>

            {/* FINALIZAÇÃO DA MANIFESTAÇÃO (ÚLTIMO PARÁGRAFO — SELECIONÁVEL CONFORME RESULTADO DA ANÁLISE) */}
            <div className="group relative rounded-xl border border-blue-200/90 bg-blue-50/30 p-2.5 transition hover:border-blue-300 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-200/70 pb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded bg-[#0F3D6E] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Finalização da Manifestação (Último Parágrafo)
                  </span>
                  <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Atalhos das 6 opções de finalização">
                    {MODELOS_FINALIZACAO_MANIFESTACAO.slice(0, 6).map(op => {
                      const ativo = modeloFinalizacaoAtivo === op.id && !dados.paragrafo_encaminhamento_custom?.trim();
                      return (
                        <button
                          key={op.id}
                          type="button"
                          onClick={() => selecionarModeloFinalizacao(op.id)}
                          title={`${op.rotulo}\n\n"${op.descricao}"`}
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                            ativo
                              ? 'border-[#0F3D6E] bg-[#0F3D6E] text-white shadow-2xs'
                              : 'border-blue-300 bg-white text-[#0F3D6E] hover:bg-blue-50'
                          }`}
                        >
                          {op.rotuloCurto}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {dados.paragrafo_encaminhamento_custom?.trim() && (
                    <button
                      type="button"
                      onClick={() => limparCustomParagrafo('pEnc', 'paragrafo_encaminhamento_custom')}
                      className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                    >
                      <RotateCcw className="h-2.5 w-2.5" /> Usar modelo selecionado
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      alternarEdicaoParagrafo('pEnc', 'paragrafo_encaminhamento_custom', textoParagrafoEncaminhamentoPadrao)
                    }
                    className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
                  >
                    <Edit3 className="h-2.5 w-2.5" />
                    <span>{paragrafosEmEdicao.pEnc ? 'Concluir edição do parágrafo' : '✏️ Editar parágrafo inteiro'}</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="campo-modelo-finalizacao" className="text-[10.5px] font-bold text-[#1E293B] shrink-0">
                  Escolher modelo de finalização:
                </label>
                <select
                  id="campo-modelo-finalizacao"
                  value={modeloFinalizacaoAtivo}
                  onChange={e => selecionarModeloFinalizacao(e.target.value as ModeloFinalizacaoManifestacaoId)}
                  className="min-w-[260px] flex-1 rounded-md border border-blue-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F3D6E] cursor-pointer"
                >
                  {MODELOS_FINALIZACAO_MANIFESTACAO.map(op => (
                    <option key={op.id} value={op.id}>
                      {op.rotulo}
                    </option>
                  ))}
                </select>
              </div>

              {paragrafosEmEdicao.pEnc || dados.paragrafo_encaminhamento_custom?.trim() ? (
                paragrafosEmEdicao.pEnc ? (
                  <textarea
                    rows={3}
                    value={dados.paragrafo_encaminhamento_custom || ''}
                    onChange={e => atualizarCampo('paragrafo_encaminhamento_custom', e.target.value)}
                    className="w-full rounded border border-amber-400 bg-white p-2.5 font-sans text-xs leading-relaxed text-black"
                  />
                ) : (
                  <p
                    onClick={() => setParagrafosEmEdicao(prev => ({ ...prev, pEnc: true }))}
                    className="indent-8 cursor-text rounded bg-amber-50/40 px-1 py-0.5 leading-7"
                  >
                    {dados.paragrafo_encaminhamento_custom}
                  </p>
                )
              ) : modeloFinalizacaoAtivo === '7_complemento_cartorio_dinamico' ? (
                <p className="indent-8 leading-7">
                  Para complemento das informações encaminho os Autos ao digno{' '}
                  <input
                    id="campo-cartorio_encaminhamento"
                    type="text"
                    value={dados.cartorio_encaminhamento}
                    onChange={e => atualizarCampo('cartorio_encaminhamento', e.target.value)}
                    placeholder="___ Oficial de Registro de Imóveis da Capital"
                    title="Cartório de encaminhamento"
                    className={`${classeCampoInline} min-w-[250px] font-bold`}
                  />
                  .
                </p>
              ) : modeloFinalizacaoAtivo === '8_sugestao_origem_matricula' ? (
                <p className="indent-8 leading-7">
                  Com a vênia devida, sugiro o encaminhamento dos presentes autos ao digno{' '}
                  <input
                    id="campo-cartorio_encaminhamento"
                    type="text"
                    value={dados.cartorio_encaminhamento}
                    onChange={e => atualizarCampo('cartorio_encaminhamento', e.target.value)}
                    placeholder="___ Cartório de Registro de Imóveis da Capital"
                    title="Cartório sugerido para encaminhamento"
                    className={`${classeCampoInline} min-w-[250px] font-bold`}
                  />
                  , tendo em vista a transcrição de origem nº{' '}
                  <input
                    type="text"
                    value={dados.matricula_transcricao}
                    onChange={e => atualizarCampo('matricula_transcricao', e.target.value)}
                    placeholder="___"
                    title="Transcrição / Matrícula de origem"
                    className={`${classeCampoInline} min-w-[140px] font-bold underline`}
                  />
                  .
                </p>
              ) : (
                <p
                  onClick={() =>
                    alternarEdicaoParagrafo('pEnc', 'paragrafo_encaminhamento_custom', textoParagrafoEncaminhamentoPadrao)
                  }
                  title="Clique para editar qualquer palavra desta finalização"
                  className="indent-8 cursor-text rounded bg-white/80 px-2 py-1 leading-7 shadow-2xs"
                >
                  <Segmentos segmentos={segmentosFinalizacaoAtiva} />
                </p>
              )}
            </div>

            {/* PARÁGRAFO EXTRA / OBSERVAÇÕES ADICIONAIS OPCIONAIS */}
            {mostrarParagrafoExtra || dados.paragrafo_extra_custom?.trim() ? (
              <div className="rounded-lg border border-amber-300 bg-amber-50/40 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-[10.5px] font-bold text-amber-900">
                  <span>Parágrafo / Observação Adicional na Manifestação:</span>
                  <button
                    type="button"
                    onClick={() => {
                      atualizarCampo('paragrafo_extra_custom', '');
                      setMostrarParagrafoExtra(false);
                    }}
                    className="text-rose-700 hover:underline cursor-pointer"
                  >
                    Remover parágrafo adicional
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={dados.paragrafo_extra_custom || ''}
                  onChange={e => atualizarCampo('paragrafo_extra_custom', e.target.value)}
                  placeholder="Digite aqui qualquer parágrafo ou esclarecimento adicional que deva constar na manifestação..."
                  className="w-full rounded border border-amber-400 bg-white p-2 font-sans text-xs leading-relaxed text-black focus:outline-none focus:ring-2 focus:ring-[#1E293B]"
                />
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(dados.incluir_fecho_cortesia || dados.paragrafo_fecho_custom?.trim())}
                    onChange={e => {
                      atualizarCampo('incluir_fecho_cortesia', e.target.checked);
                      if (!e.target.checked) atualizarCampo('paragrafo_fecho_custom', '');
                    }}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-[#0F3D6E]"
                  />
                  <span>Adicionar linha opcional de cortesia (&ldquo;Era o que, respeitosamente, cumpria informar a V. Exa.&rdquo;)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setMostrarParagrafoExtra(true)}
                  className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2.5 py-1 text-[10.5px] font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50 hover:text-gray-900 cursor-pointer"
                >
                  <FilePlus2 className="h-3 w-3" />
                  <span>+ Adicionar parágrafo / esclarecimento extra ao texto</span>
                </button>
              </div>
            )}

            {/* FECHO DE CORTESIA OPCIONAL */}
            {(dados.incluir_fecho_cortesia || dados.paragrafo_fecho_custom?.trim()) && (
              <div className="group relative rounded-lg border border-transparent p-1.5 transition hover:border-gray-200 hover:bg-gray-50/50">
                <div className="indent-8 flex flex-wrap items-center justify-between gap-2">
                  {paragrafosEmEdicao.pFecho ? (
                    <input
                      type="text"
                      value={dados.paragrafo_fecho_custom ?? textoFechoPadrao}
                      onChange={e => atualizarCampo('paragrafo_fecho_custom', e.target.value)}
                      className="flex-1 rounded border border-amber-400 bg-white px-2 py-1 font-sans text-xs text-black"
                    />
                  ) : (
                    <span>{dados.paragrafo_fecho_custom?.trim() || textoFechoPadrao}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => alternarEdicaoParagrafo('pFecho', 'paragrafo_fecho_custom', textoFechoPadrao)}
                    className="inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer opacity-80 group-hover:opacity-100"
                  >
                    <Edit3 className="h-2.5 w-2.5" />
                    <span>{paragrafosEmEdicao.pFecho ? 'OK' : 'Editar fecho'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LOCAL E DATA EDITÁVEL */}
        <div className="pt-6 text-right text-xs">
          <input
            type="text"
            aria-label="Local e data da manifestação"
            value={dados.local_data_manifestacao ?? minuta.local}
            onChange={e => atualizarCampo('local_data_manifestacao', e.target.value)}
            className={`${classeCampoInline} min-w-[230px] text-right`}
          />
        </div>

        {/* ASSINATURA EDITÁVEL */}
        <div className="pt-8 text-center space-y-1">
          <div className="mb-6">
            <input
              type="text"
              aria-label="Título da assinatura"
              value={dados.assinatura_titulo ?? minuta.assinatura.titulo ?? 'O Oficial,'}
              onChange={e => atualizarCampo('assinatura_titulo', e.target.value)}
              className={`${classeCampoInline} w-44 text-center text-xs`}
            />
          </div>
          <div className="border-t border-black w-72 max-w-full mx-auto pt-1.5">
            <input
              type="text"
              aria-label="Nome do signatário"
              value={dados.assinatura_nome ?? minuta.assinatura.nome}
              onChange={e => atualizarCampo('assinatura_nome', e.target.value)}
              className={`${classeCampoInline} w-64 text-center font-bold text-xs`}
            />
          </div>
          <div>
            <input
              type="text"
              aria-label="Cargo do signatário"
              value={dados.assinatura_cargo ?? minuta.assinatura.cargo}
              onChange={e => atualizarCampo('assinatura_cargo', e.target.value)}
              className={`${classeCampoInline} w-72 text-center text-[10px] text-gray-600`}
            />
          </div>
        </div>
      </article>
    );
  };

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
        {(dados.confrontante_lado_direito || dados.confrontante_lado_esquerdo || dados.confrontante_fundos || dados.rua_olhar_confrontacao) &&
        !(dados.anotacoes_ficha_oficial || '').includes('CONFRONTAÇÕES') ? (
          <div style={{ fontSize: 11.5, fontFamily: 'Arial, sans-serif', padding: '4px 6px', marginBottom: 6, border: '1px solid #888', background: '#fafafa' }}>
            <div style={{ fontWeight: 'bold', marginBottom: 2 }}>CONFRONTAÇÕES DO IMÓVEL USUCAPIENDO:</div>
            {dados.rua_olhar_confrontacao ? <div>• <strong>Frente (Logradouro):</strong> {dados.rua_olhar_confrontacao}</div> : null}
            {dados.confrontante_lado_direito ? <div>• <strong>Pelo Lado Direito:</strong> {dados.confrontante_lado_direito}</div> : null}
            {dados.confrontante_lado_esquerdo ? <div>• <strong>Pelo Lado Esquerdo:</strong> {dados.confrontante_lado_esquerdo}</div> : null}
            {dados.confrontante_fundos ? <div>• <strong>Aos Fundos:</strong> {dados.confrontante_fundos}</div> : null}
            {plantaSetorCalculada ? <div>• <strong>Planta Fiscal (Setores):</strong> {plantaSetorCalculada.caminhoCompleto}</div> : null}
          </div>
        ) : null}
        {dados.anotacoes_ficha_oficial ? (
          <p style={{ fontSize: 12, fontFamily: 'Arial, sans-serif', minHeight: 40, padding: '2px 4px', margin: '0 0 6px', whiteSpace: 'pre-wrap', borderBottom: '1px dotted #777' }}>
            {dados.anotacoes_ficha_oficial}
          </p>
        ) : null}
        <div style={{ marginTop: 8 }}>
          {Array.from({ length: dados.anotacoes_ficha_oficial ? 12 : 16 }).map((_, i) => (
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
            <div role="tablist" aria-label="Etapas do formulário" className="flex max-w-full flex-wrap items-center gap-1.5 rounded-xl border border-[#334155]/40 bg-[#1E293B]/60 p-1">
              {([
                { id: 'formulario', rotulo: '1. Formulário de Conferência do Oficial', curto: '1. Formulário Oficial' },
                { id: 'manifestacao', rotulo: '2. Revisão e Manifestação Oficial', curto: '2. Manifestação Oficial' },
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
                    className={`flex max-w-full items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C9B896] ${
                      ativa
                        ? 'border-b-2 border-[#C9B896] bg-[#F5F2ED] text-[#1E293B] shadow-xs'
                        : 'text-[#CBD5E1] hover:bg-[#334155]/50 hover:text-white'
                    }`}
                  >
                    <span className="hidden sm:inline whitespace-nowrap">{aba.rotulo}</span>
                    <span className="sm:hidden truncate">{aba.curto}</span>
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
                  <div className="min-w-[14rem] flex-1 space-y-1.5 text-xs text-gray-800">
                    <div>
                      <strong>Orientações:</strong> Imprima a folha de conferência física para conferência e visto do Oficial ou seu Substituto.
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-0.5">
                      {(dados.status_conferencia === 'CONFERIDO' || arquivada) && (
                        <button
                          type="button"
                          disabled={!onAlternarConferencia}
                          onClick={async () => {
                            if (!onAlternarConferencia) return;
                            await onAlternarConferencia('AGUARDANDO_CONFERENCIA');
                            setDados(prev => ({ ...prev, status_conferencia: 'AGUARDANDO_CONFERENCIA' }));
                            mostrarAviso('Selo retornado para AGUARDANDO CONFERÊNCIA (vermelho).');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-blue-300/90 bg-gradient-to-r from-blue-50 via-white to-indigo-50/90 px-3 py-1 text-[11px] font-bold tracking-wide text-blue-800 shadow-2xs ring-1 ring-blue-500/10 hover:border-blue-400 transition cursor-pointer disabled:cursor-default"
                          title="Formulário conferido pelo Oficial ou seu Substituto"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>Conferido</span>
                        </button>
                      )}
                      {onAlternarConferencia && (
                        <button
                          type="button"
                          onClick={async () => {
                            const novo = dados.status_conferencia === 'CONFERIDO' ? 'AGUARDANDO_CONFERENCIA' : 'CONFERIDO';
                            await onAlternarConferencia(novo);
                            setDados(prev => ({ ...prev, status_conferencia: novo }));
                            mostrarAviso(
                              novo === 'CONFERIDO'
                                ? 'Selo atualizado para CONFERIDO (azul) e arquivado para fiscalização.'
                                : 'Selo retornado para AGUARDANDO CONFERÊNCIA (vermelho).',
                            );
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                            dados.status_conferencia === 'CONFERIDO'
                              ? 'border-rose-200/90 bg-gradient-to-r from-rose-50/70 via-white to-rose-50/70 text-rose-700 hover:border-rose-300 hover:bg-rose-50 shadow-2xs'
                              : 'border-blue-700/80 bg-gradient-to-r from-[#0B4F8A] via-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-600/20 hover:from-[#093E6E] hover:via-blue-700 hover:to-indigo-700 hover:shadow'
                          }`}
                        >
                          {dados.status_conferencia === 'CONFERIDO' ? (
                            <Clock className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 text-blue-100 shrink-0" />
                          )}
                          <span>
                            {dados.status_conferencia === 'CONFERIDO'
                              ? 'Voltar para Aguardando Conferência'
                              : 'Realizar Conferência (Marcar Conferido)'}
                          </span>
                        </button>
                      )}
                    </div>
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
                    <button
                      type="button"
                      onClick={() => void salvarNaFila(true, 'formulario')}
                      disabled={salvandoRascunho}
                      className={botaoClaro}
                      title="Salvar rascunho em local seguro no banco do FIORIX (visível em todas as máquinas do setor)"
                    >
                      {salvandoRascunho ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Save className="h-3.5 w-3.5" aria-hidden="true" />}
                      <span>{salvandoRascunho ? 'Salvando…' : 'Salvar Rascunho / Fila'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={abrirModalConsultaRascunhos}
                      className={botaoClaro}
                      title="Consultar, reabrir ou baixar rascunhos e manifestações salvas no FIORIX"
                    >
                      <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Consultar Rascunhos</span>
                    </button>
                    <button type="button" onClick={imprimirFormularioOficial} className={`${botaoEscuro} gap-2 px-3 sm:px-4`}>
                      <Printer className="h-4 w-4 shrink-0 text-[#B8A082]" aria-hidden="true" />
                      <span className="hidden sm:inline">🖨️ Imprimir Formulário para Conferência do Oficial</span>
                      <span className="sm:hidden">🖨️ Imprimir Formulário</span>
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
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-3">
                        <label className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-serif text-xs font-bold text-black">Matrícula / Transcrição:</span>
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

                      {/* Arquivo da Imagem (LV2) em K:\IMAGENS\LV2 associado à Matrícula encontrada */}
                      {arquivosLivro2 && arquivosLivro2.length > 0 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-300 bg-amber-50/70 px-2.5 py-1.5 font-sans text-xs">
                          <div className="flex min-w-0 items-center gap-2">
                            <ImageIcon className="h-3.5 w-3.5 shrink-0 text-amber-800" />
                            <div className="min-w-0">
                              <span className="font-bold text-amber-950">Imagem da Matrícula (LV2): </span>
                              <span className="font-mono font-bold text-gray-900">{arquivosLivro2[0].name}</span>
                              <span className="ml-1.5 font-mono text-[10.5px] text-gray-600">
                                ({formatCartorioPath(arquivosLivro2[0].rootId, arquivosLivro2[0].relativePath)})
                              </span>
                            </div>
                          </div>
                          {onVisualizarDocumento ? (
                            <button
                              type="button"
                              onClick={() => onVisualizarDocumento(arquivosLivro2[0])}
                              className="inline-flex items-center gap-1 rounded bg-[#1E293B] px-2.5 py-1 text-[10.5px] font-bold text-white hover:bg-[#334155] transition cursor-pointer"
                            >
                              <Eye className="h-3 w-3" />
                              <span>Visualizar Matrícula (K:\IMAGENS\LV2)</span>
                            </button>
                          ) : null}
                        </div>
                      ) : buscandoLivro2 ? (
                        <div className="flex items-center gap-1.5 font-sans text-[11px] text-gray-600">
                          <Loader2 className="h-3 w-3 animate-spin text-[#0F3D6E]" />
                          <span>Localizando arquivo da imagem da matrícula em <code className="font-mono">K:\IMAGENS\LV2</code>…</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* LINHA HORIZONTAL PRETA GROSSA */}
                  <div className="my-4 h-1 bg-black" />

                  {/* CONFERÊNCIA E ANOTAÇÕES + CONFRONTAÇÕES DO IMÓVEL (4 FONTES) */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 font-sans text-[11px] font-bold uppercase tracking-wider">
                      <label htmlFor="doc-anotacoes" className="flex items-center gap-1.5 text-black">
                        <span>Conferência e Anotações:</span>
                        <span className="rounded bg-[#1E293B] px-1.5 py-0.5 text-[9.5px] font-semibold text-white">
                          Confrontações do Imóvel
                        </span>
                      </label>
                      <span className="font-normal text-gray-700">Anotações editáveis abaixo</span>
                    </div>

                    {/* Painel Integrado de Confrontações do Imóvel Usucapiendo */}
                    <div className="rounded-lg border border-gray-300 bg-[#FDFBF7] p-3 font-sans text-xs shadow-2xs space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 pb-2">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-[#1E293B]">
                            <Compass className="h-3.5 w-3.5 text-[#0F3D6E]" />
                            <span>Confrontações do Imóvel Elencado no Usucapião</span>
                          </div>
                          <p className="text-[10.5px] text-gray-600">
                            Pesquisa integrada: Petição Inicial • Matrícula ({dados.matricula_transcricao || 'LV2/LV3'}) • Plantas Fiscais (<code className="font-mono">K:\IMAGENS\SETORES</code>) • GeoSampa
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => registrarConfrontacoesNasAnotacoes()}
                          className="inline-flex items-center gap-1 rounded-md border border-[#1E293B] bg-[#1E293B] px-2.5 py-1 text-[10.5px] font-bold text-white hover:bg-[#334155] transition cursor-pointer"
                          title="Insere ou atualiza as confrontações preenchidas dentro do campo de texto de Conferência e Anotações abaixo"
                        >
                          <Check className="h-3 w-3" />
                          <span>Registrar Confrontações nas Anotações</span>
                        </button>
                      </div>

                      {/* Campos das Confrontações (sincronizados com a Etapa 2 e com a Ficha Impressa) */}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                            Frente / Logradouro (de quem da rua olha o imóvel)
                          </span>
                          <input
                            type="text"
                            value={dados.rua_olhar_confrontacao}
                            onChange={e => atualizarCampo('rua_olhar_confrontacao', e.target.value)}
                            placeholder="Ex.: Rua 47 / Rua Gaspar Rodrigues, nº 191"
                            className={inputPainel}
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                            Pelo Lado Direito
                          </span>
                          <input
                            type="text"
                            value={dados.confrontante_lado_direito}
                            onChange={e => atualizarCampo('confrontante_lado_direito', e.target.value)}
                            placeholder="Ex.: com o lote 11 (prédio nº ... / Matrícula nº ...)"
                            className={inputPainel}
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                            Pelo Lado Esquerdo
                          </span>
                          <input
                            type="text"
                            value={dados.confrontante_lado_esquerdo}
                            onChange={e => atualizarCampo('confrontante_lado_esquerdo', e.target.value)}
                            placeholder="Ex.: com o lote 13 (prédio nº ... / Matrícula nº ...)"
                            className={inputPainel}
                          />
                        </label>
                        <label className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-700">
                            Aos Fundos
                          </span>
                          <input
                            type="text"
                            value={dados.confrontante_fundos}
                            onChange={e => atualizarCampo('confrontante_fundos', e.target.value)}
                            placeholder="Ex.: com o lote 25 da quadra ..."
                            className={inputPainel}
                          />
                        </label>
                      </div>

                      {/* Barra de Ação: Ver Autos (PDF) */}
                      {arquivoOrigem && onVisualizarDocumento ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              onVisualizarDocumento({
                                rootId: arquivoOrigem.rootId || 'processos',
                                relativePath: arquivoOrigem.relativePath,
                                name: arquivoOrigem.name,
                                size: 0,
                                modifiedAt: '',
                              })
                            }
                            className={botaoOrigem}
                            title={`Abrir os autos do processo (${arquivoOrigem.name}) para conferir a Petição Inicial e a Certidão de Matrícula`}
                          >
                            <Eye className="h-3.5 w-3.5 text-[#0F3D6E]" />
                            <span>Ver Autos (PDF)</span>
                          </button>
                        </div>
                      ) : null}

                      {/* Atalhos Oficiais e Confrontantes do GEOSAMPA (Ocultos por padrão, com opção de desocultar) */}
                      <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-2 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setCardsGeoSampaVisiveis(v => !v)}
                            className="flex flex-wrap items-center gap-1.5 text-left text-[10.5px] font-bold uppercase tracking-wider text-[#0F3D6E] hover:text-blue-950 transition cursor-pointer"
                            title={
                              cardsGeoSampaVisiveis
                                ? 'Clique para ocultar os cards e links do GeoSampa'
                                : 'Clique para desocultar os links diretos e confrontantes do GeoSampa'
                            }
                          >
                            <span className="text-xs leading-none">{cardsGeoSampaVisiveis ? '▾' : '▸'}</span>
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span>GEOSAMPA — Mapa Digital da Cidade de São Paulo (Links Diretos)</span>
                            {resultadoGeoSampa?.setor && resultadoGeoSampa?.quadra ? (
                              <span className="rounded bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-bold text-[#0F3D6E] normal-case">
                                Setor {resultadoGeoSampa.setor} • Quadra {resultadoGeoSampa.quadra}
                                {resultadoGeoSampa.lote ? ` • Lote ${resultadoGeoSampa.lote}` : ''}
                              </span>
                            ) : null}
                          </button>
                        </div>

                        {cardsGeoSampaVisiveis && (
                          <div className="space-y-2 border-t border-blue-200/70 pt-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <a
                                href="https://geosampa.prefeitura.sp.gov.br/PaginasPublicas/_SBC.aspx"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 rounded border border-blue-300 bg-white px-2 py-1 text-[10.5px] font-semibold text-[#0F3D6E] hover:bg-blue-50 transition"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>GeoSampa Clássico (_SBC.aspx)</span>
                              </a>
                            </div>

                            {erroGeoSampa ? (
                              <div className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
                                {erroGeoSampa}
                              </div>
                            ) : null}

                            {/* Resultado da Consulta Automática ao GeoSampa (Lote + IPTU + Confrontantes Lindeiros) */}
                            {resultadoGeoSampa?.confrontantesGeoSampa ? (
                              <div className="rounded border border-blue-200 bg-white p-2.5 space-y-2">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="text-[11px] font-bold text-[#1E293B]">
                                    Confrontantes Lindeiros Apurados na Quadra Fiscal (GeoSampa):
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const cg = resultadoGeoSampa.confrontantesGeoSampa!;
                                      registrarConfrontacoesNasAnotacoes({
                                        frente: cg.frente || dados.rua_olhar_confrontacao,
                                        ladoDireito: cg.ladoDireito || dados.confrontante_lado_direito,
                                        ladoEsquerdo: cg.ladoEsquerdo || dados.confrontante_lado_esquerdo,
                                        fundos: cg.fundos || dados.confrontante_fundos,
                                        plantaFiscal: resultadoGeoSampa.plantaSetor?.caminhoCompleto,
                                        sqlGeoSampa: resultadoGeoSampa.loteGeoSampa?.nr_contribuinte,
                                      });
                                      mostrarAviso('Confrontações do GeoSampa aplicadas nos campos e registradas em Conferência e Anotações!');
                                    }}
                                    className="inline-flex items-center gap-1 rounded bg-[#0F3D6E] px-2.5 py-1 text-[10.5px] font-bold text-white hover:bg-[#1E3A8A] transition cursor-pointer"
                                  >
                                    <Check className="h-3 w-3" />
                                    <span>Aplicar Confrontantes do GeoSampa na Ficha e Anotações</span>
                                  </button>
                                </div>

                                {resultadoGeoSampa.loteGeoSampa ? (
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-gray-700 border-b border-gray-100 pb-1.5">
                                    <span>
                                      <strong>SQL:</strong> {resultadoGeoSampa.loteGeoSampa.nr_contribuinte || '—'}
                                    </span>
                                    <span>
                                      <strong>Logradouro:</strong> {resultadoGeoSampa.loteGeoSampa.nm_logradouro_completo || '—'}
                                      {resultadoGeoSampa.loteGeoSampa.cd_numero_porta
                                        ? `, nº ${resultadoGeoSampa.loteGeoSampa.cd_numero_porta}`
                                        : ''}
                                    </span>
                                    {resultadoGeoSampa.loteGeoSampa.qt_area_terreno ? (
                                      <span>
                                        <strong>Área Terreno:</strong> {resultadoGeoSampa.loteGeoSampa.qt_area_terreno} m²
                                      </span>
                                    ) : null}
                                    {resultadoGeoSampa.loteGeoSampa.qt_area_construida ? (
                                      <span>
                                        <strong>Área Construída:</strong> {resultadoGeoSampa.loteGeoSampa.qt_area_construida} m²
                                      </span>
                                    ) : null}
                                    {resultadoGeoSampa.iptuIntegracao?.['Tipo do Terreno'] ? (
                                      <span>
                                        <strong>Terreno:</strong> {resultadoGeoSampa.iptuIntegracao['Tipo do Terreno']}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : null}

                                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 text-[11px]">
                                  <div className="rounded border border-gray-200 bg-gray-50 p-1.5">
                                    <div className="text-[9.5px] font-bold uppercase text-gray-500">Lado Direito (GeoSampa)</div>
                                    <div className="font-semibold text-gray-900">
                                      {resultadoGeoSampa.confrontantesGeoSampa.ladoDireito || 'Não identificado'}
                                    </div>
                                  </div>
                                  <div className="rounded border border-gray-200 bg-gray-50 p-1.5">
                                    <div className="text-[9.5px] font-bold uppercase text-gray-500">Lado Esquerdo (GeoSampa)</div>
                                    <div className="font-semibold text-gray-900">
                                      {resultadoGeoSampa.confrontantesGeoSampa.ladoEsquerdo || 'Não identificado'}
                                    </div>
                                  </div>
                                  <div className="rounded border border-gray-200 bg-gray-50 p-1.5">
                                    <div className="text-[9.5px] font-bold uppercase text-gray-500">Aos Fundos (GeoSampa)</div>
                                    <div className="font-semibold text-gray-900">
                                      {resultadoGeoSampa.confrontantesGeoSampa.fundos || 'Não identificado'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {/* Card Ver Planta de Setor: K:\IMAGENS\SETORES\ */}
                      <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-2.5 space-y-2 shadow-2xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-emerald-950">
                            <FolderOpen className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                            <span>
                              Ver Planta de Setor — <code className="font-mono">K:\IMAGENS\SETORES\</code>
                            </span>
                            {plantaSetorCalculada ? (
                              <span className="rounded bg-emerald-100 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-900 normal-case border border-emerald-300/80">
                                Setor {plantaSetorCalculada.setor} • Quadra {plantaSetorCalculada.quadra}
                              </span>
                            ) : null}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <input
                              type="text"
                              value={termoBuscadoSetores}
                              onChange={e => setTermoBuscadoSetores(e.target.value)}
                              placeholder={plantaSetorCalculada?.termoBusca || 'Ex.: 052.287 ou 00052287'}
                              className="w-40 rounded border border-emerald-300 bg-white px-2 py-0.5 font-mono text-[11px] text-gray-900 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => void localizarPlantaSetorNoAcervo(termoBuscadoSetores || undefined, false)}
                              disabled={buscandoSetores}
                              className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1 text-[10.5px] font-bold text-white hover:bg-emerald-800 transition cursor-pointer disabled:opacity-50"
                            >
                              {buscandoSetores ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                              <span>Buscar em SETORES</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (onVisualizarDocumento) {
                                  const alvo: Livro2Match = arquivoPlantaSetorDireto || {
                                    rootId: 'imagens',
                                    relativePath: 'SETORES\\00001000\\00001001.KEN',
                                    name: '00001001.KEN',
                                    size: 0,
                                    modifiedAt: '',
                                  };
                                  onVisualizarDocumento(alvo);
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded border border-emerald-400 bg-white px-2 py-1 text-[10.5px] font-bold text-emerald-900 hover:bg-emerald-50 transition cursor-pointer"
                              title="Abrir K:\IMAGENS\SETORES\ no Visualizador de Imagens (padrão claro)"
                            >
                              <Eye className="h-3 w-3 text-emerald-700" />
                              <span>Abrir K:\IMAGENS\SETORES\</span>
                            </button>
                          </div>
                        </div>

                        {erroSetores ? (
                          <div className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
                            {erroSetores}
                          </div>
                        ) : null}

                        {/* Lista de arquivos de Planta de Setor (encontrados no disco ou calculado direto pelo SQL/Setor/Quadra) */}
                        {(() => {
                          const listaExibicao: Livro2Match[] =
                            arquivosSetores && arquivosSetores.length > 0
                              ? arquivosSetores.slice(0, 6)
                              : arquivoPlantaSetorDireto
                              ? [arquivoPlantaSetorDireto]
                              : [];

                          if (listaExibicao.length > 0) {
                            return (
                              <div className="space-y-1.5">
                                {listaExibicao.map(arq => {
                                  const caminhoCompleto = formatCartorioPath(arq.rootId, arq.relativePath);
                                  return (
                                    <div
                                      key={`${arq.rootId}:${arq.relativePath}`}
                                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-xs shadow-2xs"
                                    >
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-mono font-bold text-gray-900">{arq.name}</span>
                                          <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[9.5px] font-bold text-emerald-800 border border-emerald-200">
                                            Planta de Setor (.KEN)
                                          </span>
                                        </div>
                                        <div className="truncate font-mono text-[10px] text-gray-500" title={caminhoCompleto}>
                                          {caminhoCompleto}
                                        </div>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {onVisualizarDocumento ? (
                                          <button
                                            type="button"
                                            onClick={() => onVisualizarDocumento(arq)}
                                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1 text-[10.5px] font-bold text-white hover:bg-emerald-800 transition shadow-2xs cursor-pointer"
                                            title={`Visualizar Planta de Setor (${caminhoCompleto})`}
                                          >
                                            <Eye className="h-3 w-3" />
                                            <span>Ver Planta de Setor</span>
                                          </button>
                                        ) : (
                                          <a
                                            href={`/gestao-documental/visualizador?sessao=SETORES&matricula=${encodeURIComponent(arq.name.replace(/\..+$/, ''))}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1 text-[10.5px] font-bold text-white hover:bg-emerald-800 transition shadow-2xs"
                                          >
                                            <Eye className="h-3 w-3" />
                                            <span>Ver Planta de Setor</span>
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 text-[11px] text-gray-600">
                              <span>
                                Informe o SQL (ex.: <code className="font-mono">052.287.0091-9</code>) ou digite o Setor/Quadra acima para abrir a Planta Fiscal em{' '}
                                <code className="font-mono font-bold text-emerald-900">K:\IMAGENS\SETORES\</code>.
                              </span>
                            </div>
                          );
                        })()}
                      </div>
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
              /* ETAPA 2: TELA UNIFICADA E HÍBRIDA DA MANIFESTAÇÃO OFICIAL (EDIÇÃO DIRETA NO A4 + RASCUNHO + WORD .DOC/.DOCX) */
              <div className="space-y-4">
                {/* BARRA DE COMANDOS UNIFICADA DA MANIFESTAÇÃO HÍBRIDA */}
                <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-2xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setAbaAtiva('formulario')}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                      >
                        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Voltar à Etapa 1</span>
                      </button>

                      {/* Status de Conferência também visível e interativo na Etapa 2 */}
                      {dados.status_conferencia === 'CONFERIDO' || arquivada ? (
                        <button
                          type="button"
                          disabled={!onAlternarConferencia}
                          onClick={async () => {
                            if (!onAlternarConferencia) return;
                            await onAlternarConferencia('AGUARDANDO_CONFERENCIA');
                            setDados(prev => ({ ...prev, status_conferencia: 'AGUARDANDO_CONFERENCIA' }));
                            mostrarAviso('Selo retornado para AGUARDANDO CONFERÊNCIA (vermelho).');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-blue-300/90 bg-gradient-to-r from-blue-50 via-white to-indigo-50/90 px-3 py-1 text-[11px] font-bold tracking-wide text-blue-800 shadow-2xs ring-1 ring-blue-500/10 hover:border-blue-400 transition cursor-pointer disabled:cursor-default"
                          title={onAlternarConferencia ? 'Conferido • Clique se precisar retornar para Aguardando Conferência' : 'Formulário conferido'}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>Conferido</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!onAlternarConferencia}
                          onClick={async () => {
                            if (!onAlternarConferencia) return;
                            await onAlternarConferencia('CONFERIDO');
                            setDados(prev => ({ ...prev, status_conferencia: 'CONFERIDO' }));
                            mostrarAviso('Selo atualizado para CONFERIDO (azul) e arquivado para fiscalização.');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/90 bg-gradient-to-r from-rose-50 via-white to-amber-50/70 px-3 py-1 text-[11px] font-bold tracking-wide text-rose-800 shadow-2xs ring-1 ring-rose-500/10 hover:border-rose-400 hover:from-rose-100/80 transition cursor-pointer disabled:cursor-default"
                          title={onAlternarConferencia ? 'Aguardando Conferência • Clique para marcar como Conferido' : 'Aguardando Conferência'}
                        >
                          <span className="relative flex h-2 w-2 shrink-0">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-600" />
                          </span>
                          <Clock className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                          <span>Aguardando Conferência</span>
                        </button>
                      )}

                      <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-[#F8F7F4] p-0.5">
                        <button
                          type="button"
                          onClick={() => alternarModoEdicaoManifestacao('hibrido')}
                          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                            !modoTextoLivreAtivo
                              ? 'bg-[#1E293B] text-white shadow-2xs'
                              : 'text-gray-700 hover:bg-white'
                          }`}
                          title="Edite tanto os campos extraídos pelo OCR/IA diretamente nas frases quanto os parágrafos individualmente"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-[#B8A082]" aria-hidden="true" />
                          <span>Modo Híbrido (Campos + Texto no A4)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => alternarModoEdicaoManifestacao('texto_livre')}
                          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition cursor-pointer ${
                            modoTextoLivreAtivo
                              ? 'bg-[#1E293B] text-white shadow-2xs'
                              : 'text-gray-700 hover:bg-white'
                          }`}
                          title="Edite o corpo inteiro da Manifestação livremente como em um editor de texto"
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Texto Livre Completo</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setConfiguracoesRapidasAbertas(v => !v)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                        title="Mostrar ou recolher barra rápida de Pasta de Escrevente, Subdistrito e consulta de Matrícula no Livro 2"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 text-[#334155]" aria-hidden="true" />
                        <span>{configuracoesRapidasAbertas ? 'Ocultar barra auxiliar' : 'Mostrar barra auxiliar'}</span>
                      </button>
                    </div>

                    {/* AÇÕES DE RASCUNHO, EXPORTAÇÃO (.DOCX / .DOC / PDF), IMPRESSÃO E FINALIZAÇÃO */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void salvarNaFila(true, 'manifestacao')}
                        disabled={salvandoRascunho}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-amber-400 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-950 shadow-2xs transition hover:bg-amber-100 cursor-pointer disabled:opacity-50"
                        title="Salva o rascunho da Manifestação (incluindo todas as edições de texto feitas) em local seguro no banco de dados do FIORIX para consulta e finalização a qualquer momento"
                      >
                        {salvandoRascunho ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Save className="h-3.5 w-3.5 text-amber-800" aria-hidden="true" />}
                        <span>{salvandoRascunho ? 'Salvando…' : '💾 Salvar Rascunho'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={abrirModalConsultaRascunhos}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#CBD5E1] bg-[#F8F7F4] px-3 py-1.5 text-xs font-bold text-[#1E293B] shadow-2xs transition hover:bg-gray-200/70 cursor-pointer"
                        title="Consultar todos os rascunhos e manifestações salvos em local seguro no FIORIX"
                      >
                        <FolderOpen className="h-3.5 w-3.5 text-[#0F3D6E]" aria-hidden="true" />
                        <span>📂 Consultar Rascunhos / Salvos</span>
                      </button>

                      <button
                        type="button"
                        onClick={baixarDocxAtual}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-900 shadow-2xs transition hover:bg-blue-100 cursor-pointer"
                        title="Salvar / Baixar a Manifestação Oficial em formato Microsoft Word (.docx)"
                      >
                        <FileText className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
                        <span>.DOCX</span>
                      </button>

                      <button
                        type="button"
                        onClick={baixarDocAtual}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-900 shadow-2xs transition hover:bg-indigo-100 cursor-pointer"
                        title="Salvar / Baixar a Manifestação Oficial em formato Word 97-2003 (.doc)"
                      >
                        <FileText className="h-3.5 w-3.5 text-indigo-700" aria-hidden="true" />
                        <span>.DOC</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void baixarPdfArquivado()}
                        className={botaoClaro}
                        title="Baixar a Manifestação Oficial em PDF"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={copiarManifestacao}
                        className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gray-100 px-2.5 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-200 cursor-pointer"
                      >
                        {copiado ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
                        <span>{copiado ? 'Copiado' : 'Copiar'}</span>
                      </button>

                      <button type="button" onClick={imprimirManifestacaoOficial} className={botaoClaro}>
                        <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Imprimir A4</span>
                      </button>

                      {onFinalizar && (!arquivada || alteradaAposArquivar) && (
                        <button
                          type="button"
                          onClick={solicitarFinalizacao}
                          disabled={finalizando || !conferenciaConcluida}
                          className={botaoEscuro}
                          title={
                            !conferenciaConcluida
                              ? 'A conferência oficial precisa estar concluída (status CONFERIDO) antes de finalizar e arquivar a Etapa 2'
                              : 'Finalizar Etapa 2 e arquivar a manifestação no Arquivo do FIORIX'
                          }
                        >
                          {finalizando ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Archive className="h-3.5 w-3.5" aria-hidden="true" />}
                          <span>{finalizando ? 'Arquivando…' : 'Finalizar e arquivar'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* INDICADOR DE RASCUNHO SALVO NO FIORIX */}
                  {dados.rascunho_salvo_em && !arquivada && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-1.5 text-[11px] text-amber-900">
                      <span>
                        🔒 <strong>Rascunho salvo em local seguro no FIORIX:</strong> última gravação em{' '}
                        {new Date(dados.rascunho_salvo_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Você pode consultar e retomar este rascunho a qualquer momento em <strong>Consultar Rascunhos / Salvos</strong>, na aba <strong>Em Conferência</strong> ou no <strong>Histórico</strong>.
                      </span>
                    </div>
                  )}

                  {/* BARRA AUXILIAR COMPACTA: PASTA DE DESTINO, SUBDISTRITO, LIVRO 2 E AUTOS */}
                  {configuracoesRapidasAbertas && (
                    <div className="rounded-xl border border-gray-200 bg-[#F8F7F4] p-3 space-y-2.5">
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                        <div>
                          <label htmlFor="campo-escrevente_pasta" className="mb-1 block text-[10.5px] font-bold text-gray-700">
                            Pasta de Destino ({pastaUsucapiao}):
                          </label>
                          <select
                            id="campo-escrevente_pasta"
                            value={dados.escrevente_pasta}
                            onChange={e => atualizarCampo('escrevente_pasta', e.target.value)}
                            className="w-full rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1.5 text-xs font-bold text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-[#64748B]"
                          >
                            {!ESCREVENTES_USUCAPIAO.includes(dados.escrevente_pasta) && (
                              <option value={dados.escrevente_pasta}>{dados.escrevente_pasta || 'Selecione…'}</option>
                            )}
                            {ESCREVENTES_USUCAPIAO.map(esc => (
                              <option key={esc} value={esc}>{pastaUsucapiao}\{esc}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <div className="mb-1 flex items-center justify-between gap-1">
                            <label htmlFor="campo-subdistrito" className="text-[10.5px] font-bold text-gray-700">
                              Subdistrito do Imóvel:
                            </label>
                            <button
                              type="button"
                              onClick={() => setGuiaAberto(true)}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0F3D6E] hover:underline cursor-pointer"
                            >
                              <BookOpen className="h-3 w-3" aria-hidden="true" /> Guia
                            </button>
                          </div>
                          <select
                            id="campo-subdistrito"
                            value={dados.subdistrito}
                            onChange={e => atualizarCampo('subdistrito', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#64748B]"
                          >
                            {!subdistritoValido && <option value={dados.subdistrito}>{dados.subdistrito || 'Selecione…'}</option>}
                            {SUBDISTRITOS_7RI.map(sub => (
                              <option key={sub.nome} value={sub.nome}>{sub.nome}</option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col justify-end">
                          <span className="mb-1 block text-[10.5px] font-bold text-gray-700">
                            Consulta Rápida ao Acervo:
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              disabled={buscandoLivro2 || !dados.matricula_transcricao?.trim()}
                              onClick={() => localizarNoLivro2()}
                              className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1.5 text-[11px] font-bold text-purple-800 shadow-2xs transition hover:bg-purple-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                              title="Localizar a imagem digitalizada (.KEN) da matrícula de origem no acervo do Livro 2 (K:\IMAGENS\LV2)"
                            >
                              {buscandoLivro2 ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
                              <span>{buscandoLivro2 ? 'Localizando…' : '🔎 Matrícula .KEN (LV2)'}</span>
                            </button>

                            {arquivoPlantaSetorDireto && onVisualizarDocumento ? (
                              <button
                                type="button"
                                onClick={() => onVisualizarDocumento(arquivoPlantaSetorDireto)}
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-emerald-400 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-900 shadow-2xs transition hover:bg-emerald-100 cursor-pointer"
                                title={`Ver Planta de Setor em K:\\IMAGENS\\SETORES\\ (${plantaSetorCalculada?.caminhoCompleto || formatCartorioPath(arquivoPlantaSetorDireto.rootId, arquivoPlantaSetorDireto.relativePath)})`}
                              >
                                <Eye className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                                <span>🗺️ Ver Planta de Setor ({arquivoPlantaSetorDireto.name})</span>
                              </button>
                            ) : null}

                            {textoAutosDisponivel && (
                              <button
                                type="button"
                                onClick={preencherConfrontacoesPelosAutos}
                                className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
                                title="Extrair confrontações do texto dos autos (petição / OCR)"
                              >
                                <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Confrontações pelos Autos</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col justify-center rounded-lg border border-[#CBD5E1]/80 bg-white px-3 py-1.5 text-[11px]">
                          <div className="flex items-center gap-1 font-bold text-[#1E293B]">
                            <Sparkles className="h-3 w-3 text-[#334155]" aria-hidden="true" />
                            <span>Anexos Sincronizados (4º Parágrafo):</span>
                          </div>
                          <div className="truncate text-[10.5px] text-gray-600">
                            <strong>Transc.:</strong> <span className="font-mono">{dados.transcricoes_anexas || 'nenhuma'}</span> •{' '}
                            <strong>Matr.:</strong> <span className="font-mono">{dados.matriculas_anexas || 'nenhuma'}</span>
                          </div>
                        </div>
                      </div>

                      {/* RESULTADO DO LIVRO 2 QUANDO ACIONADO NA ETAPA 2 */}
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
                              className="rounded p-0.5 text-gray-500 hover:text-gray-900"
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
                            <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto pr-1">
                              {arquivosLivro2.map(file => {
                                const caminho = formatCartorioPath(file.rootId, file.relativePath);
                                return (
                                  <li key={`${file.rootId}:${file.relativePath}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-2.5 py-1.5">
                                    <div className="min-w-0">
                                      <div className="truncate font-semibold text-gray-900" title={file.name}>{file.name}</div>
                                      <div className="truncate font-mono text-[11px] text-gray-500" title={caminho}>{caminho}</div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          void copiarTextoSeguro(caminho);
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
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!conferenciaConcluida && !arquivada && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50/90 px-3.5 py-2.5 text-xs font-medium text-amber-950">
                    <span className="flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                      <span>
                        <strong>Aguardando conferência oficial:</strong> você pode editar, salvar rascunho e imprimir a manifestação normalmente, mas a ação <strong>“Finalizar e arquivar”</strong> será habilitada somente após a conferência ser concluída pelo Oficial ou Substituto (status <strong>CONFERIDO</strong>).
                      </span>
                    </span>
                  </div>
                )}
                {versaoAnteriorId && !arquivada && (
                  <div className="rounded-xl border border-[#CBD5E1] bg-[#F8F7F4] px-3.5 py-2.5 text-xs font-semibold text-[#1E293B]">
                    Correção de manifestação já arquivada: ao finalizar, será gravada uma nova versão e a anterior permanece intacta no Arquivo.
                  </div>
                )}
                {arquivada && (
                  <div
                    role="status"
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
                      alteradaAposArquivar ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {alteradaAposArquivar ? <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />}
                      <span>
                        Arquivado — Etapa 2 concluída em {new Date(arquivada.info.finalizadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                        {arquivada.info.finalizadoPorNome ? ` por ${arquivada.info.finalizadoPorNome}` : ''} (versão {arquivada.info.versao}).
                        {alteradaAposArquivar && ' O texto foi alterado depois do arquivamento: as alterações só ficam registradas se você finalizar uma nova versão.'}
                      </span>
                    </div>
                    <a
                      href={`/gestao-documental/arquivo?id=${encodeURIComponent(arquivada.info.id)}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400 bg-white px-3 py-1 text-xs font-bold text-emerald-900 shadow-2xs transition hover:bg-emerald-100"
                    >
                      <Archive className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                      <span>Consultar no Arquivo</span>
                    </a>
                  </div>
                )}

                {/* FOLHA A4 UNIFICADA E HÍBRIDA (EDIÇÃO DIRETA NO TEXTO) */}
                {renderFolhaManifestacaoHibrida()}
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

      {/* ── Modal: Consultar Rascunhos e Manifestações Salvas no FIORIX ── */}
      {modalRascunhosAberto && (
        <DialogoSobreposto
          titulo="📂 Rascunhos e Manifestações Salvos em Local Seguro no FIORIX"
          onFechar={() => setModalRascunhosAberto(false)}
          largura="max-w-4xl"
        >
          <div className="space-y-3 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-[#F8F7F4] p-2.5">
              <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5">
                <Search className="h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  value={buscaRascunhos}
                  onChange={e => setBuscaRascunhos(e.target.value)}
                  placeholder="Filtrar por nº do processo (com ou sem pontos), requerente, matrícula ou escrevente..."
                  className="w-full bg-transparent text-xs text-gray-900 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1">
                {([
                  ['TODOS', 'Todos'],
                  ['RASCUNHO', 'Rascunhos (Em Edição)'],
                  ['FINALIZADA', 'Finalizadas'],
                ] as const).map(([id, rotulo]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFiltroRascunhos(id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                      filtroRascunhos === id
                        ? 'bg-[#1E293B] text-white'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void carregarRascunhosDoFiorix()}
                  disabled={carregandoRascunhos}
                  className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                >
                  <RotateCcw className={`h-3 w-3 ${carregandoRascunhos ? 'animate-spin' : ''}`} />
                  <span>Atualizar</span>
                </button>
              </div>
            </div>

            {carregandoRascunhos ? (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin text-[#1E293B]" />
                <span>Consultando banco de dados seguro do FIORIX…</span>
              </div>
            ) : (
              (() => {
                const termoLimpo = buscaRascunhos.trim().toLowerCase();
                const termoDigitos = termoLimpo.replace(/[.\-\/\s]/g, '');
                const filtrados = listaRascunhosSalvos.filter(it => {
                  if (filtroRascunhos === 'RASCUNHO' && it.status !== 'conferencia') return false;
                  if (filtroRascunhos === 'FINALIZADA' && it.status !== 'finalizada') return false;
                  if (!termoLimpo) return true;
                  const alvo = [
                    it.numeroProcesso,
                    it.requerente,
                    it.matricula,
                    it.subdistrito,
                    it.escrevente,
                    it.dados?.numero_processo,
                    it.dados?.requerente,
                  ]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase();
                  if (alvo.includes(termoLimpo)) return true;
                  if (termoDigitos.length >= 3 && alvo.replace(/[.\-\/\s]/g, '').includes(termoDigitos)) return true;
                  return false;
                });

                if (filtrados.length === 0) {
                  return (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-gray-500">
                      Nenhum rascunho ou manifestação localizado para o filtro informado.
                    </div>
                  );
                }

                return (
                  <div className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
                    {filtrados.map(item => {
                      const ehRascunho = item.status === 'conferencia';
                      const minutaItem =
                        item.minuta ||
                        montarMinuta(
                          { ...criarDadosManifestacaoPadrao(), ...item.dados },
                          item.dados?.saudacao_juiz === 'MM. Juiz' ? 'MM. Juiz' : 'Meritíssima Juíza',
                        );
                      const infoItem =
                        item.status === 'finalizada' && item.finalizadoEm
                          ? {
                              id: item.id,
                              versao: item.versao,
                              hashSha256: item.hashSha256 || '',
                              finalizadoEm: item.finalizadoEm,
                              finalizadoPorNome: item.finalizadoPorNome,
                            }
                          : null;
                      const numProc = item.numeroProcesso || item.dados?.numero_processo || 'Processo sem número';

                      return (
                        <div
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-2xs hover:border-[#64748B]"
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded border border-gray-200 bg-[#F8F7F4] px-2 py-0.5 font-mono text-xs font-bold text-[#1E293B]">
                                {numProc}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  ehRascunho
                                    ? 'border border-amber-300 bg-amber-50 text-amber-900'
                                    : 'border border-emerald-300 bg-emerald-50 text-emerald-900'
                                }`}
                              >
                                {ehRascunho ? '📝 Rascunho / Em Conferência' : `✅ Finalizada (v${item.versao})`}
                              </span>
                              {item.subdistrito && (
                                <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                                  {item.subdistrito}
                                </span>
                              )}
                            </div>
                            <div className="truncate font-semibold text-gray-900">
                              {item.requerente || item.dados?.requerente || 'Interessado a definir'}
                            </div>
                            <div className="text-[11px] text-gray-500">
                              Matr./Transc.: <strong>{item.matricula || item.dados?.matricula_transcricao || '—'}</strong> • Escrevente:{' '}
                              <strong>{item.escrevente || item.dados?.escrevente_pasta || '—'}</strong> • Atualizado em{' '}
                              {new Date(item.updatedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                              {item.atualizadoPorNome || item.criadoPorNome
                                ? ` por ${item.atualizadoPorNome || item.criadoPorNome}`
                                : ''}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => carregarItemSalvoNoEditor(item)}
                              className="inline-flex items-center gap-1 rounded-lg bg-[#1E293B] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#334155] cursor-pointer"
                            >
                              <Edit3 className="h-3.5 w-3.5 text-[#B8A082]" />
                              <span>{ehRascunho ? 'Abrir e Editar Rascunho' : 'Abrir no Editor'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => baixarDocxManifestacao(minutaItem, infoItem, numProc)}
                              className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-900 hover:bg-blue-100 cursor-pointer"
                              title="Baixar arquivo Word (.docx)"
                            >
                              <FileText className="h-3.5 w-3.5 text-blue-700" />
                              <span>.DOCX</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => baixarDocManifestacao(minutaItem, infoItem, numProc)}
                              className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 bg-indigo-50 px-2.5 py-1.5 text-xs font-bold text-indigo-900 hover:bg-indigo-100 cursor-pointer"
                              title="Baixar arquivo Word (.doc)"
                            >
                              <FileText className="h-3.5 w-3.5 text-indigo-700" />
                              <span>.DOC</span>
                            </button>

                            <button
                              type="button"
                              onClick={async () => {
                                const { baixarPdfManifestacao } = await import('@/lib/pdf/generateManifestacaoPdf');
                                baixarPdfManifestacao(minutaItem, infoItem, numProc);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 cursor-pointer"
                              title="Baixar arquivo PDF"
                            >
                              <Download className="h-3.5 w-3.5" />
                              <span>PDF</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        </DialogoSobreposto>
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

      {/* ── Modal de confirmação da Finalização da Etapa 2 e Arquivamento ── */}
      {modalFinalizarAberto && (
        <DialogoSobreposto
          titulo="Finalizar Etapa 2 e arquivar"
          onFechar={() => {
            if (!finalizando) setModalFinalizarAberto(false);
          }}
          rodape={
            <>
              <button
                type="button"
                disabled={finalizando}
                onClick={() => setModalFinalizarAberto(false)}
                className="rounded-lg border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#64748B]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!confirmouImpressaoEtapa2 || finalizando}
                onClick={() => void executarFinalizacao()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1E293B] px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-[#334155] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B8A082]"
              >
                {finalizando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
                <span>{finalizando ? 'Arquivando…' : 'Finalizar e arquivar'}</span>
              </button>
            </>
          }
        >
          <div className="space-y-3 text-sm leading-relaxed text-gray-700">
            <p>
              Confirme que a manifestação foi impressa. Após finalizar, o procedimento sairá de Em Conferência e ficará disponível no Arquivo.
            </p>
            <label
              htmlFor="chk-confirmar-impressao-manifestacao"
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[#CBD5E1] bg-[#F8F7F4] p-3 text-sm font-semibold text-[#1E293B] hover:bg-gray-100"
            >
              <input
                id="chk-confirmar-impressao-manifestacao"
                type="checkbox"
                checked={confirmouImpressaoEtapa2}
                onChange={e => setConfirmouImpressaoEtapa2(e.target.checked)}
                disabled={finalizando}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-400 text-[#1E293B] focus:ring-[#1E293B]"
              />
              <span>Confirmo que a manifestação foi impressa</span>
            </label>
            {pendenciasAtivas.length > 0 && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Há {pendenciasAtivas.length} pendência(s) de revisão em aberto. Confira antes de finalizar.
              </p>
            )}
            {erroFinalizacaoModal && (
              <p role="alert" className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
                {erroFinalizacaoModal}
              </p>
            )}
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
  negrito?: boolean;
  sublinhado?: boolean;
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
  assinatura: { titulo?: string; nome: string; cargo: string };
  corpoTextoLivre?: string | null;
}

export function montarMinuta(d: DadosManifestacao, saudacao?: string): MinutaModelo {
  const matricula = d.matricula_transcricao || '_____';
  const cartorioEncaminhamento = d.cartorio_encaminhamento || d.cartorio_origem || '3º Oficial de Registro de Imóveis da Capital';
  const saudacaoBase = (d.saudacao_juiz || saudacao || 'Meritíssima Juíza').trim().replace(/:+$/, '');
  const varaTexto = d.vara
    ? /vara/i.test(d.vara)
      ? d.vara.trim().startsWith('E.')
        ? d.vara.trim()
        : `E. ${d.vara.trim()}`
      : `E. ${d.vara.trim()} Vara de Registros Públicos da Capital.`
    : 'E. 1ª Vara de Registros Públicos da Capital.';

  const p1Padrao: Segmento[] = [
    {
      t: `Em atenção ao r. despacho de fls. ${d.fls_inicial || '05/06'} e ${d.fls_laudo || '35/46'}, cumpre-me informar a V. Exa. que, revendo os livros de transcrições das transmissões, bem assim as fichas do Livro nº 2 – Registro Geral, deste Cartório, procedendo às buscas no Indicador Real e no Índice de Contribuintes da Prefeitura do Município de São Paulo, pelo contribuinte nº ${d.contribuinte_sql || '___________'}, as mesmas resultaram `,
    },
    { t: (d.resultado_buscas || 'NEGATIVAS').toUpperCase(), destaque: true },
    { t: '.' },
  ];

  const p2Padrao: Segmento[] = [
    { t: 'Segundo elementos constantes dos autos, o imóvel usucapiendo encontra-se transcrito em nome de ' },
    { t: d.titular_origem || 'TITULAR A CONFERIR', destaque: true },
    { t: ', sob nº ' },
    { t: matricula, destaque: true },
    {
      t: ` do ${d.cartorio_origem || '3º Oficial de Registro de Imóveis da Capital'}, conforme certidão de fls. ${d.fls_certidao_origem || '30/32'}.`,
    },
  ];

  const pCompetenciaPadrao: Segmento[] = [
    {
      t: `Informo, outrossim, que a área em apreço passou a pertencer a esta Serventia a partir de ${d.data_competencia_subdistrito || '23 de dezembro de 1.938'}, por força do Decreto Estadual nº 9.775, de 30 de novembro de 1.938.`,
    },
  ];

  const pContribuintePadrao: Segmento[] = [
    {
      t: `Cumpre salientar que não consta expressamente averbada na(s) matrícula(s) / transcrição(ões) encontrada(s) a inscrição do contribuinte municipal nº `,
    },
    {
      t: d.contribuinte_sql || '___________',
      destaque: true,
    },
    {
      t: `, sendo indispensável que a correlação entre o lançamento fiscal e o fólio real decorra de confirmação pericial no local por perito nomeado por esse D. Juízo ou juntada de Certidão de Dados Cadastrais da Prefeitura do Município de São Paulo (PMSP).`,
    },
  ];

  const pAnexosPadrao: Segmento[] = [
    {
      t:
        d.transcricoes_anexas || d.matriculas_anexas
          ? `Encaminho cópia da planta do Setor Fiscal Municipal, certidões das transcrições nºs ${d.transcricoes_anexas || '—'} e matrículas nºs ${d.matriculas_anexas || '—'}, para que acompanhe a presente.`
          : 'Encaminho cópia da planta do Setor Fiscal Municipal, para que acompanhe a presente.',
    },
  ];

  const pEncaminhamentoPadrao: Segmento[] = obterSegmentosFinalizacaoPorModelo(d);

  const pFechoPadrao: Segmento[] = [{ t: 'Era o que, respeitosamente, cumpria informar a V. Exa.' }];

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
      vara: varaTexto,
      interessadosRotulo: 'INTERESSADOS:',
      interessadosValor: (d.requerente || 'A IDENTIFICAR').toUpperCase(),
      natureza: d.natureza_processo?.trim() || 'USUCAPIÃO',
    },
    saudacao: `${saudacaoBase}:`,
    paragrafosAntes: [
      d.paragrafo_1_custom?.trim() ? [{ t: d.paragrafo_1_custom.trim() }] : p1Padrao,
      d.paragrafo_2_custom?.trim() ? [{ t: d.paragrafo_2_custom.trim() }] : p2Padrao,
    ],
    introConfrontacoes:
      d.intro_confrontacoes_custom?.trim() ||
      'Pela planta do Setor Fiscal Municipal do imóvel usucapiendo, verifica-se que o mesmo confronta:',
    confrontacoes: [
      { campo: 'confrontante_lado_direito', rotulo: '– pelo lado direito com', valor: d.confrontante_lado_direito || TEXTO_CONFRONTACAO_PADRAO, pontuacao: ';' },
      { campo: 'confrontante_lado_esquerdo', rotulo: '– pelo lado esquerdo com', valor: d.confrontante_lado_esquerdo || TEXTO_CONFRONTACAO_PADRAO, pontuacao: ';' },
      { campo: 'confrontante_fundos', rotulo: '– e aos fundos com', valor: d.confrontante_fundos || TEXTO_CONFRONTACAO_PADRAO, pontuacao: '.' },
    ],
    paragrafosDepois: [
      d.paragrafo_competencia_custom?.trim() ? [{ t: d.paragrafo_competencia_custom.trim() }] : pCompetenciaPadrao,
      ...(d.contribuinte_nao_averbado !== false && d.contribuinte_sql
        ? [d.paragrafo_contribuinte_custom?.trim() ? [{ t: d.paragrafo_contribuinte_custom.trim() }] : pContribuintePadrao]
        : []),
      d.paragrafo_anexos_custom?.trim() ? [{ t: d.paragrafo_anexos_custom.trim() }] : pAnexosPadrao,
      ...(d.paragrafo_extra_custom?.trim() ? [[{ t: d.paragrafo_extra_custom.trim() }]] : []),
      d.paragrafo_encaminhamento_custom?.trim() ? [{ t: d.paragrafo_encaminhamento_custom.trim() }] : pEncaminhamentoPadrao,
      ...(d.incluir_fecho_cortesia || d.paragrafo_fecho_custom?.trim()
        ? [d.paragrafo_fecho_custom?.trim() ? [{ t: d.paragrafo_fecho_custom.trim() }] : pFechoPadrao]
        : []),
    ],
    local: d.local_data_manifestacao?.trim() || `São Paulo, ${obterDataPorExtenso()}.`,
    assinatura: {
      titulo: d.assinatura_titulo?.trim() || 'O Oficial,',
      nome: d.assinatura_nome?.trim() || 'Ademar Fioranelli',
      cargo: d.assinatura_cargo?.trim() || '7º Oficial de Registro de Imóveis da Capital – SP',
    },
    corpoTextoLivre:
      d.modo_edicao_manifestacao === 'texto_livre' && d.corpo_livre_manifestacao?.trim()
        ? d.corpo_livre_manifestacao.trim()
        : null,
  };
}

function textoSegmentos(segs: Segmento[]): string {
  return segs.map(s => s.t).join('');
}

export function gerarTextoCorpoPadrao(m: MinutaModelo): string {
  const linhas: string[] = [];
  m.paragrafosAntes.forEach(p => linhas.push(textoSegmentos(p), ''));
  linhas.push(m.introConfrontacoes);
  m.confrontacoes.forEach(c => linhas.push(`${c.rotulo} ${c.valor}${c.pontuacao}`));
  linhas.push('');
  m.paragrafosDepois.forEach(p => linhas.push(textoSegmentos(p), ''));
  return linhas.join('\n').trim();
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
  if (m.corpoTextoLivre?.trim()) {
    linhas.push(m.corpoTextoLivre.trim(), '');
  } else {
    m.paragrafosAntes.forEach(p => linhas.push(textoSegmentos(p), ''));
    linhas.push(m.introConfrontacoes);
    m.confrontacoes.forEach(c => linhas.push(`${c.rotulo} ${c.valor}${c.pontuacao}`));
    linhas.push('');
    m.paragrafosDepois.forEach(p => linhas.push(textoSegmentos(p), ''));
  }
  linhas.push(
    m.local,
    '',
    m.assinatura.titulo || 'O Oficial,',
    '___________________________________',
    m.assinatura.nome,
    m.assinatura.cargo,
  );
  return linhas.join('\n');
}

function Segmentos({ segmentos }: { segmentos: Segmento[] }) {
  return (
    <>
      {segmentos.map((s, i) => {
        const bold = Boolean(s.negrito ?? s.destaque);
        const under = Boolean(s.sublinhado ?? s.destaque);
        if (bold && under) return <span key={i} className="font-bold underline">{s.t}</span>;
        if (bold) return <strong key={i} className="font-bold">{s.t}</strong>;
        if (under) return <span key={i} className="underline">{s.t}</span>;
        return <React.Fragment key={i}>{s.t}</React.Fragment>;
      })}
    </>
  );
}
