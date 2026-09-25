'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  Printer, BookOpen, Calendar, Filter, Download, MoreVertical,
  RotateCw, Search, CheckCircle2, AlertCircle, MinusCircle,
  SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight,
  ChevronDown, Loader2, Info, FileSpreadsheet, User, Users, Award
} from 'lucide-react';
import { toast } from 'sonner';
import { MOCK_CONTROLE_IMPRESSOES } from '@/lib/controle-impressoes/mock-data';
import { StatusImpressaoItem, ImpressaoItemRow, ControleImpressoesData } from '@/types/controle-impressoes';

export type SortColumnKey =
  | 'protocolo'
  | 'numeroLivro'
  | 'tipoNatureza'
  | 'dataEntrada'
  | 'etapaAtual'
  | 'ultimoRegistro'
  | 'certidaoStatus'
  | 'livroStatus'
  | 'impressoPor'
  | 'diasPendente';

export function ControleImpressoesClient() {
  const [data, setData] = useState<ControleImpressoesData>(MOCK_CONTROLE_IMPRESSOES);
  const [loading, setLoading] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);
  const [exportando, setExportando] = useState(false);

  const tableRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const buscaInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Sorting State
  const [sortBy, setSortBy] = useState<SortColumnKey>('ultimoRegistro');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Filters State
  const [visao, setVisao] = useState<'demanda' | 'producao'>('demanda');
  const [dataPreset, setDataPreset] = useState<'hoje' | 'ontem' | '7dias' | 'mesAtual' | 'mesAnterior' | 'personalizado'>('mesAtual');
  const [dataInicio, setDataInicio] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split('T')[0]);
  const [buscaNatureza, setBuscaNatureza] = useState('');
  const [tipoImpressaoFiltro, setTipoImpressaoFiltro] = useState<'todos' | 'certidao' | 'livro'>('todos');
  const [statusFiltro, setStatusFiltro] = useState<'todos' | 'pendente' | 'realizado'>('todos');
  const [activeCardLabel, setActiveCardLabel] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Estados para Impressão da Listagem
  const [imprimindoApenasTabela, setImprimindoApenasTabela] = useState(false);
  const [menuImprimirTabelaAberto, setMenuImprimirTabelaAberto] = useState(false);
  const [preparandoImpressaoTodos, setPreparandoImpressaoTodos] = useState(false);
  const [itensCompletosImpressao, setItensCompletosImpressao] = useState<ImpressaoItemRow[] | null>(null);
  const printTableMenuRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown de opções ao clicar fora ou apertar Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAberto(false);
      }
      if (printTableMenuRef.current && !printTableMenuRef.current.contains(event.target as Node)) {
        setMenuImprimirTabelaAberto(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuAberto(false);
        setMenuImprimirTabelaAberto(false);
      }
    }
    if (menuAberto || menuImprimirTabelaAberto) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuAberto, menuImprimirTabelaAberto]);

  // Listener para resetar estado após conclusão ou cancelamento da impressão
  useEffect(() => {
    const handleAfterPrint = () => {
      setImprimindoApenasTabela(false);
      setItensCompletosImpressao(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  // Fetch from Real API
  const fetchDados = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        dataInicio,
        dataFim,
        visao,
        busca: buscaNatureza,
        tipoImpressao: tipoImpressaoFiltro,
        status: statusFiltro,
        sortBy,
        sortOrder,
        page: String(currentPage),
        pageSize: String(pageSize),
      });

      const res = await fetch(`/api/controle-impressoes?${params.toString()}`);
      if (res.ok) {
        const liveData = await res.json();
        if (liveData && liveData.itens) {
          setData(liveData);
        }
      }
    } catch (err) {
      console.warn('Fallback para mock devido a erro na API:', err);
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, visao, buscaNatureza, tipoImpressaoFiltro, statusFiltro, sortBy, sortOrder, currentPage, pageSize]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  // Adjust dates based on preset
  const handlePresetChange = (preset: typeof dataPreset) => {
    setDataPreset(preset);
    const now = new Date();
    const toYmd = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'hoje') {
      setDataInicio(toYmd(now));
      setDataFim(toYmd(now));
    } else if (preset === 'ontem') {
      const ontem = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      setDataInicio(toYmd(ontem));
      setDataFim(toYmd(ontem));
    } else if (preset === '7dias') {
      const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      setDataInicio(toYmd(d7));
      setDataFim(toYmd(now));
    } else if (preset === 'mesAtual') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setDataInicio(toYmd(firstDay));
      setDataFim(toYmd(now));
    } else if (preset === 'mesAnterior') {
      const firstDayPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      setDataInicio(toYmd(firstDayPrev));
      setDataFim(toYmd(lastDayPrev));
    }
    setCurrentPage(1);
  };

  const totalPages = Math.ceil((data.totalRegistros || 1) / pageSize) || 1;
  const parseBrDateTime = (str: string | null | undefined): number => {
    if (!str || str === '-') return 0;
    const parts = str.trim().split(' ');
    const dateParts = parts[0].split('/');
    if (dateParts.length !== 3) return 0;
    const day = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const year = parseInt(dateParts[2], 10);
    let hours = 0;
    let minutes = 0;
    if (parts[1]) {
      const timeParts = parts[1].split(':');
      hours = parseInt(timeParts[0], 10) || 0;
      minutes = parseInt(timeParts[1], 10) || 0;
    }
    return new Date(year, month, day, hours, minutes).getTime();
  };

  const getColumnLabel = (col: SortColumnKey): string => {
    switch (col) {
      case 'protocolo': return 'Protocolo';
      case 'numeroLivro': return 'Nº Livro';
      case 'tipoNatureza': return 'Tipo / Natureza';
      case 'dataEntrada': return 'Data Entrada';
      case 'etapaAtual': return 'Etapa Atual';
      case 'ultimoRegistro': return 'Último Registro';
      case 'certidaoStatus': return 'Certidão Registro';
      case 'livroStatus': return 'Impressão no Livro';
      case 'impressoPor': return 'Impresso por';
      case 'diasPendente': return 'Dias';
      default: return col;
    }
  };

  const handleSort = (column: SortColumnKey) => {
    if (sortBy === column) {
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      setSortOrder(newOrder);
      toast.info(`Ordenado por ${getColumnLabel(column)} (${newOrder === 'asc' ? 'Crescente' : 'Decrescente'})`);
    } else {
      setSortBy(column);
      const defaultOrder = (column === 'protocolo' || column === 'ultimoRegistro' || column === 'dataEntrada' || column === 'diasPendente') ? 'desc' : 'asc';
      setSortOrder(defaultOrder);
      toast.info(`Ordenado por ${getColumnLabel(column)} (${defaultOrder === 'asc' ? 'Crescente' : 'Decrescente'})`);
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (column: SortColumnKey) => {
    if (sortBy === column) {
      return sortOrder === 'asc' ? (
        <ArrowUp className="w-3.5 h-3.5 text-purple-400 shrink-0 inline ml-1 print:hidden" />
      ) : (
        <ArrowDown className="w-3.5 h-3.5 text-purple-400 shrink-0 inline ml-1 print:hidden" />
      );
    }
    return (
      <ArrowUpDown className="w-3 h-3 text-slate-500/50 group-hover:text-slate-300 shrink-0 inline ml-1 opacity-0 group-hover:opacity-100 transition-all print:hidden" />
    );
  };

  const paginatedRows = useMemo(() => {
    const rows = [...data.itens];
    return rows.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortBy) {
        case 'protocolo':
          valA = Number(a.protocolo) || 0;
          valB = Number(b.protocolo) || 0;
          break;
        case 'numeroLivro':
          valA = String(a.numeroLivro || '').toLowerCase();
          valB = String(b.numeroLivro || '').toLowerCase();
          break;
        case 'tipoNatureza':
          valA = String(a.tipoNatureza || '').toLowerCase();
          valB = String(b.tipoNatureza || '').toLowerCase();
          break;
        case 'dataEntrada':
          valA = parseBrDateTime(a.dataEntrada);
          valB = parseBrDateTime(b.dataEntrada);
          break;
        case 'etapaAtual':
          valA = String(a.etapaAtual || '').toLowerCase();
          valB = String(b.etapaAtual || '').toLowerCase();
          break;
        case 'certidaoStatus':
          valA = String(a.certidaoStatus || '');
          valB = String(b.certidaoStatus || '');
          break;
        case 'livroStatus':
          valA = String(a.livroStatus || '');
          valB = String(b.livroStatus || '');
          break;
        case 'impressoPor':
          valA = String(a.livroResponsavel || a.certidaoResponsavel || '').toLowerCase();
          valB = String(b.livroResponsavel || b.certidaoResponsavel || '').toLowerCase();
          break;
        case 'diasPendente':
          valA = Number(a.diasPendente) || 0;
          valB = Number(b.diasPendente) || 0;
          break;
        case 'ultimoRegistro':
        default:
          valA = parseBrDateTime(a.ultimoRegistro);
          valB = parseBrDateTime(b.ultimoRegistro);
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data.itens, sortBy, sortOrder]);

  // Registros que serão exibidos na tabela (suporta carga completa para impressão)
  const rowsParaExibir = useMemo(() => {
    if (itensCompletosImpressao && itensCompletosImpressao.length > 0) {
      return itensCompletosImpressao;
    }
    return paginatedRows;
  }, [itensCompletosImpressao, paginatedRows]);

  const handleImprimirPaginaAtual = () => {
    setMenuImprimirTabelaAberto(false);
    setItensCompletosImpressao(null);
    setImprimindoApenasTabela(true);
    toast.info('Preparando impressão da listagem...', { duration: 1800 });
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleImprimirTodosRegistros = async () => {
    setMenuImprimirTabelaAberto(false);
    setImprimindoApenasTabela(true);

    if (data.totalRegistros <= paginatedRows.length) {
      setTimeout(() => {
        window.print();
      }, 150);
      return;
    }

    try {
      setPreparandoImpressaoTodos(true);
      toast.info('Preparando impressão completa...', {
        description: `Buscando ${data.totalRegistros} registros da listagem...`,
        icon: <Printer className="w-4 h-4 text-emerald-400" />
      });

      const params = new URLSearchParams({
        dataInicio,
        dataFim,
        visao,
        busca: buscaNatureza,
        tipoImpressao: tipoImpressaoFiltro,
        status: statusFiltro,
        sortBy,
        sortOrder,
        export: 'true',
        pageSize: '50000',
      });

      const res = await fetch(`/api/controle-impressoes?${params.toString()}`);
      if (res.ok) {
        const resData = await res.json();
        if (resData?.itens && resData.itens.length > 0) {
          setItensCompletosImpressao(resData.itens);
          toast.success('Listagem carregada com sucesso!', {
            description: `Pronta para impressão (${resData.itens.length} registros).`
          });
          setTimeout(() => {
            window.print();
          }, 300);
          return;
        }
      }
      setTimeout(() => {
        window.print();
      }, 150);
    } catch (err) {
      console.error('Erro ao buscar todos os registros:', err);
      toast.error('Erro ao buscar todos os registros. Imprimindo página atual.');
      setTimeout(() => {
        window.print();
      }, 150);
    } finally {
      setPreparandoImpressaoTodos(false);
    }
  };

  const operadoresLivro = (data.operadores || [])
    .filter((op) => op.totalLivro > 0)
    .sort((a, b) => b.totalLivro - a.totalLivro);

  const operadoresCertidao = (data.operadores || [])
    .filter((op) => op.totalCertidao > 0)
    .sort((a, b) => b.totalCertidao - a.totalCertidao);

  const totalFiltrosAtivos = useMemo(() => {
    let count = 0;
    if (buscaNatureza.trim() !== '') count++;
    if (tipoImpressaoFiltro !== 'todos') count++;
    if (statusFiltro !== 'todos') count++;
    if (activeCardLabel !== null) count++;
    if (dataPreset !== '7dias') count++;
    return count;
  }, [buscaNatureza, tipoImpressaoFiltro, statusFiltro, activeCardLabel, dataPreset]);

  const exportarParaCSV = async () => {
    try {
      setExportando(true);
      toast.info('Exportação iniciada', {
        description: 'Buscando registros filtrados para a planilha...',
        icon: <Download className="w-4 h-4 text-cyan-400" />
      });

      let linhasParaExportar = data.itens;
      try {
        const params = new URLSearchParams({
          dataInicio,
          dataFim,
          visao,
          busca: buscaNatureza,
          tipoImpressao: tipoImpressaoFiltro,
          status: statusFiltro,
          sortBy,
          sortOrder,
          export: 'true',
          pageSize: '50000',
        });
        const res = await fetch(`/api/controle-impressoes?${params.toString()}`);
        if (res.ok) {
          const resData = await res.json();
          if (resData?.itens && resData.itens.length > 0) {
            linhasParaExportar = resData.itens;
          }
        }
      } catch (err) {
        console.warn('Fallback para dados locais ao exportar:', err);
      }

      if (!linhasParaExportar || linhasParaExportar.length === 0) {
        toast.warning('Nenhum registro encontrado para exportar com os filtros atuais.');
        return;
      }

      const sanitize = (val: any) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      };

      const headers = [
        'PROTOCOLO',
        'LIVRO_MATRICULA',
        'NATUREZA',
        'DATA_ENTRADA',
        'ETAPA_ATUAL',
        'DATA_ULTIMO_REGISTRO',
        'STATUS_CERTIDAO',
        'DATA_CERTIDAO',
        'OPERADOR_CERTIDAO',
        'STATUS_LIVRO',
        'DATA_LIVRO',
        'OPERADOR_LIVRO',
        'DIAS_PENDENTE'
      ];

      const csvRows = [
        headers.join(';'),
        ...linhasParaExportar.map((row) =>
          [
            row.protocolo,
            sanitize(row.numeroLivro),
            sanitize(row.tipoNatureza),
            sanitize(row.dataEntrada || '-'),
            sanitize(row.etapaAtual || 'Impressão'),
            sanitize(row.ultimoRegistro),
            sanitize(row.certidaoStatus),
            sanitize(row.certidaoData || '-'),
            sanitize(row.certidaoResponsavel || '-'),
            sanitize(row.livroStatus),
            sanitize(row.livroData || '-'),
            sanitize(row.livroResponsavel || '-'),
            row.diasPendente ?? 0
          ].join(';')
        )
      ];

      const blob = new Blob(['\uFEFF' + csvRows.join('\r\n')], {
        type: 'text/csv;charset=utf-8;'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const hoje = new Date().toISOString().split('T')[0];
      link.setAttribute('href', url);
      link.setAttribute('download', `controle_impressoes_${visao}_${hoje}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Planilha gerada com sucesso!', {
        description: `${linhasParaExportar.length} registros exportados para CSV.`,
        icon: <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
      });
    } catch (err) {
      console.error('Falha ao exportar:', err);
      toast.error('Erro ao gerar planilha CSV');
    } finally {
      setExportando(false);
    }
  };

  const handleExport = () => exportarParaCSV();

  const limparFiltros = () => {
    setBuscaNatureza('');
    setStatusFiltro('todos');
    setTipoImpressaoFiltro('todos');
    setActiveCardLabel(null);
    setDataPreset('7dias');
    setCurrentPage(1);
    toast.success('Filtros restaurados para o padrão.');
  };

  const handleFiltrarClick = () => {
    setCurrentPage(1);
    fetchDados();
    let msg = 'Filtros aplicados';
    if (tipoImpressaoFiltro === 'certidao') msg = 'Filtrando Certidões de Registro';
    else if (tipoImpressaoFiltro === 'livro') msg = 'Filtrando Atos no Livro';
    if (statusFiltro !== 'todos') msg += ` (${statusFiltro === 'realizado' ? 'Realizados' : 'Pendentes'})`;
    toast.success(msg);
    setTimeout(() => {
      tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  // Handler para clique nos cards — filtra a tabela
  const handleCardClick = (
    tipo: 'livro' | 'certidao' | 'todos',
    status: 'todos' | 'pendente' | 'realizado',
    label: string
  ) => {
    const isSameFilter = tipoImpressaoFiltro === tipo && statusFiltro === status;
    if (isSameFilter) {
      // Segundo clique desfaz o filtro
      setTipoImpressaoFiltro('todos');
      setStatusFiltro('todos');
      setActiveCardLabel(null);
    } else {
      setTipoImpressaoFiltro(tipo === 'todos' ? 'todos' : tipo);
      setStatusFiltro(status);
      setActiveCardLabel(label);
      setCurrentPage(1);
      setTimeout(() => tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }
  };

  const isLivroProduzidasActive = activeCardLabel === 'Livro – Produzidas' || (tipoImpressaoFiltro !== 'certidao' && statusFiltro === 'realizado');
  const isLivroPendenciasActive = activeCardLabel === 'Livro – Pendências' || (tipoImpressaoFiltro !== 'certidao' && statusFiltro === 'pendente');
  const isLivroDemandaActive = activeCardLabel === 'Livro – Demanda total';

  const isCertidaoProduzidasActive = activeCardLabel === 'Certidão – Produzidas' || (tipoImpressaoFiltro !== 'livro' && statusFiltro === 'realizado');
  const isCertidaoPendenciasActive = activeCardLabel === 'Certidão – Pendências' || (tipoImpressaoFiltro !== 'livro' && statusFiltro === 'pendente');
  const isCertidaoDemandaActive = activeCardLabel === 'Certidão – Demanda total';

  return (
    <div className="space-y-6 print:space-y-2 print:text-slate-900 print:p-0 print:bg-white">
      {/* ────────────────── CABEÇALHO EXCLUSIVO PARA IMPRESSÃO / PDF ────────────────── */}
      <div className="hidden print:block mb-3 pb-2.5 border-b-2 border-slate-700 bg-white text-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider font-bold text-slate-600">7º Oficial de Registro de Imóveis de São Paulo</div>
            <h1 className="text-lg font-extrabold text-slate-950 mt-0.5">
              {imprimindoApenasTabela ? 'Listagem de Pendências e Situação das Impressões' : 'Relatório de Controle de Impressões'}
            </h1>
          </div>
          <div className="text-right text-[11px] text-slate-700">
            <div><strong>Emissão:</strong> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>Base de Cálculo:</strong> {visao === 'producao' ? 'Produção (Data Impressão)' : 'Demanda (Último Registro)'}</div>
          </div>
        </div>
        <div className="mt-2 pt-1.5 border-t border-slate-300 flex items-center justify-between text-[11px] text-slate-800">
          <div>
            Período: <strong>{dataInicio.split('-').reverse().join('/')}</strong> até <strong>{dataFim.split('-').reverse().join('/')}</strong>
            {activeCardLabel && <span> | Filtro: <strong>{activeCardLabel}</strong></span>}
            {tipoImpressaoFiltro !== 'todos' && <span> | Tipo: <strong>{tipoImpressaoFiltro === 'certidao' ? 'Certidão de Registro' : 'Ato no Livro'}</strong></span>}
            {statusFiltro !== 'todos' && <span> | Status: <strong>{statusFiltro === 'realizado' ? 'Realizado' : 'Pendente'}</strong></span>}
            <span> | Ordem: <strong>{getColumnLabel(sortBy)} ({sortOrder === 'asc' ? 'Crescente' : 'Decrescente'})</strong></span>
          </div>
          <div>
            Total de registros: <strong>{data.totalRegistros}</strong>
            {imprimindoApenasTabela && rowsParaExibir.length !== data.totalRegistros && (
              <span> (Exibindo <strong>{rowsParaExibir.length}</strong> nesta listagem)</span>
            )}
            {imprimindoApenasTabela && rowsParaExibir.length === data.totalRegistros && (
              <span> (Listagem completa com <strong>{rowsParaExibir.length}</strong> itens)</span>
            )}
          </div>
        </div>
      </div>

      {/* ────────────────── TOP BAR / HEADER DO RELATÓRIO NA TELA ────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <span>Gestão de Prazos</span>
            <span className="text-slate-600">&gt;</span>
            <span className="text-white font-semibold">Impressões</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white mt-1">
            Controle de Impressões
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Painel de produtividade das impressões com base na data do último registro e data das impressões realizadas.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap print:hidden">
          {/* Botão Filtros */}
          <button
            type="button"
            onClick={() => {
              const novoEstado = !filtrosAbertos;
              setFiltrosAbertos(novoEstado);
              if (novoEstado) {
                setTimeout(() => {
                  filtersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  buscaInputRef.current?.focus();
                }, 80);
              }
            }}
            title={filtrosAbertos ? 'Recolher painel de filtros' : 'Expandir painel de filtros'}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-xs font-medium transition-all shadow-sm ${
              filtrosAbertos
                ? 'bg-purple-600/20 hover:bg-purple-600/30 border-purple-500/40 text-purple-200 shadow-purple-900/10'
                : 'bg-[#141B2D] hover:bg-[#1A233A] border-white/10 text-slate-200'
            }`}
          >
            <Filter className={`w-3.5 h-3.5 ${filtrosAbertos ? 'text-purple-400' : 'text-slate-400'}`} />
            <span>Filtros</span>
            {totalFiltrosAtivos > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] bg-purple-500 text-white rounded-full font-bold">
                {totalFiltrosAtivos}
              </span>
            )}
          </button>

          {/* Botão Exportar */}
          <button
            type="button"
            onClick={exportarParaCSV}
            disabled={exportando}
            title="Exportar todos os registros filtrados para CSV (compatível com Excel)"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#141B2D] hover:bg-[#1A233A] border border-white/10 text-xs font-medium text-slate-200 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {exportando ? (
              <RotateCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{exportando ? 'Exportando...' : 'Exportar'}</span>
          </button>

          {/* Botão ⋮ Menu de Opções */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuAberto((prev) => !prev)}
              title="Mais opções e ações do painel"
              className={`p-2 rounded-lg border transition-all ${
                menuAberto
                  ? 'bg-purple-600/30 border-purple-500/50 text-white'
                  : 'bg-[#141B2D] hover:bg-[#1A233A] border-white/10 text-slate-400 hover:text-white'
              }`}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuAberto && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-white/15 bg-[#0D1424] shadow-2xl py-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 print:hidden">
                <div className="px-3.5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Ações Rápidas
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    fetchDados();
                    toast.success('Dados atualizados com sucesso');
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5 text-purple-400" />
                  <span>Atualizar dados agora</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    exportarParaCSV();
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Exportar planilha (CSV)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    setTimeout(() => {
                      window.print();
                    }, 150);
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Imprimir / Salvar PDF</span>
                </button>

                <div className="h-px bg-white/10 my-1 mx-2" />

                <div className="px-3.5 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Visualização
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    const novaVisao = visao === 'demanda' ? 'producao' : 'demanda';
                    setVisao(novaVisao);
                    setCurrentPage(1);
                    toast.info(
                      `Visão alterada para ${novaVisao === 'producao' ? 'Produção (Data Impressão)' : 'Demanda (Último Registro)'}`
                    );
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-amber-400" />
                  <span>Alternar p/ {visao === 'demanda' ? 'Visão Produção' : 'Visão Demanda'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    setFiltrosAbertos((prev) => !prev);
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <Filter className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{filtrosAbertos ? 'Ocultar barra de filtros' : 'Exibir barra de filtros'}</span>
                </button>

                <div className="h-px bg-white/10 my-1 mx-2" />

                <button
                  type="button"
                  onClick={() => {
                    setMenuAberto(false);
                    limparFiltros();
                  }}
                  className="flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Restaurar filtros padrão</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Info Banner dinâmico com base na Visão */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-lg bg-[#0E1526]/80 border border-blue-500/20 text-xs print:hidden">
        <div className="flex items-center gap-2 text-blue-300">
          <Info className="w-4 h-4 text-blue-400 shrink-0" />
          <span>
            Base principal do relatório:{' '}
            <strong className="font-semibold text-white">
              {visao === 'producao'
                ? 'Data das Impressões Realizadas (Visão Produção)'
                : 'Data do Último Registro (Visão Demanda)'}
            </strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
          <span>Atualizado em: {data.ultimaSincronizacao}</span>
          <button
            onClick={() => {
              fetchDados();
              toast.success('Dados atualizados com sucesso');
            }}
            className="p-1 hover:text-white transition-colors"
            title="Recarregar dados"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* ────────────────── BARRA DE FILTROS ────────────────── */}
      {filtrosAbertos ? (
        <div ref={filtersRef} className="p-5 rounded-2xl bg-[#0c1222]/90 border border-white/10 backdrop-blur-md space-y-4 shadow-lg transition-all animate-fadeIn print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Período */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {visao === 'producao' ? 'Período da Data de Impressão' : 'Período do Último Registro'}
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#141B2D] border border-white/10 text-xs text-white shadow-inner">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => {
                  setDataInicio(e.target.value);
                  setDataPreset('personalizado');
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer w-28 text-xs font-medium"
              />
              <span className="text-slate-400 text-xs font-medium">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => {
                  setDataFim(e.target.value);
                  setDataPreset('personalizado');
                  setCurrentPage(1);
                }}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer w-28 text-xs font-medium"
              />
              <Calendar className="w-4 h-4 text-slate-400 ml-auto shrink-0" />
            </div>
          </div>

          {/* Visão */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                Visão
              </label>
              <span className="text-[10px] text-slate-400 font-medium">Passe o mouse p/ detalhes</span>
            </div>
            <div className="flex p-1 rounded-lg bg-[#141B2D] border border-white/10 text-xs shadow-inner gap-1">
              {/* Botão Demanda */}
              <div className="relative flex-1 group">
                <button
                  type="button"
                  onClick={() => {
                    setVisao('demanda');
                    setCurrentPage(1);
                  }}
                  title="Demanda (Último Registro): Filtra protocolos pela data em que o registro foi concluído. Mostra o volume registrado e o andamento das impressões dessa data."
                  className={`w-full py-1.5 px-2 rounded-md font-semibold transition-all text-center ${
                    visao === 'demanda'
                      ? 'bg-[#5b21b6] text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  Demanda (Último Reg.)
                </button>
                {/* Tooltip moderno flutuante */}
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl bg-[#090d19] border border-purple-500/40 text-slate-200 text-[11px] leading-relaxed shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 transform group-hover:-translate-y-1">
                  <div className="font-bold text-purple-300 text-xs mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50"></span>
                    Visão Demanda (Último Registro)
                  </div>
                  Filtra os protocolos pela <strong>data em que foram registrados</strong> no cartório. Permite avaliar a taxa de entrega e quantas pendências de impressão ainda restam dessa data específica.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#090d19]" />
                </div>
              </div>

              {/* Botão Produção */}
              <div className="relative flex-1 group">
                <button
                  type="button"
                  onClick={() => {
                    setVisao('producao');
                    setCurrentPage(1);
                  }}
                  title="Produção (Data Impressão): Filtra pela data em que a impressão física ou certidão foi efetivamente realizada. Mede a produtividade real dos operadores."
                  className={`w-full py-1.5 px-2 rounded-md font-semibold transition-all text-center ${
                    visao === 'producao'
                      ? 'bg-[#5b21b6] text-white shadow-md'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  Produção (Data Impr.)
                </button>
                {/* Tooltip moderno flutuante */}
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 rounded-xl bg-[#090d19] border border-cyan-500/40 text-slate-200 text-[11px] leading-relaxed shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 transform group-hover:-translate-y-1">
                  <div className="font-bold text-cyan-300 text-xs mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50"></span>
                    Visão Produção (Data Impressão)
                  </div>
                  Filtra os protocolos pela <strong>data em que a impressão ou preparação foi concluída</strong>. Ideal para auditar o volume e a produtividade real entregue por cada operador (Antonio e David) no dia.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#090d19]" />
                </div>
              </div>
            </div>
          </div>

          {/* Tipo / Natureza / Protocolo / Livro */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Buscar Protocolo / Livro / Natureza
            </label>
            <div className="relative">
              <input
                ref={buscaInputRef}
                type="text"
                placeholder="Ex: 644377, MAT, Escritura..."
                value={buscaNatureza}
                onChange={(e) => setBuscaNatureza(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleFiltrarClick();
                  }
                }}
                className="w-full px-3.5 py-2 pl-9 rounded-lg bg-[#141B2D] border border-white/10 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors shadow-inner"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {/* Tipo de Impressão */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Tipo de Impressão
            </label>
            <select
              value={tipoImpressaoFiltro}
              onChange={(e) => {
                setTipoImpressaoFiltro(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg bg-[#141B2D] border border-white/10 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer shadow-inner"
            >
              <option value="todos">Todos os tipos</option>
              <option value="certidao">Certidão de Registro</option>
              <option value="livro">Ato no Livro</option>
            </select>
          </div>

          {/* Status + Ações */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Status
            </label>
            <div className="flex gap-2">
              <select
                value={statusFiltro}
                onChange={(e) => {
                  setStatusFiltro(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg bg-[#141B2D] border border-white/10 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer shadow-inner"
              >
                <option value="todos">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="realizado">Realizado</option>
              </select>
              <button
                onClick={handleFiltrarClick}
                className="px-4 py-2 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-xs font-bold text-white whitespace-nowrap transition-all shadow-md shadow-indigo-500/25 active:scale-95"
              >
                Filtrar
              </button>
            </div>
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex items-center justify-between pt-3 border-t border-white/8 flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {(['hoje', 'ontem', '7dias', 'mesAtual', 'mesAnterior'] as const).map((preset) => {
              const labels = {
                hoje: 'Hoje',
                ontem: 'Ontem',
                '7dias': 'Últimos 7 dias',
                mesAtual: 'Mês atual',
                mesAnterior: 'Mês anterior',
              };
              const active = dataPreset === preset;
              return (
                <button
                  key={preset}
                  onClick={() => handlePresetChange(preset)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active
                      ? 'bg-[#3b1578] text-purple-100 border border-purple-400/50 shadow-sm font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {labels[preset]}
                </button>
              );
            })}
          </div>

          <button
            onClick={limparFiltros}
            className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Limpar filtros</span>
          </button>
        </div>
      </div>
    ) : (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-[#0c1222]/70 border border-white/10 text-xs text-slate-300 shadow-sm print:hidden">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-purple-400" />
            <span>Painel de filtros recolhido.</span>
            {totalFiltrosAtivos > 0 && (
              <span className="text-purple-300 font-semibold">({totalFiltrosAtivos} filtro(s) ativo(s))</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setFiltrosAbertos(true);
              setTimeout(() => {
                filtersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                buscaInputRef.current?.focus();
              }, 80);
            }}
            className="text-purple-400 hover:text-purple-300 font-semibold underline transition-colors"
          >
            Expandir filtros
          </button>
        </div>
      )}

      {/* ────────────────── BARRA DE FILTROS ATIVOS ────────────────── */}
      {(buscaNatureza || tipoImpressaoFiltro !== 'todos' || statusFiltro !== 'todos') && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-900/60 border border-indigo-500/30 text-xs flex-wrap shadow-inner animate-fadeIn print:hidden">
          <span className="text-indigo-300 font-bold flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-indigo-400" /> Filtros Ativos:
          </span>
          {buscaNatureza && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 text-xs font-medium">
              Termo: <strong className="text-white">"{buscaNatureza}"</strong>
              <button
                onClick={() => { setBuscaNatureza(''); setCurrentPage(1); }}
                className="hover:text-red-300 font-bold ml-1 text-sm leading-none"
                title="Remover filtro de busca"
              >
                ×
              </button>
            </span>
          )}
          {tipoImpressaoFiltro !== 'todos' && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium ${
              tipoImpressaoFiltro === 'certidao'
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-200'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-200'
            }`}>
              Tipo: <strong className="text-white">{tipoImpressaoFiltro === 'certidao' ? 'Certidão de Registro' : 'Ato no Livro'}</strong>
              <button
                onClick={() => { setTipoImpressaoFiltro('todos'); setCurrentPage(1); }}
                className="hover:text-red-300 font-bold ml-1 text-sm leading-none"
                title="Remover filtro de tipo"
              >
                ×
              </button>
            </span>
          )}
          {statusFiltro !== 'todos' && (
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium ${
              statusFiltro === 'realizado'
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
                : 'bg-rose-500/20 border-rose-500/40 text-rose-200'
            }`}>
              Status: <strong className="text-white">{statusFiltro === 'realizado' ? 'Realizado' : 'Pendente'}</strong>
              <button
                onClick={() => { setStatusFiltro('todos'); setCurrentPage(1); }}
                className="hover:text-red-300 font-bold ml-1 text-sm leading-none"
                title="Remover filtro de status"
              >
                ×
              </button>
            </span>
          )}
          <span className="text-slate-400 ml-auto font-mono text-[11px] pr-2">
            {data.totalRegistros} {data.totalRegistros === 1 ? 'protocolo listado' : 'protocolos listados'}
          </span>
          <button
            onClick={limparFiltros}
            className="text-[11px] text-indigo-300 hover:text-white font-semibold underline transition-colors"
          >
            Limpar todos
          </button>
        </div>
      )}

      {/* ────────────────── 2 COLUNAS DE FLUXO (LIVRO E CERTIDÃO) COM SEUS RESPECTIVOS OPERADORES ────────────────── */}
      <div className={`grid grid-cols-1 xl:grid-cols-2 gap-5 items-start ${imprimindoApenasTabela ? 'print:hidden' : ''}`}>
        {/* Banner informativo quando o fluxo de Livro está ocultado */}
        {tipoImpressaoFiltro === 'certidao' && (
          <div className="xl:col-span-2 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs text-amber-200 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Fluxo <strong>Impressão Definitiva do Ato no Livro</strong> oculto pelo filtro Tipo de Impressão.</span>
            </div>
            <button
              onClick={() => { setTipoImpressaoFiltro('todos'); setCurrentPage(1); }}
              className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold transition-all text-xs"
            >
              Exibir Ambos os Fluxos
            </button>
          </div>
        )}

        {/* COLUNA 1: FLUXO DO LIVRO (ÂMBAR) */}
        {tipoImpressaoFiltro !== 'certidao' && (
          <div className={`flex flex-col gap-4 ${tipoImpressaoFiltro === 'livro' ? 'xl:col-span-2' : ''}`}>
            {/* CARD 1: IMPRESSÃO DEFINITIVA DO ATO NO LIVRO (ÂMBAR) */}
            <div className="rounded-2xl bg-[#171208]/90 border border-amber-500/35 p-6 shadow-xl shadow-amber-950/20 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600" />

              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-300 shadow-inner">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-amber-400">
                      Impressão Definitiva do Ato no Livro
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Fluxo de impressão física dos atos no livro</p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-300 uppercase tracking-wider">
                  Livro
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pb-4">
                {/* Demanda */}
                <div
                  onClick={() => handleCardClick('livro', 'todos', 'Livro – Demanda total')}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all group ${
                    isLivroDemandaActive
                      ? 'bg-amber-500/15 border-amber-400/80 ring-2 ring-amber-400/50 shadow-md shadow-amber-500/20'
                      : statusFiltro !== 'todos'
                        ? 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100'
                        : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-amber-400/30'
                  }`}
                  title="Clique para filtrar por demanda"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Demanda</span>
                      <span className="text-[11px] text-slate-400 block truncate leading-tight">(Último Registro)</span>
                    </div>
                    {isLivroDemandaActive && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold uppercase">Ativo</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5 overflow-hidden min-w-0">
                    <span className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight group-hover:text-amber-200 transition-colors">{data.livroStats.demanda}</span>
                    <span className="text-xs text-slate-400 font-medium">livros</span>
                  </div>
                </div>

                {/* Produzidas */}
                <div
                  onClick={() => handleCardClick('livro', 'realizado', 'Livro – Produzidas')}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all group ${
                    isLivroProduzidasActive
                      ? 'bg-emerald-500/15 border-emerald-400/80 ring-2 ring-emerald-400/50 shadow-md shadow-emerald-500/20'
                      : statusFiltro === 'pendente'
                        ? 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100'
                        : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-emerald-400/30'
                  }`}
                  title="Clique para filtrar por produzidas"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Produzidas</span>
                      <span className="text-[11px] text-slate-400 block truncate leading-tight">(Data Impressão)</span>
                    </div>
                    {isLivroProduzidasActive && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">Ativo</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5 overflow-hidden min-w-0">
                    <span className="text-2xl xl:text-3xl font-extrabold text-amber-300 tracking-tight group-hover:text-emerald-300 transition-colors">{data.livroStats.produzidas}</span>
                    <span className="text-xs text-slate-400 font-medium">livros</span>
                  </div>
                </div>

                {/* Pendências */}
                <div
                  onClick={() => handleCardClick('livro', 'pendente', 'Livro – Pendências')}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all group ${
                    isLivroPendenciasActive
                      ? 'bg-rose-500/20 border-rose-400/80 ring-2 ring-rose-400/50 shadow-md shadow-rose-500/20'
                      : statusFiltro === 'realizado'
                        ? 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100'
                        : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-rose-400/30'
                  }`}
                  title="Clique para filtrar por pendências"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Pendências</span>
                      <span className="text-[11px] text-rose-400/90 block truncate leading-tight">(Saldo Atual)</span>
                    </div>
                    {isLivroPendenciasActive && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold uppercase">Ativo</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5 overflow-hidden min-w-0">
                    <span className="text-2xl xl:text-3xl font-extrabold text-rose-400 tracking-tight">{data.livroStats.pendencias}</span>
                    <span className="text-xs text-slate-400 font-medium">livros</span>
                  </div>
                </div>

                {/* Saldo Operacional */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Saldo Operac.</span>
                    <span className="text-[11px] text-slate-400 block truncate leading-tight">(Prod. - Dem.)</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5 overflow-hidden min-w-0">
                    <span className={`text-2xl xl:text-3xl font-extrabold tracking-tight ${data.livroStats.saldoOperacional >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {data.livroStats.saldoOperacional}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">livros</span>
                  </div>
                </div>

                {/* Taxa de Atendimento */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Taxa Atend.</span>
                    <span className="text-[11px] text-slate-400 block truncate leading-tight">Eficiência</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight">{data.livroStats.taxaAtendimento}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-amber-950/80 rounded-full mt-2 overflow-hidden border border-amber-500/20">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, data.livroStats.taxaAtendimento)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tempo Médio */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Tempo Médio</span>
                    <span className="text-[11px] text-slate-400 block truncate leading-tight">para Impressão</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5 overflow-hidden min-w-0">
                    <span className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight">0,8</span>
                    <span className="text-xs text-slate-400 font-medium">dia</span>
                  </div>
                </div>
              </div>

              <div className="pt-3.5 border-t border-white/10 text-xs text-slate-300 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Backlog início do período:</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300 font-bold font-mono text-xs">
                    {data.livroStats.backlogInicio} livros
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Backlog final do período:</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-300 font-bold font-mono text-xs">
                    {data.livroStats.backlogFinal} livros
                  </span>
                </div>
              </div>
            </div>

            {/* CARD DE PRODUÇÃO DO OPERADOR DO LIVRO (ANTONIO) */}
            <div className="rounded-2xl bg-[#140e06]/90 border border-amber-500/30 p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">Produção por Operador · Livro</h3>
                    <p className="text-[11px] text-slate-400">Atos impressos fisicamente no Livro no período</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-amber-400/90 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/25">
                  {operadoresLivro.length} {operadoresLivro.length === 1 ? 'operador' : 'operadores'}
                </span>
              </div>

              {operadoresLivro.length > 0 ? (
                <div className="space-y-2.5">
                  {operadoresLivro.map((op) => {
                    const maxLivro = operadoresLivro[0]?.totalLivro || 1;
                    const pct = Math.round((op.totalLivro / maxLivro) * 100);
                    return (
                      <div key={op.nome} className="rounded-xl bg-white/[0.03] border border-amber-500/15 p-3.5 flex flex-col gap-2.5 hover:bg-white/[0.05] transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                              <User className="w-3.5 h-3.5 text-amber-300" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{op.nome}</p>
                              <p className="text-[10px] text-slate-400">Operador de Impressão</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black font-mono text-amber-300">{op.totalLivro}</span>
                            <span className="text-[10px] text-slate-400 block -mt-1 font-medium">atos impressos</span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-amber-950/60 rounded-full overflow-hidden border border-amber-500/20">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">
                  Nenhum ato impresso no livro no período selecionado.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Banner informativo quando o fluxo de Certidão está ocultado */}
        {tipoImpressaoFiltro === 'livro' && (
          <div className="xl:col-span-2 p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-between text-xs text-cyan-200 shadow-sm animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <Printer className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Fluxo <strong>Impressão de Certidão de Registro</strong> oculto pelo filtro Tipo de Impressão.</span>
            </div>
            <button
              onClick={() => { setTipoImpressaoFiltro('todos'); setCurrentPage(1); }}
              className="px-3 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold transition-all text-xs"
            >
              Exibir Ambos os Fluxos
            </button>
          </div>
        )}

        {/* COLUNA 2: FLUXO DA CERTIDÃO (CIANO) */}
        {tipoImpressaoFiltro !== 'livro' && (
          <div className={`flex flex-col gap-4 ${tipoImpressaoFiltro === 'certidao' ? 'xl:col-span-2' : ''}`}>
            {/* CARD 2: IMPRESSÃO DE CERTIDÃO DE REGISTRO (CIANO) */}
            <div className="rounded-2xl bg-[#0c1427]/90 border border-cyan-500/35 p-6 shadow-xl shadow-cyan-950/20 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-600" />
              
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-300 shadow-inner">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-cyan-400">
                      Impressão de Certidão de Registro
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">Fluxo de emissão e controle das certidões</p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 uppercase tracking-wider">
                  Certidão
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pb-4">
                {/* Demanda Certidão */}
                <div
                  onClick={() => handleCardClick('certidao', 'todos', 'Certidão – Demanda total')}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all group ${
                    isCertidaoDemandaActive
                      ? 'bg-cyan-500/15 border-cyan-400/80 ring-2 ring-cyan-400/50 shadow-md shadow-cyan-500/20'
                      : statusFiltro !== 'todos'
                        ? 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100'
                        : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-cyan-400/30'
                  }`}
                  title="Clique para filtrar por demanda"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Demanda</span>
                      <span className="text-[11px] text-slate-400 block truncate leading-tight">(Último Registro)</span>
                    </div>
                    {isCertidaoDemandaActive && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold uppercase">Ativo</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5 overflow-hidden min-w-0">
                    <span className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight group-hover:text-cyan-200 transition-colors">{data.certidaoStats.demanda}</span>
                    <span className="text-xs text-slate-400 font-medium">livros</span>
                  </div>
                </div>

                {/* Produzidas Certidão */}
                <div
                  onClick={() => handleCardClick('certidao', 'realizado', 'Certidão – Produzidas')}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all group ${
                    isCertidaoProduzidasActive
                      ? 'bg-emerald-500/15 border-emerald-400/80 ring-2 ring-emerald-400/50 shadow-md shadow-emerald-500/20'
                      : statusFiltro === 'pendente'
                        ? 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100'
                        : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-emerald-400/30'
                  }`}
                  title="Clique para filtrar por produzidas"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Produzidas</span>
                      <span className="text-[11px] text-slate-400 block truncate leading-tight">(Data Impressão)</span>
                    </div>
                    {isCertidaoProduzidasActive && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold uppercase">Ativo</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5 overflow-hidden min-w-0">
                    <span className="text-2xl xl:text-3xl font-extrabold text-cyan-300 tracking-tight group-hover:text-emerald-300 transition-colors">{data.certidaoStats.produzidas}</span>
                    <span className="text-xs text-slate-400 font-medium">livros</span>
                  </div>
                </div>

                {/* Pendências Certidão */}
                <div
                  onClick={() => handleCardClick('certidao', 'pendente', 'Certidão – Pendências')}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all group ${
                    isCertidaoPendenciasActive
                      ? 'bg-rose-500/20 border-rose-400/80 ring-2 ring-rose-400/50 shadow-md shadow-rose-500/20'
                      : statusFiltro === 'realizado'
                        ? 'bg-white/[0.02] border-white/5 opacity-60 hover:opacity-100'
                        : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06] hover:border-rose-400/30'
                  }`}
                  title="Clique para filtrar por pendências"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block">Pendências</span>
                      <span className="text-[11px] text-rose-400/90 block truncate leading-tight">(Saldo Atual)</span>
                    </div>
                    {isCertidaoPendenciasActive && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold uppercase">Ativo</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5 overflow-hidden min-w-0">
                    <span className="text-2xl xl:text-3xl font-extrabold text-rose-400 tracking-tight">{data.certidaoStats.pendencias}</span>
                    <span className="text-xs text-slate-400 font-medium">livros</span>
                  </div>
                </div>

                {/* Saldo Operacional */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Saldo Operac.</span>
                    <span className="text-[11px] text-slate-400 block truncate leading-tight">(Prod. - Dem.)</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5 overflow-hidden min-w-0">
                    <span className={`text-2xl xl:text-3xl font-extrabold tracking-tight ${data.certidaoStats.saldoOperacional >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {data.certidaoStats.saldoOperacional}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">livros</span>
                  </div>
                </div>

                {/* Taxa de Atendimento */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Taxa Atend.</span>
                    <span className="text-[11px] text-slate-400 block truncate leading-tight">Eficiência</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight">{data.certidaoStats.taxaAtendimento}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-cyan-950/80 rounded-full mt-2 overflow-hidden border border-cyan-500/20">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, data.certidaoStats.taxaAtendimento)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tempo Médio */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col justify-between hover:bg-white/[0.05] transition-colors">
                  <div>
                    <span className="text-xs font-semibold text-slate-200 block">Tempo Médio</span>
                    <span className="text-[11px] text-slate-400 block truncate leading-tight">para Impressão</span>
                  </div>
                  <div className="mt-3 flex items-baseline gap-1.5 overflow-hidden min-w-0">
                    <span className="text-2xl xl:text-3xl font-extrabold text-white tracking-tight">1,3</span>
                    <span className="text-xs text-slate-400 font-medium">dias</span>
                  </div>
                </div>
              </div>

              <div className="pt-3.5 border-t border-white/10 text-xs text-slate-300 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Backlog início do período:</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-300 font-bold font-mono text-xs">
                    {data.certidaoStats.backlogInicio} livros
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Backlog final do período:</span>
                  <span className="px-2.5 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-300 font-bold font-mono text-xs">
                    {data.certidaoStats.backlogFinal} livros
                  </span>
                </div>
              </div>
            </div>

            {/* CARD DE PRODUÇÃO DO OPERADOR DA CERTIDÃO (DAVID) */}
            <div className="rounded-2xl bg-[#0c1427]/90 border border-cyan-500/30 p-5 shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-300">Produção por Operador · Certidão</h3>
                    <p className="text-[11px] text-slate-400">Certidões de Registro emitidas/preparadas no período</p>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-cyan-400/90 bg-cyan-500/10 px-2.5 py-0.5 rounded-full border border-cyan-500/25">
                  {operadoresCertidao.length} {operadoresCertidao.length === 1 ? 'operador' : 'operadores'}
                </span>
              </div>

              {operadoresCertidao.length > 0 ? (
                <div className="space-y-2.5">
                  {operadoresCertidao.map((op) => {
                    const maxCertidao = operadoresCertidao[0]?.totalCertidao || 1;
                    const pct = Math.round((op.totalCertidao / maxCertidao) * 100);
                    return (
                      <div key={op.nome} className="rounded-xl bg-white/[0.03] border border-cyan-500/15 p-3.5 flex flex-col gap-2.5 hover:bg-white/[0.05] transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                              <User className="w-3.5 h-3.5 text-cyan-300" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{op.nome}</p>
                              <p className="text-[10px] text-slate-400">Operador de Certidões</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-xl font-black font-mono text-cyan-300">{op.totalCertidao}</span>
                            <span className="text-[10px] text-slate-400 block -mt-1 font-medium">certidões emitidas</span>
                          </div>
                        </div>
                        <div className="w-full h-1.5 bg-cyan-950/60 rounded-full overflow-hidden border border-cyan-500/20">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-cyan-600 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-xs text-slate-400">
                  Nenhuma certidão emitida no período selecionado.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ────────────────── TABELA DE SITUAÇÃO DAS IMPRESSÕES ────────────────── */}
      <div ref={tableRef} className="w-full rounded-2xl bg-[#0c1222]/90 border border-white/10 p-6 shadow-xl overflow-hidden print:p-0 print:border-none print:shadow-none print:bg-white">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10 flex-wrap gap-3 print:hidden">
          <div>
            <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-100">
              Pendências e Situação das Impressões
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              (base: {visao === 'producao' ? 'Data das Impressões Realizadas' : 'Data do Último Registro'})
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="px-3 py-1 rounded-lg bg-slate-800/90 border border-white/15 text-xs text-slate-200 font-mono font-semibold">
              {data.totalRegistros} {data.totalRegistros === 1 ? 'registro' : 'registros'}
            </span>
            {activeCardLabel && (
              <div className="flex items-center gap-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/40 text-violet-300 text-xs font-semibold">
                  Filtro: {activeCardLabel}
                </span>
                <button
                  onClick={() => { setTipoImpressaoFiltro('todos'); setStatusFiltro('todos'); setActiveCardLabel(null); }}
                  className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded border border-white/10 hover:bg-white/5 transition-colors"
                >
                  × Limpar
                </button>
              </div>
            )}
            {/* Indicador de Ordenação Ativa */}
            <div
              onClick={() => handleSort(sortBy)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141B2D] hover:bg-[#1A233A] border border-white/15 text-xs text-slate-300 shadow-sm cursor-pointer select-none transition-colors"
              title="Clique para alternar a direção da ordenação"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-purple-400" />
              <span>Ordem:</span>
              <strong className="text-white">{getColumnLabel(sortBy)}</strong>
              <span className="text-[11px] text-purple-300 font-semibold">
                ({sortOrder === 'asc' ? 'Crescente' : 'Decrescente'})
              </span>
            </div>

            {/* NOVO: Botão Imprimir Listagem */}
            <div className="relative" ref={printTableMenuRef}>
              <div className="inline-flex rounded-lg shadow-sm border border-emerald-500/40 bg-emerald-600/20 p-0.5">
                <button
                  type="button"
                  onClick={handleImprimirPaginaAtual}
                  disabled={preparandoImpressaoTodos}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                  title={`Imprimir a listagem de registros exibidos (${paginatedRows.length} itens)`}
                >
                  {preparandoImpressaoTodos ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-200" />
                  ) : (
                    <Printer className="w-3.5 h-3.5 text-emerald-200" />
                  )}
                  <span>{preparandoImpressaoTodos ? 'Carregando...' : 'Imprimir Listagem'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMenuImprimirTabelaAberto((prev) => !prev)}
                  disabled={preparandoImpressaoTodos}
                  className="px-1.5 py-1.5 rounded-md hover:bg-emerald-500/40 text-emerald-200 transition-colors disabled:opacity-50"
                  title="Mais opções de impressão desta listagem"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Dropdown com opções de impressão */}
              {menuImprimirTabelaAberto && (
                <div className="absolute right-0 mt-1.5 w-64 rounded-xl bg-[#10172A] border border-white/15 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-white/10 mb-1">
                    Opções de Impressão da Listagem
                  </div>

                  <button
                    type="button"
                    onClick={handleImprimirPaginaAtual}
                    className="flex items-start gap-2.5 w-full px-3 py-2 text-left rounded-lg text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <Printer className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-white">Imprimir página atual</div>
                      <div className="text-[11px] text-slate-400">
                        {paginatedRows.length} {paginatedRows.length === 1 ? 'protocolo visível' : 'protocolos visíveis'} na página
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleImprimirTodosRegistros}
                    className="flex items-start gap-2.5 w-full px-3 py-2 text-left rounded-lg text-xs text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <Download className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold text-white">Imprimir todos os registros</div>
                      <div className="text-[11px] text-slate-400">
                        Carrega todos os {data.totalRegistros} protocolos filtrados
                      </div>
                    </div>
                  </button>

                  <div className="mt-1 pt-1.5 border-t border-white/10 px-3 py-1 text-[10px] text-slate-400">
                    💡 <em>Você também pode escolher ver até 100 linhas por página no rodapé da tabela.</em>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabela Responsiva com Distribuição Equilibrada */}
        <div className="overflow-x-auto rounded-xl border border-white/8 print:overflow-visible print:border print:border-slate-300 print:rounded-none">
          <table className="w-full table-fixed text-left border-collapse min-w-[960px] print:min-w-0 print:w-full print:border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-xs font-semibold text-slate-300 print:bg-slate-100 print:border-b-2 print:border-slate-400">
                {/* Protocolo */}
                <th
                  onClick={() => handleSort('protocolo')}
                  className={`py-3 px-3.5 whitespace-nowrap w-[8%] cursor-pointer select-none group transition-colors hover:bg-white/[0.06] print:text-slate-900 print:bg-slate-100 print:py-2 print:px-2 print:text-[10px] print:font-bold print:border-r print:border-slate-300 ${
                    sortBy === 'protocolo' ? 'text-purple-300 font-bold bg-purple-500/10' : 'text-slate-300'
                  }`}
                  title="Clique para ordenar por Protocolo"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Protocolo</span>
                    {renderSortIcon('protocolo')}
                  </div>
                </th>

                {/* Nº Livro */}
                <th
                  onClick={() => handleSort('numeroLivro')}
                  className={`py-3 px-3.5 whitespace-nowrap w-[9%] cursor-pointer select-none group transition-colors hover:bg-white/[0.06] print:text-slate-900 print:bg-slate-100 print:py-2 print:px-2 print:text-[10px] print:font-bold print:border-r print:border-slate-300 ${
                    sortBy === 'numeroLivro' ? 'text-purple-300 font-bold bg-purple-500/10' : 'text-slate-300'
                  }`}
                  title="Clique para ordenar por Nº Livro / Matrícula"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Nº Livro</span>
                    {renderSortIcon('numeroLivro')}
                  </div>
                </th>

                {/* Tipo / Natureza */}
                <th
                  onClick={() => handleSort('tipoNatureza')}
                  className={`py-3 px-3.5 whitespace-nowrap w-[14%] cursor-pointer select-none group transition-colors hover:bg-white/[0.06] print:text-slate-900 print:bg-slate-100 print:py-2 print:px-2 print:text-[10px] print:font-bold print:border-r print:border-slate-300 ${
                    sortBy === 'tipoNatureza' ? 'text-purple-300 font-bold bg-purple-500/10' : 'text-slate-300'
                  }`}
                  title="Clique para ordenar por Natureza"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Tipo / Natureza</span>
                    {renderSortIcon('tipoNatureza')}
                  </div>
                </th>

                {/* Data Entrada */}
                <th
                  onClick={() => handleSort('dataEntrada')}
                  className={`py-3 px-3.5 whitespace-nowrap w-[8%] cursor-pointer select-none group transition-colors hover:bg-white/[0.06] print:text-slate-900 print:bg-slate-100 print:py-2 print:px-2 print:text-[10px] print:font-bold print:border-r print:border-slate-300 ${
                    sortBy === 'dataEntrada' ? 'text-purple-300 font-bold bg-purple-500/10' : 'text-slate-300'
                  }`}
                  title="Clique para ordenar por Data de Entrada"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Data Entrada</span>
                    {renderSortIcon('dataEntrada')}
                  </div>
                </th>

                {/* Etapa Atual */}
                <th
                  onClick={() => handleSort('etapaAtual')}
                  className={`py-3 px-3.5 whitespace-nowrap w-[13%] cursor-pointer select-none group transition-colors hover:bg-white/[0.06] print:text-slate-900 print:bg-slate-100 print:py-2 print:px-2 print:text-[10px] print:font-bold print:border-r print:border-slate-300 ${
                    sortBy === 'etapaAtual' ? 'text-purple-300 font-bold bg-purple-500/10' : 'text-slate-300'
                  }`}
                  title="Clique para ordenar por Etapa Atual"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Etapa Atual</span>
                    {renderSortIcon('etapaAtual')}
                  </div>
                </th>

                {/* Último Registro */}
                <th
                  onClick={() => handleSort('ultimoRegistro')}
                  className={`py-3 px-3.5 whitespace-nowrap w-[11%] cursor-pointer select-none group transition-colors hover:bg-white/[0.06] print:text-slate-900 print:bg-slate-100 print:py-2 print:px-2 print:text-[10px] print:font-bold print:border-r print:border-slate-300 ${
                    sortBy === 'ultimoRegistro' ? 'text-purple-300 font-bold bg-purple-500/10' : 'text-slate-300'
                  }`}
                  title="Clique para ordenar por Data do Último Registro"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Último Registro</span>
                    {renderSortIcon('ultimoRegistro')}
                  </div>
                </th>

                {/* Impressão no Livro */}
                <th
                  onClick={() => handleSort('livroStatus')}
                  className={`py-3 px-3.5 whitespace-nowrap w-[11%] cursor-pointer select-none group transition-colors hover:bg-white/[0.06] print:text-slate-900 print:bg-slate-100 print:py-2 print:px-2 print:text-[10px] print:font-bold print:border-r print:border-slate-300 ${
                    sortBy === 'livroStatus' ? 'text-purple-300 font-bold bg-purple-500/10' : 'text-slate-300'
                  } ${tipoImpressaoFiltro === 'livro' ? 'border-b-2 border-amber-400 font-bold' : ''}`}
                  title="Clique para ordenar por Status de Impressão do Livro"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Impressão no Livro {tipoImpressaoFiltro === 'livro' ? '★' : ''}</span>
                    {renderSortIcon('livroStatus')}
                  </div>
                </th>

                {/* Certidão Registro */}
                <th
                  onClick={() => handleSort('certidaoStatus')}
                  className={`py-3 px-3.5 whitespace-nowrap w-[10%] cursor-pointer select-none group transition-colors hover:bg-white/[0.06] print:text-slate-900 print:bg-slate-100 print:py-2 print:px-2 print:text-[10px] print:font-bold print:border-r print:border-slate-300 ${
                    sortBy === 'certidaoStatus' ? 'text-purple-300 font-bold bg-purple-500/10' : 'text-slate-300'
                  } ${tipoImpressaoFiltro === 'certidao' ? 'border-b-2 border-cyan-400 font-bold' : ''}`}
                  title="Clique para ordenar por Status da Certidão"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Certidão Registro {tipoImpressaoFiltro === 'certidao' ? '★' : ''}</span>
                    {renderSortIcon('certidaoStatus')}
                  </div>
                </th>

                {/* Impresso por */}
                <th
                  onClick={() => handleSort('impressoPor')}
                  className={`py-3 px-3.5 whitespace-nowrap w-[10%] cursor-pointer select-none group transition-colors hover:bg-white/[0.06] print:text-slate-900 print:bg-slate-100 print:py-2 print:px-2 print:text-[10px] print:font-bold print:border-r print:border-slate-300 ${
                    sortBy === 'impressoPor' ? 'text-purple-300 font-bold bg-purple-500/10' : 'text-slate-300'
                  }`}
                  title="Clique para ordenar por Operador Responsável"
                >
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-400 print:hidden" />
                    <span>Impresso por</span>
                    {renderSortIcon('impressoPor')}
                  </div>
                </th>

                {/* Dias */}
                <th
                  onClick={() => handleSort('diasPendente')}
                  className={`py-3 px-3.5 text-center whitespace-nowrap w-[6%] cursor-pointer select-none group transition-colors hover:bg-white/[0.06] print:text-slate-900 print:bg-slate-100 print:py-2 print:px-2 print:text-[10px] print:font-bold ${
                    sortBy === 'diasPendente' ? 'text-purple-300 font-bold bg-purple-500/10' : 'text-slate-300'
                  }`}
                  title="Clique para ordenar por Dias de Pendência"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Dias</span>
                    {renderSortIcon('diasPendente')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs sm:text-[13px] print:divide-slate-200">
              {rowsParaExibir.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400 text-sm font-medium print:text-slate-600 print:py-6">
                    Nenhum registro encontrado para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                rowsParaExibir.map((row) => (
                  <tr key={row.id} className="hover:bg-white/[0.04] transition-colors print:even:bg-slate-50">
                    {/* Protocolo */}
                    <td className="py-3.5 px-3.5 font-mono font-bold text-white whitespace-nowrap text-sm print:text-slate-950 print:py-1.5 print:px-2 print:text-[11px] print:border-b print:border-slate-200">
                      {row.protocolo}
                    </td>

                    {/* Nº Livro */}
                    <td className="py-3.5 px-3.5 font-mono font-semibold text-slate-200 whitespace-nowrap text-xs sm:text-sm print:text-slate-850 print:py-1.5 print:px-2 print:text-[10px] print:border-b print:border-slate-200">
                      {row.numeroLivro}
                    </td>

                    {/* Tipo / Natureza Badge */}
                    <td className="py-3.5 px-3.5 print:py-1.5 print:px-2 print:border-b print:border-slate-200">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-[#221544] border border-purple-500/35 text-xs font-semibold text-purple-200 shadow-sm whitespace-nowrap print:bg-slate-100 print:border print:border-slate-300 print:text-slate-900 print:shadow-none print:py-0.5 print:px-1.5 print:text-[9.5px]">
                        {row.tipoNatureza}
                      </span>
                    </td>

                    {/* Data Entrada */}
                    <td className="py-3.5 px-3.5 font-mono text-xs text-slate-300 whitespace-nowrap print:text-slate-700 print:py-1.5 print:px-2 print:text-[10px] print:border-b print:border-slate-200">
                      {row.dataEntrada || '-'}
                    </td>

                    {/* Etapa Atual Badge */}
                    <td className="py-3.5 px-3.5 print:py-1.5 print:px-2 print:border-b print:border-slate-200">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-cyan-950/40 border border-cyan-500/25 text-cyan-200 shadow-sm whitespace-nowrap print:bg-transparent print:border-none print:text-slate-800 print:shadow-none print:p-0 print:text-[9.5px] print:font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 animate-pulse print:hidden" />
                        {row.etapaAtual || 'Impressão'}
                      </span>
                    </td>

                    {/* Último Registro */}
                    <td className="py-3.5 px-3.5 font-mono text-xs text-slate-300 whitespace-nowrap print:text-slate-700 print:py-1.5 print:px-2 print:text-[10px] print:border-b print:border-slate-200">
                      {row.ultimoRegistro}
                    </td>

                    {/* Impressão no Livro Status */}
                    <td className={`py-3.5 px-3.5 whitespace-nowrap print:py-1.5 print:px-2 print:border-b print:border-slate-200 ${tipoImpressaoFiltro === 'livro' ? 'bg-amber-500/[0.06] print:bg-transparent' : ''}`}>
                      {row.livroStatus === 'REALIZADO' && (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0 print:hidden" />
                          <div>
                            <span className="font-semibold text-emerald-300 text-xs sm:text-[13px] print:text-emerald-800 print:font-bold print:text-[10.5px]">Realizado</span>
                            {row.livroData && (
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5 print:text-slate-600 print:text-[9px]">{row.livroData}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {row.livroStatus === 'PENDENTE' && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold text-xs print:bg-rose-50 print:border print:border-rose-400 print:text-rose-800 print:py-0.5 print:px-1.5 print:text-[9.5px] print:font-bold">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 print:hidden" />
                          <span>Pendente</span>
                        </div>
                      )}
                      {row.livroStatus === 'NAO_APLICAVEL' && (
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs print:text-slate-400 print:text-[9.5px]">
                          <MinusCircle className="w-3.5 h-3.5 shrink-0 print:hidden" />
                          <span>Não aplicável</span>
                        </div>
                      )}
                    </td>

                    {/* Certidão Registro Status */}
                    <td className={`py-3.5 px-3.5 whitespace-nowrap print:py-1.5 print:px-2 print:border-b print:border-slate-200 ${tipoImpressaoFiltro === 'certidao' ? 'bg-cyan-500/[0.06] print:bg-transparent' : ''}`}>
                      {row.certidaoStatus === 'REALIZADO' && (
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0 print:hidden" />
                          <div>
                            <span className="font-semibold text-emerald-300 text-xs sm:text-[13px] print:text-emerald-800 print:font-bold print:text-[10.5px]">Realizado</span>
                            {row.certidaoData && (
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5 print:text-slate-600 print:text-[9px]">{row.certidaoData}</p>
                            )}
                          </div>
                        </div>
                      )}
                      {row.certidaoStatus === 'PENDENTE' && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-semibold text-xs print:bg-rose-50 print:border print:border-rose-400 print:text-rose-800 print:py-0.5 print:px-1.5 print:text-[9.5px] print:font-bold">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 print:hidden" />
                          <span>Pendente</span>
                        </div>
                      )}
                      {row.certidaoStatus === 'NAO_APLICAVEL' && (
                        <div className="flex items-center gap-1.5 text-slate-500 text-xs print:text-slate-400 print:text-[9.5px]">
                          <MinusCircle className="w-3.5 h-3.5 shrink-0 print:hidden" />
                          <span>Não aplicável</span>
                        </div>
                      )}
                    </td>

                    {/* Impresso por */}
                    <td className="py-3.5 px-3.5 whitespace-nowrap print:py-1.5 print:px-2 print:border-b print:border-slate-200">
                      {(() => {
                        const resp = tipoImpressaoFiltro === 'certidao'
                          ? (row.certidaoResponsavel || row.livroResponsavel)
                          : (row.livroResponsavel || row.certidaoResponsavel);

                        if (!resp) return <span className="text-slate-600 text-xs print:text-slate-400">—</span>;

                        return (
                          <div className="flex flex-col gap-0.5" title={`Livro: ${row.livroResponsavel || '-'} | Certidão: ${row.certidaoResponsavel || '-'}`}>
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center shrink-0 print:hidden">
                                <User className="w-2.5 h-2.5 text-violet-400" />
                              </div>
                              <span className="text-xs text-slate-200 truncate max-w-[120px] font-medium print:text-slate-900 print:max-w-none print:text-[10px]">
                                {resp}
                              </span>
                            </div>
                            {row.livroResponsavel && row.certidaoResponsavel && row.livroResponsavel !== row.certidaoResponsavel && tipoImpressaoFiltro === 'todos' && (
                              <span className="text-[10px] text-slate-400 pl-6 truncate max-w-[130px] print:text-slate-600 print:pl-0 print:text-[9px]">
                                Cert: {row.certidaoResponsavel}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Dias Pendente */}
                    <td className="py-3.5 px-3.5 text-center font-mono whitespace-nowrap print:py-1.5 print:px-2 print:border-b print:border-slate-200">
                      {row.diasPendente > 0 ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold text-xs sm:text-[13px] print:bg-transparent print:border-none print:text-rose-700 print:font-extrabold print:text-[11px]">
                          {row.diasPendente}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs sm:text-[13px] print:text-slate-400 print:text-[11px]">0</span>
                      )}
                    </td>
                  </tr>

                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10 text-xs sm:text-sm text-slate-300 flex-wrap gap-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-400 font-medium">Linhas por página:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-[#141B2D] border border-white/15 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="font-mono text-slate-400">
            {data.totalRegistros === 0
              ? '0 de 0'
              : `${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, data.totalRegistros)} de ${data.totalRegistros}`}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md bg-[#141B2D] border border-white/15 text-slate-300 hover:text-white hover:bg-[#1A233A] disabled:opacity-40 disabled:hover:bg-[#141B2D] transition-colors"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 rounded-md bg-[#6366f1] text-white font-bold text-xs font-mono shadow-sm">
              {currentPage}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md bg-[#141B2D] border border-white/15 text-slate-300 hover:text-white hover:bg-[#1A233A] disabled:opacity-40 disabled:hover:bg-[#141B2D] transition-colors"
              title="Próxima página"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
