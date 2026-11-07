import { describe, expect, it } from "vitest";
import {
  DICIONARIO_MARCADORES_SIPLAN,
  classificarDocumentoCpfCnpj,
  classificarSubtipoElegibilidadePiloto,
  construirParticipanteSeguro,
  normalizarDataSentinelaSql,
  normalizarNumeroMatriculaSql,
  normalizarProtocoloExternoSql,
  verificarExigenciaMotivacao,
} from "../src/lib/cartorio-virtual/mapping-dictionary";
import {
  avaliarComparacaoPiloto,
  detectarMudancaMaterialPedido,
  executarRegrasConferenciaPedido,
  gerarHashVersaoDadosFonte,
  renderizarTextoCertificacaoPrenotacoes,
} from "../src/lib/cartorio-virtual/rules-engine";
import {
  concluirAtualizacaoMatriculaEReconferir,
  listarPedidosCartorioVirtual,
} from "../src/lib/cartorio-virtual/repository";
import { validarTransicaoEstadoPedido } from "../src/lib/cartorio-virtual/types";

describe("Cartório Virtual — Saneamento SQL, Regras de Conferência e Contraditório", () => {
  it("mapeia todos os 19 marcadores oficiais do RTF SIPLAN e saneia sentinelas do SQL Server 2012", () => {
    expect(DICIONARIO_MARCADORES_SIPLAN).toHaveLength(19);

    // Num_Livro: 0 e 99999999 são sentinelas do WEBRI, nunca matrículas reais
    expect(normalizarNumeroMatriculaSql(0)).toEqual({
      matriculaValida: null,
      sentinelaDetectada: "ZERO",
    });
    expect(normalizarNumeroMatriculaSql(99999999)).toEqual({
      matriculaValida: null,
      sentinelaDetectada: "NOVES_99999999",
    });
    expect(normalizarNumeroMatriculaSql(240278)).toEqual({
      matriculaValida: 240278,
      sentinelaDetectada: null,
    });

    // Datas: 1900-01-01 é sentinela nula, mas 1997-01-02 (histórica real) é preservada
    expect(normalizarDataSentinelaSql("1900-01-01T00:00:00.000Z")).toBeNull();
    const historica = normalizarDataSentinelaSql("1997-01-02T00:00:00.000Z");
    expect(historica).not.toBeNull();
    expect(historica?.toISOString().slice(0, 10)).toBe("1997-01-02");

    // ProtocoloEntidade: '0' vira null, protocolo real ONR é preservado
    expect(normalizarProtocoloExternoSql("0")).toBeNull();
    expect(normalizarProtocoloExternoSql("YM023820780")).toBe("YM023820780");
  });

  it("separa Solicitante, Apresentante e Destinatário RPS com suporte nativo a CPF e CNPJ e regra CNJ 134/2022", () => {
    const cpfClass = classificarDocumentoCpfCnpj("52998224725");
    expect(cpfClass.tipo).toBe("CPF");
    expect(cpfClass.formatado).toBe("529.982.247-25");
    expect(cpfClass.mascarado).toBe("***.982.247-**");

    const cnpjClass = classificarDocumentoCpfCnpj("11222333000181");
    expect(cnpjClass.tipo).toBe("CNPJ");
    expect(cnpjClass.formatado).toBe("11.222.333/0001-81");
    expect(cnpjClass.mascarado).toBe("**.222.333/0001-**");

    const solicitante = construirParticipanteSeguro({
      nome: "Solicitante Fictício PF",
      documento: "52998224725",
    });
    const destinatarioNota = construirParticipanteSeguro({
      nome: "Empresa Tomadora RPS S/A",
      documento: "11222333000181",
    });
    expect(solicitante.nome).not.toBe(destinatarioNota.nome);
    expect(solicitante.tipoDocumento).toBe("CPF");
    expect(destinatarioNota.tipoDocumento).toBe("CNPJ");

    // Motivação não é exigida universalmente para certidão de inteiro teor por matrícula
    expect(
      verificarExigenciaMotivacao({
        subtipoConfirmado: "INTEIRO_TEOR_MATRICULA",
        regraExigeMotivacaoExplicita: false,
      })
    ).toBe(false);
    expect(
      verificarExigenciaMotivacao({
        subtipoConfirmado: "OUTRA_ESPECIE",
        regraExigeMotivacaoExplicita: true,
      })
    ).toBe(true);
  });

  it("não presume que 'Certidão Digital' seja Inteiro Teor e encaminha endereço, transcrição e loteamento à análise humana", () => {
    const generica = classificarSubtipoElegibilidadePiloto({
      especieDescricao: "Certidão Digital",
      livroCodigo: 2,
      numeroMatriculaRaw: 104501,
    });
    expect(generica.elegivelPiloto).toBe(false);
    expect(generica.subtipoConfirmado).toBe("NAO_CONFIRMADO");

    const porEndereco = classificarSubtipoElegibilidadePiloto({
      especieDescricao: "Busca por Endereço",
      livroCodigo: 0,
      numeroMatriculaRaw: 0,
      enderecoPesquisa: "Rua Fictícia, 100",
    });
    expect(porEndereco.elegivelPiloto).toBe(false);
    expect(porEndereco.criterioSolicitacao).toBe("ENDERECO");

    const porTranscricao = classificarSubtipoElegibilidadePiloto({
      especieDescricao: "Certidão de Transcrição",
      livroCodigo: 99999999,
      numeroMatriculaRaw: 99999999,
      transcricaoOuLoteamento: "Transcrição nº 15.000",
    });
    expect(porTranscricao.elegivelPiloto).toBe(false);
    expect(porTranscricao.criterioSolicitacao).toBe("TRANSCRICAO");

    const inteiroTeorConfirmado = classificarSubtipoElegibilidadePiloto({
      especieDescricao: "Certidão de Inteiro Teor da Matrícula",
      livroCodigo: 2,
      numeroMatriculaRaw: 104501,
    });
    expect(inteiroTeorConfirmado.elegivelPiloto).toBe(true);
    expect(inteiroTeorConfirmado.subtipoConfirmado).toBe("INTEIRO_TEOR_MATRICULA");
  });

  it("aplica Regra 6.2 (prenotação em tramitação gera certificação textual + revisão) e Regra 6.3 (ato em processamento pausa o pedido)", () => {
    const acervoIntegro = {
      numeroMatricula: 118920,
      vinculadaServentia: true,
      possuiRegistroEstruturado: true,
      possuiArquivoDigitalizado: true,
      formatoArquivo: "PDF" as const,
      integraEAtualizada: true,
    };

    // Regra 6.2: Prenotação em tramitação regular
    const r62 = executarRegrasConferenciaPedido({
      elegivelPiloto: true,
      criterioSolicitacao: "MATRICULA",
      numeroMatricula: 118920,
      acervo: acervoIntegro,
      contraditorioDisponivel: true,
      prenotacoes: [
        {
          numeroPrenotacao: "784.120",
          dataApresentacaoIso: "2026-11-03T10:00:00Z",
          dataApresentacaoBr: "03/11/2026",
          naturezaTitulo: "Compra e Venda",
          emProcessamentoAtoNaMatricula: false,
          etapaAtual: "Em qualificação",
        },
      ],
    });
    expect(r62.contraditorioStatus).toBe("PRENOTACAO_EM_TRAMITACAO");
    expect(r62.decisaoProposta).toBe("APTO_COM_CERTIFICACAO_PRENOTACAO");
    expect(r62.estadoSugerido).toBe("EM_REVISAO_HUMANA");
    expect(r62.textoCertidaoSugerido).toContain("784.120");
    expect(renderizarTextoCertificacaoPrenotacoes(r62.pendenciasGeradas as any)).toBeDefined();

    // Regra 6.3: Ato registral em processamento pausa obrigatoriamente a emissão
    const r63 = executarRegrasConferenciaPedido({
      elegivelPiloto: true,
      criterioSolicitacao: "MATRICULA",
      numeroMatricula: 142300,
      acervo: acervoIntegro,
      contraditorioDisponivel: true,
      prenotacoes: [
        {
          numeroPrenotacao: "784.355",
          dataApresentacaoIso: "2026-10-29T15:00:00Z",
          dataApresentacaoBr: "29/10/2026",
          naturezaTitulo: "Alienação Fiduciária",
          emProcessamentoAtoNaMatricula: true,
          etapaAtual: "Em lançamento na matrícula",
        },
      ],
    });
    expect(r63.pausarPorAtoProcessamento).toBe(true);
    expect(r63.estadoSugerido).toBe("AGUARDANDO_ATUALIZACAO_MATRICULA");
    expect(r63.decisaoProposta).toBe("PAUSAR_POR_ATO_EM_PROCESSAMENTO");

    // Máquina de estados bloqueia avanço para APTO_EMISSAO enquanto pausado sem nova conferência
    const bloqueio = validarTransicaoEstadoPedido({
      estadoAtual: "EM_CONFERENCIA",
      novoEstado: "APTO_EMISSAO",
      atorTipo: "HUMANO",
      pausadoPorAtoProcessamento: true,
      novaConferenciaRealizadaAposAto: false,
    });
    expect(bloqueio.permitida).toBe(false);
  });

  it("conclui atualização de matrícula (Regra 6.4), recalcula hash de versão e executa reconferência obrigatória", async () => {
    const tenant = "tenant-test-reconferencia-7ri";
    const { pedidos } = await listarPedidosCartorioVirtual(tenant);
    const pedidoDesatualizado = pedidos.find((p) => p.numeroPedido === "9901004")!;
    expect(pedidoDesatualizado.estadoOperacional).toBe("AGUARDANDO_ATUALIZACAO_MATRICULA");
    const hashAnterior = pedidoDesatualizado.versaoDadosFonteHash;

    const atualizado = await concluirAtualizacaoMatriculaEReconferir({
      tenantId: tenant,
      pedidoId: pedidoDesatualizado.id,
      evidenciaConclusao: "Ficha da matrícula 22.910 digitalizada e conferida no Livro 2.",
      operadorId: "user-op-1",
      operadorNome: "Escrevente Teste",
      papelRegistral: "ESCREVENTE_AUTORIZADO",
    });

    expect(atualizado.estadoOperacional).toBe("APTO_EMISSAO");
    expect(atualizado.versaoDadosFonteHash).not.toBe(hashAnterior);
    expect(detectarMudancaMaterialPedido(hashAnterior, atualizado.versaoDadosFonteHash)).toBe(true);

    // Modo de comparação identifica convergência e divergência crítica de Contraditório
    expect(
      avaliarComparacaoPiloto({
        decisaoPropostaFiorix: "APTO_EMISSAO",
        procedimentoRealEquipe: "EMITIDA_NORMALMENTE",
      }).statusComparacao
    ).toBe("CONVERGENTE");

    const divCritica = avaliarComparacaoPiloto({
      decisaoPropostaFiorix: "APTO_EMISSAO",
      procedimentoRealEquipe: "RETIDA_POR_ATO_EM_PROCESSAMENTO",
    });
    expect(divCritica.statusComparacao).toBe("DIVERGENTE");
    expect(divCritica.divergenciaClassificacao).toBe("CRITICA_OMISSAO_CONTRADITORIO");
  });

  it("nunca declara matrícula apta quando o Contraditório está indisponível", () => {
    const hash = gerarHashVersaoDadosFonte({
      tenantId: "t1",
      numeroPedido: "100",
      itens: [{ sequenciaItem: 1, numeroMatricula: 5000, naturezaDescricao: "Inteiro Teor" }],
      prenotacoes: [],
      acervos: [],
    });
    expect(hash).toHaveLength(64);

    const res = executarRegrasConferenciaPedido({
      elegivelPiloto: true,
      criterioSolicitacao: "MATRICULA",
      numeroMatricula: 5000,
      acervo: {
        numeroMatricula: 5000,
        vinculadaServentia: true,
        possuiRegistroEstruturado: true,
        possuiArquivoDigitalizado: true,
        integraEAtualizada: true,
      },
      contraditorioDisponivel: false,
      prenotacoes: [],
    });
    expect(res.contraditorioStatus).toBe("INDISPONIVEL");
    expect(res.estadoSugerido).toBe("COM_FALHA_OU_PENDENCIA");
  });
});

