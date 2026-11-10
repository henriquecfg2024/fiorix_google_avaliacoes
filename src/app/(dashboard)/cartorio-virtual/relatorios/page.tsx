import React from 'react';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth-helpers';
import { ConstrutorRelatorioPersonalizadoClient } from '@/components/relatorios/ConstrutorRelatorioPersonalizadoClient';

export const dynamic = 'force-dynamic';

export default async function CartorioVirtualRelatoriosPage() {
  let user;
  try {
    user = await requireAuth();
  } catch {
    redirect('/login');
  }

  const roleNorm = String(user.role || '').toUpperCase();
  const isGestorReal =
    roleNorm === 'MASTER' ||
    roleNorm === 'SUBSTITUTO' ||
    roleNorm === 'SUPER_ADMIN' ||
    roleNorm === 'TENANT_ADMIN' ||
    roleNorm === 'ADMIN' ||
    roleNorm === 'GESTOR' ||
    roleNorm === 'MANAGER';

  return (
    <ConstrutorRelatorioPersonalizadoClient
      usuarioNomeInicial={user.name || user.email || 'Colaborador'}
      usuarioRoleInicial={roleNorm || 'COLABORADOR'}
      isGestorRealInicial={isGestorReal}
    />
  );
}

