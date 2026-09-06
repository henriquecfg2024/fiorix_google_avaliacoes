'use server';

import { prisma } from '@/lib/prisma';
import { requireAuth, requireRole } from '@/lib/auth-helpers';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

export async function getUsers() {
  const user = await requireRole('ADMIN', 'MASTER');

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 
       id, 
       name, 
       email, 
       role, 
       "createdAt", 
       cpf, 
       departamento, 
       cargo, 
       ramal, 
       pode_ser_tutor as "podeSerTutor", 
       status
     FROM public."User"
     WHERE "tenantId" = $1
     ORDER BY 
       CASE WHEN role = 'MASTER' THEN 0 WHEN role = 'ADMIN' THEN 1 WHEN role = 'RH' THEN 2 ELSE 3 END,
       name ASC`,
    user.tenantId
  );
  return rows;
}

export async function getTenants() {
  await requireRole('MASTER');

  return prisma.tenant.findMany({
    include: {
      _count: {
        select: { users: true, reviews: true, colaboradores: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
}

export async function createUser(formData: FormData) {
  const currentUser = await requireRole('ADMIN', 'MASTER');

  const name = (formData.get('name') as string)?.trim();
  const email = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const cpf = (formData.get('cpf') as string)?.trim() || null;
  const departamento = (formData.get('departamento') as string) || 'Atendimento';
  const cargo = (formData.get('cargo') as string)?.trim() || 'auxiliar';
  const ramal = (formData.get('ramal') as string)?.trim() || null;
  const podeSerTutor = formData.get('podeSerTutor') === 'true' || formData.get('podeSerTutor') === 'on';

  // REGRA DE FUNÇÃO: Só Henrique Cesar pode ser ADMIN; todos os outros viram COLABORADOR ou RH
  let role = 'COLABORADOR';
  const requestedRole = (formData.get('role') as string) || 'COLABORADOR';
  if (name.toLowerCase().includes('henrique cesar') && requestedRole === 'ADMIN') {
    role = 'ADMIN';
  } else if (requestedRole === 'RH') {
    role = 'RH';
  } else if (requestedRole === 'USER') {
    role = 'USER';
  } else {
    role = 'COLABORADOR';
  }

  if (!name || !email || !password) {
    throw new Error('Nome, e-mail e senha são obrigatórios.');
  }

  // PROTEÇÃO MASTER
  if (email === 'admin@fiorix.com.br') {
    throw new Error('Operação negada: Usuário MASTER protegido.');
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error('Já existe um usuário cadastrado com este e-mail.');
  }

  if (cpf) {
    const existingCpf = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public."User" WHERE cpf = $1 LIMIT 1`,
      cpf
    );
    if (existingCpf.length > 0) {
      throw new Error('Já existe um colaborador cadastrado com este CPF.');
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.$executeRawUnsafe(
    `
    INSERT INTO public."User" (
      id, name, email, "passwordHash", role, "tenantId", 
      cpf, departamento, cargo, ramal, pode_ser_tutor, status, 
      "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text, $1, $2, $3, $4::"Role", $5, 
      $6, $7, $8, $9, $10, 'ativo', 
      NOW(), NOW()
    );
  `,
    name,
    email,
    passwordHash,
    role,
    currentUser.tenantId,
    cpf,
    departamento,
    cargo,
    ramal,
    podeSerTutor
  );

  // Log de auditoria
  try {
    const { logAuditEvent } = await import('@/lib/audit/log');
    await logAuditEvent({
      tenantId: currentUser.tenantId,
      usuarioId: currentUser.id,
      tipo: 'user_created',
      recursoId: email,
      ip: '127.0.0.1',
      metadata: { target_email: email, role, actor_user_id: currentUser.id },
    });
  } catch (err) {
    // Non-blocking
  }

  revalidatePath('/configuracoes/usuarios');
  revalidatePath('/configuracoes');
}

export async function createTenant(formData: FormData) {
  await requireRole('MASTER');

  const tenantName = formData.get('tenantName') as string;
  const adminEmail = formData.get('adminEmail') as string;
  const adminPassword = formData.get('adminPassword') as string;
  const adminName = formData.get('adminName') as string;

  if (!tenantName || !adminEmail || !adminPassword) {
    throw new Error('Preencha o nome do cartório, e-mail e senha do administrador.');
  }

  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existingUser) {
    throw new Error('E-mail do administrador já está em uso.');
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: { name: tenantName }
    });

    await tx.user.create({
      data: {
        name: adminName || 'Administrador',
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        tenantId: tenant.id
      }
    });
  });

  revalidatePath('/configuracoes');
}

export async function resetUserPassword(userId: string, newPassword: string) {
  const currentUser = await requireRole('ADMIN', 'MASTER');

  if (!userId || !newPassword || newPassword.trim().length < 6) {
    return { error: 'A nova senha deve ter no mínimo 6 caracteres.' };
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return { error: 'Usuário não encontrado.' };

  // REGRA CRÍTICA - PROTEÇÃO MASTER
  if (targetUser.email === 'admin@fiorix.com.br' || targetUser.role === 'MASTER') {
    return { error: 'Usuário MASTER protegido - não pode ser alterado sob nenhuma circunstância.' };
  }

  if (currentUser.role !== 'MASTER' && targetUser.tenantId !== currentUser.tenantId) {
    return { error: 'Não autorizado a alterar este usuário.' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$executeRawUnsafe(
    `
    UPDATE public."User"
    SET "passwordHash" = $1, "updatedAt" = NOW()
    WHERE id = $2 AND role != 'MASTER' AND email != 'admin@fiorix.com.br';
  `,
    passwordHash,
    userId
  );

  revalidatePath('/configuracoes/usuarios');
  return { success: true };
}

export async function updateUserRole(
  userId: string,
  newRole: 'COLABORADOR' | 'USER' | 'RH' | 'ADMIN'
) {
  const currentUser = await requireRole('ADMIN', 'MASTER');

  const validRoles = ['COLABORADOR', 'USER', 'RH', 'ADMIN'];
  if (!validRoles.includes(newRole)) {
    return { error: 'Função inválida fornecida.' };
  }

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return { error: 'Usuário não encontrado.' };

  // REGRA CRÍTICA - PROTEÇÃO MASTER
  if (targetUser.email === 'admin@fiorix.com.br' || targetUser.role === 'MASTER') {
    return { error: 'Usuário MASTER protegido - não pode ser alterado sob nenhuma circunstância.' };
  }

  if (currentUser.role !== 'MASTER' && targetUser.tenantId !== currentUser.tenantId) {
    return { error: 'Não autorizado a alterar este usuário.' };
  }

  // Só Henrique Cesar pode ser promovido a ADMIN
  if (newRole === 'ADMIN' && !targetUser.name?.toLowerCase().includes('henrique cesar')) {
    return { error: 'Apenas Henrique Cesar Ferreira Gama possui prerrogativa de ADMIN na organização.' };
  }

  const oldRole = targetUser.role;

  await prisma.$executeRawUnsafe(
    `
    UPDATE public."User"
    SET role = $1::"Role", "updatedAt" = NOW()
    WHERE id = $2 AND role != 'MASTER' AND email != 'admin@fiorix.com.br';
  `,
    newRole,
    userId
  );

  // Log de auditoria
  try {
    const { logAuditEvent } = await import('@/lib/audit/log');
    await logAuditEvent({
      tenantId: currentUser.tenantId,
      usuarioId: currentUser.id,
      tipo: 'user_role_changed',
      recursoId: targetUser.id,
      ip: '127.0.0.1',
      metadata: {
        actor_user_id: currentUser.id,
        target_user_id: targetUser.id,
        old_role: oldRole,
        new_role: newRole,
        organization_id: currentUser.tenantId,
      },
    });
  } catch (err) {
    // Non-blocking
  }

  revalidatePath('/configuracoes/usuarios');
  return { success: true };
}

export async function updateUserName(userId: string, newName: string) {
  const currentUser = await requireRole('ADMIN', 'MASTER');

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return { error: 'Usuário não encontrado.' };

  // REGRA CRÍTICA - PROTEÇÃO MASTER
  if (targetUser.email === 'admin@fiorix.com.br' || targetUser.role === 'MASTER') {
    return { error: 'Usuário MASTER protegido - não pode ser alterado sob nenhuma circunstância.' };
  }

  if (currentUser.role !== 'MASTER' && targetUser.tenantId !== currentUser.tenantId) {
    return { error: 'Não autorizado a alterar este usuário.' };
  }

  await prisma.$executeRawUnsafe(
    `
    UPDATE public."User"
    SET name = $1, "updatedAt" = NOW()
    WHERE id = $2 AND role != 'MASTER' AND email != 'admin@fiorix.com.br';
  `,
    newName.trim(),
    userId
  );

  revalidatePath('/configuracoes/usuarios');
  return { success: true };
}

export async function updateUserCpf(userId: string, newCpf: string) {
  const currentUser = await requireRole('ADMIN', 'MASTER');

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return { error: 'Usuário não encontrado.' };

  // REGRA CRÍTICA - PROTEÇÃO MASTER
  if (targetUser.email === 'admin@fiorix.com.br' || targetUser.role === 'MASTER') {
    return { error: 'Usuário MASTER protegido - não pode ser alterado sob nenhuma circunstância.' };
  }

  const cleanCpf = newCpf.trim();
  if (cleanCpf) {
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public."User" WHERE cpf = $1 AND id != $2 LIMIT 1`,
      cleanCpf,
      userId
    );
    if (existing.length > 0) {
      return { error: 'Este CPF já está cadastrado para outro colaborador.' };
    }
  }

  await prisma.$executeRawUnsafe(
    `
    UPDATE public."User"
    SET cpf = $1, "updatedAt" = NOW()
    WHERE id = $2 AND role != 'MASTER' AND email != 'admin@fiorix.com.br';
  `,
    cleanCpf || null,
    userId
  );

  revalidatePath('/configuracoes/usuarios');
  return { success: true };
}

export async function toggleUserStatus(userId: string) {
  const currentUser = await requireRole('ADMIN', 'MASTER');

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return { error: 'Usuário não encontrado.' };

  // REGRA CRÍTICA - PROTEÇÃO MASTER
  if (targetUser.email === 'admin@fiorix.com.br' || targetUser.role === 'MASTER') {
    return { error: 'Usuário MASTER protegido - não pode ser alterado sob nenhuma circunstância.' };
  }

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT status FROM public."User" WHERE id = $1`,
    userId
  );
  const currentStatus = rows[0]?.status || 'ativo';
  const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo';

  await prisma.$executeRawUnsafe(
    `
    UPDATE public."User"
    SET status = $1, "updatedAt" = NOW()
    WHERE id = $2 AND role != 'MASTER' AND email != 'admin@fiorix.com.br';
  `,
    newStatus,
    userId
  );

  revalidatePath('/configuracoes/usuarios');
  return { success: true, newStatus };
}

export async function updateUserProfile(
  userId: string,
  data: {
    name?: string;
    email?: string;
    cpf?: string;
    departamento?: string;
    cargo?: string;
    role?: string;
    status?: string;
  }
) {
  const currentUser = await requireRole('ADMIN', 'MASTER');

  const targetUser = await prisma.user.findUnique({ where: { id: userId } });
  if (!targetUser) return { error: 'Usuário não encontrado.' };

  // REGRA CRÍTICA - PROTEÇÃO MASTER
  if (targetUser.email === 'admin@fiorix.com.br' || targetUser.role === 'MASTER') {
    return { error: 'Usuário MASTER protegido - não pode ser alterado sob nenhuma circunstância.' };
  }

  if (currentUser.role !== 'MASTER' && targetUser.tenantId !== currentUser.tenantId) {
    return { error: 'Não autorizado a alterar este usuário.' };
  }

  // Validar e-mail único
  if (data.email && data.email.trim() !== targetUser.email) {
    const existingEmail = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public."User" WHERE email = $1 AND id != $2 LIMIT 1`,
      data.email.trim().toLowerCase(),
      userId
    );
    if (existingEmail.length > 0) {
      return { error: 'Este e-mail já está cadastrado para outro usuário.' };
    }
  }

  // Validar CPF único
  const cleanCpf = data.cpf?.trim() || '';
  if (cleanCpf) {
    const existingCpf = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM public."User" WHERE cpf = $1 AND id != $2 LIMIT 1`,
      cleanCpf,
      userId
    );
    if (existingCpf.length > 0) {
      return { error: 'Este CPF já está cadastrado para outro colaborador.' };
    }
  }

  // Validar role
  const validRoles = ['COLABORADOR', 'USER', 'RH', 'ADMIN'];
  if (data.role && !validRoles.includes(data.role)) {
    return { error: 'Função inválida.' };
  }

  // Construir SET dinâmico
  const sets: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (data.name !== undefined) {
    sets.push(`name = $${paramIdx++}`);
    params.push(data.name.trim());
  }
  if (data.email !== undefined) {
    sets.push(`email = $${paramIdx++}`);
    params.push(data.email.trim().toLowerCase());
  }
  if (data.cpf !== undefined) {
    sets.push(`cpf = $${paramIdx++}`);
    params.push(cleanCpf || null);
  }
  if (data.departamento !== undefined) {
    sets.push(`departamento = $${paramIdx++}`);
    params.push(data.departamento.trim() || null);
  }
  if (data.cargo !== undefined) {
    sets.push(`cargo = $${paramIdx++}`);
    params.push(data.cargo.trim() || null);
  }
  if (data.role !== undefined) {
    sets.push(`role = $${paramIdx++}::"Role"`);
    params.push(data.role);
  }
  if (data.status !== undefined) {
    sets.push(`status = $${paramIdx++}`);
    params.push(data.status);
  }

  if (sets.length === 0) {
    return { error: 'Nenhum campo para atualizar.' };
  }

  sets.push(`"updatedAt" = NOW()`);
  params.push(userId);

  const query = `
    UPDATE public."User"
    SET ${sets.join(', ')}
    WHERE id = $${paramIdx} AND role != 'MASTER' AND email != 'admin@fiorix.com.br';
  `;

  await prisma.$executeRawUnsafe(query, ...params);

  revalidatePath('/configuracoes/usuarios');
  revalidatePath('/sistema/pessoas');
  return { success: true };
}
