'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search,
  ChevronDown,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Lock,
  Check,
  RotateCcw,
  Loader2,
  AlertCircle,
  Database,
  Bookmark,
  History,
  Printer,
  CheckCircle2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { RegistroRelatorioPersonalizadoDTO } from '@/app/api/relatorios/personalizado/route';

export type ChaveVariavelRelatorio =
  | 'magnetico'
  | 'pedido'
  | 'nome_cliente'
  | 'cpf_cnpj'
  | 'telefone'
  | 'atendente'
  | 'canal_atendimento'
  | 'valor_deposito'
  | 'cota'
  | 'saldo'
  | 'forma_pagamento'
  | 'status'
  | 'data_pedido'
  | 'data_retirada'
  | 'observacoes';

export type CategoriaVariavelId =
  | 'identificacao'
  | 'cliente'
  | 'atendimento'
  | 'financeiro'
  | 'data_hora'
  | 'outros';

export interface DefinicaoVariavelRelatorio {
  id: ChaveVariavelRelatorio;
  rotulo: string;
  categoriaId: CategoriaVariavelId;
  categoriaRotulo: string;
  valorExemplo: string;
  restritaGestor?: boolean;
  statusMapeamentoWebri: 'DISPONIVEL' | 'CONFIRMAR' | 'NAO_ENCONTRADA';
  origemWebriResumo: string;
}

export const CATEGORIAS_VARIAVEIS: Array<{
  id: CategoriaVariavelId;
  rotulo: string;
}> = [
  { id: 'identificacao', rotulo: 'IDENTIFICAÇÃO' },
  { id: 'cliente', rotulo: 'CLIENTE' },
  { id: 'atendimento', rotulo: 'ATENDIMENTO' },
  { id: 'financeiro', rotulo: 'FINANCEIRO' },
  { id: 'data_hora', rotulo: 'DATA/HORA' },
  { id: 'outros', rotulo: 'OUTROS' },
];

export const BIBLIOTECA_VARIAVEIS: DefinicaoVariavelRelatorio[] = [
  // 1. Identificação
  {
    id: 'magnetico',
    rotulo: 'Magnético',
    categoriaId: 'identificacao',
    categoriaRotulo: 'IDENTIFICAÇÃO',
    valorExemplo: 'S26110255021D',
    statusMapeamentoWebri: 'DISPONIVEL',
    origemWebriResumo: 'tblWRICertidao.ProtocoloEntidade',
  },
  {
    id: 'pedido',
    rotulo: 'Pedido',
    categoriaId: 'identificacao',
    categoriaRotulo: 'IDENTIFICAÇÃO',
    valorExemplo: '1.332.477',
    statusMapeamentoWebri: 'DISPONIVEL',
    origemWebriResumo: 'tblWRICertidao.Pk_NrPedido',
  },

  // 2. Cliente
  {
    id: 'nome_cliente',
    rotulo: 'Nome do Cliente',
    categoriaId: 'cliente',
    categoriaRotulo: 'CLIENTE',
    valorExemplo: '—',
    statusMapeamentoWebri: 'DISPONIVEL',
    origemWebriResumo: 'tblWRICertidao.NomeRequerente',
  },
  {
    id: 'cpf_cnpj',
    rotulo: 'CPF/CNPJ',
    categoriaId: 'cliente',
    categoriaRotulo: 'CLIENTE',
    valorExemplo: '—',
    statusMapeamentoWebri: 'DISPONIVEL',
    origemWebriResumo: 'tblWRICertidao.DocumentoRequerente',
  },
  {
    id: 'telefone',
    rotulo: 'Telefone',
    categoriaId: 'cliente',
    categoriaRotulo: 'CLIENTE',
    valorExemplo: '—',
    statusMapeamentoWebri: 'DISPONIVEL',
    origemWebriResumo: 'tblWRICertidao.FoneRequerente',
  },

  // 3. Atendimento
  {
    id: 'atendente',
    rotulo: 'Atendente',
    categoriaId: 'atendimento',
    categoriaRotulo: 'ATENDIMENTO',
    valorExemplo: 'Anne',
    statusMapeamentoWebri: 'DISPONIVEL',
    origemWebriResumo: 'tblSIPUsuarios / pr_Fiorix_BI_Produtividade',
  },
  {
    id: 'canal_atendimento',
    rotulo: 'Canal de Atendimento',
    categoriaId: 'atendimento',
    categoriaRotulo: 'ATENDIMENTO',
    valorExemplo: 'ONR (Eletrônico)',
    statusMapeamentoWebri: 'DISPONIVEL',
    origemWebriResumo: 'Origem ONR (Eletrônico) / PRESENCIAL',
  },

  // 4. Financeiro
  {
    id: 'valor_deposito',
    rotulo: 'Valor de Depósito',
    categoriaId: 'financeiro',
    categoriaRotulo: 'FINANCEIRO',
    valorExemplo: 'R$ 76,54',
    statusMapeamentoWebri: 'DISPONIVEL',
    origemWebriResumo: 'tblWRICertidao.VlrTotalDeposito + VlrTotalCompDep',
  },
  {
    id: 'cota',
    rotulo: 'Cota',
    categoriaId: 'financeiro',
    categoriaRotulo: 'FINANCEIRO',
    valorExemplo: 'R$ 76,54',
    statusMapeamentoWebri: 'DISPONIVEL',
    origemWebriResumo: 'tblWRICertidaoCotas.VlrTotal / tblWRICertidao.VlrTotalCota',
  },
  {
    id: 'saldo',
    rotulo: 'Saldo',
    categoriaId: 'financeiro',
    categoriaRotulo: 'FINANCEIRO',
    valorExemplo: 'R$ 0,00',
    statusMapeamentoWebri: 'DISPONIVEL',
    origemWebriResumo: 'tblWRICertidao.VlrSaldo',
  },
  {
    id: 'forma_pagamento',
    rotulo: 'Forma de Pagamento',
    categoriaId: 'financeiro',
    categoriaRotulo: 'FINANCEIRO',
    valorExemplo: '—',
    statusMapeamentoWebri: 'NAO_ENCONTRADA',
    origemWebriResumo: 'Forma de Pagamento',
  },
  {
    id: 'status',
    rotulo: 'Status',
    categoriaId: 'financeiro',
    categoriaRotulo: 'FINANCEIRO',
    valorExemplo: 'Aguardando conferência',
    statusMapeamentoWebri: 'CONFIRMAR',
    origemWebriResumo: 'Conferência / Estado do Pedido',
  },

  // 5. Data/Hora
  {
    id: 'data_pedido',
    rotulo: 'Data do Pedido',
    categoriaId: 'data_hora',
    categoriaRotulo: 'DATA/HORA',
    valorExemplo: '09/11/2026',
    statusMapeamentoWebri: 'DISPONIVEL',
    origemWebriResumo: 'tblWRICertidao.DataPedido',
  },
  {
    id: 'data_retirada',
    rotulo: 'Data da Retirada',
    categoriaId: 'data_hora',
    categoriaRotulo: 'DATA/HORA',
    valorExemplo: '—',
    statusMapeamentoWebri: 'CONFIRMAR',
    origemWebriResumo: 'tblWRICertidao.DataFinalRetirada / tblWRICertidaoItens.DataRetirada',
  },

  // 6. Outros
  {
    id: 'observacoes',
    rotulo: 'Observações',
    categoriaId: 'outros',
    categoriaRotulo: 'OUTROS',
    valorExemplo: '—',
    statusMapeamentoWebri: 'DISPONIVEL',
    origemWebriResumo: 'tblWRICertidao.ObservacaoPedido',
  },
];

const VARIAVEL_POR_ID = new Map<ChaveVariavelRelatorio, DefinicaoVariavelRelatorio>(
  BIBLIOTECA_VARIAVEIS.map((v) => [v.id, v])
);

const COLUNAS_INICIAIS_PADRAO: ChaveVariavelRelatorio[] = [
  'magnetico',
  'pedido',
  'atendente',
  'data_pedido',
  'valor_deposito',
  'cota',
  'saldo',
  'data_retirada',
];

/** Registro de exemplo para validação visual (não gravado no banco de produção) */
const REGISTRO_EXEMPLO_VALIDACAO: RegistroRelatorioPersonalizadoDTO = {
  id: 'exemplo-prototipo-1332477',
  numeroPedidoRaw: '1332477',
  dataPedidoIso: '2026-11-09',
  origemRaw: 'ONR',
  depositoCentavos: 7654,
  cotaCentavos: 7654,
  saldoCentavos: 0,
  valores: {
    magnetico: 'S26110255021D',
    pedido: '1.332.477',
    nome_cliente: '—',
    cpf_cnpj: '—',
    telefone: '—',
    atendente: 'Anne',
    canal_atendimento: 'ONR (Eletrônico)',
    valor_deposito: 'R$ 76,54',
    cota: 'R$ 76,54',
    saldo: 'R$ 0,00',
    forma_pagamento: '—',
    status: '—',
    data_pedido: '09/11/2026',
    data_retirada: '—',
    observacoes: '—',
  },
};

interface ModeloSalvo {
  id: string;
  nome: string;
  colunas: ChaveVariavelRelatorio[];
  autorNome?: string;
  atualizadoEm: string;
}

interface ItemHistoricoGeracao {
  id: string;
  usuarioNome: string;
  descricao: string;
  detalhes?: {
    formato?: string;
    colunas?: string[];
    filtrosAplicados?: Record<string, any>;
  };
  criadoEm: string;
}

interface RelatorioGeradoSnapshot {
  geradoEm: string;
  nomeModelo: string;
  colunas: ChaveVariavelRelatorio[];
  registros: RegistroRelatorioPersonalizadoDTO[];
  totalRegistros: number;
  totalDepositosCentavos: number;
  totalDepositosFormatado: string;
  totalCotasCentavos: number;
  totalCotasFormatado: string;
  totalSaldosCentavos: number;
  totalSaldosFormatado: string;
  filtrosResumo: string;
}

export function ConstrutorRelatorioPersonalizadoClient({
  usuarioNomeInicial,
  usuarioRoleInicial: _usuarioRoleInicial,
  isGestorRealInicial,
}: {
  usuarioNomeInicial: string;
  usuarioRoleInicial: string;
  isGestorRealInicial: boolean;
}) {
  const [buscaVariavel, setBuscaVariavel] = useState('');
  const [variaveisVisiveis, setVariaveisVisiveis] = useState(false);
  const [colunasSelecionadas, setColunasSelecionadas] = useState<ChaveVariavelRelatorio[]>(
    COLUNAS_INICIAIS_PADRAO
  );
  const [categoriasAbertas, setCategoriasAbertas] = useState<Record<CategoriaVariavelId, boolean>>({
    identificacao: true,
    cliente: true,
    atendimento: true,
    financeiro: true,
    data_hora: true,
    outros: true,
  });

  // Modo de visualização: 'WEBRI_REAL' (consulta real ao banco) ou 'EXEMPLO' (protótipo 1.332.477)
  const [modoFonteDados, setModoFonteDados] = useState<'EXEMPLO' | 'WEBRI_REAL'>('WEBRI_REAL');

  // Drag and drop state
  const [indiceArrastando, setIndiceArrastando] = useState<number | null>(null);

  // Modelos salvos
  const [nomeModeloInput, setNomeModeloInput] = useState('');
  const [modelosSalvos, setModelosSalvos] = useState<ModeloSalvo[]>([]);
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState<string>('');
  const [salvandoModelo, setSalvandoModelo] = useState(false);

  // Dados reais do Webri e filtros
  const [carregandoReais, setCarregandoReais] = useState(false);
  const [erroCargaReais, setErroCargaReais] = useState<string | null>(null);
  const [registrosReais, setRegistrosReais] = useState<RegistroRelatorioPersonalizadoDTO[]>([]);
  const [totalDepositosReaisCentavos, setTotalDepositosReaisCentavos] = useState<number>(0);
  const [atendentesDisponiveis, setAtendentesDisponiveis] = useState<string[]>([]);

  const [filtroDataInicial, setFiltroDataInicial] = useState('');
  const [filtroDataFinal, setFiltroDataFinal] = useState('');
  const [filtroAtendente, setFiltroAtendente] = useState('');
  const [filtroCanalAtendimento, setFiltroCanalAtendimento] = useState<'' | 'ONR' | 'PRESENCIAL'>('');
  const [filtroMagnetico, setFiltroMagnetico] = useState('');
  const [filtroPedido, setFiltroPedido] = useState('');
  const [limiteRegistros, setLimiteRegistros] = useState<number>(0);

  // Histórico de geração e modal/documento de Relatório Gerado
  const [historicoGeracoes, setHistoricoGeracoes] = useState<ItemHistoricoGeracao[]>([]);
  const [historicoVisivel, setHistoricoVisivel] = useState(false);
  const [gerandoRelatorio, setGerandoRelatorio] = useState(false);
  const [relatorioGeradoSnapshot, setRelatorioGeradoSnapshot] =
    useState<RelatorioGeradoSnapshot | null>(null);
  const [modalRelatorioAberto, setModalRelatorioAberto] = useState(false);
  const [buscaNoRelatorioGerado, setBuscaNoRelatorioGerado] = useState('');
  const [paginaRelatorioGerado, setPaginaRelatorioGerado] = useState(1);

  const podeAcessarVariavel = useCallback(
    (_variavel: DefinicaoVariavelRelatorio) => {
      return true;
    },
    []
  );

  const possuiPeriodoSelecionado = Boolean(filtroDataInicial && filtroDataFinal);

  const consultarDadosReaisServidor = useCallback(async () => {
    const temDatasCompletas = Boolean(filtroDataInicial && filtroDataFinal);

    if (!temDatasCompletas) {
      setRegistrosReais([]);
      setTotalDepositosReaisCentavos(0);
    } else {
      setCarregandoReais(true);
    }
    setErroCargaReais(null);

    try {
      const qs = new URLSearchParams();
      if (filtroDataInicial) qs.set('dataInicial', filtroDataInicial);
      if (filtroDataFinal) qs.set('dataFinal', filtroDataFinal);
      if (filtroAtendente) qs.set('atendente', filtroAtendente);
      if (filtroCanalAtendimento) qs.set('canalAtendimento', filtroCanalAtendimento);
      if (filtroMagnetico.trim()) qs.set('magnetico', filtroMagnetico.trim());
      if (filtroPedido.trim()) qs.set('pedido', filtroPedido.trim());

      const res = await fetch(`/api/relatorios/personalizado?${qs.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !data.sucesso) {
        throw new Error(data.erro || 'Erro ao carregar dados do Webri.');
      }

      if (temDatasCompletas) {
        setRegistrosReais(Array.isArray(data.registros) ? data.registros : []);
        setTotalDepositosReaisCentavos(Number(data.totalDepositosCentavos || 0));
      } else {
        setRegistrosReais([]);
        setTotalDepositosReaisCentavos(0);
      }

      setAtendentesDisponiveis(
        Array.isArray(data.atendentesDisponiveis) ? data.atendentesDisponiveis : []
      );
      if (Array.isArray(data.modelosSalvos) && data.modelosSalvos.length > 0) {
        const modelosFiltrados = data.modelosSalvos.map((m: ModeloSalvo) => ({
          ...m,
          colunas: (m.colunas || []).filter((c) => VARIAVEL_POR_ID.has(c)),
        }));
        setModelosSalvos(modelosFiltrados);
        setModeloSelecionadoId((prev) => prev || modelosFiltrados[0]?.id || '');
      }
      if (Array.isArray(data.historicoGeracoes)) {
        setHistoricoGeracoes(data.historicoGeracoes);
      }
    } catch (err: any) {
      if (temDatasCompletas) {
        setErroCargaReais(err?.message || 'Falha ao consultar dados reais.');
      }
    } finally {
      setCarregandoReais(false);
    }
  }, [
    filtroDataInicial,
    filtroDataFinal,
    filtroAtendente,
    filtroCanalAtendimento,
    filtroMagnetico,
    filtroPedido,
  ]);

  useEffect(() => {
    consultarDadosReaisServidor();
  }, [consultarDadosReaisServidor]);

  // Registros brutos retornados pela fonte ativa (em WEBRI_REAL, somente após escolher Data Inicial e Data Final)
  const registrosBrutosFonte = useMemo<RegistroRelatorioPersonalizadoDTO[]>(() => {
    if (modoFonteDados === 'EXEMPLO') {
      return [REGISTRO_EXEMPLO_VALIDACAO];
    }
    if (!possuiPeriodoSelecionado) {
      return [];
    }
    return registrosReais;
  }, [modoFonteDados, possuiPeriodoSelecionado, registrosReais]);

  // Registros efetivamente exibidos e somados no relatório (respeitando o limite selecionado, padrão 25 pedidos)
  const registrosAtivos = useMemo<RegistroRelatorioPersonalizadoDTO[]>(() => {
    if (modoFonteDados === 'EXEMPLO') {
      return [REGISTRO_EXEMPLO_VALIDACAO];
    }
    if (limiteRegistros > 0) {
      return registrosBrutosFonte.slice(0, limiteRegistros);
    }
    return registrosBrutosFonte;
  }, [modoFonteDados, registrosBrutosFonte, limiteRegistros]);

  const amostraPrevia = registrosAtivos;

  // Soma exata em centavos dos registros filtrados/exibidos na tabela
  const totalDepositosCentavosAtivo = useMemo(() => {
    if (modoFonteDados === 'EXEMPLO') {
      return 7654;
    }
    return registrosAtivos.reduce(
      (acc, item) => acc + (item.depositoCentavos ?? 0),
      0
    );
  }, [modoFonteDados, registrosAtivos]);

  const totalCotasCentavosAtivo = useMemo(() => {
    if (modoFonteDados === 'EXEMPLO') {
      return 7654;
    }
    return registrosAtivos.reduce(
      (acc, item) => acc + (item.cotaCentavos ?? 0),
      0
    );
  }, [modoFonteDados, registrosAtivos]);

  const totalSaldosCentavosAtivo = useMemo(() => {
    if (modoFonteDados === 'EXEMPLO') {
      return 0;
    }
    return registrosAtivos.reduce(
      (acc, item) => acc + (item.saldoCentavos ?? 0),
      0
    );
  }, [modoFonteDados, registrosAtivos]);

  const totalDepositosFormatado = useMemo(() => {
    return (totalDepositosCentavosAtivo / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [totalDepositosCentavosAtivo]);

  const totalCotasFormatado = useMemo(() => {
    return (totalCotasCentavosAtivo / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [totalCotasCentavosAtivo]);

  const totalSaldosFormatado = useMemo(() => {
    return (totalSaldosCentavosAtivo / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [totalSaldosCentavosAtivo]);

  const colunaValorDepositoSelecionada = colunasSelecionadas.includes('valor_deposito');
  const colunaCotaSelecionada = colunasSelecionadas.includes('cota');
  const colunaSaldoSelecionada = colunasSelecionadas.includes('saldo');
  const algumaColunaFinanceiraSelecionada =
    colunaValorDepositoSelecionada || colunaCotaSelecionada || colunaSaldoSelecionada;

  const registroBaseFoco = registrosAtivos[0] || REGISTRO_EXEMPLO_VALIDACAO;

  const alternarVariavel = (id: ChaveVariavelRelatorio) => {
    const def = VARIAVEL_POR_ID.get(id);
    if (!def) return;
    if (!podeAcessarVariavel(def)) {
      toast.error(`A variável "${def.rotulo}" é exclusiva do perfil Gestor.`);
      return;
    }

    setColunasSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selecionarTodasPermitidas = () => {
    const permitidas = BIBLIOTECA_VARIAVEIS.filter((v) => podeAcessarVariavel(v)).map(
      (v) => v.id
    );
    setColunasSelecionadas(permitidas);
    toast.success(`${permitidas.length} variáveis selecionadas.`);
  };

  const limparSelecao = () => {
    setColunasSelecionadas([]);
  };

  const moverColuna = (index: number, direcao: -1 | 1) => {
    const destino = index + direcao;
    if (destino < 0 || destino >= colunasSelecionadas.length) return;
    setColunasSelecionadas((prev) => {
      const copia = [...prev];
      const [item] = copia.splice(index, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
  };

  const handleDropColuna = (indiceAlvo: number) => {
    if (indiceArrastando === null || indiceArrastando === indiceAlvo) {
      setIndiceArrastando(null);
      return;
    }
    setColunasSelecionadas((prev) => {
      const copia = [...prev];
      const [movido] = copia.splice(indiceArrastando, 1);
      copia.splice(indiceAlvo, 0, movido);
      return copia;
    });
    setIndiceArrastando(null);
  };

  const handleSalvarModelo = async () => {
    const nomeLimpo = nomeModeloInput.trim();
    if (!nomeLimpo) {
      toast.error('Informe um nome para o modelo antes de salvar.');
      return;
    }
    if (colunasSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma coluna antes de salvar o modelo.');
      return;
    }

    setSalvandoModelo(true);
    try {
      const res = await fetch('/api/relatorios/personalizado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SALVAR_MODELO',
          nome: nomeLimpo,
          colunas: colunasSelecionadas,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.sucesso) {
        throw new Error(data.erro || 'Não foi possível salvar o modelo.');
      }

      const listaLimpa = (data.modelosSalvos || []).map((m: ModeloSalvo) => ({
        ...m,
        colunas: (m.colunas || []).filter((c) => VARIAVEL_POR_ID.has(c)),
      }));
      setModelosSalvos(listaLimpa);
      if (data.modelo?.id) {
        setModeloSelecionadoId(data.modelo.id);
      }
      toast.success(`Modelo "${nomeLimpo}" salvo com ${colunasSelecionadas.length} coluna(s).`);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao salvar modelo.');
    } finally {
      setSalvandoModelo(false);
    }
  };

  const handleAplicarModelo = (modeloAlvo?: ModeloSalvo) => {
    const mod =
      modeloAlvo ||
      modelosSalvos.find((m) => m.id === modeloSelecionadoId) ||
      modelosSalvos[0];
    if (!mod) {
      toast.error('Nenhum modelo salvo selecionado para aplicar.');
      return;
    }

    const colunasValidas = mod.colunas.filter((colId) => {
      const def = VARIAVEL_POR_ID.get(colId);
      return def && podeAcessarVariavel(def);
    });

    if (colunasValidas.length === 0) {
      toast.error('Este modelo não possui colunas válidas para o seu perfil.');
      return;
    }

    setColunasSelecionadas(colunasValidas);
    setNomeModeloInput(mod.nome);
    toast.success(`Modelo "${mod.nome}" aplicado (${colunasValidas.length} colunas).`);
  };

  const montarResumoFiltros = useCallback(() => {
    if (modoFonteDados === 'EXEMPLO') {
      return 'Modo Exemplo do Protótipo (Pedido 1.332.477)';
    }
    const partes: string[] = [];
    if (filtroDataInicial || filtroDataFinal) {
      const di = filtroDataInicial
        ? filtroDataInicial.split('-').reverse().join('/')
        : 'Início';
      const df = filtroDataFinal
        ? filtroDataFinal.split('-').reverse().join('/')
        : 'Hoje';
      partes.push(`Período: ${di} até ${df}`);
    }
    if (filtroCanalAtendimento === 'ONR') {
      partes.push('Canal: ONR (Eletrônico)');
    } else if (filtroCanalAtendimento === 'PRESENCIAL') {
      partes.push('Canal: PRESENCIAL');
    } else {
      partes.push('Canal: Todos');
    }
    if (filtroAtendente) partes.push(`Atendente: ${filtroAtendente}`);
    if (filtroMagnetico.trim()) partes.push(`Magnético: ${filtroMagnetico.trim()}`);
    if (filtroPedido.trim()) partes.push(`Pedido: ${filtroPedido.trim()}`);
    return partes.join(' · ');
  }, [
    modoFonteDados,
    filtroDataInicial,
    filtroDataFinal,
    filtroCanalAtendimento,
    filtroAtendente,
    filtroMagnetico,
    filtroPedido,
  ]);

  const registrarAuditoriaGeracao = async (formato: 'RELATORIO' | 'PDF' | 'EXCEL') => {
    const res = await fetch('/api/relatorios/personalizado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'REGISTRAR_GERACAO',
        formato,
        colunas: colunasSelecionadas,
        filtros: {
          modoFonteDados,
          dataInicial: filtroDataInicial || null,
          dataFinal: filtroDataFinal || null,
          canalAtendimento: filtroCanalAtendimento || 'TODOS',
          atendente: filtroAtendente || null,
          magnetico: filtroMagnetico || null,
          pedido: filtroPedido || null,
        },
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.sucesso) {
      throw new Error(data.erro || 'Falha na validação de segurança do servidor.');
    }
    if (data.itemHistorico) {
      setHistoricoGeracoes((prev) => [data.itemHistorico, ...prev].slice(0, 15));
    }
  };

  const handleGerarRelatorio = async () => {
    if (colunasSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma coluna para gerar o relatório.');
      return;
    }
    if (modoFonteDados === 'WEBRI_REAL' && !possuiPeriodoSelecionado) {
      toast.error('Selecione a Data Inicial e a Data Final nos filtros para carregar os resultados.');
      return;
    }
    if (registrosAtivos.length === 0) {
      toast.error('Não há registros para os filtros selecionados.');
      return;
    }

    setGerandoRelatorio(true);
    try {
      await registrarAuditoriaGeracao('RELATORIO');
      const snapshot: RelatorioGeradoSnapshot = {
        geradoEm: new Date().toLocaleString('pt-BR'),
        nomeModelo: nomeModeloInput.trim() || 'Relatório Personalizado',
        colunas: [...colunasSelecionadas],
        registros: [...registrosAtivos],
        totalRegistros: registrosAtivos.length,
        totalDepositosCentavos: totalDepositosCentavosAtivo,
        totalDepositosFormatado,
        totalCotasCentavos: totalCotasCentavosAtivo,
        totalCotasFormatado,
        totalSaldosCentavos: totalSaldosCentavosAtivo,
        totalSaldosFormatado,
        filtrosResumo: montarResumoFiltros(),
      };
      setRelatorioGeradoSnapshot(snapshot);
      setBuscaNoRelatorioGerado('');
      setPaginaRelatorioGerado(1);
      setModalRelatorioAberto(true);
      toast.success(
        `Relatório gerado com sucesso (${registrosAtivos.length} registro(s) e ${colunasSelecionadas.length} coluna(s)).`
      );
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao gerar relatório.');
    } finally {
      setGerandoRelatorio(false);
    }
  };

  const handleExportarPdf = async () => {
    if (colunasSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma coluna para exportar em PDF.');
      return;
    }
    if (modoFonteDados === 'WEBRI_REAL' && !possuiPeriodoSelecionado) {
      toast.error('Selecione a Data Inicial e a Data Final nos filtros antes de exportar em PDF.');
      return;
    }
    if (registrosAtivos.length === 0) {
      toast.error('Não há registros para exportar.');
      return;
    }

    setGerandoRelatorio(true);
    try {
      await registrarAuditoriaGeracao('PDF');

      const orientacao = colunasSelecionadas.length > 6 ? 'landscape' : 'portrait';
      const doc = new jsPDF({
        orientation: orientacao,
        unit: 'pt',
        format: 'a4',
      });

      const cabecalhos = colunasSelecionadas.map(
        (id) => VARIAVEL_POR_ID.get(id)?.rotulo || id
      );
      const linhas = registrosAtivos.map((reg) =>
        colunasSelecionadas.map((id) => reg.valores[id] ?? '—')
      );

      const tituloRelatorio =
        nomeModeloInput.trim() || 'Relatório Personalizado';
      const codigoRastreioPdf = `FRX-CV-${Date.now().toString(36).toUpperCase()}`;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(109, 40, 217);
      doc.text(
        '7º OFICIAL DE REGISTRO DE IMÓVEIS DE SÃO PAULO/SP  •  PLATAFORMA FIORIX / CARTÓRIO VIRTUAL',
        40,
        28
      );

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text(tituloRelatorio, 40, 44);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(90, 95, 115);
      doc.text(
        `Emitido em: ${new Date().toLocaleString('pt-BR')}   •   Responsável: ${usuarioNomeInicial}   •   Registros: ${registrosAtivos.length}   •   Protocolo: ${codigoRastreioPdf}`,
        40,
        58
      );
      doc.text(
        `Origem: Base Oficial do Sistema Registral WEBRI (Módulo de Certidões / ONR / Recepção)   •   ${montarResumoFiltros()}`,
        40,
        70
      );

      autoTable(doc, {
        startY: 82,
        head: [cabecalhos],
        body: linhas,
        styles: {
          fontSize: 8.5,
          cellPadding: 5.5,
          textColor: [30, 35, 50],
        },
        headStyles: {
          fillColor: [109, 40, 217],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 247, 252],
        },
      });

      const finalTabelaY = (doc as any).lastAutoTable?.finalY || 120;
      let cursorRodapeY = finalTabelaY + 20;

      if (algumaColunaFinanceiraSelecionada) {
        const resumosPdf: string[] = [];
        if (colunaValorDepositoSelecionada) {
          resumosPdf.push(`Total Depósitos: ${totalDepositosFormatado}`);
        }
        if (colunaCotaSelecionada) {
          resumosPdf.push(`Total Cota: ${totalCotasFormatado}`);
        }
        if (colunaSaldoSelecionada) {
          resumosPdf.push(`Saldo Total: ${totalSaldosFormatado}`);
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10.5);
        doc.setTextColor(15, 118, 110);
        doc.text(
          `Totais (${registrosAtivos.length} pedido(s) único(s)):   ${resumosPdf.join('   •   ')}`,
          40,
          cursorRodapeY
        );
        cursorRodapeY += 18;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      doc.text(
        'DECLARAÇÃO DE ORIGEM, INTEGRIDADE E RASTREABILIDADE (LEI Nº 6.015/1973 E PROVIMENTO CNJ Nº 149/2023):',
        40,
        cursorRodapeY
      );
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'Documento administrativo e contábil extraído eletronicamente da base oficial do sistema registral WEBRI (SQL Server — Módulo de Certidões e Caixa),',
        40,
        cursorRodapeY + 11
      );
      doc.text(
        `integrado e auditado pela plataforma FIORIX (Cartório Virtual), sem duplicidade de protocolo. Código de Rastreabilidade: ${codigoRastreioPdf}.`,
        40,
        cursorRodapeY + 21
      );

      const dataStr = new Date().toISOString().slice(0, 10);
      const slugNome = (nomeModeloInput.trim() || 'relatorio-personalizado')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      doc.save(`fiorix-${slugNome || 'relatorio'}-${dataStr}.pdf`);
      toast.success('Arquivo PDF exportado com sucesso.');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao exportar PDF.');
    } finally {
      setGerandoRelatorio(false);
    }
  };

  const handleExportarExcel = async () => {
    if (colunasSelecionadas.length === 0) {
      toast.error('Selecione pelo menos uma coluna para exportar em Excel.');
      return;
    }
    if (modoFonteDados === 'WEBRI_REAL' && !possuiPeriodoSelecionado) {
      toast.error('Selecione a Data Inicial e a Data Final nos filtros antes de exportar em Excel.');
      return;
    }
    if (registrosAtivos.length === 0) {
      toast.error('Não há registros para exportar.');
      return;
    }

    setGerandoRelatorio(true);
    try {
      await registrarAuditoriaGeracao('EXCEL');

      const cabecalhos = colunasSelecionadas.map(
        (id) => VARIAVEL_POR_ID.get(id)?.rotulo || id
      );

      const aoa: any[][] = [cabecalhos];

      for (const reg of registrosAtivos) {
        const linha = colunasSelecionadas.map((colId) => {
          if (colId === 'valor_deposito') {
            return reg.depositoCentavos !== null ? reg.depositoCentavos / 100 : '—';
          }
          if (colId === 'cota') {
            return reg.cotaCentavos !== null ? reg.cotaCentavos / 100 : '—';
          }
          if (colId === 'saldo') {
            return reg.saldoCentavos !== null ? reg.saldoCentavos / 100 : '—';
          }
          // Mantém identificadores (Magnético, Pedido, CPF/CNPJ) estritamente como texto
          return String(reg.valores[colId] ?? '—');
        });
        aoa.push(linha);
      }

      if (algumaColunaFinanceiraSelecionada) {
        aoa.push([]);
        const linhaTotal = colunasSelecionadas.map((colId, idx) => {
          if (colId === 'valor_deposito') return totalDepositosCentavosAtivo / 100;
          if (colId === 'cota') return totalCotasCentavosAtivo / 100;
          if (colId === 'saldo') return totalSaldosCentavosAtivo / 100;
          if (idx === 0) return 'Totais consolidados do relatório';
          return '';
        });
        aoa.push(linhaTotal);
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // Formata células monetárias com máscara numérica R$ #.##0,00 e identificadores como texto ('s')
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let R = 1; R <= range.e.r; R++) {
        for (let C = 0; C <= range.e.c; C++) {
          const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[cellRef];
          if (!cell) continue;
          const colId = colunasSelecionadas[C];
          if (
            (colId === 'valor_deposito' || colId === 'cota' || colId === 'saldo') &&
            typeof cell.v === 'number'
          ) {
            cell.t = 'n';
            cell.z = 'R$ #,##0.00';
          } else if (
            colId === 'magnetico' ||
            colId === 'pedido' ||
            colId === 'cpf_cnpj'
          ) {
            cell.t = 's';
          }
        }
      }

      ws['!cols'] = colunasSelecionadas.map((colId) => ({
        wch:
          colId === 'nome_cliente' || colId === 'observacoes'
            ? 34
            : colId === 'magnetico' || colId === 'valor_deposito' || colId === 'canal_atendimento'
            ? 22
            : 18,
      }));

      const wb = XLSX.utils.book_new();
      const nomeAba = (nomeModeloInput.trim() || 'Relatorio Personalizado').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, nomeAba);
      const dataStr = new Date().toISOString().slice(0, 10);
      const slugNome = (nomeModeloInput.trim() || 'relatorio-personalizado')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      XLSX.writeFile(wb, `fiorix-${slugNome || 'relatorio'}-${dataStr}.xlsx`);
      toast.success('Planilha Excel (.xlsx) exportada com sucesso.');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao exportar Excel (.xlsx).');
    } finally {
      setGerandoRelatorio(false);
    }
  };

  // Filtragem e paginação dentro do modal de Relatório Gerado
  const registrosRelatorioGeradoFiltrados = useMemo(() => {
    if (!relatorioGeradoSnapshot) return [];
    const q = buscaNoRelatorioGerado.trim().toLowerCase();
    if (!q) return relatorioGeradoSnapshot.registros;
    return relatorioGeradoSnapshot.registros.filter((reg) =>
      relatorioGeradoSnapshot.colunas.some((colId) =>
        String(reg.valores[colId] ?? '')
          .toLowerCase()
          .includes(q)
      )
    );
  }, [relatorioGeradoSnapshot, buscaNoRelatorioGerado]);

  const ITENS_POR_PAGINA_RELATORIO = 50;
  const totalPaginasRelatorioGerado = Math.max(
    1,
    Math.ceil(registrosRelatorioGeradoFiltrados.length / ITENS_POR_PAGINA_RELATORIO)
  );
  const registrosRelatorioGeradoPaginados = useMemo(() => {
    const ini = (paginaRelatorioGerado - 1) * ITENS_POR_PAGINA_RELATORIO;
    return registrosRelatorioGeradoFiltrados.slice(ini, ini + ITENS_POR_PAGINA_RELATORIO);
  }, [registrosRelatorioGeradoFiltrados, paginaRelatorioGerado]);

  const handleImprimirRelatorio = useCallback(() => {
    const regsParaImprimir = relatorioGeradoSnapshot
      ? registrosRelatorioGeradoFiltrados
      : registrosAtivos;
    const colsParaImprimir = relatorioGeradoSnapshot
      ? relatorioGeradoSnapshot.colunas
      : colunasSelecionadas;
    const tituloDoc = relatorioGeradoSnapshot
      ? relatorioGeradoSnapshot.nomeModelo
      : nomeModeloInput.trim() || 'Relatório Personalizado';
    const geradoEmStr = relatorioGeradoSnapshot
      ? relatorioGeradoSnapshot.geradoEm
      : new Date().toLocaleString('pt-BR');
    const filtrosStr = relatorioGeradoSnapshot
      ? relatorioGeradoSnapshot.filtrosResumo
      : montarResumoFiltros();

    const somaCentavosImpressao = regsParaImprimir.reduce(
      (acc, item) => acc + (item.depositoCentavos ?? 0),
      0
    );
    const somaFormatadaImpressao = (somaCentavosImpressao / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const somaCotaCentavosImpressao = regsParaImprimir.reduce(
      (acc, item) => acc + (item.cotaCentavos ?? 0),
      0
    );
    const somaCotaFormatadaImpressao = (somaCotaCentavosImpressao / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const somaSaldoCentavosImpressao = regsParaImprimir.reduce(
      (acc, item) => acc + (item.saldoCentavos ?? 0),
      0
    );
    const somaSaldoFormatadaImpressao = (somaSaldoCentavosImpressao / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const escaparHtml = (texto: string) =>
      String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const thsHtml = [
      '<th style="width:36px;text-align:center;">#</th>',
      ...colsParaImprimir.map((colId) => {
        const rotulo = VARIAVEL_POR_ID.get(colId)?.rotulo || colId;
        return `<th>${escaparHtml(rotulo)}</th>`;
      }),
    ].join('');

    const trsHtml = regsParaImprimir
      .map((reg, index) => {
        const tds = colsParaImprimir
          .map((colId) => {
            const val = reg.valores[colId] ?? '—';
            const isDep = colId === 'valor_deposito' && val !== '—';
            const isCota = colId === 'cota' && val !== '—';
            const isSaldo = colId === 'saldo' && val !== '—';
            const isNeg = isSaldo && (reg.saldoCentavos ?? 0) < 0;
            const styleStr = isDep
              ? 'font-weight:700;color:#047857;'
              : isCota
              ? 'font-weight:700;color:#6d28d9;'
              : isNeg
              ? 'font-weight:700;color:#dc2626;'
              : isSaldo
              ? 'font-weight:700;color:#0f172a;'
              : val === '—'
              ? 'color:#94a3b8;'
              : '';
            return `<td style="${styleStr}">${escaparHtml(val)}</td>`;
          })
          .join('');
        return `<tr><td style="text-align:center;color:#64748b;font-family:monospace;">${
          index + 1
        }</td>${tds}</tr>`;
      })
      .join('');

    const mostrarRodapeFinanceiro =
      colsParaImprimir.includes('valor_deposito') ||
      colsParaImprimir.includes('cota') ||
      colsParaImprimir.includes('saldo');
    const codigoRastreabilidade = `FRX-CV-${Date.now().toString(36).toUpperCase()}`;

    const htmlImpressao = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${escaparHtml(tituloDoc)}</title>
  <style>
    @page {
      size: A4 ${colsParaImprimir.length > 6 ? 'landscape' : 'portrait'};
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      font-size: 10.5px;
    }
    .institucional-topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 5px;
      margin-bottom: 7px;
      font-size: 9px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #334155;
      font-weight: 700;
    }
    .header {
      border-bottom: 2px solid #ddd6fe;
      padding-bottom: 8px;
      margin-bottom: 9px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }
    .badge {
      display: inline-block;
      background: #d1fae5;
      color: #065f46;
      border: 1px solid #6ee7b7;
      border-radius: 999px;
      padding: 1.5px 8px;
      font-size: 8.5px;
      font-weight: 700;
      margin-bottom: 3px;
    }
    h1 {
      margin: 0 0 3px 0;
      font-size: 15px;
      font-weight: 800;
      color: #0f172a;
    }
    .meta {
      margin: 0;
      font-size: 9.5px;
      color: #475569;
      line-height: 1.35;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th {
      background: #f4f0ff;
      color: #2e1065;
      font-weight: 700;
      text-align: left;
      padding: 5px 7px;
      border-bottom: 1.5px solid #c4b5fd;
      white-space: nowrap;
    }
    td {
      padding: 4.5px 7px;
      border-bottom: 1px solid #e2e8f0;
      white-space: nowrap;
    }
    tbody tr:nth-child(even) {
      background: #faf9fe;
    }
    .footer-total {
      margin-top: 9px;
      padding: 8px 12px;
      background: #f4f0ff;
      border: 1.5px solid #c4b5fd;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .footer-title {
      font-size: 10.5px;
      font-weight: 800;
      color: #0f172a;
    }
    .footer-sub {
      font-size: 9.5px;
      color: #475569;
      margin-top: 1px;
    }
    .footer-value {
      font-size: 16px;
      font-weight: 800;
      color: #047857;
    }
    .origem-juridica {
      margin-top: 8px;
      padding: 7px 11px;
      border: 1px solid #cbd5e1;
      border-left: 3.5px solid #4c1d95;
      border-radius: 6px;
      background: #f8fafc;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .origem-juridica-titulo {
      font-size: 8.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #1e293b;
      margin-bottom: 2px;
    }
    .origem-juridica-texto {
      font-size: 8.3px;
      color: #475569;
      line-height: 1.35;
      margin: 0;
    }
    .origem-juridica-rodape {
      margin-top: 4px;
      padding-top: 4px;
      border-top: 1px dashed #cbd5e1;
      display: flex;
      justify-content: space-between;
      font-size: 8px;
      color: #64748b;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="institucional-topbar">
    <span>7º Oficial de Registro de Imóveis da Comarca da Capital — São Paulo/SP</span>
    <span>Plataforma FIORIX · Governança Registral &amp; Cartório Virtual</span>
  </div>

  <div class="header">
    <div>
      <span class="badge">Relatório Oficial Auditado · Base Registral WEBRI</span>
      <h1>${escaparHtml(tituloDoc)}</h1>
      <p class="meta">
        Emitido em <strong>${escaparHtml(geradoEmStr)}</strong> por <strong>${escaparHtml(
      usuarioNomeInicial
    )}</strong> · ${escaparHtml(filtrosStr)}<br/>
        <strong>Origem Oficial dos Dados:</strong> Sistema Registral <strong>WEBRI (SQL Server — Módulo de Certidões, ONR e Caixa)</strong> sincronizado ao Cartório Virtual FIORIX.
      </p>
    </div>
    <div style="text-align:right;font-size:9.5px;color:#475569;white-space:nowrap;">
      <strong>${regsParaImprimir.length}</strong> pedido(s) listado(s)<br/>
      <span style="font-family:monospace;font-size:8.5px;color:#64748b;">${codigoRastreabilidade}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>${thsHtml}</tr>
    </thead>
    <tbody>
      ${trsHtml}
    </tbody>
  </table>

  ${
    mostrarRodapeFinanceiro
      ? `<div class="footer-total">
          <div>
            <div class="footer-title">Resumo financeiro consolidado do relatório</div>
            <div class="footer-sub">Somatório de ${regsParaImprimir.length} pedido(s) único(s)</div>
          </div>
          <div style="display:flex;gap:18px;align-items:center;">
            ${
              colsParaImprimir.includes('valor_deposito')
                ? `<div style="text-align:right;"><div style="font-size:9px;color:#475569;font-weight:700;">TOTAL DEPÓSITOS</div><div class="footer-value">${escaparHtml(
                    somaFormatadaImpressao
                  )}</div></div>`
                : ''
            }
            ${
              colsParaImprimir.includes('cota')
                ? `<div style="text-align:right;"><div style="font-size:9px;color:#475569;font-weight:700;">TOTAL COTA</div><div class="footer-value" style="color:#6d28d9;">${escaparHtml(
                    somaCotaFormatadaImpressao
                  )}</div></div>`
                : ''
            }
            ${
              colsParaImprimir.includes('saldo')
                ? `<div style="text-align:right;"><div style="font-size:9px;color:#475569;font-weight:700;">SALDO TOTAL</div><div class="footer-value" style="color:${
                    somaSaldoCentavosImpressao < 0 ? '#dc2626' : '#0f172a'
                  };">${escaparHtml(somaSaldoFormatadaImpressao)}</div></div>`
                : ''
            }
          </div>
        </div>`
      : ''
  }

  <div class="origem-juridica">
    <div class="origem-juridica-titulo">
      Declaração de Origem, Integridade e Rastreabilidade Registral (Lei nº 6.015/1973 e Provimento CNJ nº 149/2023)
    </div>
    <p class="origem-juridica-texto">
      Este instrumento administrativo e contábil foi extraído eletronicamente a partir dos assentamentos operacionais do sistema registral
      <strong>WEBRI (Banco de Dados Oficial da Serventia — Módulo de Certidões, Recepção e Operador Nacional do Sistema de Registro Eletrônico de Imóveis — ONR)</strong>,
      processado e auditado pela plataforma <strong>FIORIX — Gestão da Qualidade e Governança Cartorária</strong>, com apuração individualizada por número de pedido sem duplicidade de protocolo, para fins de conferência financeira, escrituração interna e controle oficial da serventia.
    </p>
    <div class="origem-juridica-rodape">
      <span>ORIGEM TÉCNICA: SRVSQL\\WEBRI (dbo.tblWRICertidao) &rarr; FIORIX CARTÓRIO VIRTUAL</span>
      <span>OPERADOR: ${escaparHtml(usuarioNomeInicial.toUpperCase())}</span>
      <span>AUTENTICAÇÃO INTERNA: ${codigoRastreabilidade}</span>
    </div>
  </div>
</body>
</html>`;

    const iframeAntigo = document.getElementById('fiorix-print-relatorio-iframe');
    if (iframeAntigo) {
      iframeAntigo.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'fiorix-print-relatorio-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      toast.error('Não foi possível preparar a janela de impressão.');
      return;
    }

    doc.open();
    doc.write(htmlImpressao);
    doc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 180);
  }, [
    relatorioGeradoSnapshot,
    registrosRelatorioGeradoFiltrados,
    registrosAtivos,
    colunasSelecionadas,
    nomeModeloInput,
    montarResumoFiltros,
    usuarioNomeInicial,
  ]);

  return (
    <div className="min-h-screen bg-[#070A12] text-white font-sans pb-14">
      {/* Barra superior no padrão escuro do FIORIX */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0B1020]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/cartorio-virtual"
              className="inline-flex items-center gap-1.5 text-sm font-black tracking-tight text-cyan-400 hover:text-cyan-300 transition"
            >
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>Fiorix</span>
            </Link>

            <span className="text-xs text-slate-400">
              <Link href="/cartorio-virtual" className="hover:underline text-slate-300">
                Cartório Virtual
              </Link>{' '}
              / <strong className="font-semibold text-white">Relatório do Seu Jeito</strong>
            </span>

            <span className="rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-violet-300 border border-violet-500/30">
              {possuiPeriodoSelecionado
                ? `FIORIX Connector · Webri (${registrosReais.length} pedidos)`
                : 'Conectado ao FIORIX Connector · Webri'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/35 bg-violet-600/20 px-3 py-1.5 text-xs font-semibold text-violet-200">
              <Database className="h-3.5 w-3.5 text-violet-300" />
              <span>
                {possuiPeriodoSelecionado
                  ? `Dados Oficiais FIORIX Connector (${registrosReais.length})`
                  : 'Dados Oficiais FIORIX Connector'}
              </span>
            </span>

            <Link
              href="/cartorio-virtual"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#111827] px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Voltar</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 pt-4 lg:px-6 space-y-4">
        {/* Cabeçalho Principal Compacto para Monitor Horizontal (Tema Escuro FIORIX) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="block text-[10px] font-extrabold uppercase tracking-[0.14em] text-cyan-400">
              CONSTRUTOR DE RELATÓRIOS · CARTÓRIO VIRTUAL
            </span>
            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                Monte seu relatório do seu jeito
              </h1>
              <span className="text-xs text-slate-400 hidden sm:inline">
                Filtre por canal de atendimento, personalize variáveis e exporte.
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setVariaveisVisiveis((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold cursor-pointer transition ${
                variaveisVisiveis
                  ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                  : 'border-cyan-500/40 bg-[#0B1020] text-cyan-300 hover:bg-cyan-500/15 hover:text-white'
              }`}
            >
              {variaveisVisiveis ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <span>
                {variaveisVisiveis ? 'Ocultar variáveis' : 'Escolher variáveis'} (
                {colunasSelecionadas.length}/{BIBLIOTECA_VARIAVEIS.length})
              </span>
            </button>

            <button
              type="button"
              disabled={colunasSelecionadas.length === 0 || gerandoRelatorio}
              onClick={handleExportarPdf}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#0B1020] px-3.5 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <FileText className="h-3.5 w-3.5 text-violet-400" />
              <span>PDF</span>
            </button>

            <button
              type="button"
              disabled={colunasSelecionadas.length === 0 || gerandoRelatorio}
              onClick={handleExportarExcel}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#0B1020] px-3.5 py-2 text-xs font-semibold text-slate-100 hover:bg-white/10 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
              <span>Excel</span>
            </button>

            <button
              type="button"
              disabled={colunasSelecionadas.length === 0 || gerandoRelatorio}
              onClick={handleGerarRelatorio}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-violet-600/30 hover:bg-violet-500 disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition"
            >
              {gerandoRelatorio && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Gerar relatório</span>
            </button>
          </div>
        </div>

        {/* Layout Otimizado em Largura Total (100% horizontal): Card de Variáveis oculto por padrão */}
        <div className="space-y-4">
          {/* CARD DE VARIÁVEIS (Oculto por padrão; abre em grade horizontal de 6 colunas quando acionado) */}
          {variaveisVisiveis && (
            <aside className="rounded-2xl border border-cyan-500/30 bg-[#0B1020]/95 p-4 shadow-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-400">
                    Biblioteca de Variáveis ({colunasSelecionadas.length} / {BIBLIOTECA_VARIAVEIS.length} selecionadas)
                  </span>
                  <div className="relative w-64">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={buscaVariavel}
                      onChange={(e) => setBuscaVariavel(e.target.value)}
                      placeholder="Buscar variável..."
                      className="w-full h-8 pl-8 pr-3 rounded-lg border border-white/15 bg-[#070A12] text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={selecionarTodasPermitidas}
                    className="rounded-lg border border-white/15 bg-[#111827] px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-violet-500/20 hover:border-violet-400/50 cursor-pointer transition"
                  >
                    Selecionar todas
                  </button>
                  <button
                    type="button"
                    onClick={limparSelecao}
                    className="rounded-lg border border-white/15 bg-[#111827] px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-rose-500/20 hover:border-rose-400/50 cursor-pointer transition"
                  >
                    Limpar
                  </button>
                  <button
                    type="button"
                    onClick={() => setVariaveisVisiveis(false)}
                    className="rounded-lg border border-white/15 bg-[#111827] px-2.5 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-white/10 cursor-pointer transition"
                  >
                    Concluir seleção
                  </button>
                </div>
              </div>

              {/* Grade Horizontal de Categorias (6 colunas lado a lado em monitores horizontais) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {CATEGORIAS_VARIAVEIS.map((cat) => {
                  const q = buscaVariavel.trim().toLowerCase();
                  const variaveisDaCategoria = BIBLIOTECA_VARIAVEIS.filter(
                    (v) =>
                      v.categoriaId === cat.id &&
                      (!q ||
                        v.rotulo.toLowerCase().includes(q) ||
                        v.categoriaRotulo.toLowerCase().includes(q))
                  );

                  if (variaveisDaCategoria.length === 0) return null;

                  return (
                    <div
                      key={cat.id}
                      className="rounded-xl border border-white/8 bg-[#070A12]/50 p-2.5 space-y-2"
                    >
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 border-b border-white/10 pb-1">
                        {cat.rotulo}
                      </div>

                      <div className="space-y-1.5">
                        {variaveisDaCategoria.map((variavel) => {
                          const selecionada = colunasSelecionadas.includes(variavel.id);
                          const permitida = podeAcessarVariavel(variavel);
                          const valorAmostra =
                            registroBaseFoco?.valores?.[variavel.id] ??
                            variavel.valorExemplo;

                          return (
                            <label
                              key={variavel.id}
                              onClick={(e) => {
                                e.preventDefault();
                                alternarVariavel(variavel.id);
                              }}
                              className={`flex items-start gap-2 rounded-lg border p-2 text-xs transition select-none ${
                                !permitida
                                  ? 'border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed'
                                  : selecionada
                                  ? 'border-violet-400/60 bg-violet-500/15 shadow-xs cursor-pointer'
                                  : 'border-white/5 bg-[#0B1020]/80 hover:border-white/20 hover:bg-white/[0.04] cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={selecionada}
                                disabled={!permitida}
                                readOnly
                                className="mt-0.5 h-3.5 w-3.5 rounded border-white/30 accent-violet-500 pointer-events-none"
                              />
                              <div className="min-w-0 flex-1">
                                <span
                                  className={`block font-semibold truncate text-[11px] ${
                                    selecionada ? 'text-white' : 'text-slate-200'
                                  }`}
                                >
                                  {variavel.rotulo}
                                </span>
                                <span className="block truncate text-[10px] text-slate-400">
                                  {valorAmostra}
                                </span>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>
          )}

          {/* CONTEÚDO PRINCIPAL EM LARGURA TOTAL (100%) */}
          <section className="space-y-3.5">
            {/* Barra de Filtros quando conectado aos Dados Reais do Webri (Tema Escuro FIORIX) */}
            {modoFonteDados === 'WEBRI_REAL' && (
              <div className="rounded-2xl border border-white/12 bg-[#0B1020]/95 p-4 shadow-lg space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white">
                      Filtros de Consulta — Dados Reais do Webri (Data do Pedido)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFiltroDataInicial('');
                      setFiltroDataFinal('');
                      setFiltroCanalAtendimento('');
                      setFiltroAtendente('');
                      setFiltroMagnetico('');
                      setFiltroPedido('');
                    }}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:underline cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Limpar filtros
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-300">
                      Data Inicial (Pedido)
                    </span>
                    <input
                      type="date"
                      value={filtroDataInicial}
                      onChange={(e) => setFiltroDataInicial(e.target.value)}
                      className="h-8 rounded-lg border border-white/15 bg-[#070A12] px-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-300">
                      Data Final (Pedido)
                    </span>
                    <input
                      type="date"
                      value={filtroDataFinal}
                      onChange={(e) => setFiltroDataFinal(e.target.value)}
                      className="h-8 rounded-lg border border-white/15 bg-[#070A12] px-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-cyan-300">
                      Canal de Atendimento
                    </span>
                    <select
                      value={filtroCanalAtendimento}
                      onChange={(e) =>
                        setFiltroCanalAtendimento(
                          e.target.value as '' | 'ONR' | 'PRESENCIAL'
                        )
                      }
                      className="h-8 rounded-lg border border-cyan-500/40 bg-[#070A12] px-2 text-xs font-semibold text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="">Todos os canais</option>
                      <option value="ONR">ONR (Eletrônico)</option>
                      <option value="PRESENCIAL">PRESENCIAL</option>
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-300">Atendente</span>
                    <select
                      value={filtroAtendente}
                      onChange={(e) => setFiltroAtendente(e.target.value)}
                      className="h-8 rounded-lg border border-white/15 bg-[#070A12] px-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                    >
                      <option value="">Todos os atendentes</option>
                      {atendentesDisponiveis.map((at) => (
                        <option key={at} value={at}>
                          {at}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-300">Magnético</span>
                    <input
                      type="text"
                      value={filtroMagnetico}
                      onChange={(e) => setFiltroMagnetico(e.target.value)}
                      placeholder="Ex.: S26110255021D"
                      className="h-8 rounded-lg border border-white/15 bg-[#070A12] px-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </label>

                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-slate-300">Pedido</span>
                    <input
                      type="text"
                      value={filtroPedido}
                      onChange={(e) => setFiltroPedido(e.target.value)}
                      placeholder="Ex.: 1332477"
                      className="h-8 rounded-lg border border-white/15 bg-[#070A12] px-2 text-xs text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Barra de Reordenação das Colunas Selecionadas (Oculta por padrão; exibida simultaneamente ao clicar em "Escolher variáveis") */}
            {variaveisVisiveis && (
              <div className="rounded-2xl border border-cyan-500/30 bg-[#0B1020]/95 px-4 py-3 shadow-lg space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                      Ordem das colunas selecionadas (arraste ou use as setas)
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    A mesma ordem é aplicada na prévia, no relatório, no PDF e no Excel
                  </span>
                </div>

                {colunasSelecionadas.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                    <span>
                      Selecione pelo menos uma variável acima para liberar a prévia e as exportações.
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {colunasSelecionadas.map((colId, idx) => {
                      const def = VARIAVEL_POR_ID.get(colId);
                      if (!def) return null;
                      return (
                        <div
                          key={colId}
                          draggable
                          onDragStart={() => setIndiceArrastando(idx)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => handleDropColuna(idx)}
                          className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-xs font-semibold transition ${
                            indiceArrastando === idx
                              ? 'border-violet-400 bg-violet-500/30 text-white opacity-75'
                              : 'border-violet-500/40 bg-violet-500/15 text-violet-100 hover:border-violet-400'
                          }`}
                        >
                          <GripVertical className="h-3.5 w-3.5 text-violet-300 cursor-grab" />
                          <span className="text-[10px] font-bold text-violet-300">
                            {idx + 1}.
                          </span>
                          <span>{def.rotulo}</span>

                          <div className="ml-1 inline-flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => moverColuna(idx, -1)}
                              disabled={idx === 0}
                              title={`Mover ${def.rotulo} para a esquerda`}
                              aria-label={`Mover ${def.rotulo} para a esquerda`}
                              className="rounded p-0.5 text-slate-300 hover:bg-white/15 hover:text-white disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowLeft className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => moverColuna(idx, 1)}
                              disabled={idx === colunasSelecionadas.length - 1}
                              title={`Mover ${def.rotulo} para a direita`}
                              aria-label={`Mover ${def.rotulo} para a direita`}
                              className="rounded p-0.5 text-slate-300 hover:bg-white/15 hover:text-white disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowRight className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => alternarVariavel(colId)}
                              title={`Remover coluna ${def.rotulo}`}
                              aria-label={`Remover coluna ${def.rotulo}`}
                              className="rounded p-0.5 text-slate-300 hover:bg-rose-500/30 hover:text-rose-200 cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CARD PRINCIPAL: Prévia em Tempo Real — SOMENTE ESTE CARD PERMANECE CLARO */}
            <div className="rounded-2xl border-2 border-violet-300/90 bg-white text-slate-900 shadow-xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-slate-200 bg-white">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Prévia em tempo real —{' '}
                    <span className="text-violet-700">
                      {nomeModeloInput.trim() || 'DIGITE AQUI O NOME DO SEU RELATÓRIO'}
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    {modoFonteDados === 'EXEMPLO'
                      ? 'Dados do exemplo · 1 registro'
                      : !possuiPeriodoSelecionado
                      ? 'Aguardando seleção de Data Inicial e Data Final para carregar os resultados filtrados'
                      : `Exibindo ${amostraPrevia.length} de ${registrosBrutosFonte.length} registros reais do Webri · Somatório calculado sobre os ${amostraPrevia.length} pedidos exibidos`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {modoFonteDados === 'WEBRI_REAL' && possuiPeriodoSelecionado && (
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                      <span>Exibir:</span>
                      <select
                        value={limiteRegistros}
                        onChange={(e) => setLimiteRegistros(Number(e.target.value))}
                        className="h-7 rounded-lg border border-violet-200 bg-[#F4F0FF] px-2 text-[11px] font-bold text-violet-800 focus:border-violet-400 focus:outline-none cursor-pointer"
                      >
                        <option value={0}>Todos ({registrosBrutosFonte.length} pedidos)</option>
                        <option value={25}>25 pedidos</option>
                        <option value={50}>50 pedidos</option>
                        <option value={100}>100 pedidos</option>
                      </select>
                    </label>
                  )}
                  {relatorioGeradoSnapshot && (
                    <button
                      type="button"
                      onClick={() => setModalRelatorioAberto(true)}
                      className="rounded-full bg-emerald-100 border border-emerald-300 px-3 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-200 cursor-pointer transition"
                    >
                      Abrir relatório gerado ({relatorioGeradoSnapshot.totalRegistros})
                    </button>
                  )}
                  <span className="rounded-full bg-[#EFEAFE] border border-violet-200 px-3 py-1 text-[11px] font-bold text-violet-700">
                    {colunasSelecionadas.length} coluna{colunasSelecionadas.length === 1 ? '' : 's'} · Ao vivo
                  </span>
                </div>
              </div>

              {/* Estado sem datas selecionadas, carregamento, erro, sem colunas ou tabela clara */}
              {modoFonteDados === 'WEBRI_REAL' && !possuiPeriodoSelecionado ? (
                <div className="px-6 py-10 text-center bg-white space-y-1.5">
                  <p className="text-xs font-semibold text-slate-700">
                    Informe a <span className="text-violet-700 font-bold">Data Inicial (Pedido)</span> e a{' '}
                    <span className="text-violet-700 font-bold">Data Final (Pedido)</span> nos filtros acima para carregar a listagem com os resultados filtrados.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Assim que o período for definido, os pedidos e o somatório dos depósitos serão exibidos automaticamente.
                  </p>
                </div>
              ) : modoFonteDados === 'WEBRI_REAL' && carregandoReais ? (
                <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-600 bg-white">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                  <span>Carregando registros sincronizados do Webri...</span>
                </div>
              ) : modoFonteDados === 'WEBRI_REAL' && erroCargaReais ? (
                <div className="p-6 text-xs text-rose-700 bg-rose-50 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Falha ao carregar os dados: {erroCargaReais}</span>
                </div>
              ) : colunasSelecionadas.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-white">
                  Nenhuma coluna selecionada. Clique em &ldquo;Escolher variáveis&rdquo; acima para marcar ao menos uma coluna.
                </div>
              ) : amostraPrevia.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-white">
                  Nenhum registro encontrado para o período e filtros informados.
                </div>
              ) : (
                <div className="overflow-x-auto bg-white">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-[#FAF9FE] text-[11px] font-semibold text-slate-600">
                        {colunasSelecionadas.map((colId) => {
                          const def = VARIAVEL_POR_ID.get(colId);
                          return (
                            <th key={colId} className="px-4 py-3 whitespace-nowrap">
                              {def?.rotulo || colId}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {amostraPrevia.map((reg) => (
                        <tr key={reg.id} className="hover:bg-violet-50/40 transition">
                          {colunasSelecionadas.map((colId) => {
                            const val = reg.valores[colId] ?? '—';
                            const ehDeposito = colId === 'valor_deposito' && val !== '—';
                            const ehCota = colId === 'cota' && val !== '—';
                            const ehSaldo = colId === 'saldo' && val !== '—';
                            const saldoNegativo = ehSaldo && (reg.saldoCentavos ?? 0) < 0;
                            return (
                              <td
                                key={colId}
                                className={`px-4 py-3 whitespace-nowrap ${
                                  ehDeposito
                                    ? 'font-bold text-emerald-700'
                                    : ehCota
                                    ? 'font-bold text-violet-700'
                                    : saldoNegativo
                                    ? 'font-bold text-rose-600'
                                    : ehSaldo
                                    ? 'font-bold text-slate-800'
                                    : val === '—'
                                    ? 'text-slate-400'
                                    : 'font-medium text-slate-800'
                                }`}
                              >
                                {val}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Rodapé claro da Prévia: Totais financeiros (Depósito, Cota e Saldo) */}
              {algumaColunaFinanceiraSelecionada &&
                colunasSelecionadas.length > 0 &&
                registrosAtivos.length > 0 && (
                  <div className="border-t border-violet-200 bg-[#F4F0FF] px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">
                        Resumo financeiro do relatório
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Somatório dos registros do relatório ({registrosAtivos.length}{' '}
                        {registrosAtivos.length === 1 ? 'pedido único' : 'pedidos únicos'})
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        {registroBaseFoco.valores.magnetico} · {registroBaseFoco.valores.atendente} ·{' '}
                        {registroBaseFoco.valores.data_pedido}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-6">
                      {colunaValorDepositoSelecionada && (
                        <div className="text-right">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Total de Depósitos
                          </span>
                          <span className="text-lg sm:text-xl font-extrabold text-emerald-700 tracking-tight">
                            {totalDepositosFormatado}
                          </span>
                        </div>
                      )}

                      {colunaCotaSelecionada && (
                        <div className="text-right">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Total de Cota
                          </span>
                          <span className="text-lg sm:text-xl font-extrabold text-violet-700 tracking-tight">
                            {totalCotasFormatado}
                          </span>
                        </div>
                      )}

                      {colunaSaldoSelecionada && (
                        <div className="text-right">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Saldo Total
                          </span>
                          <span
                            className={`text-lg sm:text-xl font-extrabold tracking-tight ${
                              totalSaldosCentavosAtivo < 0 ? 'text-rose-600' : 'text-slate-900'
                            }`}
                          >
                            {totalSaldosFormatado}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
            </div>

            {/* Card Nome do Relatório & Modelos Salvos (Escuro) */}
            <div className="rounded-2xl border border-white/12 bg-[#0B1020]/95 p-5 shadow-lg space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-white">
                    Escolha ou digite o nome do relatório que você está montando
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    O nome escolhido aparece no topo da prévia, no relatório gerado, no PDF e na planilha Excel.
                  </p>
                </div>
                {modelosSalvos.length > 0 && (
                  <span className="text-[11px] font-semibold text-cyan-400">
                    {modelosSalvos.length} modelo(s) salvo(s)
                  </span>
                )}
              </div>

              {/* Sugestões rápidas de nomes de relatório */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-400 mr-1">
                  Sugestões rápidas:
                </span>
                {[
                  'Relatório de Depósitos ONR',
                  'Conferência de Pedidos Presencial',
                  'Relatório por Atendente',
                  'Fechamento Diário de Certidões',
                ].map((sugestao) => {
                  const ativo = nomeModeloInput.trim() === sugestao;
                  return (
                    <button
                      key={sugestao}
                      type="button"
                      onClick={() => setNomeModeloInput(sugestao)}
                      className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                        ativo
                          ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                          : 'border-white/10 bg-[#070A12] text-slate-300 hover:border-cyan-500/40 hover:text-white'
                      }`}
                    >
                      {sugestao}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <label className="md:col-span-5 block space-y-1">
                  <span className="text-[11px] font-semibold text-cyan-300">
                    Nome personalizado do relatório
                  </span>
                  <input
                    type="text"
                    value={nomeModeloInput}
                    onChange={(e) => setNomeModeloInput(e.target.value)}
                    placeholder="DIGITE AQUI O NOME DO SEU RELATÓRIO"
                    className="w-full h-9 rounded-xl border border-cyan-500/40 bg-[#070A12] px-3 text-xs font-semibold text-white placeholder:text-slate-400 focus:border-cyan-400 focus:outline-none"
                  />
                </label>

                <div className="md:col-span-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={salvandoModelo || colunasSelecionadas.length === 0}
                    onClick={handleSalvarModelo}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-[#111827] px-3.5 text-xs font-semibold text-white hover:bg-violet-500/20 hover:border-violet-400/50 disabled:opacity-45 cursor-pointer transition"
                  >
                    {salvandoModelo ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
                    ) : (
                      <Bookmark className="h-3.5 w-3.5 text-violet-400" />
                    )}
                    <span>Salvar modelo</span>
                  </button>

                  <button
                    type="button"
                    disabled={modelosSalvos.length === 0}
                    onClick={() => handleAplicarModelo()}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/15 bg-[#111827] px-3.5 text-xs font-semibold text-slate-200 hover:bg-white/10 disabled:opacity-40 cursor-pointer transition"
                  >
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Aplicar modelo</span>
                  </button>
                </div>

                <div className="md:col-span-3 space-y-1">
                  <span className="block text-[11px] text-slate-400">
                    Modelos salvos anteriormente
                  </span>
                  {modelosSalvos.length === 0 ? (
                    <p className="text-[11px] text-slate-500 pb-2">
                      Nenhum modelo salvo nesta prévia.
                    </p>
                  ) : (
                    <select
                      aria-label="Selecionar modelo salvo"
                      value={modeloSelecionadoId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setModeloSelecionadoId(id);
                        const encontrado = modelosSalvos.find((m) => m.id === id);
                        if (encontrado) handleAplicarModelo(encontrado);
                      }}
                      className="w-full h-9 rounded-xl border border-white/15 bg-[#070A12] px-2 text-xs text-slate-200"
                    >
                      {modelosSalvos.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nome} ({m.colunas.length} colunas · {m.atualizadoEm})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            {/* CARD HISTÓRICO DE GERAÇÃO (Oculto por padrão, expansível sob demanda) */}
            <div className="rounded-2xl border border-white/12 bg-[#0B1020]/95 px-5 py-3.5 shadow-lg space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setHistoricoVisivel((prev) => !prev)}
                  className="inline-flex items-center gap-2 text-xs font-bold text-slate-200 hover:text-white cursor-pointer transition"
                >
                  <History className="h-4 w-4 text-cyan-400" />
                  <span>Histórico de geração · auditoria</span>
                  {historicoVisivel ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  )}
                </button>

                <div className="flex items-center gap-2">
                  {relatorioGeradoSnapshot && (
                    <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                      Última geração: {relatorioGeradoSnapshot.geradoEm}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setHistoricoVisivel((prev) => !prev)}
                    className="rounded-lg border border-white/15 bg-[#111827] px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-white/10 hover:text-white cursor-pointer transition"
                  >
                    {historicoVisivel ? 'Ocultar histórico' : `Exibir histórico (${historicoGeracoes.length})`}
                  </button>
                </div>
              </div>

              {historicoVisivel && (
                <div className="pt-2 border-t border-white/10">
                  {historicoGeracoes.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      Nenhum relatório gerado nesta prévia.
                    </p>
                  ) : (
                    <ul className="divide-y divide-white/10 text-xs">
                      {historicoGeracoes.slice(0, 6).map((item) => (
                        <li
                          key={item.id}
                          className="py-2 flex flex-wrap items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-semibold text-slate-100">
                              {item.descricao}
                            </span>
                            {item.detalhes?.colunas && (
                              <span className="block text-[11px] text-slate-400">
                                Colunas:{' '}
                                {item.detalhes.colunas
                                  .map(
                                    (c) =>
                                      VARIAVEL_POR_ID.get(c as ChaveVariavelRelatorio)?.rotulo || c
                                  )
                                  .join(', ')}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {item.usuarioNome} · {item.criadoEm}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* MODAL / DOCUMENTO COMPLETO DO RELATÓRIO GERADO (Ao clicar em "Gerar relatório") */}
      {modalRelatorioAberto && relatorioGeradoSnapshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Relatório Personalizado Gerado"
        >
          <div className="w-full max-w-[1400px] rounded-2xl border-2 border-violet-300 bg-white text-slate-900 shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
            {/* Cabeçalho do Relatório Gerado */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-[#FAF9FE] px-6 py-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Relatório Oficial Auditado · FIORIX</span>
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                    7º Oficial de Registro de Imóveis de São Paulo/SP · Base Oficial WEBRI
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {relatorioGeradoSnapshot.nomeModelo}
                </h2>
                <p className="text-xs text-slate-500">
                  Emitido em <strong>{relatorioGeradoSnapshot.geradoEm}</strong> por{' '}
                  <strong>{usuarioNomeInicial}</strong> · {relatorioGeradoSnapshot.filtrosResumo}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportarPdf}
                  disabled={gerandoRelatorio}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-violet-700 cursor-pointer transition"
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Baixar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportarExcel}
                  disabled={gerandoRelatorio}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer transition"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Baixar Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={handleImprimirRelatorio}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer transition"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Imprimir</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalRelatorioAberto(false)}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 cursor-pointer transition"
                >
                  <X className="h-4 w-4" />
                  <span>Fechar</span>
                </button>
              </div>
            </div>

            {/* Barra de pesquisa e paginação interna do Relatório Gerado */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-3">
              <div className="relative w-full sm:w-80">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={buscaNoRelatorioGerado}
                  onChange={(e) => {
                    setBuscaNoRelatorioGerado(e.target.value);
                    setPaginaRelatorioGerado(1);
                  }}
                  placeholder="Filtrar linhas neste relatório gerado..."
                  className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-300 bg-slate-50 text-xs text-slate-800 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-600">
                <span>
                  Exibindo <strong>{registrosRelatorioGeradoPaginados.length}</strong> de{' '}
                  <strong>{registrosRelatorioGeradoFiltrados.length}</strong> registro(s)
                </span>
                {totalPaginasRelatorioGerado > 1 && (
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      disabled={paginaRelatorioGerado <= 1}
                      onClick={() => setPaginaRelatorioGerado((p) => Math.max(1, p - 1))}
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      Anterior
                    </button>
                    <span className="px-2 font-semibold">
                      Página {paginaRelatorioGerado} / {totalPaginasRelatorioGerado}
                    </span>
                    <button
                      type="button"
                      disabled={paginaRelatorioGerado >= totalPaginasRelatorioGerado}
                      onClick={() =>
                        setPaginaRelatorioGerado((p) =>
                          Math.min(totalPaginasRelatorioGerado, p + 1)
                        )
                      }
                      className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold disabled:opacity-40 cursor-pointer"
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tabela completa do Relatório Gerado */}
            <div className="flex-1 overflow-auto bg-white">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[#F4F0FF] border-b border-violet-200">
                  <tr className="text-[11px] font-bold text-violet-950">
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    {relatorioGeradoSnapshot.colunas.map((colId) => {
                      const def = VARIAVEL_POR_ID.get(colId);
                      return (
                        <th key={colId} className="px-4 py-3 whitespace-nowrap">
                          {def?.rotulo || colId}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {registrosRelatorioGeradoPaginados.map((reg, idx) => {
                    const numeroLinha =
                      (paginaRelatorioGerado - 1) * ITENS_POR_PAGINA_RELATORIO + idx + 1;
                    return (
                      <tr key={reg.id} className="hover:bg-violet-50/40">
                        <td className="px-4 py-2.5 text-center font-mono text-[11px] text-slate-400">
                          {numeroLinha}
                        </td>
                        {relatorioGeradoSnapshot.colunas.map((colId) => {
                          const val = reg.valores[colId] ?? '—';
                          const ehDeposito = colId === 'valor_deposito' && val !== '—';
                          const ehCota = colId === 'cota' && val !== '—';
                          const ehSaldo = colId === 'saldo' && val !== '—';
                          const saldoNegativo = ehSaldo && (reg.saldoCentavos ?? 0) < 0;
                          return (
                            <td
                              key={colId}
                              className={`px-4 py-2.5 whitespace-nowrap ${
                                ehDeposito
                                  ? 'font-bold text-emerald-700'
                                  : ehCota
                                  ? 'font-bold text-violet-700'
                                  : saldoNegativo
                                  ? 'font-bold text-rose-600'
                                  : ehSaldo
                                  ? 'font-bold text-slate-800'
                                  : val === '—'
                                  ? 'text-slate-400'
                                  : 'font-medium text-slate-800'
                              }`}
                            >
                              {val}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Rodapé do Relatório Gerado */}
            {(relatorioGeradoSnapshot.colunas.includes('valor_deposito') ||
              relatorioGeradoSnapshot.colunas.includes('cota') ||
              relatorioGeradoSnapshot.colunas.includes('saldo')) && (
              <div className="border-t border-violet-200 bg-[#F4F0FF] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-extrabold text-slate-900">
                    Resumo financeiro consolidado do relatório
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Somatório consolidado de {relatorioGeradoSnapshot.totalRegistros} pedido(s) único(s)
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  {relatorioGeradoSnapshot.colunas.includes('valor_deposito') && (
                    <div className="text-right">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Total de Depósitos
                      </span>
                      <span className="text-xl font-extrabold text-emerald-700">
                        {relatorioGeradoSnapshot.totalDepositosFormatado}
                      </span>
                    </div>
                  )}
                  {relatorioGeradoSnapshot.colunas.includes('cota') && (
                    <div className="text-right">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Total de Cota
                      </span>
                      <span className="text-xl font-extrabold text-violet-700">
                        {relatorioGeradoSnapshot.totalCotasFormatado}
                      </span>
                    </div>
                  )}
                  {relatorioGeradoSnapshot.colunas.includes('saldo') && (
                    <div className="text-right">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Saldo Total
                      </span>
                      <span
                        className={`text-xl font-extrabold ${
                          relatorioGeradoSnapshot.totalSaldosCentavos < 0
                            ? 'text-rose-600'
                            : 'text-slate-900'
                        }`}
                      >
                        {relatorioGeradoSnapshot.totalSaldosFormatado}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Declaração Jurídica e Técnica de Origem dos Dados */}
            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-[11px] text-slate-600 space-y-1">
              <div className="font-extrabold uppercase tracking-wider text-[10px] text-slate-800">
                Declaração de Origem, Integridade e Rastreabilidade Registral (Lei nº 6.015/1973 e Provimento CNJ nº 149/2023)
              </div>
              <p className="leading-relaxed text-slate-600">
                Instrumento administrativo e contábil extraído eletronicamente dos assentamentos oficiais do sistema registral{' '}
                <strong className="text-slate-800">
                  WEBRI (SQL Server — Módulo de Certidões, Caixa e Operador Nacional do Sistema de Registro Eletrônico de Imóveis — ONR)
                </strong>
                , integrado e auditado pela plataforma{' '}
                <strong className="text-slate-800">
                  FIORIX — Gestão da Qualidade e Governança Cartorária (Módulo Cartório Virtual)
                </strong>
                , com apuração individualizada por pedido único para fins de conferência financeira e controle oficial da serventia.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
