import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ReurbExportacaoDTO } from '@/lib/reurb/types';
import { formatarDataHoraBr, labelModalidade } from '@/components/reurb/reurb-ui-helpers';

/**
 * Gera o nome sanitizado do arquivo PDF do comprovante mantendo o padrão
 * `<nomeArquivoJson>.pdf` usado nas pastas mensais da serventia.
 */
export function buildNomeArquivoComprovantePdf(exp: ReurbExportacaoDTO): string {
  const raw = (exp.nomeArquivoJson || `reurb_exportacao_${exp.id}.json`).trim();
  const baseName = raw.split(/[\\/]/).pop() || `reurb_exportacao_${exp.id}.json`;
  const clean = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
}

/**
 * Gera em memória o PDF A4 do Comprovante de Geração de Arquivo JSON sem depender
 * de diálogo de impressão do navegador, permitindo salvamento direto em lote.
 */
export function gerarPdfComprovanteExportacaoReurb(
  exp: ReurbExportacaoDTO,
  opcoes?: { emitidoEm?: Date }
): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const contentWidth = pageWidth - marginX * 2;

  const tipoExportacaoLabel =
    exp.tipo === 'UNITARIA' ? 'Exportação Unitária' : 'Exportação em Lote';
  const nomeArquivo = exp.nomeArquivoJson?.trim() || '—';
  const operador = exp.geradoPorNome?.trim() || 'Operador';
  const dataGeracaoLabel = formatarDataHoraBr(exp.createdAt);
  const sha256Completo = exp.jsonSha256?.trim() || '—';
  const verificadorCurto =
    sha256Completo !== '—' ? sha256Completo.slice(0, 16).toUpperCase() : '—';
  const emissaoLabel = formatarDataHoraBr((opcoes?.emitidoEm ?? new Date()).toISOString());

  const itensIncluidos = (exp.itens || []).filter((it) => it.incluidaNoJson);
  const rotuloRegularizacoes = itensIncluidos.length === 1 ? 'regularização' : 'regularizações';
  const situacaoTotalLabel =
    itensIncluidos.length === 1 ? '100% apta · 0 pendências' : '100% aptas · 0 pendências';

  // Cabeçalho institucional
  let cursorY = 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('7º OFICIAL DE REGISTRO DE IMÓVEIS DE SÃO PAULO · CNS 12459-4', marginX, cursorY);

  cursorY += 6;
  doc.setFontSize(15);
  doc.setTextColor(2, 6, 23);
  doc.text('COMPROVANTE DE GERAÇÃO DE ARQUIVO JSON', marginX, cursorY);

  cursorY += 3.5;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);

  // Seção 1 — Identificação e Integridade do Arquivo JSON
  cursorY += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('1. IDENTIFICAÇÃO E INTEGRIDADE DO ARQUIVO JSON', marginX, cursorY);

  cursorY += 2.5;
  const shaLines = doc.splitTextToSize(sha256Completo, contentWidth - 8) as string[];
  const idBoxHeight = 31 + Math.max(1, shaLines.length) * 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, cursorY, contentWidth, idBoxHeight, 2, 2, 'FD');

  const colLeftX = marginX + 4;
  const colRightX = marginX + contentWidth * 0.56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('ARQUIVO JSON GERADO', colLeftX, cursorY + 5);
  doc.text('GERADO EM / RESPONSÁVEL', colRightX, cursorY + 5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(doc.splitTextToSize(nomeArquivo, contentWidth * 0.52)[0] || nomeArquivo, colLeftX, cursorY + 9.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text(
    doc.splitTextToSize(`${dataGeracaoLabel} · ${operador}`, contentWidth * 0.41)[0] ||
      `${dataGeracaoLabel} · ${operador}`,
    colRightX,
    cursorY + 9.5
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('IDENTIFICADOR DA EXPORTAÇÃO', colLeftX, cursorY + 15.5);
  doc.text('TIPO DE EXPORTAÇÃO', colRightX, cursorY + 15.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(exp.id, colLeftX, cursorY + 20);

  doc.setFont('helvetica', 'bold');
  doc.text(tipoExportacaoLabel, colRightX, cursorY + 20);

  doc.setDrawColor(226, 232, 240);
  doc.line(colLeftX, cursorY + 23.5, pageWidth - marginX - 4, cursorY + 23.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('ASSINATURA DE INTEGRIDADE (SHA-256)', colLeftX, cursorY + 27.5);

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(shaLines, colLeftX, cursorY + 32);

  cursorY += idBoxHeight + 7;

  // Seção 2 — Resumo da Exportação
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('2. RESUMO DA EXPORTAÇÃO', marginX, cursorY);

  cursorY += 2.5;
  const gap = 3.5;
  const cardW = (contentWidth - gap * 3) / 4;
  const cardH = 16;
  const kpis: Array<{ label: string; value: string; emerald?: boolean }> = [
    { label: 'PROCESSOS SOLICITADOS', value: String(exp.qtdSolicitadas) },
    { label: 'INCLUÍDOS NO ARQUIVO', value: String(exp.qtdAptasGeradas), emerald: true },
    { label: 'COM PENDÊNCIAS', value: '0', emerald: true },
    { label: 'MATRÍCULAS DERIVADAS', value: String(exp.qtdDerivadasIncluidas) },
  ];

  kpis.forEach((kpi, index) => {
    const x = marginX + index * (cardW + gap);
    if (kpi.emerald && index === 1) {
      doc.setFillColor(236, 253, 245);
      doc.setDrawColor(167, 243, 208);
    } else {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(203, 213, 225);
    }
    doc.roundedRect(x, cursorY, cardW, cardH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    if (kpi.emerald && index === 1) {
      doc.setTextColor(4, 120, 87);
    } else {
      doc.setTextColor(100, 116, 139);
    }
    doc.text(kpi.label, x + 3, cursorY + 5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    if (kpi.emerald) {
      doc.setTextColor(6, 95, 70);
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(kpi.value, x + 3, cursorY + 12.5);
  });

  cursorY += cardH + 7;

  // Seção 3 — Regularizações Incluídas no Arquivo
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('3. REGULARIZAÇÕES INCLUÍDAS NO ARQUIVO', marginX, cursorY);

  const tableRows =
    itensIncluidos.length > 0
      ? itensIncluidos.map((it) => {
          const protStr = String(it.protocolo ?? '').trim();
          const prenStr = it.prenotacao != null ? String(it.prenotacao).trim() : '';
          const protocoloCell =
            prenStr && prenStr !== protStr ? `Prot. ${protStr} · Pren. ${prenStr}` : `Prot. ${protStr}`;
          return [
            String(it.matricula),
            protocoloCell,
            it.empreendimento || 'Não informado',
            labelModalidade(it.modalidade),
            String(it.qtdDerivadasIncluidas),
            'Apta · Sem pendências',
          ];
        })
      : [['—', '—', 'Nenhuma regularização listada nos itens desta exportação.', '—', '0', '—']];

  autoTable(doc, {
    startY: cursorY + 2.5,
    margin: { left: marginX, right: marginX },
    head: [['Matrícula', 'Protocolo', 'Empreendimento', 'Modalidade', 'Derivadas', 'Situação']],
    body: tableRows,
    foot: [
      [
        {
          content: `Total incluído no arquivo (${itensIncluidos.length} ${rotuloRegularizacoes})`,
          colSpan: 4,
          styles: { halign: 'left', fontStyle: 'bold' },
        },
        {
          content: String(exp.qtdDerivadasIncluidas),
          styles: { halign: 'right', fontStyle: 'bold' },
        },
        {
          content: situacaoTotalLabel,
          styles: { halign: 'left', fontStyle: 'bold', textColor: [6, 95, 70] },
        },
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.2,
      textColor: [15, 23, 42],
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [51, 65, 85],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    footStyles: {
      fillColor: [248, 250, 252],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 28 },
      2: { cellWidth: 58 },
      3: { cellWidth: 22 },
      4: { cellWidth: 18, halign: 'right' },
      5: { cellWidth: 40, textColor: [6, 95, 70], fontStyle: 'bold' },
    },
  });

  const autoTableDoc = doc as unknown as { lastAutoTable?: { finalY: number } };
  cursorY = (autoTableDoc.lastAutoTable?.finalY ?? cursorY + 25) + 7;

  // Garantir que Seção 4 e rodapé caibam na página atual
  if (cursorY + 42 > pageHeight - 12) {
    doc.addPage();
    cursorY = 16;
  }

  // Seção 4 — Situação no Portal do Ofício Eletrônico
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text('4. SITUAÇÃO NO PORTAL DO OFÍCIO ELETRÔNICO', marginX, cursorY);

  cursorY += 2.5;
  if (exp.statusImportacaoOnr === 'CONFIRMADA_ONR') {
    const protocoloConfirmacao = exp.protocoloOnrExterno?.trim();
    const detalheConfirmacao = protocoloConfirmacao
      ? `Protocolo: ${protocoloConfirmacao} · Confirmado em ${formatarDataHoraBr(exp.confirmadoImportacaoEm)} por ${exp.confirmadoPorNome?.trim() || 'Operador'}`
      : `Confirmado em ${formatarDataHoraBr(exp.confirmadoImportacaoEm)} por ${exp.confirmadoPorNome?.trim() || 'Operador'}`;
    const detalheLines = doc.splitTextToSize(detalheConfirmacao, contentWidth - 8) as string[];
    const obsText = exp.observacaoConfirmacao?.trim()
      ? `Observação: ${exp.observacaoConfirmacao.trim()}`
      : '';
    const obsLines = obsText ? (doc.splitTextToSize(obsText, contentWidth - 8) as string[]) : [];
    const onrH = 12 + detalheLines.length * 4 + (obsLines.length > 0 ? obsLines.length * 4 + 2 : 0);

    doc.setFillColor(236, 254, 255);
    doc.setDrawColor(165, 243, 252);
    doc.roundedRect(marginX, cursorY, contentWidth, onrH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(14, 116, 144);
    doc.text('Importação confirmada manualmente no Portal do Ofício Eletrônico', marginX + 4, cursorY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
    doc.setTextColor(22, 78, 99);
    doc.text(detalheLines, marginX + 4, cursorY + 11);

    if (obsLines.length > 0) {
      doc.setTextColor(51, 65, 85);
      doc.text(obsLines, marginX + 4, cursorY + 11 + detalheLines.length * 4 + 1.5);
    }

    cursorY += onrH + 8;
  } else {
    const aviso =
      'JSON gerado e validado no FIORIX — deverá sempre ser realizada a importação manual do JSON no portal do OFÍCIO ELETRÔNICO.';
    const avisoLines = doc.splitTextToSize(aviso, contentWidth - 8) as string[];
    const onrH = 8 + avisoLines.length * 4.5;

    doc.setFillColor(255, 251, 235);
    doc.setDrawColor(252, 211, 77);
    doc.roundedRect(marginX, cursorY, contentWidth, onrH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(69, 26, 3);
    doc.text(avisoLines, marginX + 4, cursorY + 6);

    cursorY += onrH + 8;
  }

  // Rodapé institucional
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(marginX, cursorY, pageWidth - marginX, cursorY);

  cursorY += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Emitido pelo FIORIX (Central REURB) em ${emissaoLabel}.`, marginX, cursorY);
  doc.text(
    'Documento comprobatório de geração íntegra e sem pendências segundo o Manual do Ofício Eletrônico v1.4.',
    marginX,
    cursorY + 3.8
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('CÓDIGO VERIFICADOR', pageWidth - marginX, cursorY, { align: 'right' });

  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(verificadorCurto, pageWidth - marginX, cursorY + 4, { align: 'right' });

  return new Uint8Array(doc.output('arraybuffer'));
}
