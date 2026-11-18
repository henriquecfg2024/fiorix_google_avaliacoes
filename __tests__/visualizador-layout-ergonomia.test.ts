import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  calcularDestaquesOcrDocumento,
  casaTermoPesquisaLocal,
  construirUrlIframePdf,
  destacarTermoEmHtmlSanitizado,
  extrairAlvoDiretoMatriculaLv2,
  extrairTokensDestaquePesquisa,
  isAcessoExclusivoVisualizador,
  obterIniciaisUsuario,
  obterRotuloSessaoAcervo,
  ordenarResultadosPesquisaVisualizador,
} from '@/lib/documental/visualizadorHelpers';
import { isCachedSearchResultValid, SEARCH_CACHE_TTL_SECONDS } from '@/lib/documental/store';

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

    expect(src).toContain('src={construirUrlIframePdf(documentoAtivo.pdfDataUrl, destaqueVisivel ? termoDestaque : undefined)}');
    expect(src).toContain('{isIOSOrIPadOS() && (');
    expect(src).toContain('max-h-[calc(100dvh-88px)]');
    expect(src).toContain('variant="dark"');
    expect(src).toContain('compact');
  });

  it('identifica corretamente usuário com acesso exclusivo ao Visualizador no sistema', () => {
    expect(
      isAcessoExclusivoVisualizador({
        navPermissionsEnabled: true,
        userRole: 'COLABORADOR',
        allowedItemIds: ['visualizador_documental'],
      }),
    ).toBe(true);

    expect(
      isAcessoExclusivoVisualizador({
        navPermissionsEnabled: true,
        userRole: 'USER',
        allowedItemIds: ['visualizador_documental', 'validacao_autenticidade_documental'],
      }),
    ).toBe(true);

    expect(
      isAcessoExclusivoVisualizador({
        navPermissionsEnabled: true,
        userRole: 'COLABORADOR',
        allowedItemIds: ['visualizador_documental', 'minha_it'],
      }),
    ).toBe(false);

    expect(
      isAcessoExclusivoVisualizador({
        navPermissionsEnabled: true,
        userRole: 'ADMIN',
        allowedItemIds: ['visualizador_documental', 'gestao_documental'],
      }),
    ).toBe(false);

    expect(
      isAcessoExclusivoVisualizador({
        navPermissionsEnabled: true,
        userRole: 'MASTER',
        allowedItemIds: ['visualizador_documental'],
      }),
    ).toBe(false);

    expect(
      isAcessoExclusivoVisualizador({
        navPermissionsEnabled: false,
        userRole: 'COLABORADOR',
        allowedItemIds: ['visualizador_documental'],
      }),
    ).toBe(false);
  });

  it('formata iniciais do usuário para o menu compacto de conta', () => {
    expect(obterIniciaisUsuario('Henrique Gama')).toBe('HG');
    expect(obterIniciaisUsuario('Maria Oliveira Souza')).toBe('MS');
    expect(obterIniciaisUsuario('Escrevente')).toBe('ES');
    expect(obterIniciaisUsuario('   ')).toBe('U');
    expect(obterIniciaisUsuario(null)).toBe('U');
  });

  it('oculta botão Voltar e expõe menu Conta/Sair quando acessoExclusivoVisualizador está ativo', () => {
    const pageSrc = lerArquivoRepo('src/app/(dashboard)/gestao-documental/visualizador/page.tsx');
    expect(pageSrc).toContain('getAllowedNavItemsForUser');
    expect(pageSrc).toContain('acessoExclusivoVisualizador={acessoExclusivoVisualizador}');

    const src = lerArquivoRepo('src/components/documental/VisualizadorDedicado.tsx');
    expect(src).toContain('{!acessoExclusivoVisualizador && <BotaoVoltarTelaAnterior');
    expect(src).toContain('id="btn-menu-conta-visualizador"');
    expect(src).toContain('href="/minha-conta"');
    expect(src).toContain('handleSignOut');
  });

  it('evita falsos positivos de substring numérica na varredura local (casaTermoPesquisaLocal)', () => {
    expect(casaTermoPesquisaLocal('40000', 'LV2\\00040000\\00040000.KEN')).toBe(true);
    expect(casaTermoPesquisaLocal('40000', 'DEP\\PARECER\\Matr. 40.000 - Lote.docx')).toBe(true);
    expect(casaTermoPesquisaLocal('40.000', 'LV2\\00040000\\00040000.KEN')).toBe(true);

    expect(casaTermoPesquisaLocal('40000', 'VOL1\\SPH16040000271D3.pdf')).toBe(false);
    expect(casaTermoPesquisaLocal('40000', 'DEP\\540.000 - Desistencia.docx')).toBe(false);
    expect(casaTermoPesquisaLocal('40000', 'DEP\\400.003 - EXCLUIR.doc')).toBe(false);
    expect(casaTermoPesquisaLocal('649109', 'CERTIDAO\\matr. 229.534\\649109 - 200 - 201 - 202.doc')).toBe(true);
  });

  it('ordena resultados priorizando LV2 exata e títulos/documentos do nº pesquisado', () => {
    const ordenadosMat = ordenarResultadosPesquisaVisualizador('40000', [
      { rootId: 'deptos', relativePath: 'Parecer\\Matr 40.000.docx', name: 'Matr 40.000.docx' },
      { rootId: 'imagens', relativePath: 'LV3\\00040000\\00040000.KEN', name: '00040000.KEN' },
      { rootId: 'livro2', relativePath: '00040000\\00040000.KEN', name: '00040000.KEN' },
    ]);
    expect(ordenadosMat.map((f) => `${f.rootId}:${f.name}`)).toEqual([
      'livro2:00040000.KEN',
      'imagens:00040000.KEN',
      'deptos:Matr 40.000.docx',
    ]);

    const ordenadosProto = ordenarResultadosPesquisaVisualizador('649109', [
      { rootId: 'titulos_visualiza', relativePath: '00649000\\00649999.TIF', name: '00649999.TIF' },
      { rootId: 'livro2', relativePath: '00229000\\00229534.KEN', name: '00229534.KEN' },
      { rootId: 'deptos', relativePath: 'CERTIDAO\\649109 - 200 - 201 - 202.doc', name: '649109 - 200 - 201 - 202.doc' },
      { rootId: 'titulos_visualiza', relativePath: '00649000\\00649109.TIF', name: '00649109.TIF' },
    ]);
    expect(ordenadosProto.map((f) => f.name)).toEqual([
      '00649109.TIF',
      '649109 - 200 - 201 - 202.doc',
      '00229534.KEN',
      '00649999.TIF',
    ]);
  });

  it('calcula alvo direto de bloco no LV2 apenas para candidatas válidas de matrícula', () => {
    expect(extrairAlvoDiretoMatriculaLv2('40000')).toEqual({
      num: 40000,
      pad8: '00040000',
      bloco: '00040000',
      fileName: '00040000.KEN',
    });
    expect(extrairAlvoDiretoMatriculaLv2('Matrícula 229.534')?.fileName).toBe('00229534.KEN');
    expect(extrairAlvoDiretoMatriculaLv2('Protocolo 649109')).toBeNull();
    expect(extrairAlvoDiretoMatriculaLv2('00001')).toBeNull();
    expect(extrairAlvoDiretoMatriculaLv2('649109')).toBeNull();
    expect(extrairAlvoDiretoMatriculaLv2('1124837-38.2022.8.26.0100')).toBeNull();
  });

  it('evita reuso de cache vazio/obsoleto em buscas e envia forceFresh no Visualizador', () => {
    expect(SEARCH_CACHE_TTL_SECONDS).toBe(45);
    expect(isCachedSearchResultValid(null)).toBe(false);
    expect(isCachedSearchResultValid({ files: [] })).toBe(false);
    expect(isCachedSearchResultValid({ files: [{ name: '00040000.KEN' }] })).toBe(true);

    const visualizadorSrc = lerArquivoRepo('src/components/documental/VisualizadorDedicado.tsx');
    expect(visualizadorSrc).toContain("{ type: 'search', query: termoNormalizado, forceFresh: true }");

    const storeSrc = lerArquivoRepo('src/lib/documental/store.ts');
    expect(storeSrc).toContain("WHEN type = 'search' THEN NOW() + INTERVAL '2 minutes'");
  });

  it('calcula destaques OCR com fronteira numérica, múltiplas páginas e frase multi-palavra', () => {
    expect(extrairTokensDestaquePesquisa('Matrícula 40.000')).toEqual(['40.000']);
    expect(extrairTokensDestaquePesquisa('Protocolo nº 649109')).toEqual(['649109']);

    const ocrPorPagina = {
      1: [
        ['MATRÍCULA', 0.1, 0.1, 0.15, 0.02] as [string, number, number, number, number],
        ['40.000', 0.26, 0.1, 0.09, 0.02] as [string, number, number, number, number],
        ['540.000', 0.4, 0.2, 0.09, 0.02] as [string, number, number, number, number],
        ['4004', 0.5, 0.2, 0.06, 0.02] as [string, number, number, number, number],
        ['R.1/40.000', 0.12, 0.5, 0.14, 0.02] as [string, number, number, number, number],
      ],
      2: [
        ['FLÁVIO', 0.15, 0.3, 0.1, 0.02] as [string, number, number, number, number],
        ['TADEU', 0.26, 0.3, 0.09, 0.02] as [string, number, number, number, number],
        ['Registro', 0.1, 0.54, 0.1, 0.015] as [string, number, number, number, number],
        ['40000', 0.1019, 0.5481, 0.055, 0.0102] as [string, number, number, number, number],
      ],
    };

    const res40000 = calcularDestaquesOcrDocumento(ocrPorPagina, 'Matrícula 40000');
    expect(res40000.total).toBe(3);
    expect(res40000.paginasComOcorrencia).toEqual([
      { page: 1, count: 2 },
      { page: 2, count: 1 },
    ]);
    expect(res40000.ocorrencias.map((o) => o.text)).toEqual(['40.000', 'R.1/40.000', '40000']);

    const resFrase = calcularDestaquesOcrDocumento(ocrPorPagina, 'flavio tadeu');
    expect(resFrase.total).toBe(1);
    expect(resFrase.ocorrencias[0].page).toBe(2);
    expect(resFrase.ocorrencias[0].text).toBe('FLÁVIO TADEU');

    // Conector curto opcional ("de"/"do") e fallback de página com todos os termos significativos (busca FTS SiplanIA)
    const ocrEndereco = {
      3: [
        ['RUA', 0.1, 0.2, 0.05, 0.02] as [string, number, number, number, number],
        ['JERONIMO', 0.16, 0.2, 0.12, 0.02] as [string, number, number, number, number],
        ['DE', 0.29, 0.2, 0.04, 0.02] as [string, number, number, number, number],
        ['MENDONÇA', 0.34, 0.2, 0.14, 0.02] as [string, number, number, number, number],
        ['apartamento', 0.1, 0.4, 0.12, 0.02] as [string, number, number, number, number],
        ['75', 0.23, 0.4, 0.04, 0.02] as [string, number, number, number, number],
      ],
    };
    const resConector = calcularDestaquesOcrDocumento(ocrEndereco, 'jeronimo mendonca');
    expect(resConector.total).toBe(1);
    expect(resConector.ocorrencias[0].text).toBe('JERONIMO DE MENDONÇA');

    const resFtsPagina = calcularDestaquesOcrDocumento(ocrEndereco, 'JERONIMO DE MENDONCA 75');
    expect(resFtsPagina.total).toBe(3);
    expect(resFtsPagina.paginasComOcorrencia).toEqual([{ page: 3, count: 3 }]);
  });

  it('destaca termos em HTML sanitizado preservando tags e atributos e adiciona #search= no PDF', () => {
    const htmlSeguro = '<p class="item-40000" data-ref="40000">Imóvel da matrícula 40.000 e área 540.000 de Flávio Tadeu.</p>';
    const resNum = destacarTermoEmHtmlSanitizado(htmlSeguro, '40000');
    expect(resNum.total).toBe(1);
    expect(resNum.html).toContain('class="item-40000" data-ref="40000"');
    expect(resNum.html).toContain('<mark class="fiorix-doc-highlight');
    expect(resNum.html).toContain('>40.000</mark>');
    expect(resNum.html).toContain('540.000');

    const resNome = destacarTermoEmHtmlSanitizado(htmlSeguro, 'flavio tadeu');
    expect(resNome.total).toBe(1);
    expect(resNome.html).toContain('>Flávio Tadeu</mark>');

    expect(construirUrlIframePdf('blob:https://fiorix.app/xyz', 'Matrícula 40000')).toBe(
      'blob:https://fiorix.app/xyz#navpanes=0&view=FitH&search=40000',
    );
    expect(construirUrlIframePdf('blob:https://fiorix.app/xyz', '')).toBe(
      'blob:https://fiorix.app/xyz#navpanes=0&view=FitH',
    );
  });
});
