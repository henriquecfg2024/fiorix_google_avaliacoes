import { prisma } from '@/lib/prisma';
import { MOCK_COLABORADORES_45 } from '@/components/rh/mockColaboradores45';

export interface EscalaItem {
  id: string;
  usuarioId: string;
  ano: number;
  nome: string;
  email?: string;
  setor: string;
  cargo?: string;
  p1Inicio?: string;
  p1Fim?: string;
  p1Dias: number;
  p2Inicio?: string;
  p2Fim?: string;
  p2Dias: number;
  p3Inicio?: string;
  p3Fim?: string;
  p3Dias: number;
  totalDias: number;
  status: 'programado' | 'conflito' | 'pendente';
  observacao?: string;
  historico?: Array<{
    data: string;
    de: string;
    para: string;
    por: string;
    motivo: string;
  }>;
}

export interface PublicacaoStatus {
  ano: number;
  status: 'RASCUNHO' | 'PUBLICADA';
  publicadoPor?: string | null;
  publicadoEm?: string | null;
  retiradoEm?: string | null;
}

let tablesEnsured = false;

export async function ensureFeriasTablesExist() {
  if (tablesEnsured) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.fiorix_ferias_publicacao (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        ano INT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'RASCUNHO',
        publicado_por VARCHAR(64),
        publicado_em TIMESTAMP WITH TIME ZONE,
        retirado_em TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_ferias_pub_tenant_ano UNIQUE (tenant_id, ano)
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.fiorix_ferias_escala (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        usuario_id VARCHAR(64) NOT NULL,
        ano INT NOT NULL,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        setor VARCHAR(100) NOT NULL DEFAULT 'Geral',
        cargo VARCHAR(100),
        p1_inicio VARCHAR(32),
        p1_fim VARCHAR(32),
        p1_dias INT DEFAULT 0,
        p2_inicio VARCHAR(32),
        p2_fim VARCHAR(32),
        p2_dias INT DEFAULT 0,
        p3_inicio VARCHAR(32),
        p3_fim VARCHAR(32),
        p3_dias INT DEFAULT 0,
        total_dias INT DEFAULT 0,
        status VARCHAR(32) NOT NULL DEFAULT 'programado',
        observacao TEXT,
        historico JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_ferias_escala_user_ano UNIQUE (tenant_id, usuario_id, ano)
      );
    `);

    tablesEnsured = true;
  } catch (err) {
    console.warn('Erro ao inicializar tabelas de férias:', err);
  }
}

export async function getPublicacaoStatus(tenantId: string, ano: number): Promise<PublicacaoStatus> {
  await ensureFeriasTablesExist();
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT ano, status, publicado_por, publicado_em, retirado_em 
       FROM public.fiorix_ferias_publicacao 
       WHERE tenant_id = $1 AND ano = $2 
       LIMIT 1`,
      tenantId,
      ano
    );

    if (rows && rows.length > 0) {
      const r = rows[0];
      return {
        ano: r.ano,
        status: (r.status as 'RASCUNHO' | 'PUBLICADA') || 'RASCUNHO',
        publicadoPor: r.publicado_por,
        publicadoEm: r.publicado_em ? new Date(r.publicado_em).toISOString() : null,
        retiradoEm: r.retirado_em ? new Date(r.retirado_em).toISOString() : null,
      };
    }
  } catch (err) {
    console.warn('Erro ao consultar fiorix_ferias_publicacao:', err);
  }

  return {
    ano,
    status: 'RASCUNHO',
    publicadoPor: null,
    publicadoEm: null,
    retiradoEm: null,
  };
}

export async function setPublicacaoStatus(
  tenantId: string,
  ano: number,
  status: 'RASCUNHO' | 'PUBLICADA',
  userId: string
): Promise<PublicacaoStatus> {
  await ensureFeriasTablesExist();
  const id = `pub_${tenantId}_${ano}`;
  const now = new Date();

  if (status === 'PUBLICADA') {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_ferias_publicacao (id, tenant_id, ano, status, publicado_por, publicado_em, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $6)
       ON CONFLICT (tenant_id, ano) DO UPDATE 
       SET status = EXCLUDED.status, publicado_por = EXCLUDED.publicado_por, publicado_em = EXCLUDED.publicado_em, updated_at = EXCLUDED.updated_at`,
      id,
      tenantId,
      ano,
      status,
      userId,
      now
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_ferias_publicacao (id, tenant_id, ano, status, retirado_em, updated_at)
       VALUES ($1, $2, $3, $4, $5, $5)
       ON CONFLICT (tenant_id, ano) DO UPDATE 
       SET status = EXCLUDED.status, retirado_em = EXCLUDED.retirado_em, updated_at = EXCLUDED.updated_at`,
      id,
      tenantId,
      ano,
      status,
      now
    );
  }

  return getPublicacaoStatus(tenantId, ano);
}

export async function getEscalaAnual(
  tenantId: string,
  ano: number,
  userId: string,
  userRole: string
): Promise<{
  publicacao: PublicacaoStatus;
  colaboradores: EscalaItem[];
}> {
  await ensureFeriasTablesExist();
  const publicacao = await getPublicacaoStatus(tenantId, ano);

  const isManager = ['ADMIN', 'RH', 'MASTER', 'GESTOR'].includes(userRole);
  const isSubstituto = userRole === 'SUBSTITUTO';
  const canViewFullScale = isManager || isSubstituto;

  // Se o colaborador comum consulta e a escala está em rascunho, bloqueia o retorno
  if (!canViewFullScale && publicacao.status !== 'PUBLICADA') {
    return {
      publicacao,
      colaboradores: [],
    };
  }

  // Busca do banco com isolamento de dados por perfil
  let items: EscalaItem[] = [];
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id, usuario_id, ano, nome, email, setor, cargo, 
              p1_inicio, p1_fim, p1_dias, 
              p2_inicio, p2_fim, p2_dias, 
              p3_inicio, p3_fim, p3_dias, 
              total_dias, status, observacao, historico 
       FROM public.fiorix_ferias_escala 
       WHERE tenant_id = $1 AND ano = $2 
       ${!canViewFullScale ? 'AND usuario_id = $3' : ''}
       ORDER BY CASE 
         WHEN nome = 'Mariana Oliveira' THEN 1
         WHEN nome = 'Carlos Eduardo Silva' THEN 2
         WHEN nome = 'Fernanda Costa' THEN 3
         WHEN nome = 'Henrique Gama' THEN 4
         WHEN nome = 'Luciana Martins' THEN 5
         ELSE 6 END, nome ASC`,
      ...(!canViewFullScale ? [tenantId, ano, userId] : [tenantId, ano])
    );

    if (rows && rows.length > 0) {
      items = rows.map((r) => {
        let p1Inicio = r.p1_inicio;
        let p1Fim = r.p1_fim;
        let p1Dias = Number(r.p1_dias || 0);
        let totalDias = Number(r.total_dias || 0);
        let status = (r.status as 'programado' | 'conflito' | 'pendente') || 'programado';
        const historico = typeof r.historico === 'string' ? JSON.parse(r.historico) : r.historico || [];

        // Defesa em profundidade: se p1Inicio estiver vazio mas o histórico possuir agendamento cadastrado
        if ((!p1Inicio || p1Inicio === '') && Array.isArray(historico) && historico.length > 0) {
          const lastEv = historico[historico.length - 1];
          const match = lastEv?.para?.match(/(\d{4}-\d{2}-\d{2})\s+a\s+(\d{4}-\d{2}-\d{2})\s*\((\d+)d\)/);
          if (match) {
            p1Inicio = match[1];
            p1Fim = match[2];
            p1Dias = parseInt(match[3], 10);
            totalDias = p1Dias;
            if (status === 'pendente') status = 'programado';
          }
        }

        return {
          id: r.id,
          usuarioId: r.usuario_id,
          ano: r.ano,
          nome: r.nome,
          email: r.email,
          setor: r.setor || 'Geral',
          cargo: r.cargo,
          p1Inicio,
          p1Fim,
          p1Dias,
          p2Inicio: r.p2_inicio,
          p2Fim: r.p2_fim,
          p2Dias: Number(r.p2_dias || 0),
          p3Inicio: r.p3_inicio,
          p3Fim: r.p3_fim,
          p3Dias: Number(r.p3_dias || 0),
          totalDias,
          status,
          observacao: r.observacao,
          historico,
        };
      });
    } else if (canViewFullScale) {
      // Se não há registros para esse ano no banco, sincroniza a partir dos colaboradores do banco
      items = await seedInitialEscalaFromUsers(tenantId, ano);
    }
  } catch (err) {
    console.warn('Erro ao carregar fiorix_ferias_escala:', err);
    if (canViewFullScale) {
      items = await seedInitialEscalaFromUsers(tenantId, ano);
    }
  }

  // Defesa em profundidade: se for colaborador comum, garante estritamente apenas as próprias férias
  if (!canViewFullScale) {
    items = items.filter((item) => item.usuarioId === userId);
  }

  return {
    publicacao,
    colaboradores: items,
  };
}

/**
 * Inicializa a escala anual a partir dos usuários cadastrados no banco
 */
async function seedInitialEscalaFromUsers(tenantId: string, ano: number): Promise<EscalaItem[]> {
  try {
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    if (users.length === 0) return [];

    const mockMap = new Map<string, any>();
    for (const m of MOCK_COLABORADORES_45) {
      mockMap.set(m.nome.toLowerCase().trim(), m);
    }

    const items: EscalaItem[] = [];

    // Datas padrão para os primeiros colaboradores para refletir o preview
    // (42 programados, 2 conflitos a revisar, restante pendente)
    let programadosCount = 0;
    let conflitosCount = 0;

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const nome = u.name || `Colaborador ${i + 1}`;
      const mockData = mockMap.get(nome.toLowerCase().trim());

      let setor = mockData?.setor || 'Atendimento';
      let cargo = mockData?.cargo || 'Escrevente';
      let status: 'programado' | 'conflito' | 'pendente' = 'pendente';
      let p1Inicio = '';
      let p1Fim = '';
      let p1Dias = 0;
      let p2Inicio = '';
      let p2Fim = '';
      let p2Dias = 0;

      if (mockData && (mockData.status === 'planejado' || mockData.status === 'publicado')) {
        status = 'programado';
        p1Inicio = mockData.p1Inicio || `${ano}-01-10`;
        p1Fim = mockData.p1Fim || `${ano}-01-29`;
        p1Dias = mockData.p1Dias || 20;
        p2Inicio = mockData.p2Inicio || '';
        p2Fim = mockData.p2Fim || '';
        p2Dias = mockData.p2Dias || 0;
        programadosCount++;
      } else if (mockData?.status === 'conflito' || (conflitosCount < 2 && i < 5)) {
        status = 'conflito';
        p1Inicio = `${ano}-11-01`;
        p1Fim = `${ano}-11-20`;
        p1Dias = 20;
        conflitosCount++;
      } else if (programadosCount < 42) {
        status = 'programado';
        const mesPadrao = ((i % 12) + 1).toString().padStart(2, '0');
        p1Inicio = `${ano}-${mesPadrao}-10`;
        p1Fim = `${ano}-${mesPadrao}-24`;
        p1Dias = 15;
        programadosCount++;
      }

      const totalDias = p1Dias + p2Dias;
      const id = `esc_${tenantId}_${u.id}_${ano}`;

      const item: EscalaItem = {
        id,
        usuarioId: u.id,
        ano,
        nome,
        email: u.email,
        setor,
        cargo,
        p1Inicio,
        p1Fim,
        p1Dias,
        p2Inicio,
        p2Fim,
        p2Dias,
        p3Inicio: '',
        p3Fim: '',
        p3Dias: 0,
        totalDias,
        status,
        observacao: mockData?.observacao || undefined,
        historico: [
          {
            data: new Date().toLocaleDateString('pt-BR'),
            de: 'N/A',
            para: `${p1Inicio} a ${p1Fim} (${totalDias}d)`,
            por: 'Sistema FIORIX (RH)',
            motivo: `Programação inicial da escala anual ${ano}`,
          },
        ],
      };

      items.push(item);

      // Persiste no banco de dados
      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO public.fiorix_ferias_escala (
            id, tenant_id, usuario_id, ano, nome, email, setor, cargo,
            p1_inicio, p1_fim, p1_dias, p2_inicio, p2_fim, p2_dias, p3_inicio, p3_fim, p3_dias,
            total_dias, status, observacao, historico, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21::jsonb, NOW()
          ) ON CONFLICT (tenant_id, usuario_id, ano) DO NOTHING`,
          id,
          tenantId,
          u.id,
          ano,
          nome,
          u.email,
          setor,
          cargo,
          p1Inicio,
          p1Fim,
          p1Dias,
          p2Inicio,
          p2Fim,
          p2Dias,
          '',
          '',
          0,
          totalDias,
          status,
          item.observacao || null,
          JSON.stringify(item.historico)
        );
      } catch (insertErr) {
        console.warn('Erro ao inserir item de escala inicial:', insertErr);
      }
    }

    return items;
  } catch (err) {
    console.error('Erro ao semear escala inicial:', err);
    return [];
  }
}

export async function salvarOuAtualizarEscala(
  tenantId: string,
  dados: {
    usuarioId: string;
    ano: number;
    nome: string;
    setor: string;
    cargo?: string;
    p1Inicio?: string;
    p1Fim?: string;
    p1Dias: number;
    p2Inicio?: string;
    p2Fim?: string;
    p2Dias?: number;
    p3Inicio?: string;
    p3Fim?: string;
    p3Dias?: number;
    status: 'programado' | 'conflito' | 'pendente';
    observacao?: string;
  },
  operadorNome: string
): Promise<EscalaItem> {
  await ensureFeriasTablesExist();
  const id = `esc_${tenantId}_${dados.usuarioId}_${dados.ano}`;
  const totalDias = dados.p1Dias + (dados.p2Dias || 0) + (dados.p3Dias || 0);

  // Busca histórico existente
  let historicoExistente: any[] = [];
  try {
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT historico, p1_inicio, p1_fim, total_dias FROM public.fiorix_ferias_escala WHERE id = $1`,
      id
    );
    if (existing && existing.length > 0) {
      const e = existing[0];
      historicoExistente = typeof e.historico === 'string' ? JSON.parse(e.historico) : e.historico || [];
      historicoExistente.push({
        data: new Date().toLocaleString('pt-BR'),
        de: `${e.p1_inicio || 'N/A'} (${e.total_dias || 0}d)`,
        para: `${dados.p1Inicio || 'N/A'} (${totalDias}d)`,
        por: operadorNome,
        motivo: 'Atualização de programação de férias',
      });
    } else {
      historicoExistente = [
        {
          data: new Date().toLocaleString('pt-BR'),
          de: 'N/A',
          para: `${dados.p1Inicio} (${totalDias}d)`,
          por: operadorNome,
          motivo: 'Inclusão de programação de férias',
        },
      ];
    }
  } catch {}

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.fiorix_ferias_escala (
      id, tenant_id, usuario_id, ano, nome, setor, cargo,
      p1_inicio, p1_fim, p1_dias, p2_inicio, p2_fim, p2_dias, p3_inicio, p3_fim, p3_dias,
      total_dias, status, observacao, historico, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13, $14, $15, $16,
      $17, $18, $19, $20::jsonb, NOW()
    ) ON CONFLICT (tenant_id, usuario_id, ano) DO UPDATE 
    SET nome = EXCLUDED.nome,
        setor = EXCLUDED.setor,
        cargo = EXCLUDED.cargo,
        p1_inicio = EXCLUDED.p1_inicio,
        p1_fim = EXCLUDED.p1_fim,
        p1_dias = EXCLUDED.p1_dias,
        p2_inicio = EXCLUDED.p2_inicio,
        p2_fim = EXCLUDED.p2_fim,
        p2_dias = EXCLUDED.p2_dias,
        p3_inicio = EXCLUDED.p3_inicio,
        p3_fim = EXCLUDED.p3_fim,
        p3_dias = EXCLUDED.p3_dias,
        total_dias = EXCLUDED.total_dias,
        status = EXCLUDED.status,
        observacao = EXCLUDED.observacao,
        historico = EXCLUDED.historico,
        updated_at = NOW()`,
    id,
    tenantId,
    dados.usuarioId,
    dados.ano,
    dados.nome,
    dados.setor,
    dados.cargo || null,
    dados.p1Inicio || null,
    dados.p1Fim || null,
    dados.p1Dias,
    dados.p2Inicio || null,
    dados.p2Fim || null,
    dados.p2Dias || 0,
    dados.p3Inicio || null,
    dados.p3Fim || null,
    dados.p3Dias || 0,
    totalDias,
    dados.status,
    dados.observacao || null,
    JSON.stringify(historicoExistente)
  );

  return {
    id,
    usuarioId: dados.usuarioId,
    ano: dados.ano,
    nome: dados.nome,
    setor: dados.setor,
    cargo: dados.cargo,
    p1Inicio: dados.p1Inicio,
    p1Fim: dados.p1Fim,
    p1Dias: dados.p1Dias,
    p2Inicio: dados.p2Inicio,
    p2Fim: dados.p2Fim,
    p2Dias: dados.p2Dias || 0,
    p3Inicio: dados.p3Inicio,
    p3Fim: dados.p3Fim,
    p3Dias: dados.p3Dias || 0,
    totalDias,
    status: dados.status,
    observacao: dados.observacao,
    historico: historicoExistente,
  };
}

export async function removerEscala(
  tenantId: string,
  usuarioId: string,
  ano: number
): Promise<boolean> {
  await ensureFeriasTablesExist();
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.fiorix_ferias_escala WHERE tenant_id = $1 AND usuario_id = $2 AND ano = $3`,
      tenantId,
      usuarioId,
      ano
    );
    return true;
  } catch (err) {
    console.error('Erro ao remover escala:', err);
    return false;
  }
}
