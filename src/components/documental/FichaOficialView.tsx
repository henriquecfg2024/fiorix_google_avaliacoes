'use client';

import React, { useState } from 'react';
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
}: {
  dadosIniciais: DadosManifestacao;
  onClose: () => void;
}) {
  const [dados, setDados] = useState<DadosManifestacao>(dadosIniciais);
  const [abaAtiva, setAbaAtiva] = useState<'formulario' | 'manifestacao' | 'origem'>('formulario');
  const [copiado, setCopiado] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative my-8 flex max-h-[92vh] w-full max-w-5xl flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-950 text-cyan-400 border border-cyan-800/60">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-cyan-950 px-2 py-0.5 text-[11px] font-semibold text-cyan-400 border border-cyan-800/60">
                  7º RI DE SÃO PAULO
                </span>
                <span className="text-xs text-slate-400">Processo:</span>
                <span className="font-mono text-xs font-semibold text-slate-200">
                  {dados.numero_processo || 'Não informado'}
                </span>
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                Ficha de Conferência do Oficial & Minuta de Manifestação
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copiarManifestacao}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>

            <button
              onClick={onClose}
              className="ml-2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-4 border-b border-slate-800 bg-slate-900/90 px-6 pt-3">
          <button
            onClick={() => setAbaAtiva('formulario')}
            className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-semibold transition ${
              abaAtiva === 'formulario'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="h-4 w-4" />
            Ficha de Conferência (Formulário)
          </button>

          <button
            onClick={() => setAbaAtiva('manifestacao')}
            className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-semibold transition ${
              abaAtiva === 'manifestacao'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="h-4 w-4" />
            Minuta de Manifestação Judicial
          </button>

          <button
            onClick={() => setAbaAtiva('origem')}
            className={`flex items-center gap-2 border-b-2 pb-3 text-xs font-semibold transition ${
              abaAtiva === 'origem'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            Origem & Confiança ({dados.origem_campos?.length || 0})
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Edit Bar */}
          <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div>
              <label className="text-slate-400 block mb-1">Escrevente Responsável</label>
              <select
                value={dados.escrevente_pasta}
                onChange={e => atualizarCampo('escrevente_pasta', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                {ESCREVENTES_USUCAPIAO.map(e => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Subdistrito Territorial</label>
              <select
                value={dados.subdistrito}
                onChange={e => atualizarCampo('subdistrito', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                {SUBDISTRITOS_7RI.map(s => (
                  <option key={s.nome} value={s.nome}>
                    {s.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Resultado das Buscas</label>
              <select
                value={dados.resultado_buscas}
                onChange={e => atualizarCampo('resultado_buscas', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="NEGATIVAS">NEGATIVAS</option>
                <option value="POSITIVAS">POSITIVAS</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Cartório de Encaminhamento</label>
              <input
                type="text"
                value={dados.cartorio_encaminhamento}
                onChange={e => atualizarCampo('cartorio_encaminhamento', e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-slate-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Tab 1: Ficha de Conferência (Formulário Clássico) */}
          {abaAtiva === 'formulario' && (
            <div className="rounded-xl border border-slate-700 bg-white p-6 text-black shadow-lg">
              {/* Header Clássico */}
              <div className="text-center border-b-2 border-black pb-3 mb-4">
                <h2 className="text-lg font-bold tracking-wider uppercase font-serif">
                  7º Cartório de Registro de Imóveis
                </h2>
                <div className="text-xs italic">Comarca da Capital</div>
                <div className="text-xs font-bold tracking-widest mt-1">OFICIAL ADEMAR FIORANELLI</div>
              </div>

              {/* Informações Processuais */}
              <div className="text-xs space-y-2 border-b border-black pb-3 mb-4 font-serif">
                <div className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                  <span>
                    <strong>Buscas feitas em:</strong> {dados.buscas_feitas_em || '___/___/______'}
                  </span>
                  <span>
                    <strong>Processo:</strong> {dados.tipo_processo} &nbsp;|&nbsp;{' '}
                    <strong>Número:</strong> {dados.numero_processo || '____________________'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-dotted border-gray-400 pb-1">
                  <span>
                    <strong>{dados.vara || '____'} Vara</strong> de Registros Públicos da Capital
                  </span>
                  <span>
                    <strong>Chegada em:</strong> {dados.data_chegada || '___/___/______'}
                  </span>
                </div>
              </div>

              {/* Requerente */}
              <div className="mb-3 text-xs font-serif">
                <div className="font-bold">Requerente:</div>
                <input
                  type="text"
                  value={dados.requerente}
                  onChange={e => atualizarCampo('requerente', e.target.value)}
                  className="w-full border-b border-dotted border-gray-500 py-1 font-sans text-xs focus:bg-amber-50 focus:outline-none"
                />
              </div>

              {/* Imóvel e SQL */}
              <div className="mb-3 text-xs font-serif">
                <div className="font-bold">Imóvel:</div>
                <input
                  type="text"
                  value={dados.imovel}
                  onChange={e => atualizarCampo('imovel', e.target.value)}
                  className="w-full border-b border-dotted border-gray-500 py-1 font-sans text-xs focus:bg-amber-50 focus:outline-none"
                />
                <div className="flex gap-4 mt-1">
                  <span className="font-bold">SQL / IPTU:</span>
                  <input
                    type="text"
                    value={dados.contribuinte_sql}
                    onChange={e => atualizarCampo('contribuinte_sql', e.target.value)}
                    className="border-b border-dotted border-gray-500 font-sans text-xs focus:bg-amber-50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Matrícula e Titular */}
              <div className="mb-4 text-xs font-serif">
                <div className="font-bold">Matrícula / Transcrição de Origem:</div>
                <div className="grid grid-cols-2 gap-4 mt-1">
                  <input
                    type="text"
                    value={dados.matricula_transcricao}
                    onChange={e => atualizarCampo('matricula_transcricao', e.target.value)}
                    placeholder="Matrícula nº..."
                    className="border-b border-dotted border-gray-500 font-sans text-xs focus:bg-amber-50 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={dados.titular_origem}
                    onChange={e => atualizarCampo('titular_origem', e.target.value)}
                    placeholder="Titular tabular..."
                    className="border-b border-dotted border-gray-500 font-sans text-xs focus:bg-amber-50 focus:outline-none"
                  />
                </div>
              </div>

              {/* Linha Divisória */}
              <div className="h-0.5 bg-black my-4" />

              {/* Anotações e Linhas Pautadas */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider mb-2 font-serif">
                  Conferência e Anotações do Oficial:
                </div>
                <textarea
                  rows={4}
                  value={dados.anotacoes_ficha_oficial}
                  onChange={e => atualizarCampo('anotacoes_ficha_oficial', e.target.value)}
                  placeholder="Escreva anotações ou observações para o Oficial..."
                  className="w-full rounded border border-gray-300 p-2 font-sans text-xs text-gray-800 focus:bg-amber-50 focus:outline-none"
                />
                <div className="mt-2 space-y-3">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <div key={idx} className="border-b border-dotted border-gray-400 h-1 w-full" />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Minuta de Manifestação Judicial */}
          {abaAtiva === 'manifestacao' && (
            <div className="rounded-xl border border-slate-700 bg-white p-8 text-black shadow-lg font-serif">
              {/* Timbre 7º RI */}
              <div className="border-b-2 border-black pb-2 mb-6 flex justify-between items-end">
                <div>
                  <div className="text-base font-bold tracking-wide">
                    7º · SÉTIMO OFICIAL DE REGISTRO DE IMÓVEIS
                  </div>
                  <div className="text-[10px] text-gray-700">
                    Fone: 3218-0527 — R. Augusta, 356 / Consolação — Cep: 01304-000 — São Paulo — SP
                  </div>
                </div>
                <div className="text-xs text-gray-500 italic">Portaria Conjunta nº 1/26</div>
              </div>

              {/* Dados Processuais */}
              <div className="mb-4 text-xs space-y-1">
                <div>
                  <strong>PROCESSO DIGITAL nº</strong> {dados.numero_processo || '____________________'}
                </div>
                <div>
                  <strong>E. {dados.vara || '____'} Vara de Registros Públicos da Capital.</strong>
                </div>
                <div>
                  <strong>INTERESSADA:</strong>{' '}
                  <b>{(dados.requerente || 'A IDENTIFICAR').toUpperCase()}</b>
                </div>
                <div>
                  <strong>USUCAPIÃO</strong>
                </div>
              </div>

              {/* Saudação */}
              <div className="mb-3 font-bold text-sm">MM. Juiz:</div>

              {/* Corpo */}
              <div className="text-xs leading-relaxed space-y-3 text-justify">
                <p className="indent-8">
                  Em atenção ao r. despacho de fls. {dados.fls_inicial || '05/06'} e{' '}
                  {dados.fls_laudo || '35/46'}, cumpre-me informar a V. Exa. que, revendo os livros de
                  transcrições das transmissões, bem assim as fichas do Livro nº 2 – Registro Geral, deste
                  Cartório, procedendo às buscas no Indicador Real e no Índice de Contribuintes da Prefeitura do
                  Município de São Paulo, pelo contribuinte nº {dados.contribuinte_sql || '___________'}, as
                  mesmas resultaram <b>{(dados.resultado_buscas || 'NEGATIVAS').toUpperCase()}</b>.
                </p>

                <p className="indent-8">
                  Segundo elementos constantes dos autos, o imóvel usucapiendo encontra-se transcrito em nome de{' '}
                  <b>{dados.titular_origem || 'TITULAR A CONFERIR'}</b>, sob nº{' '}
                  <u>
                    <b>{dados.matricula_transcricao || '_____'}</b>
                  </u>{' '}
                  do {dados.cartorio_origem || '3º Oficial de Registro de Imóveis da Capital'}, conforme certidão
                  de fls. {dados.fls_certidao_origem || '30/32'}.
                </p>

                <p className="indent-8">
                  Pela planta de Setor Fiscal Municipal do imóvel usucapiendo, verifica-se que o mesmo confronta:
                </p>
                <div className="ml-12 space-y-1">
                  <div>
                    – do lado direito:{' '}
                    <input
                      type="text"
                      value={dados.confrontante_lado_direito}
                      onChange={e => atualizarCampo('confrontante_lado_direito', e.target.value)}
                      placeholder="conforme apuração nos autos"
                      className="border-b border-dotted border-gray-500 font-sans text-xs focus:bg-amber-50 focus:outline-none w-80"
                    />
                  </div>
                  <div>
                    – do lado esquerdo:{' '}
                    <input
                      type="text"
                      value={dados.confrontante_lado_esquerdo}
                      onChange={e => atualizarCampo('confrontante_lado_esquerdo', e.target.value)}
                      placeholder="conforme apuração nos autos"
                      className="border-b border-dotted border-gray-500 font-sans text-xs focus:bg-amber-50 focus:outline-none w-80"
                    />
                  </div>
                  <div>
                    – nos fundos:{' '}
                    <input
                      type="text"
                      value={dados.confrontante_fundos}
                      onChange={e => atualizarCampo('confrontante_fundos', e.target.value)}
                      placeholder="conforme apuração nos autos"
                      className="border-b border-dotted border-gray-500 font-sans text-xs focus:bg-amber-50 focus:outline-none w-80"
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
              <div className="mt-8 text-right text-xs">São Paulo, {obterDataPorExtenso()}.</div>

              <div className="mt-6 text-center text-xs">
                <div className="mb-8">O Oficial,</div>
                <div className="border-t border-black w-64 mx-auto pt-1 font-bold">
                  Ademar Fioranelli
                </div>
                <div className="text-[10px] text-gray-600">
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
    </div>
  );
}
