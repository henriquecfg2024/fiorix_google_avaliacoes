import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  construirUrlIframePdf,
  obterRotuloSessaoAcervo,
} from '@/lib/documental/visualizadorHelpers';

const raizRepo = path.resolve(__dirname, '..');

function lerArquivoRepo(relPath: string): string {
  return fs.readFileSync(path.join(raizRepo, relPath), 'utf8');
}

describe('Ergonomia e Layout Full-Bleed do Visualizador de Documentos', () => {
  it('ajusta URLs blob:/https: para recolher miniaturas do PDF e ajustar à largura', () => {
    expect(construirUrlIframePdf('blob:https://fiorix.app/abc-123')).toBe(
      'blob:https://fiorix.app/abc-123#navpanes=0&view=FitH',
    );
    expect(construirUrlIframePdf('https://exemplo.local/processo.pdf')).toBe(
      'https://exemplo.local/processo.pdf#navpanes=0&view=FitH',
    );
    expect(construirUrlIframePdf('blob:https://fiorix.app/abc-123#page=3&navpanes=1')).toBe(
      'blob:https://fiorix.app/abc-123#navpanes=0&view=FitH',
    );
    const dataUrl = 'data:application/pdf;base64,JVBERi0xLjQ=';
    expect(construirUrlIframePdf(dataUrl)).toBe(dataUrl);
    expect(construirUrlIframePdf('')).toBe('');
  });

  it('resolve o rótulo da sessão do acervo para todas as raízes suportadas', () => {
    expect(obterRotuloSessaoAcervo('livro2')).toBe('LV2');
    expect(obterRotuloSessaoAcervo('titulos_visualiza')).toBe('TITULOS-VISUALIZA');
    expect(obterRotuloSessaoAcervo('titulos_online')).toBe('Titulos_Online');
    expect(obterRotuloSessaoAcervo('imagens', 'SETORES\\00001000\\00001001.KEN')).toBe('SETORES');
    expect(obterRotuloSessaoAcervo('imagens', '')).toBe('IMAGENS');
    expect(obterRotuloSessaoAcervo('vol1')).toBe('VOL1 (H:)');
    expect(obterRotuloSessaoAcervo('deptos')).toBe('DEP (W:)');
    expect(obterRotuloSessaoAcervo('processos')).toBe('Processos (H:)');
    expect(obterRotuloSessaoAcervo('minutas')).toBe('Usucapião (W:)');
    expect(obterRotuloSessaoAcervo('local')).toBe('Arquivo Local');
    expect(obterRotuloSessaoAcervo()).toBe('LOCAL');
  });

  it('garante página full-bleed sem moldura externa nem barra de topo separada', () => {
    const pageSrc = lerArquivoRepo('src/app/(dashboard)/gestao-documental/visualizador/page.tsx');
    expect(pageSrc).not.toContain('max-w-[1600px]');
    expect(pageSrc).not.toContain('<GestaoDocumentalAbas');
    expect(pageSrc).toContain('listarAbasGestaoDocumentalVisiveis');
    expect(pageSrc).toContain('abasNavegacao={abasNavegacao}');

    const layoutSrc = lerArquivoRepo('src/app/(dashboard)/layout.tsx');
    expect(layoutSrc).toContain('h-dvh w-screen overflow-hidden bg-[#070A12] flex flex-col');
  });

  it('unifica em barra única, reduz painel lateral para 260px e remove rodapé/barra PDF duplicada', () => {
    const src = lerArquivoRepo('src/components/documental/VisualizadorDedicado.tsx');

    expect(src).not.toContain('h-[calc(100dvh-76px)]');
    expect(src).not.toContain('2. BARRA DE FERRAMENTAS DEDICADA');
    expect(src).not.toContain('4. RODAPÉ TÉCNICO');

    expect(src).toContain('md:w-[260px]');
    expect(src).not.toContain('md:w-80');

    expect(src).toContain('src={construirUrlIframePdf(documentoAtivo.pdfDataUrl)}');
    expect(src).toContain('{isIOSOrIPadOS() && (');
    expect(src).toContain('max-h-[calc(100dvh-52px)]');
    expect(src).toContain('variant="dark"');
    expect(src).toContain('compact');
  });
});
