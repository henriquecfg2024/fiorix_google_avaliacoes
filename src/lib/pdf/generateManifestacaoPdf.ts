/**
 * PDF da Manifestação arquivada no FIORIX (gerado no navegador a partir do texto finalizado).
 * Reproduz a folha A4 da Etapa 2 e acrescenta, no rodapé, os dados de arquivamento
 * (data/hora, responsável, versão e SHA-256 do texto) para conferência.
 */
import { jsPDF } from 'jspdf';
import type { MinutaModelo, Segmento } from '@/components/documental/FichaOficialView';

export interface InfoArquivamento {
  id: string;
  versao: number;
  finalizadoEm: string | Date;
  finalizadoPorNome?: string | null;
  hashSha256: string;
}

const A4 = { largura: 210, altura: 297 };
const MARGEM = { esquerda: 25, direita: 20, topo: 20, rodape: 28 };
const LARGURA_UTIL = A4.largura - MARGEM.esquerda - MARGEM.direita;
const PT_PARA_MM = 0.3528;

/** As fontes padrão do PDF cobrem Latin-1 (acentos do português); troca apenas os símbolos fora dele. */
function pdfTexto(s: string): string {
  return (s || '')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\u2026/g, '...')
    .replace(/[^\t\n\r\x20-\x7E\u00A0-\u00FF]/g, '');
}

interface Peca { t: string; destaque: boolean; espacoAntes: boolean }

class EscritorPdf {
  y = MARGEM.topo;
  constructor(public doc: jsPDF) {}

  garantirEspaco(altura: number) {
    if (this.y + altura > A4.altura - MARGEM.rodape) {
      this.doc.addPage();
      this.y = MARGEM.topo;
    }
  }

  fonte(destaque: boolean, tamanho: number) {
    this.doc.setFont('times', destaque ? 'bold' : 'normal');
    this.doc.setFontSize(tamanho);
  }

  /** Parágrafo com trechos em negrito/sublinhado, justificado e com recuo na primeira linha. */
  paragrafo(
    segmentos: Segmento[],
    opcoes: { tamanho?: number; recuo?: number; justificar?: boolean; xInicial?: number; espacoDepois?: number; negritoTudo?: boolean } = {},
  ) {
    const tamanho = opcoes.tamanho ?? 11.5;
    const alturaLinha = tamanho * PT_PARA_MM * 1.55;
    const x0 = opcoes.xInicial ?? MARGEM.esquerda;
    const larguraTotal = A4.largura - MARGEM.direita - x0;
    const recuo = opcoes.recuo ?? 0;

    // Quebra em peças preservando se havia espaço antes (ex.: "NEGATIVAS" + "." ficam colados)
    const pecas: Peca[] = [];
    let espacoPendente = false;
    for (const seg of segmentos) {
      for (const token of pdfTexto(seg.t).match(/\s+|[^\s]+/g) || []) {
        if (/^\s+$/.test(token)) { espacoPendente = true; continue; }
        pecas.push({ t: token, destaque: !!seg.destaque || !!opcoes.negritoTudo, espacoAntes: espacoPendente && pecas.length > 0 });
        espacoPendente = false;
      }
    }
    // Palavras = peças coladas
    const palavras: Peca[][] = [];
    for (const p of pecas) {
      if (!p.espacoAntes && palavras.length) palavras[palavras.length - 1].push(p);
      else palavras.push([p]);
    }
    const larguraPeca = (p: Peca) => { this.fonte(p.destaque, tamanho); return this.doc.getTextWidth(p.t); };
    const larguraPalavra = (w: Peca[]) => w.reduce((s, p) => s + larguraPeca(p), 0);
    this.fonte(false, tamanho);
    const espaco = this.doc.getTextWidth(' ');

    // Monta as linhas
    const linhas: Peca[][][] = [];
    let atual: Peca[][] = [];
    let larguraAtual = 0;
    for (const palavra of palavras) {
      const disponivel = larguraTotal - (linhas.length === 0 ? recuo : 0);
      const w = larguraPalavra(palavra);
      const novo = atual.length ? larguraAtual + espaco + w : w;
      if (atual.length && novo > disponivel) {
        linhas.push(atual);
        atual = [palavra];
        larguraAtual = w;
      } else {
        atual.push(palavra);
        larguraAtual = novo;
      }
    }
    if (atual.length) linhas.push(atual);

    linhas.forEach((linha, i) => {
      this.garantirEspaco(alturaLinha);
      const inicio = x0 + (i === 0 ? recuo : 0);
      const disponivel = larguraTotal - (i === 0 ? recuo : 0);
      const somaPalavras = linha.reduce((s, w) => s + larguraPalavra(w), 0);
      const ultima = i === linhas.length - 1;
      const folga = opcoes.justificar && !ultima && linha.length > 1 ? (disponivel - somaPalavras) / (linha.length - 1) : espaco;
      let x = inicio;
      const base = this.y + alturaLinha * 0.75;
      linha.forEach((palavra, j) => {
        for (const p of palavra) {
          this.fonte(p.destaque, tamanho);
          this.doc.text(p.t, x, base);
          const w = this.doc.getTextWidth(p.t);
          if (p.destaque && !opcoes.negritoTudo && /[\p{L}\p{N}]/u.test(p.t)) {
            this.doc.setLineWidth(0.2);
            this.doc.line(x, base + 0.6, x + w, base + 0.6);
          }
          x += w;
        }
        if (j < linha.length - 1) x += folga;
      });
      this.y += alturaLinha;
    });
    this.y += opcoes.espacoDepois ?? 2.5;
  }

  centralizado(texto: string, tamanho: number, negrito = false, cor = 0) {
    this.fonte(negrito, tamanho);
    this.doc.setTextColor(cor);
    const altura = tamanho * PT_PARA_MM * 1.45;
    this.garantirEspaco(altura);
    this.doc.text(pdfTexto(texto), A4.largura / 2, this.y + altura * 0.75, { align: 'center' });
    this.doc.setTextColor(0);
    this.y += altura;
  }
}

function formatarDataHora(valor: string | Date): string {
  const d = typeof valor === 'string' ? new Date(valor) : valor;
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function gerarPdfManifestacao(minuta: MinutaModelo, info: InfoArquivamento): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setProperties({
    title: `Manifestação ${minuta.cabecalho.processoValor}`,
    subject: 'Manifestação de busca — 7º Oficial de Registro de Imóveis da Capital',
    creator: 'FIORIX — Gestão Documental',
  });
  const w = new EscritorPdf(doc);

  // Timbre
  w.centralizado(`${minuta.timbre.numero} - ${minuta.timbre.ordinal} ${minuta.timbre.linha1} ${minuta.timbre.linha3}`, 14, true);
  w.centralizado(minuta.timbre.endereco, 8, false, 70);
  w.y += 1.5;
  doc.setLineWidth(0.5);
  doc.line(MARGEM.esquerda, w.y, A4.largura - MARGEM.direita, w.y);
  w.y += 7;

  // Cabeçalho
  const cab = minuta.cabecalho;
  w.paragrafo([{ t: `${cab.processoRotulo} ${cab.processoValor}` }], { tamanho: 11, negritoTudo: true, espacoDepois: 0.5 });
  w.paragrafo([{ t: cab.vara }], { tamanho: 11, negritoTudo: true, espacoDepois: 0.5 });
  w.paragrafo([{ t: `${cab.interessadosRotulo} ${cab.interessadosValor}` }], { tamanho: 11, negritoTudo: true, espacoDepois: 0.5 });
  w.paragrafo([{ t: cab.natureza }], { tamanho: 11, negritoTudo: true, espacoDepois: 7 });

  w.paragrafo([{ t: minuta.saudacao }], { tamanho: 12.5, negritoTudo: true, espacoDepois: 5 });

  const RECUO = 15;
  for (const p of minuta.paragrafosAntes) w.paragrafo(p, { recuo: RECUO, justificar: true });
  w.paragrafo([{ t: minuta.introConfrontacoes }], { recuo: RECUO, justificar: true, espacoDepois: 1 });
  for (const c of minuta.confrontacoes) {
    w.paragrafo([{ t: `${c.rotulo} ${c.valor}${c.pontuacao}` }], { xInicial: MARGEM.esquerda + 20, espacoDepois: 0.5 });
  }
  w.y += 2.5;
  for (const p of minuta.paragrafosDepois) w.paragrafo(p, { recuo: RECUO, justificar: true });

  // Local/data e assinatura
  w.y += 4;
  w.garantirEspaco(40);
  w.fonte(false, 11.5);
  doc.text(pdfTexto(minuta.local), A4.largura - MARGEM.direita, w.y + 4, { align: 'right' });
  w.y += 22;
  w.centralizado('O Oficial,', 11.5);
  w.y += 12;
  doc.setLineWidth(0.3);
  doc.line(A4.largura / 2 - 35, w.y, A4.largura / 2 + 35, w.y);
  w.y += 2;
  w.centralizado(minuta.assinatura.nome, 11.5, true);
  w.centralizado(minuta.assinatura.cargo, 8.5, false, 70);

  // Rodapé de arquivamento em todas as páginas
  const total = doc.getNumberOfPages();
  const linha1 = pdfTexto(
    `Manifestação arquivada no FIORIX em ${formatarDataHora(info.finalizadoEm)}` +
    `${info.finalizadoPorNome ? ` por ${info.finalizadoPorNome}` : ''} - versão ${info.versao}`,
  );
  const linha2 = `SHA-256 do texto: ${info.hashSha256}`;
  for (let pagina = 1; pagina <= total; pagina++) {
    doc.setPage(pagina);
    const yRodape = A4.altura - 14;
    doc.setDrawColor(180);
    doc.setLineWidth(0.2);
    doc.line(MARGEM.esquerda, yRodape - 4, A4.largura - MARGEM.direita, yRodape - 4);
    doc.setDrawColor(0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(90);
    doc.text(linha1, MARGEM.esquerda, yRodape);
    doc.text(linha2, MARGEM.esquerda, yRodape + 3.5);
    doc.text(`Página ${pagina} de ${total}`, A4.largura - MARGEM.direita, yRodape, { align: 'right' });
    doc.setTextColor(0);
  }
  return doc;
}

/** Nome do arquivo: Manifestacao_<processo>_v<versao>.pdf */
export function nomeArquivoManifestacao(numeroProcesso: string | null | undefined, versao: number): string {
  const base = (numeroProcesso || 'sem-numero').replace(/[^\w.-]+/g, '_').slice(0, 60);
  return `Manifestacao_${base}_v${versao}.pdf`;
}

export function baixarPdfManifestacao(minuta: MinutaModelo, info: InfoArquivamento, numeroProcesso?: string | null) {
  gerarPdfManifestacao(minuta, info).save(nomeArquivoManifestacao(numeroProcesso, info.versao));
}

// Largura útil exportada para testes de layout
export const __LARGURA_UTIL_MM = LARGURA_UTIL;
