import { Duplex, PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { navigationGroups } from "../src/components/fiorix/navigation";
import {
  criarAnotacaoOuTarefaCartorioVirtual,
  criarLoteImpressaoPedidos,
  definirConferenciaEscreventePedido,
  excluirAnotacaoCartorioVirtual,
  listarAnotacoesCartorioVirtual,
  listarPedidosCartorioVirtual,
  obterDetalhePedidoCartorioVirtual,
  obterPdfBytesLoteImpressao,
  salvarMarcacoesDocumentoPedido,
} from "../src/lib/cartorio-virtual/repository";
import {
  ALTURA_PAGINA_SIPLAN_PT,
  LARGURA_PAGINA_SIPLAN_PT,
  TAMANHO_FONTE_CORPO_FIXO_PT,
  gerarPdfLotePedidosSiplan,
  gerarPdfPedidoIndividualSiplan,
  sanitizarTextoWinAnsi,
} from "../src/lib/cartorio-virtual/siplan-order-pdf";
import {
  interpretarSelecaoPedidosLote,
  PILOTO_GUARDA_OPERACIONAL,
} from "../src/lib/cartorio-virtual/types";

describe("Cartório Virtual — Espelho Fiel PDF SIPLAN (595 x 842 pt), Multi-Item e Duplex", () => {
  it("gera pedido individual com geometria exata 595 x 842 pt (Página 1 Recibo + Página 2 Ficha Interna)", async () => {
    const { pedidos } = await listarPedidosCartorioVirtual("tenant-pdf-7ri");
    const pedidoSimples = pedidos.find((p) => p.numeroPedido === "9901001")!;

    const gerado = await gerarPdfPedidoIndividualSiplan(pedidoSimples);
    expect(gerado.numeroPaginas).toBe(2);
    expect(gerado.usouContinuacaoItens).toBe(false);
    expect(gerado.tamanhoFonteCorpoPt).toBe(TAMANHO_FONTE_CORPO_FIXO_PT);
    expect(gerado.sha256).toHaveLength(64);

    const doc = await PDFDocument.load(gerado.pdfBytes);
    expect(doc.getPageCount()).toBe(2);
    for (const page of doc.getPages()) {
      expect(page.getWidth()).toBe(LARGURA_PAGINA_SIPLAN_PT);
      expect(page.getHeight()).toBe(ALTURA_PAGINA_SIPLAN_PT);
    }
  });

  it("pagina automaticamente pedido corporativo com 12 matrículas e nomes extensos acentuados SEM reduzir a fonte", async () => {
    const { pedidos } = await listarPedidosCartorioVirtual("tenant-pdf-multi-7ri");
    const pedido12Itens = pedidos.find((p) => p.numeroPedido === "9901008")!;
    expect(pedido12Itens.itens).toHaveLength(12);

    const gerado = await gerarPdfPedidoIndividualSiplan(pedido12Itens);
    expect(gerado.usouContinuacaoItens).toBe(true);
    expect(gerado.numeroPaginas).toBeGreaterThanOrEqual(3);
    expect(gerado.tamanhoFonteCorpoPt).toBe(9);

    const doc = await PDFDocument.load(gerado.pdfBytes);
    expect(doc.getPageCount()).toBe(gerado.numeroPaginas);
    for (const page of doc.getPages()) {
      expect(page.getWidth()).toBe(595);
      expect(page.getHeight()).toBe(842);
    }
  });

  it("insere página em branco no verso em modo Duplex quando um pedido possui número ímpar de páginas", async () => {
    const { pedidos } = await listarPedidosCartorioVirtual("tenant-pdf-duplex-7ri");
    const pedidoImpar = pedidos.find((p) => p.numeroPedido === "9901008")!; // 3 páginas (ímpar!)
    const pedidoSeguinte = pedidos.find((p) => p.numeroPedido === "9901001")!; // 2 páginas

    const individualImpar = await gerarPdfPedidoIndividualSiplan(pedidoImpar);
    expect(individualImpar.numeroPaginas % 2).toBe(1);

    const loteDuplex = await gerarPdfLotePedidosSiplan({
      pedidos: [{ pedido: pedidoImpar }, { pedido: pedidoSeguinte }],
      duplexFrenteNovaFolha: true,
      modoDados: "ORIGINAL_CONGELADO",
    });

    expect(loteDuplex.paginasBrancoDuplex).toBe(1);
    expect(loteDuplex.mapaPaginasPorPedido[0].inseriuPaginaBrancoDuplex).toBe(true);
    // O segundo pedido deve obrigatoriamente iniciar em página física ímpar (frente de nova folha!)
    expect(loteDuplex.mapaPaginasPorPedido[1].paginaInicialNoLote % 2).toBe(1);

    const docLote = await PDFDocument.load(loteDuplex.pdfBytes);
    expect(docLote.getPageCount()).toBe(
      individualImpar.numeroPaginas + 1 + 2
    );
  });

  it("exige justificativa auditável para reimpressão e preserva o snapshot original congelado do lote", async () => {
    const tenant = "tenant-lote-reimpressao-7ri";
    const { pedidos } = await listarPedidosCartorioVirtual(tenant);

    const loteOriginal = await criarLoteImpressaoPedidos({
      tenantId: tenant,
      modoSelecao: "INDIVIDUAL",
      pedidosIds: [pedidos[0].id],
      duplexFrenteNovaFolha: true,
      modoDadosImpressao: "ORIGINAL_CONGELADO",
      operadorId: "op-1",
      operadorNome: "Operador Impressão",
      papelRegistral: "AUXILIAR",
    });
    expect(loteOriginal.totalPedidos).toBe(1);

    // Reimpressão sem motivo deve falhar
    await expect(
      criarLoteImpressaoPedidos({
        tenantId: tenant,
        modoSelecao: "INDIVIDUAL",
        pedidosIds: [pedidos[0].id],
        duplexFrenteNovaFolha: true,
        modoDadosImpressao: "ORIGINAL_CONGELADO",
        loteOrigemReimpressaoId: loteOriginal.id,
        motivoReimpressao: "   ",
        operadorId: "op-1",
        operadorNome: "Operador Impressão",
        papelRegistral: "AUXILIAR",
      })
    ).rejects.toThrow(/exige justificativa auditável/);

    const reimpressaoOk = await criarLoteImpressaoPedidos({
      tenantId: tenant,
      modoSelecao: "INDIVIDUAL",
      pedidosIds: [pedidos[0].id],
      duplexFrenteNovaFolha: true,
      modoDadosImpressao: "ORIGINAL_CONGELADO",
      loteOrigemReimpressaoId: loteOriginal.id,
      motivoReimpressao: "Atolamento de papel na bandeja 1 da impressora departamental.",
      operadorId: "op-1",
      operadorNome: "Operador Impressão",
      papelRegistral: "AUXILIAR",
    });
    expect(reimpressaoOk.loteOrigemReimpressaoId).toBe(loteOriginal.id);

    const download = await obterPdfBytesLoteImpressao({
      tenantId: tenant,
      loteId: reimpressaoOk.id,
      operadorId: "op-1",
      operadorNome: "Operador Impressão",
    });
    expect(download.pdfBytes.byteLength).toBeGreaterThan(1000);
  });

  it("filtra pedidos por Tipo de Pedido / Certidão e por Número do Pedido e gera lote filtrado", async () => {
    const tenant = "tenant-filtro-tipo-pedido-7ri";

    const inteiroTeorTodos = await listarPedidosCartorioVirtual(tenant, {
      tipoCertidao: "INTEIRO_TEOR_MATRICULA",
    });
    expect(inteiroTeorTodos.pedidos).toHaveLength(5);

    const inteiroTeorIndividual = await listarPedidosCartorioVirtual(tenant, {
      tipoCertidao: "INTEIRO_TEOR_INDIVIDUAL",
    });
    expect(inteiroTeorIndividual.pedidos).toHaveLength(4);

    const inteiroTeorMulti = await listarPedidosCartorioVirtual(tenant, {
      tipoCertidao: "INTEIRO_TEOR_MULTI_ITEM",
    });
    expect(inteiroTeorMulti.pedidos).toHaveLength(1);
    expect(inteiroTeorMulti.pedidos[0].numeroPedido).toBe("9901008");

    // "Certidão Digital" genérica NUNCA entra em INTEIRO_TEOR_MATRICULA
    const certidaoDigital = await listarPedidosCartorioVirtual(tenant, {
      tipoCertidao: "CERTIDAO_DIGITAL_GENERICA",
    });
    expect(certidaoDigital.pedidos).toHaveLength(1);
    expect(certidaoDigital.pedidos[0].numeroPedido).toBe("9901005");

    const buscaEndereco = await listarPedidosCartorioVirtual(tenant, {
      tipoCertidao: "BUSCA_ENDERECO",
    });
    expect(buscaEndereco.pedidos).toHaveLength(1);
    expect(buscaEndereco.pedidos[0].numeroPedido).toBe("9901006");

    const porNumero = await listarPedidosCartorioVirtual(tenant, {
      busca: "9901007",
      tipoCertidao: "TRANSCRICAO_LOTEAMENTO",
    });
    expect(porNumero.pedidos).toHaveLength(1);
    expect(porNumero.pedidos[0].numeroPedido).toBe("9901007");

    const loteFiltrado = await criarLoteImpressaoPedidos({
      tenantId: tenant,
      modoSelecao: "FILTRADOS",
      filtros: { tipoCertidao: "BUSCA_ENDERECO" },
      duplexFrenteNovaFolha: true,
      modoDadosImpressao: "ATUAL_RECONSTRUIDO",
      operadorId: "esc-1",
      operadorNome: "Escrevente 7º RI",
      papelRegistral: "ESCREVENTE_AUTORIZADO",
    });
    expect(loteFiltrado.totalPedidos).toBe(1);
    expect(loteFiltrado.numerosPedidos).toEqual(["9901006"]);
  });

  it("salva anotações do Escrevente no Pedido por tempo indeterminado, incorpora na Ficha de Impressão e veda emissão/cobrança", async () => {
    expect(PILOTO_GUARDA_OPERACIONAL.emissaoCertidaoNoFiorixPermitida).toBe(false);
    expect(PILOTO_GUARDA_OPERACIONAL.cobrancaNoFiorixPermitida).toBe(false);

    const tenant = "tenant-anotacao-pre-impressao-7ri";
    const { pedidos } = await listarPedidosCartorioVirtual(tenant, { busca: "9901001" });
    const pedido = pedidos[0];

    const pdfSemAnot = await gerarPdfPedidoIndividualSiplan(pedido);

    await criarAnotacaoOuTarefaCartorioVirtual({
      tenantId: tenant,
      pedidoId: pedido.id,
      numeroMatricula: 104501,
      tipoRegistro: "ANOTACAO",
      categoria: "PRE_IMPRESSAO",
      prioridade: "ALTA",
      titulo: "Anotação Pré-Impressão — Pedido #9901001",
      conteudo: "Conferida matrícula 104.501 antes da impressão: verificar averbação de construção.",
      autorId: "esc-henrique",
      autorNome: "Escrevente Autorizado",
      autorPapel: "ESCREVENTE_AUTORIZADO",
    });

    const detalhe = await obterDetalhePedidoCartorioVirtual(tenant, pedido.numeroPedido);
    expect(detalhe.anotacoes.length).toBeGreaterThanOrEqual(1);
    expect(detalhe.anotacoes[0].conteudoAtual).toContain("104.501");

    const todasAnot = await listarAnotacoesCartorioVirtual(tenant);
    expect(todasAnot.some((a) => a.numeroPedido === "9901001")).toBe(true);

    const pdfComAnot = await gerarPdfPedidoIndividualSiplan(pedido, {
      anotacoesSalvas: detalhe.anotacoes,
    });
    expect(pdfComAnot.numeroPaginas).toBe(2);
    // O hash muda porque a Ficha Operacional (Página 2) agora carimba a anotação salva do Escrevente
    expect(pdfComAnot.sha256).not.toBe(pdfSemAnot.sha256);

    // Bloqueia tentativa de exclusão cruzada por outra serventia (isolamento multi-tenant)
    const idAnotCriada = detalhe.anotacoes[0].id;
    await expect(
      excluirAnotacaoCartorioVirtual({
        tenantId: "tenant-outra-serventia-5ri",
        anotacaoId: idAnotCriada,
        operadorId: "op-externo",
        operadorNome: "Operador Externo",
        papelRegistral: "AUXILIAR",
      })
    ).rejects.toThrow(/não encontrada nesta serventia/);

    // Exclui a anotação do Escrevente na própria serventia e remove da Ficha de Impressão
    const excluida = await excluirAnotacaoCartorioVirtual({
      tenantId: tenant,
      anotacaoId: idAnotCriada,
      operadorId: "esc-henrique",
      operadorNome: "Escrevente Autorizado",
      papelRegistral: "ESCREVENTE_AUTORIZADO",
    });
    expect(excluida.idExcluido).toBe(idAnotCriada);

    const detalheAposExclusao = await obterDetalhePedidoCartorioVirtual(
      tenant,
      pedido.numeroPedido
    );
    expect(detalheAposExclusao.anotacoes.some((a) => a.id === idAnotCriada)).toBe(false);
  });

  it("interpreta seleção de Pedidos de tanto a tanto e separados por ponto e vírgula (;) e imprime lote na ordem selecionada", async () => {
    const tenant = "tenant-selecao-faixa-pontovirgula-7ri";
    const { pedidos } = await listarPedidosCartorioVirtual(tenant);

    // 1) Seleção "De tanto a tanto" (9901001 até 9901004)
    const porFaixa = interpretarSelecaoPedidosLote({
      pedidosDisponiveis: pedidos,
      faixaInicio: "9901001",
      faixaFim: "9901004",
    });
    expect(porFaixa.numerosEncontrados).toEqual([
      "9901001",
      "9901002",
      "9901003",
      "9901004",
    ]);
    expect(porFaixa.naoLocalizados).toEqual([]);

    // 2) Seleção por ponto e vírgula (;) preservando sequência e sinalizando nº inexistente
    const porPontoEVirgula = interpretarSelecaoPedidosLote({
      pedidosDisponiveis: pedidos,
      listaPontoEVirgula: "9901006; 9901001; 9901003; 9901999",
    });
    expect(porPontoEVirgula.numerosEncontrados).toEqual([
      "9901006",
      "9901001",
      "9901003",
    ]);
    expect(porPontoEVirgula.naoLocalizados).toEqual(["9901999"]);

    // 3) Geração do lote dos pedidos recém-pesquisados preservando a ordem digitada
    const loteSelecionado = await criarLoteImpressaoPedidos({
      tenantId: tenant,
      modoSelecao: "SELECIONADOS",
      pedidosIds: porPontoEVirgula.idsEncontrados,
      duplexFrenteNovaFolha: true,
      modoDadosImpressao: "ATUAL_RECONSTRUIDO",
      criterioOrdenacao: "ORDEM_DIGITADA",
      operadorId: "esc-1",
      operadorNome: "Escrevente 7º RI",
      papelRegistral: "ESCREVENTE_AUTORIZADO",
    });
    expect(loteSelecionado.totalPedidos).toBe(3);
    expect(loteSelecionado.numerosPedidos).toEqual(["9901006", "9901001", "9901003"]);
  });

  it("configura Frente e Verso (DuplexFlipLongEdge) por padrão, converte emoticons e aplica selo verde CONFERIDO / Estornar CONFERIDO e grifos coloridos no PDF", async () => {
    const tenant = "tenant-conferido-grifos-duplex-7ri";
    const { pedidos } = await listarPedidosCartorioVirtual(tenant);
    const alvo = pedidos[0];

    // 1) Verifica conversão de emoticons para texto WinAnsi seguro
    const convertido = sanitizarTextoWinAnsi("✅ Matrícula conferida ⚠️ atenção 😊");
    expect(convertido).toContain("[OK]");
    expect(convertido).toContain("[ATENÇÃO]");
    expect(convertido).toContain(":)");

    // 2) PDF padrão já sai configurado como Frente e Verso (DuplexFlipLongEdge)
    const pdfInicial = await gerarPdfPedidoIndividualSiplan(alvo);
    const docInicial = await PDFDocument.load(pdfInicial.pdfBytes);
    expect(docInicial.catalog.getOrCreateViewerPreferences().getDuplex()).toBe(
      Duplex.DuplexFlipLongEdge
    );

    // 3) Marcar como CONFERIDO aplica selo verde e filtra CONFERIDO / NÃO CONFERIDO
    const conferido = await definirConferenciaEscreventePedido({
      tenantId: tenant,
      pedidoId: alvo.id,
      conferido: true,
      operadorId: "esc-henrique",
      operadorNome: "Henrique Gama",
      papelRegistral: "ESCREVENTE_AUTORIZADO",
    });
    expect(conferido.conferidoPeloEscrevente).toBe(true);

    const apenasConferidos = await listarPedidosCartorioVirtual(tenant, {
      statusConferencia: "CONFERIDO",
    });
    expect(apenasConferidos.pedidos.map((p) => p.id)).toEqual([alvo.id]);

    const apenasNaoConferidos = await listarPedidosCartorioVirtual(tenant, {
      statusConferencia: "NAO_CONFERIDO",
    });
    expect(apenasNaoConferidos.pedidos.some((p) => p.id === alvo.id)).toBe(false);

    const pdfComSelo = await gerarPdfPedidoIndividualSiplan(conferido);
    expect(pdfComSelo.sha256).not.toBe(pdfInicial.sha256);

    // 4) Gravar grifos em diversas cores e texto posicionado (com emoticons) diretamente no documento
    const comMarcacoes = await salvarMarcacoesDocumentoPedido({
      tenantId: tenant,
      pedidoId: alvo.id,
      marcacoes: [
        {
          id: "grifo-1",
          pagina: 1,
          tipo: "GRIFO",
          xPt: 40,
          yTopoPt: 220,
          larguraPt: 210,
          alturaPt: 16,
          corGrifo: "AMARELO",
          autorNome: "Henrique Gama",
          criadoEmBr: "07/11/2026 14:50",
        },
        {
          id: "grifo-2",
          pagina: 1,
          tipo: "GRIFO",
          xPt: 40,
          yTopoPt: 250,
          larguraPt: 180,
          alturaPt: 16,
          corGrifo: "VERDE",
          autorNome: "Henrique Gama",
          criadoEmBr: "07/11/2026 14:51",
        },
        {
          id: "txt-1",
          pagina: 1,
          tipo: "TEXTO",
          xPt: 280,
          yTopoPt: 220,
          larguraPt: 180,
          alturaPt: 22,
          corGrifo: "ROSA",
          texto: "✅ Conferir averbação Av.14 antes de expedir ⚠️",
          corTexto: "VERMELHO",
          tamanhoFontePt: 10,
          autorNome: "Henrique Gama",
          criadoEmBr: "07/11/2026 14:52",
        },
      ],
      operadorId: "esc-henrique",
      operadorNome: "Henrique Gama",
      papelRegistral: "ESCREVENTE_AUTORIZADO",
    });
    expect(comMarcacoes.marcacoesDocumento).toHaveLength(3);

    const pdfComMarcacoes = await gerarPdfPedidoIndividualSiplan(comMarcacoes);
    expect(pdfComMarcacoes.sha256).not.toBe(pdfComSelo.sha256);

    // 5) Estornar CONFERIDO volta para NÃO CONFERIDO
    const estornado = await definirConferenciaEscreventePedido({
      tenantId: tenant,
      pedidoId: alvo.id,
      conferido: false,
      operadorId: "esc-henrique",
      operadorNome: "Henrique Gama",
      papelRegistral: "ESCREVENTE_AUTORIZADO",
    });
    expect(estornado.conferidoPeloEscrevente).toBe(false);
  });

  it("mantém o menu do Cartório Virtual enxuto e ordenado (Visão Geral -> Central de Impressão -> Histórico de Operações, sem Certidões)", () => {
    expect(navigationGroups.cartorioVirtual.items.map((i) => i.href)).toEqual([
      "/cartorio-virtual",
      "/cartorio-virtual/impressao",
      "/cartorio-virtual/historico",
    ]);
  });
});

