'use server';

import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from '@/lib/audit';

export interface DepartamentoItem {
  id: string;
  nome: string;
  sigla: string | null;
  cor: string;
  ativo: boolean;
  ordem: number;
  totalColaboradores: number;
  totalIts: number;
  createdAt: string;
  criadoPorNome?: string | null;
  atualizadoPorNome?: string | null;
  updatedAt?: string | null;
}

export async function getDepartamentos(): Promise<DepartamentoItem[]> {
  const currentUser = await requireRole('ADMIN', 'MASTER', 'RH');
  const tenantId = currentUser.tenantId;

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       d.id::text,
       d.nome,
       d.sigla,
       d.cor,
       d.ativo,
       d.ordem,
       d.created_at as "createdAt",
       d.updated_at as "updatedAt",
       d.criado_por_nome as "criadoPorNome",
       d.atualizado_por_nome as "atualizadoPorNome",
       COALESCE((SELECT count(*)::int FROM public."User" u WHERE u."tenantId" = d.tenant_id AND u.departamento = d.nome), 0) as "totalColaboradores",
       COALESCE((SELECT count(*)::int FROM public.fiorix_its i WHERE i.tenant_id = d.tenant_id AND i.departamento = d.nome AND i.deleted_at IS NULL), 0) as "totalIts"
     FROM public.fiorix_departamentos d
     WHERE d.tenant_id = $1
     ORDER BY d.ordem ASC, d.nome ASC`,
    tenantId
  );

  return rows.map((r) => ({
    id: r.id,
    nome: r.nome,
    sigla: r.sigla,
    cor: r.cor || '#6366f1',
    ativo: r.ativo ?? true,
    ordem: Number(r.ordem || 0),
    totalColaboradores: Number(r.totalColaboradores || 0),
    totalIts: Number(r.totalIts || 0),
    createdAt: r.createdAt ? new Date(r.createdAt).toLocaleString('pt-BR') : '',
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toLocaleString('pt-BR') : '',
    criadoPorNome: r.criadoPorNome || 'Sistema / Inicial',
    atualizadoPorNome: r.atualizadoPorNome,
  }));
}

export async function criarDepartamento(data: {
  nome: string;
  sigla?: string;
  cor?: string;
}) {
  const currentUser = await requireRole('ADMIN', 'MASTER');
  const tenantId = currentUser.tenantId;

  const nome = data.nome?.trim();
  if (!nome) {
    throw new Error('O nome do departamento é obrigatório.');
  }

  // Verificar duplicata
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id FROM public.fiorix_departamentos WHERE tenant_id = $1 AND LOWER(nome) = LOWER($2)`,
    tenantId,
    nome
  );
  if (existing.length > 0) {
    throw new Error('Já existe um departamento com este nome.');
  }

  // Pegar próxima ordem
  const maxOrdem = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COALESCE(MAX(ordem), 0) + 1 as next_ordem FROM public.fiorix_departamentos WHERE tenant_id = $1`,
    tenantId
  );

  await prisma.$executeRawUnsafe(
    `INSERT INTO public.fiorix_departamentos (tenant_id, nome, sigla, cor, ordem, criado_por_nome, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
    tenantId,
    nome,
    data.sigla?.trim() || nome.substring(0, 3).toUpperCase(),
    data.cor || '#6366f1',
    maxOrdem[0]?.next_ordem || 1,
    currentUser.name || 'Administrador'
  );

  await recordAuditLog({
    modulo: 'DEPARTAMENTOS',
    acao: 'INCLUSAO',
    registroDescricao: `Departamento "${nome}" criado`,
    detalhes: { nome, sigla: data.sigla, cor: data.cor },
    userOverride: currentUser,
  });

  revalidatePath('/configuracoes/departamentos');
  return { success: true };
}

export async function atualizarDepartamento(
  id: string,
  data: { nome?: string; sigla?: string; cor?: string; ativo?: boolean; ordem?: number }
) {
  const currentUser = await requireRole('ADMIN', 'MASTER');
  const tenantId = currentUser.tenantId;

  // Verificar se existe e pertence ao tenant
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, nome FROM public.fiorix_departamentos WHERE id = $1::uuid AND tenant_id = $2`,
    id,
    tenantId
  );
  if (existing.length === 0) {
    throw new Error('Departamento não encontrado.');
  }

  const oldNome = existing[0].nome;

  // Se mudou o nome, verificar duplicata
  if (data.nome && data.nome.trim() !== oldNome) {
    const dup = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public.fiorix_departamentos WHERE tenant_id = $1 AND LOWER(nome) = LOWER($2) AND id != $3::uuid`,
      tenantId,
      data.nome.trim(),
      id
    );
    if (dup.length > 0) {
      throw new Error('Já existe um departamento com este nome.');
    }
  }

  const sets: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (data.nome !== undefined) {
    sets.push(`nome = $${idx++}`);
    params.push(data.nome.trim());
  }
  if (data.sigla !== undefined) {
    sets.push(`sigla = $${idx++}`);
    params.push(data.sigla.trim());
  }
  if (data.cor !== undefined) {
    sets.push(`cor = $${idx++}`);
    params.push(data.cor);
  }
  if (data.ativo !== undefined) {
    sets.push(`ativo = $${idx++}`);
    params.push(data.ativo);
  }
  if (data.ordem !== undefined) {
    sets.push(`ordem = $${idx++}`);
    params.push(data.ordem);
  }

  if (sets.length === 0) {
    return { success: true };
  }

  sets.push('updated_at = NOW()');
  sets.push(`atualizado_por_nome = $${idx++}`);
  params.push(currentUser.name || 'Administrador');

  params.push(id);
  params.push(tenantId);

  await prisma.$executeRawUnsafe(
    `UPDATE public.fiorix_departamentos 
     SET ${sets.join(', ')}
     WHERE id = $${idx}::uuid AND tenant_id = $${idx + 1}`,
    ...params
  );

  await recordAuditLog({
    modulo: 'DEPARTAMENTOS',
    acao: 'ALTERACAO',
    registroId: id,
    registroDescricao: `Departamento "${data.nome?.trim() || oldNome}" atualizado`,
    detalhes: { ...data, oldNome },
    userOverride: currentUser,
  });

  // Se o nome mudou, atualizar em todos os Users e ITs que usam o nome antigo
  if (data.nome && data.nome.trim() !== oldNome) {
    const newNome = data.nome.trim();
    await prisma.$executeRawUnsafe(
      `UPDATE public."User" SET departamento = $1 WHERE "tenantId" = $2 AND departamento = $3`,
      newNome,
      tenantId,
      oldNome
    );
    await prisma.$executeRawUnsafe(
      `UPDATE public.fiorix_its SET departamento = $1 WHERE tenant_id = $2 AND departamento = $3`,
      newNome,
      tenantId,
      oldNome
    );
  }

  revalidatePath('/configuracoes/departamentos');
  revalidatePath('/configuracoes/usuarios');
  return { success: true };
}

export async function excluirDepartamento(id: string) {
  const currentUser = await requireRole('ADMIN', 'MASTER');
  const tenantId = currentUser.tenantId;

  // Verificar se existe
  const existing = await prisma.$queryRawUnsafe<any[]>(
    `SELECT nome FROM public.fiorix_departamentos WHERE id = $1::uuid AND tenant_id = $2`,
    id,
    tenantId
  );
  if (existing.length === 0) {
    throw new Error('Departamento não encontrado.');
  }

  const nome = existing[0].nome;

  // Verificar se tem colaboradores ou ITs vinculados
  const usersCount = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int as total FROM public."User" WHERE "tenantId" = $1 AND departamento = $2`,
    tenantId,
    nome
  );
  const itsCount = await prisma.$queryRawUnsafe<any[]>(
    `SELECT count(*)::int as total FROM public.fiorix_its WHERE tenant_id = $1 AND departamento = $2 AND deleted_at IS NULL`,
    tenantId,
    nome
  );

  if (Number(usersCount[0]?.total) > 0 || Number(itsCount[0]?.total) > 0) {
    throw new Error(
      `Não é possível excluir: ${usersCount[0]?.total} colaborador(es) e ${itsCount[0]?.total} IT(s) estão vinculados a este departamento. Transfira-os antes de excluir.`
    );
  }

  await prisma.$executeRawUnsafe(
    `DELETE FROM public.fiorix_departamentos WHERE id = $1::uuid AND tenant_id = $2`,
    id,
    tenantId
  );

  await recordAuditLog({
    modulo: 'DEPARTAMENTOS',
    acao: 'EXCLUSAO',
    registroId: id,
    registroDescricao: `Departamento "${nome}" excluído`,
    userOverride: currentUser,
  });

  revalidatePath('/configuracoes/departamentos');
  return { success: true };
}

export async function listarNomesDepartamentos(): Promise<string[]> {
  const currentUser = await requireRole('ADMIN', 'MASTER', 'RH', 'USER', 'COLABORADOR');
  const tenantId = currentUser.tenantId;

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT nome FROM public.fiorix_departamentos WHERE tenant_id = $1 AND ativo = true ORDER BY ordem ASC, nome ASC`,
    tenantId
  );

  return rows.map((r) => r.nome);
}
