import * as XLSX from 'xlsx';
import type {
  ReurbPainelDTO,
  ReurbRegularizacaoDTO,
  ReurbRelatorioDTO,
} from './types';

const FORMULA_INJECTION_RE = /^[=+\-@\t\r]/;

export function sanitizeSpreadsheetCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : '';
  }
  if (typeof value === 'boolean') {
    return value ? 'Sim' : 'Não';
  }
  const str = String(value);
  if (FORMULA_INJECTION_RE.test(str)) {
    return `'${str}`;
  }
  return str;
}

function sanitizeRow(row: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = sanitizeSpreadsheetCell(v);
  }
  return out;
}

export function gerarBufferExcelReurb(params: {
  relatorio: ReurbRelatorioDTO;
  painel: ReurbPainelDTO;
  processos: ReurbRegularizacaoDTO[];
}): Buffer {
  const { relatorio, painel, processos } = params;
  const wb = XLSX.utils.book_new();

  const sheetModalidadeRows = [
    ...relatorio.porModalidade.map((m) =>
      sanitizeRow({
        Modalidade: m.label,
        Registradas: m.registradas,
        'Derivadas Abertas': m.derivadasAbertas,
        'Aptas JSON': m.aptas,
        'Com Pendências': m.comPendencias,
      })
    ),
    sanitizeRow({
      Modalidade: 'TOTAL DO PERÍODO',
      Registradas: relatorio.totais.registradas,
      'Derivadas Abertas': relatorio.totais.derivadasAbertas,
      'Aptas JSON': relatorio.totais.aptas,
      'Com Pendências': relatorio.totais.comPendencias,
    }),
  ];
  const wsModalidade = XLSX.utils.json_to_sheet(sheetModalidadeRows);
  XLSX.utils.book_append_sheet(wb, wsModalidade, 'Resumo por Modalidade');

  const sheetEvolucaoRows = relatorio.evolucaoMensal.map((m) =>
    sanitizeRow({
      Ano: relatorio.ano,
      'Mês': `${String(m.mes).padStart(2, '0')} - ${m.mesLabel}`,
      'Regularizações Registradas': m.registradas,
      'Derivadas Abertas': m.derivadasAbertas,
      'Aptas à Exportação': m.aptas,
      'Com Pendências': m.comPendencias,
    })
  );
  const wsEvolucao = XLSX.utils.json_to_sheet(sheetEvolucaoRows);
  XLSX.utils.book_append_sheet(wb, wsEvolucao, 'Evolucao Mensal');

  const sheetPendenciasRows =
    processos.length > 0
      ? processos.map((p) => {
          const prio =
            p.pendencias.find((x) => x.severidade === 'BLOQUEIA') || p.pendencias[0] || null;
          return sanitizeRow({
            'Matrícula Matriz': p.matricula,
            Protocolo: p.protocolo,
            Prenotação: p.prenotacao,
            Empreendimento: p.empreendimento || 'Não informado',
            Modalidade: p.modalidade,
            'Data Registro': p.dataRegistro || '',
            'Data Prenotação': p.dataPrenotacao || '',
            'Qtd Unidades': p.quantidadeUnidades,
            'Derivadas no JSON': p.qtdDerivadasLista,
            'Áreas Públicas Excluídas': p.qtdAreasPublicasExcluidas,
            'Situação Validação': p.situacaoValidacao,
            'Status Importação ONR': p.statusImportacaoOnr,
            'Qtd Bloqueios': p.qtdBloqueios,
            'Pendência Principal': prio ? `${prio.campo}: ${prio.motivo}` : 'Sem pendências',
          });
        })
      : [
          sanitizeRow({
            Aviso: 'Nenhum processo localizado para os filtros informados.',
          }),
        ];
  const wsPendencias = XLSX.utils.json_to_sheet(sheetPendenciasRows);
  XLSX.utils.book_append_sheet(wb, wsPendencias, 'Processos e Pendencias');

  const derivsOutroMes = painel.derivadasPeriodoResumo.itens.filter((i) => i.deOutroMes);
  if (derivsOutroMes.length > 0) {
    const wsCrossMonth = XLSX.utils.json_to_sheet(
      derivsOutroMes.map((d) =>
        sanitizeRow({
          'Matrícula Derivada': d.matriculaDerivada,
          'Data Abertura Derivada': d.dataAbertura || '',
          'Matrícula Matriz': d.matriculaMatriz,
          Protocolo: d.protocolo,
          Empreendimento: d.empreendimento || '',
          'Data Registro Matriz': d.dataRegistroMatriz || '',
          Observação: 'Matriz registrada em outro mês; derivada aberta no período selecionado.',
        })
      )
    );
    XLSX.utils.book_append_sheet(wb, wsCrossMonth, 'Derivadas Outro Mes');
  }

  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  return out;
}
