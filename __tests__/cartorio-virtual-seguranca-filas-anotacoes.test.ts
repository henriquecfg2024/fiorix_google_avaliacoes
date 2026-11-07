import { describe, expect, it } from "vitest";
import {
  gerarScriptGrantSelectSomenteLeitura,
  prepararSolicitacaoAssinaturaExternaPiloto,
} from "../src/lib/cartorio-virtual/adapters";
import {
  avaliarAutorizacaoCartorioVirtual,
  obterMatrizPadraoPapelRegistral,
  validarIsolamentoTenantRecurso,
} from "../src/lib/cartorio-virtual/permissions-core";
import {
  calcularBackoffExponencialMs,
  classificarFalhaExecucaoJob,
  detectarJobsTravados,
  gerarChaveIdempotenciaJob,
} from "../src/lib/cartorio-virtual/queue-engine";
import {
  criarAnotacaoOuTarefaCartorioVirtual,
  editarAnotacaoPreservandoHistorico,
  listarAnotacoesCartorioVirtual,
  listarPedidosCartorioVirtual,
  listarRevisoesCartorioVirtual,
  obterDetalhePedidoCartorioVirtual,
  registrarDecisaoRevisaoHumana,
} from "../src/lib/cartorio-virtual/repository";
import { isAmbienteSinteticoPermitido } from "../src/lib/cartorio-virtual/synthetic-fixtures";
import { validarTransicaoEstadoPedido } from "../src/lib/cartorio-virtual/types";

describe("Cartório Virtual — Isolamento Multi-Serventia (7º RI × 5º RI), Competência Registral, Filas e Anotações", () => {
  it("isola integralmente pedidos, anotações e revisões entre 7º RI e 5º RI", async () => {
    const tenant7ri = "tenant-7ri-sp-isolamento";
    const tenant5ri = "tenant-5ri-sp-isolamento";

    const anot7 = await criarAnotacaoOuTarefaCartorioVirtual({
      tenantId: tenant7ri,
      tipoRegistro: "TAREFA",
      categoria: "ACERVO",
      prioridade: "ALTA",
      titulo: "Conferir microfilme exclusivo do 7º RI",
      conteudo: "Registro restrito à serventia do 7º RI.",
      autorId: "usr-7ri",
      autorNome: "Colaborador 7º RI",
      autorPapel: "ESCREVENTE_AUTORIZADO",
    });

    const lista5ri = await listarAnotacoesCartorioVirtual(tenant5ri);
    expect(lista5ri.some((a) => a.id === anot7.id)).toBe(false);

    // Tentativa de edição cruzada entre serventias deve ser bloqueada
    await expect(
      editarAnotacaoPreservandoHistorico({
        tenantId: tenant5ri,
        anotacaoId: anot7.id,
        novoConteudo: "Tentativa indevida de outro cartório",
        motivoEdicao: "Teste de intrusão",
        editorId: "usr-5ri",
        editorNome: "Operador 5º RI",
        editorPapel: "ESCREVENTE_AUTORIZADO",
      })
    ).rejects.toThrow(/não encontrada nesta serventia/);

    expect(
      validarIsolamentoTenantRecurso({
        userTenantId: tenant5ri,
        recursoTenantId: tenant7ri,
      }).permitido
    ).toBe(false);

    const { pedidos: p7 } = await listarPedidosCartorioVirtual(tenant7ri);
    const detCross = await obterDetalhePedidoCartorioVirtual(tenant5ri, p7[0].id);
    // IDs sintéticos possuem tenantId validado estritamente: nunca retorna pedido de outro tenant
    if (detCross.pedido) {
      expect(detCross.pedido.tenantId).toBe(tenant5ri);
    }
  });

  it("impede que ADMIN técnico ou Agente Virtual aprove revisões ou solicite assinatura sem outorga registral", () => {
    // 1. ADMIN técnico sem registro formal em FiorixCvAutorizacao
    const adminTecnico = avaliarAutorizacaoCartorioVirtual({
      papelSistema: "ADMIN",
      atorTipo: "HUMANO",
      autorizacaoRegistral: null,
    });
    expect(adminTecnico.papelRegistral).toBe("SEM_ATRIBUICAO_REGISTRAL");
    expect(adminTecnico.capacidades).toContain("configurar_regras");
    expect(adminTecnico.capacidades).not.toContain("aprovar_revisao");
    expect(adminTecnico.capacidades).not.toContain("solicitar_assinatura");

    // 2. Agente de software jamais recebe fé pública ou competência decisória
    const agente = avaliarAutorizacaoCartorioVirtual({
      papelSistema: "MASTER",
      atorTipo: "AGENTE_VIRTUAL",
      autorizacaoRegistral: {
        papelRegistral: "OFICIAL",
        ativo: true,
        ...obterMatrizPadraoPapelRegistral("OFICIAL"),
      },
    });
    expect(agente.papelRegistral).toBe("SEM_ATRIBUICAO_REGISTRAL");
    expect(agente.capacidades).not.toContain("aprovar_revisao");
    expect(agente.capacidades).not.toContain("solicitar_assinatura");

    // Agente de software bloqueado de emitir, assinar ou entregar no piloto
    expect(
      validarTransicaoEstadoPedido({
        estadoAtual: "EM_IMPRESSAO",
        novoEstado: "EMITIDO",
        atorTipo: "AGENTE_VIRTUAL",
      }).permitida
    ).toBe(false);

    // 3. Escrevente Autorizado com outorga vigente possui competência para aprovar revisão
    const escreventeAutorizado = avaliarAutorizacaoCartorioVirtual({
      papelSistema: "USER",
      atorTipo: "HUMANO",
      autorizacaoRegistral: {
        papelRegistral: "ESCREVENTE_AUTORIZADO",
        ativo: true,
        ...obterMatrizPadraoPapelRegistral("ESCREVENTE_AUTORIZADO"),
      },
    });
    expect(escreventeAutorizado.capacidades).toContain("aprovar_revisao");
  });

  it("preserva todas as versões anteriores ao editar anotação (edição não-destrutiva) e bloqueia aprovação com hash obsoleto", async () => {
    const tenant = "tenant-7ri-edicao-e-revisao";
    const criada = await criarAnotacaoOuTarefaCartorioVirtual({
      tenantId: tenant,
      tipoRegistro: "ANOTACAO",
      categoria: "CONFERENCIA",
      prioridade: "NORMAL",
      titulo: "Verificação Livro 2",
      conteudo: "Texto original da primeira conferência (v1).",
      autorId: "u1",
      autorNome: "Conferente A",
      autorPapel: "CONFERENTE",
    });
    expect(criada.versaoAtual).toBe(1);

    const editada = await editarAnotacaoPreservandoHistorico({
      tenantId: tenant,
      anotacaoId: criada.id,
      novoConteudo: "Texto complementado após retorno do arquivo (v2).",
      motivoEdicao: "Complemento de informação de microfilme",
      novoStatus: "RESOLVIDA",
      editorId: "u2",
      editorNome: "Escrevente B",
      editorPapel: "ESCREVENTE_AUTORIZADO",
    });

    expect(editada.versaoAtual).toBe(2);
    expect(editada.versoes).toHaveLength(2);
    expect(editada.versoes.some((v) => v.versao === 1 && v.conteudo.includes("(v1)"))).toBe(true);
    expect(editada.versoes.some((v) => v.versao === 2 && v.conteudo.includes("(v2)"))).toBe(true);

    // Revisão bloqueia papel CONFERENTE e bloqueia hash desatualizado
    const revisoes = await listarRevisoesCartorioVirtual(tenant);
    const pendente = revisoes.find((r) => r.statusRevisao === "PENDENTE")!;

    await expect(
      registrarDecisaoRevisaoHumana({
        tenantId: tenant,
        revisaoId: pendente.id,
        decisao: "APROVADA",
        justificativa: "Tentativa sem competência registral",
        versaoDadosConfirmadaHash: pendente.versaoDadosFonteHash,
        decididoPorId: "u-conf",
        decididoPorNome: "Conferente",
        papelRegistral: "CONFERENTE",
      })
    ).rejects.toThrow(/Competência registral insuficiente/);

    await expect(
      registrarDecisaoRevisaoHumana({
        tenantId: tenant,
        revisaoId: pendente.id,
        decisao: "APROVADA",
        justificativa: "Tentativa sobre hash antigo",
        versaoDadosConfirmadaHash: "hash_obsoleto_diferente_do_atual",
        decididoPorId: "u-esc",
        decididoPorNome: "Escrevente Autorizado",
        papelRegistral: "ESCREVENTE_AUTORIZADO",
      })
    ).rejects.toThrow(/sofreram alteração relevante/);
  });

  it("protege filas contra timeout externo de resultado incerto, bloqueia dados sintéticos em produção e garante SQL somente leitura", () => {
    expect(isAmbienteSinteticoPermitido({ NODE_ENV: "production" })).toBe(false);
    expect(isAmbienteSinteticoPermitido({ NODE_ENV: "test" })).toBe(true);

    const k1 = gerarChaveIdempotenciaJob({
      tenantId: "7ri",
      agenteVirtual: "AGENTE_CONTRADITORIO",
      tipoJob: "CONFERIR_MATRICULA",
      referenciaAlvoId: "ped-1",
      versaoDadosHash: "abc123",
    });
    const k2 = gerarChaveIdempotenciaJob({
      tenantId: "7ri",
      agenteVirtual: "AGENTE_CONTRADITORIO",
      tipoJob: "CONFERIR_MATRICULA",
      referenciaAlvoId: "ped-1",
      versaoDadosHash: "abc123",
    });
    expect(k1).toBe(k2);
    expect(calcularBackoffExponencialMs(1)).toBe(5000);
    expect(calcularBackoffExponencialMs(2)).toBe(15000);

    // Timeout em chamada externa com possível efeito colateral -> RESULTADO_EXTERNO_DESCONHECIDO (sem reexecução cega!)
    const falhaExterna = classificarFalhaExecucaoJob({
      erroMensagem: "Socket timeout after payload sent",
      codigoErro: "ETIMEDOUT",
      operacaoExternaComEfeitoColateral: true,
      tentativasAtuais: 1,
      maxTentativas: 3,
    });
    expect(falhaExterna.novoStatus).toBe("RESULTADO_EXTERNO_DESCONHECIDO");
    expect(falhaExterna.proximaExecucaoDelayMs).toBeNull();
    expect(falhaExterna.exigeVerificacaoHumanaImediata).toBe(true);

    const travados = detectarJobsTravados(
      [
        { id: "j1", statusJob: "PROCESSANDO", bloqueadoAte: "2026-11-07T08:00:00Z" },
        { id: "j2", statusJob: "PROCESSANDO", bloqueadoAte: "2026-11-07T12:00:00Z" },
      ],
      new Date("2026-11-07T10:00:00Z")
    );
    expect(travados.map((j) => j.id)).toEqual(["j1"]);

    // Assinatura externa desabilitada no piloto e SQL estritamente SELECT
    const ass = prepararSolicitacaoAssinaturaExternaPiloto({
      tenantId: "7ri",
      pedidoId: "p1",
      numeroPedido: "9901001",
      documentoHashSha256: "00".repeat(32),
      modalidadeSolicitada: "INDIVIDUAL",
      tipoCertificadoHomologado: "A1_LOCAL_SERVENTIA",
      solicitadoPorUserId: "u1",
      solicitadoPorPapelRegistral: "ESCREVENTE_AUTORIZADO",
    });
    expect(ass.enviado).toBe(false);

    const sqlDba = gerarScriptGrantSelectSomenteLeitura("fiorix_connector");
    expect(sqlDba).toContain("GRANT SELECT ON OBJECT::dbo.tblWRICertidao TO [fiorix_connector];");
    expect(sqlDba).not.toMatch(/\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/);
  });
});
