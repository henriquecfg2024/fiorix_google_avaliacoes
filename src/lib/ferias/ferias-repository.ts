import { prisma } from '@/lib/prisma';
import { MOCK_COLABORADORES_45 } from '@/components/rh/mockColaboradores45';
import {
  limparCpfReal,
  formatarCpfCompleto,
  mascararCpfLgpd,
  normalizarDataIso,
} from '@/lib/ferias/idade-calculator';


function normalizarNomeColaborador(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOPWORDS_NOME = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/**
 * Compara nomes entre User (FIORIX) e tblColaborador (GESTOR), lidando com abreviações
 * de nome do meio ("Ander Gleiber de O Ribeiro" <-> "Ander Gleiber de Oliveira Ribeiro"),
 * nomes curtos ("Claudio Donizetti" <-> "Claudio Donizetti Ferreira da Silva") e
 * pequenas variações gráficas ("Caniinde" <-> "Caninde").
 */
export function nomesColaboradorCompativeis(a: string, b: string): boolean {
  const na = normalizarNomeColaborador(a);
  const nb = normalizarNomeColaborador(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  // Deduplica letras repetidas (ex: caniinde -> caninde, cioconi -> ciconi parcial)
  const squash = (s: string) => s.replace(/([a-z])\1+/g, '$1');
  if (squash(na) === squash(nb)) return true;

  const tokA = na.split(' ').filter((t) => t && !STOPWORDS_NOME.has(t));
  const tokB = nb.split(' ').filter((t) => t && !STOPWORDS_NOME.has(t));
  if (tokA.length < 2 || tokB.length < 2) return false;

  // Primeiro nome precisa coincidir
  if (squash(tokA[0]) !== squash(tokB[0])) return false;

  // Prefixo de pelo menos 2 nomes significativos ("Claudio Donizetti", "Guilherme Mancio")
  const minLen = Math.min(tokA.length, tokB.length);
  let prefixMatches = 0;
  for (let i = 0; i < minLen; i++) {
    if (squash(tokA[i]) === squash(tokB[i])) prefixMatches++;
    else break;
  }
  if (prefixMatches >= 2 && prefixMatches === minLen) return true;

  // Primeiro + último sobrenome iguais e segundo token compatível (inicial ou igual)
  const lastA = squash(tokA[tokA.length - 1]);
  const lastB = squash(tokB[tokB.length - 1]);
  if (lastA === lastB && (squash(tokA[1]) === squash(tokB[1]) || tokA[1][0] === tokB[1][0])) {
    return true;
  }

  // Todos os tokens significativos do nome menor (3+ tokens) contidos na mesma ordem no maior
  const [shorter, longer] = tokA.length <= tokB.length ? [tokA, tokB] : [tokB, tokA];
  if (shorter.length >= 3 && lastA === lastB) {
    let pos = 0;
    let matchedAll = true;
    for (const st of shorter) {
      const sq = squash(st);
      let found = -1;
      for (let j = pos; j < longer.length; j++) {
        if (squash(longer[j]) === sq) {
          found = j;
          break;
        }
      }
      if (found === -1) {
        matchedAll = false;
        break;
      }
      pos = found + 1;
    }
    if (matchedAll) return true;
  }

  return false;
}

export interface DadosCadastraisGestor {
  registro?: number | null;
  apelido?: string | null;
  /** Sempre mascarado no carregamento em lote (***.XXX.XXX-**) por conformidade LGPD */
  cpfMascarado?: string | null;
  temCpfCadastrado?: boolean;
  /** YYYY-MM-DD */
  dataNascimento?: string | null;
  sexo?: string | null;
  estadoCivil?: string | null;
  naturalidade?: string | null;
  uf?: string | null;
  nacionalidade?: string | null;
  /** YYYY-MM-DD */
  dataAdmissao?: string | null;
  ativo?: boolean;
  origemManual?: boolean;
  syncedAt?: string | null;
}

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
  dadosGestor?: DadosCadastraisGestor;
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

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.fiorix_rh_colaboradores_gestor (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        registro_gestor INT,
        usuario_id VARCHAR(64),
        nome VARCHAR(255) NOT NULL,
        apelido VARCHAR(120),
        cpf VARCHAR(20),
        data_nascimento VARCHAR(32),
        sexo VARCHAR(40),
        estado_civil VARCHAR(60),
        naturalidade VARCHAR(120),
        uf VARCHAR(8),
        nacionalidade VARCHAR(80),
        data_admissao VARCHAR(32),
        cargo VARCHAR(120),
        setor VARCHAR(120),
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_rh_colab_gestor_tenant_nome
        ON public.fiorix_rh_colaboradores_gestor (tenant_id, (LOWER(nome)))
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_rh_colab_gestor_tenant_cpf
        ON public.fiorix_rh_colaboradores_gestor (tenant_id, cpf)
    `);

    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE public.fiorix_rh_colaboradores_gestor ENABLE ROW LEVEL SECURITY`
      );
      await prisma.$executeRawUnsafe(
        `REVOKE ALL ON TABLE public.fiorix_rh_colaboradores_gestor FROM PUBLIC, anon, authenticated`
      );
    } catch {
      // Ambientes de teste/bancos sem roles anon/authenticated ignoram silenciosamente
    }

    await prisma.$executeRawUnsafe(
      `ALTER TABLE public.fiorix_rh_colaboradores_gestor ADD COLUMN IF NOT EXISTS excluido_fiorix BOOLEAN NOT NULL DEFAULT FALSE`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE public.fiorix_rh_colaboradores_gestor ADD COLUMN IF NOT EXISTS excluido_em TIMESTAMP WITH TIME ZONE`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE public.fiorix_rh_colaboradores_gestor ADD COLUMN IF NOT EXISTS excluido_por VARCHAR(120)`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE public.fiorix_rh_colaboradores_gestor ADD COLUMN IF NOT EXISTS motivo_exclusao TEXT`
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE public.fiorix_rh_colaboradores_gestor ADD COLUMN IF NOT EXISTS origem_manual BOOLEAN NOT NULL DEFAULT FALSE`
    );

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.fiorix_ferias_colaboradores_excluidos (
        id VARCHAR(64) PRIMARY KEY,
        tenant_id VARCHAR(64) NOT NULL,
        usuario_id VARCHAR(64),
        registro_gestor INT,
        nome_normalizado VARCHAR(255) NOT NULL,
        nome_exibicao VARCHAR(255) NOT NULL,
        excluido_por VARCHAR(120),
        motivo TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT uq_ferias_colab_excl_tenant_nome UNIQUE (tenant_id, nome_normalizado)
      )
    `);

    try {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE public.fiorix_ferias_colaboradores_excluidos ENABLE ROW LEVEL SECURITY`
      );
      await prisma.$executeRawUnsafe(
        `REVOKE ALL ON TABLE public.fiorix_ferias_colaboradores_excluidos FROM PUBLIC, anon, authenticated`
      );
    } catch {
      // Ignorado em ambientes de teste
    }

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

  // Enriquecimento com cadastro oficial sincronizado do GESTOR (SRVSQL -> PostgreSQL)
  try {
    const gestorRows = await prisma.$queryRawUnsafe<any[]>(
      canViewFullScale
        ? `SELECT id, registro_gestor, usuario_id, nome, apelido, cpf,
                  data_nascimento, sexo, estado_civil, naturalidade, uf,
                  nacionalidade, data_admissao, cargo, setor, ativo, origem_manual, synced_at
           FROM public.fiorix_rh_colaboradores_gestor
           WHERE tenant_id = $1 AND ativo = TRUE AND COALESCE(excluido_fiorix, FALSE) = FALSE
           ORDER BY nome ASC`
        : `SELECT id, registro_gestor, usuario_id, nome, apelido, cpf,
                  data_nascimento, sexo, estado_civil, naturalidade, uf,
                  nacionalidade, data_admissao, cargo, setor, ativo, origem_manual, synced_at
           FROM public.fiorix_rh_colaboradores_gestor
           WHERE tenant_id = $1 AND usuario_id = $2 AND ativo = TRUE AND COALESCE(excluido_fiorix, FALSE) = FALSE
           LIMIT 1`,
      ...(canViewFullScale ? [tenantId] : [tenantId, userId])
    );

    if (Array.isArray(gestorRows) && gestorRows.length > 0) {
      const normalizeName = (s: string) =>
        (s || '')
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, ' ')
          .trim();

      const byUserId = new Map<string, any>();
      const byNormName = new Map<string, any>();

      for (const gr of gestorRows) {
        if (gr.usuario_id) byUserId.set(String(gr.usuario_id), gr);
        if (gr.nome) byNormName.set(normalizeName(String(gr.nome)), gr);
      }

      const matchedGestorIds = new Set<string>();

      items = items.map((item) => {
        const match =
          byUserId.get(item.usuarioId) ||
          byNormName.get(normalizeName(item.nome)) ||
          gestorRows.find(
            (gr) =>
              !matchedGestorIds.has(String(gr.id)) &&
              nomesColaboradorCompativeis(item.nome, String(gr.nome || ''))
          );
        if (!match) return item;
        matchedGestorIds.add(String(match.id));

        const cpfLimpo = limparCpfReal(match.cpf);
        return {
          ...item,
          cargo: item.cargo || match.cargo || undefined,
          setor: item.setor && item.setor !== 'Geral' ? item.setor : match.setor || item.setor,
          dadosGestor: {
            registro: match.registro_gestor != null ? Number(match.registro_gestor) : null,
            apelido: match.apelido || null,
            cpfMascarado: mascararCpfLgpd(cpfLimpo),
            temCpfCadastrado: Boolean(cpfLimpo),
            dataNascimento: normalizarDataIso(match.data_nascimento),
            sexo: match.sexo || null,
            estadoCivil: match.estado_civil || null,
            naturalidade: match.naturalidade || null,
            uf: match.uf || null,
            nacionalidade: match.nacionalidade || null,
            dataAdmissao: normalizarDataIso(match.data_admissao),
            ativo: match.ativo !== false,
            origemManual: Boolean(match.origem_manual),
            syncedAt: match.synced_at ? new Date(match.synced_at).toISOString() : null,
          },
        };
      });

      // Inclui colaboradores ativos vindos do GESTOR que ainda não possuem escala lançada no ano
      if (canViewFullScale) {
        for (const gr of gestorRows) {
          if (matchedGestorIds.has(String(gr.id))) continue;
          const cpfLimpo = limparCpfReal(gr.cpf);
          const syntheticUserId = gr.usuario_id || `gestor_${gr.registro_gestor || gr.id}`;
          items.push({
            id: `esc_pending_${gr.id}_${ano}`,
            usuarioId: String(syntheticUserId),
            ano,
            nome: String(gr.nome),
            setor: gr.setor || 'Atendimento',
            cargo: gr.cargo || undefined,
            p1Dias: 0,
            p2Dias: 0,
            p3Dias: 0,
            totalDias: 0,
            status: 'pendente',
            historico: [],
            dadosGestor: {
              registro: gr.registro_gestor != null ? Number(gr.registro_gestor) : null,
              apelido: gr.apelido || null,
              cpfMascarado: mascararCpfLgpd(cpfLimpo),
              temCpfCadastrado: Boolean(cpfLimpo),
              dataNascimento: normalizarDataIso(gr.data_nascimento),
              sexo: gr.sexo || null,
              estadoCivil: gr.estado_civil || null,
              naturalidade: gr.naturalidade || null,
              uf: gr.uf || null,
              nacionalidade: gr.nacionalidade || null,
              dataAdmissao: normalizarDataIso(gr.data_admissao),
              ativo: gr.ativo !== false,
              origemManual: Boolean(gr.origem_manual),
              syncedAt: gr.synced_at ? new Date(gr.synced_at).toISOString() : null,
            },
          });
        }
      }
    }
  } catch (enrichErr) {
    console.warn('Aviso ao enriquecer escala com dados do GESTOR:', enrichErr);
  }

  if (canViewFullScale) {
    try {
      const exclRows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT usuario_id, registro_gestor, nome_normalizado
         FROM public.fiorix_ferias_colaboradores_excluidos
         WHERE tenant_id = $1`,
        tenantId
      );
      if (Array.isArray(exclRows) && exclRows.length > 0) {
        const exclUsers = new Set<string>();
        const exclRegs = new Set<number>();
        const exclNames = new Set<string>();
        for (const ex of exclRows) {
          if (ex.usuario_id) exclUsers.add(String(ex.usuario_id));
          if (ex.registro_gestor != null) exclRegs.add(Number(ex.registro_gestor));
          if (ex.nome_normalizado) exclNames.add(String(ex.nome_normalizado));
        }
        items = items.filter((it) => {
          if (exclUsers.has(it.usuarioId)) return false;
          if (it.dadosGestor?.registro != null && exclRegs.has(it.dadosGestor.registro)) return false;
          if (exclNames.has(normalizarNomeColaborador(it.nome))) return false;
          return true;
        });
      }
    } catch {
      // Ignora em mocks unitários que não retornam a tabela de excluídos
    }
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

    let excludedUserIds = new Set<string>();
    let excludedNormNames = new Set<string>();
    try {
      const excl = await prisma.$queryRawUnsafe<any[]>(
        `SELECT usuario_id, nome_normalizado FROM public.fiorix_ferias_colaboradores_excluidos WHERE tenant_id = $1`,
        tenantId
      );
      if (Array.isArray(excl)) {
        for (const ex of excl) {
          if (ex.usuario_id) excludedUserIds.add(String(ex.usuario_id));
          if (ex.nome_normalizado) excludedNormNames.add(String(ex.nome_normalizado));
        }
      }
    } catch {}

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
      if (excludedUserIds.has(u.id) || excludedNormNames.has(normalizarNomeColaborador(nome))) {
        continue;
      }
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


export interface RegistroColaboradorGestorSync {
  registro?: number | string | null;
  nome: string;
  apelido?: string | null;
  cpf?: string | null;
  dataNascimento?: string | Date | null;
  sexo?: string | null;
  estadoCivil?: string | null;
  naturalidade?: string | null;
  uf?: string | null;
  nacionalidade?: string | null;
  dataAdmissao?: string | Date | null;
  cargo?: string | null;
  setor?: string | null;
  ativo?: boolean | number | string | null;
}

/**
 * Sincroniza um lote de colaboradores oriundos de GESTOR.dbo.tblColaborador para o PostgreSQL,
 * vinculando automaticamente ao User do tenant quando houver correspondência de CPF ou nome.
 */
export async function upsertColaboradoresGestorBatch(
  tenantId: string,
  records: RegistroColaboradorGestorSync[]
): Promise<{ upserted: number }> {
  if (!records || records.length === 0) return { upserted: 0 };
  await ensureFeriasTablesExist();

  const normalizeName = (s: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, cpf: true, departamento: true, cargo: true },
  });

  const userByCpf = new Map<string, (typeof users)[number]>();
  const userByName = new Map<string, (typeof users)[number]>();
  for (const u of users) {
    const c = limparCpfReal(u.cpf);
    if (c) userByCpf.set(c, u);
    if (u.name) userByName.set(normalizeName(u.name), u);
  }

  let upserted = 0;
  for (const raw of records) {
    const nome = String(raw.nome || '').trim();
    if (!nome) continue;

    const cpfLimpo = limparCpfReal(raw.cpf ? String(raw.cpf) : null);
    const registroNum =
      raw.registro !== undefined && raw.registro !== null && String(raw.registro).trim() !== ''
        ? Number(raw.registro)
        : null;

    const matchedUser =
      (cpfLimpo ? userByCpf.get(cpfLimpo) : undefined) ||
      userByName.get(normalizeName(nome)) ||
      users.find((u) => u.name && nomesColaboradorCompativeis(u.name, nome));

    const keySuffix =
      cpfLimpo ||
      (registroNum !== null && !isNaN(registroNum) ? `reg_${registroNum}` : normalizeName(nome).replace(/[^a-z0-9]/g, '_').slice(0, 36));
    const id = `gestor_${tenantId.slice(-12)}_${keySuffix}`.slice(0, 64);

    const ativoBool =
      raw.ativo === undefined || raw.ativo === null
        ? true
        : raw.ativo === true || raw.ativo === 1 || String(raw.ativo).toLowerCase() === 'true' || String(raw.ativo) === '1';

    const dataNascIso = normalizarDataIso(raw.dataNascimento ?? null);
    const dataAdmIso = normalizarDataIso(raw.dataAdmissao ?? null);

    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_rh_colaboradores_gestor (
        id, tenant_id, registro_gestor, usuario_id, nome, apelido, cpf,
        data_nascimento, sexo, estado_civil, naturalidade, uf,
        nacionalidade, data_admissao, cargo, setor, ativo, synced_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, NOW(), NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        excluido_fiorix = public.fiorix_rh_colaboradores_gestor.excluido_fiorix,
        origem_manual = public.fiorix_rh_colaboradores_gestor.origem_manual,
        registro_gestor = COALESCE(EXCLUDED.registro_gestor, public.fiorix_rh_colaboradores_gestor.registro_gestor),
        usuario_id = COALESCE(EXCLUDED.usuario_id, public.fiorix_rh_colaboradores_gestor.usuario_id),
        nome = EXCLUDED.nome,
        apelido = COALESCE(EXCLUDED.apelido, public.fiorix_rh_colaboradores_gestor.apelido),
        cpf = COALESCE(EXCLUDED.cpf, public.fiorix_rh_colaboradores_gestor.cpf),
        data_nascimento = COALESCE(EXCLUDED.data_nascimento, public.fiorix_rh_colaboradores_gestor.data_nascimento),
        sexo = COALESCE(EXCLUDED.sexo, public.fiorix_rh_colaboradores_gestor.sexo),
        estado_civil = COALESCE(EXCLUDED.estado_civil, public.fiorix_rh_colaboradores_gestor.estado_civil),
        naturalidade = COALESCE(EXCLUDED.naturalidade, public.fiorix_rh_colaboradores_gestor.naturalidade),
        uf = COALESCE(EXCLUDED.uf, public.fiorix_rh_colaboradores_gestor.uf),
        nacionalidade = COALESCE(EXCLUDED.nacionalidade, public.fiorix_rh_colaboradores_gestor.nacionalidade),
        data_admissao = COALESCE(EXCLUDED.data_admissao, public.fiorix_rh_colaboradores_gestor.data_admissao),
        cargo = COALESCE(EXCLUDED.cargo, public.fiorix_rh_colaboradores_gestor.cargo),
        setor = COALESCE(EXCLUDED.setor, public.fiorix_rh_colaboradores_gestor.setor),
        ativo = CASE WHEN public.fiorix_rh_colaboradores_gestor.origem_manual THEN TRUE ELSE EXCLUDED.ativo END,
        synced_at = NOW(),
        updated_at = NOW()`,
      id,
      tenantId,
      registroNum !== null && !isNaN(registroNum) ? registroNum : null,
      matchedUser?.id || null,
      nome,
      raw.apelido ? String(raw.apelido).trim() : null,
      cpfLimpo,
      dataNascIso,
      raw.sexo ? String(raw.sexo).trim() : null,
      raw.estadoCivil ? String(raw.estadoCivil).trim() : null,
      raw.naturalidade ? String(raw.naturalidade).trim() : null,
      raw.uf ? String(raw.uf).trim().toUpperCase() : null,
      raw.nacionalidade ? String(raw.nacionalidade).trim() : null,
      dataAdmIso,
      raw.cargo ? String(raw.cargo).trim() : matchedUser?.cargo || null,
      raw.setor ? String(raw.setor).trim() : matchedUser?.departamento || null,
      ativoBool
    );

    // Sincroniza CPF real validado na tabela User caso o colaborador estivesse sem CPF real
    if (matchedUser && cpfLimpo && limparCpfReal(matchedUser.cpf) !== cpfLimpo) {
      try {
        await prisma.user.update({
          where: { id: matchedUser.id },
          data: { cpf: cpfLimpo },
        });
      } catch {
        // Ignora conflito eventual de unique constraint
      }
    }

    upserted++;
  }

  return { upserted };
}

/**
 * Obtém o CPF formatado completo de um colaborador exclusivamente para revelação individual auditada (RH/ADMIN/MASTER).
 */
export async function obterCpfCompletoColaboradorGestor(
  tenantId: string,
  params: { usuarioId?: string; registroGestor?: number | null; nome?: string }
): Promise<string | null> {
  await ensureFeriasTablesExist();

  if (params.usuarioId) {
    const byUser = await prisma.$queryRawUnsafe<any[]>(
      `SELECT cpf FROM public.fiorix_rh_colaboradores_gestor
       WHERE tenant_id = $1 AND usuario_id = $2 AND cpf IS NOT NULL
       LIMIT 1`,
      tenantId,
      params.usuarioId
    );
    if (byUser?.[0]?.cpf) {
      return formatarCpfCompleto(byUser[0].cpf);
    }
  }

  if (params.registroGestor != null) {
    const byReg = await prisma.$queryRawUnsafe<any[]>(
      `SELECT cpf FROM public.fiorix_rh_colaboradores_gestor
       WHERE tenant_id = $1 AND registro_gestor = $2 AND cpf IS NOT NULL
       LIMIT 1`,
      tenantId,
      Number(params.registroGestor)
    );
    if (byReg?.[0]?.cpf) {
      return formatarCpfCompleto(byReg[0].cpf);
    }
  }

  if (params.nome) {
    const byNome = await prisma.$queryRawUnsafe<any[]>(
      `SELECT cpf FROM public.fiorix_rh_colaboradores_gestor
       WHERE tenant_id = $1 AND LOWER(nome) = LOWER($2) AND cpf IS NOT NULL
       LIMIT 1`,
      tenantId,
      params.nome.trim()
    );
    if (byNome?.[0]?.cpf) {
      return formatarCpfCompleto(byNome[0].cpf);
    }

    // Fallback sem acentos / nomes abreviados (ex: "João Pedro Santana Silva" <-> "Joao Pedro Santana Silva")
    const todosComCpf = await prisma.$queryRawUnsafe<any[]>(
      `SELECT nome, cpf, ativo FROM public.fiorix_rh_colaboradores_gestor
       WHERE tenant_id = $1 AND cpf IS NOT NULL
       ORDER BY ativo DESC, updated_at DESC`,
      tenantId
    );
    if (Array.isArray(todosComCpf)) {
      const compativel = todosComCpf.find(
        (r) => r?.nome && r?.cpf && nomesColaboradorCompativeis(params.nome!, String(r.nome))
      );
      if (compativel?.cpf) {
        return formatarCpfCompleto(compativel.cpf);
      }
    }
  }

  return null;
}


export interface ExclusaoColaboradorItem {
  usuarioId?: string;
  nome: string;
  registroGestor?: number | null;
}

/**
 * Remove definitivamente colaboradores desligados da tela de Férias do FIORIX,
 * impedindo que retornem em futuras sincronizações automáticas do GESTOR.
 */
export async function excluirColaboradoresDaEscalaFiorix(
  tenantId: string,
  itens: ExclusaoColaboradorItem[],
  operadorNome: string,
  motivo?: string
): Promise<{ removidos: number }> {
  if (!itens || itens.length === 0) return { removidos: 0 };
  await ensureFeriasTablesExist();

  let removidos = 0;
  const motivoFinal = (motivo || 'Colaborador desligado / não trabalha mais na Serventia').trim();

  for (const item of itens) {
    const nome = String(item.nome || '').trim();
    if (!nome) continue;
    const nomeNorm = normalizarNomeColaborador(nome);
    if (!nomeNorm) continue;

    const regNum =
      item.registroGestor !== undefined && item.registroGestor !== null
        ? Number(item.registroGestor)
        : null;
    const exclId = `excl_${tenantId.slice(-10)}_${nomeNorm.replace(/\s+/g, '_').slice(0, 40)}`.slice(0, 64);

    // 1. Grava bloqueio persistente para este tenant
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.fiorix_ferias_colaboradores_excluidos (
        id, tenant_id, usuario_id, registro_gestor, nome_normalizado, nome_exibicao, excluido_por, motivo, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      ON CONFLICT (tenant_id, nome_normalizado) DO UPDATE SET
        usuario_id = COALESCE(EXCLUDED.usuario_id, public.fiorix_ferias_colaboradores_excluidos.usuario_id),
        registro_gestor = COALESCE(EXCLUDED.registro_gestor, public.fiorix_ferias_colaboradores_excluidos.registro_gestor),
        excluido_por = EXCLUDED.excluido_por,
        motivo = EXCLUDED.motivo`,
      exclId,
      tenantId,
      item.usuarioId || null,
      regNum,
      nomeNorm,
      nome,
      operadorNome,
      motivoFinal
    );

    // 2. Marca excluido_fiorix = TRUE na tabela espelho do GESTOR (por usuario_id, registro ou nome)
    if (regNum !== null && !isNaN(regNum)) {
      await prisma.$executeRawUnsafe(
        `UPDATE public.fiorix_rh_colaboradores_gestor
         SET excluido_fiorix = TRUE, excluido_em = NOW(), excluido_por = $3, motivo_exclusao = $4, updated_at = NOW()
         WHERE tenant_id = $1 AND registro_gestor = $2`,
        tenantId,
        regNum,
        operadorNome,
        motivoFinal
      );
    }
    if (item.usuarioId) {
      await prisma.$executeRawUnsafe(
        `UPDATE public.fiorix_rh_colaboradores_gestor
         SET excluido_fiorix = TRUE, excluido_em = NOW(), excluido_por = $3, motivo_exclusao = $4, updated_at = NOW()
         WHERE tenant_id = $1 AND usuario_id = $2`,
        tenantId,
        item.usuarioId,
        operadorNome,
        motivoFinal
      );
    }
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_rh_colaboradores_gestor
       SET excluido_fiorix = TRUE, excluido_em = NOW(), excluido_por = $3, motivo_exclusao = $4, updated_at = NOW()
       WHERE tenant_id = $1 AND LOWER(TRIM(nome)) = LOWER(TRIM($2))`,
      tenantId,
      nome,
      operadorNome,
      motivoFinal
    );

    // 3. Remove programações de férias em todos os anos para este colaborador
    if (item.usuarioId) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM public.fiorix_ferias_escala WHERE tenant_id = $1 AND usuario_id = $2`,
        tenantId,
        item.usuarioId
      );
      try {
        await prisma.fiorixFeriasPrevista.deleteMany({
          where: { tenantId, usuarioId: item.usuarioId },
        });
      } catch {}
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM public.fiorix_ferias_escala WHERE tenant_id = $1 AND LOWER(TRIM(nome)) = LOWER(TRIM($2))`,
      tenantId,
      nome
    );

    removidos++;
  }

  return { removidos };
}

export interface NovoColaboradorManualInput {
  nome: string;
  registro?: number | null;
  apelido?: string | null;
  cpf?: string | null;
  dataNascimento?: string | null;
  sexo?: string | null;
  estadoCivil?: string | null;
  naturalidade?: string | null;
  uf?: string | null;
  nacionalidade?: string | null;
  dataAdmissao?: string | null;
  setor: string;
  cargo?: string | null;
  ano: number;
  p1Inicio?: string | null;
  p1Fim?: string | null;
  p1Dias?: number;
  observacao?: string | null;
}

/**
 * Cadastra manualmente um novo colaborador na tela de Férias do FIORIX,
 * com todos os dados pessoais e (opcionalmente) período inicial de férias.
 */
export async function cadastrarColaboradorManualFiorix(
  tenantId: string,
  dados: NovoColaboradorManualInput,
  operadorNome: string
): Promise<EscalaItem> {
  await ensureFeriasTablesExist();

  const nome = dados.nome.trim();
  const nomeNorm = normalizarNomeColaborador(nome);
  const cpfLimpo = limparCpfReal(dados.cpf ?? null);
  const regNum =
    dados.registro !== undefined && dados.registro !== null && String(dados.registro).trim() !== ''
      ? Number(dados.registro)
      : null;

  // Verifica se já existe User correspondente no tenant
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, name: true, cpf: true },
  });
  const matchedUser =
    (cpfLimpo ? users.find((u) => limparCpfReal(u.cpf) === cpfLimpo) : undefined) ||
    users.find((u) => u.name && normalizarNomeColaborador(u.name) === nomeNorm);

  const keySuffix =
    cpfLimpo ||
    (regNum !== null && !isNaN(regNum) ? `reg_${regNum}` : `manual_${nomeNorm.replace(/\s+/g, '_').slice(0, 32)}`);
  const gestorRowId = `gestor_${tenantId.slice(-12)}_${keySuffix}`.slice(0, 64);
  const usuarioId = matchedUser?.id || `manual_${keySuffix}`.slice(0, 64);

  const dataNascIso = normalizarDataIso(dados.dataNascimento ?? null);
  const dataAdmIso = normalizarDataIso(dados.dataAdmissao ?? null);

  // 1. Remove qualquer bloqueio anterior caso esteja sendo readmitido/reincluído
  await prisma.$executeRawUnsafe(
    `DELETE FROM public.fiorix_ferias_colaboradores_excluidos
     WHERE tenant_id = $1 AND (nome_normalizado = $2 OR usuario_id = $3)`,
    tenantId,
    nomeNorm,
    usuarioId
  );

  // 2. Grava ficha cadastral completa como ativa e não excluída
  await prisma.$executeRawUnsafe(
    `INSERT INTO public.fiorix_rh_colaboradores_gestor (
      id, tenant_id, registro_gestor, usuario_id, nome, apelido, cpf,
      data_nascimento, sexo, estado_civil, naturalidade, uf,
      nacionalidade, data_admissao, cargo, setor, ativo, excluido_fiorix, origem_manual, synced_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12,
      $13, $14, $15, $16, TRUE, FALSE, TRUE, NOW(), NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      registro_gestor = COALESCE(EXCLUDED.registro_gestor, public.fiorix_rh_colaboradores_gestor.registro_gestor),
      usuario_id = EXCLUDED.usuario_id,
      nome = EXCLUDED.nome,
      apelido = EXCLUDED.apelido,
      cpf = COALESCE(EXCLUDED.cpf, public.fiorix_rh_colaboradores_gestor.cpf),
      data_nascimento = COALESCE(EXCLUDED.data_nascimento, public.fiorix_rh_colaboradores_gestor.data_nascimento),
      sexo = COALESCE(EXCLUDED.sexo, public.fiorix_rh_colaboradores_gestor.sexo),
      estado_civil = COALESCE(EXCLUDED.estado_civil, public.fiorix_rh_colaboradores_gestor.estado_civil),
      naturalidade = COALESCE(EXCLUDED.naturalidade, public.fiorix_rh_colaboradores_gestor.naturalidade),
      uf = COALESCE(EXCLUDED.uf, public.fiorix_rh_colaboradores_gestor.uf),
      nacionalidade = COALESCE(EXCLUDED.nacionalidade, public.fiorix_rh_colaboradores_gestor.nacionalidade),
      data_admissao = COALESCE(EXCLUDED.data_admissao, public.fiorix_rh_colaboradores_gestor.data_admissao),
      cargo = EXCLUDED.cargo,
      setor = EXCLUDED.setor,
      ativo = TRUE,
      excluido_fiorix = FALSE,
      origem_manual = TRUE,
      updated_at = NOW()`,
    gestorRowId,
    tenantId,
    regNum !== null && !isNaN(regNum) ? regNum : null,
    usuarioId,
    nome,
    dados.apelido ? dados.apelido.trim() : null,
    cpfLimpo,
    dataNascIso,
    dados.sexo ? dados.sexo.trim() : null,
    dados.estadoCivil ? dados.estadoCivil.trim() : null,
    dados.naturalidade ? dados.naturalidade.trim() : null,
    dados.uf ? dados.uf.trim().toUpperCase() : null,
    dados.nacionalidade ? dados.nacionalidade.trim() : 'Brasileiro(a)',
    dataAdmIso,
    dados.cargo ? dados.cargo.trim() : null,
    dados.setor.trim() || 'Atendimento'
  );

  // 3. Cria linha na escala anual solicitada (programado se tiver datas, ou pendente)
  const temFerias = Boolean(dados.p1Inicio && dados.p1Fim && (dados.p1Dias || 0) > 0);
  const item = await salvarOuAtualizarEscala(
    tenantId,
    {
      usuarioId,
      ano: dados.ano,
      nome,
      setor: dados.setor.trim() || 'Atendimento',
      cargo: dados.cargo ? dados.cargo.trim() : undefined,
      p1Inicio: temFerias ? dados.p1Inicio! : undefined,
      p1Fim: temFerias ? dados.p1Fim! : undefined,
      p1Dias: temFerias ? Number(dados.p1Dias) : 0,
      status: temFerias ? 'programado' : 'pendente',
      observacao: dados.observacao || undefined,
    },
    operadorNome
  );

  return {
    ...item,
    dadosGestor: {
      registro: regNum !== null && !isNaN(regNum) ? regNum : null,
      apelido: dados.apelido ? dados.apelido.trim() : null,
      cpfMascarado: mascararCpfLgpd(cpfLimpo),
      temCpfCadastrado: Boolean(cpfLimpo),
      dataNascimento: dataNascIso,
      sexo: dados.sexo || null,
      estadoCivil: dados.estadoCivil || null,
      naturalidade: dados.naturalidade || null,
      uf: dados.uf ? dados.uf.trim().toUpperCase() : null,
      nacionalidade: dados.nacionalidade || 'Brasileiro(a)',
      dataAdmissao: dataAdmIso,
      ativo: true,
      origemManual: true,
    },
  };
}
