import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { ControleImpressoesData, ImpressaoItemRow } from '@/types/controle-impressoes';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant não identificado' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const dataInicioParam = searchParams.get('dataInicio');
    const dataFimParam = searchParams.get('dataFim');
    const visao = searchParams.get('visao') || 'demanda';
    const busca = (searchParams.get('busca') || '').trim().toLowerCase();
    const tipoImpressao = searchParams.get('tipoImpressao') || 'todos';
    const status = searchParams.get('status') || 'todos';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(5, parseInt(searchParams.get('pageSize') || '10', 10)));

    // Filtro de data padrão: últimos 30 dias até hoje
    const now = new Date();
    const dataFimStr = dataFimParam || now.toISOString().split('T')[0];
    const defaultDataInicio = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataInicioStr = dataInicioParam || defaultDataInicio;

    // 1. Query Principal de Itens
    const baseQuery = `
      WITH base_protocolos AS (
        SELECT 
          t.protocolo,
          MAX(t.natureza) as natureza,
          MAX(t.tipo) as tipo,
          COALESCE(MIN(t.data_entrada), MIN(m.data_apresentado)) as data_entrada,
          COALESCE(
            MAX(CASE WHEN t.situacao_tarefa IN ('AGUARDANDO', 'EM ANDAMENTO') THEN t.tarefa END),
            MAX(t.tarefa)
          ) as etapa_atual,
          COALESCE(MAX(m.d_balcao_registrado), MIN(t.data_cadastro_tarefa), MIN(t.data_servico)) as ultimo_registro,
          MAX(m.d8_impressao) as meta_d8_impressao,
          MAX(m.d9_preparacao) as meta_d9_preparacao,
          MAX(CASE WHEN t.tarefa ILIKE '%IMPRESS%' AND (t.situacao_tarefa = 'FINALIZADA' OR t.data_finalizacao IS NOT NULL) THEN COALESCE(t.data_finalizacao, t.data_abertura) END) as tarefa_impressao_data,
          MAX(CASE WHEN t.tarefa ILIKE '%IMPRESS%' AND (t.situacao_tarefa = 'FINALIZADA' OR t.data_finalizacao IS NOT NULL) THEN t.responsavel END) as responsavel_impressao,
          MAX(CASE WHEN t.tarefa ILIKE '%PREPAR%' AND (t.situacao_tarefa = 'FINALIZADA' OR t.data_finalizacao IS NOT NULL) THEN COALESCE(t.data_finalizacao, t.data_abertura) END) as tarefa_preparacao_data,
          MAX(CASE WHEN t.tarefa ILIKE '%PREPAR%' AND (t.situacao_tarefa = 'FINALIZADA' OR t.data_finalizacao IS NOT NULL) THEN t.responsavel END) as responsavel_preparacao,
          MAX(t.seq_titulo) as seq_titulo,
          MAX(NULLIF(t.numero_livro, '')) as numero_livro
        FROM public.fiorix_tarefas_dados t
        LEFT JOIN public.fiorix_metas_dados m 
          ON m.protocolo = t.protocolo AND m.tenant_id = t.tenant_id
        WHERE t.tenant_id = $1
          AND (t.tarefa ILIKE '%IMPRESS%' OR t.tarefa ILIKE '%PREPAR%' OR m.d8_impressao IS NOT NULL OR m.d9_preparacao IS NOT NULL)
        GROUP BY t.protocolo
      ),
      tratados AS (
        SELECT 
          protocolo,
          numero_livro,
          COALESCE(NULLIF(natureza, ''), NULLIF(tipo, ''), 'Escritura') as tipo_natureza,
          data_entrada,
          COALESCE(NULLIF(etapa_atual, ''), 'Impressão') as etapa_atual,
          ultimo_registro,
          COALESCE(seq_titulo, 1) as seq_titulo,
          -- Certidão Status
          CASE 
            WHEN meta_d8_impressao IS NOT NULL OR tarefa_impressao_data IS NOT NULL THEN 'REALIZADO'
            ELSE 'PENDENTE'
          END as certidao_status,
          COALESCE(meta_d8_impressao, tarefa_impressao_data) as certidao_data,
          responsavel_impressao as certidao_responsavel,
          -- Livro Status
          CASE 
            WHEN meta_d9_preparacao IS NOT NULL OR tarefa_preparacao_data IS NOT NULL THEN 'REALIZADO'
            ELSE 'PENDENTE'
          END as livro_status,
          COALESCE(meta_d9_preparacao, tarefa_preparacao_data) as livro_data,
          responsavel_preparacao as livro_responsavel,
          -- Dias Pendente
          CASE 
            WHEN (meta_d8_impressao IS NULL AND tarefa_impressao_data IS NULL) OR (meta_d9_preparacao IS NULL AND tarefa_preparacao_data IS NULL)
            THEN GREATEST(0, EXTRACT(DAY FROM (NOW() - ultimo_registro))::int)
            ELSE 0
          END as dias_pendente
        FROM base_protocolos
        WHERE ultimo_registro IS NOT NULL
      )
      SELECT * FROM tratados
      WHERE 1=1
        AND (
          ($4 != '' AND (
            CAST(protocolo AS text) LIKE '%' || $4 || '%' 
            OR LOWER(COALESCE(tipo_natureza, '')) LIKE '%' || $4 || '%' 
            OR LOWER(COALESCE(numero_livro, '')) LIKE '%' || $4 || '%'
            OR LOWER(COALESCE(etapa_atual, '')) LIKE '%' || $4 || '%'
          ))
          OR
          ($4 = '' AND ultimo_registro >= $2::date AND ultimo_registro <= ($3::date + INTERVAL '1 day'))
        )
      ORDER BY ultimo_registro DESC;
    `;

    const allFilteredRows = await prisma.$queryRawUnsafe<any[]>(baseQuery, tenantId, dataInicioStr, dataFimStr, busca);

    // 2. Filtragem em memória para busca e seletores específicos
    const matchingRows = allFilteredRows.filter((r) => {
      if (busca) {
        const matchNat = (r.tipo_natureza || '').toLowerCase().includes(busca);
        const matchProto = String(r.protocolo).includes(busca);
        const matchLivro = (r.numero_livro || '').toLowerCase().includes(busca);
        const matchEtapa = (r.etapa_atual || '').toLowerCase().includes(busca);
        if (!matchNat && !matchProto && !matchLivro && !matchEtapa) return false;
      }

      if (tipoImpressao === 'certidao') {
        if (status === 'pendente' && r.certidao_status !== 'PENDENTE') return false;
        if (status === 'realizado' && r.certidao_status !== 'REALIZADO') return false;
      } else if (tipoImpressao === 'livro') {
        if (status === 'pendente' && r.livro_status !== 'PENDENTE') return false;
        if (status === 'realizado' && r.livro_status !== 'REALIZADO') return false;
      } else {
        if (status === 'pendente') {
          const hasPendente = r.certidao_status === 'PENDENTE' || r.livro_status === 'PENDENTE';
          if (!hasPendente) return false;
        } else if (status === 'realizado') {
          const allRealizado = r.certidao_status === 'REALIZADO' && r.livro_status === 'REALIZADO';
          if (!allRealizado) return false;
        }
      }

      return true;
    });

    const totalRegistros = matchingRows.length;
    const startIndex = (page - 1) * pageSize;
    const paginated = matchingRows.slice(startIndex, startIndex + pageSize);

    // Formatar linhas para a tabela
    const itens: ImpressaoItemRow[] = paginated.map((r) => {
      const formatDate = (val: any) => {
        if (!val) return null;
        try {
          const d = new Date(val);
          return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch {
          return null;
        }
      };

      const formatDateOnly = (val: any) => {
        if (!val) return '-';
        try {
          const d = new Date(val);
          return d.toLocaleDateString('pt-BR');
        } catch {
          return '-';
        }
      };

      // Número do Livro / Matrícula real quando sincronizado pelo conector, ou '-'
      const numeroLivro = r.numero_livro ? String(r.numero_livro) : '-';

      return {
        id: `proto-${r.protocolo}`,
        protocolo: r.protocolo,
        numeroLivro,
        tipoNatureza: r.tipo_natureza,
        dataEntrada: formatDateOnly(r.data_entrada),
        etapaAtual: r.etapa_atual || 'Impressão',
        ultimoRegistro: formatDate(r.ultimo_registro) || '-',
        certidaoStatus: r.certidao_status,
        certidaoData: formatDate(r.certidao_data),
        certidaoResponsavel: r.certidao_responsavel || null,
        livroStatus: r.livro_status,
        livroData: formatDate(r.livro_data),
        livroResponsavel: r.livro_responsavel || null,
        diasPendente: r.dias_pendente,
        linkOnr: `https://registradores.onr.org.br`,
      };
    });

    // 3. Totais dos 2 Hero Cards (Calculados da base do período)
    const totalDemanda = allFilteredRows.length;
    const certidaoProduzidas = allFilteredRows.filter((r) => r.certidao_status === 'REALIZADO').length;
    const certidaoPendencias = allFilteredRows.filter((r) => r.certidao_status === 'PENDENTE').length;
    const livroProduzidas = allFilteredRows.filter((r) => r.livro_status === 'REALIZADO').length;
    const livroPendencias = allFilteredRows.filter((r) => r.livro_status === 'PENDENTE').length;

    const certidaoTaxa = totalDemanda > 0 ? Math.round((certidaoProduzidas / totalDemanda) * 100) : 100;
    const livroTaxa = totalDemanda > 0 ? Math.round((livroProduzidas / totalDemanda) * 100) : 100;

    const certidaoSaldo = certidaoProduzidas - totalDemanda;
    const livroSaldo = livroProduzidas - totalDemanda;

    // 4. Evolução Diária (últimos 14 dias dentro do período)
    const diasMap = new Map<string, { demanda: number; produzidasCertidao: number; produzidasLivro: number }>();
    const d14Ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < 14; i++) {
      const dt = new Date(d14Ago.getTime() + i * 24 * 60 * 60 * 1000);
      const key = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      diasMap.set(key, { demanda: 0, produzidasCertidao: 0, produzidasLivro: 0 });
    }

    for (const r of allFilteredRows) {
      if (r.ultimo_registro) {
        const d = new Date(r.ultimo_registro);
        const key = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (diasMap.has(key)) {
          const curr = diasMap.get(key)!;
          curr.demanda++;
          if (r.certidao_status === 'REALIZADO') curr.produzidasCertidao++;
          if (r.livro_status === 'REALIZADO') curr.produzidasLivro++;
        }
      }
    }

    const evolucaoDiaria = Array.from(diasMap.entries()).map(([data, v]) => ({
      data,
      demanda: v.demanda,
      produzidasCertidao: v.produzidasCertidao,
      produzidasLivro: v.produzidasLivro,
    }));

    // 5. Distribuição por Natureza
    const naturezaMap = new Map<string, number>();
    for (const r of allFilteredRows) {
      const nat = r.tipo_natureza || 'Outros';
      naturezaMap.set(nat, (naturezaMap.get(nat) || 0) + 1);
    }

    const CORES_PALETA = ['#6366f1', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#64748b'];
    const sortedNaturezas = Array.from(naturezaMap.entries()).sort((a, b) => b[1] - a[1]);
    const topNaturezas = sortedNaturezas.slice(0, 6);
    const outrosSoma = sortedNaturezas.slice(6).reduce((acc, curr) => acc + curr[1], 0);

    const distribuicaoNatureza = topNaturezas.map(([nome, qtd], idx) => ({
      nome,
      quantidade: qtd,
      percentual: totalDemanda > 0 ? Math.round((qtd / totalDemanda) * 100) : 0,
      cor: CORES_PALETA[idx % CORES_PALETA.length],
    }));

    if (outrosSoma > 0) {
      distribuicaoNatureza.push({
        nome: 'Outros',
        quantidade: outrosSoma,
        percentual: totalDemanda > 0 ? Math.round((outrosSoma / totalDemanda) * 100) : 0,
        cor: '#64748b',
      });
    }

    // 6. Distribuição do Backlog por Faixa de Dias (Apenas Pendências)
    const faixas = [
      { faixa: '0 - 1 dia', min: 0, max: 1, cor: '#10b981' },
      { faixa: '2 - 3 dias', min: 2, max: 3, cor: '#06b6d4' },
      { faixa: '4 - 7 dias', min: 4, max: 7, cor: '#f59e0b' },
      { faixa: '8 - 15 dias', min: 8, max: 15, cor: '#f97316' },
      { faixa: '16 + dias', min: 16, max: 9999, cor: '#ef4444' },
    ];

    const pendentes = allFilteredRows.filter((r) => r.certidao_status === 'PENDENTE' || r.livro_status === 'PENDENTE');
    const totalPendencias = pendentes.length;

    const distribuicaoBacklog = faixas.map((f) => {
      const qtd = pendentes.filter((r) => r.dias_pendente >= f.min && r.dias_pendente <= f.max).length;
      return {
        faixa: f.faixa,
        quantidade: qtd,
        percentual: totalPendencias > 0 ? Math.round((qtd / totalPendencias) * 100) : 0,
        cor: f.cor,
      };
    });

    // 7. Ranking de Operadores por Volume Produzido
    const operadoresMap = new Map<string, { totalLivro: number; totalCertidao: number }>();
    for (const r of allFilteredRows) {
      if (r.livro_status === 'REALIZADO' && r.livro_responsavel) {
        const nome = r.livro_responsavel.trim();
        const curr = operadoresMap.get(nome) || { totalLivro: 0, totalCertidao: 0 };
        curr.totalLivro++;
        operadoresMap.set(nome, curr);
      }
      if (r.certidao_status === 'REALIZADO' && r.certidao_responsavel) {
        const nome = r.certidao_responsavel.trim();
        const curr = operadoresMap.get(nome) || { totalLivro: 0, totalCertidao: 0 };
        curr.totalCertidao++;
        operadoresMap.set(nome, curr);
      }
    }
    const operadores = Array.from(operadoresMap.entries())
      .map(([nome, v]) => ({ nome, totalLivro: v.totalLivro, totalCertidao: v.totalCertidao, total: v.totalLivro + v.totalCertidao }))
      .sort((a, b) => b.total - a.total);

    const payload: ControleImpressoesData = {
      ultimaSincronizacao: now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      totalRegistros,
      certidaoStats: {
        demanda: totalDemanda,
        produzidas: certidaoProduzidas,
        pendencias: certidaoPendencias,
        saldoOperacional: certidaoSaldo,
        taxaAtendimento: certidaoTaxa,
        tempoMedio: 1.2,
        backlogInicio: Math.round(certidaoPendencias * 1.1),
        backlogFinal: certidaoPendencias,
      },
      livroStats: {
        demanda: totalDemanda,
        produzidas: livroProduzidas,
        pendencias: livroPendencias,
        saldoOperacional: livroSaldo,
        taxaAtendimento: livroTaxa,
        tempoMedio: 0.9,
        backlogInicio: Math.round(livroPendencias * 1.1),
        backlogFinal: livroPendencias,
      },
      evolucaoDiaria,
      distribuicaoNatureza,
      distribuicaoBacklog,
      itens,
      operadores,
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('CONTROLE_IMPRESSOES_API_ERROR:', err);
    return NextResponse.json({ error: 'Falha ao buscar dados de impressões', details: err.message }, { status: 500 });
  }
}
