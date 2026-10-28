'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  Printer,
  FileText,
  Building2,
  CheckCircle2,
  SlidersHorizontal,
  ChevronRight,
  ShieldCheck,
  Scale,
  Sparkles,
  Download,
  Maximize2,
  Minimize2,
  RotateCw,
  HelpCircle,
  Info,
  Search,
  Image as ImageIcon,
  Loader2,
  Check,
  Wand2,
} from 'lucide-react';
import { ConfidenceReview, OrigemCampoUI } from './ConfidenceReview';
import { ValidacaoAutenticidadeView } from './ValidacaoAutenticidadeView';
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

export function FichaOficialView({
  dadosIniciais,
  connectorId,
  arquivoOrigem,
  onClose,
  onReextrair,
  onBuscarMatriculaNaLista,
  onVisualizarDocumento,
}: {
  dadosIniciais: DadosManifestacao;
  connectorId?: string;
  arquivoOrigem?: { name: string; relativePath: string; rootId?: string } | null;
  onClose: () => void;
  onReextrair?: () => void;
  onBuscarMatriculaNaLista?: (matricula: string) => void;
  onVisualizarDocumento?: (file: Livro2Match) => void;
}) {
  // Inicialização inteligente: se a inferência do OCR identificou um subdistrito, escrevente, cartório ou confrontações, preenche automaticamente
  const [dados, setDados] = useState<DadosManifestacao>(() => {
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
  });

  const [toastSugestao, setToastSugestao] = useState<string | null>(null);
  const [lendoMatriculaConfrontacoes, setLendoMatriculaConfrontacoes] = useState(false);

  // Calcula sugestões em tempo real com base no estado atual
  const sugestoes = useMemo(() => {
    return inferirSugestoesInteligentes(dados, arquivoOrigem);
  }, [dados, arquivoOrigem]);

  const reaplicarSugestoes = () => {
    const sug = inferirSugestoesInteligentes(dados, arquivoOrigem);
    setDados(prev => ({
      ...prev,
      subdistrito: sug.subdistrito.valor,
      data_competencia_subdistrito: sug.dataCompetencia,
      cartorio_encaminhamento: sug.cartorioEncaminhamento.valor,
      cartorio_origem: sug.cartorioEncaminhamento.valor,
      resultado_buscas: sug.resultadoBuscas.valor,
      escrevente_pasta: sug.escrevente.valor,
      confrontante_lado_direito: sug.confrontacoes.ladoDireito || prev.confrontante_lado_direito,
      confrontante_lado_esquerdo: sug.confrontacoes.ladoEsquerdo || prev.confrontante_lado_esquerdo,
      confrontante_fundos: sug.confrontacoes.fundos || prev.confrontante_fundos,
    }));
    const confMsg = sug.confrontacoes.ladoDireito || sug.confrontacoes.ladoEsquerdo || sug.confrontacoes.fundos
      ? ` • Confrontações Atualizadas (D: ${sug.confrontacoes.ladoDireito || '—'} | E: ${sug.confrontacoes.ladoEsquerdo || '—'} | F: ${sug.confrontacoes.fundos || '—'})`
      : '';
    setToastSugestao(`Sugestões aplicadas: Subdistrito ${sug.subdistrito.valor} • Remessa ${sug.cartorioEncaminhamento.valor} • Buscas ${sug.resultadoBuscas.valor} • Escrevente ${sug.escrevente.valor}${confMsg}`);
    setTimeout(() => setToastSugestao(null), 6000);
  };

  async function lerMatriculaEPreencherConfrontacoes(fileAlvo?: Livro2Match) {
    setLendoMatriculaConfrontacoes(true);
    try {
      let textoParaAnalise = [
        dados.imovel,
        dados.rua_olhar_confrontacao,
        dados.anotacoes_ficha_oficial,
        ...(dados.origem_campos || []).map(o => o.trecho || ''),
      ].filter(Boolean).join('\n');

      let nomeFonte = 'Autos do Processo';

      const arquivoParaLer = fileAlvo || (arquivosLivro2 && arquivosLivro2.length > 0 ? arquivosLivro2[0] : null);

      if (arquivoParaLer) {
        nomeFonte = `Matrícula ${arquivoParaLer.name}`;
        const response = await fetch('/api/gestao-documental', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectorId: connectorId || '',
            type: 'read_document_text',
            rootId: arquivoParaLer.rootId,
            relativePath: arquivoParaLer.relativePath,
          }),
        });
        const body = await response.json();
        if (response.ok && body.id) {
          const deadline = Date.now() + 30000;
          while (Date.now() < deadline) {
            await new Promise(r => setTimeout(r, 600));
            const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
            const state = await res.json();
            if (state.status === 'complete' && state.result?.text) {
              textoParaAnalise = state.result.text + '\n' + textoParaAnalise;
              break;
            }
            if (state.status === 'failed') break;
          }
        }
      }

      const conf = extrairConfrontacoes(textoParaAnalise);

      if (conf.ladoDireito || conf.ladoEsquerdo || conf.fundos) {
        setDados(prev => ({
          ...prev,
          confrontante_lado_direito: conf.ladoDireito || prev.confrontante_lado_direito,
          confrontante_lado_esquerdo: conf.ladoEsquerdo || prev.confrontante_lado_esquerdo,
          confrontante_fundos: conf.fundos || prev.confrontante_fundos,
        }));
        setToastSugestao(`✨ Confrontações extraídas com sucesso (${nomeFonte}): D: ${conf.ladoDireito || '—'} | E: ${conf.ladoEsquerdo || '—'} | Fundos: ${conf.fundos || '—'}`);
        setTimeout(() => setToastSugestao(null), 6000);
      } else {
        setToastSugestao('Nenhuma confrontação identificável foi localizada no texto. Você pode preencher diretamente nos campos pontilhados.');
        setTimeout(() => setToastSugestao(null), 5000);
      }
    } catch {
      setToastSugestao('Erro ao ler a matrícula para extração de confrontações.');
      setTimeout(() => setToastSugestao(null), 4000);
    } finally {
      setLendoMatriculaConfrontacoes(false);
    }
  }

  const [abaAtiva, setAbaAtiva] = useState<'formulario' | 'manifestacao' | 'origem' | 'autenticidade'>('formulario');
  const [saudacaoJuiz, setSaudacaoJuiz] = useState<'Meritíssima Juíza' | 'MM. Juiz'>('Meritíssima Juíza');
  const [copiado, setCopiado] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [mostrarGuiaCards, setMostrarGuiaCards] = useState(false);

  // Estados da Busca de Imagem no Livro 2 (K:\IMAGENS\LV2)
  const [buscandoLivro2, setBuscandoLivro2] = useState(false);
  const [arquivosLivro2, setArquivosLivro2] = useState<Livro2Match[] | null>(null);
  const [termoBuscadoLivro2, setTermoBuscadoLivro2] = useState<string | null>(null);
  const [caminhoCopiadoLivro2, setCaminhoCopiadoLivro2] = useState<string | null>(null);
  const [erroLivro2, setErroLivro2] = useState<string | null>(null);

  async function localizarNoLivro2(matriculaCustom?: string) {
    const raw = matriculaCustom || dados.matricula_transcricao || '';
    const numeros = raw.replace(/[^\d]/g, '');
    const queryBusca = numeros && numeros.length >= 2 ? numeros : raw.trim();

    if (!queryBusca || queryBusca.length < 2) {
      setErroLivro2('Informe ou extraia ao menos 2 dígitos da matrícula para pesquisar.');
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
      if (!response.ok) throw new Error(body.error);

      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 800));
        const res = await fetch('/api/gestao-documental?id=' + encodeURIComponent(body.id), { cache: 'no-store' });
        const state = await res.json();
        if (!res.ok) throw new Error(state.error);
        if (state.status === 'complete' && state.result) {
          const files: Livro2Match[] = state.result.files || [];
          const imagensLv2 = files.filter(f =>
            f.rootId.toLowerCase().includes('imagem') ||
            f.relativePath.toLowerCase().includes('lv2') ||
            f.relativePath.toLowerCase().includes('imagem')
          );
          setArquivosLivro2(imagensLv2.length > 0 ? imagensLv2 : files);
          return;
        }
        if (state.status === 'failed') throw new Error('Falha na busca da matrícula no servidor local.');
      }
      throw new Error('Tempo limite excedido na busca do Livro 2.');
    } catch (err) {
      setErroLivro2(err instanceof Error ? err.message : 'Falha ao buscar matrícula em K:\\IMAGENS\\LV2.');
    } finally {
      setBuscandoLivro2(false);
    }
  }

  const atualizarCampo = (campo: keyof DadosManifestacao, valor: any) => {
    setDados(prev => {
      const atualizado = { ...prev, [campo]: valor };
      if (campo === 'subdistrito') {
        const achado = SUBDISTRITOS_7RI.find(s => s.nome.toUpperCase() === String(valor).toUpperCase());
        if (achado) {
          atualizado.cartorio_origem = achado.cartorioSugerido;
          atualizado.cartorio_encaminhamento = achado.cartorioSugerido;
          atualizado.data_competencia_subdistrito = achado.competencia;
        }
      }
      return atualizado;
    });
  };

  const copiarManifestacao = () => {
    const dataExtenso = obterDataPorExtenso();
    const texto = `OFICIAL
7 • SÉTIMO
DE REGISTRO DE IMÓVEIS
Fone: 3218-0527 - R. Augusta, 356 / Consolação - Cep: 01304-000 - São Paulo - SP
____________________________________________________________________________________

PROCESSO DIGITAL nº ${dados.numero_processo || '____________________'}
E. ${dados.vara || '1ª'} Vara de Registros Públicos da Capital.
INTERESSADOS: ${(dados.requerente || 'A IDENTIFICAR').toUpperCase()}
USUCAPIÃO

${saudacaoJuiz}:

Em atenção ao r. despacho de fls. ${dados.fls_inicial || '05/06'} e ${dados.fls_laudo || '35/46'}, cumpre-me informar a V. Exa. que, revendo os livros de transcrições das transmissões, bem assim as fichas do Livro nº 2 – Registro Geral, deste Cartório, procedendo às buscas no Indicador Real e no Índice de Contribuintes da Prefeitura do Município de São Paulo, pelo contribuinte nº ${dados.contribuinte_sql || '___________'}, as mesmas resultaram ${(dados.resultado_buscas || 'NEGATIVAS').toUpperCase()}.

Segundo elementos constantes dos autos, o imóvel usucapiendo encontra-se transcrito em nome de ${dados.titular_origem || 'TITULAR A CONFERIR'}, sob nº ${dados.matricula_transcricao || '_____'} do ${dados.cartorio_origem || '3º Oficial de Registro de Imóveis da Capital'}, conforme certidão de fls. ${dados.fls_certidao_origem || '30/32'}.

Pela planta do Setor Fiscal Municipal do imóvel usucapiendo, verifica-se que o mesmo confronta:
- pelo lado direito com ${dados.confrontante_lado_direito || 'conforme apuração nos autos'};
- pelo lado esquerdo com ${dados.confrontante_lado_esquerdo || 'conforme apuração nos autos'};
- e aos fundos com ${dados.confrontante_fundos || 'conforme apuração nos autos'}.

Informo, outrossim, que a área em apreço passou a pertencer a esta Serventia a partir de ${dados.data_competencia_subdistrito || '23 de dezembro de 1.938'}, por força do Decreto Estadual nº 9.775, de 30 de novembro de 1.938.

${dados.transcricoes_anexas || dados.matriculas_anexas ? `Encaminho cópia da planta de Setor Fiscal Municipal, certidões das transcrições nºs ${dados.transcricoes_anexas || '—'} e matrículas nºs ${dados.matriculas_anexas || '—'}, para que acompanhe a presente.` : 'Encaminho cópia da planta de Setor Fiscal Municipal, para que acompanhe a presente.'}

Com a vênia devida, sugiro o encaminhamento dos presentes autos ao digno ${dados.cartorio_encaminhamento || dados.cartorio_origem || '3º Oficial de Registro de Imóveis da Capital'}, tendo em vista a transcrição de origem nº ${dados.matricula_transcricao || '_____'}.

Era o que, respeitosamente, cumpria informar a V. Exa.

São Paulo, ${dataExtenso}.

___________________________________
Ademar Fioranelli
7º Oficial de Registro de Imóveis da Capital – SP`;

    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const imprimirFicha = () => {
    window.print();
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2 sm:p-4 md:p-6 backdrop-blur-md overflow-y-auto">
      <div className={`relative my-auto flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden transition-all duration-200 ${
        isMaximized
          ? 'fixed inset-2 sm:inset-3 w-[calc(100vw-1rem)] sm:w-[calc(100vw-1.5rem)] h-[calc(100vh-1rem)] sm:h-[calc(100vh-1.5rem)] max-w-none max-h-none z-[110]'
          : 'max-h-[94vh] w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl'
      }`}>
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-950 px-4 sm:px-6 py-3 sm:py-3.5 gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/60 shrink-0">
              <Scale className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-cyan-950 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-cyan-400 border border-cyan-800/60">
                  7º RI DE SÃO PAULO
                </span>
                <span className="text-xs sm:text-sm text-slate-400">Processo:</span>
                <span className="font-mono text-xs sm:text-sm font-semibold text-slate-200">
                  {dados.numero_processo || 'Não informado'}
                </span>
              </div>
              <h3 className="text-base sm:text-lg xl:text-xl font-semibold text-slate-100">
                Ficha de Conferência do Oficial & Minuta de Manifestação
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onReextrair && (
              <button
                onClick={onReextrair}
                title="Forçar nova extração da petição no servidor local (descartar cache e atualizar dados)"
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/60 bg-amber-950/40 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-amber-300 hover:bg-amber-900/60 hover:text-amber-200 transition shrink-0"
              >
                <RotateCw className="h-4 w-4" />
                <span className="hidden sm:inline">Re-extrair Dados</span>
              </button>
            )}

            <button
              onClick={copiarManifestacao}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-700 transition shrink-0"
            >
              {copiado ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar Minuta
                </>
              )}
            </button>

            <button
              onClick={imprimirFicha}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-700 transition shrink-0"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>

            <button
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Restaurar tamanho' : 'Maximizar tela'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-800/60 bg-cyan-950/60 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium text-cyan-300 hover:bg-cyan-900 transition shrink-0"
            >
              {isMaximized ? (
                <>
                  <Minimize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Restaurar</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Maximizar</span>
                </>
              )}
            </button>

            <button
              onClick={onClose}
              className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition shrink-0"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs (Always Visible, shrink-0, Clean Tabs) */}
        <div className="flex items-center gap-2 border-b border-slate-700/80 bg-slate-950 px-4 sm:px-6 pt-2 pb-0 overflow-x-auto shrink-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setAbaAtiva('formulario')}
            className={`flex items-center gap-2 rounded-t-xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm xl:text-base font-bold transition border-b-2 whitespace-nowrap shrink-0 ${
              abaAtiva === 'formulario'
                ? 'border-cyan-400 bg-slate-800 text-white shadow-sm'
                : 'border-transparent text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <FileText className="h-4 w-4 text-cyan-400" />
            <span>Ficha de Conferência (Formulário)</span>
          </button>

          <button
            onClick={() => setAbaAtiva('manifestacao')}
            className={`flex items-center gap-2 rounded-t-xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm xl:text-base font-bold transition border-b-2 whitespace-nowrap shrink-0 ${
              abaAtiva === 'manifestacao'
                ? 'border-cyan-400 bg-slate-800 text-white shadow-sm'
                : 'border-transparent text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Building2 className="h-4 w-4 text-cyan-400" />
            <span>Minuta de Manifestação Judicial</span>
          </button>

          <button
            onClick={() => setAbaAtiva('origem')}
            className={`flex items-center gap-2 rounded-t-xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm xl:text-base font-bold transition border-b-2 whitespace-nowrap shrink-0 ${
              abaAtiva === 'origem'
                ? 'border-cyan-400 bg-slate-800 text-white shadow-sm'
                : 'border-transparent text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span>Origem & Confiança</span>
            <span className="rounded-full bg-cyan-950 border border-cyan-800 px-2 py-0.5 text-xs text-cyan-300 font-bold">
              {dados.origem_campos?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setAbaAtiva('autenticidade')}
            className={`flex items-center gap-2 rounded-t-xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm xl:text-base font-bold transition border-b-2 whitespace-nowrap shrink-0 ${
              abaAtiva === 'autenticidade'
                ? 'border-emerald-400 bg-slate-800 text-white shadow-sm'
                : 'border-transparent text-slate-300 hover:bg-slate-900 hover:text-white'
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Validação de Autenticidade (APIs Oficiais)</span>
            <span className="rounded-full bg-emerald-950 border border-emerald-800 px-2 py-0.5 text-xs text-emerald-300 font-bold">
              TJSP • PMSP • ONR • ICP
            </span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5">
          {/* Header da Barra de Edição com Ações de Sugestão Automática e Ajuda */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>Barra de Despacho & Competência Registral</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800/80 text-[11px] font-medium text-cyan-300">
                <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                <span>Preenchimento Sugerido via OCR / Matrícula</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAbaAtiva('autenticidade')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-900/60 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 transition shadow-sm"
                title="Consultar validação e baixar comprovantes emitidos perante as APIs oficiais dos órgãos"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Comprovantes de Autenticidade</span>
              </button>

              <button
                type="button"
                onClick={reaplicarSugestoes}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-950/40 hover:bg-cyan-900/60 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 transition shadow-sm"
                title="Reavaliar o endereço e os dados do processo e reaplicar as sugestões inteligentes"
              >
                <Wand2 className="h-3.5 w-3.5 text-cyan-400" />
                <span>Reaplicar Sugestões do OCR</span>
              </button>

              <button
                type="button"
                onClick={() => setMostrarGuiaCards(!mostrarGuiaCards)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
              >
                <HelpCircle className="h-3.5 w-3.5 text-slate-400" />
                <span>{mostrarGuiaCards ? 'Ocultar guia' : 'Para que servem estes 4 cards?'}</span>
              </button>
            </div>
          </div>

          {toastSugestao && (
            <div className="rounded-xl border border-emerald-500/50 bg-emerald-950/60 p-3 text-xs text-emerald-200 flex items-center justify-between shadow-md animate-in fade-in duration-200">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{toastSugestao}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastSugestao(null)}
                className="text-emerald-400 hover:text-emerald-100 font-bold px-1.5 py-0.5 rounded"
              >
                ✕
              </button>
            </div>
          )}

          {mostrarGuiaCards && (
            <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/40 p-4 text-xs text-slate-300 space-y-2.5 animate-in slide-in-from-top-1 duration-200 shadow-md">
              <div className="flex items-center gap-2 font-semibold text-cyan-200 text-xs sm:text-sm">
                <Info className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>Guia Prático da Barra de Despacho (Padrão 7º RI de São Paulo)</span>
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-[12px] leading-relaxed">
                <li className="rounded-lg bg-slate-900/80 border border-slate-800 p-2.5">
                  <strong className="text-slate-100 block mb-0.5">1. Escrevente Responsável:</strong>
                  Identifica o escrevente que fez a análise do processo, planta e certidões, vinculando a autoria funcional do exame.
                </li>
                <li className="rounded-lg bg-slate-900/80 border border-slate-800 p-2.5">
                  <strong className="text-cyan-200 block mb-0.5">2. Subdistrito Territorial:</strong>
                  Cada subdistrito da Capital tem uma data de competência histórica territorial (ex.: Alto da Moóca = 23/12/1938). O sistema preenche essa data automaticamente na manifestação.
                </li>
                <li className="rounded-lg bg-slate-900/80 border border-slate-800 p-2.5">
                  <strong className="text-amber-200 block mb-0.5">3. Resultado das Buscas:</strong>
                  Indica se o imóvel tem matrícula ativa nesta 7ª Circunscrição (POSITIVAS) ou se não há registro local (NEGATIVAS). Isso altera a redação jurídica enviada ao Magistrado.
                </li>
                <li className="rounded-lg bg-slate-900/80 border border-slate-800 p-2.5">
                  <strong className="text-sky-200 block mb-0.5">4. Cartório de Encaminhamento:</strong>
                  Quando as buscas apontam que a transcrição de origem pertence a outra serventia anterior (ex.: 3º RI), sugere formalmente ao Juiz a remessa dos autos àquele cartório.
                </li>
              </ul>
            </div>
          )}

          {/* Quick Edit Bar com Sugestões Inteligentes do OCR / Matrícula */}
          <div className="grid grid-cols-1 gap-3.5 rounded-xl border border-slate-700 bg-slate-950 p-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-4 text-xs sm:text-sm shadow-md">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-200 font-semibold text-xs sm:text-sm">Escrevente Responsável</label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Sugerido
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                    Autoria
                  </span>
                </div>
              </div>
              <select
                value={dados.escrevente_pasta}
                onChange={e => atualizarCampo('escrevente_pasta', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs sm:text-sm font-medium text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:outline-none"
              >
                {ESCREVENTES_USUCAPIAO.map(e => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                Identifica o escrevente responsável pelo exame formal dos autos.
              </p>
              <div className="mt-1 flex items-start gap-1 text-[10.5px] text-cyan-300/90 font-mono leading-tight">
                <Sparkles className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                <span>{sugestoes.escrevente.motivo}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-200 font-semibold text-xs sm:text-sm">Subdistrito Territorial</label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Sugerido
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                    Competência
                  </span>
                </div>
              </div>
              <select
                value={dados.subdistrito}
                onChange={e => atualizarCampo('subdistrito', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs sm:text-sm font-medium text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:outline-none"
              >
                {SUBDISTRITOS_7RI.map(s => (
                  <option key={s.nome} value={s.nome}>
                    {s.nome}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                Define e preenche a data de competência histórica registral.
              </p>
              <div className="mt-1 flex items-start gap-1 text-[10.5px] text-cyan-300/90 font-mono leading-tight">
                <Sparkles className="w-3 h-3 text-cyan-400 shrink-0 mt-0.5" />
                <span>{sugestoes.subdistrito.motivo}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-200 font-semibold text-xs sm:text-sm">Resultado das Buscas</label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Sugerido
                  </span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
                    Indicadores
                  </span>
                </div>
              </div>
              <select
                value={dados.resultado_buscas}
                onChange={e => atualizarCampo('resultado_buscas', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs sm:text-sm font-medium text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:outline-none"
              >
                <option value="NEGATIVAS">NEGATIVAS</option>
                <option value="POSITIVAS">POSITIVAS</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                Pesquisa no Indicador Real (SQL) e Pessoal. Altera o texto do ofício judicial.
              </p>
              <div className="mt-1 flex items-start gap-1 text-[10.5px] text-amber-300/90 font-mono leading-tight">
                <Sparkles className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                <span>{sugestoes.resultadoBuscas.motivo}</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-200 font-semibold text-xs sm:text-sm">Cartório de Encaminhamento</label>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 border border-sky-800/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Sugerido
                  </span>
                  <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 border border-sky-800/60 px-1.5 py-0.5 rounded">
                    Remessa
                  </span>
                </div>
              </div>
              <input
                type="text"
                value={dados.cartorio_encaminhamento}
                onChange={e => atualizarCampo('cartorio_encaminhamento', e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs sm:text-sm font-medium text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1.5 leading-snug">
                Serventia indicada ao Juiz para validar a transcrição de origem.
              </p>
              <div className="mt-1 flex items-start gap-1 text-[10.5px] text-sky-300/90 font-mono leading-tight">
                <Sparkles className="w-3 h-3 text-sky-400 shrink-0 mt-0.5" />
                <span>{sugestoes.cartorioEncaminhamento.motivo}</span>
              </div>
            </div>
          </div>

          {/* Tab 1: Ficha de Conferência (Formulário Clássico) */}
          {abaAtiva === 'formulario' && (
            <div className="rounded-xl border border-slate-700 bg-white p-6 sm:p-8 xl:p-12 text-black shadow-lg">
              {/* Header Clássico */}
              <div className="text-center border-b-2 border-black pb-3 sm:pb-4 mb-4 sm:mb-6">
                <h2 className="text-lg sm:text-xl xl:text-2xl 2xl:text-3xl font-bold tracking-wider uppercase font-serif">
                  7º Cartório de Registro de Imóveis
                </h2>
                <div className="text-xs sm:text-sm xl:text-base italic">Comarca da Capital</div>
                <div className="text-xs sm:text-sm xl:text-base font-bold tracking-widest mt-1">OFICIAL ADEMAR FIORANELLI</div>
              </div>

              {/* Informações Processuais */}
              <div className="text-xs sm:text-sm xl:text-base space-y-2.5 sm:space-y-3 border-b border-black pb-3 sm:pb-5 mb-4 sm:mb-6 font-serif">
                <div className="flex flex-wrap justify-between gap-2 border-b border-dotted border-gray-400 pb-1.5">
                  <span>
                    <strong>Buscas feitas em:</strong> {dados.buscas_feitas_em || '___/___/______'}
                  </span>
                  <span>
                    <strong>Processo:</strong> {dados.tipo_processo} &nbsp;|&nbsp;{' '}
                    <strong>Número:</strong> {dados.numero_processo || '____________________'}
                  </span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 border-b border-dotted border-gray-400 pb-1.5">
                  <span>
                    <strong>{dados.vara || '____'} Vara</strong> de Registros Públicos da Capital
                  </span>
                  <span>
                    <strong>Chegada em:</strong> {dados.data_chegada || '___/___/______'}
                  </span>
                </div>
              </div>

              {/* Requerente */}
              <div className="mb-3.5 sm:mb-5 text-xs sm:text-sm xl:text-base font-serif">
                <div className="font-bold text-slate-900 mb-1">Requerente:</div>
                <input
                  type="text"
                  value={dados.requerente}
                  onChange={e => atualizarCampo('requerente', e.target.value)}
                  className="w-full bg-transparent text-slate-950 font-bold border-b-2 border-dotted border-slate-400 hover:border-slate-800 py-1.5 sm:py-2 font-sans text-xs sm:text-sm xl:text-base focus:bg-amber-100/70 focus:outline-none px-1.5 transition"
                />
              </div>

              {/* Imóvel e SQL */}
              <div className="mb-3.5 sm:mb-5 text-xs sm:text-sm xl:text-base font-serif">
                <div className="font-bold text-slate-900 mb-1">Imóvel:</div>
                <input
                  type="text"
                  value={dados.imovel}
                  onChange={e => atualizarCampo('imovel', e.target.value)}
                  className="w-full bg-transparent text-slate-950 font-bold border-b-2 border-dotted border-slate-400 hover:border-slate-800 py-1.5 sm:py-2 font-sans text-xs sm:text-sm xl:text-base focus:bg-amber-100/70 focus:outline-none px-1.5 transition"
                />
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="font-bold text-slate-900">SQL / IPTU:</span>
                  <input
                    type="text"
                    value={dados.contribuinte_sql}
                    onChange={e => atualizarCampo('contribuinte_sql', e.target.value)}
                    className="bg-transparent text-slate-950 font-mono font-bold border-b-2 border-dotted border-slate-400 hover:border-slate-800 py-1 sm:py-1.5 text-xs sm:text-sm xl:text-base focus:bg-amber-100/70 focus:outline-none px-1.5 transition w-56 sm:w-72"
                  />
                </div>
              </div>

              {/* Matrícula e Titular */}
              <div className="mb-4 sm:mb-6 text-xs sm:text-sm xl:text-base font-serif">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="font-bold text-slate-900">Matrícula / Transcrição de Origem:</div>
                  <button
                    type="button"
                    disabled={buscandoLivro2 || !dados.matricula_transcricao?.trim()}
                    onClick={() => localizarNoLivro2()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-600 bg-sky-950 px-3 py-1 text-xs font-sans font-semibold text-sky-200 hover:bg-sky-900 hover:text-white transition shadow-sm disabled:opacity-40"
                    title="Pesquisar automaticamente este número no acervo de imagens do Livro 2 (K:\IMAGENS\LV2)"
                  >
                    {buscandoLivro2 ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400 shrink-0" />
                        <span>Buscando no Livro 2...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                        <span>Localizar Imagem no Livro 2 (K:)</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1.5">
                  <input
                    type="text"
                    value={dados.matricula_transcricao}
                    onChange={e => atualizarCampo('matricula_transcricao', e.target.value)}
                    placeholder="Matrícula nº..."
                    className="bg-transparent text-slate-950 font-semibold border-b-2 border-dotted border-slate-400 hover:border-slate-800 py-1.5 sm:py-2 font-sans text-xs sm:text-sm xl:text-base focus:bg-amber-100/70 focus:outline-none px-1.5 transition placeholder:text-slate-400"
                  />
                  <input
                    type="text"
                    value={dados.titular_origem}
                    onChange={e => atualizarCampo('titular_origem', e.target.value)}
                    placeholder="Titular tabular..."
                    className="bg-transparent text-slate-950 font-semibold border-b-2 border-dotted border-slate-400 hover:border-slate-800 py-1.5 sm:py-2 font-sans text-xs sm:text-sm xl:text-base focus:bg-amber-100/70 focus:outline-none px-1.5 transition placeholder:text-slate-400"
                  />
                </div>

                {/* Card de Imagem do Livro 2 Localizada */}
                {(buscandoLivro2 || arquivosLivro2 || erroLivro2) && (
                  <div className="mt-3 rounded-xl border border-sky-600/50 bg-slate-950 text-slate-200 p-3 sm:p-4 font-sans text-xs shadow-lg animate-in fade-in duration-200">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-sky-400 shrink-0" />
                        <span className="font-semibold text-slate-100">
                          Livro 2 • Termo: <strong className="text-cyan-300 font-mono">"{termoBuscadoLivro2}"</strong>
                        </span>
                      </div>
                      {arquivosLivro2 && (
                        <span className="rounded bg-sky-950 border border-sky-800/80 px-2 py-0.5 text-[11px] font-bold text-sky-300">
                          {arquivosLivro2.length} imagem(ns) localizada(s)
                        </span>
                      )}
                    </div>

                    {buscandoLivro2 && (
                      <div className="flex items-center gap-2 py-3 text-sky-300">
                        <Loader2 className="h-4 w-4 animate-spin text-sky-400 shrink-0" />
                        <span>Varrendo blocos de matrículas em K:\IMAGENS\LV2…</span>
                      </div>
                    )}

                    {erroLivro2 && (
                      <div className="py-2 text-rose-300">
                        {erroLivro2}
                      </div>
                    )}

                    {arquivosLivro2 && arquivosLivro2.length === 0 && !buscandoLivro2 && (
                      <div className="py-2 flex flex-wrap items-center justify-between gap-2 text-slate-400">
                        <span>
                          Nenhuma imagem contendo o número <strong className="text-slate-200 font-mono">"{termoBuscadoLivro2}"</strong> foi localizada em K:\IMAGENS\LV2.
                        </span>
                        <button
                          type="button"
                          onClick={() => localizarNoLivro2(termoBuscadoLivro2 || undefined)}
                          className="text-xs text-sky-400 hover:text-sky-300 underline font-semibold transition"
                        >
                          Buscar novamente no disco
                        </button>
                      </div>
                    )}

                    {arquivosLivro2 && arquivosLivro2.length > 0 && !buscandoLivro2 && (
                      <div className="mt-2.5 space-y-2 max-h-48 overflow-y-auto pr-1">
                        {arquivosLivro2.map(file => (
                          <div
                            key={`${file.rootId}:${file.relativePath}`}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900 p-2.5 hover:border-sky-500/50 transition"
                          >
                            <div className="min-w-0 max-w-md">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-100 truncate block" title={file.name}>
                                  {file.name}
                                </span>
                                <span className="rounded bg-sky-950 px-1.5 py-0.2 text-[10px] font-mono text-sky-300 border border-sky-800/60">
                                  {file.rootId}
                                </span>
                              </div>
                              <span className="font-mono text-[11px] text-slate-400 truncate block mt-0.5" title={file.relativePath}>
                                {file.relativePath}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const textToCopy = `[${file.rootId}] ${file.relativePath}`;
                                  navigator.clipboard.writeText(textToCopy);
                                  setCaminhoCopiadoLivro2(file.relativePath);
                                  setTimeout(() => setCaminhoCopiadoLivro2(null), 2500);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700 transition"
                              >
                                {caminhoCopiadoLivro2 === file.relativePath ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-400" />
                                    <span className="text-emerald-400">Copiado</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3 text-slate-400" />
                                    <span>Copiar Caminho</span>
                                  </>
                                )}
                              </button>

                              {onVisualizarDocumento && (
                                <button
                                  type="button"
                                  onClick={() => onVisualizarDocumento(file)}
                                  className="inline-flex items-center gap-1 rounded-md border border-sky-600 bg-sky-950 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-900 transition"
                                >
                                  <FileText className="h-3 w-3" />
                                  <span>Visualizar</span>
                                </button>
                              )}

                              <button
                                type="button"
                                disabled={lendoMatriculaConfrontacoes}
                                onClick={() => lerMatriculaEPreencherConfrontacoes(file)}
                                className="inline-flex items-center gap-1 rounded-md border border-cyan-600 bg-cyan-950 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-900 transition disabled:opacity-50"
                                title="Ler esta imagem/matrícula e preencher automaticamente as confrontações na minuta"
                              >
                                {lendoMatriculaConfrontacoes ? (
                                  <Loader2 className="h-3 w-3 animate-spin text-cyan-400" />
                                ) : (
                                  <Wand2 className="h-3 w-3 text-cyan-400" />
                                )}
                                <span>Ler Confrontações</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Confrontações Perimetrais do Imóvel */}
                <div className="mt-4 pt-3 border-t border-dotted border-gray-400 font-sans">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm font-serif">Confrontações do Imóvel (Planta / Matrícula):</span>
                      {(dados.confrontante_lado_direito || dados.confrontante_lado_esquerdo || dados.confrontante_fundos) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Preenchido</span>
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={lendoMatriculaConfrontacoes}
                      onClick={() => lerMatriculaEPreencherConfrontacoes()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-600 bg-cyan-950 px-2.5 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-900 transition shadow-sm disabled:opacity-50"
                      title="Ler matrícula ou texto dos autos e preencher automaticamente as confrontações"
                    >
                      {lendoMatriculaConfrontacoes ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400 shrink-0" />
                          <span>Lendo Matrícula...</span>
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                          <span>Ler Matrícula e Preencher Confrontações</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        – do lado direito:
                      </label>
                      <input
                        type="text"
                        value={dados.confrontante_lado_direito}
                        onChange={e => atualizarCampo('confrontante_lado_direito', e.target.value)}
                        placeholder="conforme apuração nos autos"
                        className="w-full bg-transparent text-slate-950 font-semibold border-b-2 border-dotted border-slate-400 hover:border-slate-800 py-1 text-xs sm:text-sm focus:bg-amber-100/70 focus:outline-none px-1 transition placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        – do lado esquerdo:
                      </label>
                      <input
                        type="text"
                        value={dados.confrontante_lado_esquerdo}
                        onChange={e => atualizarCampo('confrontante_lado_esquerdo', e.target.value)}
                        placeholder="conforme apuração nos autos"
                        className="w-full bg-transparent text-slate-950 font-semibold border-b-2 border-dotted border-slate-400 hover:border-slate-800 py-1 text-xs sm:text-sm focus:bg-amber-100/70 focus:outline-none px-1 transition placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        – nos fundos:
                      </label>
                      <input
                        type="text"
                        value={dados.confrontante_fundos}
                        onChange={e => atualizarCampo('confrontante_fundos', e.target.value)}
                        placeholder="conforme apuração nos autos"
                        className="w-full bg-transparent text-slate-950 font-semibold border-b-2 border-dotted border-slate-400 hover:border-slate-800 py-1 text-xs sm:text-sm focus:bg-amber-100/70 focus:outline-none px-1 transition placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Linha Divisória */}
              <div className="h-0.5 bg-black my-4 sm:my-6" />

              {/* Anotações e Linhas Pautadas */}
              <div>
                <div className="text-xs sm:text-sm xl:text-base font-bold uppercase tracking-wider mb-2 font-serif text-slate-900">
                  Conferência e Anotações do Oficial:
                </div>
                <textarea
                  rows={4}
                  value={dados.anotacoes_ficha_oficial}
                  onChange={e => atualizarCampo('anotacoes_ficha_oficial', e.target.value)}
                  placeholder="Escreva anotações ou observações para o Oficial..."
                  className="w-full rounded-lg border-2 border-slate-300 bg-amber-50/40 p-3 sm:p-4 font-sans text-xs sm:text-sm xl:text-base font-medium text-slate-950 placeholder:text-slate-500 focus:bg-white focus:border-cyan-600 focus:ring-1 focus:ring-cyan-600 focus:outline-none min-h-[140px] xl:min-h-[180px] leading-relaxed transition"
                />
                <div className="mt-3 space-y-3">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div key={idx} className="border-b border-dotted border-gray-400 h-1 w-full" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Minuta de Manifestação Judicial (Padrão Oficial 7º RI) */}
          {abaAtiva === 'manifestacao' && (
            <div className="rounded-xl border border-slate-700 bg-white p-6 sm:p-8 xl:p-12 2xl:p-16 text-black shadow-lg font-sans">
              {/* Timbre Oficial Padrão 7º RI */}
              <div className="border-b border-black pb-2 mb-6">
                <div className="flex flex-col items-end text-right">
                  <div className="text-[12px] tracking-wider text-slate-800 font-sans font-medium uppercase">
                    OFICIAL
                  </div>
                  <div className="flex items-center gap-1.5 leading-none my-0.5">
                    <span className="text-3xl font-serif italic font-bold text-slate-900">7</span>
                    <span className="text-lg text-slate-600 font-bold">•</span>
                    <span className="text-xl font-sans font-bold tracking-tight text-slate-900">SÉTIMO</span>
                  </div>
                  <div className="text-[11px] font-sans font-semibold tracking-wide text-slate-800 uppercase">
                    DE REGISTRO DE IMÓVEIS
                  </div>
                </div>
                <div className="h-[1px] bg-slate-900 w-full mt-1.5 mb-1" />
                <div className="text-[11px] text-slate-600 italic text-right font-sans">
                  Fone: 3218-0527 — R. Augusta, 356 / Consolação — Cep: 01304-000 — São Paulo — SP
                </div>
              </div>

              {/* Dados Processuais Alinhados à Esquerda */}
              <div className="mb-6 space-y-1 text-xs sm:text-sm font-sans text-slate-900 leading-snug">
                <div>
                  <strong>PROCESSO DIGITAL nº</strong> {dados.numero_processo || '____________________'}
                </div>
                <div>
                  <strong>E. {dados.vara || '1ª'} Vara de Registros Públicos da Capital.</strong>
                </div>
                <div>
                  <strong>INTERESSADOS:</strong>{' '}
                  <span className="font-bold underline">{(dados.requerente || 'A IDENTIFICAR').toUpperCase()}</span>
                </div>
                <div className="pt-2 font-bold tracking-wider text-xs sm:text-sm uppercase">
                  USUCAPIÃO
                </div>
              </div>

              {/* Saudação com Toggle Amigável */}
              <div className="mb-4 flex items-center gap-2 font-bold text-xs sm:text-sm font-sans">
                <span>{saudacaoJuiz}:</span>
                <button
                  type="button"
                  onClick={() => setSaudacaoJuiz(s => s === 'Meritíssima Juíza' ? 'MM. Juiz' : 'Meritíssima Juíza')}
                  className="text-[10px] text-cyan-700 hover:text-cyan-900 underline font-normal not-italic px-1"
                  title="Alternar entre Meritíssima Juíza / MM. Juiz"
                >
                  (alternar para {saudacaoJuiz === 'Meritíssima Juíza' ? 'MM. Juiz' : 'Meritíssima Juíza'})
                </button>
              </div>

              {/* Corpo da Manifestação */}
              <div className="text-xs sm:text-sm xl:text-base leading-relaxed space-y-4 text-justify font-sans text-slate-950">
                <p className="indent-12">
                  Em atenção ao r. despacho de fls. {dados.fls_inicial || '05/06'} e{' '}
                  {dados.fls_laudo || '35/46'}, cumpre-me informar a V. Exa. que, revendo os livros de
                  transcrições das transmissões, bem assim as fichas do Livro nº 2 – Registro Geral, deste
                  Cartório, procedendo às buscas no Indicador Real e no Índice de Contribuintes da Prefeitura do
                  Município de São Paulo, pelo contribuinte nº {dados.contribuinte_sql || '___________'}, as
                  mesmas resultaram <span className="font-bold underline">{(dados.resultado_buscas || 'NEGATIVAS').toUpperCase()}</span>.
                </p>

                <p className="indent-12">
                  Segundo elementos constantes dos autos, o imóvel usucapiendo encontra-se transcrito em nome de{' '}
                  <span className="font-bold underline">{dados.titular_origem || 'TITULAR A CONFERIR'}</span>, sob nº{' '}
                  <u>
                    <b>{dados.matricula_transcricao || '_____'}</b>
                  </u>{' '}
                  do {dados.cartorio_origem || '3º Oficial de Registro de Imóveis da Capital'}, conforme certidão
                  de fls. {dados.fls_certidao_origem || '30/32'}.
                </p>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="indent-12">
                      Pela planta do Setor Fiscal Municipal do imóvel usucapiendo, verifica-se que o mesmo confronta:
                    </p>
                    <div className="inline-flex items-center gap-2 not-italic">
                      <button
                        type="button"
                        disabled={lendoMatriculaConfrontacoes}
                        onClick={() => lerMatriculaEPreencherConfrontacoes()}
                        title="Ler matrícula ou autos do processo e preencher automaticamente as confrontações na minuta"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-600 bg-cyan-950 px-2.5 py-1 text-xs font-sans font-semibold text-cyan-200 hover:bg-cyan-900 transition shadow-sm disabled:opacity-50"
                      >
                        {lendoMatriculaConfrontacoes ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400 shrink-0" />
                            <span>Lendo Matrícula...</span>
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                            <span>Ler Matrícula e Preencher Confrontações</span>
                          </>
                        )}
                      </button>
                      {(dados.confrontante_lado_direito || dados.confrontante_lado_esquerdo || dados.confrontante_fundos) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-sans font-bold text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Preenchido automaticamente</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="ml-12 mt-2 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0">– pelo lado direito com</span>{' '}
                      <input
                        type="text"
                        value={dados.confrontante_lado_direito}
                        onChange={e => atualizarCampo('confrontante_lado_direito', e.target.value)}
                        placeholder="conforme apuração nos autos"
                        className={`bg-transparent font-sans text-xs sm:text-sm border-b-2 font-semibold px-2 py-0.5 focus:outline-none transition w-80 sm:w-[450px] ${
                          dados.confrontante_lado_direito
                            ? 'border-cyan-600 text-slate-950 bg-cyan-50/60 focus:bg-cyan-100/70'
                            : 'border-dotted border-slate-500 text-slate-800 focus:bg-amber-100/70 placeholder:text-slate-400'
                        }`}
                      />
                      <span>;</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0">– pelo lado esquerdo com</span>{' '}
                      <input
                        type="text"
                        value={dados.confrontante_lado_esquerdo}
                        onChange={e => atualizarCampo('confrontante_lado_esquerdo', e.target.value)}
                        placeholder="conforme apuração nos autos"
                        className={`bg-transparent font-sans text-xs sm:text-sm border-b-2 font-semibold px-2 py-0.5 focus:outline-none transition w-80 sm:w-[450px] ${
                          dados.confrontante_lado_esquerdo
                            ? 'border-cyan-600 text-slate-950 bg-cyan-50/60 focus:bg-cyan-100/70'
                            : 'border-dotted border-slate-500 text-slate-800 focus:bg-amber-100/70 placeholder:text-slate-400'
                        }`}
                      />
                      <span>;</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="shrink-0">– e aos fundos com</span>{' '}
                      <input
                        type="text"
                        value={dados.confrontante_fundos}
                        onChange={e => atualizarCampo('confrontante_fundos', e.target.value)}
                        placeholder="conforme apuração nos autos"
                        className={`bg-transparent font-sans text-xs sm:text-sm border-b-2 font-semibold px-2 py-0.5 focus:outline-none transition w-80 sm:w-[450px] ${
                          dados.confrontante_fundos
                            ? 'border-cyan-600 text-slate-950 bg-cyan-50/60 focus:bg-cyan-100/70'
                            : 'border-dotted border-slate-500 text-slate-800 focus:bg-amber-100/70 placeholder:text-slate-400'
                        }`}
                      />
                      <span>.</span>
                    </div>
                  </div>
                </div>

                <p className="indent-12">
                  Informo, outrossim, que a área em apreço passou a pertencer a esta Serventia a partir de{' '}
                  {dados.data_competencia_subdistrito || '23 de dezembro de 1.938'}, por força do Decreto
                  Estadual nº 9.775, de 30 de novembro de 1.938.
                </p>

                <p className="indent-12">
                  {dados.transcricoes_anexas || dados.matriculas_anexas
                    ? `Encaminho cópia da planta do Setor Fiscal Municipal, certidões das transcrições nºs ${
                        dados.transcricoes_anexas || '—'
                      } e matrículas nºs ${dados.matriculas_anexas || '—'}, para que acompanhe a presente.`
                    : 'Encaminho cópia da planta do Setor Fiscal Municipal, para que acompanhe a presente.'}
                </p>

                <p className="indent-12">
                  Com a vênia devida, sugiro o encaminhamento dos presentes autos ao digno{' '}
                  {dados.cartorio_encaminhamento ||
                    dados.cartorio_origem ||
                    '3º Oficial de Registro de Imóveis da Capital'}
                  , tendo em vista a transcrição de origem nº{' '}
                  <u>
                    <b>{dados.matricula_transcricao || '_____'}</b>
                  </u>
                  .
                </p>

                <p className="indent-12 pt-2">
                  Era o que, respeitosamente, cumpria informar a V. Exa.
                </p>
              </div>

              {/* Fechamento Oficial */}
              <div className="mt-8 text-right text-xs sm:text-sm font-sans">São Paulo, {obterDataPorExtenso()}.</div>

              <div className="mt-8 text-center text-xs sm:text-sm font-sans">
                <div className="border-t border-black w-72 mx-auto pt-1 font-bold">
                  Ademar Fioranelli
                </div>
                <div className="text-[11px] text-gray-700">
                  7º Oficial de Registro de Imóveis da Capital – SP
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Origem & Confiança */}
          {abaAtiva === 'origem' && (
            <div className="space-y-4">
              <ConfidenceReview
                campos={dados.origem_campos || []}
                requerente={dados.requerente}
              />
            </div>
          )}

          {/* Tab 4: Validação de Autenticidade em Órgãos Públicos via API */}
          {abaAtiva === 'autenticidade' && (
            <ValidacaoAutenticidadeView dados={dados} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
