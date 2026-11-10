import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { recordAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const MODELOS_PROVIDER_KEY = 'RELATORIOS_PERSONALIZADOS_MODELOS';

/** Todas as colunas liberadas para todos os colaboradores */
const COLUNAS_RESTRITAS_GESTOR = new Set<string>([]);

function isPerfilGestor(role?: string | null): boolean {
  const r = String(role || '').toUpperCase();
  return [
    'MASTER',
    'SUBSTITUTO',
    'SUPER_ADMIN',
    'TENANT_ADMIN',
    'ADMIN',
    'GESTOR',
    'MANAGER',
  ].includes(r);
}

function formatarNumeroPedido(numero: string | number | null | undefined): string {
  if (numero === null || numero === undefined) return '—';
  const limpo = String(numero).replace(/^(PEDIDO|PROTOCOLO)\s*N[º°o]?\s*/i, '').trim();
  if (!limpo) return '—';
  const apenasDigitos = limpo.replace(/\D/g, '');
  if (apenasDigitos && apenasDigitos === limpo) {
    return Number(apenasDigitos).toLocaleString('pt-BR');
  }
  return limpo;
}

function formatarDataBr(isoOuData: Date | string | null | undefined): string {
  if (!isoOuData) return '—';
  const dt = isoOuData instanceof Date ? isoOuData : new Date(String(isoOuData));
  if (Number.isNaN(dt.getTime()) || dt.getUTCFullYear() <= 1900) return '—';
  return dt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatarMoedaBr(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return '—';
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export interface RegistroRelatorioPersonalizadoDTO {
  id: string;
  numeroPedidoRaw: string;
  dataPedidoIso: string;
  origemRaw: 'ONR' | 'BALCAO' | string;
  depositoCentavos: number | null;
  cotaCentavos: number | null;
  saldoCentavos: number | null;
  valores: {
    magnetico: string;
    pedido: string;
    nome_cliente: string;
    cpf_cnpj: string;
    telefone: string;
    atendente: string;
    canal_atendimento: string;
    valor_deposito: string;
    cota: string;
    saldo: string;
    forma_pagamento: string;
    status: string;
    data_pedido: string;
    data_retirada: string;
    observacoes: string;
  };
}

async function carregarRegistrosReaisWebri(params: {
  tenantId: string;
  dataInicial?: string;
  dataFinal?: string;
  atendente?: string;
  canalAtendimento?: string;
  magnetico?: string;
  pedido?: string;
  permitirRestritasGestor: boolean;
}): Promise<{
  registros: RegistroRelatorioPersonalizadoDTO[];
  totalDepositosCentavos: number;
  totalDepositosFormatado: string;
  totalCotasCentavos: number;
  totalCotasFormatado: string;
  totalSaldosCentavos: number;
  totalSaldosFormatado: string;
  atendentesDisponiveis: string[];
}> {
  const where: any = {
    tenantId: params.tenantId,
  };

  if (params.dataInicial || params.dataFinal) {
    where.dataPedido = {};
    if (params.dataInicial) {
      where.dataPedido.gte = new Date(`${params.dataInicial}T00:00:00.000Z`);
    }
    if (params.dataFinal) {
      where.dataPedido.lte = new Date(`${params.dataFinal}T23:59:59.999Z`);
    }
  }

  // Regra oficial do Webri: ONR sempre possui o campo Magnético (ProtocoloEntidade / protocoloExterno) preenchido.
  // Pedidos sem Magnético (null, vazio ou '0', ex.: 1.332.611) são estritamente PRESENCIAL (BALCAO).
  const canalUpper = (params.canalAtendimento || '').trim().toUpperCase();
  if (canalUpper === 'ONR') {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      { protocoloExterno: { not: null } },
      { NOT: { protocoloExterno: '' } },
      { NOT: { protocoloExterno: '0' } },
    ];
  } else if (canalUpper === 'PRESENCIAL' || canalUpper === 'BALCAO') {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : []),
      {
        OR: [
          { protocoloExterno: null },
          { protocoloExterno: '' },
          { protocoloExterno: '0' },
        ],
      },
    ];
  }

  if (params.magnetico?.trim()) {
    where.protocoloExterno = {
      contains: params.magnetico.trim(),
      mode: 'insensitive',
    };
  }

  if (params.pedido?.trim()) {
    const qPed = params.pedido.trim().replace(/\./g, '');
    where.numeroPedido = {
      contains: qPed,
    };
  }

  let tenantIdEfetivo = params.tenantId;
  let pedidosDb = await prisma.fiorixCvPedido.findMany({
    where,
    orderBy: [{ dataPedido: 'desc' }, { numeroPedido: 'desc' }],
    take: 5000,
  });

  // Se o colaborador autenticado estiver vinculado a um tenant secundário/homologação sem pedidos próprios,
  // utiliza o tenant principal da serventia em fiorix_cv_pedidos para que todos os colaboradores visualizem os pedidos reais.
  if (pedidosDb.length === 0) {
    const primeiroPedidoServentia = await prisma.fiorixCvPedido.findFirst({
      select: { tenantId: true },
      orderBy: { dataPedido: 'desc' },
    });
    if (
      primeiroPedidoServentia?.tenantId &&
      primeiroPedidoServentia.tenantId !== params.tenantId
    ) {
      tenantIdEfetivo = primeiroPedidoServentia.tenantId;
      where.tenantId = tenantIdEfetivo;
      pedidosDb = await prisma.fiorixCvPedido.findMany({
        where,
        orderBy: [{ dataPedido: 'desc' }, { numeroPedido: 'desc' }],
        take: 5000,
      });
    }
  }

  // Busca nomes de atendentes na tabela de produtividade (priorizando 'Depósito de Certidões')
  const numerosInt = pedidosDb
    .map((p) => Number(String(p.numeroPedido).replace(/\D/g, '')))
    .filter((n) => Number.isInteger(n) && n > 0);

  const mapaAtendenteProdutividade = new Map<number, string>();
  if (numerosInt.length > 0) {
    try {
      const prodRows = await prisma.$queryRawUnsafe<Array<{ pedido: number; nome: string }>>(
        `SELECT DISTINCT ON (pedido) pedido, nome
         FROM public.fiorix_produtividade_dados
         WHERE tenant_id = $1
           AND pedido = ANY($2::int[])
           AND COALESCE(TRIM(nome), '') <> ''
         ORDER BY pedido,
           CASE WHEN tipo_detalhado ILIKE '%Depósito%' THEN 0 ELSE 1 END,
           data DESC`,
        tenantIdEfetivo,
        numerosInt
      );
      for (const r of prodRows) {
        if (r.pedido && r.nome?.trim()) {
          mapaAtendenteProdutividade.set(Number(r.pedido), r.nome.trim());
        }
      }
    } catch {
      // Fallback silencioso caso a tabela fiorix_produtividade_dados não possua linhas para o lote
    }
  }

  const atendentesSet = new Set<string>();
  const todosConvertidos: RegistroRelatorioPersonalizadoDTO[] = [];

  // Deduplicação estrita por numeroPedido para evitar qualquer duplicidade de soma de depósitos
  const pedidosVistos = new Set<string>();

  for (const p of pedidosDb) {
    const chaveUnicaPedido = String(p.numeroPedido).trim();
    if (!chaveUnicaPedido || pedidosVistos.has(chaveUnicaPedido)) continue;
    pedidosVistos.add(chaveUnicaPedido);

    const reqJson = (p.requerenteJson as Record<string, any>) || {};
    const valJson = (p.valoresJson as Record<string, any>) || {};
    const webriMeta = (valJson._webriMeta as Record<string, any>) || {};
    const confMeta = (valJson._conferenciaEscrevente as Record<string, any>) || {};
    const itensMeta = Array.isArray(webriMeta.itensMeta) ? webriMeta.itensMeta : [];

    const numInt = Number(chaveUnicaPedido.replace(/\D/g, ''));
    const atendenteRaw =
      (webriMeta.atendenteNome && String(webriMeta.atendenteNome).trim()) ||
      (itensMeta[0]?.atendenteItemNome && String(itensMeta[0].atendenteItemNome).trim()) ||
      (numInt > 0 ? mapaAtendenteProdutividade.get(numInt) : null) ||
      (confMeta.operadorNome && String(confMeta.operadorNome).trim()) ||
      '';

    if (atendenteRaw) {
      atendentesSet.add(atendenteRaw);
    }

    // Regra oficial do Webri:
    // - Todo pedido com Magnético (ProtocoloEntidade / protocoloExterno) preenchido é ONR (Eletrônico)
    // - Todo pedido com Magnético vazio ou '0' é PRESENCIAL (BALCAO)
    const protocoloLimpo =
      p.protocoloExterno &&
      p.protocoloExterno.trim() !== '' &&
      p.protocoloExterno.trim() !== '0'
        ? p.protocoloExterno.trim()
        : null;
    const ehOnrReal = Boolean(protocoloLimpo);

    // Regra oficial do Webri (dbo.tblWRICertidaoCotas e dbo.tblWRICertidao):
    // - Depósito (valor_deposito) = VlrTotalDeposito + VlrTotalCompDep (armazenado em totalDeposito)
    // - Cota (cota)               = tblWRICertidaoCotas.VlrTotal = VlrCer1 + VlrCer2..10 = VlrTotalCota (armazenado em totalCota)
    // - Saldo (saldo)             = VlrSaldo = Depósito - Cota (armazenado em saldo)
    const oficiaisWebri = (valJson._valoresOficiaisWebri as Record<string, any>) || null;
    const valorServicoPart = Number(valJson.valorServico ?? 0);
    const valorDespesaPart = Number(valJson.valorDespesa ?? 0);
    const cotaDePartes =
      valorDespesaPart > 0
        ? Math.round((valorServicoPart + valorDespesaPart) * 100) / 100
        : 0;

    const cotaSalvaNum =
      valJson.totalCota !== undefined && valJson.totalCota !== null
        ? Number(valJson.totalCota)
        : 0;

    const totalCotaNum =
      cotaSalvaNum > 0
        ? cotaSalvaNum
        : oficiaisWebri?.totalCota !== undefined && oficiaisWebri?.totalCota !== null
        ? Number(oficiaisWebri.totalCota)
        : cotaDePartes;

    const depSalvoNum =
      valJson.totalDeposito !== undefined && valJson.totalDeposito !== null
        ? Number(valJson.totalDeposito)
        : 0;

    const totalDepositoNum =
      cotaSalvaNum === 0 && oficiaisWebri?.totalDeposito !== undefined && oficiaisWebri?.totalDeposito !== null
        ? Number(oficiaisWebri.totalDeposito)
        : ehOnrReal && cotaSalvaNum === 0 && cotaDePartes > 0 && Math.abs(depSalvoNum - cotaDePartes) < 0.02
        ? 0
        : depSalvoNum;

    const saldoNum =
      cotaSalvaNum === 0 && oficiaisWebri?.saldo !== undefined && oficiaisWebri?.saldo !== null
        ? Number(oficiaisWebri.saldo)
        : valJson.saldo !== undefined &&
          valJson.saldo !== null &&
          !(cotaSalvaNum === 0 && cotaDePartes > 0)
        ? Number(valJson.saldo)
        : Math.round((totalDepositoNum - totalCotaNum) * 100) / 100;

    const depositoCentavos = Number.isFinite(totalDepositoNum)
      ? Math.round(totalDepositoNum * 100)
      : 0;
    const cotaCentavos = Number.isFinite(totalCotaNum)
      ? Math.round(totalCotaNum * 100)
      : 0;
    const saldoCentavos = Number.isFinite(saldoNum)
      ? Math.round(saldoNum * 100)
      : 0;

    const dataRetiradaRaw =
      webriMeta.dataRetiradaBr ||
      itensMeta[0]?.dataRetiradaBr ||
      null;

    const statusLegivel = confMeta.conferido
      ? 'Conferido'
      : confMeta.devolvido
      ? 'Devolvido'
      : 'Aguardando conferência';

    const canalLegivel = ehOnrReal ? 'ONR (Eletrônico)' : 'PRESENCIAL';

    const dataPedidoIso = p.dataPedido
      ? p.dataPedido.toISOString().slice(0, 10)
      : '';

    todosConvertidos.push({
      id: p.id,
      numeroPedidoRaw: chaveUnicaPedido,
      dataPedidoIso,
      origemRaw: ehOnrReal ? 'ONR' : 'BALCAO',
      depositoCentavos,
      cotaCentavos,
      saldoCentavos,
      valores: {
        magnetico: protocoloLimpo || '—',
        pedido: formatarNumeroPedido(chaveUnicaPedido),
        nome_cliente: reqJson.nome ? String(reqJson.nome).trim() : '—',
        cpf_cnpj:
          (reqJson.documentoFormatado && String(reqJson.documentoFormatado).trim()) ||
          (reqJson.documentoMascarado && String(reqJson.documentoMascarado).trim()) ||
          '—',
        telefone: reqJson.telefone ? String(reqJson.telefone).trim() : '—',
        atendente: atendenteRaw || '—',
        canal_atendimento: canalLegivel,
        valor_deposito: depositoCentavos !== null ? formatarMoedaBr(depositoCentavos) : '—',
        cota: cotaCentavos !== null ? formatarMoedaBr(cotaCentavos) : '—',
        saldo: saldoCentavos !== null ? formatarMoedaBr(saldoCentavos) : '—',
        forma_pagamento: '—',
        status: statusLegivel,
        data_pedido: formatarDataBr(p.dataPedido),
        data_retirada: dataRetiradaRaw ? String(dataRetiradaRaw) : '—',
        observacoes: p.observacoesOrigem ? String(p.observacoesOrigem).trim() : '—',
      },
    });
  }

  // Filtro por atendente (após resolução de nome)
  const filtroAtendente = (params.atendente || '').trim().toLowerCase();
  const registrosFiltrados = filtroAtendente
    ? todosConvertidos.filter((r) =>
        r.valores.atendente.toLowerCase().includes(filtroAtendente)
      )
    : todosConvertidos;

  // Soma exata em centavos sobre todos os registros filtrados (sem duplicidade por pedido)
  const totalDepositosCentavos = registrosFiltrados.reduce(
    (acc, item) => acc + (item.depositoCentavos ?? 0),
    0
  );
  const totalCotasCentavos = registrosFiltrados.reduce(
    (acc, item) => acc + (item.cotaCentavos ?? 0),
    0
  );
  const totalSaldosCentavos = registrosFiltrados.reduce(
    (acc, item) => acc + (item.saldoCentavos ?? 0),
    0
  );

  return {
    registros: registrosFiltrados,
    totalDepositosCentavos,
    totalDepositosFormatado: formatarMoedaBr(totalDepositosCentavos),
    totalCotasCentavos,
    totalCotasFormatado: formatarMoedaBr(totalCotasCentavos),
    totalSaldosCentavos,
    totalSaldosFormatado: formatarMoedaBr(totalSaldosCentavos),
    atendentesDisponiveis: Array.from(atendentesSet).sort((a, b) =>
      a.localeCompare(b, 'pt-BR')
    ),
  };
}

export async function GET(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);

    const dataInicial = url.searchParams.get('dataInicial') || undefined;
    const dataFinal = url.searchParams.get('dataFinal') || undefined;
    const atendente = url.searchParams.get('atendente') || undefined;
    const canalAtendimento = url.searchParams.get('canalAtendimento') || undefined;
    const magnetico = url.searchParams.get('magnetico') || undefined;
    const pedido = url.searchParams.get('pedido') || undefined;

    const gestorReal = isPerfilGestor(user.role);

    const dados = await carregarRegistrosReaisWebri({
      tenantId: user.tenantId,
      dataInicial,
      dataFinal,
      atendente,
      canalAtendimento,
      magnetico,
      pedido,
      permitirRestritasGestor: gestorReal,
    });

    // Carrega modelos salvos da serventia/usuário em IntegrationConfig
    let modelosSalvos: any[] = [];
    try {
      const cfg = await prisma.integrationConfig.findUnique({
        where: {
          tenantId_integrationId: {
            tenantId: user.tenantId,
            integrationId: MODELOS_PROVIDER_KEY,
          },
        },
      });
      const parsed = cfg?.encryptedConfig ? JSON.parse(cfg.encryptedConfig) : null;
      const lista = parsed?.modelos;
      if (Array.isArray(lista)) {
        modelosSalvos = lista;
      }
    } catch {
      // Sem modelos salvos ainda
    }

    // Carrega histórico recente de gerações no log de auditoria
    let historicoGeracoes: any[] = [];
    try {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT id, usuario_nome, registro_descricao, detalhes, created_at
         FROM public.fiorix_audit_logs
         WHERE tenant_id = $1 AND modulo = 'RELATORIOS_PERSONALIZADOS'
         ORDER BY created_at DESC
         LIMIT 15`,
        user.tenantId
      );
      historicoGeracoes = rows.map((r) => ({
        id: String(r.id),
        usuarioNome: String(r.usuario_nome || user.name || 'Operador'),
        descricao: String(r.registro_descricao || ''),
        detalhes: r.detalhes || {},
        criadoEm: r.created_at ? new Date(r.created_at).toLocaleString('pt-BR') : '',
      }));
    } catch {
      // Tabela de auditoria opcional
    }

    return NextResponse.json({
      sucesso: true,
      usuario: {
        id: user.id,
        nome: user.name || user.email,
        role: user.role,
        isGestor: gestorReal,
      },
      totalRegistros: dados.registros.length,
      totalDepositosCentavos: dados.totalDepositosCentavos,
      totalDepositosFormatado: dados.totalDepositosFormatado,
      totalCotasCentavos: dados.totalCotasCentavos,
      totalCotasFormatado: dados.totalCotasFormatado,
      totalSaldosCentavos: dados.totalSaldosCentavos,
      totalSaldosFormatado: dados.totalSaldosFormatado,
      atendentesDisponiveis: dados.atendentesDisponiveis,
      registros: dados.registros,
      modelosSalvos,
      historicoGeracoes,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        sucesso: false,
        erro: err?.message || 'Falha ao consultar dados para o relatório personalizado.',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const action = String(body?.action || '');
    const possuiPermissaoGestor = isPerfilGestor(user.role);

    if (action === 'SALVAR_MODELO') {
      const nomeModelo = String(body?.nome || 'Meu modelo padrão').trim().slice(0, 80);
      const colunasBrutas: string[] = Array.isArray(body?.colunas) ? body.colunas : [];
      const colunasPermitidas = colunasBrutas.filter(
        (col) => possuiPermissaoGestor || !COLUNAS_RESTRITAS_GESTOR.has(col)
      );

      if (colunasPermitidas.length === 0) {
        return NextResponse.json(
          { sucesso: false, erro: 'Selecione pelo menos uma coluna permitida para salvar o modelo.' },
          { status: 400 }
        );
      }

      const existente = await prisma.integrationConfig.findUnique({
        where: {
          tenantId_integrationId: {
            tenantId: user.tenantId,
            integrationId: MODELOS_PROVIDER_KEY,
          },
        },
      });

      let listaAtual: any[] = [];
      try {
        const parsed = existente?.encryptedConfig ? JSON.parse(existente.encryptedConfig) : null;
        if (Array.isArray(parsed?.modelos)) {
          listaAtual = parsed.modelos;
        }
      } catch {
        listaAtual = [];
      }

      const novoModelo = {
        id: `mod-${Date.now()}`,
        nome: nomeModelo,
        colunas: colunasPermitidas,
        autorId: user.id,
        autorNome: user.name || user.email,
        atualizadoEm: new Date().toLocaleString('pt-BR'),
      };

      const semMesmoNome = listaAtual.filter(
        (m) => String(m?.nome || '').toLowerCase() !== nomeModelo.toLowerCase()
      );
      const novaLista = [novoModelo, ...semMesmoNome].slice(0, 30);

      await prisma.integrationConfig.upsert({
        where: {
          tenantId_integrationId: {
            tenantId: user.tenantId,
            integrationId: MODELOS_PROVIDER_KEY,
          },
        },
        update: {
          encryptedConfig: JSON.stringify({ modelos: novaLista }),
        },
        create: {
          tenantId: user.tenantId,
          integrationId: MODELOS_PROVIDER_KEY,
          displayName: 'Modelos de Relatórios Personalizados',
          isActive: true,
          encryptedConfig: JSON.stringify({ modelos: novaLista }),
        },
      });

      await recordAuditLog({
        modulo: 'RELATORIOS_PERSONALIZADOS' as any,
        acao: 'INCLUSAO',
        registroId: novoModelo.id,
        registroDescricao: `Modelo de relatório salvo: "${nomeModelo}" (${colunasPermitidas.length} colunas)`,
        detalhes: {
          nomeModelo,
          colunas: colunasPermitidas,
        },
        userOverride: user,
      });

      return NextResponse.json({
        sucesso: true,
        modelo: novoModelo,
        modelosSalvos: novaLista,
      });
    }

    if (action === 'REGISTRAR_GERACAO') {
      const formato = String(body?.formato || 'RELATORIO').toUpperCase();
      const colunasBrutas: string[] = Array.isArray(body?.colunas) ? body.colunas : [];
      const filtros = body?.filtros || {};

      // Validação estrita no servidor: bloqueia colunas restritas se não for Gestor
      const colunasBloqueadasTentadas = colunasBrutas.filter(
        (c) => !possuiPermissaoGestor && COLUNAS_RESTRITAS_GESTOR.has(c)
      );
      if (colunasBloqueadasTentadas.length > 0) {
        return NextResponse.json(
          {
            sucesso: false,
            erro: `Permissão negada no servidor para as colunas financeiras restritas ao Gestor: ${colunasBloqueadasTentadas.join(', ')}.`,
          },
          { status: 403 }
        );
      }

      if (colunasBrutas.length === 0) {
        return NextResponse.json(
          {
            sucesso: false,
            erro: 'Selecione pelo menos uma coluna antes de gerar ou exportar o relatório.',
          },
          { status: 400 }
        );
      }

      const dataHoraBr = new Date().toLocaleString('pt-BR');
      const descricao = `Geração de relatório (${formato}) com ${colunasBrutas.length} coluna(s)`;

      await recordAuditLog({
        modulo: 'RELATORIOS_PERSONALIZADOS' as any,
        acao: 'EMISSAO_DOSSIE',
        registroId: `rel-${Date.now()}`,
        registroDescricao: descricao,
        detalhes: {
          formato,
          colunas: colunasBrutas,
          filtrosAplicados: filtros,
          geradoEm: dataHoraBr,
        },
        userOverride: user,
      });

      return NextResponse.json({
        sucesso: true,
        itemHistorico: {
          id: `hist-${Date.now()}`,
          usuarioNome: user.name || user.email || 'Operador',
          descricao,
          detalhes: {
            formato,
            colunas: colunasBrutas,
            filtrosAplicados: filtros,
          },
          criadoEm: dataHoraBr,
        },
      });
    }

    return NextResponse.json({ sucesso: false, erro: 'Ação inválida.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { sucesso: false, erro: err?.message || 'Erro ao processar requisição do relatório.' },
      { status: 500 }
    );
  }
}
