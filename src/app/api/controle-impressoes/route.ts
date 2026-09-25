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
    const isExport = searchParams.get('export') === 'true';
    const sortBy = searchParams.get('sortBy') || 'ultimoRegistro';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const pageSize = isExport 
      ? 50000 
      : Math.min(100, Math.max(5, parseInt(searchParams.get('pageSize') || '10', 10)));

    // Filtro de data padrão: últimos 30 dias até hoje
    const now = new Date();
    const dataFimStr = dataFimParam || now.toISOString().split('T')[0];
    const defaultDataInicio = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const dataInicioStr = dataInicioParam || defaultDataInicio;

    // 1. Query Principal de Itens
    // 1. Query Principal de Itens apurada pelos andamentos reais (fiorix_impressoes_dados)
    const baseQuery = `
      WITH base_impressoes AS (
        SELECT 
          i.numero_prenotacao AS protocolo,
          MAX(i.natureza) AS natureza,
          MAX(i.tipo_prenotacao) AS tipo,
          MIN(i.data_entrada) AS data_entrada,
          MAX(NULLIF(i.numero_livro, '')) AS numero_livro,
          -- LIVRO: Impressão Definitiva do Ato no Livro (Tipo 63 no WebRI)
          MAX(CASE WHEN i.tipo_impressao = 'LIVRO' THEN i.data_impressao END) AS livro_data,
          MAX(CASE WHEN i.tipo_impressao = 'LIVRO' THEN NULLIF(i.operador, '') END) AS livro_responsavel,
          -- CERTIDÃO: Impressão de Certidão de Registro (Tipo 103 no WebRI)
          MAX(CASE WHEN i.tipo_impressao = 'CERTIDAO' THEN i.data_impressao END) AS certidao_data,
          MAX(CASE WHEN i.tipo_impressao = 'CERTIDAO' THEN NULLIF(i.operador, '') END) AS certidao_responsavel,
          MAX(CASE WHEN i.tipo_impressao = 'CERTIDAO' AND i.observacao ILIKE '%http%' THEN 
            SUBSTRING(i.observacao FROM 'https?://[^ ]+') 
          END) AS link_onr_especifico,
          MAX(i.seq_titulo) AS seq_titulo
        FROM public.fiorix_impressoes_dados i
        WHERE i.tenant_id = $1
        GROUP BY i.numero_prenotacao
      ),
      protocolos_demanda AS (
        -- Protocolos registrados ou com movimentação para compor a demanda e backlog
        SELECT 
          t.protocolo,
          MAX(t.natureza) AS natureza,
          MAX(t.tipo) AS tipo,
          COALESCE(MIN(t.data_entrada), MIN(m.data_apresentado)) AS data_entrada,
          MAX(NULLIF(t.numero_livro, '')) AS numero_livro,
          COALESCE(MAX(m.d_balcao_registrado), MIN(t.data_cadastro_tarefa), MIN(t.data_servico)) AS ultimo_registro,
          MAX(t.seq_titulo) AS seq_titulo
        FROM public.fiorix_tarefas_dados t
        LEFT JOIN public.fiorix_metas_dados m 
          ON m.protocolo = t.protocolo AND m.tenant_id = t.tenant_id
        WHERE t.tenant_id = $1
          AND (m.d_balcao_registrado IS NOT NULL OR t.tarefa ILIKE '%IMPRESS%' OR t.tarefa ILIKE '%PREPAR%')
        GROUP BY t.protocolo
      ),
      unificado AS (
        SELECT 
          COALESCE(i.protocolo, d.protocolo) AS protocolo,
          COALESCE(i.numero_livro, d.numero_livro) AS numero_livro,
          COALESCE(NULLIF(i.natureza, ''), NULLIF(d.natureza, ''), NULLIF(i.tipo, ''), NULLIF(d.tipo, ''), 'Escritura') AS tipo_natureza,
          COALESCE(i.data_entrada, d.data_entrada) AS data_entrada,
          COALESCE(d.ultimo_registro, i.data_entrada, i.livro_data, i.certidao_data) AS ultimo_registro,
          COALESCE(i.seq_titulo, d.seq_titulo, 1) AS seq_titulo,
          
          -- LIVRO: apurado estritamente por andamento real de tipo 63
          CASE 
            WHEN i.livro_data IS NOT NULL THEN 'REALIZADO'
            ELSE 'PENDENTE'
          END AS livro_status,
          i.livro_data,
          i.livro_responsavel,

          -- CERTIDÃO: apurado estritamente por andamento real de tipo 103
          CASE 
            WHEN i.certidao_data IS NOT NULL THEN 'REALIZADO'
            ELSE 'PENDENTE'
          END AS certidao_status,
          i.certidao_data,
          i.certidao_responsavel,

          -- Link ONR extraído da certidão ou portal oficial
          COALESCE(i.link_onr_especifico, 'https://registradores.onr.org.br') AS link_onr,

          -- Etapa Atual descritiva
          CASE 
            WHEN i.livro_data IS NOT NULL AND i.certidao_data IS NOT NULL THEN 'Concluído'
            WHEN i.livro_data IS NOT NULL THEN 'Certidão Pendente'
            WHEN i.certidao_data IS NOT NULL THEN 'Livro Pendente'
            ELSE 'Aguardando Impressão'
          END AS etapa_atual,

          -- Dias Pendente (se qualquer uma das impressões estiver pendente)
          CASE 
            WHEN (i.livro_data IS NULL OR i.certidao_data IS NULL) AND COALESCE(d.ultimo_registro, i.data_entrada) IS NOT NULL
            THEN GREATEST(0, EXTRACT(DAY FROM (NOW() - COALESCE(d.ultimo_registro, i.data_entrada)))::int)
            ELSE 0
          END AS dias_pendente
        FROM base_impressoes i
        FULL OUTER JOIN protocolos_demanda d ON d.protocolo = i.protocolo
        WHERE COALESCE(i.protocolo, d.protocolo) IS NOT NULL
      )
      SELECT * FROM unificado
      WHERE 1=1
        AND (
          ($4 != '' AND (
            CAST(protocolo AS text) LIKE '%' || $4 || '%' 
            OR LOWER(COALESCE(tipo_natureza, '')) LIKE '%' || $4 || '%' 
            OR LOWER(COALESCE(numero_livro, '')) LIKE '%' || $4 || '%'
            OR LOWER(COALESCE(etapa_atual, '')) LIKE '%' || $4 || '%'
          ))
          OR
          ($4 = '' AND ${
            visao === 'producao'
              ? tipoImpressao === 'certidao'
                ? `(certidao_data >= $2::date AND certidao_data <= ($3::date + INTERVAL '1 day'))`
                : tipoImpressao === 'livro'
                  ? `(livro_data >= $2::date AND livro_data <= ($3::date + INTERVAL '1 day'))`
                  : `(
                      (livro_data >= $2::date AND livro_data <= ($3::date + INTERVAL '1 day'))
                      OR
                      (certidao_data >= $2::date AND certidao_data <= ($3::date + INTERVAL '1 day'))
                    )`
              : `(ultimo_registro >= $2::date AND ultimo_registro <= ($3::date + INTERVAL '1 day'))`
          })
        )
      ${
        visao === 'producao'
          ? `ORDER BY COALESCE(certidao_data, livro_data, ultimo_registro) DESC`
          : `ORDER BY ultimo_registro DESC`
      };
    `;

    const allFilteredRows = await prisma.$queryRawUnsafe<any[]>(baseQuery, tenantId, dataInicioStr, dataFimStr, busca);

    const dtIni = new Date(dataInicioStr + 'T00:00:00');
    const dtFim = new Date(dataFimStr + 'T23:59:59');

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
        if (visao === 'producao' && status === 'todos') {
          const certValida = r.certidao_status === 'REALIZADO' && r.certidao_data && new Date(r.certidao_data) >= dtIni && new Date(r.certidao_data) <= dtFim;
          if (!certValida) return false;
        }
      } else if (tipoImpressao === 'livro') {
        if (status === 'pendente' && r.livro_status !== 'PENDENTE') return false;
        if (status === 'realizado' && r.livro_status !== 'REALIZADO') return false;
        if (visao === 'producao' && status === 'todos') {
          const livroValido = r.livro_status === 'REALIZADO' && r.livro_data && new Date(r.livro_data) >= dtIni && new Date(r.livro_data) <= dtFim;
          if (!livroValido) return false;
        }
      } else {
        if (status === 'pendente') {
          const hasPendente = r.certidao_status === 'PENDENTE' || r.livro_status === 'PENDENTE';
          if (!hasPendente) return false;
        } else if (status === 'realizado') {
          const hasRealizado = r.certidao_status === 'REALIZADO' || r.livro_status === 'REALIZADO';
          if (!hasRealizado) return false;
        }
      }

      return true;
    });

    const totalRegistros = matchingRows.length;

    // Ordenação dinâmica de matchingRows
    matchingRows.sort((a, b) => {
      let valA: any;
      let valB: any;

      switch (sortBy) {
        case 'protocolo':
          valA = Number(a.protocolo) || 0;
          valB = Number(b.protocolo) || 0;
          break;
        case 'numeroLivro':
          valA = String(a.numero_livro || '').toLowerCase();
          valB = String(b.numero_livro || '').toLowerCase();
          break;
        case 'tipoNatureza':
          valA = String(a.tipo_natureza || '').toLowerCase();
          valB = String(b.tipo_natureza || '').toLowerCase();
          break;
        case 'dataEntrada':
          valA = a.data_entrada ? new Date(a.data_entrada).getTime() : 0;
          valB = b.data_entrada ? new Date(b.data_entrada).getTime() : 0;
          break;
        case 'etapaAtual':
          valA = String(a.etapa_atual || '').toLowerCase();
          valB = String(b.etapa_atual || '').toLowerCase();
          break;
        case 'certidaoStatus':
          valA = String(a.certidao_status || '');
          valB = String(b.certidao_status || '');
          break;
        case 'livroStatus':
          valA = String(a.livro_status || '');
          valB = String(b.livro_status || '');
          break;
        case 'impressoPor':
          valA = String(a.responsavel_livro || a.responsavel_certidao || '').toLowerCase();
          valB = String(b.responsavel_livro || b.responsavel_certidao || '').toLowerCase();
          break;
        case 'diasPendente':
          valA = Number(a.dias_pendente) || 0;
          valB = Number(b.dias_pendente) || 0;
          break;
        case 'ultimoRegistro':
        default:
          valA = a.ultimo_registro ? new Date(a.ultimo_registro).getTime() : 0;
          valB = b.ultimo_registro ? new Date(b.ultimo_registro).getTime() : 0;
          break;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    const startIndex = (page - 1) * pageSize;
    const paginated = isExport ? matchingRows : matchingRows.slice(startIndex, startIndex + pageSize);

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
        linkOnr: r.link_onr || `https://registradores.onr.org.br`,
      };
    });

    // 3. Totais dos 2 Hero Cards (Calculados de acordo com a visão selecionada)
    let totalDemanda = allFilteredRows.length;
    let certidaoProduzidas = 0;
    let certidaoPendencias = 0;
    let livroProduzidas = 0;
    let livroPendencias = 0;

    if (visao === 'producao') {
      // Na visão produção, conta as impressões realizadas fisicamente no período selecionado
      livroProduzidas = allFilteredRows.filter(
        (r) => r.livro_status === 'REALIZADO' && r.livro_data && new Date(r.livro_data) >= dtIni && new Date(r.livro_data) <= dtFim
      ).length;
      certidaoProduzidas = allFilteredRows.filter(
        (r) => r.certidao_status === 'REALIZADO' && r.certidao_data && new Date(r.certidao_data) >= dtIni && new Date(r.certidao_data) <= dtFim
      ).length;
      livroPendencias = allFilteredRows.filter((r) => r.livro_status === 'PENDENTE').length;
      certidaoPendencias = allFilteredRows.filter((r) => r.certidao_status === 'PENDENTE').length;
    } else {
      // Na visão demanda, conta com base na data do último registro do período
      livroProduzidas = allFilteredRows.filter((r) => r.livro_status === 'REALIZADO').length;
      certidaoProduzidas = allFilteredRows.filter((r) => r.certidao_status === 'REALIZADO').length;
      livroPendencias = allFilteredRows.filter((r) => r.livro_status === 'PENDENTE').length;
      certidaoPendencias = allFilteredRows.filter((r) => r.certidao_status === 'PENDENTE').length;
    }

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
      const dataRef = visao === 'producao' ? (r.livro_data || r.certidao_data || r.ultimo_registro) : r.ultimo_registro;
      if (dataRef) {
        const d = new Date(dataRef);
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
        const livroValido = visao === 'producao'
          ? (r.livro_data && new Date(r.livro_data) >= dtIni && new Date(r.livro_data) <= dtFim)
          : true;

        if (livroValido) {
          const nome = r.livro_responsavel.trim();
          const curr = operadoresMap.get(nome) || { totalLivro: 0, totalCertidao: 0 };
          curr.totalLivro++;
          operadoresMap.set(nome, curr);
        }
      }
      if (r.certidao_status === 'REALIZADO' && r.certidao_responsavel) {
        const certidaoValida = visao === 'producao'
          ? (r.certidao_data && new Date(r.certidao_data) >= dtIni && new Date(r.certidao_data) <= dtFim)
          : true;

        if (certidaoValida) {
          const nome = r.certidao_responsavel.trim();
          const curr = operadoresMap.get(nome) || { totalLivro: 0, totalCertidao: 0 };
          curr.totalCertidao++;
          operadoresMap.set(nome, curr);
        }
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
