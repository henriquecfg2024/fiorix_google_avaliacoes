'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';

export interface MinhaItCustodiaItem {
  id: string;
  codigo: string;
  titulo: string;
  versao: string;
  departamento: string;
  status: string;
}

export interface EquipeCienciaItem {
  usuarioId: string;
  nome: string;
  cargo: string;
  ciente: boolean;
  cienteEm?: string | null;
  isCurrentUser: boolean;
}

export interface MinhaItDocumento {
  id: string;
  codigo: string;
  titulo: string;
  versao: string;
  departamento: string;
  status: string;
  objetivo: string;
  quandoUsar: string;
  passoAPasso: Array<{ ordem: number; titulo: string; desc?: string } | string>;
  checklist: string[];
  casosPraticos: string[];
  hashVersao: string;
  pdfPath?: string | null;
  pdfUrl?: string | null;
  updatedAt: string;
  responsavelNome: string;
  responsavelEmail: string;
  responsavelCargo: string;
  responsavelCienteEm: string | null;
  // Métricas de ciência da equipe
  adesaoPercentual: number;
  totalColaboradores: number;
  totalCientes: number;
  pendentesCount: number;
  equipeCiencias: EquipeCienciaItem[];
}

export interface MinhaItPageData {
  hasCustodia: boolean;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
    cargo?: string;
    departamento?: string;
  };
  cartorioNome: string;
  cartorioUnidade: string;
  itsCustodia: MinhaItCustodiaItem[];
  currentIt: MinhaItDocumento | null;
}

/**
 * Busca dados da IT ativa sob custódia do usuário logado (Responsável Técnico)
 */
export async function getMinhaItData(codigoParam?: string): Promise<MinhaItPageData> {
  const currentUser = await requireAuth();
  const userId = currentUser.id;
  const isMaster = currentUser.role === 'MASTER';

  // 1. Busca os dados do tenant
  let cartorioNome = '7º Cartório de Registro de Imóveis de São Paulo';
  let cartorioUnidade = 'Unidade Paulista';

  if (currentUser.tenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: currentUser.tenantId },
      select: { name: true, cidade: true, estado: true },
    });
    if (tenant?.name) cartorioNome = tenant.name;
    if (tenant?.cidade) cartorioUnidade = `${tenant.cidade}${tenant.estado ? ` - ${tenant.estado}` : ''}`;
  }

  // 2. Busca as ITs onde o usuário é responsável técnico
  // Se for MASTER e não tiver ITs próprias, carrega todas as ITs ativas do tenant para preview/gestão
  let itsCustodiaRows: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, codigo, titulo, versao, departamento, status
    FROM public.fiorix_its
    WHERE responsavel_tecnico_id = $1
    ORDER BY codigo ASC
  `, userId);

  if (itsCustodiaRows.length === 0 && (isMaster || currentUser.role === 'ADMIN' || currentUser.role === 'SUBSTITUTO')) {
    itsCustodiaRows = await prisma.$queryRawUnsafe(`
      SELECT id, codigo, titulo, versao, departamento, status
      FROM public.fiorix_its
      ORDER BY codigo ASC
    `);
  }

  const itsCustodia: MinhaItCustodiaItem[] = itsCustodiaRows.map((r) => ({
    id: String(r.id),
    codigo: String(r.codigo),
    titulo: String(r.titulo),
    versao: String(r.versao || '1.0'),
    departamento: String(r.departamento || 'Geral'),
    status: String(r.status || 'vigente'),
  }));

  // Se não tem custódia de nenhuma IT
  if (itsCustodia.length === 0) {
    return {
      hasCustodia: false,
      currentUser: {
        id: currentUser.id,
        name: currentUser.name || 'Usuário',
        email: currentUser.email || '',
        role: currentUser.role,
      },
      cartorioNome,
      cartorioUnidade,
      itsCustodia: [],
      currentIt: null,
    };
  }

  // 3. Determina a IT selecionada (por parâmetro de código ou a primeira da lista)
  let selectedItRef = itsCustodia[0];
  if (codigoParam) {
    const match = itsCustodia.find((i) => i.codigo.toUpperCase() === codigoParam.toUpperCase());
    if (match) selectedItRef = match;
  }

  // 4. Busca os detalhes completos da IT selecionada
  const itFullRows: any[] = await prisma.$queryRawUnsafe(`
    SELECT 
      f.id, f.codigo, f.titulo, f.versao, f.departamento, f.status,
      f.objetivo, f.quando_usar, f.passo_a_passo, f.checklist, f.erros_comuns,
      f.hash_versao, f.pdf_path, f.pdf_original_url, f.updated_at,
      u.id as resp_id, u.name as resp_nome, u.email as resp_email, u.cargo as resp_cargo
    FROM public.fiorix_its f
    LEFT JOIN public."User" u ON u.id = f.responsavel_tecnico_id
    WHERE f.id = $1::uuid
    LIMIT 1
  `, selectedItRef.id);

  const itRow = itFullRows[0];
  const itId = String(itRow.id);
  const versao = String(itRow.versao || '1.0');
  const depto = String(itRow.departamento || 'Atendimento');

  // 5. Garante ciência automática imediata para o responsável técnico se ainda não tiver registrado
  try {
    await prisma.$executeRawUnsafe(`
      INSERT INTO public.fiorix_its_ciencias (
        tenant_id, it_id, usuario_id, versao, status, ciente_em, created_at
      )
      VALUES ($1, $2::uuid, $3, $4, 'ciente', NOW(), NOW())
      ON CONFLICT (tenant_id, it_id, usuario_id, versao) DO NOTHING
    `, currentUser.tenantId || 'global', itId, userId, versao);
  } catch (err) {
    console.warn('Aviso ao registrar ciência automática do responsável:', err);
  }

  // Busca a data/hora da ciência do responsável
  let responsavelCienteEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  try {
    const respCienciaRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT ciente_em 
      FROM public.fiorix_its_ciencias 
      WHERE it_id = $1::uuid AND usuario_id = $2 AND versao = $3
      LIMIT 1
    `, itId, userId, versao);

    if (respCienciaRows[0]?.ciente_em) {
      responsavelCienteEm = new Date(respCienciaRows[0].ciente_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    }
  } catch (err) {
    console.warn('Aviso ao buscar data da ciência do responsável:', err);
  }

  // 6. Busca colaboradores do setor e verifica ciências da equipe
  const colabs: any[] = await prisma.$queryRawUnsafe(`
    SELECT id, name, cargo, departamento
    FROM public."User"
    WHERE departamento ILIKE $1 AND (status = 'ativo' OR status IS NULL)
    ORDER BY name ASC
    LIMIT 40
  `, `%${depto}%`);

  // Busca quem deu ciência para esta versão
  const cienciasRows: any[] = await prisma.$queryRawUnsafe(`
    SELECT usuario_id, ciente_em 
    FROM public.fiorix_its_ciencias 
    WHERE it_id = $1::uuid AND versao = $2 AND status = 'ciente'
  `, itId, versao);

  const cienciasMap = new Map<string, Date>();
  for (const c of cienciasRows) {
    cienciasMap.set(String(c.usuario_id), c.ciente_em);
  }

  // Constrói lista de equipe
  const equipeCiencias: EquipeCienciaItem[] = colabs.map((colab) => {
    const isMe = colab.id === userId;
    const cienteDate = cienciasMap.get(colab.id);
    const ciente = isMe || Boolean(cienteDate);

    return {
      usuarioId: String(colab.id),
      nome: isMe ? 'Você (Responsável Técnico)' : (colab.name || 'Colaborador'),
      cargo: colab.cargo || 'Colaborador',
      ciente,
      cienteEm: cienteDate ? new Date(cienteDate).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : (isMe ? responsavelCienteEm : null),
      isCurrentUser: isMe,
    };
  });

  // Ordena a lista: o próprio responsável primeiro, depois quem deu ciência, depois pendentes
  equipeCiencias.sort((a, b) => {
    if (a.isCurrentUser) return -1;
    if (b.isCurrentUser) return 1;
    if (a.ciente && !b.ciente) return -1;
    if (!a.ciente && b.ciente) return 1;
    return a.nome.localeCompare(b.nome);
  });

  const totalColaboradores = Math.max(equipeCiencias.length, 1);
  const totalCientes = equipeCiencias.filter((e) => e.ciente).length;
  const pendentesCount = Math.max(totalColaboradores - totalCientes, 0);
  const adesaoPercentual = Math.round((totalCientes / totalColaboradores) * 100);

  // Formata passos e listas
  let passoAPasso = itRow.passo_a_passo || [];
  if (typeof passoAPasso === 'string') {
    try { passoAPasso = JSON.parse(passoAPasso); } catch { passoAPasso = []; }
  }

  let checklist = itRow.checklist || [];
  if (typeof checklist === 'string') {
    try { checklist = JSON.parse(checklist); } catch { checklist = []; }
  }

  let casosPraticos = itRow.erros_comuns || [];
  if (typeof casosPraticos === 'string') {
    try { casosPraticos = JSON.parse(casosPraticos); } catch { casosPraticos = []; }
  }

  // Gera URL do PDF se houver path
  let pdfUrl = itRow.pdf_original_url || null;
  if (itRow.pdf_path) {
    const { data } = supabaseAdmin.storage.from('it-documentos').getPublicUrl(itRow.pdf_path);
    if (data?.publicUrl) pdfUrl = data.publicUrl;
  }

  const currentIt: MinhaItDocumento = {
    id: itId,
    codigo: String(itRow.codigo),
    titulo: String(itRow.titulo),
    versao,
    departamento: depto,
    status: String(itRow.status || 'vigente'),
    objetivo: String(itRow.objetivo || 'Padronizar a rotina operacional com eficiência e segurança jurídica.'),
    quandoUsar: String(itRow.quando_usar || 'Sempre que houver execução deste procedimento no expediente cartorário.'),
    passoAPasso: Array.isArray(passoAPasso) ? passoAPasso : [],
    checklist: Array.isArray(checklist) ? checklist : [
      'Conferência formal prévia de documentação',
      'Validação de competência registral e prazos legais',
      'Assinatura e lançamento imediato no sistema oficial'
    ],
    casosPraticos: Array.isArray(casosPraticos) ? casosPraticos : [
      'Documento com divergência na qualificação das partes',
      'Solicitação de prioridade com termo de urgência justificado',
      'Ausência de certidão atualizada de tributos'
    ],
    hashVersao: String(itRow.hash_versao || 'a4e1f902bc12d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0'),
    pdfPath: itRow.pdf_path || null,
    pdfUrl,
    updatedAt: new Date(itRow.updated_at || Date.now()).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    responsavelNome: itRow.resp_nome || currentUser.name || 'Responsável Técnico',
    responsavelEmail: itRow.resp_email || currentUser.email || '',
    responsavelCargo: itRow.resp_cargo || 'Escrevente Técnico',
    responsavelCienteEm,
    adesaoPercentual,
    totalColaboradores,
    totalCientes,
    pendentesCount,
    equipeCiencias,
  };

  return {
    hasCustodia: true,
    currentUser: {
      id: currentUser.id,
      name: currentUser.name || 'Usuário',
      email: currentUser.email || '',
      role: currentUser.role,
      cargo: itRow.resp_cargo || 'Responsável Técnico',
      departamento: depto,
    },
    cartorioNome,
    cartorioUnidade,
    itsCustodia,
    currentIt,
  };
}

export interface PublicarNovaVersaoParams {
  itId: string;
  codigo: string;
  novaVersao: string;
  pdfPath: string;
  hashSha256: string;
  resumoMudancas: string;
}

/**
 * Publica nova versão da IT pelo Responsável Técnico:
 * - Incrementa a versão no banco
 * - Atualiza pdf_path e hash_versao
 * - Registra no histórico fiorix_its_versoes
 * - Reseta ciências da equipe (nova versão começa com 0% exceto responsável ciente)
 */
export async function publicarNovaVersaoIT(params: PublicarNovaVersaoParams) {
  try {
    const currentUser = await requireAuth();
    const userId = currentUser.id;
    const tenantId = currentUser.tenantId || 'global';

    // 1. Busca a IT atual para verificação de permissão e histórico
    const currentRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT id, codigo, versao, responsavel_tecnico_id, objetivo, quando_usar, passo_a_passo, checklist, erros_comuns, hash_versao
      FROM public.fiorix_its
      WHERE id = $1::uuid
      LIMIT 1
    `, params.itId);

    if (currentRows.length === 0) {
      return { success: false, error: 'Instrução de trabalho não encontrada.' };
    }

    const current = currentRows[0];

    // Verifica se o usuário é o responsável técnico, ADMIN ou MASTER
    if (current.responsavel_tecnico_id !== userId && currentUser.role !== 'MASTER' && currentUser.role !== 'ADMIN') {
      return { success: false, error: 'Apenas o Responsável Técnico ou Administrador pode atualizar esta instrução.' };
    }

    // 2. Registra versão anterior em fiorix_its_versoes
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO public.fiorix_its_versoes (
          id, it_id, versao, conteudo_snapshot, alteracoes, autor_id, hash_versao, created_at, tenant_id
        )
        VALUES (
          gen_random_uuid(), $1::uuid, $2, $3::jsonb, $4, $5, $6, NOW(), $7
        );
      `,
        current.id,
        current.versao,
        JSON.stringify({
          objetivo: current.objetivo,
          quando_usar: current.quando_usar,
          passo_a_passo: current.passo_a_passo,
          checklist: current.checklist,
        }),
        params.resumoMudancas || 'Atualização de versão pelo Responsável Técnico',
        userId,
        current.hash_versao,
        tenantId
      );
    } catch (err) {
      console.warn('Aviso ao registrar histórico de versão:', err);
    }

    // 3. Atualiza fiorix_its com a nova versão
    let publicUrl = null;
    if (params.pdfPath) {
      try {
        const { data } = supabaseAdmin.storage.from('it-documentos').getPublicUrl(params.pdfPath);
        publicUrl = data?.publicUrl || null;
      } catch (e) {
        console.warn('Aviso ao gerar publicUrl:', e);
      }
    }

    await prisma.$executeRawUnsafe(`
      UPDATE public.fiorix_its
      SET 
        versao = $1,
        hash_versao = $2,
        pdf_path = $3,
        pdf_original_url = $4,
        updated_at = NOW()
      WHERE id = $5::uuid
    `,
      params.novaVersao,
      params.hashSha256,
      params.pdfPath,
      publicUrl,
      params.itId
    );

    // 4. Registra ciência automática imediata para o próprio Responsável Técnico na nova versão
    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO public.fiorix_its_ciencias (
          tenant_id, it_id, usuario_id, versao, status, ciente_em, created_at
        )
        VALUES ($1, $2::uuid, $3, $4, 'ciente', NOW(), NOW())
        ON CONFLICT (tenant_id, it_id, usuario_id, versao) DO UPDATE SET
          status = 'ciente',
          ciente_em = NOW();
      `, tenantId, params.itId, userId, params.novaVersao);
    } catch (err) {
      console.warn('Aviso ao registrar ciência automática do responsável na nova versão:', err);
    }

    try {
      revalidatePath('/minha-it');
      revalidatePath(`/minha-it/${params.codigo}`);
      revalidatePath('/administracao/its');
    } catch (e) {
      console.warn('Aviso ao revalidar cache:', e);
    }

    return { success: true, versao: params.novaVersao };
  } catch (err: any) {
    console.error('Erro em publicarNovaVersaoIT:', err);
    return { success: false, error: err?.message || 'Falha ao processar publicação da nova versão.' };
  }
}
