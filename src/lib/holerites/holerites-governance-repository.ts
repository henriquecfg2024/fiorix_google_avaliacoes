import { prisma } from '@/lib/prisma';
import {
  ensureFeriasTablesExist,
  nomesColaboradorCompativeis,
} from '@/lib/ferias/ferias-repository';
import {
  formatarDataGestorBr,
  limparCpfReal,
  mascararCpfLgpd,
} from '@/lib/ferias/idade-calculator';
import {
  avaliarStatusPrazoCompetencia,
  avaliarTempestividadeUpload,
  calcularPrazoLegalClt,
  formatarCompetenciaCurta,
  formatarCompetenciaTitulo,
  formatarSiglaCardMes,
  obterTipoFolhaPorMes,
  obterUltimoDiaCompetenciaIso,
  PrazoLegalCltInfo,
  StatusPrazoCompetencia,
  TipoFolhaHolerite,
} from './clt-prazo-calculator';

export interface ColaboradorAtivoServentia {
  chaveUnica: string;
  usuarioId: string | null;
  registroGestor: number | null;
  nome: string;
  nomeNormalizado: string;
  setor: string;
  cargo: string | null;
  dataAdmissaoIso: string | null;
  dataAdmissaoBr: string | null;
  cpfMascarado: string | null;
  temCpfCadastrado: boolean;
}

export interface ColaboradorFaltanteHolerite {
  chaveUnica: string;
  usuarioId: string | null;
  registroGestor: number | null;
  nome: string;
  setor: string;
  cargo: string | null;
  dataAdmissaoBr: string | null;
  cpfMascarado: string | null;
  temCpfCadastrado: boolean;
  emFeriasNoMes: boolean;
  padraoArquivoSugerido: string;
}

export interface DispensaLegalHoleriteItem {
  id: string;
  usuarioId: string | null;
  registroGestor: number | null;
  nomeNormalizado: string;
  colaboradorNome: string;
  ano: number;
  mes: number;
  motivoCodigo: string;
  motivoLabel: string;
  descricao: string | null;
  registradoPorNome: string;
  criadoEmBr: string;
}

export interface ChecklistCltItem {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string;
  concluido: boolean;
  automatico: boolean;
  statusTexto: string;
  severidade: 'ok' | 'alerta' | 'pendente';
}

export interface ResumoCompetenciaHolerite {
  ano: number;
  mes: number; // 1..12 Mensal, 13 = 13º 1ª Parc, 14 = 13º 2ª Parc
  sigla: string;
  codigo: string;
  titulo: string;
  tipoFolha: TipoFolhaHolerite;
  prazoClt: PrazoLegalCltInfo;
  statusPrazo: StatusPrazoCompetencia;
  diasRestantesOuAtraso: number;
  elegiveisCount: number;
  arquivadosCount: number;
  dispensadosCount: number;
  faltantesCount: number;
  visualizadosCount: number;
  noPrazoCount: number;
  foraDoPrazoCount: number;
  percentualCobertura: number;
  homologada: boolean;
  homologadoPorNome: string | null;
  homologadoEmBr: string | null;
  manifestHashSha256: string | null;
  observacoesHomologacao: string | null;
  faltantes: ColaboradorFaltanteHolerite[];
  dispensas: DispensaLegalHoleriteItem[];
  checklist: ChecklistCltItem[];
}

export interface PainelGovernancaHoleritesData {
  ano: number;
  anosDisponiveis: number[];
  totalColaboradoresAtivos: number;
  totalHoleritesAcervoGeral: number;
  totalHoleritesAno: number;
  competenciaSugeridaMes: number;
  competencias: ResumoCompetenciaHolerite[];
}

export const MOTIVOS_DISPENSA_HOLERITE: Record<string, string> = {
  AFASTAMENTO_INSS: 'Afastamento Previdenciário (INSS)',
  LICENCA_SEM_VENCIMENTO: 'Licença sem Vencimentos',
  FERIAS_MES_ANTERIOR: 'Férias Pagas Integralmente no Mês Anterior',
  CONTRATO_SUSPENSO: 'Suspensão Temporária de Contrato',
  OUTRO_LEGAL: 'Outra Hipótese Legal / Administrativa',
};

export function normalizarNomeChave(nome: string): string {
  return (nome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

let governanceTablesPromise: Promise<void> | null = null;

/**
 * Inicializa de forma idempotente as colunas de snapshot/CLT em `fiorix_holerites`
 * e as tabelas `fiorix_holerites_competencias` e `fiorix_holerites_dispensas` com RLS.
 */
export async function ensureHoleritesGovernanceTablesExist(): Promise<void> {
  if (governanceTablesPromise) return governanceTablesPromise;

  governanceTablesPromise = (async () => {
    try {
      await ensureFeriasTablesExist();

      // 1. Colunas adicionais em public.fiorix_holerites (100% retrocompatível)
      await prisma.$executeRawUnsafe(`
        ALTER TABLE public.fiorix_holerites
          ADD COLUMN IF NOT EXISTS tipo_folha TEXT NOT NULL DEFAULT 'MENSAL',
          ADD COLUMN IF NOT EXISTS prazo_legal_clt DATE,
          ADD COLUMN IF NOT EXISTS entregue_no_prazo_clt BOOLEAN NOT NULL DEFAULT TRUE,
          ADD COLUMN IF NOT EXISTS justificativa_atraso TEXT,
          ADD COLUMN IF NOT EXISTS colaborador_nome_snapshot TEXT,
          ADD COLUMN IF NOT EXISTS registro_gestor_snapshot INTEGER,
          ADD COLUMN IF NOT EXISTS cpf_mascarado_snapshot TEXT,
          ADD COLUMN IF NOT EXISTS setor_snapshot TEXT,
          ADD COLUMN IF NOT EXISTS cargo_snapshot TEXT,
          ADD COLUMN IF NOT EXISTS primeira_visualizacao_em TIMESTAMPTZ;
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_fiorix_holerites_tenant_ano_mes
        ON public.fiorix_holerites (tenant_id, ano, mes);
      `);

      await prisma.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS idx_fiorix_holerites_tenant_hash
        ON public.fiorix_holerites (tenant_id, arquivo_hash);
      `);

      // 2. Livro de Fechamento e Homologação Mensal/Anual de Competências
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.fiorix_holerites_competencias (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          ano INTEGER NOT NULL,
          mes INTEGER NOT NULL,
          tipo_folha TEXT NOT NULL DEFAULT 'MENSAL',
          prazo_legal_clt DATE NOT NULL,
          status_fechamento TEXT NOT NULL DEFAULT 'ABERTA',
          total_elegiveis INTEGER NOT NULL DEFAULT 0,
          total_arquivados INTEGER NOT NULL DEFAULT 0,
          total_dispensados INTEGER NOT NULL DEFAULT 0,
          total_no_prazo_clt INTEGER NOT NULL DEFAULT 0,
          manifest_hash_sha256 TEXT,
          homologado_por_id TEXT,
          homologado_por_nome TEXT,
          homologado_em TIMESTAMPTZ,
          observacoes TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (tenant_id, ano, mes)
        );
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE public.fiorix_holerites_competencias ENABLE ROW LEVEL SECURITY;
      `);

      // 3. Dispensas / Justificativas Legais de Ausência na Competência
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public.fiorix_holerites_dispensas (
          id TEXT PRIMARY KEY,
          tenant_id TEXT NOT NULL,
          usuario_id TEXT,
          registro_gestor INTEGER,
          nome_normalizado TEXT NOT NULL,
          colaborador_nome TEXT NOT NULL,
          ano INTEGER NOT NULL,
          mes INTEGER NOT NULL,
          tipo_folha TEXT NOT NULL DEFAULT 'MENSAL',
          motivo_codigo TEXT NOT NULL,
          descricao TEXT,
          registrado_por_id TEXT,
          registrado_por_nome TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (tenant_id, nome_normalizado, ano, mes)
        );
      `);

      await prisma.$executeRawUnsafe(`
        ALTER TABLE public.fiorix_holerites_dispensas ENABLE ROW LEVEL SECURITY;
      `);
    } catch (err) {
      governanceTablesPromise = null;
      console.warn('[Holerites Governance] Aviso ao verificar tabelas de governança:', err);
    }
  })();

  return governanceTablesPromise;
}

/**
 * Obtém a base unificada e deduplicada de colaboradores ativos da Serventia (GESTOR + FIORIX),
 * idêntica à lógica nominal de Férias, respeitando desligados e exclusões permanentes do FIORIX.
 */
export async function obterColaboradoresAtivosUnificadosServentia(
  tenantId: string
): Promise<ColaboradorAtivoServentia[]> {
  await ensureFeriasTablesExist();

  const [users, gestorRows, exclRows] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        cpf: true,
        departamento: true,
        cargo: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma
      .$queryRawUnsafe<any[]>(
        `SELECT id, registro_gestor, usuario_id, nome, cpf, data_admissao, cargo, setor, ativo, excluido_fiorix
         FROM public.fiorix_rh_colaboradores_gestor
         WHERE tenant_id = $1
         ORDER BY ativo DESC, nome ASC`,
        tenantId
      )
      .catch(() => [] as any[]),
    prisma
      .$queryRawUnsafe<any[]>(
        `SELECT usuario_id, registro_gestor, nome_normalizado
         FROM public.fiorix_ferias_colaboradores_excluidos
         WHERE tenant_id = $1`,
        tenantId
      )
      .catch(() => [] as any[]),
  ]);

  const exclUserIds = new Set<string>();
  const exclRegistros = new Set<number>();
  const exclNomes = new Set<string>();

  for (const ex of exclRows || []) {
    if (ex.usuario_id) exclUserIds.add(String(ex.usuario_id));
    if (ex.registro_gestor != null) exclRegistros.add(Number(ex.registro_gestor));
    if (ex.nome_normalizado) exclNomes.add(String(ex.nome_normalizado));
  }

  // Colaboradores explicitamente inativos no GESTOR também não entram como ativos
  const inativosGestorNomes = new Set<string>();
  const ativosGestor = (gestorRows || []).filter((g) => {
    const isAtivo = g.ativo !== false && g.excluido_fiorix !== true;
    if (!isAtivo && g.nome) {
      inativosGestorNomes.add(normalizarNomeChave(String(g.nome)));
    }
    return isAtivo;
  });

  const resultado: ColaboradorAtivoServentia[] = [];
  const usedUserIds = new Set<string>();

  const formatIsoDate = (val: any): string | null => {
    if (!val) return null;
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    const s = String(val).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  };

  // 1) Prioriza todos os colaboradores ativos do GESTOR / Manuais
  for (const g of ativosGestor) {
    const reg = g.registro_gestor != null ? Number(g.registro_gestor) : null;
    const nome = String(g.nome || '').trim();
    if (!nome) continue;
    const nomeNorm = normalizarNomeChave(nome);

    if (
      (reg != null && exclRegistros.has(reg)) ||
      exclNomes.has(nomeNorm) ||
      (g.usuario_id && exclUserIds.has(String(g.usuario_id)))
    ) {
      continue;
    }

    const matchedUser =
      (g.usuario_id
        ? users.find((u) => u.id === String(g.usuario_id))
        : undefined) ||
      users.find(
        (u) =>
          !usedUserIds.has(u.id) &&
          u.name &&
          nomesColaboradorCompativeis(u.name, nome)
      );

    if (matchedUser) {
      if (exclUserIds.has(matchedUser.id)) continue;
      usedUserIds.add(matchedUser.id);
    }

    const cpfLimpo = limparCpfReal(g.cpf) || limparCpfReal(matchedUser?.cpf);
    const admIso = formatIsoDate(g.data_admissao);

    resultado.push({
      chaveUnica: matchedUser?.id || (reg != null ? `gestor_${reg}` : `nome_${nomeNorm}`),
      usuarioId: matchedUser?.id || null,
      registroGestor: reg,
      nome: matchedUser?.name || nome,
      nomeNormalizado: nomeNorm,
      setor: (g.setor ? String(g.setor) : matchedUser?.departamento) || 'Geral',
      cargo: (g.cargo ? String(g.cargo) : matchedUser?.cargo) || null,
      dataAdmissaoIso: admIso,
      dataAdmissaoBr: formatarDataGestorBr(admIso),
      cpfMascarado: mascararCpfLgpd(cpfLimpo),
      temCpfCadastrado: Boolean(cpfLimpo),
    });
  }

  // 2) Complementa com usuários ativos do FIORIX que não estejam inativos no GESTOR nem excluídos
  for (const u of users) {
    if (usedUserIds.has(u.id)) continue;
    const nome = (u.name || '').trim();
    if (!nome) continue;
    const nomeNorm = normalizarNomeChave(nome);

    if (exclUserIds.has(u.id) || exclNomes.has(nomeNorm)) continue;

    // Se consta como inativo no GESTOR, não inclui na folha ativa
    const isInativoGestor = Array.from(inativosGestorNomes).some((inativoNome) =>
      nomesColaboradorCompativeis(nome, inativoNome)
    );
    if (isInativoGestor) continue;

    // Evita duplicar se já entrou via nome compatível em resultado
    if (resultado.some((r) => nomesColaboradorCompativeis(r.nome, nome))) {
      continue;
    }

    const cpfLimpo = limparCpfReal(u.cpf);
    resultado.push({
      chaveUnica: u.id,
      usuarioId: u.id,
      registroGestor: null,
      nome,
      nomeNormalizado: nomeNorm,
      setor: u.departamento || 'Geral',
      cargo: u.cargo || null,
      dataAdmissaoIso: null,
      dataAdmissaoBr: null,
      cpfMascarado: mascararCpfLgpd(cpfLimpo),
      temCpfCadastrado: Boolean(cpfLimpo),
    });
  }

  resultado.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
  return resultado;
}

function periodoOverlapCompetencia(
  inicio: Date | string | null | undefined,
  fim: Date | string | null | undefined,
  ano: number,
  mes: number
): boolean {
  if (!inicio || !fim || mes > 12) return false;
  const d1 = typeof inicio === 'string' ? new Date(inicio) : inicio;
  const d2 = typeof fim === 'string' ? new Date(fim) : fim;
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return false;
  const startMonth = Date.UTC(ano, mes - 1, 1, 0, 0, 0);
  const endMonth = Date.UTC(ano, mes, 0, 23, 59, 59);
  return d1.getTime() <= endMonth && d2.getTime() >= startMonth;
}

/**
 * Monta todo o painel anual e mensal de Governança Trabalhista (CLT), Faltantes e Custódia de Holerites.
 */
export async function obterPainelGovernancaHolerites(
  tenantId: string,
  anoInput?: number
): Promise<PainelGovernancaHoleritesData> {
  await ensureHoleritesGovernanceTablesExist();

  const agora = new Date();
  const anoAtual = agora.getFullYear();
  const ano = anoInput && anoInput >= 2000 && anoInput <= 2100 ? anoInput : anoAtual;

  const [
    colaboradoresAtivos,
    holeritesAno,
    anosDistintosRows,
    totalAcervoGeral,
    competenciasFechadasRows,
    dispensasRows,
    feriasPrevistasRows,
  ] = await Promise.all([
    obterColaboradoresAtivosUnificadosServentia(tenantId),
    prisma.fiorixHolerite.findMany({
      where: { tenantId, ano },
      include: {
        usuario: { select: { id: true, name: true } },
      },
    }),
    prisma.fiorixHolerite
      .findMany({
        where: { tenantId },
        select: { ano: true },
        distinct: ['ano'],
      })
      .catch(() => [] as Array<{ ano: number }>),
    prisma.fiorixHolerite.count({ where: { tenantId } }),
    prisma
      .$queryRawUnsafe<any[]>(
        `SELECT * FROM public.fiorix_holerites_competencias WHERE tenant_id = $1 AND ano = $2`,
        tenantId,
        ano
      )
      .catch(() => [] as any[]),
    prisma
      .$queryRawUnsafe<any[]>(
        `SELECT * FROM public.fiorix_holerites_dispensas WHERE tenant_id = $1 AND ano = $2 ORDER BY colaborador_nome ASC`,
        tenantId,
        ano
      )
      .catch(() => [] as any[]),
    prisma.fiorixFeriasPrevista
      .findMany({
        where: { tenantId },
        select: { usuarioId: true, dataInicioPrevista: true, dataFimPrevista: true },
      })
      .catch(() => [] as any[]),
  ]);

  // Verifica visualizações reais dos holerites do ano em FiorixAcessoLog
  const holeriteIdsAno = holeritesAno.map((h) => h.id);
  const logsVisualizacao =
    holeriteIdsAno.length > 0
      ? await prisma.fiorixAcessoLog.findMany({
          where: {
            tenantId,
            recursoId: { in: holeriteIdsAno },
            tipo: 'holerite_download_authorized',
          },
          select: { recursoId: true },
        })
      : [];
  const holeritesVisualizadosSet = new Set(
    logsVisualizacao.map((l) => l.recursoId).filter(Boolean) as string[]
  );

  // Anos disponíveis no navegador plurianual
  const anosSet = new Set<number>([anoAtual - 1, anoAtual, anoAtual + 1, ano]);
  for (const r of anosDistintosRows) {
    if (r.ano) anosSet.add(r.ano);
  }
  const anosDisponiveis = Array.from(anosSet).sort((a, b) => b - a);

  const fechamentoPorMes = new Map<number, any>();
  for (const fc of competenciasFechadasRows || []) {
    fechamentoPorMes.set(Number(fc.mes), fc);
  }

  const dispensasPorMes = new Map<number, DispensaLegalHoleriteItem[]>();
  for (const d of dispensasRows || []) {
    const m = Number(d.mes);
    const arr = dispensasPorMes.get(m) || [];
    const cod = String(d.motivo_codigo || 'OUTRO_LEGAL');
    arr.push({
      id: String(d.id),
      usuarioId: d.usuario_id ? String(d.usuario_id) : null,
      registroGestor: d.registro_gestor != null ? Number(d.registro_gestor) : null,
      nomeNormalizado: String(d.nome_normalizado),
      colaboradorNome: String(d.colaborador_nome),
      ano: Number(d.ano),
      mes: m,
      motivoCodigo: cod,
      motivoLabel: MOTIVOS_DISPENSA_HOLERITE[cod] || cod,
      descricao: d.descricao ? String(d.descricao) : null,
      registradoPorNome: d.registrado_por_nome ? String(d.registrado_por_nome) : 'RH',
      criadoEmBr: d.created_at ? new Date(d.created_at).toLocaleString('pt-BR') : '—',
    });
    dispensasPorMes.set(m, arr);
  }

  const feriasPorUsuario = new Map<string, Array<{ ini: Date; fim: Date }>>();
  for (const fp of feriasPrevistasRows || []) {
    const list = feriasPorUsuario.get(fp.usuarioId) || [];
    list.push({ ini: fp.dataInicioPrevista, fim: fp.dataFimPrevista });
    feriasPorUsuario.set(fp.usuarioId, list);
  }

  const competencias: ResumoCompetenciaHolerite[] = [];

  // Meses 1..12 + 13 (13º 1ª Parcela) + 14 (13º 2ª Parcela)
  for (let mes = 1; mes <= 14; mes++) {
    const prazoClt = calcularPrazoLegalClt(ano, mes);
    const ultimoDiaCompIso = obterUltimoDiaCompetenciaIso(ano, mes);

    // Colaboradores elegíveis na competência: admitidos até o último dia da competência
    const elegiveis = colaboradoresAtivos.filter((c) => {
      if (!c.dataAdmissaoIso) return true;
      return c.dataAdmissaoIso <= ultimoDiaCompIso;
    });

    const holeritesMes = holeritesAno.filter((h) => h.mes === mes);
    const dispensasMes = dispensasPorMes.get(mes) || [];
    const fechamento = fechamentoPorMes.get(mes);
    const homologada = fechamento?.status_fechamento === 'HOMOLOGADA';

    let noPrazoCount = 0;
    let foraDoPrazoCount = 0;
    let visualizadosCount = 0;
    let hashesIntactos = true;

    for (const h of holeritesMes) {
      const temp = avaliarTempestividadeUpload(h.dataUpload, prazoClt.dataLimiteIso);
      if (temp.noPrazo) noPrazoCount++;
      else foraDoPrazoCount++;

      if (holeritesVisualizadosSet.has(h.id)) {
        visualizadosCount++;
      }
      if (!h.arquivoHash || h.arquivoHash.length < 32) {
        hashesIntactos = false;
      }
    }

    // Identifica quem já recebeu holerite ou possui dispensa legal no mês
    const faltantes: ColaboradorFaltanteHolerite[] = [];
    let elegiveisAtendidosCount = 0;
    let elegiveisDispensadosCount = 0;

    for (const colab of elegiveis) {
      const temHolerite = holeritesMes.some(
        (h) =>
          (colab.usuarioId && h.usuarioId === colab.usuarioId) ||
          (h.usuario?.name && nomesColaboradorCompativeis(h.usuario.name, colab.nome))
      );

      if (temHolerite) {
        elegiveisAtendidosCount++;
        continue;
      }

      const temDispensa = dispensasMes.some(
        (d) =>
          (colab.usuarioId && d.usuarioId === colab.usuarioId) ||
          d.nomeNormalizado === colab.nomeNormalizado ||
          nomesColaboradorCompativeis(d.colaboradorNome, colab.nome)
      );

      if (temDispensa) {
        elegiveisDispensadosCount++;
        continue;
      }

      const feriasUser = colab.usuarioId ? feriasPorUsuario.get(colab.usuarioId) || [] : [];
      const emFeriasNoMes = feriasUser.some((f) =>
        periodoOverlapCompetencia(f.ini, f.fim, ano, mes)
      );

      const sufixoComp =
        mes === 13
          ? `13-1-${ano}`
          : mes === 14
          ? `13-2-${ano}`
          : `${String(mes).padStart(2, '0')}-${ano}`;

      faltantes.push({
        chaveUnica: colab.chaveUnica,
        usuarioId: colab.usuarioId,
        registroGestor: colab.registroGestor,
        nome: colab.nome,
        setor: colab.setor,
        cargo: colab.cargo,
        dataAdmissaoBr: colab.dataAdmissaoBr,
        cpfMascarado: colab.cpfMascarado,
        temCpfCadastrado: colab.temCpfCadastrado,
        emFeriasNoMes,
        padraoArquivoSugerido: `CPF_${sufixoComp}.pdf`,
      });
    }

    // Caso existam holerites enviados de colaboradores desligados após aquela folha histórica, contabiliza também no acervo do mês
    const arquivadosCount = holeritesMes.length;
    const elegiveisCount = Math.max(elegiveis.length, elegiveisAtendidosCount + elegiveisDispensadosCount);
    const cobertos = Math.min(elegiveisCount, Math.max(elegiveisAtendidosCount, arquivadosCount) + elegiveisDispensadosCount);
    const percentualCobertura =
      elegiveisCount > 0 ? Math.min(100, Math.round((cobertos / elegiveisCount) * 100)) : 0;

    const avaliacao = avaliarStatusPrazoCompetencia({
      ano,
      mes,
      dataLimiteIso: prazoClt.dataLimiteIso,
      elegiveis: elegiveisCount,
      arquivados: Math.max(elegiveisAtendidosCount, arquivadosCount),
      dispensados: elegiveisDispensadosCount,
      noPrazoCount,
      homologada,
    });

    const cobertura100 = faltantes.length === 0 && elegiveisCount > 0;
    const tempestividadeOk = foraDoPrazoCount === 0 && avaliacao.status !== 'PENDENTE_ATRASO';

    const checklist: ChecklistCltItem[] = [
      {
        id: 'base_gestor',
        ordem: 1,
        titulo: 'Base Nominal Elegível Sincronizada (GESTOR × FIORIX)',
        descricao: `Colaboradores ativos admitidos até ${formatarDataGestorBr(ultimoDiaCompIso) || ultimoDiaCompIso}, descontados desligados.`,
        concluido: elegiveisCount > 0,
        automatico: true,
        statusTexto: `${elegiveisCount} elegíveis apurados`,
        severidade: elegiveisCount > 0 ? 'ok' : 'pendente',
      },
      {
        id: 'cobertura_envio',
        ordem: 2,
        titulo: 'Totalidade dos Holerites Enviados / Arquivados no FIORIX',
        descricao:
          faltantes.length === 0
            ? 'Todos os colaboradores elegíveis receberam holerite ou possuem justificativa legal registrada.'
            : `Faltam ${faltantes.length} colaborador(es) receberem o comprovante desta competência.`,
        concluido: cobertura100,
        automatico: true,
        statusTexto: cobertura100
          ? `100% atendidos (${arquivadosCount} PDF${elegiveisDispensadosCount > 0 ? ` + ${elegiveisDispensadosCount} disp.` : ''})`
          : `${faltantes.length} faltante(s)`,
        severidade: cobertura100 ? 'ok' : avaliacao.status === 'PENDENTE_ATRASO' ? 'alerta' : 'pendente',
      },
      {
        id: 'prazo_clt',
        ordem: 3,
        titulo: `Cumprimento do Prazo Legal Trabalhista (Limite: ${prazoClt.dataLimiteBr})`,
        descricao: `${prazoClt.fundamentoLegal}.${
          prazoClt.caiNoSabado && prazoClt.sextaBancariaRecomendadaBr
            ? ` Atenção: o limite cai no sábado; recomenda-se antecipação bancária até sexta-feira (${prazoClt.sextaBancariaRecomendadaBr}).`
            : ''
        }`,
        concluido: cobertura100 && foraDoPrazoCount === 0,
        automatico: true,
        statusTexto:
          foraDoPrazoCount > 0
            ? `${foraDoPrazoCount} enviado(s) após ${prazoClt.dataLimiteBr}`
            : avaliacao.status === 'PENDENTE_ATRASO'
            ? `Prazo vencido em ${prazoClt.dataLimiteBr}`
            : cobertura100
            ? `100% no prazo CLT`
            : `Prazo até ${prazoClt.dataLimiteBr}`,
        severidade: !tempestividadeOk ? 'alerta' : cobertura100 ? 'ok' : 'pendente',
      },
      {
        id: 'integridade_lgpd',
        ordem: 4,
        titulo: 'Validação 1-para-1 de CPF e Custódia Criptográfica SHA-256',
        descricao: 'Correspondência exata dos 11 dígitos do CPF, isolamento individual Anti-IDOR e hash SHA-256 auditável (Prov. CNJ 213/2026).',
        concluido: arquivadosCount > 0 && hashesIntactos,
        automatico: true,
        statusTexto:
          arquivadosCount > 0 && hashesIntactos
            ? `${arquivadosCount} hash(es) SHA-256 íntegros`
            : 'Aguardando arquivamento',
        severidade: arquivadosCount > 0 && hashesIntactos ? 'ok' : 'pendente',
      },
      {
        id: 'homologacao_rh',
        ordem: 5,
        titulo: 'Homologação Oficial da Competência para Auditoria / Corregedoria',
        descricao: homologada
          ? `Competência encerrada por ${fechamento.homologado_por_nome || 'RH'} com manifesto SHA-256 registrado na trilha WORM.`
          : 'Após conferir o envio de todos os holerites, homologue a competência para gerar a ata criptográfica WORM.',
        concluido: homologada,
        automatico: false,
        statusTexto: homologada ? 'Homologada (WORM)' : 'Aguardando homologação',
        severidade: homologada ? 'ok' : 'pendente',
      },
    ];

    competencias.push({
      ano,
      mes,
      sigla: formatarSiglaCardMes(mes),
      codigo: formatarCompetenciaCurta(mes, ano),
      titulo: formatarCompetenciaTitulo(mes, ano),
      tipoFolha: obterTipoFolhaPorMes(mes),
      prazoClt,
      statusPrazo: avaliacao.status,
      diasRestantesOuAtraso: avaliacao.diasRestantesOuAtraso,
      elegiveisCount,
      arquivadosCount,
      dispensadosCount: elegiveisDispensadosCount,
      faltantesCount: faltantes.length,
      visualizadosCount,
      noPrazoCount,
      foraDoPrazoCount,
      percentualCobertura,
      homologada,
      homologadoPorNome: fechamento?.homologado_por_nome ? String(fechamento.homologado_por_nome) : null,
      homologadoEmBr: fechamento?.homologado_em
        ? new Date(fechamento.homologado_em).toLocaleString('pt-BR')
        : null,
      manifestHashSha256: fechamento?.manifest_hash_sha256 ? String(fechamento.manifest_hash_sha256) : null,
      observacoesHomologacao: fechamento?.observacoes ? String(fechamento.observacoes) : null,
      faltantes,
      dispensas: dispensasMes,
      checklist,
    });
  }

  // Sugere automaticamente a competência mais recente com envios no ano; se nenhuma tiver envios, sugere o mês anterior (folha em fechamento)
  const mesesComArquivos = competencias
    .filter((c) => c.arquivadosCount > 0)
    .sort((a, b) => b.mes - a.mes);

  let competenciaSugeridaMes = 1;
  if (mesesComArquivos.length > 0) {
    competenciaSugeridaMes = mesesComArquivos[0].mes;
  } else if (ano === anoAtual) {
    const mesAtual1a12 = agora.getMonth() + 1;
    // Nos primeiros 10 dias do mês, o RH normalmente está fechando a competência do mês anterior
    competenciaSugeridaMes = agora.getDate() <= 10 && mesAtual1a12 > 1 ? mesAtual1a12 - 1 : mesAtual1a12;
  } else {
    competenciaSugeridaMes = 12;
  }

  return {
    ano,
    anosDisponiveis,
    totalColaboradoresAtivos: colaboradoresAtivos.length,
    totalHoleritesAcervoGeral: totalAcervoGeral,
    totalHoleritesAno: holeritesAno.length,
    competenciaSugeridaMes,
    competencias,
  };
}
