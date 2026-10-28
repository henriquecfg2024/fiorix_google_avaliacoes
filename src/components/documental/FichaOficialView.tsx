'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { ConfidenceReview, OrigemCampoUI } from './ConfidenceReview';

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
  { nome: 'SÃO MIGUEL PAULISTA', cartorioSugerido: '12º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
  { nome: 'ERMELINO MATARAZZO', cartorioSugerido: '12º Oficial de Registro de Imóveis da Capital', competencia: '23 de dezembro de 1.938' },
];

export const ESCREVENTES_USUCAPIAO = ['CFALANGA', 'Bruno', 'DIEGO', 'LUCAS', 'TATIANA', 'YULLI'];

function obterDataPorExtenso(): string {
  const agora = new Date();
  const meses = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  return `${agora.getDate()} de ${meses[agora.getMonth()]} de ${agora.getFullYear()}`;
}

export function FichaOficialView({
  dadosIniciais,
  onClose,
  onReextrair,
}: {
  dadosIniciais: DadosManifestacao;
  onClose: () => void;
  onReextrair?: () => void;
}) {
  const [dados, setDados] = useState<DadosManifestacao>(dadosIniciais);
  const [abaAtiva, setAbaAtiva] = useState<'formulario' | 'manifestacao' | 'origem'>('formulario');
  const [copiado, setCopiado] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [mostrarGuiaCards, setMostrarGuiaCards] = useState(false);

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
    const texto = `7º OFICIAL DE REGISTRO DE IMÓVEIS DA CAPITAL - SP
PROCESSO DIGITAL nº ${dados.numero_processo || '____________________'}
E. ${dados.vara || '____'} Vara de Registros Públicos da Capital.
INTERESSADA: ${(dados.requerente || 'A IDENTIFICAR').toUpperCase()}
USUCAPIÃO

MM. Juiz:

Em atenção ao r. despacho de fls. ${dados.fls_inicial || '05/06'} e ${dados.fls_laudo || '35/46'}, cumpre-me informar a V. Exa. que, revendo os livros de transcrições das transmissões, bem assim as fichas do Livro nº 2 – Registro Geral, deste Cartório, procedendo às buscas no Indicador Real e no Índice de Contribuintes da Prefeitura do Município de São Paulo, pelo contribuinte nº ${dados.contribuinte_sql || '___________'}, as mesmas resultaram ${(dados.resultado_buscas || 'NEGATIVAS').toUpperCase()}.

Segundo elementos constantes dos autos, o imóvel usucapiendo encontra-se transcrito em nome de ${dados.titular_origem || 'TITULAR A CONFERIR'}, sob nº ${dados.matricula_transcricao || '_____'} do ${dados.cartorio_origem || '3º Oficial de Registro de Imóveis da Capital'}, conforme certidão de fls. ${dados.fls_certidao_origem || '30/32'}.

Pela planta de Setor Fiscal Municipal do imóvel usucapiendo, verifica-se que o mesmo confronta:
- do lado direito: ${dados.confrontante_lado_direito || 'conforme apuração nos autos'};
- do lado esquerdo: ${dados.confrontante_lado_esquerdo || 'conforme apuração nos autos'};
- nos fundos: ${dados.confrontante_fundos || 'conforme apuração nos autos'}.

Informo, outrossim, que a área em apreço passou a pertencer a esta Serventia a partir de ${dados.data_competencia_subdistrito || '23 de dezembro de 1.938'}, por força do Decreto Estadual nº 9.775, de 30 de novembro de 1.938.

${dados.transcricoes_anexas || dados.matriculas_anexas ? `Encaminho cópia da planta de Setor Fiscal Municipal, certidões das transcrições nºs ${dados.transcricoes_anexas || '—'} e matrículas nºs ${dados.matriculas_anexas || '—'}, para que acompanhe a presente.` : 'Encaminho cópia da planta de Setor Fiscal Municipal, para que acompanhe a presente.'}

Com a vênia devida, sugiro o encaminhamento dos presentes autos ao digno ${dados.cartorio_encaminhamento || dados.cartorio_origem || '3º Oficial de Registro de Imóveis da Capital'}, tendo em vista a transcrição de origem nº ${dados.matricula_transcricao || '_____'}.

São Paulo, ${dataExtenso}.

O Oficial,
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
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-slate-950 px-4 sm:px-6 py-3.5 sm:py-4 gap-3">
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
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/60 bg-amber-950/40 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-amber-300 hover:bg-amber-900/60 hover:text-amber-200 transition"
              >
                <RotateCw className="h-4 w-4" />
                <span className="hidden sm:inline">Re-extrair Dados</span>
              </button>
            )}

            <button
              onClick={copiarManifestacao}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>

            <button
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Restaurar tamanho' : 'Maximizar tela'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-800/60 bg-cyan-950/60 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-medium text-cyan-300 hover:bg-cyan-900 transition"
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
              className="ml-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-700/80 bg-slate-950 px-4 sm:px-6 pt-3 overflow-x-auto">
          <button
            onClick={() => setAbaAtiva('formulario')}
            className={`flex items-center gap-2 rounded-t-xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm xl:text-base font-bold transition border-b-2 whitespace-nowrap ${
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
            className={`flex items-center gap-2 rounded-t-xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm xl:text-base font-bold transition border-b-2 whitespace-nowrap ${
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
            className={`flex items-center gap-2 rounded-t-xl px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm xl:text-base font-bold transition border-b-2 whitespace-nowrap ${
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
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5">
          {/* Header da Barra de Edição com Botão de Ajuda Contextual */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>Barra de Despacho & Competência Registral</span>
            </span>
            <button
              type="button"
              onClick={() => setMostrarGuiaCards(!mostrarGuiaCards)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-medium text-cyan-300 hover:bg-slate-700 hover:text-cyan-200 transition"
            >
              <HelpCircle className="h-3.5 w-3.5 text-cyan-400" />
              <span>{mostrarGuiaCards ? 'Ocultar guia dos cards' : 'Para que servem estes 4 cards?'}</span>
            </button>
          </div>

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

          {/* Quick Edit Bar com breves explicações contextuais */}
          <div className="grid grid-cols-1 gap-3.5 rounded-xl border border-slate-700 bg-slate-950 p-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-4 text-xs sm:text-sm shadow-md">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-200 font-semibold text-xs sm:text-sm">Escrevente Responsável</label>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                  Autoria
                </span>
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
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-200 font-semibold text-xs sm:text-sm">Subdistrito Territorial</label>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                  Competência
                </span>
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
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-200 font-semibold text-xs sm:text-sm">Resultado das Buscas</label>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.5 rounded">
                  Indicadores
                </span>
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
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-200 font-semibold text-xs sm:text-sm">Cartório de Encaminhamento</label>
                <span className="text-[10px] font-mono text-sky-400 bg-sky-950/60 border border-sky-800/60 px-1.5 py-0.5 rounded">
                  Remessa
                </span>
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
                <div className="font-bold text-slate-900 mb-1">Matrícula / Transcrição de Origem:</div>
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

          {/* Tab 2: Minuta de Manifestação Judicial */}
          {abaAtiva === 'manifestacao' && (
            <div className="rounded-xl border border-slate-700 bg-white p-6 sm:p-8 xl:p-12 2xl:p-16 text-black shadow-lg font-serif">
              {/* Timbre 7º RI */}
              <div className="border-b-2 border-black pb-3 sm:pb-4 mb-6 flex flex-wrap justify-between items-end gap-2">
                <div>
                  <div className="text-base sm:text-lg xl:text-xl 2xl:text-2xl font-bold tracking-wide">
                    7º · SÉTIMO OFICIAL DE REGISTRO DE IMÓVEIS
                  </div>
                  <div className="text-[10px] sm:text-xs xl:text-sm text-gray-700">
                    Fone: 3218-0527 — R. Augusta, 356 / Consolação — Cep: 01304-000 — São Paulo — SP
                  </div>
                </div>
                <div className="text-xs sm:text-sm xl:text-base text-gray-500 italic">Portaria Conjunta nº 1/26</div>
              </div>

              {/* Dados Processuais */}
              <div className="mb-4 sm:mb-6 text-xs sm:text-sm xl:text-base space-y-1 sm:space-y-1.5">
                <div>
                  <strong>PROCESSO DIGITAL nº</strong> {dados.numero_processo || '____________________'}
                </div>
                <div>
                  <strong>E. {dados.vara || '____'} Vara de Registros Públicos da Capital.</strong>
                </div>
                <div>
                  <strong>INTERESSADA:</strong>{' '}
                  <span className="font-bold underline">{(dados.requerente || 'A IDENTIFICAR').toUpperCase()}</span>
                </div>
                <div className="font-bold tracking-widest text-center my-4 text-xs sm:text-sm xl:text-base">
                  USUCAPIÃO
                </div>
              </div>

              {/* Saudação */}
              <div className="mb-3 sm:mb-4 font-bold text-xs sm:text-sm xl:text-base">MM. Juiz:</div>

              {/* Corpo */}
              <div className="text-xs sm:text-sm xl:text-base 2xl:text-lg leading-relaxed space-y-4 xl:space-y-6 text-justify">
                <p className="indent-8">
                  Em atenção ao r. despacho de fls. {dados.fls_inicial || '05/06'} e{' '}
                  {dados.fls_laudo || '35/46'}, cumpre-me informar a V. Exa. que, revendo os livros de
                  transcrições das transmissões, bem assim as fichas do Livro nº 2 – Registro Geral, deste
                  Cartório, procedendo às buscas no Indicador Real e no Índice de Contribuintes da Prefeitura do
                  Município de São Paulo, pelo contribuinte nº {dados.contribuinte_sql || '___________'}, as
                  mesmas resultaram <span className="font-bold underline">{(dados.resultado_buscas || 'NEGATIVAS').toUpperCase()}</span>.
                </p>

                <p className="indent-8">
                  Segundo elementos constantes dos autos, o imóvel usucapiendo encontra-se transcrito em nome de{' '}
                  <span className="font-bold underline">{dados.titular_origem || 'TITULAR A CONFERIR'}</span>, sob nº{' '}
                  <u>
                    <b>{dados.matricula_transcricao || '_____'}</b>
                  </u>{' '}
                  do {dados.cartorio_origem || '3º Oficial de Registro de Imóveis da Capital'}, conforme certidão
                  de fls. {dados.fls_certidao_origem || '30/32'}.
                </p>

                <p className="indent-8">
                  Pela planta de Setor Fiscal Municipal do imóvel usucapiendo, verifica-se que o mesmo confronta:
                </p>
                <div className="ml-6 sm:ml-12 space-y-1.5">
                  <div>
                    – do lado direito:{' '}
                    <input
                      type="text"
                      value={dados.confrontante_lado_direito}
                      onChange={e => atualizarCampo('confrontante_lado_direito', e.target.value)}
                      placeholder="conforme apuração nos autos"
                      className="bg-transparent text-slate-950 font-semibold border-b border-dotted border-slate-500 hover:border-slate-800 font-sans text-xs sm:text-sm xl:text-base focus:bg-amber-100/70 focus:outline-none w-72 sm:w-96 px-1 placeholder:text-slate-400 transition"
                    />
                  </div>
                  <div>
                    – do lado esquerdo:{' '}
                    <input
                      type="text"
                      value={dados.confrontante_lado_esquerdo}
                      onChange={e => atualizarCampo('confrontante_lado_esquerdo', e.target.value)}
                      placeholder="conforme apuração nos autos"
                      className="bg-transparent text-slate-950 font-semibold border-b border-dotted border-slate-500 hover:border-slate-800 font-sans text-xs sm:text-sm xl:text-base focus:bg-amber-100/70 focus:outline-none w-72 sm:w-96 px-1 placeholder:text-slate-400 transition"
                    />
                  </div>
                  <div>
                    – nos fundos:{' '}
                    <input
                      type="text"
                      value={dados.confrontante_fundos}
                      onChange={e => atualizarCampo('confrontante_fundos', e.target.value)}
                      placeholder="conforme apuração nos autos"
                      className="bg-transparent text-slate-950 font-semibold border-b border-dotted border-slate-500 hover:border-slate-800 font-sans text-xs sm:text-sm xl:text-base focus:bg-amber-100/70 focus:outline-none w-72 sm:w-96 px-1 placeholder:text-slate-400 transition"
                    />
                  </div>
                </div>

                <p className="indent-8">
                  Informo, outrossim, que a área em apreço passou a pertencer a esta Serventia a partir de{' '}
                  {dados.data_competencia_subdistrito || '23 de dezembro de 1.938'}, por força do Decreto
                  Estadual nº 9.775, de 30 de novembro de 1.938.
                </p>

                <p className="indent-8">
                  {dados.transcricoes_anexas || dados.matriculas_anexas
                    ? `Encaminho cópia da planta de Setor Fiscal Municipal, certidões das transcrições nºs ${
                        dados.transcricoes_anexas || '—'
                      } e matrículas nºs ${dados.matriculas_anexas || '—'}, para que acompanhe a presente.`
                    : 'Encaminho cópia da planta de Setor Fiscal Municipal, para que acompanhe a presente.'}
                </p>

                <p className="indent-8">
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
              </div>

              {/* Fechamento */}
              <div className="mt-8 text-right text-xs sm:text-sm xl:text-base">São Paulo, {obterDataPorExtenso()}.</div>

              <div className="mt-6 text-center text-xs sm:text-sm xl:text-base">
                <div className="mb-8">O Oficial,</div>
                <div className="border-t border-black w-64 mx-auto pt-1 font-bold">
                  Ademar Fioranelli
                </div>
                <div className="text-[10px] sm:text-xs text-gray-600">
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
        </div>
      </div>
    </div>,
    document.body
  );
}
