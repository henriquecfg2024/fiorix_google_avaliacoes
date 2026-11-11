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
  Check,
  Eye,
  AlertCircle,
  AlertTriangle,
  FileCheck2,
  ArrowLeft,
  X,
  Building2,
  Lock,
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
  seloHmac?: string;
  provaMatematica?: string;
  origemHash?: string;
  arquivoLocalizado?: string | null;
}

interface SegurancaResumo {
  cnjValido: boolean;
  cnjMotivo: string;
  sqlValido: boolean;
  sqlMotivo: string;
  matriculaValida: boolean;
  matriculaMotivo: string;
  pdfAutosAuditado: boolean;
  lv2Localizado: boolean;
  setorLocalizado: boolean;
  seloHmacAtivo: boolean;
}

export function ValidacaoAutenticidadeView({
  dados,
  arquivoOrigem,
}: {
  dados: DadosManifestacao;
  arquivoOrigem?: { rootId?: string; relativePath?: string; name?: string } | null;
}) {
  const [carregando, setCarregando] = useState(false);
  const [validacoes, setValidacoes] = useState<ComprovanteValidacaoOficial[]>([]);
  const [segurancaResumo, setSegurancaResumo] = useState<SegurancaResumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [copiadoId, setCopiadoId] = useState<string | null>(null);
  const [visualizandoItem, setVisualizandoItem] = useState<ComprovanteValidacaoOficial | null>(null);
  const [formatoVisualizacao, setFormatoVisualizacao] = useState<'orgao' | 'cartorio'>('orgao');

  // Só há o que validar se a ficha tiver ao menos um identificador do processo/imóvel
  const temDadosParaValidar = Boolean(
    dados.numero_processo?.trim() || dados.contribuinte_sql?.trim() || dados.matricula_transcricao?.trim()
  );

  const executarValidacaoAutomatica = async () => {
    if (!temDadosParaValidar) {
      setValidacoes([]);
      setSegurancaResumo(null);
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
          rootId: arquivoOrigem?.rootId || '',
          relativePath: arquivoOrigem?.relativePath || '',
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Falha na validação oficial.');
      setValidacoes(body.documentos || []);
      setSegurancaResumo(body.segurancaResumo || null);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao consultar APIs oficiais.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void executarValidacaoAutomatica();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dados.numero_processo,
    dados.contribuinte_sql,
    dados.matricula_transcricao,
    arquivoOrigem?.rootId,
    arquivoOrigem?.relativePath,
  ]);

  const copiarTexto = (id: string, texto: string) => {
    void navigator.clipboard.writeText(texto);
    setCopiadoId(id);
    setTimeout(() => setCopiadoId(null), 2000);
  };

  const montarQueryParamsComprovante = (
    item?: ComprovanteValidacaoOficial,
    opcoes?: { download?: boolean; formato?: 'orgao' | 'cartorio'; lote?: boolean },
  ) => {
    const params = new URLSearchParams();
    if (opcoes?.lote) {
      params.set('lote', '1');
      params.set('ids', validacoes.map(v => v.id).join(','));
    } else if (item) {
      params.set('id', item.id);
      params.set('codigo', item.codigoAutenticidade);
      params.set('hash', item.hashSha256);
      params.set('dataHora', item.dataHoraValidacao);
      params.set('orgaoSigla', item.orgaoSigla);
      params.set('orgaoCompetente', item.orgaoCompetente);
      params.set('tipoDocumento', item.documentoTipo);
      params.set('status', item.status);
      if (item.seloHmac) params.set('seloHmac', item.seloHmac);
      if (item.provaMatematica) params.set('provaMatematica', item.provaMatematica);
      if (item.origemHash) params.set('origemHash', item.origemHash);
    }
    params.set('processo', dados.numero_processo || '');
    params.set('vara', dados.vara || '');
    params.set('requerente', dados.requerente || '');
    params.set('imovel', dados.imovel || '');
    params.set('sql', dados.contribuinte_sql || '');
    params.set('matricula', dados.matricula_transcricao || '');
    params.set('cartorio', dados.cartorio_origem || dados.cartorio_encaminhamento || '');
    params.set('escrevente', dados.escrevente_pasta || '');
    params.set('formato', opcoes?.formato || 'orgao');
    if (opcoes?.download) {
      params.set('download', '1');
    }
    return `/api/documental/validacao-autenticidade?${params.toString()}`;
  };

  const dispararDownloadUrl = (url: string, nomeArquivoSugerido: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivoSugerido;
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const baixarComprovanteOficialOrgao = (
    item: ComprovanteValidacaoOficial,
    formato: 'orgao' | 'cartorio' = 'orgao',
  ) => {
    const url = montarQueryParamsComprovante(item, { download: true, formato });
    const siglaLimpa = (item.orgaoSigla || 'ORGAO').replace(/[^\dA-Za-z]+/g, '_');
    const procLimpo = (dados.numero_processo || 'Processo').replace(/[^\dA-Za-z_-]/g, '_');
    const nome =
      formato === 'cartorio'
        ? `Certidao_7RI_Validacao_${siglaLimpa}_${procLimpo}.pdf`
        : `Comprovante_Oficial_${siglaLimpa}_${procLimpo}.pdf`;
    dispararDownloadUrl(url, nome);
  };

  const baixarTodosComprovantesConsolidado = () => {
    if (validacoes.length === 0) return;
    const url = montarQueryParamsComprovante(undefined, {
      lote: true,
      download: true,
      formato: 'orgao',
    });
    const procLimpo = (dados.numero_processo || 'Processo').replace(/[^\dA-Za-z_-]/g, '_');
    dispararDownloadUrl(url, `Comprovantes_Oficiais_Orgaos_Competentes_${procLimpo}.pdf`);
  };

  const baixarTodosComprovantesSeparados = () => {
    validacoes.forEach((v, idx) => {
      setTimeout(() => {
        baixarComprovanteOficialOrgao(v, 'orgao');
      }, idx * 350);
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
    <div className="space-y-5">
      {/* Banner de Status e Auditoria Criptográfica */}
      <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-cyan-950/60 p-4 sm:p-5 shadow-xl">
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 shadow-lg shadow-emerald-950/50 shrink-0">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                  <Lock className="w-3 h-3 text-emerald-400" />
                  SHA-256 + Selo HMAC-SHA256 Ativo
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  Padrão de Segurança Máxima — 7º RI-SP
                </span>
              </div>
              <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                Central de Validação de Autenticidade em Órgãos Públicos
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Validação matemática (CNJ ISO 7064 Mod 97-10 e SQL PMSP Mod-11), auditoria criptográfica PAdES/X.509 e conferência de integridade SHA-256 nos acervos oficiais (TJSP, PMSP/SF, ONR/7º RI, CREA-SP e ITI/ICP-Brasil).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => void executarValidacaoAutomatica()}
              disabled={carregando}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <RotateCw className={`h-3.5 w-3.5 text-cyan-400 ${carregando ? 'animate-spin' : ''}`} />
              <span>{carregando ? 'Auditando...' : 'Revalidar Criptografia'}</span>
            </button>

            <button
              type="button"
              onClick={baixarTodosComprovantesConsolidado}
              disabled={validacoes.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-lg shadow-emerald-950/50 disabled:opacity-50 cursor-pointer"
              title="Baixar um único arquivo PDF contendo todos os comprovantes oficiais emitidos pelos órgãos competentes com selo HMAC-SHA256"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Baixar Todos os Comprovantes (PDF)</span>
            </button>

            <button
              type="button"
              onClick={baixarTodosComprovantesSeparados}
              disabled={validacoes.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/50 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-200 px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              title="Baixar os 5 comprovantes oficiais em arquivos PDF individuais"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span>Baixar Separados ({validacoes.length} PDFs)</span>
            </button>
          </div>
        </div>

        {/* Indicadores de Auditoria */}
        <div className="grid grid-cols-2 gap-2.5 mt-4 pt-3.5 border-t border-slate-800/80">
          <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
            <span className="text-[11px] text-slate-400 font-medium block">Documentos Auditados</span>
            <div className="text-sm sm:text-base font-bold text-white mt-0.5">
              {validacoes.length} Órgãos Verificados
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
            <span className="text-[11px] text-emerald-400 font-medium block">Autenticidade Confirmada</span>
            <div className="text-sm sm:text-base font-bold text-emerald-300 mt-0.5">
              {totalConfirmados} de {validacoes.length} ({percentualConfirmado}%)
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
            <span className="text-[11px] text-cyan-400 font-medium block">Prova Criptográfica</span>
            <div className="text-sm sm:text-base font-bold text-cyan-300 mt-0.5">
              PAdES + HMAC-SHA256
            </div>
          </div>
          <div className="rounded-xl bg-slate-900/85 border border-slate-800 p-2.5">
            <span className="text-[11px] text-amber-400 font-medium block">Fé Pública Registral</span>
            <div className="text-sm sm:text-base font-bold text-amber-300 mt-0.5">
              Certidão 7º RI + Órgãos
            </div>
          </div>
        </div>

        {/* Resumo das Regras Matemáticas Verificadas */}
        {segurancaResumo && (
          <div className="mt-3 flex flex-wrap gap-1.5 pt-2.5 border-t border-slate-800/60 text-[11px]">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold border ${
                segurancaResumo.cnjValido
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                  : 'bg-amber-950/70 text-amber-300 border-amber-700/60'
              }`}
            >
              {segurancaResumo.cnjValido ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              CNJ ISO 7064 Mod 97-10: {segurancaResumo.cnjValido ? 'Íntegro' : 'Revisar DV'}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold border ${
                segurancaResumo.sqlValido
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                  : 'bg-amber-950/70 text-amber-300 border-amber-700/60'
              }`}
            >
              {segurancaResumo.sqlValido ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              SQL PMSP Mod-11: {segurancaResumo.sqlValido ? 'Íntegro' : 'Revisar DV'}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold border ${
                segurancaResumo.matriculaValida
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                  : 'bg-amber-950/70 text-amber-300 border-amber-700/60'
              }`}
            >
              {segurancaResumo.matriculaValida ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
              Livro 2 (LV2): {segurancaResumo.matriculaValida ? 'Validado' : 'Pendente'}
            </span>
          </div>
        )}
      </div>

      {erro && (
        <div className="rounded-xl border border-rose-500/50 bg-rose-950/60 p-4 text-xs text-rose-200 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Lista de Documentos Públicos e seus Comprovantes Oficiais */}
      <div className="space-y-3.5">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2 px-1">
          <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Comprovantes Oficiais Auditados (Download Individual ou em Lote)</span>
        </h4>

        <div className="grid grid-cols-1 gap-3.5">
          {validacoes.map((item, index) => {
            const isConfirmada = item.status === 'AUTENTICIDADE_CONFIRMADA';
            const isRessalva = item.status === 'COM_RESSALVA';

            return (
              <div
                key={item.id}
                className={`rounded-2xl border bg-slate-950/95 p-4 sm:p-5 shadow-md transition-all space-y-3.5 ${
                  isRessalva
                    ? 'border-amber-500/50 hover:border-amber-400/70'
                    : 'border-slate-700/80 hover:border-emerald-500/40'
                }`}
              >
                {/* Header do Card */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-700/80 shrink-0 mt-0.5 ${
                        isRessalva ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      <span className="font-bold text-xs font-mono">{index + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-950/70 border border-cyan-800 px-2 py-0.5 rounded">
                          {item.orgaoSigla}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            isConfirmada
                              ? 'text-emerald-300 bg-emerald-950/80 border-emerald-800'
                              : isRessalva
                              ? 'text-amber-300 bg-amber-950/80 border-amber-700'
                              : 'text-cyan-300 bg-cyan-950/80 border-cyan-800'
                          }`}
                        >
                          {isRessalva ? (
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          )}
                          {isConfirmada
                            ? `Autenticidade Confirmada (${item.orgaoSigla})`
                            : isRessalva
                            ? 'Verificado com Ressalva (Revisar Dígito/Dado)'
                            : 'Integridade Técnica Verificada'}
                        </span>
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-white">
                        {item.documentoTipo}
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5 break-words">
                        {item.documentoDescricao}
                      </p>
                    </div>
                  </div>

                  {/* Botões de Ação do Comprovante Oficial do Órgão Competente */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFormatoVisualizacao('orgao');
                        setVisualizandoItem(item);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 text-slate-200 px-3 py-1.5 text-xs font-semibold transition shadow-sm cursor-pointer"
                      title={`Visualizar comprovante oficial fornecido pelo órgão competente (${item.orgaoCompetente})`}
                    >
                      <Eye className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Visualizar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => baixarComprovanteOficialOrgao(item, 'orgao')}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400/50 text-white px-3 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer"
                      title={`Baixar Comprovante Oficial em PDF fornecido por ${item.orgaoCompetente} (${item.orgaoSigla})`}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Baixar Comprovante ({item.orgaoSigla})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => baixarComprovanteOficialOrgao(item, 'cartorio')}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-950/50 hover:bg-amber-900/60 text-amber-200 px-2.5 py-1.5 text-xs font-semibold transition shadow-sm cursor-pointer"
                      title="Baixar Certidão Registral de Autenticidade emitida pelo 7º RI-SP"
                    >
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Certidão 7º RI</span>
                    </button>

                    <a
                      href={item.linkConsultaOficial}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white px-2.5 py-1.5 text-xs font-medium transition"
                      title={`Abrir portal de validação oficial no órgão competente (${item.orgaoCompetente})`}
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Portal</span>
                    </a>
                  </div>
                </div>

                {/* Grid de Auditoria e Metadados Oficiais (Layout responsivo sem esmagamento) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl bg-slate-900/90 border border-slate-800/80 p-3 space-y-1">
                    <span className="text-[11px] text-slate-400 font-medium block">Órgão Competente & Validador</span>
                    <div className="font-semibold text-slate-100 break-words">{item.orgaoCompetente}</div>
                    <div className="text-[11px] text-slate-400 font-mono break-words">{item.apiValidadora}</div>
                  </div>

                  <div className="rounded-xl bg-slate-900/90 border border-slate-800/80 p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">Código / Chave de Autenticidade</span>
                      <button
                        type="button"
                        onClick={() => copiarTexto(item.id + '_cod', item.codigoAutenticidade)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-0.5 cursor-pointer shrink-0"
                      >
                        {copiadoId === item.id + '_cod' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiadoId === item.id + '_cod' ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <div className="font-mono text-xs font-bold text-cyan-300 break-all">
                      {item.codigoAutenticidade}
                    </div>
                    <div className="text-[11px] text-slate-400">Auditado em {item.dataHoraValidacao}</div>
                  </div>

                  {/* Box deLargura Completa para Hash Criptográfico SHA-256 + Selo HMAC-SHA256 */}
                  <div className="sm:col-span-2 rounded-xl bg-slate-900/95 border border-slate-800 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-300 font-semibold flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Resumo Criptográfico SHA-256 ({item.origemHash || 'Auditado'})</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => copiarTexto(item.id + '_hash', item.hashSha256)}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        {copiadoId === item.id + '_hash' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {copiadoId === item.id + '_hash' ? 'Hash Copiado' : 'Copiar SHA-256'}
                      </button>
                    </div>
                    <div className="font-mono text-[11px] text-slate-200 break-all bg-slate-950/80 border border-slate-800/80 rounded-lg px-2.5 py-1.5 select-all">
                      {item.hashSha256}
                    </div>

                    {item.provaMatematica && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                        <span className="text-emerald-300 font-medium">
                          ✓ Prova Técnica: {item.provaMatematica}
                        </span>
                        {item.seloHmac && (
                          <span className="font-mono text-[10px] text-slate-400">
                            HMAC: {item.seloHmac.slice(0, 16)}…
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Parecer Técnico e Signatários */}
                <div className="rounded-xl bg-slate-900/50 border border-slate-800/80 p-3 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-400 font-medium">Signatários / Origem Verificada:</span>
                    {item.signatarios.map((sig, sidx) => (
                      <span
                        key={sidx}
                        className="rounded-md bg-slate-800 border border-slate-700 px-2 py-0.5 text-[11px] text-slate-200 font-medium break-words"
                      >
                        {sig}
                      </span>
                    ))}
                  </div>

                  <div className="text-slate-300 leading-relaxed text-xs">
                    <strong className="text-slate-200">Parecer Técnico de Segurança:</strong> {item.detalhesTecnicos}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal Embutido para Visualização e Download Imediato do Comprovante Oficial do Órgão Competente */}
      {visualizandoItem && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-md">
          <div className="relative flex flex-col h-[92vh] w-full max-w-4xl rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
            {/* Header do Visualizador */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-950 px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                <div>
                  <div className="font-bold text-white text-sm">
                    {formatoVisualizacao === 'orgao'
                      ? `Comprovante Oficial — ${visualizandoItem.orgaoCompetente} (${visualizandoItem.orgaoSigla})`
                      : 'Certidão Registral de Autenticidade — 7º Oficial de Registro de Imóveis da Capital'}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Chave Oficial: {visualizandoItem.codigoAutenticidade}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setFormatoVisualizacao('orgao')}
                    className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
                      formatoVisualizacao === 'orgao'
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Comprovante do Órgão ({visualizandoItem.orgaoSigla})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormatoVisualizacao('cartorio')}
                    className={`rounded-md px-2.5 py-1 font-bold transition cursor-pointer ${
                      formatoVisualizacao === 'cartorio'
                        ? 'bg-amber-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Certidão 7º RI
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => baixarComprovanteOficialOrgao(visualizandoItem, formatoVisualizacao)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVisualizandoItem(null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-3 py-1.5 text-xs font-bold text-slate-200 hover:text-white transition shadow-sm cursor-pointer"
                  title="Voltar para a tela anterior"
                >
                  <ArrowLeft className="w-4 h-4 text-cyan-400" />
                  <span>Voltar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVisualizandoItem(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  title="Fechar visualizador"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Iframe com o PDF embutido */}
            <div className="flex-1 bg-slate-950">
              <iframe
                src={montarQueryParamsComprovante(visualizandoItem, {
                  download: false,
                  formato: formatoVisualizacao,
                })}
                className="w-full h-full border-none"
                title="Comprovante Oficial de Validação em Órgão Competente"
              />
            </div>

            {/* Rodapé do Visualizador */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 bg-slate-950 px-5 py-3 shrink-0">
              <button
                type="button"
                onClick={() => setVisualizandoItem(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-4 py-1.5 text-xs font-bold text-slate-200 hover:text-white transition shadow cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-cyan-400" />
                <span>Voltar para comprovantes</span>
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => baixarComprovanteOficialOrgao(visualizandoItem, 'orgao')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Comprovante do Órgão ({visualizandoItem.orgaoSigla})</span>
                </button>
                <button
                  type="button"
                  onClick={() => baixarComprovanteOficialOrgao(visualizandoItem, 'cartorio')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/60 hover:bg-amber-900/60 text-amber-200 px-3.5 py-1.5 text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Baixar Certidão 7º RI (PDF)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
