import type {
  ReurbPendenciaDTO,
  ReurbRegularizacaoResumo,
  ReurbSituacaoValidacao,
} from '@/lib/reurb/types';

export const MESES_NOMES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
] as const;

export function buildAnosDisponiveis(baseYear: number): number[] {
  const top = Math.max(baseYear, new Date().getFullYear());
  const anos: number[] = [];
  for (let y = top; y >= 2009; y -= 1) {
    anos.push(y);
  }
  return anos;
}

export function formatarDataBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const clean = String(iso).slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatarDataHoraBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function labelModalidade(mod: string): string {
  if (mod === 'REURB_S') return 'REURB-S';
  if (mod === 'REURB_E') return 'REURB-E';
  if (mod === 'ART_69') return 'Art. 69';
  return mod;
}

export function labelStatusImportacaoOnr(status: string): string {
  if (status === 'IMPORTADA_ONR' || status === 'CONFIRMADA_ONR') return 'Importada no ONR';
  if (status === 'EXPORTADA_AGUARDANDO_CONFIRMACAO' || status === 'PENDENTE_CONFIRMACAO') {
    return 'JSON gerado (aguardando confirmação)';
  }
  if (status === 'NAO_GERADO') return 'Não gerado';
  return 'Não exportada';
}

export function triggerDownloadBlob(content: string | Blob, fileName: string, mime = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface PainelColumnFilters {
  matriculaProtocolo: string;
  empreendimento: string;
  registro: string;
  derivadasJson: string;
  situacao: 'TODAS' | ReurbSituacaoValidacao;
}

export const INITIAL_PAINEL_COLUMN_FILTERS: PainelColumnFilters = {
  matriculaProtocolo: '',
  empreendimento: '',
  registro: '',
  derivadasJson: '',
  situacao: 'TODAS',
};

/** Indica se há pelo menos um filtro de coluna ativo na tabela do Painel REURB. */
export function hasActivePainelFilters(filters: PainelColumnFilters): boolean {
  return (
    filters.matriculaProtocolo.trim().length > 0 ||
    filters.empreendimento.trim().length > 0 ||
    filters.registro.trim().length > 0 ||
    filters.derivadasJson.trim().length > 0 ||
    filters.situacao !== 'TODAS'
  );
}

/** Formata o rótulo legível do período selecionado no Painel REURB. */
export function formatarPeriodoLabel(ano: number, mes: number | 'todos'): string {
  if (mes === 'todos') {
    return `Ano inteiro (${ano})`;
  }
  const mesInfo = MESES_NOMES.find((item) => item.value === mes);
  return `${mesInfo?.label ?? String(mes)} / ${ano}`;
}

function normalizeFilterText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function matchesDerivadasFilter(qtd: number, rawFilter: string): boolean {
  const trimmed = rawFilter.trim();
  if (!trimmed) return true;
  if (/^(>=|<=|>|<|=)$/.test(trimmed)) return true;

  const openRange = /^(\d+)\s*-$/.exec(trimmed);
  if (openRange) {
    return qtd >= Number(openRange[1]);
  }

  const fullRange = /^(\d+)\s*-\s*(\d+)$/.exec(trimmed);
  if (fullRange) {
    const start = Number(fullRange[1]);
    const end = Number(fullRange[2]);
    return qtd >= Math.min(start, end) && qtd <= Math.max(start, end);
  }

  const comparison = /^(>=|<=|>|<|=)\s*(\d+)$/.exec(trimmed);
  if (comparison) {
    const op = comparison[1];
    const target = Number(comparison[2]);
    if (op === '>=') return qtd >= target;
    if (op === '<=') return qtd <= target;
    if (op === '>') return qtd > target;
    if (op === '<') return qtd < target;
    return qtd === target;
  }

  if (/^\d+$/.test(trimmed)) {
    return qtd === Number(trimmed);
  }

  return String(qtd).includes(trimmed);
}

/** Filtra processos do Painel REURB simultaneamente por todas as colunas visíveis. */
export function filtrarProcessosPainel(
  processos: ReurbRegularizacaoResumo[],
  filters: PainelColumnFilters
): ReurbRegularizacaoResumo[] {
  const matProtQuery = normalizeFilterText(filters.matriculaProtocolo);
  const empQuery = normalizeFilterText(filters.empreendimento);
  const regQuery = normalizeFilterText(filters.registro);

  return processos.filter((reg) => {
    if (matProtQuery) {
      const matProtTarget = normalizeFilterText(
        `${reg.matricula} prot. ${reg.protocolo} ${reg.protocolo}`
      );
      if (!matProtTarget.includes(matProtQuery)) return false;
    }

    if (empQuery) {
      const empTarget = normalizeFilterText(
        `${reg.empreendimento || 'Não informado'} ${labelModalidade(reg.modalidade)} ${reg.modalidade}`
      );
      if (!empTarget.includes(empQuery)) return false;
    }

    if (regQuery) {
      const regTarget = normalizeFilterText(
        `${formatarDataBr(reg.dataRegistro)} ${reg.dataRegistro || ''}`
      );
      if (!regTarget.includes(regQuery)) return false;
    }

    if (!matchesDerivadasFilter(reg.qtdDerivadasLista, filters.derivadasJson)) {
      return false;
    }

    if (filters.situacao !== 'TODAS' && reg.situacaoValidacao !== filters.situacao) {
      return false;
    }

    return true;
  });
}

/** Escapa caracteres especiais de HTML para renderização segura na versão de impressão. */
export function escapePrintHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface PendenciasAgrupadasModal {
  bloqueios: ReurbPendenciaDTO[];
  alertasConferencia: ReurbPendenciaDTO[];
  qtdDerivadasSemTitulacao: number;
  outrosInformativos: ReurbPendenciaDTO[];
  totalInformativos: number;
}

/** Separa bloqueios, alertas de conferência e avisos informativos/auditoria para o modal de detalhes. */
export function agruparPendenciasModal(
  pendencias: ReurbPendenciaDTO[]
): PendenciasAgrupadasModal {
  const bloqueios: ReurbPendenciaDTO[] = [];
  const alertasConferencia: ReurbPendenciaDTO[] = [];
  const outrosInformativos: ReurbPendenciaDTO[] = [];
  let qtdDerivadasSemTitulacao = 0;

  for (const p of pendencias) {
    const sev = String(p.severidade);
    if (sev === 'BLOQUEIA') {
      bloqueios.push(p);
    } else if (sev === 'ALTA' || sev === 'MEDIA') {
      alertasConferencia.push(p);
    } else if (
      p.campo === 'dataRegistro' &&
      p.motivo.includes('Derivada sem ato de titulação REURB')
    ) {
      qtdDerivadasSemTitulacao += 1;
    } else {
      outrosInformativos.push(p);
    }
  }

  return {
    bloqueios,
    alertasConferencia,
    qtdDerivadasSemTitulacao,
    outrosInformativos,
    totalInformativos: qtdDerivadasSemTitulacao + outrosInformativos.length,
  };
}
export interface GerarHtmlImpressaoPainelParams {
  ano: number;
  mes: number | 'todos';
  processos: ReurbRegularizacaoResumo[];
  totalPeriodo: number;
  filters: PainelColumnFilters;
  emitidoEm?: Date;
}

/** Gera documento HTML A4 em tema claro para impressão dos resultados filtrados do Painel REURB. */
export function gerarHtmlImpressaoPainel({
  ano,
  mes,
  processos,
  totalPeriodo,
  filters,
  emitidoEm,
}: GerarHtmlImpressaoPainelParams): string {
  const periodoLabel = formatarPeriodoLabel(ano, mes);
  const emissaoLabel = formatarDataHoraBr((emitidoEm ?? new Date()).toISOString());
  const totalDerivadas = processos.reduce((acc, item) => acc + item.qtdDerivadasLista, 0);
  const totalAptas = processos.filter((item) => item.situacaoValidacao === 'APTO').length;
  const totalPendentes = processos.length - totalAptas;

  const activeFilterItems: string[] = [];
  if (filters.matriculaProtocolo.trim()) {
    activeFilterItems.push(`Matrícula / Protocolo: "${filters.matriculaProtocolo.trim()}"`);
  }
  if (filters.empreendimento.trim()) {
    activeFilterItems.push(`Empreendimento: "${filters.empreendimento.trim()}"`);
  }
  if (filters.registro.trim()) {
    activeFilterItems.push(`Registro: "${filters.registro.trim()}"`);
  }
  if (filters.derivadasJson.trim()) {
    activeFilterItems.push(`Derivadas JSON: "${filters.derivadasJson.trim()}"`);
  }
  if (filters.situacao !== 'TODAS') {
    activeFilterItems.push(
      `Situação: ${filters.situacao === 'APTO' ? 'Apto' : 'Pendente'}`
    );
  }

  const filtrosResumoHtml =
    activeFilterItems.length > 0
      ? activeFilterItems
          .map((item) => `<span class="filter-chip">${escapePrintHtml(item)}</span>`)
          .join(' ')
      : '<span class="filter-empty">Nenhum filtro de coluna aplicado (todos os registros do período)</span>';

  const rowsHtml =
    processos.length > 0
      ? processos
          .map((reg) => {
            const situacaoLabel = reg.situacaoValidacao === 'APTO' ? 'Apto' : 'Pendente';
            const badgeClass =
              reg.situacaoValidacao === 'APTO' ? 'badge badge-apto' : 'badge badge-pendente';
            return `
              <tr>
                <td>
                  <div class="cell-primary">${escapePrintHtml(reg.matricula)}</div>
                  <div class="cell-secondary">Prot. ${escapePrintHtml(reg.protocolo)}</div>
                </td>
                <td>
                  <div class="cell-primary">${escapePrintHtml(reg.empreendimento || 'Não informado')}</div>
                  <div class="cell-secondary">${escapePrintHtml(labelModalidade(reg.modalidade))}</div>
                </td>
                <td>${escapePrintHtml(formatarDataBr(reg.dataRegistro))}</td>
                <td class="num">${escapePrintHtml(reg.qtdDerivadasLista)}</td>
                <td><span class="${badgeClass}">${situacaoLabel}</span></td>
              </tr>`;
          })
          .join('')
      : `
        <tr>
          <td colspan="5" class="empty-row">Nenhuma regularização encontrada para os filtros informados.</td>
        </tr>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Central REURB — Regularizações registradas (${escapePrintHtml(periodoLabel)})</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 12mm;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
        color: #0f172a;
        background: #ffffff;
        font-size: 11px;
        line-height: 1.4;
      }
      .header {
        border-bottom: 2px solid #0f172a;
        padding-bottom: 8px;
        margin-bottom: 12px;
      }
      .header-kicker {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #475569;
      }
      .header-title {
        margin: 2px 0 0;
        font-size: 16px;
        font-weight: 700;
        color: #0f172a;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        margin-bottom: 10px;
      }
      .meta-card {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 6px 8px;
        background: #f8fafc;
      }
      .meta-label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #475569;
      }
      .meta-value {
        margin-top: 2px;
        font-size: 12px;
        font-weight: 700;
        color: #0f172a;
      }
      .filters-box {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 7px 10px;
        margin-bottom: 12px;
        background: #ffffff;
      }
      .filters-title {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #475569;
        margin-bottom: 4px;
      }
      .filter-chip {
        display: inline-block;
        margin: 2px 4px 2px 0;
        padding: 2px 6px;
        border-radius: 4px;
        border: 1px solid #94a3b8;
        background: #f1f5f9;
        font-size: 10px;
        font-weight: 600;
        color: #0f172a;
      }
      .filter-empty {
        font-size: 10px;
        color: #475569;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      thead {
        display: table-header-group;
      }
      tfoot {
        display: table-footer-group;
      }
      tr {
        break-inside: avoid;
      }
      th {
        background: #f1f5f9;
        color: #0f172a;
        font-size: 9.5px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        text-align: left;
        padding: 7px 8px;
        border-top: 1px solid #94a3b8;
        border-bottom: 1px solid #94a3b8;
      }
      th.num,
      td.num {
        text-align: right;
      }
      td {
        padding: 6px 8px;
        border-bottom: 1px solid #e2e8f0;
        vertical-align: top;
      }
      .cell-primary {
        font-weight: 700;
        color: #0f172a;
      }
      .cell-secondary {
        font-size: 9.5px;
        color: #475569;
      }
      .badge {
        display: inline-block;
        padding: 2px 7px;
        border-radius: 999px;
        font-size: 9.5px;
        font-weight: 700;
        border: 1px solid transparent;
      }
      .badge-apto {
        color: #065f46;
        background: #ecfdf5;
        border-color: #6ee7b7;
      }
      .badge-pendente {
        color: #92400e;
        background: #fffbeb;
        border-color: #fcd34d;
      }
      tfoot td {
        border-top: 2px solid #0f172a;
        border-bottom: 1px solid #cbd5e1;
        background: #f8fafc;
        font-weight: 700;
        padding: 7px 8px;
      }
      .empty-row {
        text-align: center;
        padding: 18px 8px;
        color: #475569;
      }
    </style>
  </head>
  <body>
    <header class="header">
      <div class="header-kicker">7º Oficial de Registro de Imóveis de São Paulo · FIORIX</div>
      <h1 class="header-title">Central REURB — Regularizações registradas no período</h1>
    </header>

    <section class="meta-grid">
      <div class="meta-card">
        <div class="meta-label">Período</div>
        <div class="meta-value">${escapePrintHtml(periodoLabel)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Registros exibidos</div>
        <div class="meta-value">${escapePrintHtml(`${processos.length} de ${totalPeriodo}`)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Derivadas JSON / Situação</div>
        <div class="meta-value">${escapePrintHtml(`${totalDerivadas} (${totalAptas} apta(s) · ${totalPendentes} pend.)`)}</div>
      </div>
      <div class="meta-card">
        <div class="meta-label">Emitido em</div>
        <div class="meta-value">${escapePrintHtml(emissaoLabel)}</div>
      </div>
    </section>

    <section class="filters-box">
      <div class="filters-title">Filtros aplicados</div>
      <div>${filtrosResumoHtml}</div>
    </section>

    <table>
      <thead>
        <tr>
          <th>Matrícula / Protocolo</th>
          <th>Empreendimento</th>
          <th>Registro</th>
          <th class="num">Derivadas JSON</th>
          <th>Situação</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="3">Totais dos registros filtrados (${escapePrintHtml(processos.length)} processo(s))</td>
          <td class="num">${escapePrintHtml(totalDerivadas)}</td>
          <td>${escapePrintHtml(`${totalAptas} Apto / ${totalPendentes} Pendente`)}</td>
        </tr>
      </tfoot>
    </table>
  </body>
</html>`;
}
