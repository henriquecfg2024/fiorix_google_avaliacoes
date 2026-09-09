'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';

export interface ActiveTenantItem {
  id: string;
  name: string;
  slug: string | null;
  dominio: string | null;
  cnpj: string | null;
  cidade: string | null;
  estado: string | null;
}

/**
 * Busca cartórios ativos/trial para exibir no seletor da tela de login.
 * Não requer autenticação para permitir a seleção antes do login.
 */
export async function getActiveTenants(): Promise<ActiveTenantItem[]> {
  try {
    const tenants = await prisma.tenant.findMany({
      where: {
        status: { in: ['ativo', 'trial'] },
      },
      select: {
        id: true,
        name: true,
        slug: true,
        dominio: true,
        cnpj: true,
        cidade: true,
        estado: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
    return tenants;
  } catch (err) {
    console.error('Erro ao buscar cartórios ativos:', err);
    return [];
  }
}

export interface MasterTenantItem {
  id: string;
  name: string;
  slug: string | null;
  cnpj: string | null;
  dominio: string | null;
  cidade: string | null;
  estado: string | null;
  plano: string;
  status: string;
  maxUsuarios: number;
  dpoEmail: string | null;
  responsavelNome: string | null;
  responsavelEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    users: number;
    colaboradores: number;
  };
}

export interface MasterOverviewMetrics {
  totalCartorios: number;
  cartoriosAtivos: number;
  cartoriosTrial: number;
  totalUsuarios: number;
  planos: {
    omega: number;
    pro: number;
    basic: number;
  };
}

/**
 * Busca todos os cartórios e métricas globais para o Painel Master.
 * Apenas usuários com perfil MASTER podem acessar.
 */
export async function getMasterTenants(): Promise<{
  tenants: MasterTenantItem[];
  metrics: MasterOverviewMetrics;
}> {
  const currentUser = await requireAuth();
  if (currentUser.role !== 'MASTER') {
    throw new Error('Acesso negado: apenas o MASTER da plataforma pode gerenciar cartórios.');
  }

  const tenants = await prisma.tenant.findMany({
    include: {
      _count: {
        select: {
          users: true,
          colaboradores: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const totalCartorios = tenants.length;
  const cartoriosAtivos = tenants.filter(t => t.status === 'ativo').length;
  const cartoriosTrial = tenants.filter(t => t.status === 'trial').length;
  const totalUsuarios = tenants.reduce((acc, t) => acc + t._count.users, 0);

  const planos = {
    omega: tenants.filter(t => t.plano?.toUpperCase() === 'OMEGA').length,
    pro: tenants.filter(t => t.plano?.toUpperCase() === 'PRO').length,
    basic: tenants.filter(t => t.plano?.toUpperCase() === 'BASIC').length,
  };

  return {
    tenants,
    metrics: {
      totalCartorios,
      cartoriosAtivos,
      cartoriosTrial,
      totalUsuarios,
      planos,
    },
  };
}

export interface CreateTenantInput {
  name: string;
  slug: string;
  cnpj?: string;
  dominio?: string;
  cidade?: string;
  estado?: string;
  plano?: 'BASIC' | 'PRO' | 'OMEGA';
  status?: 'ativo' | 'trial' | 'suspenso' | 'inativo';
  maxUsuarios?: number;
  responsavelNome?: string;
  responsavelEmail?: string;
  dpoEmail?: string;
  // Usuário inicial opcional
  adminNome?: string;
  adminEmail?: string;
  adminSenha?: string;
}

/**
 * Cria um novo cartório no SaaS.
 * Restrito ao perfil MASTER.
 */
export async function createTenant(input: CreateTenantInput) {
  const currentUser = await requireAuth();
  if (currentUser.role !== 'MASTER') {
    throw new Error('Acesso negado: apenas o MASTER da plataforma pode cadastrar novos cartórios.');
  }

  const cleanSlug = input.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!cleanSlug) throw new Error('O slug do cartório é obrigatório.');

  const existingSlug = await prisma.tenant.findUnique({
    where: { slug: cleanSlug },
  });
  if (existingSlug) {
    throw new Error(`O slug "${cleanSlug}" já está em uso por outro cartório.`);
  }

  const newTenant = await prisma.tenant.create({
    data: {
      name: input.name.trim(),
      slug: cleanSlug,
      cnpj: input.cnpj?.trim() || null,
      dominio: input.dominio?.trim()?.toLowerCase() || null,
      cidade: input.cidade?.trim() || null,
      estado: input.estado?.trim()?.toUpperCase() || null,
      plano: input.plano || 'PRO',
      status: input.status || 'ativo',
      maxUsuarios: Number(input.maxUsuarios) || 100,
      responsavelNome: input.responsavelNome?.trim() || null,
      responsavelEmail: input.responsavelEmail?.trim()?.toLowerCase() || null,
      dpoEmail: input.dpoEmail?.trim()?.toLowerCase() || null,
    },
  });

  // Cria usuário administrador inicial se informado
  if (input.adminEmail && input.adminSenha) {
    const email = input.adminEmail.trim().toLowerCase();
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (!existingUser) {
      const passwordHash = await bcrypt.hash(input.adminSenha, 10);
      await prisma.user.create({
        data: {
          name: input.adminNome?.trim() || input.responsavelNome?.trim() || 'Administrador',
          email,
          passwordHash,
          role: 'ADMIN',
          tenantId: newTenant.id,
        },
      });
    }
  }

  revalidatePath('/master/tenants');
  revalidatePath('/login');

  return { success: true, tenant: newTenant };
}

/**
 * Atualiza os dados de um cartório existente.
 * Restrito ao perfil MASTER.
 */
export async function updateTenant(
  tenantId: string,
  data: Partial<Omit<CreateTenantInput, 'adminNome' | 'adminEmail' | 'adminSenha'>>
) {
  const currentUser = await requireAuth();
  if (currentUser.role !== 'MASTER') {
    throw new Error('Acesso negado: apenas o MASTER da plataforma pode editar cartórios.');
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      name: data.name ? data.name.trim() : undefined,
      slug: data.slug ? data.slug.trim().toLowerCase() : undefined,
      cnpj: data.cnpj !== undefined ? data.cnpj?.trim() || null : undefined,
      dominio: data.dominio !== undefined ? data.dominio?.trim()?.toLowerCase() || null : undefined,
      cidade: data.cidade !== undefined ? data.cidade?.trim() || null : undefined,
      estado: data.estado !== undefined ? data.estado?.trim()?.toUpperCase() || null : undefined,
      plano: data.plano || undefined,
      status: data.status || undefined,
      maxUsuarios: data.maxUsuarios ? Number(data.maxUsuarios) : undefined,
      responsavelNome: data.responsavelNome !== undefined ? data.responsavelNome?.trim() || null : undefined,
      responsavelEmail: data.responsavelEmail !== undefined ? data.responsavelEmail?.trim()?.toLowerCase() || null : undefined,
      dpoEmail: data.dpoEmail !== undefined ? data.dpoEmail?.trim()?.toLowerCase() || null : undefined,
    },
  });

  revalidatePath('/master/tenants');
  revalidatePath('/login');

  return { success: true, tenant: updated };
}
