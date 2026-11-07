"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { recordAuditLog } from "@/lib/audit";
import {
  exigirCapacidadeCartorioVirtual,
  obterContextoAutorizacaoCartorioVirtual,
  obterMatrizPadraoPapelRegistral,
} from "@/lib/cartorio-virtual/permissions";
import {
  concluirAtualizacaoMatriculaEReconferir,
  criarAnotacaoOuTarefaCartorioVirtual,
  criarLoteImpressaoPedidos,
  definirConferenciaEscreventePedido,
  editarAnotacaoPreservandoHistorico,
  excluirAnotacaoCartorioVirtual,
  registrarDecisaoRevisaoHumana,
  registrarProcedimentoRealEquipeComparacao,
  salvarMarcacoesDocumentoPedido,
  type FiltrosConsultaPedidosCV,
} from "@/lib/cartorio-virtual/repository";
import type {
  MarcacaoVisualDocumentoPedido,
  PapelRegistral,
} from "@/lib/cartorio-virtual/types";

function revalidarPaginasCartorioVirtual() {
  revalidatePath("/cartorio-virtual");
  revalidatePath("/cartorio-virtual/certidoes");
  revalidatePath("/cartorio-virtual/impressao");
  revalidatePath("/cartorio-virtual/historico");
  revalidatePath("/configuracoes/cartorio-virtual");
}

export async function criarAnotacaoTarefaAction(input: {
  pedidoId?: string | null;
  numeroMatricula?: number | null;
  parentId?: string | null;
  tipoRegistro: "ANOTACAO" | "TAREFA" | "DIVERGENCIA" | "ORIENTACAO";
  categoria: string;
  prioridade: "BAIXA" | "NORMAL" | "ALTA" | "URGENTE";
  visibilidade?: "EQUIPE_INTERNA" | "REVISORES" | "GESTAO";
  titulo: string;
  conteudo: string;
  atribuidoParaNome?: string | null;
  setorDestino?: string | null;
  prazoIso?: string | null;
}) {
  // Se o usuário tiver atribuição registral com 'anotar' usa-a; em modo piloto local permite colaborador autenticado consultar/anotar se habilitado
  const ctx = await obterContextoAutorizacaoCartorioVirtual();
  if (!ctx.capacidades.includes("anotar") && !ctx.capacidades.includes("consultar")) {
    throw new Error("Sem permissão para registrar apontamentos no Cartório Virtual.");
  }

  const criada = await criarAnotacaoOuTarefaCartorioVirtual({
    tenantId: ctx.tenantId,
    pedidoId: input.pedidoId ?? null,
    numeroMatricula: input.numeroMatricula ?? null,
    parentId: input.parentId ?? null,
    tipoRegistro: input.tipoRegistro,
    categoria: input.categoria,
    prioridade: input.prioridade,
    visibilidade: input.visibilidade,
    titulo: input.titulo,
    conteudo: input.conteudo,
    atribuidoParaNome: input.atribuidoParaNome ?? null,
    setorDestino: input.setorDestino ?? null,
    prazoIso: input.prazoIso ?? null,
    autorId: ctx.user.id,
    autorNome: ctx.user.name || ctx.user.email || "Colaborador",
    autorPapel: ctx.papelRegistral,
  });

  revalidarPaginasCartorioVirtual();
  return { ok: true, anotacao: criada };
}

export async function editarAnotacaoTarefaAction(input: {
  anotacaoId: string;
  novoConteudo: string;
  motivoEdicao: string;
  novoStatus?: "ABERTA" | "EM_ANDAMENTO" | "AGUARDANDO_RETORNO" | "RESOLVIDA" | "ARQUIVADA";
}) {
  const ctx = await obterContextoAutorizacaoCartorioVirtual();
  if (!ctx.capacidades.includes("anotar") && !ctx.capacidades.includes("consultar")) {
    throw new Error("Sem permissão para editar apontamentos no Cartório Virtual.");
  }

  const editada = await editarAnotacaoPreservandoHistorico({
    tenantId: ctx.tenantId,
    anotacaoId: input.anotacaoId,
    novoConteudo: input.novoConteudo,
    motivoEdicao: input.motivoEdicao,
    novoStatus: input.novoStatus,
    editorId: ctx.user.id,
    editorNome: ctx.user.name || ctx.user.email || "Colaborador",
    editorPapel: ctx.papelRegistral,
  });

  revalidarPaginasCartorioVirtual();
  return { ok: true, anotacao: editada };
}

export async function excluirAnotacaoTarefaAction(input: {
  anotacaoId: string;
}) {
  const ctx = await obterContextoAutorizacaoCartorioVirtual();
  if (!ctx.capacidades.includes("anotar") && !ctx.capacidades.includes("consultar")) {
    throw new Error("Sem permissão para excluir apontamentos no Cartório Virtual.");
  }

  const resultado = await excluirAnotacaoCartorioVirtual({
    tenantId: ctx.tenantId,
    anotacaoId: input.anotacaoId,
    operadorId: ctx.user.id,
    operadorNome: ctx.user.name || ctx.user.email || "Colaborador",
    papelRegistral: ctx.papelRegistral,
  });

  revalidarPaginasCartorioVirtual();
  return { ok: true, ...resultado };
}

export async function concluirAtualizacaoMatriculaAction(input: {
  pedidoId: string;
  evidenciaConclusao: string;
}) {
  const ctx = await exigirCapacidadeCartorioVirtual("solicitar_atualizacao");
  const pedido = await concluirAtualizacaoMatriculaEReconferir({
    tenantId: ctx.tenantId,
    pedidoId: input.pedidoId,
    evidenciaConclusao: input.evidenciaConclusao,
    operadorId: ctx.user.id,
    operadorNome: ctx.user.name || ctx.user.email || "Operador",
    papelRegistral: ctx.papelRegistral,
  });

  revalidarPaginasCartorioVirtual();
  return { ok: true, pedido };
}

export async function decidirRevisaoHumanaAction(input: {
  revisaoId: string;
  decisao: "APROVADA" | "REPROVADA" | "DEVOLVIDA_ATUALIZACAO";
  justificativa: string;
  versaoDadosConfirmadaHash: string;
}) {
  // Exige estritamente competência registral 'aprovar_revisao' (ADMIN técnico sem outorga registral é bloqueado!)
  const ctx = await exigirCapacidadeCartorioVirtual("aprovar_revisao");

  const revisao = await registrarDecisaoRevisaoHumana({
    tenantId: ctx.tenantId,
    revisaoId: input.revisaoId,
    decisao: input.decisao,
    justificativa: input.justificativa,
    versaoDadosConfirmadaHash: input.versaoDadosConfirmadaHash,
    decididoPorId: ctx.user.id,
    decididoPorNome: ctx.user.name || ctx.user.email || "Pessoa Autorizada",
    papelRegistral: ctx.papelRegistral,
  });

  await recordAuditLog({
    modulo: "CARTORIO_VIRTUAL",
    acao:
      input.decisao === "APROVADA"
        ? "APROVACAO"
        : input.decisao === "REPROVADA"
        ? "REJEICAO"
        : "REVISAO",
    registroId: revisao.id,
    registroDescricao: `Revisão ${input.decisao} no pedido nº ${revisao.numeroPedido} (${ctx.papelRegistral}).`,
    userOverride: ctx.user,
    detalhes: {
      papelSistema: ctx.papelSistema,
      papelRegistral: ctx.papelRegistral,
      numeroPedido: revisao.numeroPedido,
      versaoDadosConfirmadaHash: input.versaoDadosConfirmadaHash,
    },
  }).catch(() => {});

  revalidarPaginasCartorioVirtual();
  return { ok: true, revisao };
}

export async function registrarComparacaoPilotoAction(input: {
  pedidoId: string;
  procedimentoRealEquipe: string;
}) {
  const ctx = await obterContextoAutorizacaoCartorioVirtual();
  const pedido = await registrarProcedimentoRealEquipeComparacao({
    tenantId: ctx.tenantId,
    pedidoId: input.pedidoId,
    procedimentoRealEquipe: input.procedimentoRealEquipe,
    operadorId: ctx.user.id,
    operadorNome: ctx.user.name || ctx.user.email || "Operador",
    papelRegistral: ctx.papelRegistral,
  });

  revalidarPaginasCartorioVirtual();
  return { ok: true, pedido };
}

export async function gerarLoteImpressaoAction(input: {
  modoSelecao: "INDIVIDUAL" | "SELECIONADOS" | "FILTRADOS" | "TOTAL_DISPONIVEL";
  pedidosIds?: string[];
  filtros?: FiltrosConsultaPedidosCV;
  duplexFrenteNovaFolha: boolean;
  modoDadosImpressao: "ORIGINAL_CONGELADO" | "ATUAL_RECONSTRUIDO";
  criterioOrdenacao?: "NUMERO_PEDIDO_ASC" | "DATA_PEDIDO_DESC" | "ORIGEM_ASC" | "ORDEM_DIGITADA";
  loteOrigemReimpressaoId?: string | null;
  motivoReimpressao?: string | null;
}) {
  const ctx = await obterContextoAutorizacaoCartorioVirtual();
  const lote = await criarLoteImpressaoPedidos({
    tenantId: ctx.tenantId,
    modoSelecao: input.modoSelecao,
    pedidosIds: input.pedidosIds,
    filtros: input.filtros,
    duplexFrenteNovaFolha: input.duplexFrenteNovaFolha,
    modoDadosImpressao: input.modoDadosImpressao,
    criterioOrdenacao: input.criterioOrdenacao,
    loteOrigemReimpressaoId: input.loteOrigemReimpressaoId ?? null,
    motivoReimpressao: input.motivoReimpressao ?? null,
    operadorId: ctx.user.id,
    operadorNome: ctx.user.name || ctx.user.email || "Operador",
    papelRegistral: ctx.papelRegistral,
  });

  revalidarPaginasCartorioVirtual();
  return { ok: true, lote };
}

export async function salvarAutorizacaoRegistralUsuarioAction(input: {
  usuarioAlvoId: string;
  usuarioAlvoNome: string;
  papelRegistral: PapelRegistral;
  ativo: boolean;
  observacoes?: string;
}) {
  const ctx = await exigirCapacidadeCartorioVirtual("configurar_regras");
  const matriz = obterMatrizPadraoPapelRegistral(input.papelRegistral);

  try {
    await prisma.fiorixCvAutorizacao.upsert({
      where: {
        tenantId_usuarioId: {
          tenantId: ctx.tenantId,
          usuarioId: input.usuarioAlvoId,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        usuarioId: input.usuarioAlvoId,
        usuarioNome: input.usuarioAlvoNome,
        papelRegistral: input.papelRegistral,
        ativo: input.ativo,
        podeConsultar: matriz.podeConsultar,
        podeConferir: matriz.podeConferir,
        podeAnotar: matriz.podeAnotar,
        podeSolicitarAtualiz: matriz.podeSolicitarAtualizacao,
        podeAprovarRevisao: matriz.podeAprovarRevisao,
        podeImprimir: matriz.podeImprimir,
        podeSolicitarAssin: matriz.podeSolicitarAssinatura,
        podeConfigurarRegras: matriz.podeConfigurarRegras,
        podeAuditarHistorico: matriz.podeAuditarHistorico,
        observacoes: input.observacoes?.trim() || null,
        atribuidoPorId: ctx.user.id,
        atribuidoPorNome: ctx.user.name || ctx.user.email || "Gestor",
      },
      update: {
        usuarioNome: input.usuarioAlvoNome,
        papelRegistral: input.papelRegistral,
        ativo: input.ativo,
        podeConsultar: matriz.podeConsultar,
        podeConferir: matriz.podeConferir,
        podeAnotar: matriz.podeAnotar,
        podeSolicitarAtualiz: matriz.podeSolicitarAtualizacao,
        podeAprovarRevisao: matriz.podeAprovarRevisao,
        podeImprimir: matriz.podeImprimir,
        podeSolicitarAssin: matriz.podeSolicitarAssinatura,
        podeConfigurarRegras: matriz.podeConfigurarRegras,
        podeAuditarHistorico: matriz.podeAuditarHistorico,
        observacoes: input.observacoes?.trim() || null,
        atribuidoPorId: ctx.user.id,
        atribuidoPorNome: ctx.user.name || ctx.user.email || "Gestor",
      },
    });
  } catch (err: any) {
    if (String(err?.code || "") === "P2021" || String(err?.message || "").includes("fiorix_cv_")) {
      throw new Error(
        "A tabela fiorix_cv_autorizacoes aguarda aplicação da migration local aprovada."
      );
    }
    throw err;
  }

  revalidarPaginasCartorioVirtual();
  return { ok: true };
}

export async function alternarConferenciaPedidoAction(input: {
  pedidoId: string;
  conferido?: boolean;
  status?: "CONFERIDO" | "NAO_CONFERIDO" | "DEVOLVIDO";
}) {
  const ctx = await obterContextoAutorizacaoCartorioVirtual();
  if (!ctx.capacidades.includes("conferir") && !ctx.capacidades.includes("consultar")) {
    throw new Error("Sem permissão para alterar a conferência de pedidos no Cartório Virtual.");
  }

  const pedido = await definirConferenciaEscreventePedido({
    tenantId: ctx.tenantId,
    pedidoId: input.pedidoId,
    conferido: input.conferido,
    status: input.status,
    operadorId: ctx.user.id,
    operadorNome: ctx.user.name || ctx.user.email || "Escrevente",
    papelRegistral: ctx.papelRegistral,
  });

  revalidarPaginasCartorioVirtual();
  return { ok: true, pedido };
}

export async function salvarMarcacoesDocumentoPedidoAction(input: {
  pedidoId: string;
  marcacoes: MarcacaoVisualDocumentoPedido[];
}) {
  const ctx = await obterContextoAutorizacaoCartorioVirtual();
  if (!ctx.capacidades.includes("anotar") && !ctx.capacidades.includes("consultar")) {
    throw new Error("Sem permissão para gravar marcações no documento.");
  }

  const pedido = await salvarMarcacoesDocumentoPedido({
    tenantId: ctx.tenantId,
    pedidoId: input.pedidoId,
    marcacoes: input.marcacoes || [],
    operadorId: ctx.user.id,
    operadorNome: ctx.user.name || ctx.user.email || "Escrevente",
    papelRegistral: ctx.papelRegistral,
  });

  revalidarPaginasCartorioVirtual();
  return { ok: true, pedido };
}
