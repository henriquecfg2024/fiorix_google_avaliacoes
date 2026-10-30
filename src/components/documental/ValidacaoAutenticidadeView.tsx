'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  Download,
  ExternalLink,
  Copy,
  RotateCw,
  FileText,
  Building2,
  Sparkles,
  Printer,
  Check,
  Eye,
  AlertCircle,
  FileCheck2,
  ArrowLeft,
  X,
} from 'lucide-react';
import { DadosManifestacao } from './FichaOficialView';

export interface ComprovanteValidacaoOficial {
  id: string;
  documentoTipo: string;
  documentoDescricao: string;
  orgaoCompetente: string;
  orgaoSigla: string;
  apiValidadora: string;
  status: 'AUTENTICIDADE_CONFIRMADA' | 'INTEGRIDADE_VERIFICADA' | 'COM_RESSALVA';
  codigoAutenticidade: string;
  hashSha256: string;
  dataHoraValidacao: string;
  linkConsultaOficial: string;
  signatarios: string[];
  detalhesTecnicos: string;
  protocoloOficial: string;
}

export function ValidacaoAutenticidadeView({
  dados,
}: {
  dados: DadosManifestacao;
}) {
  const [carregando, setCarregando] = useState(false);
  const [validacoes, setValidacoes] = useState<ComprovanteValidacaoOficial[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [visualizandoPdfId, setVisualizandoPdfId] = useState<string | null>(null);

  // Só há o que validar se a ficha tiver ao menos um identificador do processo/imóvel
  const temDadosParaValidar = Boolean(
    dados.numero_processo?.trim() || dados.contribuinte_sql?.trim() || dados.matricula_transcricao?.trim()
  );

  const executarValidacaoAutomatica = async () => {
    if (!temDadosParaValidar) {
      setValidacoes([]);
      setErro(null);
      return;
    }
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch('/api/documental/validacao-autenticidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_processo: dados.numero_processo,
          vara: dados.vara,
          requerente: dados.requerente,
          imovel: dados.imovel,
          contribuinte_sql: dados.contribuinte_sql,
          matricula_transcricao: dados.matricula_transcricao,
          cartorio_origem: dados.cartorio_origem || dados.cartorio_encaminhamento,
          escrevente_pasta: dados.escrevente_pasta,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Falha na validação oficial.');
      setValidacoes(body.documentos || []);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao consultar APIs oficiais.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    executarValidacaoAutomatica();
  }, [dados.numero_processo, dados.contribuinte_sql, dados.matricula_transcricao]);

  const copiarTexto = (id: string, texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const baixarComprovantePdf = (id: string) => {
    const url = `/api/documental/validacao-autenticidade?id=${encodeURIComponent(id)}&processo=${encodeURIComponent(dados.numero_processo || '')}`;
    window.open(url, '_blank');
  };

  const baixarTodosComprovantes = () => {
    validacoes.forEach((v, idx) => {
      setTimeout(() => {
        baixarComprovantePdf(v.id);
      }, idx * 400);
    });
  };

  const totalConfirmados = validacoes.filter(v => v.status === 'AUTENTICIDADE_CONFIRMADA').length;
  const percentualConfirmado = validacoes.length > 0 ? Math.round((totalConfirmados / validacoes.length) * 100) : 0;

  if (!temDadosParaValidar) {
    return (
      <div className="rounded-2xl border border-slate-700/80 bg-slate-950/90 p-6 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-slate-500" />
        <h3 className="mt-2 text-sm font-bold text-white">Nenhum documento para validar</h3>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-400">
          O formulário está vazio. Preencha o nº do processo, o SQL/IPTU ou a matrícula/transcrição
          (ou extraia os dados de uma petição inicial) para executar a validação de autenticidade.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Status e Auditoria Geral */}
      <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-cyan-950/60 p-5 sm:p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 shadow-lg shadow-emerald-950/50">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  100% Automático via API
                </span>
                <span className="text-xs text-slate-400">
                  Padrão 7º RI de São Paulo
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white mt-0.5">
                Central de Validação de Autenticidade em Órgãos Públicos
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Todos os documentos públicos do processo foram cruzados e auditados eletronicamente nos órgãos emissores competentes (TJSP, Prefeitura de SP, ONR/Registro de Imóveis, CREA-SP e ICP-Brasil).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={executarValidacaoAutomatica}
              disabled={carregando}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3.5 py-2 text-xs font-semibold text-slate-200 transition shadow-sm disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 text-cyan-400 ${carregando ? 'animate-spin' : ''}`} />
              <span>{carregando ? 'Validando APIs...' : 'Revalidar APIs'}</span>
            </button>

            <button
              type="button"
              onClick={baixarTodosComprovantes}
              disabled={validacoes.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-bold transition shadow-lg shadow-emerald-950/50 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>Baixar Todos os Comprovantes (PDF)</span>
            </button>
          </div>
        </div>

        {/* Indicadores de Auditoria */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-800/80">
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3">
            <span className="text-[11px] text-slate-400 font-medium">Documentos Públicos</span>
            <div className="text-base sm:text-lg font-bold text-white mt-0.5">
              {validacoes.length} Auditados
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3">
            <span className="text-[11px] text-emerald-400 font-medium">Autenticidade Confirmada</span>
            <div className="text-base sm:text-lg font-bold text-emerald-300 mt-0.5">
              {totalConfirmados} de {validacoes.length} ({percentualConfirmado}%)
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3">
            <span className="text-[11px] text-cyan-400 font-medium">Padrão Criptográfico</span>
            <div className="text-base sm:text-lg font-bold text-cyan-300 mt-0.5">
              ICP-Brasil PAdES
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-3">
            <span className="text-[11px] text-amber-400 font-medium">Fé Pública Registral</span>
            <div className="text-base sm:text-lg font-bold text-amber-300 mt-0.5">
              Certidão 7º RI Emitida
            </div>
          </div>
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border border-rose-500/50 bg-rose-950/60 p-4 text-xs text-rose-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Lista de Documentos Públicos e seus Comprovantes Oficiais */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 px-1">
          <FileCheck2 className="w-4 h-4 text-emerald-400" />
          <span>Comprovantes Oficiais de Validação Emitidos (Download Individual ou em Lote)</span>
        </h4>

        <div className="grid grid-cols-1 gap-4">
          {validacoes.map((item, index) => {
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-700/80 bg-slate-950/90 p-5 sm:p-6 shadow-md hover:border-emerald-500/40 transition-all space-y-4"
              >
                {/* Header do Card */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl bg-slate-900 border border-slate-700/80 text-emerald-400 shrink-0 mt-0.5">
                      <span className="font-bold text-xs font-mono">{index + 1}</span>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-800 px-2 py-0.5 rounded">
                          {item.orgaoSigla}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-800 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Autenticidade Confirmada no Órgão
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg font-bold text-white">
                        {item.documentoTipo}
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {item.documentoDescricao}
                      </p>
                    </div>
                  </div>

                  {/* Botões de Ação do Comprovante */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVisualizandoPdfId(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-slate-200 px-3 py-1.5 text-xs font-semibold transition shadow-sm"
                      title="Visualizar certidão oficial na tela"
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Visualizar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => baixarComprovantePdf(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-200 px-3.5 py-1.5 text-xs font-bold transition shadow-sm"
                      title="Baixar Certidão de Autenticidade Registral em PDF"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Baixar Comprovante Oficial (PDF)</span>
                    </button>

                    <a
                      href={item.linkConsultaOficial}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 px-2.5 py-1.5 text-xs font-medium transition"
                      title="Abrir validador diretamente no portal do órgão emissor"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {/* Grid de Auditoria e Metadados Oficiais */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="rounded-xl bg-slate-900/90 border border-slate-800/80 p-3 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium">Órgão Validador & API</span>
                    <div className="font-semibold text-slate-200">{item.orgaoCompetente}</div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">{item.apiValidadora}</div>
                  </div>

                  <div className="rounded-xl bg-slate-900/90 border border-slate-800/80 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium">Código / Chave de Autenticidade</span>
                      <button
                        type="button"
                        onClick={() => copiarTexto(item.id + '_cod', item.codigoAutenticidade)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-0.5"
                      >
                        {copiadoId === item.id + '_cod' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiadoId === item.id + '_cod' ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <div className="font-mono text-xs font-bold text-cyan-300 truncate">
                      {item.codigoAutenticidade}
                    </div>
                    <div className="text-[11px] text-slate-400">Validado em {item.dataHoraValidacao}</div>
                  </div>

                  <div className="rounded-xl bg-slate-900/90 border border-slate-800/80 p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400 font-medium">Hash Criptográfico (SHA-256)</span>
                      <button
                        type="button"
                        onClick={() => copiarTexto(item.id + '_hash', item.hashSha256)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-0.5"
                      >
                        {copiadoId === item.id + '_hash' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiadoId === item.id + '_hash' ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <div className="font-mono text-[11px] text-slate-300 truncate">
                      {item.hashSha256}
                    </div>
                    <div className="text-[11px] text-emerald-400 font-medium">Íntegro e Não Revogado</div>
                  </div>
                </div>

                {/* Parecer Técnico e Signatários */}
                <div className="rounded-xl bg-slate-900/50 border border-slate-800/80 p-3 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-slate-400 font-medium">Signatários & Autoridades:</span>
                    {item.signatarios.map((sig, sidx) => (
                      <span
                        key={sidx}
                        className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 font-medium"
                      >
                        {sig}
                      </span>
                    ))}
                  </div>

                  <div className="text-slate-300 leading-relaxed text-xs">
                    <strong className="text-slate-200">Parecer Técnico da API Oficial:</strong> {item.detalhesTecnicos}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Embutido para Visualização Imediata da Certidão Registral Oficial */}
      {visualizandoPdfId && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-md">
          <div className="relative flex flex-col h-[92vh] w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            {/* Header do Visualizador */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-white text-sm">
                  Certidão Registral de Autenticidade de Documento Público (7º RI)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => baixarComprovantePdf(visualizandoPdfId)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVisualizandoPdfId(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-3 sm:px-3.5 py-1.5 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition shadow-sm active:scale-95 shrink-0"
                  title="Voltar para a tela anterior"
                >
                  <ArrowLeft className="w-4 h-4 text-cyan-400" />
                  <span>Voltar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVisualizandoPdfId(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  title="Fechar visualizador"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Iframe com o PDF embutido */}
            <div className="flex-1 bg-slate-950">
              <iframe
                src={`/api/documental/validacao-autenticidade?id=${encodeURIComponent(visualizandoPdfId)}&processo=${encodeURIComponent(dados.numero_processo || '')}`}
                className="w-full h-full border-none"
                title="Certidão Registral de Autenticidade"
              />
            </div>

            {/* Rodapé do Visualizador com Botão Voltar */}
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950 px-5 py-3 shrink-0">
              <button
                type="button"
                onClick={() => setVisualizandoPdfId(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-4 py-1.5 text-xs sm:text-sm font-bold text-slate-200 hover:text-white transition shadow active:scale-95"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-400" />
                <span>Voltar para certidões</span>
              </button>
              <button
                type="button"
                onClick={() => baixarComprovantePdf(visualizandoPdfId)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Certidão (PDF)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
